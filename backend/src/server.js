// CARGAR VARIABLES DE ENTORNO PRIMERO
import './config/env.js'

// Sentry debe inicializarse ANTES de cualquier import que pueda fallar
import { inicializarSentry, sentryErrorHandler } from './config/sentry.js'
inicializarSentry()

import http from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import hpp from 'hpp'
import { connectDB } from './config/database.js'
import { limpiarOrdenesPendientes } from './services/ordenService.js'
import { initSocket } from './services/socketService.js'

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
import statsRouter from './routes/stats.js'
import soporteRouter from './routes/soporte.js'
import moderacionRouter from './routes/moderacion.js'
import cerebroRouter from './routes/cerebro.js'
import senalesRouter from './routes/senales.js'
import comprobantesRouter from './routes/comprobantes.js'
import centroRouter from './routes/centro.js'
import privacidadRouter from './routes/privacidad.js'
import serviciosRouter from './routes/servicios.js'
import { sembrarAgentesFundadores } from './services/seedAgentes.js'
import { sembrarMemoriaFundador } from './services/seedMemoriaFundador.js'
import { sembrarBloqueHorario } from './services/seedBloqueHorario.js'
import { iniciarCronCerebro } from './services/cronCerebro.js'
import { inicializarConfig } from './services/configService.js'
import { configurarMercadoPago } from './config/mercadopago.js'

const app = express()
// Railway (y la mayoría de los PaaS) ponen un proxy adelante que agrega el
// header X-Forwarded-For con la IP real del cliente. Sin esto, express-rate-limit
// no puede identificar al cliente y tira ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
// Confiamos en 1 solo proxy (el de Railway), no en cualquiera, por seguridad.
app.set('trust proxy', 1)
const httpServer = http.createServer(app)
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
      connectSrc: ["'self'", "https://api.mercadopago.com", "https://api.mercadolibre.com", "wss:", "ws:"],
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

// CORS: permitir orígenes específicos + cualquier deploy preview de Vercel
// del proyecto mercadolocal (mercadolocal-*.vercel.app).
//
// La función origen-callback nos permite aceptar el dominio principal,
// los previews automáticos de Vercel y localhost, sin tener que mantener
// una lista manual que se desactualice.
const orígenesPermitidos = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Sin origin (curl, server-to-server, mismo origen) → permitir
    if (!origin) return callback(null, true)

    // Origen explícitamente listado en FRONTEND_URL
    if (orígenesPermitidos.includes(origin)) return callback(null, true)

    // Cualquier deploy de Vercel del proyecto mercadolocal:
    //   mercadolocal.vercel.app, mercadolocal-nu.vercel.app,
    //   mercadolocal-git-<branch>.vercel.app, etc.
    if (/^https:\/\/mercadolocal[a-z0-9-]*\.vercel\.app$/i.test(origin)) {
      return callback(null, true)
    }

    // Localhost en cualquier puerto (desarrollo)
    if (/^http:\/\/localhost(:[0-9]+)?$/.test(origin)) {
      return callback(null, true)
    }

    console.warn(`🚨 CORS bloqueó origen: ${origin}`)
    callback(new Error(`Origen no permitido: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // x-anon-id: header que el frontend envía en todas las requests para perfilar
  // visitantes anónimos (pauta inteligente). SIN esto, el navegador bloquea TODA
  // request por preflight CORS y el sitio queda inaccesible.
  allowedHeaders: ['Content-Type', 'Authorization', 'x-anon-id']
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

// General: máximo 1000 peticiones por IP cada 15 minutos.
// Con polling de panels admin (Cerebro consume ~150 req/15min solo de polling)
// y usuarios navegando, 200 era muy bajo.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Demasiadas peticiones. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Las rutas del cerebro tienen su propia gestión: no aplicamos rate limit acá
  // (el panel admin hace polling normal, no es abuso).
  skip: (req) => req.path.startsWith('/cerebro')
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

  // Configurar MercadoPago para Fase 3 (monetización prepago)
  try {
    configurarMercadoPago()
    console.log('✓ MercadoPago configurado')
  } catch (err) {
    console.warn('⚠️ MercadoPago no configurado:', err.message)
  }

  // Sembrar el equipo IA (idempotente: no pisa nada existente)
  sembrarAgentesFundadores()
    .then(r => console.log(`🧠 Equipo IA: ${r.creados} creados, ${r.actualizados} actualizados`))
    .catch(err => console.warn('Seed agentes:', err.message))

  // Sembrar la memoria persistente del fundador (idempotente)
  sembrarMemoriaFundador()
    .then(r => console.log(`📚 Memoria fundador: ${r.creados} hechos nuevos, ${r.yaExistían} existentes (total ${r.total})`))
    .catch(err => console.warn('Seed memoria:', err.message))

  // Sembrar bloques horarios del Radar del Centro (Fase 3, idempotente)
  sembrarBloqueHorario()
    .catch(err => console.warn('Seed bloques horarios:', err.message))

  // Cron del cerebro: reporte diario CEO + ascensos automáticos
  // Deshabilitado temporalmente: Gemini API en quota exceeded
  // iniciarCronCerebro()

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
app.use('/api/stats', statsRouter)
app.use('/api/soporte', soporteRouter)
app.use('/api/moderacion', moderacionRouter)
app.use('/api/cerebro', cerebroRouter)
app.use('/api/senales', senalesRouter)
app.use('/api/comprobantes', comprobantesRouter)
app.use('/api/privacidad', privacidadRouter)
app.use('/api/centro', centroRouter)
app.use('/api/servicios', serviciosRouter)

// Health check básico (rápido, para uptime monitors)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', mensaje: 'Marketplace activo', timestamp: new Date() })
})

// Health check detallado (verifica servicios)
app.get('/api/health/detalle', async (req, res) => {
  const checks = { api: 'OK', mongodb: 'ERROR', websocket: 'ERROR' }
  try {
    const mongoose = (await import('mongoose')).default
    if (mongoose.connection.readyState === 1) checks.mongodb = 'OK'
  } catch {}
  try {
    const { getIO } = await import('./services/socketService.js')
    if (getIO()) checks.websocket = 'OK'
  } catch {}
  const allOk = Object.values(checks).every(v => v === 'OK')
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'OK' : 'DEGRADED', checks, timestamp: new Date() })
})

// Sentry: capturar errores ANTES del handler global de Express
// (debe ir después de las rutas, antes del error handler propio)
app.use(sentryErrorHandler())

// Error handling global
app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  // No exponer detalles del error en producción
  const mensaje = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message
  res.status(500).json({ error: mensaje })
})

// Inicializar WebSockets
const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(Boolean)
  : ['http://localhost:5173']
initSocket(httpServer, corsOrigins)

// Iniciar servidor HTTP (con WebSocket)
httpServer.listen(PORT, () => {
  console.log(``)
  console.log(`🛒 ==========================================`)
  console.log(`🛒  MARKETPLACE LOCAL - Servidor Activo`)
  console.log(`🛒 ==========================================`)
  console.log(`🚀 Escuchando en http://localhost:${PORT}`)
  console.log(`⚡ WebSockets: Socket.IO activo`)
  console.log(`🔐 Seguridad: Helmet + CORS + NoSQL Sanitize`)
  console.log(`🛡️  Rate Limit + HPP + XSS Protection`)
  console.log(`📝 API: http://localhost:${PORT}/api`)
  console.log(`💳 Pagos: Mercado Pago integrado`)
  console.log(`📸 Imágenes: Cloudinary`)
  console.log(``)
})
