import { useState } from 'react'
import { ParametrosPersonalizacion } from '../types'

interface PersonalizadorEstiloProps {
  onPersonalizar: (parametros: ParametrosPersonalizacion) => void;
  parametrosIniciales?: ParametrosPersonalizacion;
}

const COLORES_PREDEFINIDOS = [
  '#000000', '#FFFFFF', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#FF6B9D', '#00A86B', '#FF8C00', '#DC143C', '#1E90FF',
]

const TIPOGRAFIAS = [
  'Sans-serif',
  'Serif',
  'Monospace',
  'Display',
  'Script',
]

const ELEMENTOS = [
  'Símbolo abstracto',
  'Icono geométrico',
  'Tipografía inicial',
  'Forma orgánica',
  'Líneas dinámicas',
  'Patrón repetitivo',
  'Estrella',
  'Círculo',
]

export default function PersonalizadorEstilo({
  onPersonalizar,
  parametrosIniciales = {
    coloresPrimarios: ['#000000', '#FFFFFF'],
    complejidad: 'medio',
    orientacion: 'cuadrado',
  },
}: PersonalizadorEstiloProps) {
  const [parametros, setParametros] = useState<ParametrosPersonalizacion>(parametrosIniciales)

  const handleAgregarColor = (color: string) => {
    if (!parametros.coloresPrimarios.includes(color) && parametros.coloresPrimarios.length < 3) {
      setParametros({
        ...parametros,
        coloresPrimarios: [...parametros.coloresPrimarios, color],
      })
    }
  }

  const handleEliminarColor = (index: number) => {
    if (parametros.coloresPrimarios.length > 1) {
      setParametros({
        ...parametros,
        coloresPrimarios: parametros.coloresPrimarios.filter((_, i) => i !== index),
      })
    }
  }

  const handleSubmit = () => {
    onPersonalizar(parametros)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Personaliza tu Logo
        </h3>
        <p className="text-sm text-gray-600">
          Ajusta los parámetros para obtener exactamente lo que buscas
        </p>
      </div>

      {/* Colores */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Colores Principales (máximo 3)
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          {parametros.coloresPrimarios.map((color, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2"
            >
              <div
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm">{color}</span>
              {parametros.coloresPrimarios.length > 1 && (
                <button
                  onClick={() => handleEliminarColor(index)}
                  className="text-red-600 hover:text-red-800 ml-2"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {COLORES_PREDEFINIDOS.map((color) => (
            <button
              key={color}
              onClick={() => handleAgregarColor(color)}
              className={`w-12 h-12 rounded-lg border-2 transition ${
                parametros.coloresPrimarios.includes(color)
                  ? 'border-gray-400 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              title={color}
              disabled={
                !parametros.coloresPrimarios.includes(color) &&
                parametros.coloresPrimarios.length >= 3
              }
            />
          ))}
        </div>
      </div>

      {/* Tipografía */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Tipografía
        </label>
        <select
          value={parametros.tipografia || 'Sans-serif'}
          onChange={(e) =>
            setParametros({ ...parametros, tipografia: e.target.value })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {TIPOGRAFIAS.map((tip) => (
            <option key={tip} value={tip}>
              {tip}
            </option>
          ))}
        </select>
      </div>

      {/* Elementos */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Elementos Principales
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ELEMENTOS.map((elemento) => (
            <label key={elemento} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={parametros.elementos?.includes(elemento) || false}
                onChange={(e) => {
                  if (e.target.checked) {
                    setParametros({
                      ...parametros,
                      elementos: [...(parametros.elementos || []), elemento],
                    })
                  } else {
                    setParametros({
                      ...parametros,
                      elementos: (parametros.elementos || []).filter((el) => el !== elemento),
                    })
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">{elemento}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Complejidad */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Complejidad del Diseño
        </label>
        <div className="flex gap-3">
          {(['simple', 'medio', 'complejo'] as const).map((nivel) => (
            <button
              key={nivel}
              onClick={() => setParametros({ ...parametros, complejidad: nivel })}
              className={`flex-1 px-4 py-2 rounded-lg border-2 capitalize transition ${
                parametros.complejidad === nivel
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {nivel}
            </button>
          ))}
        </div>
      </div>

      {/* Orientación */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Orientación
        </label>
        <div className="flex gap-3">
          {(['horizontal', 'vertical', 'cuadrado'] as const).map((orientacion) => (
            <button
              key={orientacion}
              onClick={() => setParametros({ ...parametros, orientacion })}
              className={`flex-1 px-4 py-2 rounded-lg border-2 capitalize transition ${
                parametros.orientacion === orientacion
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {orientacion}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full btn btn-primary"
      >
        Generar Logos
      </button>
    </div>
  )
}
