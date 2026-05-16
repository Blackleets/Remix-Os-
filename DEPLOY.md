# Remix OS — Runbook de despliegue (beta)

Guía operativa para desplegar `manual/saas-readiness` sin sorpresas. Consolidado de decisiones que antes estaban dispersas en mensajes de commit.

## 1. Gates antes de desplegar (obligatorio)

```bash
npm ci
npm run lint     # = tsc --noEmit (typecheck; debe salir limpio)
npm run test     # node:test vía tsx (debe salir 23/23 verdes)
npm run build    # vite build (debe completar sin error)
```

CI (`.github/workflows/ci.yml`) ya ejecuta estos gates en `push`/`pull_request` sobre `main`, `manual/**`, `feature/**`, `claude/**`.

## 2. Índices Firestore — PASO OBLIGATORIO antes del primer release con este código

El commit `febe2b4` introdujo queries en **Clientes → pestañas Recordatorios/Mensajes** que requieren índices compuestos declarados en `firestore.indexes.json`:

- `reminders`: `companyId ASC, customerId ASC, dueDate ASC`
- `customerMessages`: `companyId ASC, customerId ASC, createdAt DESC`

> **IMPORTANTE — base Firestore con nombre.** Este proyecto NO usa la base
> `(default)`. La app opera contra la base **`ai-studio-5da6adea-9b27-408f-afc6-40bb653047c8`**
> (ver `firestoreDatabaseId` en `firebase-applet-config.json`). Por eso
> `firebase.json` declara `"firestore": { "database": "ai-studio-...", ... }`.
> Sin ese campo, `firebase deploy --only firestore:indexes` falla con
> `HTTP 404 ... database '(default)' does not exist`.

**Desplegar los índices:**

```bash
firebase use default                         # gen-lang-client-0995266506
firebase deploy --only firestore:indexes --non-interactive
```

Estado actual: **desplegado** el 2026-05-16 — los 2 índices
(`reminders`, `customerMessages`) están registrados y construidos en la base
con nombre. Para re-verificar:

```bash
firebase firestore:indexes --database ai-studio-5da6adea-9b27-408f-afc6-40bb653047c8
```

- Los índices tardan minutos en construirse en colecciones grandes; en colecciones pequeñas es casi inmediato. Mientras construyen, las pestañas Recordatorios/Mensajes muestran el **banner "No se pudieron cargar… Reintentar"** (resiliencia añadida) en vez de romperse — el resto de la app funciona normal.
- ⚠️ Si el CLI detecta índices creados a mano en consola que no están en `firestore.indexes.json`, **preguntará antes de borrarlos**. NO confirmes el borrado salvo que estés seguro; añádelos primero al archivo. (En el deploy de 2026-05-16 la base tenía 0 índices: sin riesgo.)
- Reglas: `firebase deploy --only firestore:rules` solo si cambió `firestore.rules` (no es el caso). Al añadir `database` a `firebase.json`, un futuro deploy de reglas también iría a la base con nombre — correcto.

## 3. Variables de entorno (ver `.env.example`)

**Obligatorias en serverless (Vercel/Lambda):**

- `FIREBASE_SERVICE_ACCOUNT` — JSON.stringify de la service account. Sin esto, `/api/health` devuelve 503 y todas las rutas autenticadas fallan con `FIREBASE_ADMIN_NOT_CONFIGURED`.
- `GEMINI_API_KEY` — backend-only (NO prefijar con `VITE_`). Necesaria para Copilot/IA.
- `APP_URL` — URL pública del despliegue.

**Para cobros (Stripe):** `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_STARTER|PRO|BUSINESS`.

**Opcionales — no-op hasta configurarlas (la app funciona sin ellas):**

- `VITE_SENTRY_DSN` / `SENTRY_DSN` — observabilidad de errores (frontend / backend).
- `VITE_RECAPTCHA_SITE_KEY` — Firebase App Check (anti-abuso). `VITE_APPCHECK_DEBUG` solo para depurar en local.

## 4. Facturación — smoke test manual (deploy real)

1. Crear factura borrador (cliente + concepto manual + producto) → Guardar borrador.
2. Emitir → DevTools Network: `POST /api/invoices/issue` **200**, body con `invoiceNumber` (p.ej. `A-0001`) y `sequentialNumber`.
3. Reabrir la emitida → formulario en solo-lectura (sin botones Guardar/Emitir).
4. Descargar PDF → número correcto, aviso comercial al pie, perfil de país correcto.
5. Marcar enviada → pagada; no aparece opción de borrar en emitida/pagada.
6. Forzar fallo (sin red) al emitir → mensaje de error claro **dentro del modal**.
7. Multi-tenant: usuario de otra empresa no ve ni emite/duplica/paga facturas ajenas; Recordatorios/Mensajes solo muestran datos de la empresa activa.

## 5. Notas / riesgos conocidos

- **Facturación = documento comercial**, NO certificación fiscal. Los avisos por país lo indican; un test (`shared/invoiceProfiles.test.ts`) bloquea en CI cualquier afirmación de cumplimiento fiscal. No prometer Verifactu/CFDI/SAT certificado.
- **8 vulnerabilidades npm low-severity** (transitivas). **NO** ejecutar `npm audit fix --force`: el propio aviso indica "including breaking changes". Revisar manualmente si se quiere subir versiones.
- Sentry/App Check quedan inactivos hasta poner sus claves (punto 3) — es intencional y seguro.
- El `firebase deploy` lo ejecuta un operador con credenciales (no forma parte de CI).
