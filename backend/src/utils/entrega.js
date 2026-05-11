/**
 * Helpers para validar y normalizar las modalidades de entrega de un producto.
 *
 * MercadoLocal NO procesa pagos de envío. El costo del envío se coordina
 * directamente entre comprador y vendedor (por chat / WhatsApp). Más adelante
 * integraremos API de Andreani para cotización automática.
 *
 * Reglas:
 * - Al menos UNA modalidad debe estar activa para poder publicar
 * - Si retiroEnLocal: dirección obligatoria
 * - Si envioPropio: zonas obligatorias
 * - Si envioCorreo: empresas es opcional pero recomendado
 */

/**
 * Normaliza el objeto entrega que viene del cliente.
 * Filtra valores no permitidos, recorta strings, fuerza tipos.
 */
export function normalizarEntrega(entregaRaw) {
  const e = entregaRaw || {}
  const retiro = e.retiroEnLocal || {}
  const propio = e.envioPropio || {}
  const correo = e.envioCorreo || {}

  return {
    retiroEnLocal: {
      activo: Boolean(retiro.activo),
      direccion: String(retiro.direccion || '').trim().slice(0, 200),
      horarios: String(retiro.horarios || '').trim().slice(0, 200)
    },
    envioPropio: {
      activo: Boolean(propio.activo),
      zonas: String(propio.zonas || '').trim().slice(0, 300),
      notas: String(propio.notas || '').trim().slice(0, 300)
    },
    envioCorreo: {
      activo: Boolean(correo.activo),
      empresas: String(correo.empresas || '').trim().slice(0, 200)
    }
  }
}

/**
 * Valida que la configuración de entrega sea válida para publicar.
 * @param {Object} entrega - ya normalizado
 * @returns {{ valido: boolean, motivos: string[] }}
 */
export function validarEntrega(entrega) {
  const motivos = []

  const e = entrega || {}
  const algunaActiva =
    e.retiroEnLocal?.activo ||
    e.envioPropio?.activo ||
    e.envioCorreo?.activo

  if (!algunaActiva) {
    motivos.push('Tenés que ofrecer al menos una modalidad de entrega: retiro en local, envío propio o envío por correo.')
    return { valido: false, motivos }
  }

  if (e.retiroEnLocal?.activo) {
    if (!e.retiroEnLocal.direccion || e.retiroEnLocal.direccion.length < 5) {
      motivos.push('Si ofrecés retiro en local, indicá la dirección donde se retira el producto.')
    }
  }

  if (e.envioPropio?.activo) {
    if (!e.envioPropio.zonas || e.envioPropio.zonas.length < 3) {
      motivos.push('Si ofrecés envío propio, indicá qué zonas cubrís.')
    }
  }

  // envioCorreo no requiere campos obligatorios — el comprador coordina

  return {
    valido: motivos.length === 0,
    motivos
  }
}

/**
 * Construye mensaje de rechazo amigable para mostrar al vendedor.
 */
export function construirMensajeEntregaInvalida(motivos) {
  if (motivos.length === 0) return ''
  const intro = 'Revisá las modalidades de entrega:'
  const lista = motivos.map(m => `• ${m}`).join('\n')
  return `${intro}\n\n${lista}`
}
