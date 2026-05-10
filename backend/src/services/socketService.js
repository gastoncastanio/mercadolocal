import { Server } from 'socket.io'

let io = null

/**
 * Inicializa Socket.IO con el servidor HTTP
 */
export function initSocket(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins || ['http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  })

  io.on('connection', (socket) => {
    console.log(`🔌 WebSocket conectado: ${socket.id}`)

    // El cliente envía su userId para unirse a su sala personal
    socket.on('auth', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`)
        console.log(`👤 Usuario ${userId} se unió a su sala`)
      }
    })

    // El cliente puede unirse a la sala de un producto para ver stock en tiempo real
    socket.on('watch:producto', (productoId) => {
      if (productoId) {
        socket.join(`producto:${productoId}`)
      }
    })

    socket.on('unwatch:producto', (productoId) => {
      if (productoId) {
        socket.leave(`producto:${productoId}`)
      }
    })

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket desconectado: ${socket.id}`)
    })
  })

  console.log('⚡ WebSocket (Socket.IO) inicializado')
  return io
}

/**
 * Obtiene la instancia de Socket.IO
 */
export function getIO() {
  return io
}

// ==========================================
// EMISORES DE EVENTOS
// ==========================================

/**
 * Notifica a un usuario específico que tiene una nueva notificación
 */
export function emitNotificacion(usuarioId, notificacion) {
  if (!io) return
  io.to(`user:${usuarioId}`).emit('notificacion', {
    tipo: notificacion.tipo,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    enlace: notificacion.enlace,
    timestamp: new Date()
  })
}

/**
 * Notifica que un pago fue aprobado (al comprador y vendedores)
 */
export function emitPagoAprobado(compradorId, orden) {
  if (!io) return
  io.to(`user:${compradorId}`).emit('pago:aprobado', {
    ordenId: orden._id,
    total: orden.total,
    timestamp: new Date()
  })
}

/**
 * Notifica que una venta fue confirmada (al vendedor)
 */
export function emitVentaConfirmada(vendedorId, data) {
  if (!io) return
  io.to(`user:${vendedorId}`).emit('venta:confirmada', {
    total: data.total,
    cantidadItems: data.cantidadItems,
    timestamp: new Date()
  })
}

/**
 * Actualiza el stock de un producto en tiempo real para todos los que lo están viendo
 */
export function emitStockActualizado(productoId, nuevoStock) {
  if (!io) return
  io.to(`producto:${productoId}`).emit('stock:actualizado', {
    productoId,
    stock: nuevoStock
  })
  // También emitir a todos (para catálogo, landing, etc)
  io.emit('producto:stockCambio', { productoId, stock: nuevoStock })
}

/**
 * Notifica que se publicó un nuevo producto (a todos)
 */
export function emitNuevoProducto(producto) {
  if (!io) return
  io.emit('producto:nuevo', {
    id: producto._id,
    nombre: producto.nombre,
    precio: producto.precio,
    imagen: producto.imagenes?.[0] || null,
    timestamp: new Date()
  })
}

/**
 * Notifica que se creó una nueva tienda (a todos)
 */
export function emitNuevaTienda(tienda) {
  if (!io) return
  io.emit('tienda:nueva', {
    id: tienda._id,
    nombre: tienda.nombre,
    timestamp: new Date()
  })
}

/**
 * Actualiza las estadísticas globales en tiempo real
 */
export function emitStatsActualizados(stats) {
  if (!io) return
  io.emit('stats:actualizado', stats)
}

/**
 * Notifica cambio de estado de una orden
 */
export function emitOrdenEstado(compradorId, ordenId, nuevoEstado) {
  if (!io) return
  io.to(`user:${compradorId}`).emit('orden:estado', {
    ordenId,
    estado: nuevoEstado,
    timestamp: new Date()
  })
}

/**
 * Notifica que un producto fue actualizado (a todos los clientes conectados)
 */
export function emitProductoActualizado(producto) {
  if (!io) return
  io.emit('producto:actualizado', {
    id: producto._id,
    nombre: producto.nombre,
    precio: producto.precio,
    stock: producto.stock,
    imagenes: producto.imagenes,
    descripcion: producto.descripcion,
    categorias: producto.categorias,
    activo: producto.activo,
    timestamp: new Date()
  })
  // Tambien emitir a la sala especifica del producto
  io.to(`producto:${producto._id}`).emit('producto:detalleActualizado', producto)
}

/**
 * Notifica que un producto fue eliminado/desactivado
 */
export function emitProductoEliminado(productoId) {
  if (!io) return
  io.emit('producto:eliminado', {
    id: productoId,
    timestamp: new Date()
  })
}

/**
 * Notifica que la configuracion del sitio cambio (admin actualizo CMS)
 */
export function emitConfigActualizada(cambios) {
  if (!io) return
  io.emit('config:actualizado', {
    cambios, // array de { clave, valor }
    timestamp: new Date()
  })
}

/**
 * Notifica que la tienda fue actualizada (logo, nombre, etc)
 */
export function emitTiendaActualizada(tienda) {
  if (!io) return
  io.emit('tienda:actualizada', {
    id: tienda._id,
    nombre: tienda.nombre,
    logo: tienda.logo,
    descripcion: tienda.descripcion,
    timestamp: new Date()
  })
}
