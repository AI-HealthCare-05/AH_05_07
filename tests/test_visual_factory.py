"""Offline/fault-injected tests. No live R2 account or production assertions."""

from __future__ import annotations

import binascii
import os
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parents[1] / "tools" / "visual-factory"
sys.path.insert(0, str(TOOLS))
import media_probe as media  # noqa: E402
import r2_transport as transport  # noqa: E402
import visual_factory as factory  # noqa: E402


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)


def png(width=2, height=2, color=6, alpha=255, metadata=True, interlace=0):
    header = struct.pack(">IIBBBBB", width, height, 8, color, 0, 0, interlace)
    pixel = bytes([100, 120, 140, alpha]) if color == 6 else bytes([100, 120, 140])
    rows = b"".join(b"\0" + pixel * width for _ in range(height))
    result = media.PNG_MAGIC + chunk(b"IHDR", header)
    if metadata:
        result += chunk(b"tEXt", b"Comment\0synthetic offline test")
    return result + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def webp(width=2, height=2):
    # This deliberately tests container-only classification, not codec decoding.
    bits = (width - 1) | ((height - 1) << 14)
    data = b"\x2f" + bits.to_bytes(4, "little") + b"\0"
    body = b"WEBP" + b"VP8L" + len(data).to_bytes(4, "little") + data
    return b"RIFF" + len(body).to_bytes(4, "little") + body


class FakeRemote:
    def __init__(self, fail_at=None):
        self.puts = []
        self.checks = 0
        self.fail_at = fail_at

    def check_private(self):
        self.checks += 1
        return {"scope": "MOCK_PRIVATE_CHECK"}

    def put_verified(self, key, data, content_type):
        self.puts.append((key, data, content_type))
        if self.fail_at == len(self.puts):
            raise transport.TransportError("SIMULATED remote failure")


class MediaTests(unittest.TestCase):
    def test_png_actual_alpha(self):
        result = media.inspect_media(png(alpha=90), ".png")
        self.assertEqual(result["alphaMin"], 90)
        self.assertTrue(result["hasTransparentPixels"])
        self.assertEqual(result["transparentPixelCount"], 4)

    def test_rgba_can_be_fully_opaque(self):
        self.assertFalse(media.inspect_media(png(), ".png")["hasTransparentPixels"])

    def test_rgb_is_not_transparent(self):
        self.assertFalse(media.inspect_media(png(color=2), ".png")["hasTransparentPixels"])

    def test_alpha_filters_all_five(self):
        desired = [[10, 100, 255], [250, 50, 0]]
        for method in range(5):
            previous = [0] * 3
            raw = bytearray()
            for values in desired:
                row = bytearray()
                for i, value in enumerate(values):
                    left = values[i - 1] if i else 0
                    corner = previous[i - 1] if i else 0
                    predictor = [
                        0,
                        left,
                        previous[i],
                        (left + previous[i]) // 2,
                        media.paeth(left, previous[i], corner),
                    ][method]
                    row.extend([0, 0, 0, (value - predictor) & 255])
                raw.extend(bytes([method]) + row)
                previous = values
            info = media.alpha_info(bytes(raw), 3, 2, 4, 6, None, None)
            self.assertEqual(info["alphaMin"], 0)
            self.assertEqual(info["alphaMax"], 255)
            self.assertEqual(info["transparentPixelCount"], 5)

    def test_renaming_does_not_convert_png(self):
        with self.assertRaisesRegex(media.MediaError, "extension"):
            media.inspect_media(png(), ".webp")

    def test_invalid_signature(self):
        with self.assertRaises(media.MediaError):
            media.inspect_media(b"not an image", ".png")

    def test_truncated_png(self):
        with self.assertRaises(media.MediaError):
            media.inspect_media(png()[:-5], ".png")

    def test_crc_mismatch(self):
        data = bytearray(png())
        data[29] ^= 1
        with self.assertRaisesRegex(media.MediaError, "CRC"):
            media.inspect_media(bytes(data), ".png")

    def test_trailing_bytes(self):
        with self.assertRaises(media.MediaError):
            media.inspect_media(png() + b"extra", ".png")

    def test_huge_dimensions_rejected_before_inflate(self):
        data = media.PNG_MAGIC + chunk(b"IHDR", struct.pack(">IIBBBBB", 9000, 9000, 8, 6, 0, 0, 0))
        data += chunk(b"IDAT", zlib.compress(b"\0")) + chunk(b"IEND", b"")
        with self.assertRaisesRegex(media.MediaError, "dimensions"):
            media.inspect_media(data, ".png")

    def test_decompression_size_is_bounded(self):
        data = media.PNG_MAGIC + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
        data += chunk(b"IDAT", zlib.compress(b"\0" * 1_000_000)) + chunk(b"IEND", b"")
        with self.assertRaisesRegex(media.MediaError, "decompressed"):
            media.inspect_media(data, ".png")

    def test_interlace_requires_separate_decoder(self):
        with self.assertRaisesRegex(media.MediaError, "non-interlaced"):
            media.inspect_media(png(interlace=1), ".png")

    def test_animation_not_silently_flattened(self):
        data = png()
        data = data[:33] + chunk(b"acTL", struct.pack(">II", 2, 0)) + data[33:]
        with self.assertRaisesRegex(media.MediaError, "Animated PNG"):
            media.inspect_media(data, ".png")

    def test_metadata_copy_keeps_original_bytes_untouched(self):
        original = png()
        clean = media.sanitize_png(original)
        self.assertIn(b"tEXt", original)
        self.assertNotIn(b"tEXt", clean)
        self.assertEqual(media.inspect_media(clean, ".png")["metadataChunks"], [])
        self.assertNotEqual(factory.digest(original), factory.digest(clean))

    def test_webp_validation_limit_is_explicit(self):
        info = media.inspect_media(webp(), ".webp")
        self.assertEqual(info["validation"], "webp-container-only-not-decoded")
        self.assertIsNone(info["hasTransparentPixels"])

    def test_webp_length_mismatch(self):
        with self.assertRaises(media.MediaError):
            media.inspect_media(webp() + b"x", ".webp")


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="sk7-factory-test-")
        self.home = Path(self.tmp.name) / "archive"
        factory.init_workspace(self.home)
        self.inbox = self.home / "inbox"

    def tearDown(self):
        self.tmp.cleanup()

    def image(self, name="bear.png", data=None):
        path = self.inbox / name
        path.write_bytes(png() if data is None else data)
        os.utime(path, (time_zero := 1_700_000_000, time_zero))
        return path

    def enable_mock(self):
        cfg = factory.config(self.home)
        cfg.update(bucket=transport.ALLOWED_BUCKET, privateTargetConfirmed=True)
        factory.atomic_write(self.home, "config.json", factory.encoded(cfg))

    def ingest(self):
        return factory.scan_inbox(self.home, write=True)

    def snapshot(self):
        return {str(p.relative_to(self.home)): p.read_bytes() for p in self.home.rglob("*") if p.is_file()}

    def test_default_remote_is_disabled(self):
        self.assertFalse(factory.config(self.home)["privateTargetConfirmed"])

    def test_init_is_idempotent(self):
        before = self.snapshot()
        factory.init_workspace(self.home)
        self.assertEqual(before, self.snapshot())

    def test_dry_run_zero_workspace_and_r2_writes(self):
        self.image()
        before = self.snapshot()
        with patch.object(factory, "WranglerTransport", side_effect=AssertionError("network forbidden")):
            result = factory.scan_inbox(self.home)
        self.assertEqual(result["mode"], "DRY_RUN")
        self.assertEqual(result["r2Writes"], 0)
        self.assertEqual(before, self.snapshot())
        self.assertEqual(result["accepted"][0]["status"], "needs-review")

    def test_candidate_is_not_approved(self):
        self.image()
        result = self.ingest()
        record = result["accepted"][0]
        self.assertFalse(record["runtimeApproved"])
        self.assertEqual(record["status"], "needs-review")
        self.assertIsNone(record["plannedProductKey"])

    def test_source_original_survives(self):
        source = self.image()
        before = source.read_bytes()
        record = self.ingest()["accepted"][0]
        self.assertEqual((self.home / record["original"]).read_bytes(), before)
        self.assertEqual(source.read_bytes(), before)

    def test_deduplication_by_content_not_name(self):
        self.image("one.png")
        self.image("two.png")
        result = self.ingest()
        self.assertEqual(len(result["accepted"]), 1)
        self.assertEqual(len(result["skipped"]), 1)
        before = self.snapshot()
        self.ingest()
        self.assertEqual(before, self.snapshot())

    def test_bad_file_does_not_hide_good_input(self):
        self.image("bad.png", b"broken")
        self.image("good.png")
        result = self.ingest()
        self.assertEqual(len(result["accepted"]), 1)
        self.assertEqual(len(result["rejected"]), 1)

    def test_symlink_input_is_rejected(self):
        source = self.image()
        (self.inbox / "link.png").symlink_to(source)
        result = self.ingest()
        self.assertTrue(any(row["file"] == "link.png" for row in result["rejected"]))

    def test_recent_file_waits_until_stable(self):
        path = self.image()
        os.utime(path, None)
        self.assertEqual(len(self.ingest()["accepted"]), 0)

    def test_incomplete_download_suffix_ignored(self):
        self.image("bear.png.part")
        self.assertEqual(len(self.ingest()["accepted"]), 0)

    def test_gallery_escapes_filename(self):
        self.image("<script>alert(1)</script>.png".replace("/", "_"))
        self.ingest()
        page = (self.home / "gallery.html").read_text()
        self.assertNotIn("<script>alert", page)
        self.assertIn("&lt;script&gt;", page)

    def test_product_slot_is_only_a_proposal(self):
        self.image()
        result = factory.scan_inbox(self.home, scene="S12")
        record = result["accepted"][0]
        self.assertEqual(record["plannedProductKey"], factory.SCENES["S12"])
        self.assertFalse(record["runtimeApproved"])

    def test_symlink_archive_directory_refused(self):
        target = self.home / "evil"
        target.mkdir()
        (self.home / "trap").symlink_to(target, target_is_directory=True)
        with self.assertRaises(factory.FactoryError):
            factory.atomic_write(self.home, "trap/value.json", b"{}")

    def test_traversal_refused(self):
        with self.assertRaises(factory.FactoryError):
            factory.atomic_write(self.home, "../outside.json", b"{}")

    def test_production_worktree_cannot_be_archive(self):
        work = Path(self.tmp.name) / "repo"
        work.mkdir()
        (work / ".git").mkdir()
        with self.assertRaises(factory.FactoryError):
            factory.init_workspace(work / "inbox")

    def test_general_archive_directory_refused(self):
        for broad in (Path("/"), Path.home(), Path.home() / "Downloads"):
            with self.assertRaises(factory.FactoryError):
                factory.safe_home(broad)

    def test_symlink_parent_cannot_hide_repository(self):
        repo = Path(self.tmp.name) / "real-repo"
        repo.mkdir()
        (repo / ".git").mkdir()
        alias = Path(self.tmp.name) / "alias"
        alias.symlink_to(repo, target_is_directory=True)
        with self.assertRaises(factory.FactoryError):
            factory.safe_home(alias / "archive")

    def test_reconfigure_keeps_selected_account(self):
        self.enable_mock()
        cfg = factory.config(self.home)
        cfg["accountId"] = "a" * 32
        factory.atomic_write(self.home, "config.json", factory.encoded(cfg))
        args = SimpleNamespace(confirm_private_target=True, bucket=transport.ALLOWED_BUCKET, account_id=None)
        with patch.object(factory, "WranglerTransport", return_value=FakeRemote()):
            factory.configure_r2(self.home, args)
        self.assertEqual(factory.config(self.home)["accountId"], "a" * 32)

    def test_lock_prevents_concurrent_writers(self):
        with factory.workspace_lock(self.home), self.assertRaises(factory.FactoryError):
            with factory.workspace_lock(self.home):
                pass
        self.assertFalse((self.home / ".session.lock").exists())

    def test_lock_is_released_after_exception(self):
        with self.assertRaises(ValueError):
            with factory.workspace_lock(self.home):
                raise ValueError("test")
        self.assertFalse((self.home / ".session.lock").exists())

    def test_seen_cache_reacts_to_changed_file(self):
        path = self.image()
        seen = {}
        self.assertEqual(len(factory.scan_inbox(self.home, True, seen=seen)["accepted"]), 1)
        self.assertEqual(len(factory.scan_inbox(self.home, True, seen=seen)["accepted"]), 0)
        path.write_bytes(png(alpha=10))
        os.utime(path, (1_700_000_001, 1_700_000_001))
        self.assertEqual(len(factory.scan_inbox(self.home, True, seen=seen)["accepted"]), 1)

    def test_upload_needs_explicit_confirmation(self):
        with self.assertRaises(factory.FactoryError):
            factory.sync_private(self.home, False, FakeRemote())

    def test_public_bucket_is_refused_before_put(self):
        self.enable_mock()
        cfg = factory.config(self.home)
        cfg["bucket"] = "sk7-assets-prod"
        factory.atomic_write(self.home, "config.json", factory.encoded(cfg))
        remote = FakeRemote()
        with self.assertRaises(transport.TransportError):
            factory.sync_private(self.home, True, remote)
        self.assertEqual(remote.puts, [])

    def test_index_uploaded_last(self):
        self.image()
        self.ingest()
        self.enable_mock()
        remote = FakeRemote()
        receipt = factory.sync_private(self.home, True, remote)
        self.assertEqual(receipt["status"], "remote-index-verified")
        self.assertIn("/indexes/", remote.puts[-1][0])
        self.assertTrue(all("/indexes/" not in key for key, _, _ in remote.puts[:-1]))
        self.assertFalse(receipt["runtimeChanged"])
        self.assertFalse(list((self.home / "pending").glob("*.json")))

    def test_archive_index_has_no_local_paths_or_original_names(self):
        self.image("personal-name.png")
        self.ingest()
        self.enable_mock()
        remote = FakeRemote()
        factory.sync_private(self.home, True, remote)
        index = remote.puts[-1][1].decode()
        self.assertNotIn(str(self.tmp.name), index)
        self.assertNotIn("personal-name.png", index)
        self.assertIn('"runtimeApproved": false', index)

    def test_failed_image_upload_never_publishes_index(self):
        self.image()
        self.ingest()
        self.enable_mock()
        remote = FakeRemote(fail_at=1)
        with self.assertRaises(transport.TransportError):
            factory.sync_private(self.home, True, remote)
        self.assertFalse(any("/indexes/" in key for key, _, _ in remote.puts))
        self.assertTrue(list((self.home / "pending").glob("*.json")))
        self.assertFalse(list((self.home / "receipts").glob("*.json")))

    def test_retry_keeps_same_keys_and_bytes(self):
        self.image()
        self.ingest()
        self.enable_mock()
        first = FakeRemote(fail_at=1)
        with self.assertRaises(transport.TransportError):
            factory.sync_private(self.home, True, first)
        second = FakeRemote()
        factory.sync_private(self.home, True, second)
        self.assertEqual(first.puts[0], second.puts[0])

    def test_failed_index_readback_is_not_marked_completed(self):
        self.image()
        self.ingest()
        self.enable_mock()
        remote = FakeRemote(fail_at=3)
        with self.assertRaises(transport.TransportError):
            factory.sync_private(self.home, True, remote)
        self.assertFalse(list((self.home / "receipts").glob("*.json")))
        self.assertTrue(list((self.home / "pending").glob("*.json")))

    def test_second_successful_sync_is_noop_without_network(self):
        self.image()
        self.ingest()
        self.enable_mock()
        factory.sync_private(self.home, True, FakeRemote())
        remote = FakeRemote()
        result = factory.sync_private(self.home, True, remote)
        self.assertEqual(result["r2Writes"], 0)
        self.assertEqual(remote.checks, 0)

    def test_tampered_source_blocks_all_puts(self):
        self.image()
        record = self.ingest()["accepted"][0]
        (self.home / record["original"]).write_bytes(b"corrupt")
        self.enable_mock()
        remote = FakeRemote()
        with self.assertRaises(factory.FactoryError):
            factory.sync_private(self.home, True, remote)
        self.assertEqual(remote.puts, [])

    def test_deadline_preserves_pending_batch(self):
        self.image()
        self.ingest()
        self.enable_mock()
        remote = FakeRemote()
        with self.assertRaisesRegex(factory.FactoryError, "budget"):
            factory.sync_private(self.home, True, remote, deadline=0)
        self.assertEqual(remote.puts, [])
        self.assertTrue(list((self.home / "pending").glob("*.json")))

    def test_unbounded_watch_refused(self):
        with self.assertRaises(factory.FactoryError):
            factory.watch(self.home, 100000, 5, False, False)

    def test_watch_upload_needs_confirmation(self):
        with self.assertRaises(factory.FactoryError):
            factory.watch(self.home, 1, 5, True, False)


class TransportTests(unittest.TestCase):
    def test_recognizes_upstream_private_messages(self):
        transport.require_private_output(
            "Public access via the r2.dev URL is disabled.", "There are no custom domains connected to this bucket."
        )

    def test_unknown_output_fails_closed(self):
        for a, b in [("", ""), ("403", "There are no custom domains connected to this bucket.")]:
            with self.assertRaises(transport.TransportError):
                transport.require_private_output(a, b)

    def test_public_dev_url_blocks(self):
        with self.assertRaises(transport.TransportError):
            transport.require_private_output(
                "Public access is enabled at 'https://example.r2.dev'.",
                "There are no custom domains connected to this bucket.",
            )

    def test_any_custom_domain_blocks(self):
        with self.assertRaises(transport.TransportError):
            transport.require_private_output("Public access via the r2.dev URL is disabled.", "domain: example.com")

    def fake_cli(self, corrupt=False):
        calls = []
        uploaded = {}

        def runner(args, **kwargs):
            calls.append(args)
            action = args[3]
            key = args[4]
            path = Path(args[args.index("--file") + 1])
            if action == "put":
                uploaded[key] = path.read_bytes()
            if action == "get":
                path.write_bytes(b"corrupt" if corrupt else uploaded[key])
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        return runner, calls

    def test_put_and_get_use_remote_and_full_readback(self):
        runner, calls = self.fake_cli()
        cfg = {"bucket": transport.ALLOWED_BUCKET, "privateTargetConfirmed": True, "wranglerBinary": "wrangler"}
        remote = transport.WranglerTransport(cfg, runner=runner)
        data = b"synthetic test"
        key = f"{transport.PREFIX}{'a' * 32}/{'b' * 32}/originals/{factory.digest(data)}.png"
        remote.put_verified(key, data, "image/png")
        self.assertEqual(len(calls), 2)
        self.assertTrue(all("--remote" in row for row in calls))
        self.assertNotIn("delete", repr(calls))
        self.assertIn("private, no-store", calls[0])

    def test_readback_corruption_raises(self):
        runner, _ = self.fake_cli(corrupt=True)
        cfg = {"bucket": transport.ALLOWED_BUCKET, "privateTargetConfirmed": True, "wranglerBinary": "wrangler"}
        remote = transport.WranglerTransport(cfg, runner=runner)
        data = b"valid input"
        key = f"{transport.PREFIX}{'a' * 32}/{'b' * 32}/originals/{factory.digest(data)}.png"
        with self.assertRaises(transport.TransportError):
            remote.put_verified(key, data, "image/png")

    def test_product_key_cannot_be_put(self):
        runner, calls = self.fake_cli()
        cfg = {"bucket": transport.ALLOWED_BUCKET, "privateTargetConfirmed": True, "wranglerBinary": "wrangler"}
        remote = transport.WranglerTransport(cfg, runner=runner)
        for key in ("visual/v1/file.png", "visual/v2/scenes/s12/empty-state.webp", "companion/v1/cat/v002/lite.glb"):
            with self.assertRaises(transport.TransportError):
                remote.put_verified(key, b"test", "image/png")
        self.assertEqual(calls, [])

    def test_key_hash_must_match(self):
        runner, calls = self.fake_cli()
        cfg = {"bucket": transport.ALLOWED_BUCKET, "privateTargetConfirmed": True, "wranglerBinary": "wrangler"}
        remote = transport.WranglerTransport(cfg, runner=runner)
        key = f"{transport.PREFIX}{'a' * 32}/{'b' * 32}/originals/{'c' * 64}.png"
        with self.assertRaises(transport.TransportError):
            remote.put_verified(key, b"other bytes", "image/png")
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
