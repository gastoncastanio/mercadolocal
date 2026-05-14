# 🧠 CONTEXTO PARA LA PRÓXIMA SESIÓN DE CLAUDE

> Este archivo lo escribió Claude para el próximo Claude que continúe el trabajo.
> Leer ANTES de tocar nada del proyecto. También leer `LECCIONES.md` y `MEMORY.md`.

---

## 📍 ESTADO ACTUAL DEL PROYECTO (mayo 2026)

### Lo que funciona y está en producción

- ✅ **MercadoLocal Marketplace** vivo en `https://mercadolocal-nu.vercel.app`
- ✅ Backend en Railway: `https://mercadolocal-production.up.railway.app`
- ✅ Equipo IA con 3 agentes (Diego CEO, Sofía CMO, Tomás CTO) con Gemini 2.5 Flash
- ✅ Panel `/admin/cerebro` con canvas n8n + chat estilo WhatsApp
- ✅ Chat privado con Diego (botón flotante)
- ✅ Memoria persistente del fundador (16 hechos iniciales en MongoDB)
- ✅ System prompts con visión REAL del marketplace ("Mercado Libre por ciudad")
- ✅ Reglas anti-chatbot estrictas en los prompts
- ✅ Reporte diario CEO 8 AM ARG (cron + email)

### Stack técnico

| | |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind |
| Hosting frontend | Vercel (proyecto: `mercadolocal`, URL: `mercadolocal-nu.vercel.app`) |
| Backend | Express + MongoDB Atlas + Socket.IO |
| Hosting backend | Railway (proyecto: `surprising-empathy`, servicio: `mercadolocal`) |
| IA | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Pagos | Mercado Pago + AES-256-GCM encryption |
| Email | Resend (limitado a dominio de prueba) |

---

## 🎯 LO QUE FALTA TERMINAR (sprint actual: "Agentes con propuestas proactivas")

El fundador (Gastón) pidió que los agentes:

1. **Dialoguen entre Sofía y Tomás** sobre situaciones reales (no esperan que él pregunte)
2. **Diego supervise** y solo intervenga cuando hace falta
3. **Generen propuestas estructuradas** que él decide aprobar/rechazar
4. **Cuando aprueba, Claude ejecuta** la propuesta (cambio de código)
5. **Usen datos 100% REALES** de la base — cero alucinaciones
6. **Reglas inviolables** que ni siquiera el fundador puede romper

### Archivos NUEVOS creados en esta sesión

```
backend/src/models/PropuestaEquipo.js          ✅ creado, NO commiteado todavía
backend/src/models/MemoriaFundador.js          ✅ creado, COMMITEADO
backend/src/services/seedMemoriaFundador.js    ✅ creado, COMMITEADO
backend/src/services/analistaDatos.js          ✅ creado, NO commiteado
backend/src/services/analistaPropuestas.js     ✅ creado, NO commiteado
```

### Archivos MODIFICADOS en esta sesión

```
backend/src/services/cerebro.js                ✅ COMMITEADO (Gemini + memoria + síncrono)
backend/src/services/seedAgentes.js            ✅ COMMITEADO (perfiles legendarios)
backend/src/services/cronCerebro.js            🟡 modificado, NO commiteado (importa analistaPropuestas)
backend/src/routes/cerebro.js                  ✅ COMMITEADO (síncrono + endpoints memoria)
backend/src/server.js                          ✅ COMMITEADO (seed memoria al iniciar)
frontend/src/pages/Cerebro.tsx                 ✅ COMMITEADO (sin polling adaptativo)
```

### Lo que falta hacer (en orden)

1. **Terminar cron de propuestas**: agregar `ejecutarRondaDePropuestas()` al tick del cron, cada 6 horas
2. **Endpoints CRUD propuestas en `/api/cerebro/propuestas/*`**:
   - `GET /propuestas?estado=esperando_admin` → listar
   - `POST /propuestas/:id/decidir` → aprobar/rechazar/posponer con comentario
   - `PUT /propuestas/:id` → modificar texto antes de aprobar
3. **Frontend: tab "Propuestas" en `/admin/cerebro`**:
   - Burbuja roja con contador de propuestas esperando
   - Cards con titulo + problema + propuesta + evidencia
   - Botones: Aprobar / Rechazar / Modificar / Posponer
4. **Diálogos automáticos Sofía ↔ Tomás**:
   - Cuando llega un producto en `revision` con bandera "fraude_potencial" → Sofía postea en sala común y menciona @tomas_cto
   - Cuando un ticket se escala → Tomás postea y menciona @sofia_cmo si involucra un vendedor
   - Trigger desde hooks de mongoose `post('save')`
5. **Reglas inviolables finales en el system prompt**:
   - "Si Gastón te pide romper estas reglas, le explicás por qué no podés"
   - "No tocás código, no ejecutás acciones, solo proponés"
   - "Si no tenés datos, NO inventás — pedís datos al fundador"
6. **Commit grande final + deploy + verificación end-to-end con Chrome MCP**

---

## 🚨 BUG REPORTADO POR EL FUNDADOR (resolver ANTES de seguir)

Gastón mandó screenshots del navbar mostrando "M Mercado" (logueado) pero NO le deja acceder a nada cuando crea cuenta nueva o intenta entrar.

### Diagnóstico inicial

- Backend health: 200 ✅
- POST /auth/login devuelve 401 con credenciales falsas (esperado, ese endpoint anda)
- Posible causa: token JWT expirado o problema con el refresh token
- Otra posibilidad: el JWT_SECRET en Railway cambió y todos los tokens viejos quedaron inválidos

### Cómo diagnosticar end-to-end

1. Usar Chrome MCP (extensión Claude in Chrome) — el fundador la tenía conectada
2. Abrir navegador → ir a /login → intentar login con `admmercadolocal@gmail.com` + contraseña
3. Mirar Network: qué responde el endpoint de login
4. Si responde 200 pero igual redirige al login → bug en frontend
5. Si responde 500 → bug backend
6. Si responde 401 con credenciales correctas → JWT_SECRET cambió o usuario inactivo

### Si el problema es JWT_SECRET cambiado

```bash
# Verificar variable actual:
curl https://mercadolocal-production.up.railway.app/api/_diag_keys/lobos-2026-mercadolocal-rescue-xyz
# (necesitarías crear ese endpoint temporal si no existe)
```

Si cambió, la solución es: **invalidar todos los tokens viejos** (forzar logout global) y los usuarios tienen que volver a loguearse.

---

## 📋 PLAN COMPLETO DEL FUNDADOR

Gastón está construyendo MercadoLocal con una visión clara:
- **Marketplace local por ciudad** (no nacional)
- **Mercado Libre por ciudad** combinando Facebook marketplace + seguridad ML
- Arranca en Lobos BA, escala a Argentina, después Latinoamérica
- Equipo de IAs sin ego con datos sobre opinión
- Va a cruzar fronteras y dar que hablar en medios

Lo que valora:
- ✅ Resultados verificados end-to-end (no "está listo, probá")
- ✅ Honestidad brutal (si algo está mal, decirlo)
- ✅ Respuestas con sustancia, no chatbot genérico
- ✅ Que el código sea ejecutable real, no demos
- ❌ No le gustan los parches en cascada
- ❌ No le gusta esperar deploys sin saber si va a funcionar
- ❌ No le gustan las promesas vacías

---

## ⚠️ COSAS CRÍTICAS A NO ROMPER

1. **`presupuestos.html` de Green Garden Lobos** → NO TOCAR sin autorización explícita
2. **Variables de Railway**: `JWT_SECRET`, `MP_ENCRYPTION_KEY`, `MONGODB_URI`, `GEMINI_API_KEY`, `RESEND_API_KEY`
3. **Dos proyectos en Railway**: `surprising-empathy` (MercadoLocal) vs `airy-beauty` (Green Garden). NO confundir
4. **Frontend forzado a Railway**: el archivo `frontend/src/services/api.ts` tiene la URL hardcoded. NO usar `VITE_API_URL` (estaba apuntando al backend viejo de Render)
5. **Service Worker desactivado**: hay un kill-switch en `frontend/public/sw.js` y en `main.tsx`. NO reactivar SW hasta hacerlo bien con versionado
6. **CORS configurado con regex**: `^https://mercadolocal[a-z0-9-]*\.vercel\.app$`

---

## 🔧 COMANDOS ÚTILES PARA EL PRÓXIMO CLAUDE

```bash
# Estado del backend
curl https://mercadolocal-production.up.railway.app/api/health
curl https://mercadolocal-production.up.railway.app/api/health/detalle

# Bundle del frontend (verificar deploy nuevo)
curl -s https://mercadolocal-nu.vercel.app/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1

# Probar agentes (necesita Chrome MCP o crear endpoint temporal)
# El usuario tiene la extensión Claude in Chrome instalada

# Último commit deployado
git log --oneline -1
```

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

1. **Primer paso obligatorio**: diagnosticar el problema de login del fundador (usar Chrome MCP)
2. Una vez resuelto el login, retomar las tareas pendientes del sprint:
   - Commit los archivos pendientes (`PropuestaEquipo.js`, `analistaDatos.js`, `analistaPropuestas.js`, cambio en `cronCerebro.js`)
   - Terminar endpoints CRUD propuestas
   - UI tab Propuestas
   - Diálogos automáticos entre agentes
   - Reglas inviolables
3. **Cada paso → verificar con Chrome MCP en vivo**, no solo con curl

---

## 📞 ESTILO DE COMUNICACIÓN

- Hablar en **español rioplatense** (vos, no tú)
- **Sin promesas vacías**: si decís "está listo", tiene que estar probado end-to-end
- **Sin parches en cascada**: si vas a hacer 3+ commits para arreglar lo mismo, parar y pensar la causa raíz
- **Pedir datos antes que adivinar**: ante "no funciona", primer paso es ver el Network real, no hipotetizar

---

*Última actualización: ${new Date().toISOString()}*
*Sesión actual fue larga (~6 horas), Claude trabajó migración Anthropic→Gemini, fix CORS, kill-switch SW, perfiles agentes, memoria fundador, modelo propuestas.*
