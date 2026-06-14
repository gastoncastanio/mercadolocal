import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import Usuario from '../models/Usuario.js'

if (!process.env.JWT_SECRET) {
  console.error('⛔ JWT_SECRET no configurado. El servidor no puede arrancar de forma segura.')
  process.exit(1)
}
const JWT_SECRET = process.env.JWT_SECRET

// Vencimientos de tokens
const ACCESS_TOKEN_EXPIRACION = '15m'           // Token corto (15 min)
const REFRESH_TOKEN_DURACION_DIAS = 30          // Token largo (30 días) — guardado en BD

// Middleware para verificar JWT (access token)
export function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.usuario = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' })
  }
}

// Middleware para verificar que sea vendedor (roles antiguos: compatibilidad)
export function soloVendedor(req, res, next) {
  if (req.usuario.rol !== 'vendedor' && req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para vendedores.' })
  }
  next()
}

// Middleware para verificar que el usuario tiene una tienda
export function soloTieneVendedor(req, res, next) {
  if (!req.usuario.tieneVendedor && req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Necesitas crear una tienda primero.' })
  }
  next()
}

// Middleware para verificar que sea admin
export function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores.' })
  }
  next()
}

// Generar Access Token corto (15 minutos)
export function generarAccessToken(usuario) {
  return jwt.sign(
    {
      id: usuario._id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      tieneVendedor: usuario.tieneVendedor || false
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRACION }
  )
}

// Alias para compatibilidad con código existente
export const generarToken = generarAccessToken

// Generar Refresh Token y guardarlo en BD
// Genera un token aleatorio fuerte y lo persiste en el array refreshTokens del usuario
export async function generarRefreshToken(usuarioId) {
  const token = crypto.randomBytes(64).toString('hex')
  const ahora = new Date()
  const expiraEn = new Date(ahora.getTime() + REFRESH_TOKEN_DURACION_DIAS * 24 * 60 * 60 * 1000)

  // Limpiar tokens expirados antes de agregar uno nuevo (evita crecimiento sin límite)
  await Usuario.findByIdAndUpdate(usuarioId, {
    $pull: { refreshTokens: { expiraEn: { $lte: ahora } } }
  })

  // Agregar nuevo refresh token
  await Usuario.findByIdAndUpdate(usuarioId, {
    $push: {
      refreshTokens: {
        token,
        creadoEn: ahora,
        expiraEn
      }
    },
    $set: { ultimoLogin: ahora }
  })

  return token
}

// Verificar refresh token: lee de BD y valida que no haya expirado
export async function verificarRefreshToken(token) {
  if (!token) return null
  const usuario = await Usuario.findOne({
    'refreshTokens.token': token,
    'refreshTokens.expiraEn': { $gt: new Date() }
  })
  return usuario
}

// Rotar refresh token: borra el viejo y emite uno nuevo (estrategia de seguridad)
export async function rotarRefreshToken(usuarioId, tokenViejo) {
  await Usuario.findByIdAndUpdate(usuarioId, {
    $pull: { refreshTokens: { token: tokenViejo } }
  })
  return await generarRefreshToken(usuarioId)
}

// Revocar refresh token (logout)
export async function revocarRefreshToken(usuarioId, token) {
  if (!usuarioId || !token) return
  await Usuario.findByIdAndUpdate(usuarioId, {
    $pull: { refreshTokens: { token } }
  })
}
