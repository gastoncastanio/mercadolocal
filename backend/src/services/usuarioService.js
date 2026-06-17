import Usuario from '../models/Usuario.js'
import Tienda from '../models/Tienda.js'
import Notificacion from '../models/Notificacion.js'
import { generarAccessToken, generarRefreshToken } from '../middleware/auth.js'
import { enviarBienvenida } from './emailService.js'

// Registrar nuevo usuario
export async function registrarUsuario(datos) {
  const { email, contraseña, nombre, direccion, telefono, dni } = datos

  // Verificar si ya existe
  const existente = await Usuario.findOne({ email })
  if (existente) {
    throw new Error('Ya existe una cuenta con este email')
  }

  // Crear usuario (cuenta unificada: siempre comprador por default).
  // La capacidad de vender se activa después abriendo una tienda.
  const usuario = new Usuario({
    email,
    contraseña,
    nombre,
    rol: 'comprador',
    direccion: direccion || '',
    telefono: telefono || '',
    dni: dni || ''
  })

  // Si vienen datos de tienda en el registro, se abre la tienda y se marca tieneVendedor
  const quiereTienda = !!datos.nombreTienda

  await usuario.save()

  // Notificar a todos los admins del nuevo registro
  try {
    const admins = await Usuario.find({ rol: 'admin' }).select('_id')
    for (const admin of admins) {
      await new Notificacion({
        usuarioId: admin._id,
        tipo: 'sistema',
        titulo: 'Nuevo usuario registrado',
        mensaje: `${nombre} (${email}) cre\u00f3 una cuenta`,
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

  // Email de bienvenida
  try {
    await enviarBienvenida(email, nombre, 'comprador')
  } catch (e) {
    console.error('Error enviando email de bienvenida:', e.message)
  }

  // Si pidió abrir tienda en el registro, crearla y marcar tieneVendedor
  let tienda = null
  if (quiereTienda) {
    tienda = new Tienda({
      usuarioId: usuario._id,
      nombre: datos.nombreTienda,
      descripcion: datos.descripcionTienda || '',
      ciudad: datos.ciudad || '',
      tipo: datos.tipoTienda || 'online'
    })
    await tienda.save()
    usuario.tieneVendedor = true
    await usuario.save()
  }

  const token = generarAccessToken(usuario)
  const refreshToken = await generarRefreshToken(usuario._id)

  return {
    usuario: usuario.toJSON(),
    tienda,
    token,
    refreshToken
  }
}

// Login
export async function loginUsuario(email, contraseña) {
  const usuario = await Usuario.findOne({ email })
  if (!usuario) {
    // Diagnóstico (solo en logs del server, no se expone al cliente): el email
    // no corresponde a ninguna cuenta. Suele ser un typo o un email distinto al
    // que se usó para registrarse/resetear.
    console.warn(`🔍 Login: NO existe ninguna cuenta con el email "${email}"`)
    throw new Error('Email o contraseña incorrectos')
  }

  if (!usuario.activo) {
    throw new Error('Cuenta desactivada. Contacta al administrador.')
  }

  const contraseñaValida = await usuario.compararContraseña(contraseña)
  if (!contraseñaValida) {
    // Diagnóstico (solo logs): la cuenta SÍ existe pero la contraseña no
    // coincide con el hash guardado. Si esto pasa justo después de un reset
    // "exitoso", el problema está en el guardado de la contraseña, no acá.
    console.warn(`🔍 Login: la cuenta "${email}" existe pero la contraseña NO coincide con el hash guardado`)
    throw new Error('Email o contraseña incorrectos')
  }

  const token = generarAccessToken(usuario)
  const refreshToken = await generarRefreshToken(usuario._id)

  // Cuenta unificada: siempre buscamos si tiene tienda (null si no tiene)
  const tienda = await Tienda.findOne({ usuarioId: usuario._id })

  return {
    usuario: usuario.toJSON(),
    tienda,
    token,
    refreshToken
  }
}

// Obtener perfil del usuario
export async function obtenerPerfil(usuarioId) {
  const usuario = await Usuario.findById(usuarioId)
  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }

  // Cuenta unificada: siempre buscamos si tiene tienda (null si no tiene)
  const tienda = await Tienda.findOne({ usuarioId: usuario._id })

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
