import { LOCALIDADES_INFO } from '../constants/localidades'

export interface LugarSeleccionado {
  ciudad: string
  lat: number | null
  lng: number | null
}

interface Props {
  valor: LugarSeleccionado
  onChange: (lugar: LugarSeleccionado) => void
  placeholder?: string
  className?: string
}

/**
 * Selector de localidad LIMITADO a las localidades donde MercadoLocal opera
 * (General Las Heras, Cañuelas, Lobos, Navarro, Roque Pérez). Reemplaza al
 * autocompletado libre en los flujos de viajes: así nadie puede cargar un
 * origen/destino fuera del área de cobertura. Devuelve la ciudad + sus
 * coordenadas para que el mapa de rumbo siga funcionando.
 */
export default function SelectorLocalidad({ valor, onChange, placeholder, className }: Props) {
  function elegir(nombre: string) {
    const info = LOCALIDADES_INFO.find((l) => l.nombre === nombre)
    if (!info) {
      onChange({ ciudad: '', lat: null, lng: null })
      return
    }
    onChange({ ciudad: info.nombre, lat: info.lat, lng: info.lng })
  }

  return (
    <select
      value={valor.ciudad || ''}
      onChange={(e) => elegir(e.target.value)}
      className={className || 'w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet bg-white'}
    >
      <option value="">{placeholder || 'Elegí una localidad'}</option>
      {LOCALIDADES_INFO.map((l) => (
        <option key={l.nombre} value={l.nombre}>{l.nombre}</option>
      ))}
    </select>
  )
}
