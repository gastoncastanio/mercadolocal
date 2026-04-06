import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer = null

export async function connectDB() {
  try {
    // Intentar conexión local primero
    const mongoUri = process.env.MONGODB_URI

    if (mongoUri && !mongoUri.includes('localhost')) {
      // URI remota (Atlas, etc.)
      await mongoose.connect(mongoUri)
      console.log('✅ MongoDB conectado (remoto)')
      return
    }

    // Usar MongoDB en memoria (no requiere instalación)
    console.log('🔄 Iniciando MongoDB en memoria...')
    mongoServer = await MongoMemoryServer.create()
    const memoryUri = mongoServer.getUri()

    await mongoose.connect(memoryUri)
    console.log('✅ MongoDB en memoria conectado exitosamente')
    console.log('ℹ️  Los datos se perderán al reiniciar (modo desarrollo)')

  } catch (error) {
    console.error('❌ Error al conectar MongoDB:', error.message)
    console.log('⚠️ Continuando sin base de datos')
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect()
    if (mongoServer) {
      await mongoServer.stop()
    }
    console.log('MongoDB desconectado')
  } catch (error) {
    console.error('Error al desconectar MongoDB:', error.message)
  }
}
