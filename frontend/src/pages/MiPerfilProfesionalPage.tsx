import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Perfil {
  _id: string
  rubro: string
  descripcion: string
  localidad: string
  zonasCobertura: string[]
  matricula: string
  media: { fotos: string[]; logo: string }
}

export default function MiPerfilProfesionalPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'view' | 'edit' | 'subscribe'>('view')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [formData, setFormData] = useState({
    rubro: '',
    descripcion: '',
    localidad: '',
    zonasCobertura: [] as string[],
    matricula: '',
    logo: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [planSeleccionado, setPlanSeleccionado] = useState('basico')

  const rubros = ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros']
  const planes = [
    { id: 'basico', nombre: '30 días', precio: 500 },
    { id: 'premium', nombre: '90 días', precio: 1200 }
  ]

  useEffect(() => {
    cargarPerfil()
  }, [])

  async function cargarPerfil() {
    setCargando(true)
    try {
      const res = await api.get('/servicios/perfil/me')
      setPerfil(res.data)
      setFormData({
        rubro: res.data.rubro,
        descripcion: res.data.descripcion,
        localidad: res.data.localidad,
        zonasCobertura: res.data.zonasCobertura,
        matricula: res.data.matricula || '',
        logo: res.data.media?.logo || ''
      })
    } catch (e: any) {
      if (e.response?.status === 404) {
        setMode('edit')
      }
      setError(e.response?.data?.error || 'Error cargando perfil')
    } finally {
      setCargando(false)
    }
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    try {
      const res = await api.patch('/servicios/perfil', {
        ...formData,
        fotos: [],
        logo: formData.logo
      })
      setPerfil(res.data)
      setMode('view')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function suscribirse() {
    try {
      const res = await api.post('/servicios/suscribir', { plan: planSeleccionado })
      // Redirigir a MercadoPago
      const urlMP = res.data.sandboxInitPoint || res.data.initPoint
      if (urlMP) {
        window.location.href = urlMP
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al procesar suscripción')
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="text-white/80 hover:text-white mb-6 flex items-center gap-2"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-extrabold">Mi Perfil Profesional</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-ml-line px-4">
        <div className="max-w-4xl mx-auto flex gap-8">
          <button
            onClick={() => setMode('view')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              mode === 'view'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            Mi Perfil
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              mode === 'edit'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            Editar
          </button>
          <button
            onClick={() => setMode('subscribe')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              mode === 'subscribe'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            Destacarse
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            {error}
          </p>
        )}

        {/* View Mode */}
        {mode === 'view' && perfil && (
          <div className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
              {perfil.media?.logo ? (
                <img src={perfil.media.logo} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <div className="text-6xl">💼</div>
              )}
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-extrabold text-ml-ink mb-4">
                {perfil.rubro.charAt(0).toUpperCase() + perfil.rubro.slice(1)}
              </h2>
              <p className="text-ml-soft mb-6">{perfil.descripcion}</p>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-ml-muted mb-1">Localidad</p>
                  <p className="text-ml-ink">{perfil.localidad}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ml-muted mb-2">Zonas de cobertura</p>
                  <div className="flex gap-2 flex-wrap">
                    {perfil.zonasCobertura.map(z => (
                      <span key={z} className="bg-ml-bg border border-ml-line px-3 py-1 rounded-full text-sm">
                        {z}
                      </span>
                    ))}
                  </div>
                </div>
                {perfil.matricula && (
                  <div>
                    <p className="text-sm font-semibold text-ml-muted mb-1">Matrícula</p>
                    <p className="text-ml-ink">{perfil.matricula}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setMode('edit')}
                className="mt-6 px-6 py-2 border border-ml-violet text-ml-violet rounded-lg font-semibold hover:bg-violet-50"
              >
                Editar Perfil
              </button>
            </div>
          </div>
        )}

        {/* Edit Mode */}
        {mode === 'edit' && (
          <form onSubmit={guardarPerfil} className="bg-white rounded-2xl shadow-sm border border-ml-line p-8 space-y-6">
            {/* Rubro */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Rubro</label>
              <select
                value={formData.rubro}
                onChange={(e) => setFormData({ ...formData, rubro: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              >
                <option value="">Selecciona un rubro</option>
                {rubros.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-24"
              />
            </div>

            {/* Localidad */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Localidad</label>
              <input
                type="text"
                value={formData.localidad}
                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>

            {/* Matrícula */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Matrícula (opcional)</label>
              <input
                type="text"
                value={formData.matricula}
                onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="flex-1 py-3 bg-white border border-ml-line rounded-lg font-bold text-ml-soft hover:bg-ml-bg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}

        {/* Subscribe Mode */}
        {mode === 'subscribe' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-8">
              <h2 className="text-2xl font-extrabold text-ml-ink mb-2">Destácate en la plataforma</h2>
              <p className="text-ml-soft mb-6">Suscribirse a un plan te coloca arriba de la lista y aumenta tu visibilidad.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {planes.map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => setPlanSeleccionado(plan.id)}
                    className={`p-6 border-2 rounded-xl cursor-pointer transition ${
                      planSeleccionado === plan.id
                        ? 'border-ml-violet bg-violet-50'
                        : 'border-ml-line hover:border-ml-violet'
                    }`}
                  >
                    <h3 className="font-bold text-lg text-ml-ink mb-2">{plan.nombre}</h3>
                    <p className="text-3xl font-extrabold text-ml-violet mb-2">
                      ${plan.precio.toLocaleString('es-AR')}
                    </p>
                    <p className="text-sm text-ml-muted">Renovación automática mensual</p>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-ml-soft space-y-2">
                <p>✓ Destaca en los primeros resultados</p>
                <p>✓ Renovación automática cada mes</p>
                <p>✓ Cancela cuando quieras</p>
              </div>

              <button
                onClick={suscribirse}
                className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold"
              >
                Suscribirse a {planes.find(p => p.id === planSeleccionado)?.nombre}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
