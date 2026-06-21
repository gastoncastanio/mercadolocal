import { useState, useEffect, useRef } from 'react'
import { buscarLugares, SugerenciaLugar } from '../utils/geo'

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
 * Input de ciudad con autocomplete geográfico (Nominatim/OSM). Al elegir una
 * sugerencia, guarda ciudad + coordenadas para que el mapa pueda dibujar el punto.
 *
 * Política Nominatim: debounce de 450ms y AbortController para no disparar una
 * petición por tecla. Si el usuario escribe a mano sin elegir sugerencia, se
 * guarda la ciudad como texto sin coords (el viaje igual es válido; solo no se
 * dibuja ese punto en el mapa).
 */
export default function BuscadorLugar({ valor, onChange, placeholder, className }: Props) {
  const [texto, setTexto] = useState(valor.ciudad || '')
  const [sugerencias, setSugerencias] = useState<SugerenciaLugar[]>([])
  const [abierto, setAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const elegidoRef = useRef(false) // evita re-buscar justo después de elegir
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Mantener el texto sincronizado si el valor cambia desde afuera (ej: reset del form).
  useEffect(() => { setTexto(valor.ciudad || '') }, [valor.ciudad])

  // Debounce de la búsqueda.
  useEffect(() => {
    if (elegidoRef.current) { elegidoRef.current = false; return }
    const q = texto.trim()
    if (q.length < 3) { setSugerencias([]); return }

    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setBuscando(true)
      const res = await buscarLugares(q, { limite: 6, signal: ctrl.signal })
      setBuscando(false)
      setSugerencias(res)
      setAbierto(res.length > 0)
    }, 450)
    return () => clearTimeout(t)
  }, [texto])

  // Cerrar el dropdown al clickear afuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function elegir(s: SugerenciaLugar) {
    elegidoRef.current = true
    setTexto(s.ciudad)
    setAbierto(false)
    setSugerencias([])
    onChange({ ciudad: s.ciudad, lat: s.lat, lng: s.lng })
  }

  function escribir(v: string) {
    setTexto(v)
    // Escribir a mano invalida las coordenadas previas (ya no corresponden).
    onChange({ ciudad: v, lat: null, lng: null })
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        value={texto}
        onChange={(e) => escribir(e.target.value)}
        onFocus={() => { if (sugerencias.length > 0) setAbierto(true) }}
        placeholder={placeholder}
        className={className || 'w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet'}
        autoComplete="off"
      />
      {valor.lat != null && valor.lng != null && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-sm" title="Ubicación en el mapa">📍</span>
      )}
      {abierto && (
        <ul className="absolute z-[1100] mt-1 w-full bg-white border border-ml-line rounded-lg shadow-lg max-h-56 overflow-auto">
          {buscando && <li className="px-3 py-2 text-xs text-ml-muted">Buscando…</li>}
          {sugerencias.map((s, i) => (
            <li
              key={`${s.nombre}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); elegir(s) }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-violet-50 border-b border-ml-line last:border-0"
            >
              <span className="font-semibold text-ml-ink">{s.ciudad}</span>
              <span className="block text-xs text-ml-muted truncate">{s.nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
