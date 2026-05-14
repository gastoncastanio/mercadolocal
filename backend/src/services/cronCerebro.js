/**
 * CRON del CEREBRO.
 *
 * Tareas programadas del equipo IA:
 *   1. Reporte diario del CEO a las 8:00 AM (hora Argentina) → email + chat
 *   2. Procesamiento de ascensos cada 6 horas
 *
 * No usamos `node-cron` para no agregar otra dependencia: con setInterval
 * y verificación de hora alcanza para algo tan simple como esto.
 */

import Usuario from '../models/Usuario.js'
import MensajeOrganizacion from '../models/MensajeOrganizacion.js'
import {
  generarReporteDiarioCEO,
  procesarAscensosAutomaticos
} from './cerebro.js'
import { ejecutarRondaDePropuestas } from './analistaPropuestas.js'
import { disparoDiegoSupervision } from './eventosCerebro.js'
import { enviarReporteCEO } from './emailService.js'

// Bandera para no duplicar el reporte si el server reinicia
let ultimaFechaReporte = null

/**
 * Devuelve YYYY-MM-DD en hora Argentina (UTC-3).
 */
function fechaArgentinaHoy() {
  const ahora = new Date()
  const argentina = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  return argentina.toISOString().slice(0, 10)
}

/**
 * Devuelve la hora actual en Argentina (0-23).
 */
function horaArgentinaActual() {
  const ahora = new Date()
  const argentina = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  return argentina.getUTCHours()
}

/**
 * Verifica si ya se generó el reporte del día consultando la base.
 * Esto resiste reinicios del server.
 */
async function reporteYaGeneradoHoy() {
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  const existe = await MensajeOrganizacion.findOne({
    canal: 'reporte',
    tipo: 'reporte_diario',
    autorSlug: 'diego_ceo',
    createdAt: { $gte: desde }
  }).select('_id').lean()
  return !!existe
}

/**
 * Envía el reporte por email a todos los admins activos.
 */
async function enviarReporteATodosLosAdmins(mensaje) {
  if (!mensaje) return
  const admins = await Usuario.find({ rol: 'admin', activo: true })
    .select('email nombre')
    .lean()

  for (const admin of admins) {
    if (!admin.email) continue
    try {
      await enviarReporteCEO(
        admin.email,
        admin.nombre || 'fundador',
        mensaje.contenido,
        mensaje.contexto || {}
      )
    } catch (e) {
      console.warn(`No se pudo enviar reporte a ${admin.email}:`, e.message)
    }
  }
}

/**
 * Tick del cron — se ejecuta cada 30 minutos.
 * - Si es 8 AM Argentina y todavía no se generó el reporte del día → genera y envía.
 * - Si la hora es múltiplo de 6 → procesa ascensos automáticos.
 */
async function tick() {
  try {
    const hora = horaArgentinaActual()
    const hoy = fechaArgentinaHoy()

    // ===== Reporte diario a las 8 AM =====
    if (hora === 8 && ultimaFechaReporte !== hoy) {
      const yaGenerado = await reporteYaGeneradoHoy()
      if (!yaGenerado) {
        console.log('🎩 Generando reporte diario del CEO Diego...')
        const mensaje = await generarReporteDiarioCEO()
        if (mensaje) {
          await enviarReporteATodosLosAdmins(mensaje)
          console.log('🎩 Reporte enviado por email a los admins.')
        }
      }
      ultimaFechaReporte = hoy
    }

    // ===== Ascensos cada 6 horas (a las 0, 6, 12, 18) =====
    if ([0, 6, 12, 18].includes(hora)) {
      const ahora = Date.now()
      if (!tick._ultimoAscenso || (ahora - tick._ultimoAscenso) > 5 * 60 * 60 * 1000) {
        tick._ultimoAscenso = ahora
        const ascendidos = await procesarAscensosAutomaticos()
        if (ascendidos.length > 0) {
          console.log('🎖️ Ascensos procesados:', ascendidos)
        }
      }
    }

    // ===== Ronda de propuestas autónomas CADA TICK (cada 30 minutos) =====
    // El fundador pidió velocidad: los agentes proponen seguido.
    // El propio servicio analistaPropuestas tiene su lógica anti-duplicado
    // (max N propuestas pendientes por agente) así que llamarlo seguido
    // no satura.
    const ahora = Date.now()
    if (!tick._ultimaRondaPropuestas || (ahora - tick._ultimaRondaPropuestas) > 25 * 60 * 1000) {
      tick._ultimaRondaPropuestas = ahora
      console.log('📋 Ejecutando ronda de propuestas autónomas...')
      ejecutarRondaDePropuestas()
        .then(p => console.log(`📋 Ronda terminada: ${p.length} propuesta(s) nueva(s)`))
        .catch(e => console.warn('Error ronda propuestas:', e.message))
    }

    // ===== Diego supervisor cada hora =====
    if (!tick._ultimaSupervision || (ahora - tick._ultimaSupervision) > 55 * 60 * 1000) {
      tick._ultimaSupervision = ahora
      disparoDiegoSupervision()
        .then(r => { if (r) console.log('🎩 Diego supervisó y comentó algo') })
        .catch(e => console.warn('Error supervisión Diego:', e.message))
    }
  } catch (e) {
    console.warn('Error en tick del cerebro:', e.message)
  }
}

/**
 * Arranca el cron. Llamar una sola vez al iniciar el servidor.
 */
export function iniciarCronCerebro() {
  // Primera ejecución a los 30 segundos (rápido para que ya empiece)
  setTimeout(tick, 30 * 1000)
  // Después, cada 10 minutos (cada tick decide qué tareas correr según
  // su cooldown interno: propuestas cada ~30min, supervisión Diego cada
  // ~1h, ascensos cada 6h, reporte 1 vez al día)
  setInterval(tick, 10 * 60 * 1000)
  console.log('🧠 Cron del cerebro iniciado (tick cada 10min, propuestas cada ~30min)')
}
