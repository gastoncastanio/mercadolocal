import Tienda from '../models/Tienda.js'

// Crear tienda
export async function crearTienda(usuarioId, datos) {
  const existente = await Tienda.findOne({ usuarioId })
  if (existente) {
    throw new Error('Ya tienes una tienda creada')
  }

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
  const tienda = await Tienda.findOneAndUpdate(
    { usuarioId },
    {
      nombre: datos.nombre,
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
