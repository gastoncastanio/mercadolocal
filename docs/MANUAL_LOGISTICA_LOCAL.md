# 📦🚕 MANUAL DE LOGÍSTICA LOCAL

> Manual técnico-funcional completo del módulo **Logística Local** de MercadoLocal.
> Cubre los dos verticales (**Comisionistas/Viajeros** y **MercadoLocal Remis**),
> sus tres modos de operación, pagos, comisiones, chat seguro, tiempo real,
> reglas de negocio y el mapa completo de endpoints.

---

## 0. Visión general

**Logística Local** es el paraguas que agrupa todo el movimiento físico dentro de
MercadoLocal: mover **cosas** (bultos/paquetes) y mover **personas** (remis/traslado).

Ambos verticales se apoyan en una **misma figura**: el **Comisionista** — una persona
verificada, con vehículo, que ofrece transporte en su zona. El mismo perfil puede
operar en los dos verticales a la vez.

| | **Comisionistas / Viajeros** | **MercadoLocal Remis** |
|---|---|---|
| **Qué mueve** | Bultos / paquetes / encomiendas | Personas (pasajeros) |
| **Quién contrata** | Contratante / Comprador | Pasajero |
| **Unidad de servicio** | Envío (`EnvioComisionista`) o Cotización (`SolicitudCotizacion`) | Viaje (`ViajeRemis`) |
| **Precio** | Tarifa por tamaño de bulto, o cotización a medida | Banderita + km + espera |
| **Cierre** | Código de entrega en destino | Finalización + pago |
| **Pago** | Mercado Pago split (siempre online) | MP split **o** efectivo (excepción) |

**Diferencia conceptual clave:**
- **Comisionistas** = logística de **encomiendas** (estilo "alguien que viaja de una
  ciudad a otra y te lleva un paquete", o un fletero local).
- **Remis** = logística de **traslado de personas** estilo app (Uber/Cabify), pensado
  para reemplazar al remis tradicional que muere por falta de conexión digital.

---

## 1. La base compartida: el Perfil de Comisionista

Todo en Logística Local arranca con un **`PerfilComisionista`**. Sin él, no se puede
publicar un viaje, ofrecer remis, ni cotizar.

### 1.1 Qué contiene el perfil

| Campo | Descripción |
|---|---|
| `usuarioId` | Dueño del perfil (único, 1 perfil por usuario) |
| `nombreServicio` | Cómo se presenta (ej: "Envíos Express del Valle"). Si vacío, usa el nombre del usuario |
| `descripcion` | Texto libre del servicio |
| `vehiculo` | `{ tipo, patente, capacidadBultos }`. Tipo: auto, camioneta, utilitario, camión, moto, otro |
| `zonasHabituales` | Ciudades que suele recorrer (ej: `['Lobos', 'Cañuelas', 'Saladillo']`) |
| `telefonoContacto` | Teléfono del servicio |
| `dniVerificado` | Badge de identidad (otorgado por admin) |
| `calificacion` | Promedio 0–5 (recalculado desde reseñas) |
| `totalViajes` | Histórico de viajes completados |
| `conteoResenas` | Cantidad de reseñas |
| `documentoVehiculo` | `{ url, tipoDocumento, nombreArchivo }` (título de propiedad / cédula / licencia) |
| `estadoDocumento` | `pendiente` → `verificado` → `rechazado` |
| `horariosActivos` | Horarios por día de la semana |
| `estaTrabajandoHoy` | Toggle "estoy trabajando ahora" |
| `ofreceRemis` | Si además ofrece traslado de personas |
| `tarifasRemis` | `{ banderita, porKm, porHoraEspera, minimo }` |
| `bloqueadoRemis` | Si está bloqueado por deuda de comisión (ver §3.7) |
| `mpAccessToken` / `mpRefreshToken` / `mpVinculado` | Vinculación de Mercado Pago (tokens **encriptados** en reposo) |

### 1.2 Cómo se crea (paso a paso)

1. El usuario va a **"Mi perfil de comisionista"** (`/comisionistas/mi-perfil`).
2. Completa nombre del servicio, vehículo, zonas habituales y teléfono.
3. `POST /api/comisionistas/perfil` → crea el `PerfilComisionista`.
4. El backend marca el **capability flag** `Usuario.esComisionista = true`
   (mismo patrón que `tieneVendedor` / `esProfesional`; **no** toca el enum `rol`).

> ⚠️ **Solo un perfil por usuario.** Si ya existe, devuelve error.

### 1.3 Verificación del documento del vehículo (clave para operar)

Para que el comisionista aparezca "en vivo" o pueda ofrecer remis, **debe tener el
documento del vehículo verificado por un admin**:

1. El comisionista sube su documento → `POST /api/comisionistas/perfil/documento`.
   - Tipos válidos: `titulo_propiedad`, `cédula_estacionamiento`, `licencia_conducir`.
   - El archivo se sube a **Cloudinary** (solo se guarda la URL, nunca binario).
   - El estado vuelve a `pendiente` (incluso si re-sube uno nuevo).
2. El admin lo revisa en su panel → `documentosPendientes()`.
3. El admin aprueba o rechaza → `verificarDocumento(perfilId, aprobado)`:
   - **Aprobado** → `estadoDocumento = 'verificado'`. Recibe notificación: "Ya podés empezar a trabajar".
   - **Rechazado** → `estadoDocumento = 'rechazado'` + se apaga `estaTrabajandoHoy`. Notificación pidiendo subir uno válido.

### 1.4 Botón "Estoy trabajando hoy"

`PATCH /api/comisionistas/perfil/trabajando` con `{ activo: true/false }`.
- Requiere documento **verificado** para activarse.
- Determina si aparece en los paneles "en vivo" (checkout) y en la lista de remiseros disponibles.

### 1.5 Vinculación de Mercado Pago (OAuth)

Para **cobrar** (envíos, traslados, remis), el comisionista vincula su cuenta de MP
vía OAuth. Esto guarda tokens encriptados (`mpAccessToken`, `mpRefreshToken`) y marca
`mpVinculado = true`. Sin esto, **nadie puede pagarle online** (los flujos de pago
arrojan error pidiendo que vincule MP).

### 1.6 Calificación y reseñas

- Modelo `ResenaComisionista` cubre **ambos verticales**:
  - Reseña de envío → campo `envioId`.
  - Reseña de remis → campo `viajeRemisId`.
  - Exactamente uno de los dos está presente (índices **sparse unique**).
- Cada reseña dispara `recalcularCalificacion()`: promedio de **todas** las reseñas
  del comisionista (envíos + remis juntos) → actualiza `PerfilComisionista.calificacion`.
- Calificación 1–5, con comentario opcional (máx 1000 chars).

---

# PARTE A — Vertical COMISIONISTAS / VIAJEROS (bultos)

Este vertical tiene **tres modos de operación** que conviven:

1. **Viajes programados + reserva de cupo** — el comisionista publica un trayecto;
   los contratantes reservan lugar para sus bultos.
2. **Cross-checkout** — al comprar un producto de otra ciudad, el comprador engancha
   su compra a un viaje para que se la traigan.
3. **Comisionista "en vivo"** — desde el checkout, el comprador le pide cotización a
   un comisionista que está trabajando ahora.

---

## 2. Modo 1 — Viajes programados + reserva de cupo

### 2.1 El modelo `Viaje`

Un **trayecto programado** entre dos ciudades con capacidad de bultos.

| Campo | Descripción |
|---|---|
| `comisionistaId` | Dueño del viaje (ref Usuario) |
| `origen` / `destino` | `{ ciudad, lat, lng }` — la **ciudad** es la fuente de verdad; lat/lng opcionales para el mapa |
| `paradas[]` | Localidades intermedias (waypoints) en orden de recorrido |
| `fechaSalida` | Fecha del viaje |
| `horaSalida` | Hora como texto (ej: "14:30") |
| `tarifas` | `{ bultoChico, bultoMediano, bultoGrande }` (ARS) |
| `capacidadTotal` | Cantidad total de bultos que entra |
| `capacidadDisponible` | Cupo restante (se decrementa al reservar) |
| `estado` | `programado` → `en_curso` → `completado` / `cancelado` |

**Máquina de estados del viaje:**
```
programado ──► en_curso ──► completado
     │             │
     └──► cancelado ◄┘
```
- `programado → en_curso` o `cancelado`
- `en_curso → completado` o `cancelado`
- `completado` y `cancelado` son finales.
- Al **completar**, suma +1 a `totalViajes` del comisionista.

### 2.2 Publicar un viaje

`POST /api/comisionistas/viaje` (requiere perfil). Validaciones:
- Origen y destino obligatorios.
- Fecha de salida obligatoria.
- Capacidad entera ≥ 1.

`capacidadDisponible` arranca igual a `capacidadTotal`.

### 2.3 Buscar viajes

`GET /api/comisionistas/viajes?origen=&destino=&fecha=`
- Solo viajes `programado` con `fechaSalida >= ahora`.
- Filtra por ciudad de origen/destino y/o fecha (rango del día completo).
- Ordena por fecha de salida ascendente. Paginado (`skip`, `limit`).

### 2.4 Reservar cupo (`EnvioComisionista`)

Acá nace un **envío**. `POST /api/comisionistas/viaje/:id/contratar` con
`{ tamano, cantidadBultos, descripcion, ordenId? }`.

**El modelo `EnvioComisionista`:**

| Campo | Descripción |
|---|---|
| `viajeId` | Viaje reservado |
| `comisionistaId` | Denormalizado del viaje (para chat y lookups) |
| `contratanteId` | Quien reserva |
| `ordenId` | Si nace de una compra (cross-checkout), se liga la orden |
| `cantidadBultos` | Cantidad reservada |
| `tamano` | `chico` / `mediano` / `grande` |
| `descripcion` | Qué se envía |
| `precio` | `tarifa[tamaño] × cantidad` |
| `estado` | `pendiente` → `aceptado` → `en_transito` → `entregado` / `cancelado` |
| `codigoEntregaHash` | **Hash** del código de entrega (anti-fraude) |
| `entregadoEn` | Timestamp de la entrega |
| `pago` | `{ mpPaymentId, estadoPago }` (split al comisionista) |

**Decremento de cupo ATÓMICO (anti-sobreventa):**
```js
Viaje.findOneAndUpdate(
  { _id, estado: 'programado', capacidadDisponible: { $gte: cantidad } },
  { $inc: { capacidadDisponible: -cantidad } }
)
```
La guarda `$gte` garantiza que dos reservas simultáneas **nunca** sobrevendan el cupo.
Si la creación del envío falla luego, se **devuelve el cupo** automáticamente.

**Código de entrega (clave anti-fraude):**
- Se genera un código (`generarCodigoCanje()`).
- En la base se guarda **solo el hash** (`codigoEntregaHash`).
- El código en claro se devuelve al contratante **una sola vez** en la respuesta.
- El comisionista lo pide en destino y lo ingresa para cerrar el envío.

> El frontend persiste el código en `localStorage` (el backend solo guarda el hash).
> Cross-device (verlo en otro dispositivo) es un follow-up conocido.

**Máquina de estados del envío:**
```
pendiente ──► aceptado ──► en_transito ──► entregado
    │            │              │
    └────────────┴──────────────┴──► cancelado (devuelve cupo)
```

### 2.5 Ciclo de vida del envío

1. **Contratar** → `pendiente`. El comisionista recibe notificación "Nueva reserva en tu viaje".
2. **Pagar** (contratante) → `POST /api/comisionistas/envio/:id/pagar` → crea preferencia
   MP con split → redirige a MP. Al aprobar: `pago.estadoPago = 'pagado'`.
3. **Aceptar** (comisionista) → `pendiente → aceptado`. Notifica al contratante.
4. **En tránsito** (comisionista) → `aceptado → en_transito`. Notifica.
5. **Entregar** (comisionista) → `PATCH /api/comisionistas/envio/:id/entregar` con `{ codigo }`.
   - Valida `hashCodigoCanje(codigo) === codigoEntregaHash`.
   - Transición atómica `en_transito → entregado` (un solo uso) + `entregadoEn`.
6. **Reseñar** (contratante) → solo si `entregado`. Una reseña por envío.

**Cancelación** (cualquiera de las partes, antes de `entregado`):
- Transición atómica a `cancelado`.
- **Devuelve el cupo** al viaje (`$inc capacidadDisponible`).
- Si estaba ligado a una orden, **desliga la orden** (para que el comprador elija otro viaje).

---

## 3. Modo 2 — Cross-checkout (envío ligado a una compra)

Cuando alguien compra un producto de **otra localidad**, puede engancharlo a un viaje.

### 3.1 Buscar viajes que matchean la orden

`GET /api/comisionistas/viajes-para-orden/:ordenId` → `viajesParaOrden()`:
1. Verifica que la orden sea del comprador.
2. **Ciudad de origen** = ciudad de la tienda del primer ítem.
3. **Ciudad de destino** = `orden.ciudadEntrega`.
4. Busca viajes `programado`, con cupo, cuyo **origen** sea esa ciudad y cuyo **destino
   o alguna parada** coincida con la ciudad de entrega.
5. Devuelve `{ viajes, ciudadOrigen, ciudadDestino, yaAsignado }`.

### 3.2 Ligar el envío a la orden

Al contratar con `ordenId`:
- Valida que la orden sea del contratante, esté **paga** (no `pendiente`) y **no tenga
  ya un envío** asignado.
- Liga la orden de forma **idempotente y a prueba de carreras**:
  ```js
  Orden.findOneAndUpdate(
    { _id, envioComisionistaId: null },  // solo si no tenía uno
    { envioComisionistaId: envio._id, comisionistaId }
  )
  ```
- Si otro envío ganó la orden en el medio, **revierte** (borra el envío + devuelve cupo).

> Cancelar un envío ligado **desvincula la orden** automáticamente.

---

## 4. Modo 3 — Comisionista "en vivo" desde el checkout (`SolicitudCotizacion`)

Para traslados a medida: el comprador le pide cotización a un comisionista que está
trabajando **ahora mismo**.

### 4.1 Panel "en vivo"

`GET /api/comisionistas/en-vivo?ciudadDestino=` → `comisionistasEnVivo()`:
- Lista comisionistas con `activo + estaTrabajandoHoy + estadoDocumento='verificado'`.
- Ordena por calificación y total de viajes.
- Si se pasa ciudad de destino, prioriza a los que la cubren en sus zonas habituales.

### 4.2 El modelo `SolicitudCotizacion`

| Campo | Descripción |
|---|---|
| `ordenId` | Orden del marketplace a trasladar |
| `compradorId` | Quien pide |
| `comisionistaId` | A quién se le pide |
| `vendedorId` | Vendedor del producto (para coordinar el **retiro**) |
| `ciudadOrigen` / `ciudadDestino` | Retiro (ciudad del vendedor) / entrega (ciudad del comprador) |
| `descripcionCarga` | Qué se traslada |
| `estado` | `pendiente` → `cotizada` → `aceptada` / `rechazada` / `cancelada` |
| `cotizacion` | `{ monto, notas, fecha }` |
| `pago` | `{ mpPreferenceId, mpPaymentId, comisionPlataforma, estadoPago }` |
| `terminosAceptados` | El comprador **debe** aceptar el deslinde legal |
| `incidente` | `{ reportado, descripcion, fecha }` (rotura/accidente) |

### 4.3 Flujo completo

1. **Solicitar** → `POST /api/comisionistas/cotizacion` con `{ ordenId, comisionistaId,
   descripcionCarga, terminosAceptados }`.
   - **Obligatorio aceptar el deslinde** (`terminosAceptados`), si no, error.
   - La orden debe estar paga; el comisionista activo y verificado.
   - Índice único `{ ordenId, comisionistaId }`: no se puede spamear al mismo dos veces.
2. **Cotizar** (comisionista) → `PATCH .../cotizacion/:id/responder` con `{ monto, notas }`
   → `pendiente → cotizada`. Notifica al comprador.
3. **Aceptar** (comprador) → `PATCH .../cotizacion/:id/aceptar` → `cotizada → aceptada`.
   **Esto desbloquea el chat seguro** entre comprador y comisionista.
4. **Pagar** (comprador) → `POST .../cotizacion/:id/pagar` → preferencia MP con split
   (comisión `traslado`). Al aprobar: `pago.estadoPago = 'pagado'`.
5. **Coordinar** retiro y entrega por chat.
6. **Incidente** (opcional) → `PATCH .../cotizacion/:id/incidente`: el comisionista
   reporta rotura/accidente. MercadoLocal **solo deja constancia**; el reintegro lo
   resuelve el vendedor con el comprador. Notifica a ambos.

> **Deslinde legal explícito:** MercadoLocal SOLO conecta. El traslado, su precio y
> cualquier problema quedan 100% a cargo del comisionista y el vendedor.

---

# PARTE B — Vertical MERCADOLOCAL REMIS (personas)

Traslado de personas estilo app. El mismo conductor verificado (con `ofreceRemis=true`)
ofrece viajes; el pasajero pide desde el teléfono y sigue el estado en tiempo real.

---

## 5. El modelo `ViajeRemis`

| Campo | Descripción |
|---|---|
| `pasajeroId` | Quien pide el remis |
| `comisionistaId` | Conductor que lo toma (`null` mientras está `buscando`) |
| `origen` / `destino` | `{ direccion, ciudad, referencia, lat, lng }` — la **dirección** es la fuente de verdad |
| `tipoServicio` | `traslado` / `ida_vuelta` / `dia_compras` |
| `distanciaKm` | Distancia estimada |
| `horasEspera` | Horas de espera/acompañamiento (ida_vuelta / día de compras) |
| `pasajeros` | Cantidad de pasajeros |
| `precioEstimado` | Calculado al pedir (con tarifas del conductor) |
| `precioFinal` | Confirmado por el conductor al cerrar |
| `programadoPara` | Fecha futura, o `null` = "ahora" |
| `estado` | `buscando` → `aceptado` → `en_camino` → `a_bordo` → `finalizado` / `cancelado` |
| `pago` | Ver §7 y §8 (incluye método app/efectivo y comisión adeudada) |

### 5.1 Tipos de servicio

| Tipo | Qué incluye | Cobro |
|---|---|---|
| **traslado** | Punto A → punto B (viaje simple) | banderita + km |
| **ida_vuelta** | Ida, espera corta, vuelta al origen | banderita + km + espera |
| **dia_compras** | Te lleva, te espera/acompaña mientras hacés tus compras y te devuelve a casa | banderita + km + espera |

### 5.2 Máquina de estados del viaje de remis

```
buscando ──► aceptado ──► en_camino ──► a_bordo ──► finalizado
    │           │             │            │
    └───────────┴─────────────┴────────────┴──► cancelado
```
- `buscando`: el pasajero pidió; visible a los remiseros disponibles.
- `aceptado`: un conductor lo tomó (**claim atómico**, ver §6.3). Desbloquea el chat.
- `en_camino`: el conductor va hacia el origen a buscar al pasajero.
- `a_bordo`: el pasajero subió; el viaje (o el día de compras) está en curso.
- `finalizado`: el conductor cerró el viaje (confirma precio final).
- `cancelado`: cualquiera de las partes lo canceló antes de finalizar.

**Transiciones permitidas del conductor:** `aceptado→en_camino`, `en_camino→a_bordo`,
`a_bordo→finalizado`.

---

## 6. Operar como remisero

### 6.1 Activar remis + configurar tarifas

`PATCH /api/remis/configuracion` con `{ ofreceRemis, tarifasRemis }`.
- Requiere documento del vehículo **verificado** para activar `ofreceRemis`.
- `tarifasRemis = { banderita, porKm, porHoraEspera, minimo }` (ARS).

### 6.2 Fórmula de precio

```
precio = banderita + (km × porKm) + (horas × porHoraEspera)
precio = max(precio, minimo)
```
- **banderita** = bajada de bandera (costo base fijo de cualquier viaje).
- **porKm** = costo por kilómetro.
- **porHoraEspera** = costo por hora de espera/acompañamiento (clave para "día de compras").
- **minimo** = ningún viaje cobra menos que esto.

### 6.3 Pedir un remis (pasajero)

`POST /api/remis/pedir`. Dos modalidades:
- **Dirigido**: con `comisionistaIdPreferido` → solo notifica a ese conductor; el precio
  estimado se calcula con sus tarifas.
- **Broadcast** (abierto): sin conductor → notifica a todos los remiseros disponibles
  que cubren la ciudad. El precio se recalcula cuando alguien lo toma.

También acepta `pagoEfectivo: true` (ver §8).

### 6.4 Remiseros disponibles

`GET /api/remis/disponibles?ciudad=&distanciaKm=&horasEspera=` →
- Lista conductores con `ofreceRemis + estaTrabajandoHoy + activo + verificado +
  bloqueadoRemis:false`.
- Devuelve el **precio estimado** de cada uno para esa ruta.
- Prioriza a los que cubren la ciudad.

### 6.5 Tomar un viaje (claim atómico)

`PATCH /api/remis/viaje/:id/aceptar` → `aceptarRemis()`:
- El conductor debe ofrecer remis, estar verificado y **no estar bloqueado por deuda**.
- **Claim ATÓMICO** `buscando → aceptado`:
  ```js
  ViajeRemis.findOneAndUpdate(
    { _id, estado: 'buscando' },
    { estado: 'aceptado', comisionistaId, aceptadoEn, precioEstimado }
  )
  ```
  Si dos conductores tocan "Aceptar" a la vez, **solo uno gana**; el otro recibe "ya fue tomado".
- Si el pedido era abierto, recalcula el precio con las tarifas de quien lo toma.
- Notifica al pasajero "Un conductor tomó tu viaje".

### 6.6 Avanzar el estado

`PATCH /api/remis/viaje/:id/en-camino` · `.../a-bordo` · `.../finalizar`.
- Cada transición valida que sea legal y que la haga el conductor dueño.
- Al **finalizar**, el conductor confirma `precioFinal` (puede ajustar si el día se
  extendió). Suma +1 a `totalViajes`.
- **Cada cambio notifica al pasajero en tiempo real** (la app del pasajero se refresca
  sola, sin recargar — ver §10).

### 6.7 Cancelar

`PATCH /api/remis/viaje/:id/cancelar` (pasajero o conductor, antes de finalizar).
Registra `canceladoPor` para métricas/reputación.

---

## 7. Pago del remis por la app (split — camino por defecto)

`POST /api/remis/viaje/:id/pagar` (pasajero, viaje finalizado):
- Requiere que el conductor tenga MP vinculado.
- Crea preferencia con `external_reference = "remis:<viajeId>"`, **split** al conductor
  con `marketplace_fee` (comisión `remis`, default 10%).
- El pasajero paga en MP. Al aprobar, el **webhook** marca `pago.estadoPago = 'pagado'`
  y notifica al conductor.
- **Fallback**: `POST /api/remis/viaje/:id/verificar-pago` consulta a MP al volver del
  checkout, por si el webhook no llegó.

---

## 8. Pago en EFECTIVO + comisión adeudada + bloqueo (la excepción controlada)

> **Regla de oro:** El pago **debe** registrarse por la app. El efectivo es una
> **excepción** que requiere consentimiento mutuo y deja al conductor **debiendo** la
> comisión. Si se detecta "puenteo" (evasión), se puede bloquear la cuenta.

### 8.1 Campos de pago en `ViajeRemis.pago`

| Campo | Descripción |
|---|---|
| `metodo` | `app` (default, split online) o `efectivo` (excepción) |
| `efectivoSolicitado` | El pasajero pidió pagar en efectivo |
| `efectivoAceptado` | El conductor aceptó cobrar en efectivo |
| `comisionPlataforma` | Monto de la comisión (10% del precio final) |
| `comisionEfectivoEstado` | `no_aplica` → `adeudada` → `en_pago` → `pagada` |
| `comisionEfectivoPagadaEn` | Cuándo el conductor saldó esta comisión |

### 8.2 Flujo completo del efectivo

```
1. PASAJERO solicita efectivo
   POST /api/remis/pedir { pagoEfectivo: true }
   → pago.efectivoSolicitado = true, metodo = 'efectivo'

2. CONDUCTOR acepta el efectivo (puede rechazarlo)
   PATCH /api/remis/viaje/:id/efectivo/aceptar
   → pago.efectivoAceptado = true
   (Si NO acepta → el viaje se paga por app al finalizar, normal)

3. Viaje se desarrolla y el conductor FINALIZA (confirma precio final)

4. CONDUCTOR registra el cobro en mano
   PATCH /api/remis/viaje/:id/efectivo/registrar
   → pago.estadoPago = 'pagado' (por efectivo)
   → comisionPlataforma = precioFinal × 10%
   → comisionEfectivoEstado = 'adeudada'   ← EL CONDUCTOR NOS DEBE

5. El sistema evalúa la deuda. Si el viaje en efectivo MÁS VIEJO sin saldar
   supera 21 días (3 semanas) → bloquea: PerfilComisionista.bloqueadoRemis = true
```

> **Anti-evasión:** nadie puede "convertir" un viaje a efectivo por su cuenta. Requiere
> que el pasajero lo **solicite** Y el conductor lo **acepte**. Sin las dos cosas, no
> hay botón de "registrar cobro en efectivo".

### 8.3 Cálculo de la deuda y bloqueo (`DIAS_GRACIA_COMISION = 21`)

`resumenComisionConductor()` calcula en vivo (fuente de verdad = los viajes):
- `deudaTotal` = suma de `comisionPlataforma` de viajes con comisión `adeudada` o `en_pago`.
- `viajeMasViejo` = el `finalizadoEn` más antiguo entre los adeudados.
- `fechaLimite` = `viajeMasViejo + 21 días`.
- `diasRestantes` = días hasta esa fecha.
- `bloqueado` = flag del perfil.

`verificarBloqueoComision()` (idempotente, evalúa y sincroniza):
- Si el adeudado más viejo tiene **> 21 días** → `bloqueadoRemis = true`, apaga
  `estaTrabajandoHoy`, notifica al conductor.
- Si ya **no** hay deuda vieja (pagó) → **desbloquea** automáticamente.
- Se ejecuta al **tomar un viaje** (`aceptarRemis`) y al pagar la comisión.

**Efecto del bloqueo:** no puede tomar viajes ni aparecer en la lista de remiseros
disponibles. **Es a nivel operación de remis**, reversible al pagar (no desactiva la
cuenta entera).

### 8.4 Pagar la comisión adeudada

`POST /api/remis/conductor/pagar-comision`:
1. Marca todos los viajes `adeudada → en_pago` (reserva, para no perderlos si finaliza
   más viajes mientras paga) + guarda `mpPreferenceId`.
2. Crea preferencia MP con `external_reference = "comisionremis:<comisionistaId>"`.
   **El dinero va 100% a la plataforma** (no hay split — es pago de deuda, como la pauta).
3. Redirige al conductor a MP.

**Al aprobar el pago** (webhook):
- `marcarComisionRemisPagada()`: `en_pago → pagada` + `comisionEfectivoPagadaEn`.
- Revalúa el bloqueo → **desbloquea** si ya no hay deuda vieja.
- Notifica "Comisión pagada, tu servicio sigue activo".

**Fallback**: `POST /api/remis/conductor/verificar-comision`:
- Consulta a MP al volver del checkout.
- Si **no** está aprobado, **revierte** `en_pago → adeudada` (libera la reserva).

### 8.5 Resumen visible para el conductor

`GET /api/remis/conductor/comision` devuelve `{ deudaTotal, enPago, cantidadViajes,
viajeMasViejo, fechaLimite, diasRestantes, diasGracia: 21, bloqueado }`.

En el **panel del conductor** aparece la pestaña **💳 Comisiones** con:
- Total adeudado y cantidad de viajes.
- Días restantes antes del bloqueo (o alerta roja si ya está bloqueado).
- Botón **"Pagar comisión $X"** → Mercado Pago.

---

## 9. Pagos y comisiones (transversal a todo Logística Local)

### 9.1 Mercado Pago con split (marketplace)

Todos los cobros a favor del comisionista usan **split payment**: la preferencia se
crea con el **token del comisionista** y un `marketplace_fee` que retiene la plataforma.
El dinero del servicio va al comisionista; la comisión, a MercadoLocal.

### 9.2 Porcentajes de comisión (configurables en `ConfigSitio`)

| Flujo | Tipo | Clave de config | Default |
|---|---|---|---|
| Envío en viaje (`crearPreferenciaEnvio`) | `envio_comisionista` | (sin clave → default) | **10%** |
| Traslado cotizado (`crearPreferenciaTraslado`) | `traslado` | `comision_traslado_porcentaje` | **10%** |
| Remis (`crearPreferenciaRemis`) | `remis` | `comision_remis_porcentaje` | **10%** |
| Comisión de efectivo (`crearPreferenciaComisionRemis`) | — | usa % de remis | **10%** (100% a plataforma, sin split) |

> Todos editables por admin. `obtenerPorcentajeComision(tipo)` lee la clave y cae a 10
> si no está seteada.

### 9.3 Prefijos de `external_reference` (cómo el webhook distingue)

El webhook `/api/pagos/webhook` discrimina por el prefijo:

| Prefijo | Significado | Acción |
|---|---|---|
| `envio:<id>` | Pago de un EnvioComisionista | `marcarEnvioPagado()` |
| `cotizacion:<id>` | Pago de un traslado cotizado | `marcarTrasladoPagado()` |
| `remis:<id>` | Pago de un viaje de remis | `marcarRemisPagado()` |
| `comisionremis:<comisionistaId>` | Pago de comisión adeudada (efectivo) | `marcarComisionRemisPagada()` |

Todas las funciones son **idempotentes** (si ya está pagado, no repiten) y hay un
**fallback de verificación** que consulta a MP al volver del checkout.

---

## 10. Chat seguro y tiempo real

### 10.1 Desbloqueo del chat (`existeServicioContratadoEntre`)

El chat 1-a-1 se **desbloquea** (deja de censurar contactos) cuando hay una relación de
servicio entre dos usuarios. Para Logística Local:

| Vertical | Se desbloquea cuando… |
|---|---|
| **Envíos** | Existe un `EnvioComisionista` no cancelado entre contratante y comisionista |
| **Cotización en vivo** | La `SolicitudCotizacion` está `aceptada` |
| **Remis** | El `ViajeRemis` está `aceptado` / `en_camino` / `a_bordo` / `finalizado` |

### 10.2 Notificaciones en tiempo real (Socket.IO)

- Cada usuario se une a su sala personal `user:<id>` (autenticado con JWT).
- `emitNotificacion(usuarioId, {...})` empuja eventos a esa sala **+ Web Push** si la
  app está cerrada.
- Todos los cambios de estado (envíos, cotizaciones, remis, comisión) notifican a la
  parte correspondiente.
- **Mensajes de chat**: `emitNuevoMensaje()` → evento `mensaje:nuevo` (llegan al instante).
- **Estados de remis**: la página del pasajero (`MisViajesRemisPage`) y el panel del
  conductor escuchan notificaciones tipo `remis` y **recargan solos** — sin tener que
  salir y volver a entrar.

---

## 11. Mapa de endpoints (API REST)

### 11.1 Comisionistas — perfil
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/comisionistas/perfil` | Crear perfil |
| GET | `/api/comisionistas/perfil/me` | Mi perfil |
| GET | `/api/comisionistas/perfil/:usuarioId` | Perfil público |
| PATCH | `/api/comisionistas/perfil` | Actualizar |
| POST | `/api/comisionistas/perfil/documento` | Subir documento del vehículo |
| PATCH | `/api/comisionistas/perfil/trabajando` | Toggle "trabajando hoy" |
| GET | `/api/comisionistas/en-vivo?ciudadDestino=` | Comisionistas trabajando ahora |

### 11.2 Comisionistas — viajes y envíos
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/comisionistas/viaje` | Publicar viaje |
| GET | `/api/comisionistas/viajes?origen=&destino=&fecha=` | Buscar viajes |
| GET | `/api/comisionistas/mis-viajes` | Mis viajes publicados |
| GET | `/api/comisionistas/viaje/:id` | Detalle de viaje |
| GET | `/api/comisionistas/viajes-para-orden/:ordenId` | Viajes que matchean una compra |
| PATCH | `/api/comisionistas/viaje/:id/iniciar` · `/completar` · `/cancelar` | Estados del viaje |
| POST | `/api/comisionistas/viaje/:id/contratar` | Reservar cupo (crea envío) |
| POST | `/api/comisionistas/envio/:id/pagar` | Pagar envío (split) |
| POST | `/api/comisionistas/envio/:id/verificar-pago` | Verificar pago (fallback) |
| GET | `/api/comisionistas/mis-envios` | Envíos que contraté |
| GET | `/api/comisionistas/envios-recibidos` | Envíos en mis viajes |
| PATCH | `/api/comisionistas/envio/:id/aceptar` · `/transito` · `/entregar` · `/cancelar` | Estados del envío |
| POST | `/api/comisionistas/envio/:id/resena` | Reseñar tras la entrega |
| GET | `/api/comisionistas/mis-resenas-hechas` | IDs de envíos ya reseñados |
| GET | `/api/comisionistas/:usuarioId/resenas` | Reseñas públicas |

### 11.3 Comisionistas — cotización en vivo
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/comisionistas/cotizacion` | Pedir cotización (con deslinde) |
| GET | `/api/comisionistas/cotizaciones-recibidas` | Las que recibió el comisionista |
| GET | `/api/comisionistas/mis-cotizaciones` | Las que pidió el comprador |
| PATCH | `/api/comisionistas/cotizacion/:id/responder` | Cotizar un precio |
| PATCH | `/api/comisionistas/cotizacion/:id/aceptar` | Aceptar (desbloquea chat) |
| POST | `/api/comisionistas/cotizacion/:id/pagar` | Pagar traslado (split) |
| POST | `/api/comisionistas/cotizacion/:id/verificar-pago` | Verificar (fallback) |
| PATCH | `/api/comisionistas/cotizacion/:id/cancelar` | Cancelar/rechazar |
| PATCH | `/api/comisionistas/cotizacion/:id/incidente` | Reportar rotura/accidente |

### 11.4 Remis
| Método | Ruta | Qué hace |
|---|---|---|
| PATCH | `/api/remis/configuracion` | Activar remis + tarifas |
| GET | `/api/remis/disponibles` | Remiseros disponibles + precio |
| POST | `/api/remis/pedir` | Pedir un remis (acepta `pagoEfectivo`) |
| GET | `/api/remis/mis-viajes` | Viajes que pedí (pasajero) |
| GET | `/api/remis/conductor/viajes` | Viajes que tomé (conductor) |
| GET | `/api/remis/conductor/pedidos` | Pedidos abiertos para tomar |
| GET | `/api/remis/viaje/:id` | Detalle |
| PATCH | `/api/remis/viaje/:id/aceptar` · `/en-camino` · `/a-bordo` · `/finalizar` · `/cancelar` | Estados |
| POST | `/api/remis/viaje/:id/pagar` · `/verificar-pago` | Pago por app (split) |
| PATCH | `/api/remis/viaje/:id/efectivo/aceptar` | Conductor acepta efectivo |
| PATCH | `/api/remis/viaje/:id/efectivo/registrar` | Conductor registra cobro en mano |
| GET | `/api/remis/conductor/comision` | Resumen de deuda |
| POST | `/api/remis/conductor/pagar-comision` | Pagar comisión adeudada |
| POST | `/api/remis/conductor/verificar-comision` | Verificar (fallback) |
| POST | `/api/remis/viaje/:id/resena` | Reseñar al conductor |
| GET | `/api/remis/mis-resenas-hechas` | IDs de viajes ya reseñados |

---

## 12. Mapa del frontend (páginas y navegación)

| Página | Ruta | Para quién |
|---|---|---|
| `ComisionistasPage` | `/comisionistas` | Buscar viajes de bultos |
| `DetalleViajePage` | `/comisionistas/viaje/:id` | Ver + reservar + código de entrega |
| `MiPerfilComisionistaPage` | `/comisionistas/mi-perfil` | Perfil + publicar viajes + gestionar reservas + tarifas de remis |
| `MisEnviosPage` | `/comisionistas/mis-envios` | Envíos contratados + chat + código |
| `PedirRemisPage` | `/remis` | Pedir un remis (con opción efectivo) |
| `MisViajesRemisPage` | `/remis/mis-viajes` | Seguimiento del viaje + pago + reseña |
| `RemisConductorPage` | `/remis/conductor` | Panel del conductor: pedidos, viajes activos, comisiones |

Acceso desde la **Navbar**: menú del avatar (acordeón "Remis" y sección comisionistas)
y menú mobile.

---

## 13. Reglas de negocio y deslindes legales (resumen)

1. **Verificación obligatoria**: sin documento del vehículo verificado por admin, el
   comisionista no aparece en vivo ni puede ofrecer remis.
2. **Pago obligatorio por la app** en remis. El efectivo es excepción consentida y deja
   comisión adeudada.
3. **Bloqueo por deuda**: > 3 semanas (21 días) de comisión impaga de viajes en efectivo
   → bloqueo automático del servicio de remis hasta saldar.
4. **Detección de puenteo**: acuerdos fuera de la app para evadir comisión → bloqueo
   permanente + acciones legales (documentado en Términos y Condiciones, sección 12.bis).
5. **Deslinde en traslados de carga**: MercadoLocal solo conecta. Roturas/accidentes los
   resuelve el vendedor con el comisionista (constancia vía `incidente`).
6. **Anti-fraude entrega**: el código de entrega vive como **hash** en la base; el código
   en claro lo tiene solo el contratante.
7. **Anti-sobreventa / anti-doble-take**: decrementos de cupo y claims de viaje son
   **atómicos** (findOneAndUpdate con guarda de estado).

---

## 14. Glosario

| Término | Significado |
|---|---|
| **Comisionista / Viajero** | Persona verificada con vehículo que transporta bultos o personas |
| **Contratante** | Quien reserva un envío de bultos |
| **Pasajero** | Quien pide un remis |
| **Viaje** (`Viaje`) | Trayecto programado de bultos entre ciudades |
| **Envío** (`EnvioComisionista`) | Reserva de cupo de bultos en un Viaje |
| **Cotización** (`SolicitudCotizacion`) | Pedido de traslado a medida desde el checkout |
| **Viaje de remis** (`ViajeRemis`) | Traslado de personas estilo app |
| **Cross-checkout** | Enganchar una compra a un viaje para que la traigan |
| **Banderita** | Bajada de bandera: costo base fijo de un remis |
| **Split payment** | Cobro donde el dinero va al comisionista y la comisión a la plataforma |
| **marketplace_fee** | El monto de comisión que retiene MercadoLocal en el split |
| **Comisión adeudada** | Lo que el conductor debe por viajes cobrados en efectivo |
| **Código de entrega** | Código de un solo uso que cierra un envío (guardado como hash) |
| **Capability flag** | `esComisionista` en Usuario (no toca el enum `rol`) |

---

*Documento generado para el equipo de MercadoLocal — módulo Logística Local.*
