import { Router } from 'express'
import crypto from 'crypto'
import { registrarUsuario, loginUsuario, obtenerPerfil, actualizarPerfil } from '../services/usuarioService.js'
import {
  verificarToken,
  generarAccessToken,
  verificarRefreshToken,
  rotarRefreshToken,
  revocarRefreshToken
} from '../middleware/auth.js'
import Usuario from '../models/Usuario.js'
import { enviarCodigoRecuperacion } from '../services/emailService.js'

const router = Router()

// ===== Rate limit por email (memoria) — refuerza el rate limit por IP del server =====
// Map<email, { intentos: number, ventanaInicio: number }>
const intentosLoginPorEmail = new Map()
const VENTANA_LOGIN_MS = 15 * 60 * 1000   // 15 minutos
const MAX_INTENTOS_EMAIL = 10              // 10 intentos por email en la ventana

function chequearRateLimitEmail(email) {
  const ahora = Date.now()
  const registro = intentosLoginPorEmail.get(email)
  if (!registro || ahora - registro.ventanaInicio > VENTANA_LOGIN_MS) {
    intentosLoginPorEmail.set(email, { intentos: 1, ventanaInicio: ahora })
    return { permitido: true }
  }
  registro.intentos += 1
  if (registro.intentos > MAX_INTENTOS_EMAIL) {
    return { permitido: false, esperar: Math.ceil((VENTANA_LOGIN_MS - (ahora - registro.ventanaInicio)) / 60000) }
  }
  return { permitido: true }
}

function resetRateLimitEmail(email) {
  intentosLoginPorEmail.delete(email)
}

// Limpieza periódica del Map (cada 30 minutos) para evitar leaks de memoria
setInterval(() => {
  const ahora = Date.now()
  for (const [email, registro] of intentosLoginPorEmail.entries()) {
    if (ahora - registro.ventanaInicio > VENTANA_LOGIN_MS) {
      intentosLoginPorEmail.delete(email)
    }
  }
}, 30 * 60 * 1000)

// Validar fortaleza de contraseña: mínimo 8 caracteres y al menos un número
function contraseñaFuerte(password) {
  if (typeof password !== 'string') return false
  if (password.length < 8) return false
  if (!/\d/.test(password)) return false
  return true
}

// Sanitizar strings: remover vectores de XSS conocidos
function sanitizar(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/<[^>]*>/g, '')          // Remover tags HTML completos
    .replace(/javascript\s*:/gi, '')   // Remover javascript: (con espacios)
    .replace(/data\s*:/gi, '')         // Remover data: URIs
    .replace(/vbscript\s*:/gi, '')     // Remover vbscript:
    .replace(/on\w+\s*=/gi, '')        // Remover event handlers (onclick=, etc)
    .replace(/expression\s*\(/gi, '')  // Remover CSS expression()
    .replace(/url\s*\(/gi, '')         // Remover CSS url()
    .replace(/&#/g, '')                // Remover HTML entities numéricas
    .replace(/\\x[0-9a-fA-F]{2}/g, '') // Remover hex escapes
    .replace(/\\u[0-9a-fA-F]{4}/g, '') // Remover unicode escapes
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

    // Validar contraseña: mínimo 8 caracteres y al menos un número
    if (!contraseñaFuerte(contraseña)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres y un número' })
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
  let emailNormalizado = ''
  try {
    let { email, contraseña } = req.body

    if (!email || !contraseña) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
    }

    email = sanitizar(email).toLowerCase()
    emailNormalizado = email

    if (!emailValido(email)) {
      return res.status(400).json({ error: 'Email no válido' })
    }

    // Rate limit por email (complementa el limit por IP del server)
    const rateCheck = chequearRateLimitEmail(email)
    if (!rateCheck.permitido) {
      return res.status(429).json({
        error: `Demasiados intentos para este email. Esperá ${rateCheck.esperar} minutos.`
      })
    }

    const resultado = await loginUsuario(email, contraseña)

    // Login exitoso: resetear contador del rate limit por email
    resetRateLimitEmail(email)

    console.log(`✅ Login exitoso: ${email}`)

    res.json(resultado)
  } catch (error) {
    // No revelar si el email existe o no (seguridad)
    console.warn(`⚠️ Login fallido: ${emailNormalizado || 'sin email'}`)
    res.status(401).json({ error: 'Email o contraseña incorrectos' })
  }
})

// POST /api/auth/refresh - Renovar access token con refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' })
    }

    const usuario = await verificarRefreshToken(refreshToken)
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' })
    }

    // Rotar el refresh token: invalidar el viejo, emitir uno nuevo
    const nuevoRefreshToken = await rotarRefreshToken(usuario._id, refreshToken)
    const accessToken = generarAccessToken(usuario)

    res.json({
      token: accessToken,
      refreshToken: nuevoRefreshToken
    })
  } catch (error) {
    console.error('Error refrescando token:', error.message)
    res.status(500).json({ error: 'Error al renovar la sesión' })
  }
})

// POST /api/auth/logout - Invalidar refresh token (cierre de sesión)
router.post('/logout', verificarToken, async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await revocarRefreshToken(req.usuario.id, refreshToken)
    }
    res.json({ mensaje: 'Sesión cerrada' })
  } catch (error) {
    console.error('Error en logout:', error.message)
    res.json({ mensaje: 'Sesión cerrada' })
  }
})

// GET /api/auth/verify - Verificar si el access token sigue siendo válido
// Útil para que el frontend valide la sesión sin esperar 401 en otro endpoint
router.get('/verify', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('_id email nombre rol activo')
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ valido: false, error: 'Usuario no activo' })
    }
    res.json({
      valido: true,
      usuario: {
        id: usuario._id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    })
  } catch (error) {
    res.status(500).json({ valido: false, error: 'Error verificando sesión' })
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

    // Enviar email con el código (si Resend está configurado)
    const emailResult = await enviarCodigoRecuperacion(email, usuario.nombre, token)

    // Si el email NO se pudo enviar (Resend mal configurado, dominio sin
    // verificar, etc.), dejarlo MUY visible en los logs para poder diagnosticar.
    if (!emailResult.enviado) {
      console.error(
        `⚠️  RECUPERACIÓN: no se pudo enviar el email a ${email}. ` +
        `Motivo: ${emailResult.motivo || 'desconocido'}. ` +
        `Revisá RESEND_API_KEY y EMAIL_FROM (el dominio debe estar verificado en Resend).`
      )
    }

    // En desarrollo devolvemos el código en la respuesta para poder testear el
    // flujo sin un servicio de email real. NUNCA en producción.
    const respuesta = {
      mensaje: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.',
      emailEnviado: emailResult.enviado
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔑 [DEV] Código de recuperación para ${email}: ${token}`)
      respuesta._devToken = token
    }

    res.json(respuesta)
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

    if (!contraseñaFuerte(nuevaContraseña)) {
      return res.status(400).json({ error: 'La contrase\u00f1a debe tener al menos 8 caracteres y un n\u00famero' })
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
