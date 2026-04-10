import { Router } from 'express'
import crypto from 'crypto'
import { registrarUsuario, loginUsuario, obtenerPerfil, actualizarPerfil } from '../services/usuarioService.js'
import { verificarToken } from '../middleware/auth.js'
import Usuario from '../models/Usuario.js'
import { enviarCodigoRecuperacion } from '../services/emailService.js'

const router = Router()

// Sanitizar strings: remover HTML y caracteres peligrosos
function sanitizar(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/[<>]/g, '') // Remover tags HTML
    .replace(/javascript:/gi, '') // Remover javascript:
    .replace(/on\w+=/gi, '') // Remover event handlers
    .trim()
}

// Validar formato de email
function emailValido(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return regex.test(email)
}

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  try {
    let { email, contraseña, nombre, rol, direccion, telefono, dni, nombreTienda, descripcionTienda, ciudad, tipoTienda, mayorDeEdad, aceptaTerminos } = req.body

    // Validaciones estrictas
    if (!email || !contraseña || !nombre) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' })
    }

    // Validar declaración de mayoría de edad y aceptación de términos
    // Validar DNI
    if (!dni) {
      return res.status(400).json({ error: 'El DNI es obligatorio' })
    }
    const dniLimpio = dni.replace(/\D/g, '')
    if (dniLimpio.length < 7 || dniLimpio.length > 8) {
      return res.status(400).json({ error: 'El DNI debe tener 7 u 8 dígitos' })
    }
    // Verificar DNI no duplicado
    const dniExistente = await Usuario.findOne({ dni: dniLimpio })
    if (dniExistente) {
      return res.status(400).json({ error: 'Ya existe una cuenta registrada con este DNI' })
    }

    if (!mayorDeEdad) {
      return res.status(400).json({ error: 'Debés declarar que sos mayor de 18 años' })
    }
    if (!aceptaTerminos) {
      return res.status(400).json({ error: 'Debés aceptar los Términos y Condiciones' })
    }

    // Sanitizar inputs
    email = sanitizar(email).toLowerCase()
    nombre = sanitizar(nombre)
    direccion = sanitizar(direccion || '')
    telefono = sanitizar(telefono || '')
    nombreTienda = sanitizar(nombreTienda || '')
    descripcionTienda = sanitizar(descripcionTienda || '')
    ciudad = sanitizar(ciudad || '')

    // Validar email
    if (!emailValido(email)) {
      return res.status(400).json({ error: 'Email no válido' })
    }

    // Validar contraseña
    if (contraseña.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    if (contraseña.length > 128) {
      return res.status(400).json({ error: 'Contraseña demasiado larga' })
    }

    // Validar nombre
    if (nombre.length > 100) {
      return res.status(400).json({ error: 'Nombre demasiado largo' })
    }

    // Validar rol
    const rolesValidos = ['comprador', 'vendedor']
    if (rol && !rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido' })
    }

    const resultado = await registrarUsuario({
      email, contraseña, nombre, rol, direccion, telefono, dni: dniLimpio,
      nombreTienda, descripcionTienda, ciudad, tipoTienda
    })

    console.log(`✅ Nuevo usuario registrado: ${email} (${rol || 'comprador'})`)

    res.status(201).json(resultado)
  } catch (error) {
    console.error('❌ Error en registro:', error.message)
    res.status(400).json({ error: error.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { email, contraseña } = req.body

    if (!email || !contraseña) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
    }

    email = sanitizar(email).toLowerCase()

    if (!emailValido(email)) {
      return res.status(400).json({ error: 'Email no válido' })
    }

    const resultado = await loginUsuario(email, contraseña)

    console.log(`✅ Login exitoso: ${email}`)

    res.json(resultado)
  } catch (error) {
    // No revelar si el email existe o no (seguridad)
    console.warn(`⚠️ Login fallido: ${req.body.email || 'sin email'}`)
    res.status(401).json({ error: 'Email o contraseña incorrectos' })
  }
})

// GET /api/auth/perfil
router.get('/perfil', verificarToken, async (req, res) => {
  try {
    const resultado = await obtenerPerfil(req.usuario.id)
    res.json(resultado)
  } catch (error) {
    res.status(404).json({ error: error.message })
  }
})

// PUT /api/auth/perfil
router.put('/perfil', verificarToken, async (req, res) => {
  try {
    // Sanitizar datos del perfil
    const datosSanitizados = {}
    const camposPermitidos = ['nombre', 'direccion', 'telefono', 'avatar']
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        datosSanitizados[campo] = sanitizar(req.body[campo])
      }
    }

    const usuario = await actualizarPerfil(req.usuario.id, datosSanitizados)
    res.json({ usuario })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/auth/recuperar - Solicitar recuperaci\u00f3n de contrase\u00f1a
router.post('/recuperar', async (req, res) => {
  try {
    let { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email requerido' })
    email = sanitizar(email).toLowerCase()

    const usuario = await Usuario.findOne({ email })
    if (!usuario) {
      // No revelar si el email existe (seguridad)
      return res.json({ mensaje: 'Si el email est\u00e1 registrado, recibir\u00e1s instrucciones para restablecer tu contrase\u00f1a.' })
    }

    // Generar token de 6 d\u00edgitos (m\u00e1s simple para el usuario)
    const token = crypto.randomInt(100000, 999999).toString()
    usuario.resetToken = crypto.createHash('sha256').update(token).digest('hex')
    usuario.resetTokenExpira = new Date(Date.now() + 30 * 60 * 1000) // 30 min
    await usuario.save()

    console.log(`\u{1F511} Token de recuperaci\u00f3n para ${email}: ${token}`)

    // Enviar email con el c\u00f3digo (si Resend est\u00e1 configurado)
    const emailResult = await enviarCodigoRecuperacion(email, usuario.nombre, token)

    res.json({
      mensaje: 'Si el email est\u00e1 registrado, recibir\u00e1s instrucciones para restablecer tu contrase\u00f1a.',
      emailEnviado: emailResult.enviado,
      // En dev sin Resend, devolvemos el token para testing
      ...(!emailResult.enviado && { _devToken: token })
    })
  } catch (error) {
    console.error('Error en recuperaci\u00f3n:', error.message)
    res.status(500).json({ error: 'Error al procesar la solicitud' })
  }
})

// POST /api/auth/reset - Restablecer contrase\u00f1a con token
router.post('/reset', async (req, res) => {
  try {
    const { email, token, nuevaContraseña } = req.body

    if (!email || !token || !nuevaContraseña) {
      return res.status(400).json({ error: 'Email, c\u00f3digo y nueva contrase\u00f1a son obligatorios' })
    }

    if (nuevaContraseña.length < 6) {
      return res.status(400).json({ error: 'La contrase\u00f1a debe tener al menos 6 caracteres' })
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex')
    const usuario = await Usuario.findOne({
      email: sanitizar(email).toLowerCase(),
      resetToken: tokenHash,
      resetTokenExpira: { $gt: new Date() }
    })

    if (!usuario) {
      return res.status(400).json({ error: 'C\u00f3digo inv\u00e1lido o expirado. Solicit\u00e1 uno nuevo.' })
    }

    usuario.contrase\u00f1a = nuevaContraseña
    usuario.resetToken = null
    usuario.resetTokenExpira = null
    await usuario.save()

    console.log(`\u2705 Contrase\u00f1a restablecida para ${email}`)

    res.json({ mensaje: 'Contrase\u00f1a actualizada con \u00e9xito. Ya pod\u00e9s iniciar sesi\u00f3n.' })
  } catch (error) {
    console.error('Error en reset:', error.message)
    res.status(500).json({ error: 'Error al restablecer la contrase\u00f1a' })
  }
})

export default router
