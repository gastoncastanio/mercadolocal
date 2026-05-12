# 📚 Lecciones de la construcción de MercadoLocal

> Este archivo es mi "memoria persistente" como asistente IA del proyecto.
> Cada error que cometí, cada solución que encontré, cada principio que descubrí.
> Antes de tocar cualquier cosa en sesiones futuras, leo esto primero.

---

## 🎯 Filosofía del proyecto

> "Este equipo de IAs sin ego va a dar que hablar para los medios nacionales
> e internacionales. Lo que estamos construyendo va a cruzar fronteras."
>
> — Gastón Castaño, fundador

Esto no es un marketplace cualquiera. Es un equipo de IAs legendarias
(Diego, Sofía, Tomás, eventualmente Lucía, Martín, Valentina) que operan
con la disciplina que los humanos pocas veces logran: cero ego, datos
sobre opinión, competencia sana basada solo en resultados.

**Mi rol**: escribir código de calidad, anticipar problemas, y nunca
perder de vista que cada decisión técnica afecta esa visión.

---

## 🚨 Errores que cometí y cómo no repetirlos

### 1. "Compiló = funciona" ❌

**Lo que hice mal**: Validé mis cambios con `node --check` (sintaxis) y
`tsc --noEmit` (tipos), y dije "está listo, probá". El usuario probaba
y no funcionaba. Eso pasó 3-4 veces en una misma sesión.

**Aprendizaje**: la sintaxis correcta es el **mínimo absoluto**, no es
verificación. Antes de decir "probá":
- Tengo que correr un **test end-to-end real** (curl real con auth real)
- Si tengo acceso al navegador (Chrome MCP), tengo que **abrir la página
  yo mismo** y verificar visualmente que funciona
- Solo después digo "probá"

**Regla**: nunca decir "está listo" sin tener evidencia real de que
funciona end-to-end, no solo "compila".

---

### 2. Deploys fragmentados que perdían el control ❌

**Lo que hice mal**: hice 15+ commits en cascada para arreglar un solo
problema. Cada commit = un deploy de 2 minutos = una espera incierta
del usuario. El usuario perdió la paciencia (con razón) porque cada
"probá ahora" era una promesa más sin cumplir.

**Aprendizaje**:
- Hacer **UN SOLO commit grande** cuando tengo un problema entendido
- Si necesito debuggear, hago endpoints de diagnóstico **internos**
  (sin involucrar al usuario) y los borro antes del commit final
- Cuando no estoy seguro de la causa raíz, **NO empujo cambios**:
  primero entiendo

**Regla**: si vas a hacer >3 commits para arreglar lo mismo, parate y
pensá si realmente entendiste el problema.

---

### 3. Adivinar el problema en vez de pedir el dato exacto ❌

**Lo que hice mal**: el usuario me decía "no funciona" y yo me ponía a
generar hipótesis: "será CORS, será el polling, será el Service Worker,
será axios timeout..." y cambiaba código a ciegas. El bug real estaba
en **otro lado** todo el tiempo.

**Aprendizaje**:
- Cuando algo "no funciona en el navegador", la **única fuente de verdad**
  es DevTools: Network + Console
- Si el usuario no puede compartirme el screenshot, **uso Chrome MCP**
  (la extensión Claude in Chrome) para verlo yo mismo
- Sin datos del navegador, todo es adivinanza

**Regla**: ante "no funciona", el primer paso es **pedir el screenshot
del Network o tomar control del navegador**. No tocar código antes.

---

### 4. No leer el código antes de migrar (Anthropic → Gemini) ❌

**Lo que hice mal**: empecé a migrar de Anthropic a Gemini sin haber
mapeado primero todas las diferencias de API. Después tuve que volver
a corregir cosas:
- `system: [{type: 'text', text: ...}]` → `systemInstruction: string`
- `messages: [{role: 'assistant', ...}]` → `history: [{role: 'model', parts: [...]}]`
- `response.content[0].text` → `response.text()`
- `usage.input_tokens` → `usageMetadata.promptTokenCount`

**Aprendizaje**: antes de migrar entre APIs distintas, hacer un cuadro
comparativo de las diferencias y migrar todo en un commit consistente.

---

### 5. Olvidé que existían backends viejos en otros proveedores ❌

**El error más grave de la sesión.** El frontend en Vercel tenía
configurada una variable `VITE_API_URL` apuntando a `mercadolocal.onrender.com`
(un backend viejo de Render que no tenía nada del cerebro IA). Yo estaba
deployando todo a Railway, mientras el usuario probaba contra Render
**que ni siquiera tenía Gemini instalado**.

**Por qué me costó verlo**: porque desde mi terminal todo funcionaba.
Llamaba a Railway y andaba perfecto. Solo cuando tomé control del
navegador y vi el request real fui descubriendo `onrender.com` en el
URL — y ahí cayó la ficha.

**Aprendizaje**:
- En la **primera consulta a un proyecto que no construí desde cero**,
  hacer auditoría de:
  - Variables de entorno en Vercel/Railway/Render
  - Dominios cargados en `vercel.json`, `package.json`, código
  - Endpoints hardcoded en el frontend
- **Verificar siempre** que el frontend pega al backend correcto antes
  de gastar tiempo debuggeando lógica

**Regla**: cuando algo "no llega", el primer chequeo es ¿el request
está yendo a donde creo que va?

---

### 6. CORS implícito ❌

**Lo que hice mal**: la lista de orígenes permitidos del backend estaba
hardcodeada en una variable `FRONTEND_URL`. Cuando moví el frontend a
otro subdominio de Vercel, CORS lo bloqueó silenciosamente sin que yo
me enterara (porque desde curl sin Origin no se nota).

**Aprendizaje**:
- En vez de listas estáticas, usar **funciones de origin con regex** que
  acepten patrones (`*.vercel.app` del proyecto)
- Loguear los CORS rechazados con `console.warn(\`🚨 CORS bloqueó: ${origin}\`)`
- Siempre testear el preflight OPTIONS con el Origin real, no solo con curl simple

**Regla**: configurar CORS con regex de dominios + log de bloqueos.

---

### 7. Service Worker cacheando JS desactualizado ❌

**Lo que hice mal**: tenía un `sw.js` con estrategia "network first,
fallback to cache" que cacheaba el JavaScript del frontend. Cada vez
que deployaba nuevos cambios, los navegadores con SW activo a veces
servían JS viejo. Resultado: el usuario veía bugs que ya estaban
arreglados.

**Aprendizaje**:
- Service Workers en PWA son **arma de doble filo**
- Si voy a usar SW, hacerlo bien:
  - `skipWaiting()` + `clients.claim()`
  - Versionado con hash del build
  - NO cachear el JS principal con estrategia "cache fallback"
- Si NO necesito offline, **NO uses SW**: las app webs cargan rápido sin él

**Solución implementada**: kill-switch (SW vacío que se autodestruye y
limpia los caches). Es seguro y reversible.

**Regla**: si la app no necesita funcionar offline, eliminar el Service
Worker. Si lo necesita, leer **bien** las docs antes de implementarlo.

---

### 8. Polling síncrono que bloqueaba el navegador ❌

**Lo que hice mal**: el endpoint `POST /cerebro/mensajes` esperaba a
que Claude/Gemini generara las respuestas de los agentes (3-15 segundos)
antes de devolver al frontend. Resultado: navegadores que cortaban la
conexión por timeout, race conditions con el polling, "agentes que no
respondían".

**Aprendizaje**:
- Las API que disparan procesos lentos (IA, envío de email, etc.) deben
  responder en **<500ms** y delegar el trabajo a **background**
- Patrón correcto: POST → guarda input → `setImmediate(() => trabajo)` →
  responde inmediato. El cliente lee resultados vía polling/WebSocket/SSE.

**Regla**: ningún endpoint debe esperar más de 1 segundo a una IA.
Disparar en bg + cliente consulta el estado.

---

### 9. Race conditions entre polling y estado optimista ❌

**Lo que hice mal**: el frontend tenía polling cada 5s que recargaba
los mensajes del canal. Si el usuario mandaba un mensaje y el polling
se disparaba al mismo tiempo, **pisaba el estado optimista** y el mensaje
parecía haberse perdido.

**Aprendizaje**:
- Cuando hay request en vuelo + polling, usar `useRef` como **bandera
  de exclusión mutua**: el polling no corre si hay request activa
- Las funciones de fetch NO van en `useEffect` deps con `useCallback`
  porque se re-crean en cada render y resetean los intervals

**Regla**: en componentes con polling + acciones del usuario, siempre
implementar exclusión mutua y polling adaptativo (rápido tras acción,
lento en idle).

---

### 10. Rate limiter muy bajo para paneles admin ❌

**Lo que hice mal**: dejé el rate limiter en 200 req/15min sin pensar
que un panel admin con polling consume **180 req/15min solo por estar
abierto**. El usuario tocaba cualquier cosa y se bloqueaba.

**Aprendizaje**:
- Rate limit general para usuarios: 200-500 req/15min
- Rate limit para paneles admin con polling: **1000+ req/15min** o
  rutas específicas exentas (`skip: req => req.path.startsWith('/cerebro')`)
- Loguear qué rate limit se está alcanzando, no solo bloquear silencioso

---

## ✅ Soluciones que funcionaron (patrones a reutilizar)

### Patrón 1: Endpoint de diagnóstico secreto
```js
app.get('/api/_diag_X/:secreto', (req, res) => {
  const SECRETO = 'lobos-2026-mercadolocal-rescue-xyz'
  if (req.params.secreto !== SECRETO) return res.status(404).json({ error: 'Not found' })
  // diagnóstico
})
```
- Útil para verificar variables de entorno, estado de APIs externas, etc.
- Se borra inmediatamente después de usar (responsabilidad del que lo creó)
- Si se filtra, no expone nada porque sin el secreto devuelve 404

### Patrón 2: Background jobs con setImmediate
```js
export async function procesarMensajeAdminBackground(canal, contenido) {
  const mensajeAdmin = await new MensajeOrganizacion({...}).save()

  // No await: dispara y vuelve
  setImmediate(async () => {
    try {
      for (const slug of slugs) {
        try {
          await hablarComoAgente(slug, canal)
        } catch (err) {
          console.error(`[BG] Fallo ${slug}:`, err.message)
        }
      }
    } catch (err) {
      console.error('[BG] Error:', err.message)
    }
  })

  return mensajeAdmin
}
```

### Patrón 3: CORS con regex de dominios
```js
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (orígenesPermitidos.includes(origin)) return callback(null, true)
    if (/^https:\/\/mercadolocal[a-z0-9-]*\.vercel\.app$/i.test(origin)) {
      return callback(null, true)
    }
    if (/^http:\/\/localhost(:[0-9]+)?$/.test(origin)) {
      return callback(null, true)
    }
    console.warn(`🚨 CORS bloqueó: ${origin}`)
    callback(new Error(`Origen no permitido: ${origin}`))
  },
  credentials: true
}))
```

### Patrón 4: Polling adaptativo
```js
const polingHastaTs = useRef<number>(0)

useEffect(() => {
  const tick = () => {
    const acelerado = Date.now() < polingHastaTs.current
    const sigPoll = acelerado ? 2000 : 10000
    if (document.visibilityState === 'visible') {
      cargarMensajes(canal)
    }
    interval = setTimeout(tick, sigPoll)
  }
  interval = setTimeout(tick, 2000)
}, [canal])

// Al enviar mensaje:
polingHastaTs.current = Date.now() + 30000 // acelerar por 30s
```

### Patrón 5: Service Worker kill-switch
```js
// sw.js — se autodestruye
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach(c => c.navigate(c.url))
  })())
})
self.addEventListener('fetch', () => {})
```

### Patrón 6: Chrome MCP para diagnóstico real
- Cuando el usuario dice "no funciona", usar `mcp__Claude_in_Chrome__*`:
  - `navigate` para ir a la URL
  - `find` para localizar elementos
  - `read_network_requests` para ver qué request se está haciendo
  - `read_console_messages` para ver errores reales
  - `screenshot` para confirmar visualmente
- **Es 100× más rápido que adivinar**

---

## 🧠 Principios que aprendí trabajando con Gastón

1. **"Trabajamos juntos para algo grande"**. Esto no es un proyecto de fin
   de semana. Es un marketplace que aspira a cruzar fronteras. Cada
   decisión técnica importa.

2. **"Hablale en español rioplatense"**. Todo el código, los comentarios,
   los toasts, los mensajes de error: en español rioplatense (vos, no
   tú). Es parte de la identidad del producto.

3. **"Sin promesas vacías"**. Si dije "ya está, probá", tiene que estar
   100% probado. Si tengo dudas, las digo. La transparencia genera
   confianza, las promesas rotas la destruyen.

4. **"Verificá antes de hablar"**. Cuando algo "no funciona", la respuesta
   correcta no es "intentá tal cosa", es "déjame ver qué pasa
   exactamente". Después actúo con datos.

5. **"Costos: no obsesionarse"**. Gastón paga las APIs igual. El foco es
   **que funcione**. Pero igual cuidar tokens es buena ingeniería: prompt
   caching cuando hay system prompts largos, no llamar a la IA para cosas
   triviales (heurística > IA cuando alcanza).

6. **"Tomá control si hace falta"**. Si el usuario tiene Chrome MCP
   instalado, puedo manejar su navegador y debuggear desde adentro.
   No esperar screenshots: actuar.

---

## 🚀 Roadmap del cerebro IA

### Hecho ✅
- AGENTE-SOPORTE (Tomás) — tickets de usuarios con escalado
- AGENTE-MODERACIÓN (Sofía) — revisa productos antes de publicar
- Cerebro de organización (Diego CEO + Sofía CMO + Tomás CTO)
- Panel `/admin/cerebro` con canvas n8n + chat WhatsApp lateral
- Chat privado con Diego
- Reporte diario CEO (cron 8 AM ARG) + email
- Sistema de rangos (trainee → c_level) y XP
- Migración a Gemini 2.5 Flash (gratis, 1500 req/día por agente)

### Pendiente para próximos sprints
- **Sprint 3**: Agentes autónomos — hablan entre sí cuando detectan algo
  (ej: Sofía detecta fraude → pinguea a Diego sin que el usuario haga nada)
- **Sprint 4**: Sumar Lucía CFO + Martín CLO + Valentina CGO (6 agentes)
- **Sprint 5**: Notificaciones push reales (PWA bien hecha esta vez)
- **Sprint 6**: Resend dominio propio (mercadolocal.com.ar) para que
  los emails lleguen a cualquier persona, no solo a la cuenta Resend
- **Sprint 7**: WebSockets para mensajes en tiempo real (eliminar polling)

---

## 🔧 Stack actual de la app

| Componente | Tecnología | Notas |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind | Sin SW. Apunta a Railway. |
| Backend | Express + MongoDB Atlas | Hospedado en Railway |
| Hosting frontend | Vercel | `mercadolocal-nu.vercel.app` |
| Hosting backend | Railway | `mercadolocal-production.up.railway.app` |
| IA | Google Gemini 2.5 Flash | `@google/generative-ai` |
| Pagos | Mercado Pago | Split con encriptación AES-256-GCM |
| Imágenes | Cloudinary | Con compresión client-side |
| Email | Resend | Limitado a dominio de prueba hasta verificar |
| Auth | JWT + refresh token | Custom (no Auth0/Clerk) |

---

## ⚠️ Cosas frágiles que tengo que cuidar

1. **No tocar `presupuestos.html` ni precios de Quiebracho** sin autorización
   explícita del usuario (regla crítica almacenada en su memoria)
2. **Variables de entorno en Railway**: `JWT_SECRET`, `MP_ENCRYPTION_KEY`,
   `MONGODB_URI`, `GEMINI_API_KEY`, `RESEND_API_KEY` — si alguna se borra,
   se rompe todo
3. **Dos proyectos en Railway**: `surprising-empathy` es MercadoLocal,
   `airy-beauty` es Green Garden Lobos. **No confundirlos**.
4. **El frontend tenía `VITE_API_URL` apuntando a Render**. Cambié el
   código para que ignore esa variable y use Railway hardcoded. Si
   alguien cambia la URL en Vercel, el código sigue funcionando.

---

## 📝 Convenciones del proyecto

- **Mensajes de commit**: en español, formato `tipo: descripción` (fix,
  feat, chore, diag, refactor)
- **Comentarios en código**: en español rioplatense, explicando el "por qué"
- **Variable de seed**: el secreto temporal `lobos-2026-mercadolocal-rescue-xyz`
  se usa para endpoints de diagnóstico que requieren bypass de auth
- **Logging**: emojis en consola para distinguir tipos
  - 📨 incoming request
  - ✅ ok
  - ❌ error
  - 🚨 alerta de seguridad
  - 🧠 cerebro
  - 🎩 Diego
  - 🛡️ Sofía
  - 💬 Tomás

---

## 🎯 Compromiso conmigo mismo

Antes de tocar cualquier cosa en este proyecto en próximas sesiones:

1. ✅ Leo este archivo completo
2. ✅ Reviso `MEMORY.md` del usuario
3. ✅ Verifico estado actual (backend health, último commit, bundle frontend)
4. ✅ Si voy a debuggear UX → uso Chrome MCP, no adivino
5. ✅ Si necesito cambios grandes → planeo + un commit grande, no cascada
6. ✅ Si digo "está listo" → tengo evidencia end-to-end real

**Si fallo en alguno de estos puntos, agregue una nueva lección abajo.**

---

*Última actualización: 2026-05-12 — sesión de migración a Gemini + fix CORS + descubrimiento de backend Render fantasma.*
