import Usuario from '../models/Usuario.js'
import Tienda from '../models/Tienda.js'
import { generarToken } from '../middleware/auth.js'

// Registrar nuevo usuario
export async function registrarUsuario(datos) {
  const { email, contraseña, nombre, rol, direccion, telefono } = datos

  // Verificar si ya existe
  const existente = await Usuario.findOne({ email })
  if (existente) {
    throw new Error('Ya existe una cuenta con este email')
  }

  // Crear usuario
  const usuario = new Usuario({
    email,
    contraseña,
    nombre,
    rol: rol || 'comprador',
    direccion: direccion || '',
    telefono: telefono || ''
  })

  await usuario.save()

  // Si es vendedor, crear tienda
  let tienda = null
  if (usuario.rol === 'vendedor' && datos.nombreTienda) {
    tienda = new Tienda({
      usuarioId: usuario._id,
      nombre: datos.nombreTienda,
      descripcion: datos.descripcionTienda || '',
      ciudad: datos.ciudad || '',
      tipo: datos.tipoTienda || 'online'
    })
    await tienda.save()
  }

  const token = generarToken(usuario)

  return {
    usuario: usuario.toJSON(),
    tienda,
    token
  }
}

// Login
export async function loginUsuario(email, contraseña) {
  const usuario = await Usuario.findOne({ email })
  if (!usuario) {
    throw new Error('Email o contraseña incorrectos')
  }

  if (!usuario.activo) {
    throw new Error('Cuenta desactivada. Contacta al administrador.')
  }

  const contraseñaValida = await usuario.compararContraseña(contraseña)
  if (!contraseñaValida) {
    throw new Error('Email o contraseña incorrectos')
  }

  const token = generarToken(usuario)

  // Si es vendedor, obtener su tienda
  let tienda = null
  if (usuario.rol === 'vendedor') {
    tienda = await Tienda.findOne({ usuarioId: usuario._id })
  }

  return {
    usuario: usuario.toJSON(),
    tienda,
    token
  }
}

// Obtener perfil del usuario
export async function obtenerPerfil(usuarioId) {
  const usuario = await Usuario.findById(usuarioId)
  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }

  let tienda = null
  if (usuario.rol === 'vendedor') {
    tienda = await Tienda.findOne({ usuarioId: usuario._id })
  }

  return {
    usuario: usuario.toJSON(),
    tienda
  }
}

// Actualizar perfil
export async function actualizarPerfil(usuarioId, datos) {
  const camposPermitidos = ['nombre', 'direccion', 'telefono', 'avatar']
  const actualizacion = {}

  for (const campo of camposPermitidos) {
    if (datos[campo] !== undefined) {
      actualizacion[campo] = datos[campo]
    }
  }

  const usuario = await Usuario.findByIdAndUpdate(
    usuarioId,
    actualizacion,
    { new: true }
  )

  return usuario.toJSON()
}
