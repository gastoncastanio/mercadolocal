import Usuario from '../models/Usuario.js'
import Tienda from '../models/Tienda.js'
import Orden from '../models/Orden.js'
import Favorito from '../models/Favorito.js'
import Carrito from '../models/Carrito.js'
import PerfilInteres from '../models/PerfilInteres.js'
import Comprobante from '../models/Comprobante.js'
import SolicitudLegal from '../models/SolicitudLegal.js'
import Producto from '../models/Producto.js'

/**
 * SERVICIO DE PRIVACIDAD Y DERECHOS DEL USUARIO
 *
 * Implementa los derechos de la Ley 25.326 (datos personales):
 *   - Acceso:    exportarDatos() arma un paquete con TODO lo que guardamos.
 *   - Supresión: anonimizarCuenta() despersonaliza al usuario conservando lo
 *                que la ley fiscal/contable obliga a guardar (órdenes, facturas).
 *   - Oposición: cambiarPreferencias() activa/desactiva el perfilado publicitario.
 *
 * Cada ejercicio de un derecho queda asentado en SolicitudLegal (auditoría).
 */

/**
 * Derecho de acceso: devuelve un objeto con todos los datos del usuario.
 * Incluye sus propios datos sensibles (es su derecho verlos), pero NO datos de
 * terceros.
 */
export async function exportarDatos(usuarioId) {
  const usuario = await Usuario.findById(usuarioId).select('+dni').lean()
  if (!usuario) throw new Error('Usuario no encontrado')

  // No exponer secretos de seguridad
  delete usuario.contraseña
  delete usuario.refreshTokens
  delete usuario.resetToken
  delete usuario.resetTokenExpira

  const [tienda, ordenes, favoritos, perfil, comprobantes, solicitudes] = await Promise.all([
    Tienda.findOne({ usuarioId }).lean(),
    Orden.find({ compradorId: usuarioId }).lean(),
    Favorito.find({ usuarioId }).populate('productoId', 'nombre precio').lean(),
    PerfilInteres.findOne({ usuarioId }).lean(),
    Comprobante.find({ $or: [{ vendedorId: usuarioId }, { compradorId: usuarioId }] }).lean(),
    SolicitudLegal.find({ usuarioId }).lean()
  ])

  // El perfil de interés (pauta inteligente) se entrega "legible": qué categorías
  // y ciudades infirió de la actividad. Es justamente lo que la ley quiere que el
  // usuario pueda ver.
  let perfilLegible = null
  if (perfil) {
    perfilLegible = {
      categoriasDeInteres: perfil.categorias || {},
      ciudadesDeInteres: perfil.ciudades || {},
      totalVistas: perfil.totalVistas,
      totalBusquedas: perfil.totalBusquedas,
      totalFavoritos: perfil.totalFavoritos,
      totalCompras: perfil.totalCompras,
      busquedasRecientes: perfil.busquedasRecientes || [],
      ultimaActividad: perfil.ultimaActividad
    }
  }

  return {
    generadoEl: new Date().toISOString(),
    aviso: 'Estos son todos los datos personales que Mercado Local tiene asociados a tu cuenta.',
    cuenta: usuario,
    tienda: tienda || null,
    compras: ordenes,
    favoritos,
    perfilDeInteresPublicitario: perfilLegible,
    comprobantes,
    solicitudesLegales: solicitudes
  }
}

/**
 * Derecho de supresión (baja de cuenta). Anonimiza los datos personales del
 * usuario pero conserva, desvinculadas, las órdenes y facturas (obligación de
 * conservación contable/fiscal, ~10 años).
 *
 * Borra: perfil de interés, favoritos y carrito (datos de comportamiento).
 * Desactiva: la tienda y sus productos si era vendedor.
 */
export async function anonimizarCuenta(usuarioId) {
  const usuario = await Usuario.findById(usuarioId)
  if (!usuario) throw new Error('Usuario no encontrado')
  if (usuario.rol === 'admin') {
    const e = new Error('Una cuenta de administrador no puede darse de baja desde acá.')
    e.code = 'ADMIN_NO_BAJA'
    throw e
  }

  const emailOriginal = usuario.email

  // 1. Despersonalizar la cuenta (conservamos el _id para no romper integridad
  //    referencial de órdenes/facturas, pero sin datos personales).
  await Usuario.updateOne(
    { _id: usuarioId },
    {
      $set: {
        nombre: 'Usuario dado de baja',
        email: `baja_${usuarioId}@anonimizado.local`,
        telefono: '',
        direccion: '',
        avatar: '',
        activo: false,
        anonimizado: true,
        anonimizadoEn: new Date(),
        refreshTokens: [],
        resetToken: null,
        resetTokenExpira: null,
        // contraseña random imposible de usar
        contraseña: `baja-${usuarioId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      },
      // Liberar el DNI (índice único sparse) y datos de perfilado
      $unset: { dni: '' }
    }
  )

  // 2. Borrar datos de comportamiento (no hay obligación de conservarlos)
  await Promise.all([
    PerfilInteres.deleteMany({ usuarioId }),
    Favorito.deleteMany({ usuarioId }),
    Carrito.deleteMany({ usuarioId })
  ])

  // 3. Si era vendedor: desactivar tienda y productos (sin borrar histórico)
  const tienda = await Tienda.findOne({ usuarioId })
  if (tienda) {
    await Tienda.updateOne({ _id: tienda._id }, { $set: { activo: false } })
    await Producto.updateMany({ tiendaId: tienda._id }, { $set: { activo: false } })
  }

  // 4. Asentar la supresión en auditoría
  await SolicitudLegal.create({
    usuarioId,
    emailContacto: emailOriginal,
    tipo: 'supresion',
    estado: 'resuelta',
    detalle: 'Baja de cuenta solicitada por el usuario. Datos personales anonimizados; órdenes y facturas conservadas por obligación fiscal.',
    resueltaEn: new Date()
  })

  return { ok: true }
}

/**
 * Derecho de oposición: activar/desactivar el perfilado para publicidad.
 * Si lo desactiva, además borramos el perfil de interés ya construido.
 */
export async function cambiarPreferencias(usuarioId, { perfilarPublicidad }) {
  const usuario = await Usuario.findById(usuarioId)
  if (!usuario) throw new Error('Usuario no encontrado')

  if (typeof perfilarPublicidad === 'boolean') {
    usuario.preferencias = usuario.preferencias || {}
    usuario.preferencias.perfilarPublicidad = perfilarPublicidad
    await usuario.save()

    // Si se opone, borramos el perfil ya construido (no sólo dejamos de escribir).
    if (perfilarPublicidad === false) {
      await PerfilInteres.deleteMany({ usuarioId })
    }

    await SolicitudLegal.create({
      usuarioId,
      emailContacto: usuario.email,
      tipo: 'oposicion',
      estado: 'resuelta',
      detalle: perfilarPublicidad
        ? 'El usuario habilitó el perfilado para publicidad.'
        : 'El usuario se opuso al perfilado para publicidad. Se borró su perfil de interés.',
      resueltaEn: new Date()
    })
  }

  return usuario.preferencias || { perfilarPublicidad: true }
}

/**
 * Registra una solicitud genérica (acceso, arrepentimiento, queja) en auditoría.
 */
export async function registrarSolicitud({ usuarioId, emailContacto, tipo, detalle, ordenId, estado }) {
  return await SolicitudLegal.create({
    usuarioId: usuarioId || null,
    emailContacto: emailContacto || '',
    tipo,
    detalle: detalle || '',
    ordenId: ordenId || null,
    estado: estado || 'recibida'
  })
}
