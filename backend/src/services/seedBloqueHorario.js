import BloqueHorarioConfig from '../models/BloqueHorarioConfig.js'

/**
 * Inicializa los bloques horarios por defecto para el Radar del Centro (Fase 3).
 * Se ejecuta una sola vez al arrancar si no existen.
 */
export async function sembrarBloqueHorario() {
  try {
    const count = await BloqueHorarioConfig.countDocuments()
    if (count > 0) {
      console.log('✓ BloqueHorarioConfig ya inicializado.')
      return
    }

    const bloques = [
      {
        nombre: 'manana',
        horaInicio: '07:30',
        horaFin: '10:00',
        titulo: '🌅 Fast-Track Urbano',
        descripcion: 'Café, medialunas y salida rápida. Ordena por cercanía estricta (< 300m). Listo en X min.',
        tipoDispatcher: 'cercania',
        distanciaMaxima: 300
      },
      {
        nombre: 'tarde',
        horaInicio: '17:00',
        horaFin: '19:30',
        titulo: '☕ Desconexión e Impulso',
        descripcion: 'Pausa de la tarde. Descubre rutas de recompensa cruzada: "Canjea en A, desbloquea en B".',
        tipoDispatcher: 'cruzada',
        distanciaMaxima: 500
      },
      {
        nombre: 'noche',
        horaInicio: '20:00',
        horaFin: '23:00',
        titulo: '🌙 Noche Sorpresas',
        descripcion: 'Últimas ofertas antes de cerrar. Ofertas con descuento variable por comercio.',
        tipoDispatcher: 'general',
        distanciaMaxima: 400
      }
    ]

    await BloqueHorarioConfig.insertMany(bloques)
    console.log('✓ BloqueHorarioConfig inicializado con 3 bloques (mañana, tarde, noche).')
  } catch (error) {
    console.error('✗ Error al inicializar BloqueHorarioConfig:', error.message)
  }
}

export default sembrarBloqueHorario
