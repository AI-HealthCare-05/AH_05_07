"""Decode a local 3D preview and extract review frames using an existing FFmpeg."""

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(video, output, ffmpeg):
    video = video.resolve(strict=True)
    output = output.resolve()
    repository = Path(__file__).resolve().parents[2]
    if output.exists() or output == repository or repository in output.parents or output in video.parents:
        raise ValueError("Choose a new external output that does not contain the input video")
    source_hash = digest(video)
    output.mkdir(parents=True)
    stage = "full_decode_and_black_frame_scan"
    try:
        decoded = subprocess.run(
            [
                str(ffmpeg),
                "-hide_banner",
                "-xerror",
                "-threads",
                "1",
                "-i",
                str(video),
                "-map",
                "0:v:0",
                "-an",
                "-sn",
                "-dn",
                "-vf",
                "blackdetect=d=0.2:pix_th=0.02:pic_th=0.98",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            timeout=120,
        )
        log = decoded.stderr.decode("utf-8", errors="replace")
        (output / "decode-local.log").write_text(log, encoding="utf-8")
        if decoded.returncode:
            raise ValueError("Full video decode failed; inspect the preserved local log")
        match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", log)
        if not match:
            raise ValueError("Video duration is unavailable")
        duration = int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3])
        if duration <= 0:
            raise ValueError("Video duration must be positive")
        black = [
            {"start_seconds": float(start), "end_seconds": float(end), "duration_seconds": float(length)}
            for start, end, length in re.findall(
                r"black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)", log
            )
        ]
        stage = "extract_actual_review_frames"
        frames = []
        for index in range(9):
            seconds = max(0, min(duration - 0.04, duration * index / 8))
            target = output / f"frame-{index:02d}.png"
            capture = subprocess.run(
                [
                    str(ffmpeg),
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-threads",
                    "1",
                    "-ss",
                    str(seconds),
                    "-i",
                    str(video),
                    "-frames:v",
                    "1",
                    "-an",
                    "-threads",
                    "1",
                    str(target),
                ],
                capture_output=True,
                timeout=30,
            )
            if capture.returncode or not target.is_file():
                raise ValueError("Review frame extraction failed")
            frames.append({"time_seconds": seconds, "file": target.name, "sha256": digest(target)})
        if digest(video) != source_hash:
            raise ValueError("Input video changed during verification")
        result = {
            "status": "needs_black_frame_review" if black else "decode_and_black_frame_scan_passed",
            "scope": "Full decode and black-frame scan; sampled actual frames for separate human inspection",
            "whole_browser_run_passed": False,
            "visual_quality_approved": False,
            "video_sha256": source_hash,
            "video_bytes": video.stat().st_size,
            "duration_seconds": duration,
            "decode_exit_code": decoded.returncode,
            "black_frame_rule": {"minimum_seconds": 0.2, "pixel_threshold": 0.02, "picture_ratio_threshold": 0.98},
            "black_segments": black,
            "review_frames": frames,
            "input_unchanged": True,
        }
        (output / "video-qa.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
        print(json.dumps({"status": result["status"], "duration_seconds": duration, "review_frames": len(frames)}))
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        reason = "FFmpeg stage exceeded its bound" if isinstance(error, subprocess.TimeoutExpired) else str(error)
        (output / "failure.json").write_text(json.dumps({"status": "failed", "stage": stage, "reason": reason}))
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--ffmpeg", required=True, type=Path)
    args = parser.parse_args()
    verify(args.video, args.output, args.ffmpeg)
