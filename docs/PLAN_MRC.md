# Plan de Implementación — Motor de Relevancia Contextual (MRC)

> Documento de revisión. **Nada de esto está codeado todavía.** Es el plan para que lo
> apruebes (entero o por partes) antes de implementar. Donde hay decisiones legales o de
> producto que requieren tu visto bueno, están marcadas con **⚠️ DECISIÓN**.

---

## 0. Decisiones ya tomadas

| Tema | Decisión |
|------|----------|
| Stack de datos | **MongoDB + Mongoose** (NO Prisma/Postgres/Supabase — adaptado a tu proyecto real) |
| Ubicación del usuario | **Cálculo 100% client-side** — la posición del usuario nunca viaja al servidor |
| Modelo de comercios | **`ComercioCentro` nuevo y separado** del marketplace de Tiendas |
| Entrega | **Por fases**, mostrándote cada una antes de seguir |

---

## 1. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│  NAVEGADOR (cliente)                                          │
│  • Pide GPS (con pantalla de pre-autorización + toggle)      │
│  • Recibe coords de comercios desde el server                │
│  • Calcula distancia (Haversine) LOCALMENTE                  │
│  • La ubicación del usuario NUNCA se envía ni se guarda      │
└───────────────┬─────────────────────────────────────────────┘
                │  (solo pide: "dame comercios de la ciudad X")
                ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND Express/Mongoose                                     │
│  • Devuelve comercios + coords (públicas, del local)         │
│  • Gestiona ofertas flash (countdown y cupo = fuente verdad) │
│  • Emite y valida QR de canje (HMAC, un solo uso)            │
│  • Registra atribución (canje real) para métricas            │
└─────────────────────────────────────────────────────────────┘
```

**Principio rector:** el server solo conoce dónde están los **comercios** (dato público del
local). La ubicación del **usuario** se procesa y se descarta en su propio navegador.

---

## 2. Esquema de datos (Mongoose)

### 2.1 `ComercioCentro` (nuevo)
```js
{
  nombre: String,                    // "Café Martínez Centro"
  rubro: String,                     // 'cafeteria' | 'libreria' | 'indumentaria' | ...
  descripcion: String,
  // Coordenadas PÚBLICAS del local (no del usuario). Aproximadas a 4 decimales.
  ubicacion: {
    lat: Number,
    lng: Number,
    direccion: String,
    ciudad: String
  },
  estadoPrograma: {                  // 'fundador' | 'beta' | 'activo' | 'pausado'
    type: String,
    default: 'beta'
  },
  bloqueHorarioPrioritario: String,  // 'manana' | 'tarde' | 'noche' | 'todos'
  // Feed micro-contenido
  media: {
    videoLoopUrl: String,            // loop corto (opcional)
    posterUrl: String,               // imagen de preview / fallback
    fotos: [String]
  },
  tiempoPrepEstimado: Number,        // minutos (para "Latte listo en 7 min")
  // Vinculación opcional con una tienda del marketplace (si el comercio ya vende online)
  tiendaId: { type: ObjectId, ref: 'Tienda', default: null },
  contacto: { whatsapp: String, instagram: String },
  activo: { type: Boolean, default: true },
  // PIN/secreto del comercio para validar canjes en el mostrador
  secretoCanje: String               // hash; se usa para firmar/validar QR
}
```

### 2.2 `OfertaFlash` (nuevo)
```js
{
  comercioId: { type: ObjectId, ref: 'ComercioCentro', required: true },
  titulo: String,                    // "2x1 en Macchiato"
  descripcion: String,
  tipoGancho: String,                // 'descuento' | '2x1' | 'regalo'
  valorDescuento: Number,            // % si aplica
  // Ventana temporal — FUENTE DE VERDAD en el server
  inicioEn: Date,
  finEn: Date,                       // máx 60 min después de inicioEn
  // Cupo real
  cupoTotal: Number,                 // ej. 20 (0 = ilimitado)
  cupoUsado: { type: Number, default: 0 },
  activa: { type: Boolean, default: true },
  // Bloque horario al que pertenece (para el despachador)
  bloqueHorario: String,             // 'manana' | 'tarde' | 'noche'
  // Recompensa cruzada (opcional): al canjear esta, desbloquea otra
  desbloquea: {
    comercioId: { type: ObjectId, ref: 'ComercioCentro', default: null },
    descripcion: String              // "15% en Librería B de regreso"
  },
  // Condiciones legales visibles
  condiciones: String,               // exclusiones, vigencia, letra chica
  terminos: { type: Boolean, default: true } // exige aceptar T&C al reclamar
}
```

### 2.3 `CanjeAtribuido` (nuevo) — equivale a tu `Transaccion_Atribuida`
```js
{
  usuarioId: { type: ObjectId, ref: 'Usuario', required: true },
  comercioId: { type: ObjectId, ref: 'ComercioCentro', required: true },
  ofertaId: { type: ObjectId, ref: 'OfertaFlash', required: true },
  // Seguridad del QR
  tokenHash: String,                 // hash del token de un solo uso
  nonce: String,
  estado: String,                    // 'emitido' | 'canjeado' | 'expirado'
  emitidoEn: Date,
  expiraEn: Date,                    // ventana corta (ej. 15 min para llegar al local)
  canjeadoEn: Date,
  // Métrica de ROI real (opcional, lo carga el comercio al escanear)
  ticketValor: { type: Number, default: null }
}
```

> **Nota legal:** no se guarda ninguna coordenada del usuario en ningún modelo. La
> atribución registra *qué* se canjeó y *cuándo*, no *desde dónde*.

---

## 3. Endpoints backend

| Método | Ruta | Auth | Qué hace |
|--------|------|------|----------|
| GET | `/api/centro/comercios?ciudad=` | pública | Devuelve comercios + coords del local (para cálculo client-side) |
| GET | `/api/centro/ofertas?bloque=` | pública | Ofertas flash activas (server filtra por hora/cupo reales) |
| POST | `/api/centro/ofertas/:id/reclamar` | **requiere login** | Genera QR de un solo uso (HMAC + nonce + expiración) |
| POST | `/api/centro/canjear` | comercio | Valida y marca canjeado de forma atómica; registra ticket opcional |
| GET | `/api/centro/mis-canjes` | login | Canjes del usuario (sus QR activos) |
| --- admin/comercio --- |
| POST/PUT | `/api/centro/comercios` | admin | Alta/edición de comercios y coords |
| POST/PUT | `/api/centro/ofertas` | comercio/admin | Crear/editar ofertas flash |
| GET | `/api/centro/metricas/:comercioId` | comercio | ROI: canjes reales, ticket promedio |

**Seguridad del QR (clave anti-fraude):**
- Token = `HMAC_SHA256(secreto_server, ofertaId:usuarioId:nonce:expiraEn)`.
- Se guarda solo el **hash**. Una captura de pantalla no sirve dos veces porque el canje
  es **atómico** (`findOneAndUpdate` con `estado: 'emitido' → 'canjeado'`).
- El comercio valida con su PIN/secreto → un comercio no puede canjear ofertas de otro.
- Expiración corta (configurable) para que el QR no quede "vivo" indefinidamente.

---

## 4. Frontend — componentes y pantallas

### 4.1 Pre-autorización GPS (`PreAutorizacionRadar.tsx`)
- Pantalla intermedia estilo lifestyle **antes** del prompt nativo.
- **Toggle gigante** ON/OFF del "Radar del Centro".
- Texto claro: qué se usa, que **no se guarda**, que se puede apagar cuando quiera.
- Integrado con el flag `ml_no_perfilar` ya existente.

### 4.2 Radar del Centro (`RadarCentro.tsx`)
- Pide GPS, recibe comercios, calcula distancia con **Haversine local**.
- Feed ordenado por cercanía. Filtro "< 300 m" en bloque mañana.
- **Fricción cero:** se navega sin login; se exige registro recién al **Reclamar**.

### 4.3 Despachador por bloque horario (`useBloqueHorario.ts`)
- Hook que detecta franja (UI con hora local; canje validado con hora server AR).
- **Mañana (07:30–10:00) "Fast-Track Urbano":** botón "Evita la Fila", "listo en X min", orden por cercanía estricta.
- **Tarde (17:00–19:30) "Desconexión e Impulso":** carrusel "Rutas de Recompensa Cruzada" (ofertas vinculadas A→B).
- Franjas **configurables desde el panel admin** (no hardcodeadas).

### 4.4 Oferta Flash (`TarjetaOfertaFlash.tsx`)
- Countdown sincronizado con `finEn` del server (no con el reloj local).
- Muestra cupo restante real, condiciones y T&C.
- Botón "Reclamar" → genera QR.

### 4.5 QR de canje (`MiQR.tsx`) + Escáner del comercio (`EscanerCanje.tsx`)
- Usuario: muestra su QR temporal.
- Comercio: escanea con la cámara (pide permiso), valida, marca canjeado, opcional carga ticket.

### 4.6 Feed micro-contenido
- Tarjetas con video loop (poster + lazy + autoplay en viewport + ahorro de datos).

---

## 5. Cumplimiento legal (resumen de lo que ya validamos)

| Riesgo | Mitigación en el plan |
|--------|----------------------|
| Geolocalización = dato personal (Ley 25.326) | Consentimiento previo con toggle; **no se persiste** ninguna coord del usuario; cálculo client-side; revocable |
| Urgencia/escasez falsa (Ley 24.240 + Lealtad Comercial Dto 274/2019) | Countdown y cupo **reales** desde el server; condiciones visibles; sin dark patterns |
| Menores | **⚠️ DECISIÓN:** edad mínima / no usar geo de cuentas de menores |
| Precios | En pesos, IVA incluido, condiciones claras |
| Fraude en canjes | QR firmado de un solo uso, canje atómico, validación por comercio |
| Permiso de cámara | Solicitud explícita al comercio |
| Atribución/ROI | Solo qué y cuándo; ticket opcional con consentimiento del comercio |

---

## 6. Fases de entrega

- **Fase 1 — Radar/Geo:** ✅ *Implementada.* modelo `ComercioCentro`, endpoint de comercios, pre-autorización con toggle, Haversine client-side, feed por cercanía. *(Base de todo.)*
- **Fase 2 — Flash Sales + QR:** ✅ *Implementada (con rediseño, ver §8).* `OfertaFlash`, countdown/cupo server, código+QR seguro, validación por el comercio, `CanjeAtribuido`.
- **Fase 3 — Bloques horarios + recompensa cruzada:** despachador, franjas configurables, ofertas vinculadas A→B.
- **Fase 4 — Feed micro-contenido:** soporte de video loops optimizado.

Cada fase compila, se prueba y se commitea por separado.

---

## 8. Rediseño de ingeniería de la Fase 2

Antes de implementar la Fase 2 se revisaron los puntos del plan original que podían
generar errores o fraude en producción. Cambios aplicados:

| # | Riesgo en el plan original | Rediseño aplicado |
|---|----------------------------|-------------------|
| 1 | **Escáner de cámara dentro de la app** (decisión #3): las librerías de QR-scan son frágiles (iOS Safari, permisos, iluminación). | El canje vive en un **código corto legible** (ej. `NQ5Q-P6TC`). El cliente muestra **código + QR** (QR generado 100% local, sin servicio externo → privacidad). El comercio escanea con la **cámara nativa** del celular (el QR abre la URL de canje) **o tipea el código**. Mismo anti-fraude, sin escáner frágil. |
| 2 | **Cupo con condición de carrera** (dos personas reclaman el último cupo a la vez → venta de más). | Consumo de cupo **atómico**: `findOneAndUpdate` con guarda `$expr: cupoUsado < cupoTotal` + `$inc`. Imposible vender de más; verificado con prueba de concurrencia. |
| 3 | **Countdown con el reloj del cliente** (reloj mal → urgencia falsa, prohibida por Lealtad Comercial). | El server envía `serverNow` + `finEn`. El cliente calcula el **offset** y muestra el tiempo real del server. |
| 4 | **HMAC con secreto por comercio** (complejidad innecesaria). | **Token aleatorio fuerte** (`crypto.randomBytes`), se guarda solo el **hash sha256**. Canje autorizado por **JWT del dueño** + verificación de pertenencia de la oferta. |
| 5 | **Acaparamiento** (un usuario reclama muchos cupos y no aparece). | **Un reclamo activo por usuario/oferta** (índice único parcial sobre estado `emitido`) + **expiración corta** del código (30 min). El cupo real se consume al **canjear**, no al reclamar. |

**Privacidad (Ley 25.326):** `CanjeAtribuido` registra QUÉ se canjeó y CUÁNDO, nunca
DESDE DÓNDE. No se guarda ninguna coordenada del usuario en ningún modelo.

### Endpoints agregados en Fase 2
- `GET /api/centro/ofertas` — feed público de ofertas vigentes (server decide vigencia).
- `GET /api/centro/ofertas/:id` — detalle público.
- `POST /api/centro/ofertas/:id/reclamar` — (login) genera código de un solo uso.
- `GET /api/centro/mis-canjes` — (login) reclamos del usuario.
- `POST /api/centro/canjear` — (comercio) valida el código de forma atómica.
- `GET /api/centro/mis-ofertas`, `POST/PUT /api/centro/ofertas` — panel del comercio.
- `GET /api/centro/metricas/:comercioId` — ROI real (reclamos, conversión, ticket).

### Pantallas agregadas en Fase 2
- `TarjetaOfertaFlash.tsx` — countdown sincronizado, cupo real, botón reclamar.
- `MisCanjes.tsx` — código + QR generado local, cuenta regresiva, historial.
- `PanelComercio.tsx` — alta de locales, gestión de ofertas, métricas.
- `CanjearOferta.tsx` — pantalla de validación del comercio (destino del QR).

---

## 7. Decisiones tomadas

1. **Menores:** se exige **confirmar mayoría de edad (18+)** antes de activar el GPS. Cuentas marcadas como menores no usan geo ni reciben ofertas flash.
2. **Carga de comercios/ofertas:** **panel por comercio** — cada comercio gestiona sus propias ofertas (requiere rol/login de comercio).
3. **Canje en mostrador:** el **comercio escanea el QR único del cliente** (máxima atribución y anti-fraude; el comercio necesita login).
4. **Piloto:** arrancamos con **una sola ciudad**.
