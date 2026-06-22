# Análisis: Notificaciones Faltantes en MercadoLocal

## Estado Actual: Qué Funciona Bien

El servicio **Remis** tiene la implementación más completa de notificaciones. Se usa como **benchmark** para los demás.

### Remis: Notificaciones en TODO el Flujo
```
Pasajero:
  ✅ "Solicitar remis" → notificación de búsqueda iniciada
  ✅ Conductor acepta → notificación "Tu conductor está en camino"
  ✅ Conductor llega → notificación "Tu conductor llegó"
  ✅ Viaje finalizado → notificación "Viaje completado"
  ✅ Calificación → notificación de reseña recibida

Conductor:
  ✅ Solicitud nueva → notificación "Nueva solicitud"
  ✅ Pasajero confirma → notificación "Viaje confirmado"
  ✅ Viaje completado → notificación "Ganaste $X"
  ✅ Calificación → notificación de reseña recibida
```

**Dónde está bien:** `remisService.js` emite notificaciones en cada transición de estado.

---

## Brecha 1: Órdenes de Compra (Compra-Venta)

### Estado Actual
**Servicio:** `ordenService.js`
**Notificaciones:** ❌ CERO

### Qué Falta
```
COMPRADOR:
  ❌ "He completado el pago" → debería notificar al vendedor
  ❌ "Recibí el producto" → marcar completada
  ❌ "El vendedor marcó enviado" → notificación de estado
  ❌ "Producto entregado" → confirmación final

VENDEDOR:
  ❌ "Nueva compra recibida" (en mi tienda) → hoy no notifica
  ❌ "Pago confirmado" → debería avisar de inmediato
  ❌ "Comprador marcó recibido" → notificación
  ❌ "Sobreventa detectada" → aviso urgente de falta de stock
```

### Impacto Comercial
- Vendedores pierden ordenes porque no se enteran de las compras (confían en ver el panel)
- Compradores no reciben feedback de cambios de estado
- NO hay urgencia visual para que el vendedor despacha rápido

### Solución Necesaria
Agregar notificaciones en `ordenService.js`:
```javascript
// Función central
export async function notificarOrdenEstado(orden, nuevoEstado, esComprador = false)

// Llamarla en:
- crearOrden() → vendedor notificado
- confirmarPago() → ambos notificados
- cambiarEstado('enviada') → comprador notificado
- cambiarEstado('completada') → vendedor notificado
```

---

## Brecha 2: Pagos en MercadoPago

### Estado Actual
**Servicio:** `mercadoPagoService.js`
**Notificaciones:** ❌ CERO (solo logs)

### Qué Falta
```
COMPRADOR:
  ❌ "Tu pago fue rechazado" → notificación de error
  ❌ "Tu pago está pendiente revisión" → notificación de espera
  ❌ "Pago aprobado" → confirmación (ahora solo lo ve en orden)

VENDEDOR:
  ❌ "Pago recibido en tu cuenta" → notificación de dinero
  ❌ "Comisión retenida: $X" → transparencia de tarifas
  ❌ "Pago pendiente (falta webhook)" → aviso de sincronización

ADMIN:
  ❌ "Pago fraudulento detectado" → alerta de seguridad
```

### Impacto Comercial
- Comprador no sabe si su pago fue exitoso hasta que entra al panel
- Vendedor no se entera de pagos confirmados (crítico para cash flow)
- No hay alertas de pagos en disputa o rechazados

### Solución Necesaria
Wrapper de notificaciones en `mercadoPagoService.js`:
```javascript
export async function notificarPagoEstatus(pago, estado) {
  // Llamar después de cada confirmación/fallo de MP
}

// Usar en webhook y verificación de pago
```

---

## Brecha 3: Reseñas

### Estado Actual
**Servicio:** `resenaService.js`
**Notificaciones:** ❌ CERO

### Qué Falta
```
VENDEDOR:
  ❌ "Recibiste una reseña de 5⭐" → notificación positiva
  ❌ "Recibiste una reseña de 1⭐" → alerta negativa
  ❌ "Se escribió una respuesta a tu reseña" → seguimiento
  ❌ "Tu calificación bajó" → notificación de cambio

COMPRADOR:
  ❌ "El vendedor respondió a tu reseña" → notificación de diálogo
  ❌ "Tu reseña fue marcada útil por N personas" → gamificación
```

### Impacto Comercial
- Vendedor no se entera de reseñas negativas hasta que chequea el perfil
- No hay urgencia para responder a reseñas malas (muy importante para reputación)
- Comprador no ve que el vendedor respondió

### Solución Necesaria
Agregar en `resenaService.js`:
```javascript
export async function crearResena() {
  // ... código actual ...
  emitNotificacion(vendedorId, {
    tipo: 'resena',
    titulo: `Reseña de ${calificacion}⭐`,
    mensaje: comentario.slice(0, 100),
    enlace: `/perfil/${compradorId}`
  })
}
```

---

## Brecha 4: Facturas y Comprobantes

### Estado Actual
**Servicio:** `facturacionService.js`, `comprobantesService.js`
**Notificaciones:** ❌ CERO

### Qué Falta
```
VENDEDOR:
  ❌ "Factura emitida" → confirmación
  ❌ "Factura enviada a ARCA" → confirmación fiscal
  ❌ "Error en facturación" → alerta crítica
  ❌ "Comprobante rechazado por AFIP" → acción requerida

COMPRADOR:
  ❌ "Tu factura está lista" → notificación
  ❌ "Factura enviada a tu email" → confirmación de envío
```

### Impacto Comercial
- Vendedor no sabe si sus comprobantes se enviaron a ARCA (problema fiscal)
- Comprador no sabe que su factura se emitió
- Sin alertas de errores, vendedor puede no detectar problemas fiscales

### Solución Necesaria
```javascript
// En facturacionService.js
emitNotificacion(vendedorId, {
  tipo: 'comprobante',
  titulo: 'Factura emitida',
  mensaje: `Factura C por $${monto} a ARCA`,
  enlace: '/mis-comprobantes'
})
```

---

## Brecha 5: Disputas (Chargebacks/Conflictos)

### Estado Actual
**Servicio:** `disputaService.js`
**Notificaciones:** ❌ CERO

### Qué Falta
```
AMBAS PARTES:
  ❌ "Se inició una disputa" → notificación crítica
  ❌ "Se agregó evidencia" → notificación de nuevo mensaje
  ❌ "Disputa resuelta" → notificación de resultado
  ❌ "Plazo vence en 3 días" → recordatorio urgente

ADMIN:
  ❌ "Nueva disputa" → alerta para moderadores
  ❌ "Disputa escalada" → crítica
```

### Impacto Comercial
- Comprador/vendedor no se entera de disputas activas
- Plazo de respuesta se vence silenciosamente
- Admin no ve nuevas disputas en tiempo real

### Solución Necesaria
```javascript
export async function crearDisputa() {
  emitNotificacion(vendedorId, {
    tipo: 'disputa',
    titulo: 'Nueva disputa iniciada',
    mensaje: 'El comprador iniciò una disputa. Respondé en 72 horas.',
    enlace: `/disputas/${disputa._id}`
  })
}
```

---

## Brecha 6: Tienda (Cambios y Eventos)

### Estado Actual
**Servicio:** `tiendaService.js`
**Notificaciones:** ❌ CERO

### Qué Falta
```
VENDEDOR:
  ❌ "Tu tienda fue desactivada" → aviso crítico
  ❌ "Tu tienda fue reactivada" → confirmación
  ❌ "Revisión de tienda completada" → resultado
  ❌ "Cambio de horarios guardado" → confirmación

ADMIN:
  ❌ "Tienda sospechosa detectada" → alerta
  ❌ "Tienda reportada" → alerta de moderación
```

### Solución Necesaria
```javascript
export async function actualizarTienda(tiendaId, datos) {
  if (datos.activo !== vieja.activo) {
    emitNotificacion(vendedorId, {
      tipo: 'tienda',
      titulo: datos.activo ? 'Tienda activada' : 'Tienda desactivada',
      enlace: '/mi-tienda'
    })
  }
}
```

---

## Brecha 7: Productos

### Estado Actual
**Servicio:** `productoService.js`
**Notificaciones:** ❌ CERO

### Qué Falta
```
VENDEDOR:
  ❌ "Producto sin stock" → alerta para reabastecer
  ❌ "Producto fue publicado" → confirmación
  ❌ "Producto fue despublicado" → confirmación
  ❌ "Producto tiene muchas vistas" → notificación positiva
  ❌ "Producto marcado como oferta" → confirmación

COMPRADOR:
  ❌ "El producto que viste volvió a estar disponible" → notificación de retorno
  ❌ "El precio bajó" → notificación de cambio
```

### Solución Necesaria
```javascript
export async function cambiarDisponibilidad(productoId, disponible) {
  if (!disponible) {
    emitNotificacion(vendedorId, {
      tipo: 'producto',
      titulo: 'Producto sin stock',
      mensaje: `"${producto.nombre}" necesita reabastecimiento`,
      enlace: `/productos/${productoId}`
    })
  }
}
```

---

## Brecha 8: Carrito Abandonado

### Estado Actual
**Servicio:** `carritoService.js`
**Notificaciones:** ❌ CERO (hay una función de email pero sin socket notifications)

### Qué Falta
```
COMPRADOR:
  ❌ Recordatorio de carrito: "Tu carrito expira en 24hs"
  ❌ Después de 7 días: "Recupera tu compra"

VENDEDOR:
  ❌ "Carrito abandonado" → hoy ve solo en panel
  ❌ Después de 14 días: "Cliente no completó compra"
```

### Solución Necesaria
```javascript
// Llamar en Cron (cada 6 horas)
export async function notificarCartosAbandonados() {
  const cartosViejos = await Carrito.find({
    estado: 'abierto',
    updatedAt: { $lt: hace_24_horas }
  })
  
  cartosViejos.forEach(c => {
    emitNotificacion(c.compradorId, {
      tipo: 'carrito',
      titulo: 'Tu carrito expira en 24hs',
      enlace: '/carrito'
    })
  })
}
```

---

## Brecha 9: Ofertas Compartidas

### Estado Actual
**Servicio:** `ofertaCompartidaService.js`
**Notificaciones:** ✅ PARCIAL (tiene algunas, pero incompletas)

### Qué Falta
```
COMPRADOR:
  ⚠️ "Tu amigo compartió una oferta" → tiene notificación pero falta deeplink
  ⚠️ "La oferta que compartiste fue vista" → no existe
  ✅ "Oferta expirada" → existe

VENDEDOR:
  ❌ "Tu oferta fue compartida N veces" → analytics
```

### Solución Necesaria
```javascript
// Ya existe, pero mejorar deeplinks
export async function compartirOferta() {
  emitNotificacion(amigo._id, {
    tipo: 'oferta_compartida',
    titulo: `${usuarioId.nombre} compartió una oferta`,
    enlace: `/oferta/${ofertaId}` // Agregrar esto
  })
}
```

---

## Resumen de Prioridades

### 🔴 CRÍTICO (Impacto Alto, Afecta Monetización)
1. **Órdenes de Compra** - Vendedor no se entera de ventas
2. **Pagos en MercadoPago** - Vendedor no sabe si cobró
3. **Disputas** - Riesgo legal, plazos se vencen silenciosamente

### 🟡 IMPORTANTE (Experiencia de Usuario)
4. **Reseñas** - Vendedor no puede responder rápido a críticas
5. **Facturas** - Riesgo fiscal (ARCA)
6. **Carrito Abandonado** - Recuperación de ventas perdidas

### 🟢 ÚTIL (Mejora de Engagement)
7. **Tienda** - Cambios y estados
8. **Productos** - Stock y cambios de precio
9. **Ofertas Compartidas** - Mejorar deeplinks

---

## Implementación Recomendada

### Fase 1 (Esta semana) - Crítico
- ✅ `ordenService.js`: Notificación al vendedor de venta + al comprador de cambios de estado
- ✅ `mercadoPagoService.js`: Notificación de pago confirmado a ambas partes
- ✅ `disputaService.js`: Notificación de disputa iniciada

### Fase 2 (Próxima semana) - Importante
- `resenaService.js`: Reseña recibida + respuesta
- `facturacionService.js`: Comprobante enviado a ARCA
- Cron de carritos abandonados

### Fase 3 (Luego) - Mejora
- `tiendaService.js`, `productoService.js`, deeplinks en ofertas

---

## Notas Técnicas

### Patrón a Seguir (de Remis)
```javascript
// Usar esta estructura en TODO servicio:
emitNotificacion(usuarioId.toString(), {
  tipo: 'servicio',           // 'venta', 'pago', 'disputa', etc.
  titulo: 'Texto corto',
  mensaje: 'Descripción más larga',
  enlace: '/ruta-a-accion'
})
```

### Problema Actual: Notificaciones Sin Descripción en Celular
El usuario reportó: "marca el número de notificaciones pero no explica de qué es"

**Solución:** Ir a `pushService.js` y mejorar `titulo` + agregar descripción en el payload de push.

Ahora título y mensaje van al telefóno, pero falta incluir más contexto en el título:
```javascript
// Hoy: "Tienes 3 notificaciones"
// Ideal: "Venta confirmada, Pago aprobado, Reseña recibida"
```

---

## Conclusión

**5 de 40+ servicios tienen notificaciones.** Es la razón por la que los usuarios pierden pedidos, no se enteras de pagos, y no responden a reseñas.

Implementar este plan hará que MercadoLocal sea **el 10x más reactivo** que hoy.
