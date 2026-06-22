import Tienda from '../models/Tienda.js'
import Usuario from '../models/Usuario.js'
import { validarPublicacion, construirMensajeRechazo } from '../utils/validacionContenido.js'

/**
 * Valida contenido público de la tienda (nombre + descripcion).
 * IMPORTANTE: el campo `telefono` NO se valida porque es legítimo —
 * se le muestra al comprador SOLO después de concretarse la venta.
 */
function validarContenidoTienda(datos) {
  const validacion = validarPublicacion({
    titulo: datos.nombre,
    descripcion: datos.descripcion
  })
  if (!validacion.valido) {
    const error = new Error(construirMensajeRechazo(validacion.motivos))
    error.code = 'CONTENIDO_INVALIDO'
    throw error
  }
}

// Crear tienda
export async function crearTienda(usuarioId, datos) {
  const existente = await Tienda.findOne({ usuarioId })
  if (existente) {
    throw new Error('Ya tienes una tienda creada')
  }

  // Validar nombre + descripción públicas (NO telefono — ese campo es legítimo)
  validarContenidoTienda(datos)

  const tienda = new Tienda({
    usuarioId,
    nombre: datos.nombre,
    descripcion: datos.descripcion || '',
    logo: datos.logo || '',
    ciudad: datos.ciudad,
    tipo: datos.tipo || 'online',
    telefono: datos.telefono || ''
  })

  await tienda.save()

  // Actualizar el usuario para indicar que tiene tienda
  await Usuario.findByIdAndUpdate(usuarioId, { tieneVendedor: true })

  return tienda
}

// Obtener tienda por ID
export async function obtenerTienda(tiendaId) {
  const tienda = await Tienda.findById(tiendaId).populate('usuarioId', 'nombre email')
  if (!tienda) throw new Error('Tienda no encontrada')
  return tienda
}

// Obtener tienda del usuario
export async function obtenerMiTienda(usuarioId) {
  const tienda = await Tienda.findOne({ usuarioId })
  return tienda
}

// Actualizar tienda
export async function actualizarTienda(usuarioId, datos) {
  // Validar nombre + descripción si fueron editados
  if (datos.nombre !== undefined || datos.descripcion !== undefined) {
    validarContenidoTienda(datos)
  }

  const tienda = await Tienda.findOneAndUpdate(
    { usuarioId },
    {
      nombre: datos.nombre,
      nombreCorto: datos.nombreCorto,
      descripcion: datos.descripcion,
      logo: datos.logo,
      ciudad: datos.ciudad,
      tipo: datos.tipo,
      telefono: datos.telefono
    },
    { new: true }
  )

  if (!tienda) throw new Error('Tienda no encontrada')
  return tienda
}

// Listar todas las tiendas activas
export async function listarTiendas() {
  return await Tienda.find({ activo: true }).populate('usuarioId', 'nombre')
}

// Vidriera de marcas: tiendas oficiales (marca verificada) activas.
export async function listarTiendasOficiales() {
  return await Tienda.find({ activo: true, oficial: true })
    .select('nombre marca logo ciudad calificacion oficial oficialDesde')
    .sort({ oficialDesde: -1, calificacion: -1 })
    .lean()
}

// Admin: marca/desmarca una tienda como Oficial (marca verificada).
export async function marcarTiendaOficial(tiendaId, { oficial, marca }) {
  const tienda = await Tienda.findById(tiendaId)
  if (!tienda) throw new Error('Tienda no encontrada')
  tienda.oficial = !!oficial
  if (marca !== undefined) tienda.marca = String(marca || '').trim()
  tienda.oficialDesde = tienda.oficial ? (tienda.oficialDesde || new Date()) : null
  if (!tienda.oficial) tienda.marca = ''
  await tienda.save()
  return tienda
}
