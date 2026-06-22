# 🧠 CONTEXTO PARA LA PRÓXIMA SESIÓN DE CLAUDE

> Lo escribe Claude para el próximo Claude. Leer ANTES de tocar nada.
> **Última actualización REAL: 2026-06-22.** (La versión anterior era de mayo y
> estaba muy desactualizada: mandaba a re-hacer trabajo ya terminado. Si algo acá
> tampoco coincide con el código, **el código manda** — verificá antes de construir.)

---

## 📍 ESTADO REAL (verificado el 2026-06-22)

### Lo que YA está hecho y mergeado (no rehacer)

- ✅ **Marketplace** vivo: front en Vercel (`mercadolocal-nu.vercel.app`), backend en
  Railway (`mercadolocal-production.up.railway.app`).
- ✅ **Auth sólido**: access token 15min + refresh token 30 días en BD con rotación,
  manejo de 401 con cola, rate-limit por email+IP, anti-enumeración, reset con
  verificación paranoica. **No hay bug de login** (el reporte viejo de mayo fue una
  rotación puntual de `JWT_SECRET` que se auto-resolvió).
- ✅ **Comisionista en vivo (traslado) COMPLETO**: `SolicitudCotizacion` con estados
  `pendiente→cotizada→aceptada→en_transito→entregado` (+rechazada/cancelada),
  código de entrega por hash (un solo uso, vive en el cliente del comprador), MP
  vinculado exigido al ofertar/tomar/cotizar, validación de localidad en backend
  (`backend/src/constants/localidades.js`). Subasta en vivo "agarrar YA" (claim
  atómico) + socket/countdown/sonido.
- ✅ **Envíos entre ciudades** (`EnvioComisionista`): reserva de cupo, código de
  entrega, split MP. Es el patrón de referencia que espeja el traslado en vivo.
- ✅ **Panel del Contador COMPLETO (Fases 0-5)**: libro mayor (partida doble),
  hooks en webhooks, 7 secciones de reportes, panel + export, switch fiscal
  Monotributo/RI con IVA, cash-flow real vs informativo, y **conciliación con el
  saldo real de MP** (`seccionConciliacionMP`: API best-effort + fallback manual).
- ✅ **Cerebro / equipo IA COMPLETO y corriendo**: agentes (Diego/Sofía/Tomás),
  memoria del fundador, propuestas proactivas con evidencia real
  (`analistaPropuestas.ejecutarRondaDePropuestas`, cron cada ~30min), CRUD de
  propuestas (`/api/cerebro/propuestas/*`), panel `/admin/cerebro` + tab
  `/admin/cerebro/propuestas` con badge de pendientes.
- ✅ **Radar del Centro** (`ComercioCentro`/`OfertaFlash`/`CanjeAtribuido`): geo
  client-side, ofertas flash con QR/código, canje atómico.
- ✅ **Remis**, **carritos abandonados + recomendaciones**, **notificaciones**
  (push + centro + tiempo real), **cobertura limitada a 5 localidades**.
- ✅ **Banners del home**: los 3 slides con visual de gancho (badge que pisa la
  esquina). **Coherencia de cuotas**: la operatoria real es CON interés (lo confirma
  `CalculadoraCuotas`); se quitó el "6x sin interés" de la tarjeta de producto.

### Localidades operativas (5)
General Las Heras, Cañuelas, Lobos, Navarro, Roque Pérez. Constante en
`frontend/src/constants/localidades.ts` y `backend/src/constants/localidades.js`.

---

## 🎯 PENDIENTE DE VERDAD (lo nuevo, no construido)

1. **Tienda Oficial / Dealer de marca** (en progreso/próximo): traer marcas de
   primera línea ADENTRO de la app — un comercio/distribuidor local con distintivo
   "Tienda Oficial / Marca verificada", que vende en MercadoLocal y la plataforma
   cobra su split de MP. (Se descartó el modelo de afiliados de ML porque manda al
   usuario AFUERA de la app.)
2. Ideas validadas pero no hechas: **cashback en créditos locales**, programa
   **"Marcas Fundadoras"** (comisión cero + co-marketing pre-launch).

---

## ⚠️ COSAS CRÍTICAS A NO ROMPER

1. **Frontend forzado a Railway**: `frontend/src/services/api.ts` tiene la URL
   hardcodeada. NO usar `VITE_API_URL` (apunta a un backend viejo de Render).
2. **Variables Railway**: `JWT_SECRET`, `MP_ENCRYPTION_KEY` (≠ JWT_SECRET),
   `MONGODB_URI`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `MP_ACCESS_TOKEN`.
3. **Service Worker desactivado** (kill-switch en `sw.js` + `main.tsx`). No reactivar
   sin versionado.
4. **CORS** por regex `^https://mercadolocal[a-z0-9-]*\.vercel\.app$`.
5. **`presupuestos.html` de Green Garden** → NO TOCAR. Dos proyectos Railway:
   `surprising-empathy` (MercadoLocal) vs `airy-beauty` (Green Garden).

---

## 🚀 DEPLOY Y FLUJO DE TRABAJO

- **Auto-deploy desde `main`**: push a `main` → Vercel (front) + Railway (backend).
- Se desarrolla en rama feature y se mergea a `main` con FF (push `HEAD:main`).
  **Pedir OK explícito ("mergea") antes de mandar a `main`.**
- Verificar SIEMPRE antes de mergear: `node --check` (backend), `npx tsc --noEmit`
  + `npm run build` (frontend). Nada de promesas sin probar.
- Desde el entorno remoto la red de egreso está bloqueada hacia el dominio de
  prod/MP/Railway → no se puede curl-verificar prod ni testear en navegador. Se
  verifica build local + estado de deploy vía MCP de Vercel.

---

## 📞 ESTILO

- Español rioplatense (vos). Honestidad brutal: si algo está mal o ya está hecho,
  decirlo. Resultados verificados end-to-end, sin parches en cascada, sin promesas
  vacías. Pedir datos antes que adivinar.

---

*Si vas a "retomar el plan", primero verificá contra el código: gran parte de lo que
parecía pendiente ya está shippeado.*
