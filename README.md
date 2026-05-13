<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Remix OS SaaS Setup

## Requisitos

- Node.js
- Proyecto Firebase con Auth, Firestore y Storage activos
- Backend con acceso a Firebase Admin
- `GEMINI_API_KEY` si quieres Copilot e insights IA
- Stripe si quieres billing real

## Desarrollo local

1. Instala dependencias:
   `npm install`
2. Crea `.env.local` a partir de `.env.example`
3. Configura como mínimo:
   - `GEMINI_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT` o acceso equivalente para `backend/createApp.ts`
   - `STRIPE_*` sólo si vas a probar billing real
4. Ejecuta la app:
   `npm run dev`

## Dependencias operativas

- El frontend usa rutas autenticadas `/api/*` para overview de empresa, Copilot, insights y billing.
- Si el backend no está disponible, Copilot entrará en modo degradado.
- Los uploads dependen de `storage.rules`.
- Los permisos de datos dependen de `firestore.rules`.

## Reglas a desplegar

- Firestore: `firestore.rules`
- Storage: `storage.rules`

## Build

- `npm run build`
- `npm run lint`
