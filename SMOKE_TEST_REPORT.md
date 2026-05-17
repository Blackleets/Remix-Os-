# SMOKE_TEST_REPORT.md

Fecha: 2026-05-17
Tester: Codex / Staff Engineer + Release Manager
Rama: `manual/saas-readiness`
Commit probado: `27e60ca Add smoke test report`

## URL probada

- Preview PR #16: `https://remix-1rjr23qwx-nfyns-projects-b0cc0f41.vercel.app`
- Resultado preview: bloqueado por Vercel Deployment Protection; redirige a login de Vercel.
- Produccion publica: `https://remix-os.vercel.app`
- Resultado produccion publica: landing y auth cargan correctamente en navegador.

## Rama y commit

```text
git status --short
<sin cambios>

git branch --show-current
manual/saas-readiness

git log --oneline -5
27e60ca Add smoke test report
12f4af8 Fix mobile logo layout
986ed66 Refine Remix OS logo mark
ec0232f Add official Remix OS logo
64171e0 Add multi-provider authentication
```

## Endpoints criticos

```text
backend\createApp.ts:2743:  app.post('/api/invoices/issue', async (req, res) => {
backend\createApp.ts:2839:      captureBackendError(error, { route: '/api/invoices/issue' });
backend\createApp.ts:2845:  app.post('/api/platform/company/override', async (req, res) => {
backend\createApp.ts:2880:      console.error('[Override] /api/platform/company/override failed:', err?.message || err);
```

Estado:

- `POST /api/invoices/issue`: existe en backend.
- `POST /api/platform/company/override`: existe en backend.

## Gates

```text
npm run lint
PASS - tsc --noEmit sin errores

npm run test
PASS - 31 tests, 31 pass, 0 fail

npm run build
PASS - vite build, 3880 modules transformed
```

## Resultado facturas

Estado: NO VERIFICADO EN APP REAL.

Motivo: el preview de PR esta protegido por Vercel Deployment Protection y no hay sesion/credenciales disponibles para entrar a una cuenta con empresa activa, crear factura borrador y emitirla.

Pendiente obligatorio para cerrar smoke real:

- Login con usuario beta.
- Crear factura borrador.
- Emitir factura.
- Confirmar `POST /api/invoices/issue -> 200`.
- Confirmar respuesta con `invoiceNumber` y `sequentialNumber`.

## Resultado modo interno

Estado: NO VERIFICADO EN APP REAL.

Motivo: requiere sesion Super Admin autenticada. No hay credenciales/sesion disponibles en este entorno.

Pendiente obligatorio:

- Entrar a Super Admin.
- Activar `internalTesting`.
- Confirmar `POST /api/platform/company/override -> 200`.
- Confirmar que `companies/{companyId}.internalTesting` cambia correctamente.

## Resultado importacion

Estado: NO VERIFICADO EN APP REAL.

Motivo: depende de activar `internalTesting` desde Super Admin y despues importar 50 clientes y 50 productos en una empresa real.

Pendiente obligatorio:

- Activar `internalTesting`.
- Importar 50 clientes.
- Importar 50 productos.
- Confirmar que no aparece `UpgradeModal`.

## Resultado Peppy

Estado: NO VERIFICADO EN APP REAL.

Motivo: requiere dashboard autenticado con empresa activa.

Prompt pendiente:

```text
Analiza mi negocio con datos reales disponibles. No inventes nada.
```

Criterio de aceptacion:

- Responde usando datos reales disponibles, o
- muestra error claro sin inventar datos.

## Resultado mobile

Estado parcial:

- Produccion publica `https://remix-os.vercel.app` carga en viewport 390px.
- Landing/auth renderizan sin bloqueo visible en navegador.
- Captura generada: `.playwright-mcp/smoke-production-landing-390.png`.

No verificado:

- Dashboard autenticado 360px.
- Dashboard autenticado 390px.
- Movil real.
- Bottom nav visible dentro de app autenticada.
- Peppy no tapa navegacion.
- Sin overflow horizontal en dashboard autenticado.

Motivo: requiere login real y empresa activa.

## Bloqueadores

1. Preview PR #16 esta protegido por Vercel Deployment Protection y redirige a login de Vercel.
2. No hay credenciales/sesion beta disponibles para probar dashboard, clientes, productos, facturas, Super Admin, modo interno, importacion y Peppy.
3. No se pudo confirmar `POST /api/invoices/issue -> 200` desde flujo real.
4. No se pudo confirmar `POST /api/platform/company/override -> 200` desde flujo real.
5. No se pudo ejecutar prueba en movil real.

## Veredicto

```text
NOT READY
```

Razon: el codigo pasa lint/test/build y los endpoints existen, pero el smoke test real de beta cerrada sigue pendiente porque los flujos autenticados criticos no fueron verificables desde este entorno.

## Siguiente paso para CEO

1. Dar acceso temporal al preview protegido o desactivar Deployment Protection solo para testers autorizados.
2. Compartir credenciales de usuario beta con empresa activa.
3. Compartir credenciales o rol Super Admin para validar `internalTesting`.
4. Repetir smoke real completo antes de marcar `READY FOR CLOSED BETA`.
