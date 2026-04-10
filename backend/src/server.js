// CARGAR VARIABLES DE ENTORNO PRIMERO
import './config/env.js'

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import hpp from 'hpp'
import { connectDB } from './config/database.js'
import { limpiarOrdenesPendientes } from './services/ordenService.js'

// Rutas del Marketplace
import authRouter from './routes/auth.js'
import productosRouter from './routes/productos.js'
import tiendaRouter from './routes/tienda.js'
import carritoRouter from './routes/carrito.js'
import ordenesRouter from './routes/ordenes.js'
import adminRouter from './routes/admin.js'
import pagosRouter from './routes/pagos.js'
import uploadRouter from './routes/upload.js'
import resenasRouter from './routes/resenas.js'
import disputasRouter from './routes/disputas.js'
import mensajesRouter from './routes/mensajes.js'
import configRouter from './routes/config.js'
import favoritosRouter from './routes/favoritos.js'
import notificacionesRouter from './routes/notificaciones.js'
import enviosRouter from './routes/envios.js'
import destacadosRouter from './routes/destacados.js'
import mpOauthRouter from './routes/mpOauth.js'
import { inicializarConfig } from './services/configService.js'

const app = express()
const PORT = process.env.PORT || 3001

// ===== SEGURIDAD NIVEL 1: Headers y Protección Base =====

// Helmet: headers de seguridad con CSP y HSTS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.mercadopago.com"],
      connectSrc: ["'self'", "https://api.mercadopago.com", "https://api.mercadolibre.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://*.mercadopago.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}))

// CORS: solo permitir peticiones desde nuestro frontend
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(Boolean)
    : ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// ===== SEGURIDAD NIVEL 2: Anti-Ataques =====

// Protección contra inyección NoSQL
// Ejemplo: alguien envía {"email": {"$gt": ""}} para saltear login
// Esto lo bloquea automáticamente
app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`🚨 Intento de inyección NoSQL bloqueado en ${key}`)
  }
}))

// Protección contra HTTP Parameter Pollution
// Ejemplo: ?precio=100&precio=1 (manipular filtros)
app.use(hpp())

// ===== SEGURIDAD NIVEL 3: Rate Limiting =====

// General: máximo 200 peticiones por IP cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/', limiter)

// Login: máximo 20 intentos cada 15 minutos por IP (anti fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de login. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/auth/login', loginLimiter)

// Registro: máximo 5 registros cada 15 minutos por IP
const registroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados registros. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/auth/registro', registroLimiter)

// Upload: máximo 30 subidas cada 15 minutos
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas subidas. Esperá 15 minutos.' }
})
app.use('/api/upload', uploadLimiter)

// Recuperación de contraseña: máximo 5 intentos cada 15 minutos (anti brute-force)
const recuperarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de recuperación. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/auth/recuperar', recuperarLimiter)

// Reset de contraseña: máximo 10 intentos cada 15 minutos (anti brute-force del código)
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/auth/reset', resetLimiter)

// Webhook de MP: máximo 100 por minuto (protección contra flood)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Rate limit exceeded'
})
app.use('/api/pagos/webhook', webhookLimiter)

// Recordatorios de carrito abandonado: máximo 5 por hora por IP
const recordatorioLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados recordatorios enviados. Esperá 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/ordenes/recordatorio', recordatorioLimiter)

// ===== MIDDLEWARE =====

// Limitar tamaño del body (previene ataques de payload gigante)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// Conectar a la base de datos
connectDB().then(async () => {
  inicializarConfig().catch(err => console.warn('Config init:', err.message))

  // Limpiar órdenes pendientes expiradas al iniciar y cada 30 minutos
  try {
    const canceladas = await limpiarOrdenesPendientes()
    if (canceladas > 0) console.log(`🧹 ${canceladas} órdenes pendientes expiradas al iniciar`)
  } catch (err) {
    console.warn('Error limpiando órdenes pendientes:', err.message)
  }
  setInterval(async () => {
    try {
      const canceladas = await limpiarOrdenesPendientes()
      if (canceladas > 0) console.log(`🧹 ${canceladas} órdenes pendientes expiradas (limpieza periódica)`)
    } catch (err) {
      console.warn('Error en limpieza periódica:', err.message)
    }
  }, 30 * 60 * 1000)
}).catch((err) => {
  console.error('Error conectando a MongoDB:', err)
})

// ===== RUTAS =====
app.use('/api/auth', authRouter)
app.use('/api/productos', productosRouter)
app.use('/api/tienda', tiendaRouter)
app.use('/api/carrito', carritoRouter)
app.use('/api/ordenes', ordenesRouter)
app.use('/api/admin', adminRouter)
app.use('/api/pagos', pagosRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/resenas', resenasRouter)
app.use('/api/disputas', disputasRouter)
app.use('/api/mensajes', mensajesRouter)
app.use('/api/config', configRouter)
app.use('/api/favoritos', favoritosRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/envios', enviosRouter)
app.use('/api/destacados', destacadosRouter)
app.use('/api/mp', mpOauthRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', mensaje: 'Marketplace activo', timestamp: new Date() })
})

// Error handling global
app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  // No exponer detalles del error en producción
  const mensaje = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message
  res.status(500).json({ error: mensaje })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(``)
  console.log(`🛒 ==========================================`)
  console.log(`🛒  MARKETPLACE LOCAL - Servidor Activo`)
  console.log(`🛒 ==========================================`)
  console.log(`🚀 Escuchando en http://localhost:${PORT}`)
  console.log(`🔐 Seguridad: Helmet + CORS + NoSQL Sanitize`)
  console.log(`🛡️  Rate Limit + HPP + XSS Protection`)
  console.log(`📝 API: http://localhost:${PORT}/api`)
  console.log(`💳 Pagos: Mercado Pago integrado`)
  console.log(`📸 Imágenes: Cloudinary`)
  console.log(``)
})
