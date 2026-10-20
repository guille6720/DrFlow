# Tutoriales NexClinic — narración Kokoro (offline)

## Qué es

Los tutoriales reproducen audios **pregenerados** con [Kokoro-82M](https://github.com/hexgrad/kokoro) (`pip install kokoro`), tono joven/cálido (`speed≈0.80` + ligero pitch y calidez):

| UI     | Kokoro id  | Género   | Archivos                                      |
|--------|------------|----------|-----------------------------------------------|
| Dora   | `ef_dora`  | femenina | `public/tutoriales/narration/v1/dora/<hash>.wav` |
| Alex   | `em_alex`  | masculina | `public/tutoriales/narration/v1/alex/<hash>.wav` |
| Santa  | `em_santa` | masculina | `public/tutoriales/narration/v1/santa/<hash>.wav` |

No hay modelo en el navegador, ni en funciones de Vercel, ni claves de API (ElevenLabs retirado del recorrido activo).

## Licencias

- **Modelo / pesos Kokoro-82M**: Apache-2.0 (hexgrad/Kokoro-82M).
- **Paquete Python `kokoro`**: ver [PyPI kokoro](https://pypi.org/project/kokoro/).
- Los WAV del repo son síntesis de textos estáticos de tutoriales (sin datos clínicos ni de usuarios).

## Flujo reproducible

```bash
# 1) Extraer textos normalizados únicos desde el registry
npm run tutoriales:extract-clips

# 2) Muestra de pronunciación (Alex + Santa)
npm run tutoriales:generate-kokoro:sample
# → scripts/tutoriales/generated/samples/sample-alex.wav
# → scripts/tutoriales/generated/samples/sample-santa.wav

# 3) Generar todos los clips + manifiesto
npm run tutoriales:generate-kokoro
# → public/tutoriales/narration/v1/{alex,santa}/*.wav
# → public/tutoriales/narration/v1/manifest.json
```

Requisitos locales (solo para regenerar, no para deploy):

- Python 3.12+
- `pip install "kokoro>=0.9.4" soundfile numpy`
- Primera corrida descarga pesos desde Hugging Face (`hexgrad/Kokoro-82M`)

## Manifiesto

`manifest.json` relaciona:

- `textHash`: primeros 16 hex de SHA-256 del texto **normalizado** (`normalizeSpokenText`)
- `text`: guion hablado
- `files.alex` / `files.santa`: URL pública versionada (`/tutoriales/narration/v1/...`)

Si cambia un guion, cambia el hash → se regenera un WAV nuevo (los viejos pueden quedar huérfanos hasta limpieza).

## Runtime

1. `ContinuousNarrationSession` intenta Kokoro vía `manifest.json`.
2. Si falta el WAV o falla la carga → Web Speech (voz masculina ES) sin bloquear el tour.
3. Pausa / reanudar / silencio / velocidad / cambio Alex↔Santa detienen el audio anterior (generation token).

## Staging

Publicar solo en `release/0.2.19-staging-promotion` (Preview). No requiere variables de entorno de TTS.
