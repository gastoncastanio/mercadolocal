import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LOCALIDADES } from '../constants/localidades'

interface Profesional {
  _id: string
  usuarioId: string
  rubro: string
  descripcion: string
  localidad: string
  zonasCobertura: string[]
  verificado: boolean
  calificacion: number
  totalTrabajos: number
  conteoResenas: number
  media?: { fotos: string[]; logo: string }
  destacadoHasta?: string
  activo: boolean
}

export default function ServiciosPage() {
  const navigate = useNavigate()
  const { estaLogueado } = useAuth()
  const [rubroSeleccionado, setRubroSeleccionado] = useState('')
  const [localidadSeleccionada, setLocalidadSeleccionada] = useState('')
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const rubros = ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros']

  useEffect(() => {
    cargarProfesionales()
  }, [rubroSeleccionado, localidadSeleccionada])

  async function cargarProfesionales() {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (rubroSeleccionado) params.append('rubro', rubroSeleccionado)
      if (localidadSeleccionada) params.append('localidad', localidadSeleccionada)

      const res = await api.get(`/servicios/buscar?${params}`)
      setProfesionales(res.data.perfiles || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando profesionales')
      setProfesionales([])
    } finally {
      setCargando(false)
    }
  }

  const esDestacado = (prof: Profesional) => {
    if (!prof.destacadoHasta) return false
    return new Date(prof.destacadoHasta) > new Date()
  }

  // Separar destacados arriba
  const profesionalesDestacados = profesionales.filter(esDestacado)
  const profesionalesNormales = profesionales.filter(p => !esDestacado(p))

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-4">Servicios Locales</h1>
          <p className="text-lg text-white/90">Encontrá profesionales de confianza en tu zona</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-ml-line sticky top-0 z-40 py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rubro */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Rubro</label>
              <select
                value={rubroSeleccionado}
                onChange={(e) => setRubroSeleccionado(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              >
                <option value="">Todos los rubros</option>
                {rubros.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Localidad */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Localidad</label>
              <select
                value={localidadSeleccionada}
                onChange={(e) => setLocalidadSeleccionada(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet bg-white"
              >
                <option value="">Todas las localidades</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : profesionales.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-ml-muted">No hay profesionales disponibles con esos filtros</p>
          </div>
        ) : (
          <>
            {/* Destacados */}
            {profesionalesDestacados.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold text-ml-ink mb-4">⭐ Destacados</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profesionalesDestacados.map(prof => (
                    <TarjetaProfesional key={prof._id} profesional={prof} estaLogueado={estaLogueado} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Normales */}
            {profesionalesNormales.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-ml-ink mb-4">Profesionales</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profesionalesNormales.map(prof => (
                    <TarjetaProfesional key={prof._id} profesional={prof} estaLogueado={estaLogueado} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TarjetaProfesional({ profesional, estaLogueado, navigate }: any) {
  const estrellasVacias = '☆'.repeat(5 - Math.round(profesional.calificacion))
  const estrellas = '★'.repeat(Math.round(profesional.calificacion)) + estrellasVacias

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden hover:shadow-md transition">
      {/* Imagen/Logo */}
      <div className="h-40 bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center overflow-hidden">
        {profesional.media?.logo ? (
          <img src={profesional.media.logo} alt={profesional.rubro} className="h-full w-full object-cover" />
        ) : (
          <div className="text-5xl">💼</div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4">
        {/* Verificado */}
        {profesional.verificado && (
          <div className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
            ✓ Verificado
          </div>
        )}

        {/* Nombre/Rubro */}
        <h3 className="font-bold text-ml-ink mb-1">{profesional.rubro.charAt(0).toUpperCase() + profesional.rubro.slice(1)}</h3>
        <p className="text-xs text-ml-muted mb-2">{profesional.localidad}</p>

        {/* Descripción */}
        <p className="text-sm text-ml-soft mb-3 line-clamp-2">{profesional.descripcion}</p>

        {/* Calificación */}
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="text-yellow-500">{estrellas}</span>
          <span className="text-ml-muted">({profesional.conteoResenas})</span>
        </div>

        {/* Trabajos */}
        <p className="text-xs text-ml-muted mb-4">
          {profesional.totalTrabajos} trabajo{profesional.totalTrabajos !== 1 ? 's' : ''} completado{profesional.totalTrabajos !== 1 ? 's' : ''}
        </p>

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/servicios/perfil/${profesional.usuarioId}`)}
            className="flex-1 py-2 bg-ml-bg border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-line transition"
          >
            Ver Perfil
          </button>
          <button
            onClick={() => {
              if (!estaLogueado) {
                navigate('/login?redirect=/servicios')
                return
              }
              navigate(`/servicios/solicitud/${profesional.usuarioId}`)
            }}
            className="flex-1 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-semibold transition"
          >
            Cotizar
          </button>
        </div>
      </div>
    </div>
  )
}
