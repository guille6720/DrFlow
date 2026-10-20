#!/usr/bin/env python3
"""
Generate offline Kokoro narration for Tutoriales NexClinic.

Voices (softer pace): ef_dora (Dora), em_alex (Alex), em_santa (Santa).
Spanish lang_code='e'. Run outside Vercel. No API keys.

Usage:
  python scripts/tutoriales/generate-kokoro-narration.py --sample
  python scripts/tutoriales/generate-kokoro-narration.py --force
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
CLIPS_JSON = ROOT / "scripts" / "tutoriales" / "generated" / "narration-clips.json"
PUBLIC_DIR = ROOT / "public" / "tutoriales" / "narration" / "v1"
MANIFEST_PATH = PUBLIC_DIR / "manifest.json"
SAMPLE_DIR = ROOT / "scripts" / "tutoriales" / "generated" / "samples"

VOICES = [
    {"id": "dora", "kokoroId": "ef_dora", "label": "Dora", "gender": "female"},
    {"id": "alex", "kokoroId": "em_alex", "label": "Alex", "gender": "male"},
    {"id": "santa", "kokoroId": "em_santa", "label": "Santa", "gender": "male"},
]

# Softer, more cordial delivery (slightly under real-time).
SOFT_SPEED = 0.88

SAMPLE_TEXT = (
    "Hola, qué gusto. Así se escucha la narración de Tutoriales Nex Clinic. "
    "Te acompaño con calma: esta demostración es segura y no modifica ningún dato real."
)

SAMPLE_RATE = 24000
MANIFEST_VERSION = 2


def synthesize(pipeline, text: str, voice_id: str) -> np.ndarray:
    chunks: list[np.ndarray] = []
    for _gs, _ps, audio in pipeline(text, voice=voice_id, speed=SOFT_SPEED):
        if audio is None:
            continue
        arr = np.asarray(audio, dtype=np.float32)
        if arr.ndim > 1:
            arr = arr.reshape(-1)
        chunks.append(arr)
    if not chunks:
        raise RuntimeError(f"Kokoro produced no audio for voice={voice_id}")
    return np.concatenate(chunks)


def write_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, SAMPLE_RATE, subtype="PCM_16")


def public_url(voice: str, text_hash: str) -> str:
    return f"/tutoriales/narration/v1/{voice}/{text_hash}.wav"


def generate_sample(pipeline) -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    for voice in VOICES:
        path = SAMPLE_DIR / f"sample-{voice['id']}.wav"
        print(
            f"[sample] {voice['label']} ({voice['kokoroId']}) "
            f"speed={SOFT_SPEED} -> {path}",
            flush=True,
        )
        audio = synthesize(pipeline, SAMPLE_TEXT, voice["kokoroId"])
        write_wav(path, audio)
        print(
            f"  bytes={path.stat().st_size} duration~{len(audio)/SAMPLE_RATE:.1f}s",
            flush=True,
        )


def generate_all(pipeline, force: bool = False) -> None:
    if not CLIPS_JSON.exists():
        raise SystemExit(
            f"Missing {CLIPS_JSON}. Run: npm run tutoriales:extract-clips"
        )
    payload = json.loads(CLIPS_JSON.read_text(encoding="utf-8"))
    clips = payload["clips"]
    manifest_clips = []

    for index, clip in enumerate(clips, start=1):
        text = clip["text"]
        text_hash = clip["textHash"]
        files: dict[str, str] = {}
        for voice in VOICES:
            out = PUBLIC_DIR / voice["id"] / f"{text_hash}.wav"
            rel = public_url(voice["id"], text_hash)
            if out.exists() and not force:
                print(
                    f"[{index}/{len(clips)}] skip {voice['id']}/{text_hash}",
                    flush=True,
                )
            else:
                print(
                    f"[{index}/{len(clips)}] {voice['label']} "
                    f"{text_hash} ({len(text)} chars)",
                    flush=True,
                )
                audio = synthesize(pipeline, text, voice["kokoroId"])
                write_wav(out, audio)
            files[voice["id"]] = rel
        manifest_clips.append(
            {
                "textHash": text_hash,
                "text": text,
                "refs": clip.get("refs", []),
                "files": files,
            }
        )

    manifest = {
        "version": MANIFEST_VERSION,
        "engine": "kokoro",
        "sampleRate": SAMPLE_RATE,
        "langCode": "e",
        "synthesisSpeed": SOFT_SPEED,
        "tone": "soft-cordial",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "license": {
            "model": "Kokoro-82M (Apache-2.0 weights via hexgrad/kokoro)",
            "package": "https://pypi.org/project/kokoro/",
            "voices": "ef_dora, em_alex, em_santa (Spanish)",
        },
        "voices": VOICES,
        "clips": manifest_clips,
    }
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"Wrote manifest -> {MANIFEST_PATH} "
        f"({len(manifest_clips)} clips x {len(VOICES)} voices)",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    print(
        f"Loading Kokoro KPipeline(lang_code='e') soft_speed={SOFT_SPEED}…",
        flush=True,
    )
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="e")

    if args.sample:
        generate_sample(pipeline)
        return
    generate_all(pipeline, force=args.force)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
