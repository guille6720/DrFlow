#!/usr/bin/env python3
"""
Generate offline Kokoro narration for Tutoriales NexClinic.

Tone target: as human as possible — warm, calm, trustworthy.
Avoids heavy pitch-shifting (metallic artifacts). Light room + EQ only.
Voices: ef_dora (Dora), em_alex (Alex), em_santa (Santa).
Spanish lang_code='e'. Run outside Vercel. No API keys.

Usage:
  python scripts/tutoriales/generate-kokoro-narration.py --sample
  python scripts/tutoriales/generate-kokoro-narration.py --force
"""

from __future__ import annotations

import argparse
import json
import re
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
    },
    {
        "id": "alex",
        "kokoroId": "em_alex",
        "label": "Alex",
        "gender": "male",
    },
    {
        "id": "santa",
        "kokoroId": "em_santa",
        "label": "Santa",
        "gender": "male",
    },
]

# Natural calm Spanish narration (0.8 sounded dragged; 1.0 can feel rushed).
SOFT_SPEED = 0.92
# Conversational loudness without clipping.
PEAK_TARGET = 0.86
# Very light high-end softening (higher = less filtering).
WARMTH_ALPHA = 0.42
# Tiny room so it leaves the "dry TTS booth".
REVERB_WET = 0.1
REVERB_DECAY = 0.28
FADE_MS = 28
SILENCE_TRIM_DB = -42.0

SAMPLE_TEXT = (
    "Hola. Qué bueno tenerte acá. Así se escucha Tutoriales Nex Clinic: "
    "con calma, cercanía y confianza. Esta demostración es segura y no modifica ningún dato real."
)

SAMPLE_RATE = 24000
MANIFEST_VERSION = 4


def humanize_text(text: str) -> str:
    """Light punctuation cleanup so Kokoro breathes more naturally."""
    t = text.strip()
    t = re.sub(r"\s+", " ", t)
    # Prefer a short breath after clause commas that glue long runs.
    t = re.sub(r",\s*", ", ", t)
    t = re.sub(r";\s*", ". ", t)
    t = re.sub(r":\s*", ": ", t)
    # Collapse stacked punctuation.
    t = re.sub(r"([.!?])\1+", r"\1", t)
    t = re.sub(r"\s+([.!?])", r"\1", t)
    return t.strip()


def apply_warmth(audio: np.ndarray, alpha: float = WARMTH_ALPHA) -> np.ndarray:
    """Very light one-pole low-pass — keeps air, reduces harsh sibilance."""
    if audio.size == 0:
        return audio
    out = np.empty_like(audio, dtype=np.float32)
    y = float(audio[0])
    a = float(np.clip(alpha, 0.05, 0.95))
    for i, sample in enumerate(audio):
        y = y + a * (float(sample) - y)
        out[i] = y
    return out


def apply_subtle_room(audio: np.ndarray, wet: float = REVERB_WET) -> np.ndarray:
    """Short early reflections (comb) for a human 'near-mic in a room' feel."""
    if audio.size == 0 or wet <= 0:
        return audio
    delays_ms = (18, 29, 41)
    decays = (REVERB_DECAY, REVERB_DECAY * 0.85, REVERB_DECAY * 0.7)
    wet_buf = np.zeros_like(audio, dtype=np.float32)
    for delay_ms, decay in zip(delays_ms, decays):
        d = int(SAMPLE_RATE * delay_ms / 1000)
        if d <= 0 or d >= audio.size:
            continue
        delayed = np.zeros_like(audio, dtype=np.float32)
        delayed[d:] = audio[:-d] * float(decay)
        wet_buf += delayed
    wet_buf *= 1.0 / max(1, len(delays_ms))
    mix = (1.0 - wet) * audio + wet * wet_buf
    return mix.astype(np.float32)


def soft_normalize(audio: np.ndarray, peak: float = PEAK_TARGET) -> np.ndarray:
    max_abs = float(np.max(np.abs(audio))) if audio.size else 0.0
    if max_abs < 1e-6:
        return audio
    # Mild RMS lift toward conversational level, then peak-cap.
    rms = float(np.sqrt(np.mean(np.square(audio))))
    target_rms = 0.12
    gain = 1.0
    if rms > 1e-6:
        gain = min(peak / max_abs, target_rms / rms)
        gain = float(np.clip(gain, 0.55, 2.2))
    shaped = (audio * gain).astype(np.float32)
    max_abs = float(np.max(np.abs(shaped)))
    if max_abs > peak:
        shaped = (shaped * (peak / max_abs)).astype(np.float32)
    return shaped


def trim_silence(audio: np.ndarray, floor_db: float = SILENCE_TRIM_DB) -> np.ndarray:
    if audio.size < SAMPLE_RATE // 10:
        return audio
    floor = 10 ** (floor_db / 20.0)
    window = max(1, SAMPLE_RATE // 100)  # 10 ms
    energy = np.convolve(np.abs(audio), np.ones(window) / window, mode="same")
    voiced = np.where(energy > floor)[0]
    if voiced.size == 0:
        return audio
    pad = SAMPLE_RATE // 50  # 20 ms pad
    start = max(0, int(voiced[0]) - pad)
    end = min(audio.size, int(voiced[-1]) + pad)
    return audio[start:end]


def apply_fades(audio: np.ndarray, fade_ms: int = FADE_MS) -> np.ndarray:
    n = int(SAMPLE_RATE * fade_ms / 1000)
    if n <= 0 or audio.size < n * 2:
        return audio
    out = audio.copy()
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def make_human(audio: np.ndarray) -> np.ndarray:
    """Keep Kokoro's native timbre; only gentle room/EQ/level polish."""
    shaped = trim_silence(audio)
    shaped = apply_warmth(shaped)
    shaped = apply_subtle_room(shaped)
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
    if len(chunks) == 1:
        return chunks[0]
    # Small breath between Kokoro segments (more spoken, less glued).
    gap = np.zeros(int(SAMPLE_RATE * 0.06), dtype=np.float32)
    merged: list[np.ndarray] = []
    for i, chunk in enumerate(chunks):
        if i:
            merged.append(gap)
        merged.append(chunk)
    return np.concatenate(merged)


def write_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, SAMPLE_RATE, subtype="PCM_16")


def public_url(voice: str, text_hash: str) -> str:
    return f"/tutoriales/narration/v1/{voice}/{text_hash}.wav"


def render_clip(pipeline, text: str, voice: dict) -> np.ndarray:
    spoken = humanize_text(text)
    raw = synthesize(pipeline, spoken, voice["kokoroId"])
    return make_human(raw)


def generate_sample(pipeline) -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    for voice in VOICES:
        path = SAMPLE_DIR / f"sample-{voice['id']}.wav"
        print(
            f"[sample] {voice['label']} ({voice['kokoroId']}) "
            f"speed={SOFT_SPEED} humanize=room+eq -> {path}",
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
        "tone": "human-warm-trust",
        "processing": {
            "pitchSemitones": 0,
            "warmthAlpha": WARMTH_ALPHA,
            "reverbWet": REVERB_WET,
            "peakTarget": PEAK_TARGET,
            "fadeMs": FADE_MS,
            "segmentGapMs": 60,
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
        f"tone=human-warm-trust speed={SOFT_SPEED}…",
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
