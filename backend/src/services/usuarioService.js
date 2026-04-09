import Usuario from '../models/Usuario.js'
import Tienda from '../models/Tienda.js'
import Notificacion from '../models/Notificacion.js'
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

  // Notificar a todos los admins del nuevo registro
  try {
    const admins = await Usuario.find({ rol: 'admin' }).select('_id')
    const rolLabel = (rol || 'comprador') === 'vendedor' ? 'vendedor' : 'comprador'
    for (const admin of admins) {
      await new Notificacion({
        usuarioId: admin._id,
        tipo: 'sistema',
        titulo: `Nuevo ${rolLabel} registrado`,
        mensaje: `${nombre} (${email}) se registr\u00f3 como ${rolLabel}`,
        enlace: '/admin'
      }).save()
    }
  } catch (e) {
    console.error('Error creando notificaci\u00f3n de registro:', e.message)
  }

  // Notificaci\u00f3n de bienvenida al usuario
  try {
    await new Notificacion({
      usuarioId: usuario._id,
      tipo: 'sistema',
      titulo: '\u00a1Bienvenido a MercadoLocal!',
      mensaje: 'Tu cuenta fue creada con \u00e9xito. Explor\u00e1 el cat\u00e1logo y comenz\u00e1 a comprar.',
      enlace: '/catalogo'
    }).save()
  } catch (e) {
    console.error('Error creando notificaci\u00f3n de bienvenida:', e.message)
  }

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
