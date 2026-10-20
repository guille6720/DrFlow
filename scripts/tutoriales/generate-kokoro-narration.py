#!/usr/bin/env python3
"""
Generate offline Kokoro narration for Tutoriales NexClinic.

Tone target: younger, warm, peaceful, trustworthy.
Voices: ef_dora (Dora), em_alex (Alex), em_santa (Santa).
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
    {
        "id": "dora",
        "kokoroId": "ef_dora",
        "label": "Dora",
        "gender": "female",
        # Slight lift keeps Dora bright/young without sounding thin.
        "pitchSemitones": 0.7,
    },
    {
        "id": "alex",
        "kokoroId": "em_alex",
        "label": "Alex",
        "gender": "male",
        "pitchSemitones": 1.15,
    },
    {
        "id": "santa",
        "kokoroId": "em_santa",
        "label": "Santa",
        "gender": "male",
        "pitchSemitones": 1.05,
    },
]

# Calm pace: peace + trust (under real-time).
SOFT_SPEED = 0.8
# Soft peak so delivery feels closer, not shouty.
PEAK_TARGET = 0.78
# Gentle warmth (one-pole low-pass, higher = brighter; ~0.12 keeps air soft).
WARMTH_ALPHA = 0.14
FADE_MS = 40

SAMPLE_TEXT = (
    "Hola. Qué bueno tenerte acá. Así se escucha Tutoriales Nex Clinic: "
    "con calma, cercanía y confianza. Esta demostración es segura y no modifica ningún dato real."
)

SAMPLE_RATE = 24000
MANIFEST_VERSION = 3


def pitch_shift_preserve_length(audio: np.ndarray, semitones: float) -> np.ndarray:
    """Naive pitch shift (resample + stretch). Enough for mild youthful lift."""
    if abs(semitones) < 0.01 or audio.size < 16:
        return audio
    factor = float(2 ** (semitones / 12.0))
    # Higher pitch → shorter buffer
    pitched_len = max(8, int(round(audio.size / factor)))
    x = np.arange(audio.size, dtype=np.float64)
    xp = np.linspace(0, audio.size - 1, pitched_len)
    pitched = np.interp(xp, x, audio.astype(np.float64))
    # Stretch back to original duration
    x2 = np.arange(pitched.size, dtype=np.float64)
    xp2 = np.linspace(0, pitched.size - 1, audio.size)
    return np.interp(xp2, x2, pitched).astype(np.float32)


def apply_warmth(audio: np.ndarray, alpha: float = WARMTH_ALPHA) -> np.ndarray:
    """One-pole low-pass for a warmer, less harsh spectrum."""
    if audio.size == 0:
        return audio
    out = np.empty_like(audio, dtype=np.float32)
    y = float(audio[0])
    a = float(np.clip(alpha, 0.01, 0.95))
    for i, sample in enumerate(audio):
        y = y + a * (float(sample) - y)
        out[i] = y
    return out


def soft_normalize(audio: np.ndarray, peak: float = PEAK_TARGET) -> np.ndarray:
    max_abs = float(np.max(np.abs(audio))) if audio.size else 0.0
    if max_abs < 1e-6:
        return audio
    return (audio * (peak / max_abs)).astype(np.float32)


def apply_fades(audio: np.ndarray, fade_ms: int = FADE_MS) -> np.ndarray:
    n = int(SAMPLE_RATE * fade_ms / 1000)
    if n <= 0 or audio.size < n * 2:
        return audio
    out = audio.copy()
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def make_warm_young(audio: np.ndarray, pitch_semitones: float) -> np.ndarray:
    shaped = pitch_shift_preserve_length(audio, pitch_semitones)
    shaped = apply_warmth(shaped)
    shaped = soft_normalize(shaped)
    shaped = apply_fades(shaped)
    return np.clip(shaped, -1.0, 1.0).astype(np.float32)


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


def render_clip(pipeline, text: str, voice: dict) -> np.ndarray:
    raw = synthesize(pipeline, text, voice["kokoroId"])
    return make_warm_young(raw, float(voice["pitchSemitones"]))


def generate_sample(pipeline) -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    for voice in VOICES:
        path = SAMPLE_DIR / f"sample-{voice['id']}.wav"
        print(
            f"[sample] {voice['label']} ({voice['kokoroId']}) "
            f"speed={SOFT_SPEED} pitch=+{voice['pitchSemitones']}st -> {path}",
            flush=True,
        )
        audio = render_clip(pipeline, SAMPLE_TEXT, voice)
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
                audio = render_clip(pipeline, text, voice)
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
        "tone": "young-warm-trust",
        "processing": {
            "pitchSemitones": {
                voice["id"]: voice["pitchSemitones"] for voice in VOICES
            },
            "warmthAlpha": WARMTH_ALPHA,
            "peakTarget": PEAK_TARGET,
            "fadeMs": FADE_MS,
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "license": {
            "model": "Kokoro-82M (Apache-2.0 weights via hexgrad/kokoro)",
            "package": "https://pypi.org/project/kokoro/",
            "voices": "ef_dora, em_alex, em_santa (Spanish)",
        },
        "voices": [
            {
                "id": v["id"],
                "kokoroId": v["kokoroId"],
                "label": v["label"],
                "gender": v["gender"],
            }
            for v in VOICES
        ],
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
        f"Loading Kokoro KPipeline(lang_code='e') "
        f"tone=young-warm-trust speed={SOFT_SPEED}…",
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
