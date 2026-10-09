# ElevenLabs demo narration — preparation

Status: scripts prepared; free-tier preview generation attempted October 10. No downloaded ElevenLabs audio or category claimed yet. The text-to-speech editor reported "Failed to connect to the backend" after a reload; generation returned no audio, and the displayed balance remained 10,000 credits. Voice settings stayed loading. The built-in troubleshooting chat also disconnected.

User preference: use free tiers only. Hacktoberfest partner credits may be used if available; the signed-in offers portal checked October 10 showed no ElevenLabs offer. Do not start a paid subscription or enable paid overages. Free output is for a private preview pending compatible publication rights.

Eight segments correspond to the existing eight nine-second demo scenes. Use one stock narration voice consistently. Generate each text as 01.mp3–08.mp3 in a private folder; verify pronunciation and each segment's duration before assembly. No voice cloning or private user audio is needed.

Only these public descriptive scripts are sent to ElevenLabs. CLAP inference and private journal data stay on the laptop. Captions and the silent demo remain available.

Assembly: `python scripts/mux_demo_narration.py --audio-dir artifacts/private/elevenlabs` (requires imageio-ffmpeg). The script rejects segments longer than nine seconds instead of truncating speech, checks all inputs before writing and keeps the silent original. Listen to the final output before publishing. Record actual voice, model, generation date, rights/plan and asset checksums after real generation. Generated speech is separate from the application's MIT source license.

Account checked October 10: Free plan, 10,000 credits. Official ElevenLabs publication guidance restricts free output to non-commercial use and requires title attribution. The contest's promotional reuse grant needs compatible rights. Generate final publication audio under a suitable licensed plan or explicit partner permission; an upgrade after free generation does not retroactively license that output. No purchase is authorized by this document.

Sources: https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform and https://dev.to/page/official-hackathon-rules .
