import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'marketplace_secreto_super_seguro_2024'

// Middleware para verificar JWT
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

// Middleware para verificar que sea vendedor
export function soloVendedor(req, res, next) {
  if (req.usuario.rol !== 'vendedor' && req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para vendedores.' })
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

// Generar token JWT
export function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario._id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}
