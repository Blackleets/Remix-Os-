# Remix OS Beta Stability Report

Branch: `manual/saas-readiness`

Scope: stabilize existing web beta flows before Android / Play Store work. No new product features were added.

## 1. Bugs encontrados

- Feedback Beta depended on a fragile beta feedback contract: the old direct Firestore path was blocked by strict `betaUsers/{uid}` rules, and the backend submit path only accepted `pagePath` while the beta contract expects `route`.
- Mobile Feedback Beta button was positioned at `bottom-5` and `z-[45]`, so BottomNav could cover it on mobile.
- Peppy panel opened at `z-[50]`, below BottomNav `z-[58]`, so BottomNav could cover the chat input.
- Sidebar company logo fallback rendered as a single text character, which could look like a broken visual mark when no company logo exists.
- Endpoint stability risk was undocumented: frontend `/api/` calls had no binary matrix against backend routes.

## 2. Bugs corregidos

- Feedback Beta now uses `POST /api/beta-feedback/submit` and sends both `route` and `pagePath` during rollout.
- Backend accepts `route` or `pagePath`, validates the payload server-side, verifies Firebase auth plus company membership, creates `betaFeedback`, and merges `betaUsers/{uid}` using Admin SDK.
- Feedback Beta floating button now sits above BottomNav on mobile using safe-area aware positioning.
- Feedback Beta modal now has a mobile viewport max height and internal scrolling so submit actions are reachable.
- Peppy opened panel/backdrop now sits above BottomNav and uses `100dvh`.
- Sidebar company logo fallback now uses a stable store icon instead of a tiny text mark.

## 3. Endpoints frontend vs backend

| Frontend endpoint | Archivo que lo llama | Existe en backend/createApp.ts | Estado |
|---|---|---:|---|
| POST /api/ai/action | `src/services/agentActions.ts` | Si | OK |
| POST /api/company/usage | `src/lib/plans.ts` | Si | OK |
| POST /api/invoices/issue | `src/services/invoiceService.ts` | Si | OK |
| POST /api/ai/health | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/insights | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/chat | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/chat/stream | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/conversation/load | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/conversation/save | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/proactive-thoughts | `src/services/gemini.ts` | Si | OK |
| POST /api/ai/daily-briefing | `src/services/gemini.ts` | Si | OK |
| POST /api/beta-feedback/submit | `src/services/feedbackService.ts` | Si | OK, corregido |
| POST /api/company/overview | `src/services/companyApi.ts` | Si | OK |
| POST /api/platform/overview | `src/services/companyApi.ts` | Si | OK |
| POST /api/platform/support/view | `src/services/companyApi.ts` | Si | OK |
| POST /api/platform/stats/sync | `src/services/companyApi.ts` | Si | OK |
| POST /api/platform/billing/sync | `src/services/companyApi.ts` | Si | OK |
| GET /api/platform/feedback | `src/services/companyApi.ts` | Si | OK |
| PATCH /api/platform/feedback/:feedbackId | `src/services/companyApi.ts` | Si | OK |
| POST /api/platform/company/override | `src/pages/SuperAdmin.tsx` | Si | OK |
| GET /api/billing/config | `src/pages/Billing.tsx` | Si | OK |
| POST /api/billing/sync | `src/pages/Billing.tsx` | Si | OK |
| POST /api/billing/create-checkout-session | `src/pages/Billing.tsx` | Si | OK |
| POST /api/billing/create-portal-session | `src/pages/Billing.tsx` | Si | OK |

## 4. Estado Feedback Beta

- Estado: corregido por backend endpoint.
- Envio: backend endpoint, no direct Firestore write.
- Seguridad: requiere Firebase ID token y membership en la company activa.
- Escrituras: crea documento en `betaFeedback` y hace merge en `betaUsers/{uid}`.
- Mensaje exito frontend: `Feedback recibido. Gracias por ayudar a mejorar Remix OS.`
- Mensaje fallo frontend: `No pudimos enviar tu feedback. Intentalo de nuevo.`
- Log requerido preservado: `console.error('Failed to submit beta feedback:', error)`.

## 5. Estado Facturas

- `POST /api/invoices/issue` existe.
- Usa `requireCompanyAccess(req, res, ['owner', 'admin', 'staff'])`.
- Valida `invoiceId`.
- Usa Firestore transaction.
- Actualiza `invoiceCounters/{companyId}_{series}`.
- Cambia invoice draft a `issued`.
- Devuelve `invoiceNumber`, `sequentialNumber`, `alreadyIssued`.
- No hay numeracion cliente como fallback.

## 6. Estado Modo interno

- `POST /api/platform/company/override` existe.
- Usa `requirePlatformAdmin`.
- Valida `companyId`.
- Valida `internalTesting` boolean.
- Actualiza `companies/{companyId}.internalTesting`.
- Crea audit log `internal_testing_toggled`.
- Devuelve `{ ok: true, companyId, internalTesting }`.

## 7. Estado Peppy/mobile

- Peppy floating button ya estaba safe-area aware.
- Peppy panel abierto ahora queda por encima del BottomNav.
- Input/chat de Peppy no deberia quedar oculto por BottomNav.
- Feedback Beta floating button ahora queda por encima del BottomNav en mobile.
- Feedback Beta modal tiene scroll interno y altura maxima basada en `100dvh`.
- Fallback visual del logo en sidebar queda como icono estable de tienda.

## 8. Riesgos pendientes

- Falta smoke test real con usuario Firebase autenticado y company Nexus en preview.
- Validacion renderizada local llego hasta `/auth`; `/dashboard`, Feedback Beta, facturas y override requieren sesion real.
- Si `FIREBASE_SERVICE_ACCOUNT` falta en el runtime serverless, endpoints backend devolveran `FIREBASE_ADMIN_NOT_CONFIGURED`.
- Si la membership del usuario no existe como `${uid}_${companyId}` y tampoco aparece por query fallback, Feedback Beta y facturacion devolveran 403.
- El QA visual fue acotado a codigo/layout. Requiere verificacion en dispositivo movil real o viewport movil antes de beta.

## 9. Checklist de smoke test para CEO

1. Entrar a `/dashboard` con company Nexus activa.
2. Abrir Feedback Beta, enviar bug con titulo y mensaje.
3. Confirmar mensaje: `Feedback recibido. Gracias por ayudar a mejorar Remix OS.`
4. En SuperAdmin, confirmar que aparece el feedback en Platform Feedback.
5. Confirmar que `betaUsers/{uid}` incrementa `feedbackCount` y actualiza `lastFeedbackAt`.
6. Crear factura draft y emitirla.
7. Confirmar que se asigna `invoiceNumber` y que una segunda emision no duplica numeracion.
8. Activar/desactivar Modo interno desde SuperAdmin para una company de prueba.
9. En movil, abrir Peppy y confirmar que el input se ve y se puede escribir.
10. En movil, confirmar que Feedback Beta no queda tapado por BottomNav.

## 10. Recomendacion beta cerrada

Recomendacion: si para beta cerrada controlada despues de pasar el smoke test anterior en preview autenticada. No recomiendo Android / Play Store hasta cerrar ese smoke web y dejar evidencia de un submit real de Feedback Beta, emision de factura y override interno.

## 11. Gates

- `npm run lint`: PASS
- `npm run test`: PASS, 31 tests passing
- `npm run build`: PASS
- Render local `/auth` con Playwright MCP: PASS, sin errores de consola ni overlay
