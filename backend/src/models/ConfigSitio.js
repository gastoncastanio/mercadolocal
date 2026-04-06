import mongoose from 'mongoose'

const configSitioSchema = new mongoose.Schema({
  clave: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  valor: {
    type: String,
    default: ''
  },
  tipo: {
    type: String,
    enum: ['texto', 'numero', 'boolean', 'imagen', 'html', 'color'],
    default: 'texto'
  },
  categoria: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  }
}, { timestamps: true })

export default mongoose.model('ConfigSitio', configSitioSchema)
