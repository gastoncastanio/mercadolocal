import SeguidorTienda from '../models/SeguidorTienda.js'
import { emitNotificacion } from './socketService.js'

/**
 * Avisa a los seguidores de una tienda que publicó un producto nuevo.
 * Le da sentido al botón "Seguir": la persona se entera de las novedades de las
 * marcas que sigue (centro de notificaciones + push + tiempo real).
 *
 * Es async y tolerante a fallos: NUNCA debe bloquear ni romper la publicación.
 */
export async function notificarSeguidoresNuevoProducto(tienda, producto) {
  try {
    if (!tienda?._id || !producto?._id) return
    const seguidores = await SeguidorTienda.find({ tiendaId: tienda._id }).select('usuarioId').lean()
    if (!seguidores.length) return

    const nombreTienda = tienda.nombreCorto || tienda.nombre
    for (const s of seguidores) {
      // No le avisamos al propio dueño de la tienda si se sigue a sí mismo.
      if (tienda.usuarioId && s.usuarioId?.toString() === tienda.usuarioId.toString()) continue
      emitNotificacion(s.usuarioId.toString(), {
        tipo: 'tienda_novedad',
        titulo: `🏪 ${nombreTienda} publicó algo nuevo`,
        mensaje: producto.nombre,
        enlace: `/producto/${producto._id}`
      })
    }
    console.log(`🔔 Aviso a seguidores de "${nombreTienda}": "${producto.nombre}" (${seguidores.length})`)
  } catch (e) {
    console.warn('No se pudo avisar a los seguidores:', e.message)
  }
}
