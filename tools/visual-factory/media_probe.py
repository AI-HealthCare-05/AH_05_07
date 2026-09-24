"""Bounded, dependency-free probes. PNG pixels/alpha; WebP container only.

No OCR, generation, lossy re-encoding, or filename-based approval. Original
bytes (including provenance metadata) are retained by the private archive.
"""

from __future__ import annotations

import binascii
import struct
import zlib

MAX_BYTES = 32 * 1024 * 1024
MAX_PIXELS = 20_000_000
MAX_SIDE = 8192
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


class MediaError(ValueError):
    """Input is unsupported, incomplete or exceeds a limit."""


def dimensions(width: int, height: int) -> None:
    if not (1 <= width <= MAX_SIDE and 1 <= height <= MAX_SIDE):
        raise MediaError("Image dimensions are outside 1..8192 pixels.")
    if width * height > MAX_PIXELS:
        raise MediaError("Image exceeds the 20 megapixel budget.")


def png_chunks(data: bytes) -> list[tuple[bytes, bytes]]:
    chunks = []
    offset = 8
    while offset < len(data):
        if offset + 12 > len(data):
            raise MediaError("Truncated PNG chunk.")
        size = struct.unpack_from(">I", data, offset)[0]
        end = offset + size + 12
        if end > len(data):
            raise MediaError("PNG chunk exceeds file length.")
        kind = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + size]
        crc = struct.unpack_from(">I", data, end - 4)[0]
        if binascii.crc32(kind + payload) & 0xFFFFFFFF != crc:
            raise MediaError("PNG chunk CRC mismatch.")
        chunks.append((kind, payload))
        offset = end
        if kind == b"IEND":
            if size != 0 or offset != len(data):
                raise MediaError("PNG has an invalid end or trailing data.")
            return chunks
    raise MediaError("PNG has no IEND chunk.")


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    distances = (abs(p - a), abs(p - b), abs(p - c))
    return (a, b, c)[distances.index(min(distances))]


def unfilter(row: bytes, previous: bytearray, stride: int, kind: int) -> bytearray:
    if kind == 0:
        return bytearray(row)
    result = bytearray(len(row))
    for i, value in enumerate(row):
        left = result[i - stride] if i >= stride else 0
        up = previous[i]
        corner = previous[i - stride] if i >= stride else 0
        if kind == 1:
            prediction = left
        elif kind == 2:
            prediction = up
        elif kind == 3:
            prediction = (left + up) // 2
        else:
            prediction = paeth(left, up, corner)
        result[i] = (value + prediction) & 255
    return result


def decoded_rows(raw: bytes, width: int, height: int, channels: int):
    size = width * channels
    previous = bytearray(size)
    for y in range(height):
        offset = y * (size + 1)
        kind = raw[offset]
        if kind > 4:
            raise MediaError("Unknown PNG row filter.")
        row = unfilter(raw[offset + 1 : offset + 1 + size], previous, channels, kind)
        yield row
        previous = row


def alpha_info(
    raw: bytes, width: int, height: int, channels: int, color: int, transparency: bytes | None, palette: bytes | None
) -> dict:
    """Unfilter only alpha bytes when alpha is a dedicated channel."""
    size = width * channels
    minimum, maximum = 255, 0
    transparent = 0
    if color in (4, 6):
        previous = bytearray(width)
        for y in range(height):
            offset = y * (size + 1)
            kind = raw[offset]
            if kind > 4:
                raise MediaError("Unknown PNG row filter.")
            samples = raw[offset + channels : offset + 1 + size : channels]
            decoded = unfilter(samples, previous, 1, kind)
            minimum = min(minimum, min(decoded))
            maximum = max(maximum, max(decoded))
            transparent += sum(value < 255 for value in decoded)
            previous = decoded
    else:
        palette_size = len(palette or b"") // 3
        for row in decoded_rows(raw, width, height, channels):
            if color == 3:
                if max(row) >= palette_size:
                    raise MediaError("PNG palette index is out of bounds.")
                samples = [transparency[i] if transparency and i < len(transparency) else 255 for i in row]
            elif transparency:
                transparent_color = struct.unpack(">" + "H" * channels, transparency)
                samples = [
                    0 if tuple(row[i : i + channels]) == transparent_color else 255
                    for i in range(0, len(row), channels)
                ]
            else:
                samples = [255]
            minimum = min(minimum, min(samples))
            maximum = max(maximum, max(samples))
            transparent += sum(value < 255 for value in samples)
    return {
        "hasTransparentPixels": transparent > 0,
        "alphaMin": minimum,
        "alphaMax": maximum,
        "transparentPixelCount": transparent,
    }


def inspect_png(data: bytes) -> dict:  # noqa: C901
    chunks = png_chunks(data)
    if not chunks or chunks[0][0] != b"IHDR" or len(chunks[0][1]) != 13:
        raise MediaError("PNG must begin with a valid IHDR.")
    kinds = [kind for kind, _ in chunks]
    for kind in (b"IHDR", b"PLTE", b"tRNS", b"IEND"):
        if kinds.count(kind) > 1:
            raise MediaError("Duplicate singleton PNG chunk.")
    if any(kind in kinds for kind in (b"acTL", b"fcTL", b"fdAT")):
        raise MediaError("Animated PNG needs a dedicated motion review; not accepted by this static intake.")
    if any(kind[:1].isupper() and kind not in (b"IHDR", b"PLTE", b"IDAT", b"IEND") for kind in kinds):
        raise MediaError("Unknown critical PNG chunk.")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", chunks[0][1])
    dimensions(width, height)
    if depth != 8 or color not in (0, 2, 3, 4, 6) or compression or filtering or interlace:
        raise MediaError("This intake supports non-interlaced, 8-bit PNG only; keep the original for manual review.")
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    palette = next((p for k, p in chunks if k == b"PLTE"), None)
    transparency = next((p for k, p in chunks if k == b"tRNS"), None)
    validate_png_layout(kinds, color, palette, transparency)
    packed = b"".join(p for k, p in chunks if k == b"IDAT")
    expected = height * (width * channels + 1)
    decoder = zlib.decompressobj()
    try:
        raw = decoder.decompress(packed, expected + 1)
    except zlib.error as exc:
        raise MediaError("PNG decompression failed.") from exc
    if len(raw) != expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise MediaError("PNG decompressed size or stream termination is invalid.")
    # Every scanline filter is validated even for opaque color data.
    if any(raw[y * (width * channels + 1)] > 4 for y in range(height)):
        raise MediaError("Unknown PNG row filter.")
    if color in (0, 2) and transparency is None:
        alpha = {"hasTransparentPixels": False, "alphaMin": 255, "alphaMax": 255, "transparentPixelCount": 0}
    else:
        alpha = alpha_info(raw, width, height, channels, color, transparency, palette)
    return {
        "format": "png",
        "contentType": "image/png",
        "width": width,
        "height": height,
        "validation": "png-crc-inflate-scanlines-alpha",
        "animated": False,
        "metadataChunks": sorted(
            {k.decode("ascii", errors="replace") for k in kinds if k in (b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"caBX")}
        ),
        **alpha,
    }


def validate_png_layout(kinds, color, palette, transparency):
    if b"IDAT" not in kinds:
        raise MediaError("PNG has no pixel data.")
    positions = [i for i, kind in enumerate(kinds) if kind == b"IDAT"]
    if positions != list(range(positions[0], positions[-1] + 1)):
        raise MediaError("PNG IDAT chunks must be consecutive.")
    if color == 3 and (not palette or len(palette) % 3 or len(palette) > 768):
        raise MediaError("PNG palette is missing or invalid.")
    for kind in (b"PLTE", b"tRNS"):
        if kind in kinds and kinds.index(kind) > positions[0]:
            raise MediaError("PNG palette/transparency appears after pixels.")
    if transparency is not None:
        valid = (
            (color == 0 and len(transparency) == 2)
            or (color == 2 and len(transparency) == 6)
            or (color == 3 and 0 < len(transparency) <= len(palette or b"") // 3)
        )
        if not valid:
            raise MediaError("PNG transparency chunk is invalid.")


def sanitize_png(data: bytes) -> bytes:
    """Create a separate derivative; never replace or strip the private original."""
    keep = {b"IHDR", b"PLTE", b"tRNS", b"IDAT", b"IEND", b"sRGB", b"gAMA", b"cHRM", b"iCCP"}
    output = bytearray(PNG_MAGIC)
    for kind, payload in png_chunks(data):
        if kind in keep:
            output.extend(struct.pack(">I", len(payload)) + kind + payload)
            output.extend(struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF))
    return bytes(output)


def inspect_webp(data: bytes) -> dict:
    if len(data) < 20 or struct.unpack_from("<I", data, 4)[0] + 8 != len(data):
        raise MediaError("Invalid WebP RIFF length.")
    offset, chunks = 12, []
    while offset < len(data):
        if offset + 8 > len(data):
            raise MediaError("Truncated WebP chunk.")
        size = struct.unpack_from("<I", data, offset + 4)[0]
        end = offset + 8 + size
        if end + (size & 1) > len(data):
            raise MediaError("WebP chunk exceeds file length.")
        chunks.append((data[offset : offset + 4], data[offset + 8 : end]))
        offset = end + (size & 1)
    return webp_metadata(chunks)


def webp_metadata(chunks):  # noqa: C901
    width = height = None
    alpha_channel = False
    animated = any(kind in (b"ANIM", b"ANMF") for kind, _ in chunks)
    pixels = [item for item in chunks if item[0] in (b"VP8 ", b"VP8L")]
    if animated:
        raise MediaError("Animated WebP is not a static image; archive through a separately reviewed motion path.")
    if len(pixels) != 1:
        raise MediaError("WebP must contain exactly one static bitstream.")
    kind, payload = pixels[0]
    if kind == b"VP8L":
        if len(payload) < 5 or payload[0] != 0x2F:
            raise MediaError("Invalid lossless WebP header.")
        bits = int.from_bytes(payload[1:5], "little")
        if bits >> 29:
            raise MediaError("Unknown lossless WebP version.")
        width, height = (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        alpha_channel = bool(bits & (1 << 28))
    else:
        if len(payload) < 10 or payload[3:6] != b"\x9d\x01\x2a" or payload[0] & 1:
            raise MediaError("Invalid lossy WebP keyframe header.")
        width = int.from_bytes(payload[6:8], "little") & 0x3FFF
        height = int.from_bytes(payload[8:10], "little") & 0x3FFF
    for tag, payload in chunks:
        if tag == b"VP8X":
            if len(payload) != 10 or payload[0] & 2:
                raise MediaError("Invalid or animated WebP extended header.")
            canvas = (int.from_bytes(payload[4:7], "little") + 1, int.from_bytes(payload[7:10], "little") + 1)
            if canvas != (width, height):
                raise MediaError("WebP canvas/bitstream dimension mismatch.")
            alpha_channel = alpha_channel or bool(payload[0] & 16)
        if tag == b"ALPH":
            alpha_channel = True
    dimensions(width, height)
    return {
        "format": "webp",
        "contentType": "image/webp",
        "width": width,
        "height": height,
        "validation": "webp-container-only-not-decoded",
        "animated": False,
        "alphaChannelDeclared": alpha_channel,
        "hasTransparentPixels": None,
        "metadataChunks": sorted({k.decode("ascii") for k, _ in chunks if k in (b"EXIF", b"XMP ")}),
    }


def inspect_media(data: bytes, suffix: str) -> dict:
    if not 0 < len(data) <= MAX_BYTES:
        raise MediaError("Input must be nonempty and at most 32 MiB.")
    if data.startswith(PNG_MAGIC):
        metadata = inspect_png(data)
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        metadata = inspect_webp(data)
    else:
        raise MediaError("Only actual PNG and static WebP files are supported, not renamed files.")
    if suffix.lower() != "." + metadata["format"]:
        raise MediaError("File extension does not match the content signature.")
    return metadata
