import { useRef, useState } from 'react'
import { subirImagenOptimizada, UploadProgress } from '../utils/imageUpload'

// Convierte "X% Y%" → [x, y] numéricos (0–100). Default centro.
function parsePosicion(pos: string): [number, number] {
  const m = (pos || '50% 50%').match(/(-?\d+(?:\.\d+)?)%?\s+(-?\d+(?:\.\d+)?)%?/)
  if (!m) return [50, 50]
  return [Math.min(100, Math.max(0, Number(m[1]))), Math.min(100, Math.max(0, Number(m[2])))]
}

interface EncuadreProps {
  imagen: string
  posicion: string
  onChange: (imagen: string, posicion: string) => void
  aspecto?: string // clase tailwind, ej "aspect-[16/9]"
  label?: string
}

/**
 * Sube una foto del producto y deja "acomodarla" dentro de una portada de
 * proporción fija. No recorta el archivo original: guarda solo el punto focal
 * (object-position "X% Y%") para que la foto se vea bien encuadrada en la tarjeta
 * del Radar. El usuario arrastra el foco o usa los deslizadores.
 */
export function SubidaImagenEncuadre({ imagen, posicion, onChange, aspecto = 'aspect-[16/9]', label = 'Foto del producto' }: EncuadreProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const marcoRef = useRef<HTMLDivElement>(null)
  const [progreso, setProgreso] = useState<UploadProgress | null>(null)
  const [error, setError] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [posX, posY] = parsePosicion(posicion)

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const res = await subirImagenOptimizada(file, setProgreso)
      onChange(res.url, posicion || '50% 50%')
    } catch (err: any) {
      setError(err.message || 'No pudimos subir la imagen.')
    } finally {
      setProgreso(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Mueve el punto focal según dónde el usuario toca/arrastra dentro del marco.
  function moverFoco(clientX: number, clientY: number) {
    const marco = marcoRef.current
    if (!marco) return
    const r = marco.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))
    const y = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))
    onChange(imagen, `${Math.round(x)}% ${Math.round(y)}%`)
  }

  const subiendo = !!progreso && progreso.step !== 'completado'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ml-soft">{label}</p>

      {imagen ? (
        <>
          {/* Marco de encuadre: arrastrá para elegir qué parte se ve */}
          <div
            ref={marcoRef}
            className={`relative w-full ${aspecto} rounded-xl overflow-hidden border border-ml-line bg-ml-bg cursor-move select-none touch-none`}
            onPointerDown={e => { setArrastrando(true); e.currentTarget.setPointerCapture(e.pointerId); moverFoco(e.clientX, e.clientY) }}
            onPointerMove={e => { if (arrastrando) moverFoco(e.clientX, e.clientY) }}
            onPointerUp={() => setArrastrando(false)}
            onPointerCancel={() => setArrastrando(false)}
          >
            <img src={imagen} alt="Encuadre" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ objectPosition: `${posX}% ${posY}%` }} />
            {/* Indicador del punto focal */}
            <div
              className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-white shadow-md bg-white/20 backdrop-blur-sm pointer-events-none"
              style={{ left: `${posX}%`, top: `${posY}%` }}
            />
            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-md pointer-events-none">
              Arrastrá para encuadrar
            </div>
          </div>

          {/* Deslizadores finos */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="text-[11px] text-ml-muted">
              Horizontal
              <input type="range" min={0} max={100} value={posX} onChange={e => onChange(imagen, `${e.target.value}% ${posY}%`)} className="w-full accent-ml-violet" />
            </label>
            <label className="text-[11px] text-ml-muted">
              Vertical
              <input type="range" min={0} max={100} value={posY} onChange={e => onChange(imagen, `${posX}% ${e.target.value}%`)} className="w-full accent-ml-violet" />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="text-xs px-3 py-1.5 border border-ml-line rounded-lg text-ml-soft hover:border-ml-violet">
              🔄 Cambiar foto
            </button>
            <button type="button" onClick={() => onChange('', '50% 50%')} className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
              Quitar
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className={`w-full ${aspecto} rounded-xl border-2 border-dashed border-ml-line flex flex-col items-center justify-center gap-1 text-ml-muted hover:border-ml-violet hover:text-ml-violet transition-colors disabled:opacity-60`}
        >
          {subiendo ? (
            <>
              <div className="spinner" />
              <span className="text-xs">{progreso?.mensaje} {progreso?.porcentaje}%</span>
            </>
          ) : (
            <>
              <span className="text-3xl">📷</span>
              <span className="text-xs font-semibold">Subir foto del producto</span>
              <span className="text-[10px]">JPG, PNG o HEIC</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={elegirArchivo} />
    </div>
  )
}

interface LogoProps {
  logo: string
  onChange: (logo: string) => void
  label?: string
}

/**
 * Sube el logo redondo del comercio (portada de las tarjetas del Radar).
 */
export function SubidaLogo({ logo, onChange, label = 'Logo del comercio' }: LogoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progreso, setProgreso] = useState<UploadProgress | null>(null)
  const [error, setError] = useState('')

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const res = await subirImagenOptimizada(file, setProgreso)
      onChange(res.url)
    } catch (err: any) {
      setError(err.message || 'No pudimos subir el logo.')
    } finally {
      setProgreso(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const subiendo = !!progreso && progreso.step !== 'completado'

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="relative w-16 h-16 rounded-full border-2 border-dashed border-ml-line flex items-center justify-center overflow-hidden shrink-0 hover:border-ml-violet transition-colors disabled:opacity-60"
      >
        {logo ? (
          <img src={logo} alt="Logo" className="w-full h-full object-cover" />
        ) : subiendo ? (
          <div className="spinner" />
        ) : (
          <span className="text-2xl">🏪</span>
        )}
      </button>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ml-soft">{label}</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="text-xs text-ml-violet font-semibold hover:underline">
          {logo ? 'Cambiar logo' : 'Subir logo'}
        </button>
        {subiendo && <p className="text-[10px] text-ml-muted">{progreso?.mensaje} {progreso?.porcentaje}%</p>}
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={elegirArchivo} />
    </div>
  )
}
