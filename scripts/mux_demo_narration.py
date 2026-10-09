"""Align eight downloaded narration segments with the existing demo scenes."""
import argparse
import re
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg


def assemble(audio_dir, source, output):
    audio = [audio_dir / f"{i:02}.mp3" for i in range(1, 9)]
    if source.resolve() == output.resolve():
        raise ValueError("Keep the original silent demo; choose a separate output")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    for path in [source, *audio]:
        if not path.is_file():
            raise ValueError(f"Missing input: {path}")
    for path in audio:
        decoded = subprocess.run(
            [ffmpeg, "-hide_banner", "-i", str(path), "-f", "null", "-"],
            capture_output=True, text=True, check=True,
        )
        match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", decoded.stderr)
        if not match:
            raise ValueError(f"Could not verify duration: {path}")
        hours, minutes, seconds = map(float, match.groups())
        if not 0 < hours * 3600 + minutes * 60 + seconds <= 9:
            raise ValueError(f"Narration must fit its nine-second scene: {path}")
    command = [ffmpeg, "-y", "-loglevel", "error", "-i", str(source)]
    for path in audio:
        command.extend(["-i", str(path)])
    filters = [
        f"[{i + 1}:a]loudnorm=I=-18:TP=-2:LRA=7,adelay={i * 9000}:all=1[a{i}]"
        for i in range(8)
    ]
    filters.append(
        "".join(f"[a{i}]" for i in range(8))
        + "amix=inputs=8:normalize=0,apad,atrim=duration=72[narration]"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as directory:
        staged = Path(directory) / "narrated.mp4"
        subprocess.run(command + [
            "-filter_complex", ";".join(filters), "-map", "0:v:0",
            "-map", "[narration]", "-c:v", "copy", "-c:a", "aac",
            "-b:a", "160k", "-t", "72", "-movflags", "+faststart", str(staged),
        ], check=True)
        staged.replace(output)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio-dir", type=Path, required=True)
    parser.add_argument("--source", type=Path, default=root / "docs/demo/soundwalk-atlas-demo.mp4")
    parser.add_argument("--output", type=Path, default=root / "docs/demo/soundwalk-atlas-narrated.mp4")
    args = parser.parse_args()
    try:
        assemble(args.audio_dir, args.source, args.output)
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Narration assembly failed: {error}\n")
