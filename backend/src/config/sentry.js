/**
 * Configuración de Sentry para monitoreo de errores en producción.
 *
 * Sentry captura automáticamente:
 * - Errores no manejados (uncaught exceptions)
 * - Promesas rechazadas sin handler
 * - Errores en middleware de Express
 *
 * Variables de entorno requeridas:
 * - SENTRY_DSN: el DSN del proyecto en sentry.io (opcional)
 *
 * Si SENTRY_DSN no está configurado, el módulo funciona en modo "no-op"
 * sin romper nada. Ideal para desarrollo local.
 */

import * as Sentry from '@sentry/node'

let inicializado = false

/**
 * Inicializa Sentry. Debe llamarse al inicio de server.js, antes de cualquier
 * otro código que pueda fallar.
 */
export function inicializarSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  SENTRY_DSN no configurado en producción. Los errores no van a Sentry.')
    } else {
      console.log('ℹ️  Sentry deshabilitado (sin SENTRY_DSN). Los errores irán solo a la consola.')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Sample rate: en producción capturamos 10% de las traces normales,
    // 100% de los errores (default)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Capturar logs de console.error automáticamente
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ['error'] })
    ],
    // No enviar PII (información personal identificable) por defecto
    sendDefaultPii: false,
    // Antes de enviar un evento, filtrar info sensible
    beforeSend(event) {
      // Sacar headers de autorización
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]'
      }
      if (event.request?.headers?.cookie) {
        event.request.headers.cookie = '[REDACTED]'
      }
      return event
    }
  })

  inicializado = true
  console.log('✅ Sentry inicializado para monitoreo de errores')
}

/**
 * Captura una excepción manualmente con contexto.
 * Útil para errores que sí queremos rastrear pero no son críticos
 * (ej: fallo de email, fallo de notificación, etc.)
 */
export function capturarError(error, contexto = {}) {
  if (!inicializado) {
    console.error('Error (Sentry no inicializado):', error.message, contexto)
    return
  }
  Sentry.captureException(error, { extra: contexto })
}

/**
 * Express error handler para Sentry.
 * Se usa después de las rutas, antes del error handler de Express.
 */
export function sentryErrorHandler() {
  if (!inicializado) {
    return (err, req, res, next) => next(err)
  }
  return Sentry.expressErrorHandler()
}

/**
 * Middleware que captura info del request (URL, método, user-agent, etc.)
 * para que cuando ocurra un error, Sentry tenga todo el contexto.
 */
export function sentryRequestHandler() {
  if (!inicializado) {
    return (req, res, next) => next()
  }
  // Sentry v10 integra esto automáticamente con expressIntegration
  return (req, res, next) => next()
}

export default Sentry
