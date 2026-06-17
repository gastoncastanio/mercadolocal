import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer = null
let reconectandoTimer = null
const RECONEXION_DELAY_MS = 5000

// Configurar comportamiento global de Mongoose
mongoose.set('strictQuery', false)

// CRÍTICO (consistencia read-your-writes):
// Forzamos que TODAS las lecturas vayan al PRIMARIO y que escrituras y lecturas
// usen "majority". Sin esto, si la MONGODB_URI trae readPreference=secondary o
// nearest, el login puede leer una réplica ATRASADA y ver el hash VIEJO de la
// contraseña justo después de un reset exitoso. Síntoma exacto que tuvimos:
// "el reset dice que cambió la contraseña, pero al loguear la vieja sigue
// funcionando y la nueva no". Estas opciones a nivel de conexión sobrescriben
// cualquier readPreference embebido en la URI.
const OPCIONES_REMOTAS = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4, // IPv4 (evita problemas DNS)
  readPreference: 'primary',
  readConcern: { level: 'majority' },
  writeConcern: { w: 'majority' }
}

// Configurar listeners de la conexión una sola vez
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB: conexión establecida')
})

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error de conexión:', err.message)
})

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB desconectado. Mongoose intentará reconectar automáticamente.')
  // Mongoose tiene auto-reconexión, pero si la URI no se conecta inicialmente queremos
  // intentar de nuevo manualmente con backoff.
  if (process.env.MONGODB_URI && !reconectandoTimer) {
    reconectandoTimer = setTimeout(async () => {
      reconectandoTimer = null
      try {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGODB_URI, OPCIONES_REMOTAS)
        }
      } catch (err) {
        console.error('Reintento de conexión MongoDB falló:', err.message)
      }
    }, RECONEXION_DELAY_MS)
  }
})

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconectado')
})

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI
  const esProduccion = process.env.NODE_ENV === 'production'

  try {
    if (mongoUri && !mongoUri.includes('localhost')) {
      // URI remota (Atlas, Railway, etc.) — la opción preferida en producción
      await mongoose.connect(mongoUri, OPCIONES_REMOTAS)
      const rp = mongoose.connection.client?.options?.readPreference?.mode || 'primary'
      console.log(`✅ MongoDB conectado (remoto) | readPreference efectivo=${rp} | host=${mongoose.connection.host}`)
      return
    }

    if (esProduccion) {
      // En producción no permitimos MongoDB en memoria — fallar de forma explícita.
      throw new Error('En producción se requiere MONGODB_URI con una URI remota válida (no localhost).')
    }

    // Desarrollo: usar MongoDB en memoria si no hay URI remota
    console.log('🔄 Iniciando MongoDB en memoria (modo desarrollo)...')
    mongoServer = await MongoMemoryServer.create()
    const memoryUri = mongoServer.getUri()

    await mongoose.connect(memoryUri)
    console.log('✅ MongoDB en memoria conectado')
    console.log('ℹ️  Los datos se perderán al reiniciar (modo desarrollo)')
  } catch (error) {
    console.error('❌ Error al conectar MongoDB:', error.message)
    if (esProduccion) {
      // Sin BD la app no puede funcionar — fallar para que el orquestador reinicie.
      console.error('💀 La app no puede arrancar sin base de datos en producción. Saliendo.')
      process.exit(1)
    }
    // En desarrollo: relanzar para que el caller pueda manejarlo si quiere
    throw error
  }
}

export async function disconnectDB() {
  try {
    if (reconectandoTimer) {
      clearTimeout(reconectandoTimer)
      reconectandoTimer = null
    }
    await mongoose.disconnect()
    if (mongoServer) {
      await mongoServer.stop()
      mongoServer = null
    }
    console.log('MongoDB desconectado')
  } catch (error) {
    console.error('Error al desconectar MongoDB:', error.message)
  }
}
