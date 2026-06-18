import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

interface DatosFiscalesPlataforma {
  nombre?: string
  cuit?: string
  condicionIVA?: string
  domicilio?: string
  ingresosBrutos?: string
  inicioActividades?: string
  email?: string
}

export default function ConfiguracionFiscal() {
  const toast = useToast()
  const [datos, setDatos] = useState<DatosFiscalesPlataforma>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [activa, setActiva] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const res = await api.get('/comprobantes/plataforma')
      setDatos(res.data || {})
      setActiva(!!res.data?.cuit) // Si hay CUIT, consideramos que está "activa"
    } catch (err) {
      toast.error('No se pudieron cargar los datos fiscales')
    } finally {
      setCargando(false)
    }
  }

  async function guardar() {
    setGuardando(true)
    try {
      const res = await api.put('/comprobantes/plataforma', datos)
      setDatos(res.data)
      setActiva(!!res.data?.cuit)
      toast.exito('Datos fiscales guardados correctamente')
    } catch {
      toast.error('Error al guardar los datos. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <div className="flex items-center justify-center min-h-screen"><div className="spinner" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-ml-ink text-lg mb-2">Datos fiscales de Mercado Local</h2>
        <p className="text-sm text-ml-muted">
          Estos datos se usan como <span className="font-semibold">emisor</span> en las facturas de pauta y comisión
          que le emitimos a los vendedores. Completalos correctamente antes de activar la facturación fiscal.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 p-6">
        {activa && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm mb-4">
            ✓ Datos fiscales cargados. Las facturas se emitirán a nombre de <span className="font-semibold">{datos.nombre}</span>.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-1">Nombre / Razón Social *</label>
            <input
              value={datos.nombre || ''}
              onChange={e => setDatos({ ...datos, nombre: e.target.value })}
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none"
              placeholder="Mercado Local SA"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-1">CUIT *</label>
            <input
              value={datos.cuit || ''}
              onChange={e => setDatos({ ...datos, cuit: e.target.value.replace(/[^\d]/g, '') })}
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none"
              placeholder="30712345678"
              maxLength={11}
            />
            <p className="text-[10px] text-ml-muted mt-1">11 dígitos, sin guiones</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-1">Condición fiscal *</label>
            <select
              value={datos.condicionIVA || ''}
              onChange={e => setDatos({ ...datos, condicionIVA: e.target.value })}
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none bg-white"
            >
              <option value="">— Elegí una opción —</option>
              <option value="Monotributo">Monotributo (Factura C, sin IVA)</option>
              <option value="Responsable Inscripto">Responsable Inscripto (Factura A, con IVA)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-1">Email de contacto</label>
            <input
              value={datos.email || ''}
              onChange={e => setDatos({ ...datos, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none"
              placeholder="info@mercadolocal.ar"
              type="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-1">Domicilio fiscal</label>
            <input
              value={datos.domicilio || ''}
              onChange={e => setDatos({ ...datos, domicilio: e.target.value })}
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none"
              placeholder="Av. Corrientes 1234, Buenos Aires"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-1">Ingresos Brutos</label>
            <input
              value={datos.ingresosBrutos || ''}
              onChange={e => setDatos({ ...datos, ingresosBrutos: e.target.value })}
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none"
              placeholder="123456789"
              maxLength={11}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ml-ink mb-1">Fecha de inicio de actividades</label>
            <input
              value={datos.inicioActividades || ''}
              onChange={e => setDatos({ ...datos, inicioActividades: e.target.value })}
              type="date"
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm focus:ring-2 focus:ring-ml-purple/30 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-6 py-2.5 ml-grad text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando…' : 'Guardar datos fiscales'}
          </button>
          <p className="text-[11px] text-ml-muted">* Campos requeridos</p>
        </div>
      </div>

      {/* Info sobre facturación */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm text-blue-900 mb-2">
          <span className="font-semibold">Sobre la facturación:</span>
        </p>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Estos datos aparecerán como <span className="font-mono font-semibold">emisor</span> en las facturas de pauta y comisión.</li>
          <li>Hoy se emiten como <span className="font-semibold">documentos internos</span> (sin CAE de ARCA).</li>
          <li>Cuando se conecte la facturación fiscal, automáticamente pasarán a tener CAE y serán válidas ante ARCA.</li>
          <li>No es necesario cambiar nada en el código ese día — basta con setear la variable de entorno.</li>
        </ul>
      </div>
    </div>
  )
}
