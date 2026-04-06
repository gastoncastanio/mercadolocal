import { Router } from 'express'
import { registrarUsuario, loginUsuario, obtenerPerfil, actualizarPerfil } from '../services/usuarioService.js'
import { verificarToken } from '../middleware/auth.js'

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
    let { email, contraseña, nombre, rol, direccion, telefono, nombreTienda, descripcionTienda, ciudad, tipoTienda } = req.body

    // Validaciones estrictas
    if (!email || !contraseña || !nombre) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' })
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
      email, contraseña, nombre, rol, direccion, telefono,
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

export default router
