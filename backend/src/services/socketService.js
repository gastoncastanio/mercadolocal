import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { enviarPush } from './pushService.js'

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

    // El cliente envía su JWT (access token) para unirse a SU sala personal.
    // SEGURIDAD: verificamos el token en vez de confiar en un userId crudo,
    // así nadie puede suscribirse a la sala de otro usuario y espiar sus
    // eventos de pago/órdenes/notificaciones.
    socket.on('auth', (token) => {
      if (!token) return
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        socket.join(`user:${decoded.id}`)
        console.log(`👤 Usuario ${decoded.id} se unió a su sala (token verificado)`)
      } catch {
        console.warn('🚨 Socket auth rechazado: token inválido')
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

    // Radar del Centro: usuarios anónimos (sin JWT) se unen a la sala de su
    // ciudad para recibir alertas de "Liquidación Relámpago" en tiempo real.
    // No mandamos su ubicación: el server difunde las coords del comercio y el
    // cliente filtra por distancia localmente (modelo privacy-first del Radar).
    socket.on('radar:join', (ciudad) => {
      socket.join('radar:all')
      if (ciudad && typeof ciudad === 'string') {
        socket.join(`radar:${ciudad.trim().toLowerCase()}`)
      }
    })

    socket.on('radar:leave', (ciudad) => {
      socket.leave('radar:all')
      if (ciudad && typeof ciudad === 'string') {
        socket.leave(`radar:${ciudad.trim().toLowerCase()}`)
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
  // 1. Tiempo real para pestañas abiertas (WebSocket)
  if (io) {
    io.to(`user:${usuarioId}`).emit('notificacion', {
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      enlace: notificacion.enlace,
      timestamp: new Date()
    })
  }
  // 2. Web Push para cuando la app está cerrada (fire-and-forget)
  enviarPush(usuarioId, {
    tipo: notificacion.tipo,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    enlace: notificacion.enlace
  }).catch(() => {})
}

/**
 * Difunde una "Liquidación Relámpago" (botón anti-desperdicio del comercio) a
 * los usuarios del Radar. El payload lleva las coords del comercio y el radio;
 * cada cliente decide si vibrar/mostrar según SU distancia (la ubicación del
 * usuario nunca llega al server).
 *
 * Difundimos a `radar:all` y NO a una sala por-ciudad: el cliente es privacy-first
 * y no manda su ciudad al unirse (se une solo a `radar:all`), así que un broadcast
 * a `radar:${ciudad}` no le llegaría a nadie. La relevancia la garantiza el filtro
 * de distancia del cliente. `ciudad` queda como dato informativo/futuro.
 */
export function emitLiquidacionRelampago(ciudad, payload) {
  if (!io) return
  io.to('radar:all').emit('liquidacion:nueva', { ...payload, timestamp: new Date() })
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

/**
 * Notifica que hay un nuevo mensaje en una conversación (al receptor)
 */
export function emitNuevoMensaje(receptorId, mensaje) {
  if (!io) return
  io.to(`user:${receptorId}`).emit('mensaje:nuevo', {
    _id: mensaje._id,
    conversacionId: mensaje.conversacionId,
    emisorId: mensaje.emisorId,
    mensaje: mensaje.mensaje,
    imagenUrl: mensaje.imagenUrl,
    timestamp: mensaje.createdAt
  })
}
