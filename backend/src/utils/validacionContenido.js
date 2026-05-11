/**
 * Validación de contenido para publicaciones (productos, tiendas, mensajes).
 *
 * Objetivo: evitar que vendedores se salteen el marketplace pasando
 * contacto directo (WhatsApp, email, redes sociales, URLs externas) en
 * el título o descripción de sus publicaciones.
 *
 * Estrategia: detección estricta (más falsos positivos > más falsos negativos).
 * Si bloqueamos algo legítimo, el vendedor edita y resuelve.
 * Si dejamos pasar contacto externo, perdemos plata real.
 *
 * Niveles de detección:
 * 1. Teléfonos en cualquier formato (con separadores, paréntesis, etc.)
 * 2. Teléfonos escritos en letras ("uno dos tres...")
 * 3. Emails
 * 4. URLs y dominios externos
 * 5. Menciones de redes sociales (@usuario, instagram, whatsapp, etc.)
 * 6. Frases de evasión típicas ("contactame fuera", "llamame al")
 *
 * Excepciones (NO se bloquean):
 * - Números cortos (1-7 dígitos) para modelos de productos
 *   Ej: "iPhone 13", "Mosaicos 30x30", "Tornillos M8 x 50mm"
 * - Precios con $ (ya son números)
 */

// ============================================================
// CONFIGURACIÓN
// ============================================================

// Mínimo de dígitos consecutivos (con o sin separadores) para considerar teléfono
// 8 dígitos cubre teléfonos argentinos sin código de área
const MIN_DIGITOS_TELEFONO = 8

// Si la secuencia de "dígitos+separadores" tiene N dígitos y N >= MIN, bloqueamos
// Permitimos: 1-7 dígitos (modelos)
// Bloqueamos: 8+ dígitos (teléfonos)

// ============================================================
// DETECTORES
// ============================================================

/**
 * Detecta teléfonos en cualquier formato:
 *   "1122334455"
 *   "11 2233 4455"
 *   "11-2233-4455"
 *   "(011) 2233-4455"
 *   "+54 9 11 2233 4455"
 *   "11.2233.4455"
 *
 * NO detecta:
 *   "1234567" (7 dígitos = OK para modelo)
 *   "iPhone 13 128GB"
 */
export function detectarTelefono(texto) {
  if (!texto || typeof texto !== 'string') return false

  // Normalizar: convertir todo a sin acentos y minúsculas
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // Buscar secuencias largas de dígitos con posibles separadores en el medio
  // Permitidos como separadores: espacio, guión, punto, paréntesis, slash
  // Patrón: dígito seguido de hasta 3 chars separadores y otro dígito, repetido
  const regex = /(\d[\s\-.()\\/+]*){8,}/g
  const matches = t.match(regex)
  if (!matches) return false

  // Validar: contar SOLO dígitos en cada match, debe ser >= MIN
  for (const m of matches) {
    const digitos = m.replace(/\D/g, '')
    if (digitos.length >= MIN_DIGITOS_TELEFONO) return true
  }

  return false
}

/**
 * Detecta teléfonos escritos en letras (palabra a palabra).
 *   "uno dos tres cuatro cinco seis siete ocho"
 *   "cero dos dos dos siete cuatro ocho ocho seis tres seis"
 */
const PALABRAS_NUMERO = {
  cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
  cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9'
}

export function detectarTelefonoEnLetras(texto) {
  if (!texto || typeof texto !== 'string') return false

  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const palabras = t.split(/\s+/)

  // Buscar secuencias de 8+ palabras numéricas consecutivas
  let consecutivos = 0
  for (const p of palabras) {
    if (PALABRAS_NUMERO[p] !== undefined) {
      consecutivos++
      if (consecutivos >= MIN_DIGITOS_TELEFONO) return true
    } else {
      consecutivos = 0
    }
  }

  return false
}

/**
 * Detecta direcciones de email:
 *   "vendedor@gmail.com"
 *   "mariana.lopez@hotmail.com.ar"
 *   "info123@empresa.net"
 */
export function detectarEmail(texto) {
  if (!texto || typeof texto !== 'string') return false
  const regex = /[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
  return regex.test(texto)
}

/**
 * Detecta URLs y dominios:
 *   "https://misitio.com"
 *   "www.misitio.com.ar"
 *   "wa.me/543344..."
 *   "bit.ly/abc123"
 *   "misitio.com" (dominio suelto)
 */
export function detectarURL(texto) {
  if (!texto || typeof texto !== 'string') return false

  // http(s):// con cualquier cosa después
  if (/https?:\/\/\S+/i.test(texto)) return true

  // www.algo
  if (/\bwww\.\S+/i.test(texto)) return true

  // Dominios sueltos: palabra.com / palabra.com.ar / palabra.net / etc
  // Excluye coincidencias con extensiones de archivo de imagen (.jpg, .png, etc.)
  const dominios = /\b[a-z0-9-]{2,}\.(com|ar|net|org|edu|gov|me|io|app|store|tienda|shop|info|biz|online|site|web|tk|ly|gl)(\.[a-z]{2,})?\b/i
  if (dominios.test(texto)) return true

  return false
}

/**
 * Detecta menciones de redes sociales y palabras clave.
 *
 *   "@miusuario_insta"
 *   "Instagram"
 *   "Mi WhatsApp"
 *   "Mandame mensaje a Facebook"
 *   "Te paso mi Telegram"
 *   "tiktok"
 */
export function detectarRedSocial(texto) {
  if (!texto || typeof texto !== 'string') return false

  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // Patrón 1: arroba seguida de palabra (típico Instagram/Twitter)
  if (/@[a-z0-9._]{3,}/i.test(texto)) return true

  // Patrón 2: nombres de redes (con variantes ofuscadas comunes)
  const palabrasRedes = [
    'whatsapp', 'whats app', 'wpp', 'wsp', 'wapp', 'watsap', 'guasap',
    'instagram', 'insta',
    'facebook', 'face book', 'messenger', 'mesenger',
    'telegram', 'telegrama',
    'tiktok', 'tik tok',
    'snapchat',
    'twitter',
    'discord'
  ]
  for (const p of palabrasRedes) {
    // Buscar como palabra completa (word boundary)
    const regex = new RegExp(`\\b${p.replace(/ /g, '\\s*')}\\b`, 'i')
    if (regex.test(t)) return true
  }

  return false
}

/**
 * Detecta frases típicas de evasión del marketplace:
 *   "contactame por fuera"
 *   "llamame al"
 *   "te paso mi"
 *   "comunicate al"
 *   "mandame mensaje a"
 */
export function detectarFraseEvasion(texto) {
  if (!texto || typeof texto !== 'string') return false

  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const frases = [
    /contactame\s+(por\s+)?fuera/i,
    /comunicate\s+(por|al|conmigo)/i,
    /llamame\s+(al|por)/i,
    /escribime\s+(al|a\s+mi)/i,
    /mandame\s+(mensaje|un\s+mensaje|wsp|whats|wpp)/i,
    /te\s+paso\s+mi\s+(numero|telefono|email|correo|whats|insta)/i,
    /fuera\s+de\s+(la\s+)?(app|aplicacion|plataforma|web|sitio)/i,
    /por\s+(fuera|afuera)\s+(de|del)/i,
    /mi\s+(numero|nro|telefono|cel|celular|whats)/i,
    /numero\s+de\s+(whats|telefono|contacto)/i
  ]

  for (const r of frases) {
    if (r.test(t)) return true
  }

  return false
}

// ============================================================
// VALIDACIÓN PRINCIPAL
// ============================================================

/**
 * Valida el contenido completo de una publicación (título + descripción).
 *
 * @param {Object} contenido - { titulo, descripcion }
 * @returns {Object} - { valido: boolean, motivos: string[] }
 */
export function validarPublicacion(contenido) {
  const motivos = []
  const texto = `${contenido.titulo || ''} ${contenido.descripcion || ''}`.trim()

  if (!texto) return { valido: true, motivos: [] }

  if (detectarTelefono(texto)) {
    motivos.push('No podés incluir números de teléfono en el título o descripción.')
  }
  if (detectarTelefonoEnLetras(texto)) {
    motivos.push('No podés incluir números de teléfono escritos en letras.')
  }
  if (detectarEmail(texto)) {
    motivos.push('No podés incluir direcciones de email en el título o descripción.')
  }
  if (detectarURL(texto)) {
    motivos.push('No podés incluir enlaces externos ni direcciones web.')
  }
  if (detectarRedSocial(texto)) {
    motivos.push('No podés mencionar redes sociales (WhatsApp, Instagram, Facebook, etc.) ni usuarios con @.')
  }
  if (detectarFraseEvasion(texto)) {
    motivos.push('No podés invitar a contactarte fuera del marketplace.')
  }

  return {
    valido: motivos.length === 0,
    motivos
  }
}

/**
 * Mensaje completo para mostrar al vendedor cuando rechazamos su publicación.
 * @param {string[]} motivos
 * @returns {string}
 */
export function construirMensajeRechazo(motivos) {
  if (motivos.length === 0) return ''
  const intro = 'No pudimos publicar tu producto por estas razones:'
  const lista = motivos.map(m => `• ${m}`).join('\n')
  const cierre =
    '\n\nPor la seguridad de los compradores, todas las consultas se hacen dentro de MercadoLocal. ' +
    'Cuando alguien te compre, vas a poder coordinar el envío por WhatsApp.'
  return `${intro}\n\n${lista}${cierre}`
}

// ============================================================
// CENSURA DE CONTENIDO (para mensajes de chat pre-venta)
// ============================================================

/**
 * Reemplaza contacto externo (teléfonos, emails, URLs, redes sociales) por
 * un placeholder. Se usa en mensajes de chat cuando todavía NO hay
 * transacción entre los usuarios — estilo Mercado Libre.
 *
 * @param {string} texto
 * @returns {{ textoCensurado: string, huboCensura: boolean, motivos: string[] }}
 */
export function censurarContacto(texto) {
  if (!texto || typeof texto !== 'string') {
    return { textoCensurado: texto || '', huboCensura: false, motivos: [] }
  }

  let resultado = texto
  const motivos = new Set()
  const REEMPLAZO = '[contacto oculto]'

  // 1. URLs (primero porque pueden contener arrobas o puntos)
  if (/https?:\/\/\S+/i.test(resultado)) {
    resultado = resultado.replace(/https?:\/\/\S+/gi, REEMPLAZO)
    motivos.add('enlace web')
  }
  if (/\bwww\.\S+/i.test(resultado)) {
    resultado = resultado.replace(/\bwww\.\S+/gi, REEMPLAZO)
    motivos.add('dirección web')
  }
  // Dominios sueltos: palabra.com / .com.ar / .net / etc
  const regexDominio = /\b[a-z0-9-]{2,}\.(com|ar|net|org|edu|gov|me|io|app|store|tienda|shop|info|biz|online|site|web|tk|ly|gl)(\.[a-z]{2,})?\b/gi
  if (regexDominio.test(resultado)) {
    resultado = resultado.replace(regexDominio, REEMPLAZO)
    motivos.add('dominio web')
  }

  // 2. Emails completos (capturar usuario + @ + dominio)
  // El dominio ya pudo haberse censurado antes, así que también capturamos "usuario@[contacto oculto]"
  if (/[a-z0-9._+-]+@(\[contacto oculto\]|[a-z0-9.-]+\.[a-z]{2,})/i.test(resultado)) {
    resultado = resultado.replace(/[a-z0-9._+-]+@(\[contacto oculto\]|[a-z0-9.-]+\.[a-z]{2,})/gi, REEMPLAZO)
    motivos.add('email')
  }

  // 3. Arrobas sueltas (Instagram, Twitter) — DESPUÉS de emails para no romper @
  resultado = resultado.replace(/@[a-z0-9._]{3,}/gi, (match) => {
    motivos.add('usuario de red social')
    return REEMPLAZO
  })

  // 4. Teléfonos (8+ dígitos consecutivos con o sin separadores)
  resultado = resultado.replace(/(\d[\s\-.()\\/+]*){8,}/g, (match) => {
    const digitos = match.replace(/\D/g, '')
    if (digitos.length >= 8) {
      motivos.add('número de teléfono')
      return REEMPLAZO
    }
    return match
  })

  // 5. Nombres de redes sociales como palabras
  const palabrasRedes = [
    'whatsapp', 'whats app', 'wpp', 'wsp', 'wapp', 'watsap', 'guasap',
    'instagram', 'insta',
    'facebook', 'face book', 'messenger', 'mesenger',
    'telegram', 'telegrama',
    'tiktok', 'tik tok',
    'snapchat', 'discord'
  ]
  for (const p of palabrasRedes) {
    const regex = new RegExp(`\\b${p.replace(/ /g, '\\s*')}\\b`, 'gi')
    if (regex.test(resultado)) {
      resultado = resultado.replace(regex, REEMPLAZO)
      motivos.add('mención de red social')
    }
  }

  // 6. Teléfonos en letras
  // ("uno dos tres cuatro cinco seis siete ocho" = "12345678")
  const palabrasNum = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const regexLetras = new RegExp(`(\\b(?:${palabrasNum.join('|')})\\s+){7,}\\b(?:${palabrasNum.join('|')})\\b`, 'gi')
  if (regexLetras.test(resultado)) {
    resultado = resultado.replace(regexLetras, REEMPLAZO)
    motivos.add('número en letras')
  }

  // Limpiar múltiples [contacto oculto] consecutivos
  resultado = resultado.replace(/(\[contacto oculto\][\s,.-]*){2,}/g, '[contacto oculto] ')

  const huboCensura = motivos.size > 0
  return {
    textoCensurado: resultado.trim(),
    huboCensura,
    motivos: [...motivos]
  }
}
