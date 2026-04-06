import { useState } from 'react'
import { Proyecto } from '../types'

interface FormularioMarcaProps {
  onSubmit: (datos: Partial<Proyecto>) => void;
  loading?: boolean;
}

export default function FormularioMarca({ onSubmit, loading = false }: FormularioMarcaProps) {
  const [nombreMarca, setNombreMarca] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [valores, setValores] = useState([''])

  const handleAgregarValor = () => {
    setValores([...valores, ''])
  }

  const handleEliminarValor = (index: number) => {
    setValores(valores.filter((_, i) => i !== index))
  }

  const handleCambiarValor = (index: number, valor: string) => {
    const nuevosValores = [...valores]
    nuevosValores[index] = valor
    setValores(nuevosValores)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreMarca.trim() || !descripcion.trim()) {
      alert('Por favor completa los campos requeridos')
      return
    }

    onSubmit({
      nombreMarca: nombreMarca.trim(),
      descripcion: descripcion.trim(),
      valores: valores.filter((v) => v.trim()),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre de tu Marca *
        </label>
        <input
          type="text"
          value={nombreMarca}
          onChange={(e) => setNombreMarca(e.target.value)}
          placeholder="Ej: TechStart, MercadoHub"
          maxLength={50}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción de tu Negocio *
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe brevemente qué hace tu empresa, producto o servicio"
          rows={4}
          maxLength={500}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        <p className="text-sm text-gray-500 mt-1">{descripcion.length}/500</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Valores de tu Marca (opcional)
        </label>
        <p className="text-sm text-gray-600 mb-3">
          Agrega palabras clave que describan tu marca (ej: innovación, confianza, calidad)
        </p>
        <div className="space-y-2">
          {valores.map((valor, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={valor}
                onChange={(e) => handleCambiarValor(index, e.target.value)}
                placeholder="Ej: Innovación"
                maxLength={30}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              {valores.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleEliminarValor(index)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  disabled={loading}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAgregarValor}
          className="mt-3 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
          disabled={loading}
        >
          + Agregar valor
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn btn-primary disabled:opacity-50"
      >
        {loading ? 'Cargando...' : 'Continuar'}
      </button>
    </form>
  )
}
