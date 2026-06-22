import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { LOCALIDADES } from '../constants/localidades'

const rubros = ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros']

export default function PostarTrabajoPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    rubro: '',
    localidad: '',
    presupuestoMin: '',
    presupuestoMax: '',
    plazoEntrega: ''
  })
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function agregarSkill() {
    const s = skillInput.trim()
    if (s && !skills.includes(s)) setSkills([...skills, s])
    setSkillInput('')
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.titulo || !form.descripcion || !form.rubro || !form.localidad) {
      setError('Título, descripción, rubro y localidad son obligatorios')
      return
    }
    if (form.presupuestoMin && form.presupuestoMax && Number(form.presupuestoMin) > Number(form.presupuestoMax)) {
      setError('El presupuesto mínimo no puede ser mayor al máximo')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        titulo: form.titulo,
        descripcion: form.descripcion,
        rubro: form.rubro,
        localidad: form.localidad,
        presupuestoMin: form.presupuestoMin ? Number(form.presupuestoMin) : null,
        presupuestoMax: form.presupuestoMax ? Number(form.presupuestoMax) : null,
        plazoEntrega: form.plazoEntrega || null,
        skills
      }
      const res = await api.post('/servicios/trabajo', payload)
      navigate(`/trabajos/${res.data._id}`)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al publicar el trabajo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white mb-6 flex items-center gap-2">← Volver</button>
          <h1 className="text-3xl font-extrabold">Publicar un trabajo</h1>
          <p className="text-white/90 mt-2">Describí lo que necesitás. Los profesionales te van a ofertar y vos elegís la mejor opción.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        <form onSubmit={publicar} className="bg-white rounded-2xl shadow-sm border border-ml-line p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Título *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Reparar pérdida de agua en cocina"
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Descripción *</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Contá el detalle del trabajo: qué pasa, qué necesitás, materiales, etc."
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-32"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Rubro *</label>
              <select
                value={form.rubro}
                onChange={(e) => setForm({ ...form, rubro: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              >
                <option value="">Seleccioná un rubro</option>
                {rubros.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Localidad *</label>
              <select
                value={form.localidad}
                onChange={(e) => setForm({ ...form, localidad: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet bg-white"
              >
                <option value="">Elegí una localidad</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Presupuesto mín.</label>
              <input
                type="number"
                min="0"
                value={form.presupuestoMin}
                onChange={(e) => setForm({ ...form, presupuestoMin: e.target.value })}
                placeholder="$"
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Presupuesto máx.</label>
              <input
                type="number"
                min="0"
                value={form.presupuestoMax}
                onChange={(e) => setForm({ ...form, presupuestoMax: e.target.value })}
                placeholder="$"
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Fecha límite</label>
              <input
                type="date"
                value={form.plazoEntrega}
                onChange={(e) => setForm({ ...form, plazoEntrega: e.target.value })}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Habilidades requeridas (opcional)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSkill() } }}
                placeholder="Ej: Soldadura, Pintura látex..."
                className="flex-1 px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
              <button type="button" onClick={agregarSkill} className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg font-semibold hover:bg-violet-50">Agregar</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {skills.map(s => (
                <span key={s} className="bg-violet-50 text-ml-violet border border-violet-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter(x => x !== s))} className="text-ml-violet/60 hover:text-ml-violet">✕</button>
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
          >
            {guardando ? 'Publicando...' : 'Publicar trabajo'}
          </button>
        </form>
      </div>
    </div>
  )
}
