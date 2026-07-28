"""Assert that an emulator screenshot shows the Daynest watchapp, not a dead screen.

A watchapp that throws during startup does not report an error anywhere the
build or the logs can see it: PebbleOS just tears the app down and leaves a
blank screen, and watch-side console output never reaches `pebble logs` in a
release build. That is how the Piu font defect (#704) shipped. The only
mechanical signal is the screen itself, so CI takes a screenshot and checks it
here.

Two things are asserted:

  * the dominant colour is the app's dark background, so we are looking at the
    Daynest screen rather than the launcher, a watchface or a blank panel; and
  * enough pixels differ from it to be actual text, so a bare background from a
    half-initialised app still fails.

    python3 pebble/scripts/check-screenshot.py shot.png

Only the standard library is used, so CI needs no extra install. The input is
whatever `pebble screenshot` writes: 8-bit RGBA (PNG colour type 6).
"""

import argparse
import struct
import sys
import zlib
from collections import Counter
from pathlib import Path


def read_png_rgba(path):
    """Decode an 8-bit RGBA PNG into a list of (r, g, b) pixels."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")

    width = height = None
    idat = bytearray()
    pos = 8
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        pos += 12 + length  # length + type + payload + crc

        if kind == b"IHDR":
            width, height, depth, colour = struct.unpack(">IIBB", payload[:10])
            if (depth, colour) != (8, 6):
                raise ValueError(f"expected 8-bit RGBA, got depth {depth} colour type {colour}")
        elif kind == b"IDAT":
            idat += payload
        elif kind == b"IEND":
            break

    if width is None:
        raise ValueError(f"{path} has no IHDR")

    raw = zlib.decompress(bytes(idat))
    stride = width * 4
    pixels = []
    previous = bytearray(stride)
    pos = 0
    for _ in range(height):
        filter_type = raw[pos]
        line = bytearray(raw[pos + 1 : pos + 1 + stride])
        pos += 1 + stride
        for i in range(stride):
            left = line[i - 4] if i >= 4 else 0
            up = previous[i]
            up_left = previous[i - 4] if i >= 4 else 0
            if filter_type == 0:
                value = line[i]
            elif filter_type == 1:
                value = line[i] + left
            elif filter_type == 2:
                value = line[i] + up
            elif filter_type == 3:
                value = line[i] + (left + up) // 2
            elif filter_type == 4:
                # Paeth
                estimate = left + up - up_left
                da, db, dc = (
                    abs(estimate - left),
                    abs(estimate - up),
                    abs(estimate - up_left),
                )
                nearest = left if (da <= db and da <= dc) else (up if db <= dc else up_left)
                value = line[i] + nearest
            else:
                raise ValueError(f"unsupported PNG filter {filter_type}")
            line[i] = value & 0xFF
        pixels.extend(
            (line[i], line[i + 1], line[i + 2]) for i in range(0, stride, 4)
        )
        previous = line

    return pixels


def main():
    parser = argparse.ArgumentParser(description="Check an emulator screenshot renders the app.")
    parser.add_argument("screenshot", type=Path)
    parser.add_argument(
        "--min-ink",
        type=float,
        default=0.5,
        help="minimum %% of pixels differing from the background (default: 0.5)",
    )
    parser.add_argument(
        "--max-background-level",
        type=int,
        default=120,
        help="max mean RGB for the dominant colour to count as the dark app background",
    )
    args = parser.parse_args()

    pixels = read_png_rgba(args.screenshot)
    counts = Counter(pixels)
    background, background_count = counts.most_common(1)[0]
    ink = 100.0 * (len(pixels) - background_count) / len(pixels)
    level = sum(background) / 3

    print(
        f"{args.screenshot}: {len(counts)} colours, "
        f"background rgb{background} (level {level:.0f}), ink {ink:.2f}%"
    )

    problems = []
    if level > args.max_background_level:
        problems.append(
            f"dominant colour rgb{background} is too light for the app's dark background — "
            "the watchapp is probably not on screen (crashed at startup, or the launcher is showing)"
        )
    if ink < args.min_ink:
        problems.append(
            f"only {ink:.2f}% of pixels differ from the background "
            f"(need {args.min_ink}%) — the screen looks empty, so nothing was drawn"
        )

    if problems:
        for problem in problems:
            print(f"FAIL: {problem}", file=sys.stderr)
        return 1

    print("OK: the watchapp rendered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
