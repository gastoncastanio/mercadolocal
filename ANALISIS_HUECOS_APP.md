# Análisis profundo de MercadoLocal — Huecos, riesgos y mejoras

> Hecho recorriendo el código real (no genérico). Cada hallazgo cita el archivo y
> explica **el problema → por qué importa → solución propuesta**. Ordenado por
> severidad. Pensado para leer y decidir qué atacar primero.

---

# 🔴 CRÍTICOS (romper plata, datos o confianza)

## 1. El flujo "comisionista en vivo" NO tiene cierre
**Dónde:** `models/SolicitudCotizacion.js` (estados: `pendiente, cotizada, aceptada, rechazada, cancelada`), `services/ordenService.js` (transiciones `pagada→enviada→completada`).

**Problema:** cuando un comisionista retira y entrega una compra "en vivo":
- La `SolicitudCotizacion` **no tiene estado `en_transito`/`entregado`** ni código de entrega. Queda en `aceptada` para siempre.
- La `Orden` del producto **queda en `pagada` para siempre**: el vendedor no la despacha (la retira el comisionista) y nadie la pasa a `completada`.
- **No hay reseña** del comisionista en este flujo (`reseñarComisionista` está atada a `EnvioComisionista`, no a `SolicitudCotizacion`).

**Por qué importa:** órdenes "fantasma" eternamente en `pagada` ensucian estadísticas, facturación y la sensación de "esto quedó a medias". Sin código de entrega no hay prueba de que llegó. Sin reseña no se construye reputación del comisionista (que es lo que hace girar la rueda).

**Solución:**
1. Agregar a `SolicitudCotizacion` los estados `en_transito` y `entregado` + `codigoEntregaHash` (igual que `EnvioComisionista`).
2. Al pagar el traslado, generar el código (en claro al comprador una vez).
3. El comisionista marca `en_transito` y, al entregar, valida el código → `entregado`.
4. Al pasar a `entregado`, **marcar la Orden del producto como `completada`** (cerrar el ciclo) y habilitar reseña del comisionista.
5. Extender `reseñarComisionista` para aceptar también traslados de `SolicitudCotizacion`.

## 2. Se puede ganar la subasta SIN tener Mercado Pago vinculado → callejón sin salida
**Dónde:** `comisionistaService.js` — `pagarTraslado()` exige `mpVinculado` (línea ~879), pero `ofertarEnvioEnVivo()` y `tomarEnvioEnVivo()` **no lo chequean**.

**Problema:** un comisionista sin MP vinculado puede ofertar o "Agarrar YA". El comprador acepta y, al ir a pagar, **se topa con un error** ("el comisionista no vinculó MP"). El envío queda trabado y la experiencia se rompe justo en el momento de cobrar.

**Por qué importa:** es el peor lugar para fallar (cuando el cliente quiere pagar). Genera bronca en ambos lados.

**Solución:** exigir `perfil.mpVinculado` en `ofertarEnvioEnVivo` y `tomarEnvioEnVivo` (mismo check que `pagarTraslado`). Y en el panel del comisionista, si no tiene MP, mostrar los envíos pero con el botón deshabilitado y un CTA "Vinculá Mercado Pago para cobrar".

## 3. Cero validación de localidad en el BACKEND
**Dónde:** no existe (`grep` de `LOCALIDADES`/`esLocalidadValida` en `backend/src` = 0 resultados). Solo está en el frontend.

**Problema:** los selectores del frontend limitan a las 5 localidades, pero la **API acepta cualquier ciudad**. Un cliente viejo cacheado, un bug, o alguien con las DevTools puede crear una tienda, un viaje o una orden con `ciudad: "Córdoba"`. La regla de negocio "solo operamos en 5 localidades" **no está garantizada donde importa**.

**Por qué importa:** la cobertura es una promesa central (legal y operativa). Si se cuela data fuera de zona, rompés el modelo y aparecen viajes/tiendas que no podés cumplir.

**Solución:** crear `backend/src/constants/localidades.js` (misma lista) y validar en los puntos de entrada: alta/edición de tienda, `publicarViaje`, `crearOrden` (ciudadEntrega), perfil profesional/comisionista (zonas), remis (origen/destino). Rechazar con 400 claro.

## 4. Disputas y reembolsos: no hay reembolso real (y menos con split)
**Dónde:** `disputaService.js` — `resolverDisputa()` solo cambia el `estado` de la disputa. No toca Mercado Pago. `mercadoPagoService.js` tiene `reembolsarPago` pero **no está conectado** a disputas.

**Problema:** si una disputa se resuelve a favor del comprador, **el dinero no se devuelve automáticamente**. Y en pagos con split (vendedor + plataforma), un refund es más complejo (hay que devolver la parte del vendedor). Hoy queda 100% manual/al aire.

**Por qué importa:** es plata real y obligación legal (Defensa del Consumidor + botón de arrepentimiento de MP). Un reembolso que "no pasa" es un reclamo asegurado.

**Solución:** en `resolverDisputa(estadoFinal='resuelta_comprador')`, disparar `reembolsarPago(mpPaymentId)`; marcar `Orden.estado='reembolsada'`; reponer stock si corresponde; notificar a ambos. Documentar el caso split (refund total vs parcial) y, si MP no permite split-refund directo, dejar el flujo de reintegro manual con checklist y registro contable.

## 5. El comprador no puede confirmar "lo recibí" en compras con comisionista
**Dónde:** `routes/ordenes.js` — solo el **vendedor** cambia estados (`PUT /:ordenId/estado`, con `soloTieneVendedor`). No hay endpoint para que el **comprador** confirme recepción.

**Problema:** en el flujo normal, el vendedor marca `enviada` y luego `completada` (confiando en él). El comprador nunca confirma. En el flujo "en vivo" el vendedor ni siquiera participa del despacho → nadie cierra.

**Por qué importa:** "completada" debería depender del que recibe, no solo del que vende. Es clave para liberar reputación, habilitar reseñas y detectar entregas fallidas.

**Solución:** endpoint `PATCH /ordenes/:id/recibido` (solo el comprador) que pase `enviada→completada`. Para "en vivo", el código de entrega (hueco #1) cumple ese rol.

---

# 🟡 IMPORTANTES (lógica incompleta o riesgo medio)

## 6. Órdenes "pagada" que nunca cierran (todas, no solo en vivo)
**Dónde:** `ordenService.js` transiciones.
**Problema:** si el vendedor nunca marca `enviada`/`completada`, la orden vive en `pagada`. No hay timeout, recordatorio al vendedor ni auto-cierre. El comprador ya pagó y el dinero del split ya se movió.
**Solución:** recordatorio al vendedor a las 48h ("despachá la orden #X"); a los N días sin movimiento, alerta al admin / posible disputa automática. (Reusa el patrón del cron que ya armamos para carritos).

## 7. "Agarrar YA" puede dejar al comprador con un precio que no quería
**Dónde:** `tomarEnvioEnVivo()` (lo nuevo).
**Problema:** el primero que toca "Agarrar YA" fija SU precio y adjudica. El comprador puede encontrarse con un precio alto ya adjudicado. Tiene la vía de cancelar (y reabrimos), pero la fricción existe.
**Mitigación ya hecha:** cancelar reabre la subasta. **Mejora:** mostrarle al comisionista un "precio sugerido" (rango razonable por distancia) y/o permitir al comprador fijar un **techo** al elegir "comisionista en vivo" ("hasta $X"). Si la oferta lo supera, no se auto-adjudica.

## 8. El comisionista en vivo no ve la dirección exacta hasta pagar — ¿y la distancia real?
**Dónde:** `enviosEnVivoAbiertos()` devuelve ciudad origen/destino, no dirección.
**Problema (bien resuelto por privacidad)** pero **falta** una estimación de distancia/tiempo para que el comisionista ofterte con criterio. Hoy oferta "a ciegas".
**Solución:** con las coords de las 5 localidades (ya las tenemos) + la dirección del vendedor, mostrar distancia aproximada y un precio sugerido. Sin exponer la dirección exacta hasta adjudicar.

## 9. Remis pago en efectivo: ¿cómo se cobra la comisión de la plataforma?
**Dónde:** `models/ViajeRemis.js` (`metodoPago: app|efectivo`, comisión `no_aplica` si es efectivo).
**Problema:** si el viaje se paga en efectivo, la plataforma **no retiene su comisión** en el momento. ¿Queda como deuda del conductor? Hay un `bloqueadoRemis` que sugiere un sistema de saldo adeudado, pero conviene verificar que el ciclo "efectivo → deuda → bloqueo si no paga" esté completo y sea cobrable.
**Solución:** confirmar el circuito de saldo adeudado del conductor (acumulación, aviso, bloqueo, cómo salda). Si no está cerrado, es plata que se pierde.

## 10. Stock: se descuenta al confirmar pago, pero ¿y si el pago se reembolsa?
**Dónde:** `routes/pagos.js` (descuenta stock al aprobar), reembolsos (inexistentes, ver #4).
**Problema:** si una orden se reembolsa/cancela post-pago, el stock descontado **no se repone** automáticamente.
**Solución:** al reembolsar/cancelar una orden pagada, `$inc` stock de vuelta (atómico) y `emitStockActualizado`.

## 11. Notificaciones: faltan las de Mensajes de chat
**Dónde:** `socketService.emitNuevoMensaje` emite el mensaje, pero no crea una `Notificacion` persistida con título tipo "Nuevo mensaje de X".
**Problema:** el chat avisa en vivo, pero si el usuario no está, no le queda nada en el centro de notificaciones ni push claro.
**Solución:** al recibir mensaje con el chat cerrado, `emitNotificacion(receptor, {tipo:'mensaje', titulo:'Nuevo mensaje de '+emisor, ...})` (con throttle para no spamear por cada línea).

## 12. Profesionales/Servicios: el cliente paga la suscripción del profesional — ¿y el trabajo en sí?
**Dónde:** modelo de Servicios (suscripción) + Job Board (bid).
**Problema potencial de lógica:** en Servicios "destacado" el cliente paga una **suscripción mensual** para acceder al profesional, pero **el pago del trabajo** (la changa) parece quedar fuera de la plataforma. Verificar que el flujo de cobro del trabajo esté claro (o que se asuma efectivo/acuerdo directo, y que eso esté comunicado).
**Solución:** documentar/explicitar en la UI qué se paga por la plataforma y qué se acuerda directo, para no generar expectativas falsas (ni problemas fiscales).

---

# 🟢 MEJORAS DE PRODUCTO (suben conversión / retención)

## 13. "Día rentable" → gamificación completa
Ya pusimos el contador del día. Subir la apuesta: **racha** (días seguidos activos), **meta diaria** ("te faltan $X para tu mejor día"), **ranking semanal** de comisionistas de cada localidad. Engancha como las apps de delivery.

## 14. Modo "primero que acepta" con precio sugerido inteligente
Calcular precio sugerido por distancia (coords de las 5 localidades) y mostrarlo en "Agarrar YA". Menos fricción, ofertas más justas, más cierres.

## 15. Cross-sell con el algoritmo de intención
Ya tenemos `PerfilInteres` + recomendaciones. Sumar: **"otros compraron también"** en el detalle de producto, y **"completá el envío con..."** en el carrito (productos de la misma tienda/ciudad para sumar al mismo viaje del comisionista).

## 16. Recompra y reposición
Para productos consumibles, recordatorio "¿se te está por acabar?" a los X días de la compra. Reusa el cron y el historial. Conversión casi asegurada.

## 17. Estado de "viaje del comisionista" en tiempo real para el comprador
Cuando el comisionista marca `en_transito`, mostrarle al comprador un mini-tracking ("en camino") como en Remis. Reduce ansiedad y reclamos.

## 18. Reputación que importa
Hoy la calificación ordena. Sumar **badges** (verificado, +50 viajes, responde rápido) y **tasa de cumplimiento** visible. Da confianza y premia a los buenos (ata con el acceso anticipado que ya implementamos).

---

# 🔒 SEGURIDAD / ROBUSTEZ (revisar)

- **Autorización fina en envíos en vivo:** `enviosEnVivoAbiertos` y las ofertas son por token, OK. Confirmar que un comisionista no pueda ofertar a órdenes de otra zona que no cubre (hoy puede ver todas las abiertas).
- **Rate limiting** en `ofertar`/`tomar` para evitar bots que barran todos los envíos.
- **Idempotencia** del webhook de MP: ya está para órdenes; confirmar que el broadcast de "en vivo" no se dispare dos veces si el webhook llega repetido (hoy `abrirEnvioEnVivo` es idempotente por estado, ✔️ — pero revisar la ruta de verificación al volver del checkout).
- **Datos en notificaciones:** las notificaciones en vivo llevan nombres de productos a comisionistas. OK para el negocio, pero no incluir datos personales del comprador hasta adjudicar (hoy no se incluyen, ✔️).

---

# 🧭 PLAN SUGERIDO (orden de ataque)

**Sprint 1 — Cerrar el ciclo (lo que más duele):**
1. Cierre del flujo en vivo (#1): estados + código + completar orden + reseña.
2. Exigir MP al ofertar/tomar (#2).
3. Validación de localidad en backend (#3).

**Sprint 2 — Plata sana:**
4. Reembolsos en disputas + reponer stock (#4, #10).
5. Confirmación de recepción del comprador (#5).
6. Recordatorio/auto-cierre de órdenes pagadas (#6).

**Sprint 3 — Crecer:**
7. Precio sugerido + techo del comprador (#7, #14).
8. Notificación de mensajes de chat (#11).
9. Gamificación del comisionista (#13) + tracking en vivo (#17).

---

## Nota sobre lo recién deployado (subasta en vivo)
Quedó andando: broadcast, tiempo real (socket + sonido + vibración), countdown, contador de competidores, "Agarrar YA" (claim atómico), acceso anticipado por ranking, día rentable, y push con app cerrada. **El hueco más urgente que dejó pendiente es el #1 (cierre del ciclo): sin código de entrega ni paso a `entregado`, el traslado en vivo no tiene final ni reseña.** Es lo primero que retomaría.

— Análisis generado mientras dormías. Cualquier punto lo bajamos a implementación cuando quieras.
