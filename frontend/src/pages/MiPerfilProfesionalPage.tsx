import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { subirImagenOptimizada } from '../utils/imageUpload'
import { LOCALIDADES, COBERTURA_TEXTO } from '../constants/localidades'

interface Perfil {
  _id: string
  usuario?: { _id: string; nombre: string; avatar: string }
  nombreNegocio: string
  rubro: string
  descripcion: string
  experiencia: string
  habilidades: string[]
  añosExperiencia: number
  localidad: string
  zonasCobertura: string[]
  matricula: string
  telefonoContacto: string
  verificado: boolean
  calificacion: number
  totalTrabajos: number
  conteoResenas: number
  media: { fotos: string[]; logo: string }
}

export default function MiPerfilProfesionalPage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [mode, setMode] = useState<'view' | 'edit' | 'subscribe'>('view')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [formData, setFormData] = useState({
    nombreNegocio: '',
    rubro: '',
    descripcion: '',
    experiencia: '',
    habilidades: [] as string[],
    añosExperiencia: 0,
    localidad: '',
    zonasCobertura: [] as string[],
    matricula: '',
    telefonoContacto: '',
    fotos: [] as string[],
    logo: ''
  })
  const [habilidadInput, setHabilidadInput] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
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
        nombreNegocio: res.data.nombreNegocio || '',
        rubro: res.data.rubro || '',
        descripcion: res.data.descripcion || '',
        experiencia: res.data.experiencia || '',
        habilidades: res.data.habilidades || [],
        añosExperiencia: res.data.añosExperiencia || 0,
        localidad: res.data.localidad || '',
        zonasCobertura: res.data.zonasCobertura || [],
        matricula: res.data.matricula || '',
        telefonoContacto: res.data.telefonoContacto || '',
        fotos: res.data.media?.fotos || [],
        logo: res.data.media?.logo || ''
      })
    } catch (e: any) {
      if (e.response?.status === 404) {
        // No tiene perfil aún → ir directo a crear
        setMode('edit')
        setPerfil(null)
      } else {
        setError(e.response?.data?.error || 'Error cargando perfil')
      }
    } finally {
      setCargando(false)
    }
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!formData.rubro || !formData.localidad) {
      setError('El rubro y la localidad son obligatorios')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        nombreNegocio: formData.nombreNegocio,
        rubro: formData.rubro,
        descripcion: formData.descripcion,
        experiencia: formData.experiencia,
        habilidades: formData.habilidades,
        añosExperiencia: Number(formData.añosExperiencia) || 0,
        localidad: formData.localidad,
        zonasCobertura: formData.zonasCobertura,
        matricula: formData.matricula,
        telefonoContacto: formData.telefonoContacto,
        fotos: formData.fotos,
        logo: formData.logo
      }

      // Si ya existe perfil → PATCH (actualizar). Si no → POST (crear).
      const res = perfil
        ? await api.patch('/servicios/perfil', payload)
        : await api.post('/servicios/perfil', payload)

      setPerfil(res.data)
      setMode('view')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function subirFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files || [])
    if (archivos.length === 0) return
    setSubiendoFoto(true)
    setError('')
    try {
      for (const archivo of archivos) {
        const resultado = await subirImagenOptimizada(archivo)
        setFormData(prev => ({ ...prev, fotos: [...prev.fotos, resultado.url] }))
      }
    } catch (err: any) {
      setError(err.message || 'Error al subir la foto')
    } finally {
      setSubiendoFoto(false)
      e.target.value = ''
    }
  }

  function quitarFoto(url: string) {
    setFormData(prev => ({ ...prev, fotos: prev.fotos.filter(f => f !== url) }))
  }

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendoLogo(true)
    setError('')
    try {
      const { url } = await subirImagenOptimizada(archivo)
      setFormData(prev => ({ ...prev, logo: url }))
    } catch (err: any) {
      setError(err.message || 'Error al subir la foto de perfil')
    } finally {
      setSubiendoLogo(false)
    }
  }

  function agregarHabilidad() {
    const h = habilidadInput.trim()
    if (h && !formData.habilidades.includes(h)) {
      setFormData(prev => ({ ...prev, habilidades: [...prev.habilidades, h] }))
    }
    setHabilidadInput('')
  }

  async function suscribirse() {
    try {
      const res = await api.post('/servicios/suscribir', { plan: planSeleccionado })
      // Guardamos el id de la suscripción para poder verificar el pago contra MP
      // cuando el usuario vuelva del checkout (/servicios/suscripcion-confirmada).
      if (res.data.suscripcionId) {
        localStorage.setItem('ml_suscripcion_pendiente', res.data.suscripcionId)
      }
      const urlMP = res.data.sandboxInitPoint || res.data.initPoint
      if (urlMP) {
        window.location.href = urlMP
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al procesar suscripción')
    }
  }

  // Datos para mostrar: nombre del negocio o nombre del usuario.
  // El avatar usa primero el logo del perfil profesional; si no, el avatar de la cuenta.
  const nombreMostrar = perfil?.nombreNegocio || perfil?.usuario?.nombre || usuario?.nombre || 'Profesional'
  const avatarMostrar = perfil?.media?.logo || perfil?.usuario?.avatar || usuario?.avatar || ''

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
            {perfil ? 'Editar' : 'Crear Perfil'}
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

        {/* View Mode (estilo Instagram) */}
        {mode === 'view' && !perfil && (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">💼</p>
            <p className="text-ml-muted mb-4">Todavía no creaste tu perfil profesional</p>
            <button
              onClick={() => setMode('edit')}
              className="mlbtn ml-grad text-white px-6 py-2.5 rounded-lg font-bold"
            >
              Crear mi perfil
            </button>
          </div>
        )}

        {mode === 'view' && perfil && (
          <div className="space-y-6">
            {/* Cabecera tipo Instagram */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-violet-50">
                  {avatarMostrar ? (
                    <img src={avatarMostrar} alt={nombreMostrar} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">👤</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                    <h2 className="text-2xl font-extrabold text-ml-ink">{nombreMostrar}</h2>
                    {perfil.verificado && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Verificado</span>
                    )}
                  </div>
                  <p className="text-ml-violet font-semibold capitalize mb-1">{perfil.rubro}</p>
                  <p className="text-sm text-ml-muted mb-4">📍 {perfil.localidad}</p>

                  {/* Stats tipo Instagram */}
                  <div className="flex items-center justify-center sm:justify-start gap-8">
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-ml-ink flex items-center gap-1 justify-center">
                        <span className="text-yellow-500">★</span>
                        {perfil.calificacion ? perfil.calificacion.toFixed(1) : '—'}
                      </p>
                      <p className="text-xs text-ml-muted">{perfil.conteoResenas} reseña{perfil.conteoResenas !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-ml-ink">{perfil.totalTrabajos}</p>
                      <p className="text-xs text-ml-muted">trabajos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-ml-ink">{perfil.añosExperiencia || 0}</p>
                      <p className="text-xs text-ml-muted">años exp.</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setMode('edit')}
                  className="px-5 py-2 border border-ml-violet text-ml-violet rounded-lg font-semibold hover:bg-violet-50 shrink-0"
                >
                  Editar
                </button>
              </div>

              {/* Descripción */}
              {perfil.descripcion && (
                <p className="text-ml-soft mt-6 leading-relaxed">{perfil.descripcion}</p>
              )}

              {/* Habilidades */}
              {perfil.habilidades && perfil.habilidades.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-4">
                  {perfil.habilidades.map(h => (
                    <span key={h} className="bg-violet-50 text-ml-violet border border-violet-100 px-3 py-1 rounded-full text-sm font-medium">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Experiencia / CV */}
            {perfil.experiencia && (
              <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 sm:p-8">
                <h3 className="text-lg font-bold text-ml-ink mb-3">📋 Experiencia y trayectoria</h3>
                <p className="text-ml-soft leading-relaxed whitespace-pre-line">{perfil.experiencia}</p>
              </div>
            )}

            {/* Galería de trabajos (Instagram-style grid) */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 sm:p-8">
              <h3 className="text-lg font-bold text-ml-ink mb-4">📸 Trabajos realizados</h3>
              {perfil.media?.fotos && perfil.media.fotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {perfil.media.fotos.map((url, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-ml-bg">
                      <img src={url} alt={`Trabajo ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ml-muted text-center py-6">
                  Todavía no subiste fotos de tus trabajos.
                  <button onClick={() => setMode('edit')} className="text-ml-violet font-semibold ml-1 hover:underline">
                    Agregar fotos
                  </button>
                </p>
              )}
            </div>

            {/* Datos de contacto/cobertura */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 sm:p-8 space-y-4">
              {perfil.zonasCobertura && perfil.zonasCobertura.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-ml-muted mb-2">Zonas de cobertura</p>
                  <div className="flex gap-2 flex-wrap">
                    {perfil.zonasCobertura.map(z => (
                      <span key={z} className="bg-ml-bg border border-ml-line px-3 py-1 rounded-full text-sm">📍 {z}</span>
                    ))}
                  </div>
                </div>
              )}
              {perfil.telefonoContacto && (
                <div>
                  <p className="text-sm font-semibold text-ml-muted mb-1">Teléfono</p>
                  <p className="text-ml-ink">{perfil.telefonoContacto}</p>
                </div>
              )}
              {perfil.matricula && (
                <div>
                  <p className="text-sm font-semibold text-ml-muted mb-1">Matrícula</p>
                  <p className="text-ml-ink">{perfil.matricula}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Mode */}
        {mode === 'edit' && (
          <form onSubmit={guardarPerfil} className="bg-white rounded-2xl shadow-sm border border-ml-line p-8 space-y-6">
            {/* Foto de perfil / logo */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Foto de perfil / logo</label>
              <p className="text-xs text-ml-muted mb-3">Esta imagen aparece como tu foto principal en el perfil y en la búsqueda.</p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-violet-100">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">👤</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg text-sm font-semibold hover:bg-violet-50 cursor-pointer">
                    {subiendoLogo ? 'Subiendo...' : (formData.logo ? 'Cambiar' : 'Subir foto')}
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      onChange={subirLogo}
                      disabled={subiendoLogo}
                      className="hidden"
                    />
                  </label>
                  {formData.logo && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                      className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-soft hover:bg-ml-bg"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nombre del negocio */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Nombre del negocio / cómo te presentás</label>
              <input
                type="text"
                value={formData.nombreNegocio}
                onChange={(e) => setFormData({ ...formData, nombreNegocio: e.target.value })}
                placeholder={`Ej: Plomería ${usuario?.nombre || 'González'} (si lo dejás vacío usamos tu nombre)`}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>

            {/* Rubro */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Rubro *</label>
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

            {/* Descripción corta */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Descripción corta</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Una línea sobre vos y tu servicio"
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-20"
              />
            </div>

            {/* Experiencia / CV */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Experiencia y trayectoria (tu CV)</label>
              <textarea
                value={formData.experiencia}
                onChange={(e) => setFormData({ ...formData, experiencia: e.target.value })}
                placeholder="Contá tu experiencia, en qué te especializás, trabajos destacados, certificaciones..."
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-32"
              />
            </div>

            {/* Años de experiencia */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Años de experiencia</label>
              <input
                type="number"
                min="0"
                value={formData.añosExperiencia}
                onChange={(e) => setFormData({ ...formData, añosExperiencia: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>

            {/* Habilidades */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Habilidades / especialidades</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={habilidadInput}
                  onChange={(e) => setHabilidadInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarHabilidad() } }}
                  placeholder="Ej: Destapaciones, Termotanques..."
                  className="flex-1 px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                />
                <button type="button" onClick={agregarHabilidad} className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg font-semibold hover:bg-violet-50">
                  Agregar
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {formData.habilidades.map(h => (
                  <span key={h} className="bg-violet-50 text-ml-violet border border-violet-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    {h}
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, habilidades: prev.habilidades.filter(x => x !== h) }))} className="text-ml-violet/60 hover:text-ml-violet">✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Localidad */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Localidad *</label>
              <select
                value={formData.localidad}
                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet bg-white"
              >
                <option value="">Elegí tu localidad</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Zonas de cobertura */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Zonas de cobertura</label>
              <p className="text-xs text-ml-muted mb-2">{COBERTURA_TEXTO}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOCALIDADES.map((loc) => {
                  const activa = formData.zonasCobertura.includes(loc)
                  return (
                    <button
                      type="button"
                      key={loc}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        zonasCobertura: activa
                          ? prev.zonasCobertura.filter(z => z !== loc)
                          : [...prev.zonasCobertura, loc]
                      }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${activa ? 'bg-ml-violet text-white border-ml-violet' : 'bg-white text-ml-ink border-ml-line hover:border-ml-violet'}`}
                    >
                      {activa ? '✓ ' : ''}{loc}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Teléfono de contacto (opcional)</label>
              <input
                type="tel"
                value={formData.telefonoContacto}
                onChange={(e) => setFormData({ ...formData, telefonoContacto: e.target.value })}
                placeholder="Ej: +54 9 221 123 4567"
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

            {/* Galería de fotos de trabajos */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">📸 Fotos de tus trabajos</label>
              <p className="text-xs text-ml-muted mb-3">Mostrá tu trabajo. Estas fotos aparecen en tu perfil como una galería.</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {formData.fotos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-ml-bg group">
                    <img src={url} alt={`Trabajo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarFoto(url)}
                      className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {/* Botón de subir */}
                <label className="aspect-square rounded-lg border-2 border-dashed border-ml-line flex flex-col items-center justify-center cursor-pointer hover:border-ml-violet hover:bg-violet-50 transition">
                  {subiendoFoto ? (
                    <div className="spinner" />
                  ) : (
                    <>
                      <span className="text-2xl text-ml-muted">+</span>
                      <span className="text-xs text-ml-muted mt-1">Agregar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    onChange={subirFotos}
                    disabled={subiendoFoto}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              {perfil && (
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="flex-1 py-3 bg-white border border-ml-line rounded-lg font-bold text-ml-soft hover:bg-ml-bg"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : perfil ? 'Guardar Cambios' : 'Crear mi perfil'}
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
                disabled={!perfil}
                className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
              >
                {perfil ? `Suscribirse a ${planes.find(p => p.id === planSeleccionado)?.nombre}` : 'Primero creá tu perfil'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
