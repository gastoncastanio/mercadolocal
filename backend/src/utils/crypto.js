import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Derivar clave de encriptación del JWT_SECRET (o variable dedicada)
function getEncryptionKey() {
  const secret = process.env.MP_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) throw new Error('No hay clave de encriptación disponible')
  return crypto.createHash('sha256').update(secret).digest()
}

// Encriptar un string sensible (tokens MP, etc.)
export function encriptar(texto) {
  if (!texto) return ''
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(texto, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()

  // Formato: iv:tag:encrypted (todo en hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

// Desencriptar un string
export function desencriptar(textoEncriptado) {
  if (!textoEncriptado || !textoEncriptado.includes(':')) return textoEncriptado
  const key = getEncryptionKey()
  const parts = textoEncriptado.split(':')
  if (parts.length !== 3) return textoEncriptado

  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Verificar si un texto ya está encriptado (formato iv:tag:data)
export function estaEncriptado(texto) {
  if (!texto || typeof texto !== 'string') return false
  const parts = texto.split(':')
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32
}
