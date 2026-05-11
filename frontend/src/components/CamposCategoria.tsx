/**
 * Componente reutilizable que renderiza dinámicamente los campos
 * personalizados de una categoría (definidos en /constants/categorias.ts).
 *
 * Cada campo se guarda como { clave, valor } en producto.caracteristicas.
 *
 * Se usa en:
 * - PublicarProducto.tsx (al crear)
 * - MiTienda.tsx (al editar producto en el modal)
 */

import { CampoCategoria, Categoria } from '../constants/categorias'

export interface CaracteristicaItem {
  clave: string
  valor: string
}

interface CamposCategoriaProps {
  categoria: Categoria
  valores: CaracteristicaItem[]
  onChange: (caracteristicas: CaracteristicaItem[]) => void
}

export default function CamposCategoria({ categoria, valores, onChange }: CamposCategoriaProps) {
  const campos = categoria.campos || []

  if (campos.length === 0) {
    return null
  }

  // Helper para obtener el valor actual de un campo
  function getValor(campoId: string): string {
    const item = valores.find(v => v.clave === campoId)
    return item?.valor || ''
  }

  // Helper para actualizar un campo (preserva los demás)
  function setValor(campoId: string, nuevoValor: string) {
    const filtrados = valores.filter(v => v.clave !== campoId)
    // Si nuevoValor está vacío, no lo guardamos (limpiamos el campo)
    if (nuevoValor === '') {
      onChange(filtrados)
      return
    }
    onChange([...filtrados, { clave: campoId, valor: nuevoValor }])
  }

  function renderCampo(campo: CampoCategoria) {
    const valor = getValor(campo.id)

    const labelComun = (
      <label htmlFor={`campo-${campo.id}`} className="block text-sm font-medium text-gray-700 mb-1">
        {campo.label}{' '}
        {campo.obligatorio ? (
          <span className="text-red-500">*</span>
        ) : (
          <span className="text-gray-400 font-normal text-xs">(opcional)</span>
        )}
      </label>
    )

    const ayuda = campo.ayuda && (
      <p className="text-xs text-gray-500 mt-1">{campo.ayuda}</p>
    )

    switch (campo.tipo) {
      case 'select':
        return (
          <div key={campo.id}>
            {labelComun}
            <select
              id={`campo-${campo.id}`}
              value={valor}
              onChange={e => setValor(campo.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Elegí una opción...</option>
              {campo.opciones?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {ayuda}
          </div>
        )

      case 'boolean':
        return (
          <div key={campo.id}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setValor(campo.id, valor === 'si' ? '' : 'si')}
                className={`mt-0.5 w-12 h-7 rounded-full transition-colors flex-shrink-0 relative ${
                  valor === 'si' ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-pressed={valor === 'si'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    valor === 'si' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {campo.label}{' '}
                  {campo.obligatorio && <span className="text-red-500">*</span>}
                </p>
                {ayuda}
              </div>
            </div>
          </div>
        )

      case 'numero':
        return (
          <div key={campo.id}>
            {labelComun}
            <input
              id={`campo-${campo.id}`}
              type="number"
              inputMode="numeric"
              value={valor}
              onChange={e => setValor(campo.id, e.target.value)}
              min={campo.min}
              max={campo.max}
              placeholder={campo.placeholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {ayuda}
          </div>
        )

      case 'fecha':
        return (
          <div key={campo.id}>
            {labelComun}
            <input
              id={`campo-${campo.id}`}
              type="date"
              value={valor}
              onChange={e => setValor(campo.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {ayuda}
          </div>
        )

      case 'textarea':
        return (
          <div key={campo.id}>
            {labelComun}
            <textarea
              id={`campo-${campo.id}`}
              value={valor}
              onChange={e => setValor(campo.id, e.target.value)}
              maxLength={campo.maxLength}
              placeholder={campo.placeholder}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {ayuda}
          </div>
        )

      case 'texto':
      default:
        return (
          <div key={campo.id}>
            {labelComun}
            <input
              id={`campo-${campo.id}`}
              type="text"
              value={valor}
              onChange={e => setValor(campo.id, e.target.value)}
              maxLength={campo.maxLength}
              placeholder={campo.placeholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {ayuda}
          </div>
        )
    }
  }

  return (
    <div className="space-y-4 border-t border-gray-100 pt-5">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-1">
          {categoria.icono} Datos específicos de {categoria.nombre.toLowerCase()}
        </h3>
        <p className="text-xs text-gray-500">
          Estos datos ayudan a los compradores a encontrar tu producto y a generar confianza.
        </p>
      </div>
      {campos.map(renderCampo)}
    </div>
  )
}

/**
 * Helper: valida que todos los campos obligatorios estén llenos.
 * Devuelve un array de IDs de campos que faltan.
 */
export function validarCamposObligatorios(
  categoria: Categoria,
  caracteristicas: CaracteristicaItem[]
): { faltantes: string[]; labelsFaltantes: string[] } {
  const campos = categoria.campos || []
  const faltantes: string[] = []
  const labelsFaltantes: string[] = []

  for (const campo of campos) {
    if (!campo.obligatorio) continue
    const item = caracteristicas.find(c => c.clave === campo.id)
    if (!item || !item.valor || item.valor.trim() === '') {
      faltantes.push(campo.id)
      labelsFaltantes.push(campo.label)
    }
  }

  return { faltantes, labelsFaltantes }
}
