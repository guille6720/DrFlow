# Deploy DrFlow en Vercel (médico PAMI — producción)

Guía para publicar la app y que el médico entre desde el consultorio.

---

## Requisitos previos

- Cuenta [Vercel](https://vercel.com) (`guille6720`)
- Repo en **GitHub** conectado a **`drflow-app`** (recomendado)
- Proyecto Supabase con migraciones **001–020** aplicadas
- Perfil PAMI activado en Configuración (después del primer deploy)

---

## Producción actual

- **URL (subdominio):** https://drflow.opusorg.com
- **URL Vercel (fallback):** https://drflow-app-rho.vercel.app
- **Proyecto Vercel:** `guillermo-c-bmw/drflow-app`
- **Panel:** https://vercel.com/guillermo-c-bmw/drflow-app

> **`opusorg.com` y `www.opusorg.com` no van a DrFlow** — quedan para otras apps (ej. homeflow). Solo `drflow.opusorg.com`.

---

## Flujo recomendado — GitHub + Vercel (profesional)

Cada `git push` a `main` despliega automáticamente. GitHub Actions corre tests antes del merge.

### 1. Repo en GitHub

```powershell
cd c:\dev\DrFlow
git remote add origin https://github.com/guille6720/DrFlow.git
git push -u origin main
```

*(Si la rama local es `master`, renombrá: `git branch -M main` antes del push.)*

### 2. Conectar Vercel a GitHub

1. [drflow-app → Settings → Git](https://vercel.com/guillermo-c-bmw/drflow-app/settings/git)
2. **Connect Git Repository** → elegí `guillermo-c-bmw/drflow-app`
3. Production Branch: **`main`**
4. **No** crees un proyecto nuevo — usá **`drflow-app`** existente

O por CLI (con el repo ya en GitHub):

```powershell
npx vercel git connect https://github.com/guille6720/DrFlow.git
```

### 3. Variables de entorno (una sola vez)

En [Vercel → Environment Variables](https://vercel.com/guillermo-c-bmw/drflow-app/settings/environment-variables):

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publishable |
| `NEXT_PUBLIC_SITE_URL` | `https://drflow.opusorg.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional |

Plantilla local: copiá `.env.example` → `.env.local`

### 4. Deploy automático

```powershell
git add .
git commit -m "feat: descripción del cambio"
git push origin main
```

Vercel buildea solo. Estado en **Deployments** del proyecto.

### 5. CI en GitHub

Workflow `.github/workflows/ci.yml`: lint + tests + build en cada push/PR.

---

## Opción B — Deploy manual desde CLI (emergencias)

Útil si GitHub no está disponible o necesitás un hotfix inmediato:

```powershell
npx vercel link --yes --project drflow-app
npm run deploy:vercel
```

---

## Dominio Hostinger — subdominio de `opusorg.com`

DrFlow **no es un dominio aparte**. Es un **subdominio** de `opusorg.com`:

```
drflow.opusorg.com  =  registro CNAME "drflow" dentro de opusorg.com
```

**No agregues** `drflow.opusorg.com` como “dominio externo” en Hostinger. Eso produce el error **“Dominio no encontrado”**.

El dominio raíz `opusorg.com` y `www` quedan libres para otras apps (ej. homeflow).

### 1. Vercel — agregar dominio

1. [Vercel → drflow-app → Settings → Domains](https://vercel.com/guillermo-c-bmw/drflow-app/settings/domains)
2. Escribí **`drflow.opusorg.com`** y **Add**
3. Vercel mostrará qué registro DNS crear (CNAME → `cname.vercel-dns.com`)

### 2. Hostinger — DNS del dominio padre (paso a paso)

Entrá por esta ruta exacta:

1. **hPanel → Dominios → Portfolio de dominios**
2. Clic en **`opusorg.com`** (el dominio principal, **no** en drflow.opusorg.com)
3. Menú lateral: **DNS / Nameservers**
4. Pestaña **Registros DNS** (o “Administrar registros DNS”)

Ahí agregás **un solo registro**:

| Tipo | Nombre / Host | Apunta a / Objetivo | TTL |
|------|---------------|---------------------|-----|
| **CNAME** | `drflow` | `cname.vercel-dns.com` | 14400 (default) |

**Importante:**

- En **Nombre** escribí solo `drflow` — **no** `drflow.opusorg.com` ni `@`
- **No** uses “Conectar dominio externo” ni “Agregar dominio” para drflow
- Si ya existe un registro **A** o **CNAME** para `drflow`, editá o borrá el viejo antes de agregar el CNAME
- No modifiques `@` ni `www` si ya los usa otra app

Esperá **5–30 min** (a veces hasta 2 h) y probá:

```powershell
nslookup drflow.opusorg.com
```

Debería responder apuntando a Vercel.

### 3. Ocultar vercel.app

1. `drflow.opusorg.com` → **Set as Primary**
2. `drflow-app-rho.vercel.app` → **Redirect to Primary Domain**
3. Si `opusorg.com` o `www` quedaron en este proyecto → **Remove**

### 4. Supabase redirect URLs

```powershell
node scripts/print-supabase-redirects.mjs https://drflow.opusorg.com
```

Pegá en **Supabase → Authentication → URL Configuration**.

---

## Checklist post-deploy (médico PAMI)

| Paso | Dónde |
|------|--------|
| Login / registro funciona | `/login` |
| Activar perfil PAMI | `/configuracion` |
| Cargar pacientes demo o reales | `/configuracion` |
| Probar WhatsApp recordatorio | `/recordatorios` |
| Guía del médico | `/guia-pami` |
| Privacidad | `/privacidad` |

---

## Región

El proyecto usa **`gru1` (São Paulo)** en `vercel.json` — la más cercana a Argentina.

---

## Comandos útiles

```powershell
npm run preview          # Build local antes de push
npm run check:supabase   # Verificar conexión Supabase
npm test                 # Tests locales
npm run deploy:vercel    # Deploy manual (emergencia)
node scripts/print-supabase-redirects.mjs https://drflow.opusorg.com
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Login redirige mal | Redirect URLs en Supabase + `NEXT_PUBLIC_SITE_URL` correcto |
| "Falta migración" | Ejecutar SQL 008, 020 en Supabase SQL Editor |
| Perfil PAMI no activa | Migración 020 + botón en Configuración |
| Reset password falla | Agregar `/auth/callback` y `/login/restablecer` en Supabase |
| **Build: no `pages`/`app` directory** | Repo Git sin código o proyecto equivocado. Usá **`drflow-app`**, no `dr-flow` |
| Dos proyectos (`dr-flow` y `drflow-app`) | Borrá **`dr-flow`** — duplicado sin código |
| Push no dispara deploy | Verificar Git conectado en Settings → Git, rama `main` |
| **“Dominio no encontrado” en Hostinger** | Estás en el lugar equivocado. Entrá a **opusorg.com → DNS**, no agregues drflow como dominio externo. Nombre del registro: solo `drflow` |
| **drflow.opusorg.com no abre** | Falta CNAME `drflow` → `cname.vercel-dns.com` en DNS de **opusorg.com**. Mientras tanto: https://drflow-app-rho.vercel.app |
| DNS ok pero login falla | Redirect URLs en Supabase para `https://drflow.opusorg.com/**` |
