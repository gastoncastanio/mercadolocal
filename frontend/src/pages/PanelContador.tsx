import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

// ===================== TIPOS =====================
interface PanelData {
  generadoEn: string
  facturacion: {
    cantidad: number
    advertencia: string | null
    filas: Array<{
      fecha: string; numero: string; tipo: string
      receptorNombre: string; receptorCuit: string
      neto: number; iva: number; total: number
      fiscal: boolean; origen: string; estado: string
    }>
    totales: { neto: number; iva: number; total: number }
  }
  margenBruto: {
    ingresoComisiones: number; gmvInformativo: number
    costoProcesamientoMP_estimado: number; nota: string
    margenBruto: number; margenBrutoPorc: number
  }
  rentabilidad: {
    ingresos: number; egresos: number; resultadoNeto: number
    rentabilidadNeta: number
    desglosIngresos: Record<string, number>
    desgloseEgresos: Record<string, number>
  }
  breakEven: {
    costosFijos: number; margenContribucionPorc: number
    gmvBreakEven: number; gmvActual: number; comisionesActual: number
    porcentajeAlcanzado: number; faltante: number; superavit: number
  }
  cashFlow: {
    real: { disponible: number; aLiberar: number; total: number; etiqueta: string }
    informativo: { gmvTransaccionadoMes: number; gmvLiquidadoDirectoVendedor: number; etiqueta: string }
  }
  porCobrar: {
    mpALiberar: number
    suscripcionesEnReintento: { cantidad: number; monto: number }
    total: number
  }
  porPagar: {
    porPagarVendedores: number; notaVendedores: string
    ivaPorPagar: number; regimenFiscal: string; total: number
  }
  cuadre: {
    cuadra: boolean
    totalActivos?: number; totalPasivos?: number; totalPatrimonio?: number
    diferencia?: number; ecuacion?: string; error?: string
  }
  config: {
    costosFijosMensuales: number; regimenFiscal: string
    alicuotaIVA: number; costoProcesamientoMP: number; metaGMVMensual: number
  }
}

// ===================== HELPERS =====================
function pesos(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '$0'
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

const NOMBRES_CUENTAS: Record<string, string> = {
  '4.1.1': 'Comisiones por Venta',
  '4.1.2': 'Comisiones por Traslado',
  '4.1.3': 'Suscripciones Destacado',
  '4.1.4': 'Pauta Publicitaria',
  '4.1.5': 'Otros Ingresos',
  '5.1.1': 'Costo Procesamiento MP',
  '5.2.1': 'Marketing / Pauta',
  '5.2.2': 'Hosting e Infraestructura',
  '5.2.3': 'Honorarios Contables',
  '5.2.4': 'Otros Gastos'
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// ===================== COMPONENTE =====================
export default function PanelContador() {
  const ahora = new Date()
  const [anio, setAnio] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth() + 1) // 1-12
  const [data, setData] = useState<PanelData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await api.get(`/contador/panel?anio=${anio}&mes=${mes}`)
      setData(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cargar el panel. ¿Inicializaste el plan de cuentas?')
    } finally {
      setCargando(false)
    }
  }, [anio, mes])

  useEffect(() => { cargar() }, [cargar])

  async function exportarCSV() {
    if (!data) return
    const filas = [
      ['Fecha', 'Comprobante', 'Tipo', 'Receptor', 'CUIT', 'Neto', 'IVA', 'Total', 'Fiscal'],
      ...data.facturacion.filas.map(f => [
        fechaCorta(f.fecha), f.numero, f.tipo, f.receptorNombre, f.receptorCuit,
        String(f.neto), String(f.iva), String(f.total), f.fiscal ? 'Sí' : 'Interno'
      ])
    ]
    const csv = filas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `facturacion-${anio}-${String(mes).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-ml-bg p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-ml-ink">📊 Panel del Contador</h1>
            <p className="text-sm text-ml-muted mt-1">Libro mayor, rentabilidad y flujo de caja</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="text-sm text-ml-soft hover:text-ml-ink px-3 py-2">← Admin</Link>
            <select
              value={mes}
              onChange={e => setMes(parseInt(e.target.value))}
              className="border border-ml-line rounded-lg px-3 py-2 text-sm bg-white"
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={anio}
              onChange={e => setAnio(parseInt(e.target.value))}
              className="border border-ml-line rounded-lg px-3 py-2 text-sm bg-white"
            >
              {[ahora.getFullYear(), ahora.getFullYear() - 1, ahora.getFullYear() - 2].map(y =>
                <option key={y} value={y}>{y}</option>
              )}
            </select>
          </div>
        </div>

        {/* Estado de cuadre (banner) */}
        {data && (
          <div className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
            data.cuadre.cuadra ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <span className="text-2xl">{data.cuadre.cuadra ? '✅' : '🚨'}</span>
            <div className="text-sm">
              <p className={`font-semibold ${data.cuadre.cuadra ? 'text-green-800' : 'text-red-800'}`}>
                {data.cuadre.cuadra ? 'El libro mayor cuadra' : 'DESCUADRE DETECTADO'}
              </p>
              <p className={data.cuadre.cuadra ? 'text-green-700' : 'text-red-700'}>
                {data.cuadre.cuadra
                  ? `Activos = Pasivos + Patrimonio (${data.cuadre.ecuacion})`
                  : (data.cuadre.error || `Diferencia: ${pesos(data.cuadre.diferencia)}`)}
              </p>
            </div>
          </div>
        )}

        {cargando && <div className="text-center py-20 text-ml-muted">Cargando panel financiero…</div>}

        {error && !cargando && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
            <button onClick={cargar} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Reintentar</button>
          </div>
        )}

        {data && !cargando && (
          <div className="space-y-6">
            {/* ===== Fila de KPIs principales ===== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard titulo="Ingresos del mes" valor={pesos(data.rentabilidad.ingresos)} color="text-green-600" />
              <KpiCard titulo="Egresos (OPEX)" valor={pesos(data.rentabilidad.egresos)} color="text-red-600" />
              <KpiCard
                titulo="Resultado neto"
                valor={pesos(data.rentabilidad.resultadoNeto)}
                color={data.rentabilidad.resultadoNeto >= 0 ? 'text-green-600' : 'text-red-600'}
              />
              <KpiCard
                titulo="Rentabilidad"
                valor={`${data.rentabilidad.rentabilidadNeta}%`}
                color={data.rentabilidad.rentabilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}
              />
            </div>

            {/* ===== SECCIÓN 4: Punto de Equilibrio (velocímetro) ===== */}
            <Seccion titulo="🎯 Punto de Equilibrio" subtitulo="Cuánto GMV necesitás transaccionar para cubrir tus costos fijos">
              <Velocimetro porcentaje={data.breakEven.porcentajeAlcanzado} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                <Dato label="Costos fijos" valor={pesos(data.breakEven.costosFijos)} />
                <Dato label="Meta GMV (break-even)" valor={pesos(data.breakEven.gmvBreakEven)} />
                <Dato label="GMV actual" valor={pesos(data.breakEven.gmvActual)} />
                <Dato
                  label={data.breakEven.superavit > 0 ? 'Superávit' : 'Falta'}
                  valor={pesos(data.breakEven.superavit > 0 ? data.breakEven.superavit : data.breakEven.faltante)}
                  color={data.breakEven.superavit > 0 ? 'text-green-600' : 'text-amber-600'}
                />
              </div>
              <p className="text-xs text-ml-muted mt-3">
                Margen de contribución promedio: <strong>{data.breakEven.margenContribucionPorc}%</strong>
                {' '}(comisión / GMV). El break-even se recalcula con tus datos reales del mes.
              </p>
            </Seccion>

            {/* ===== SECCIÓN 5: Cash-Flow (real vs informativo) ===== */}
            <Seccion titulo="💰 Disponibilidad de Dinero" subtitulo="Tu plata real vs el volumen transaccionado">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Real */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">💵 Dinero Real (tuyo)</p>
                  <p className="text-3xl font-bold text-green-700 mt-2">{pesos(data.cashFlow.real.total)}</p>
                  <div className="mt-3 space-y-1 text-sm text-green-800">
                    <div className="flex justify-between"><span>Disponible</span><span>{pesos(data.cashFlow.real.disponible)}</span></div>
                    <div className="flex justify-between"><span>A liberar (clearing)</span><span>{pesos(data.cashFlow.real.aLiberar)}</span></div>
                  </div>
                  <p className="text-[11px] text-green-600 mt-3">{data.cashFlow.real.etiqueta}</p>
                </div>
                {/* Informativo */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">📊 GMV Transaccionado (informativo)</p>
                  <p className="text-3xl font-bold text-slate-600 mt-2">{pesos(data.cashFlow.informativo.gmvTransaccionadoMes)}</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Liquidado directo al vendedor</span><span>{pesos(data.cashFlow.informativo.gmvLiquidadoDirectoVendedor)}</span></div>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-3 font-medium">{data.cashFlow.informativo.etiqueta}</p>
                </div>
              </div>
            </Seccion>

            {/* ===== SECCIONES 2 + 3: Margen y Rentabilidad ===== */}
            <div className="grid md:grid-cols-2 gap-6">
              <Seccion titulo="📈 Margen Bruto" subtitulo="Ingreso por comisión vs costo de procesar">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-ml-muted">Ingreso comisiones</span><strong>{pesos(data.margenBruto.ingresoComisiones)}</strong></div>
                  <div className="flex justify-between"><span className="text-ml-muted">GMV (informativo)</span><span>{pesos(data.margenBruto.gmvInformativo)}</span></div>
                  <div className="flex justify-between"><span className="text-ml-muted">Costo MP estimado</span><span>{pesos(data.margenBruto.costoProcesamientoMP_estimado)}</span></div>
                  <div className="flex justify-between border-t border-ml-line pt-2 mt-2"><span className="font-semibold">Margen bruto</span><strong className="text-green-600">{pesos(data.margenBruto.margenBruto)} ({data.margenBruto.margenBrutoPorc}%)</strong></div>
                </div>
                <p className="text-[11px] text-ml-muted mt-3">{data.margenBruto.nota}</p>
              </Seccion>

              <Seccion titulo="🧮 Rentabilidad Neta" subtitulo="Ingresos − OPEX − impuestos">
                <div className="space-y-1.5 text-sm">
                  {Object.entries(data.rentabilidad.desglosIngresos).map(([c, v]) => (
                    <div key={c} className="flex justify-between text-green-700"><span>+ {NOMBRES_CUENTAS[c] || c}</span><span>{pesos(v)}</span></div>
                  ))}
                  {Object.entries(data.rentabilidad.desgloseEgresos).map(([c, v]) => (
                    <div key={c} className="flex justify-between text-red-600"><span>− {NOMBRES_CUENTAS[c] || c}</span><span>{pesos(v)}</span></div>
                  ))}
                  <div className="flex justify-between border-t border-ml-line pt-2 mt-2"><span className="font-semibold">Resultado neto</span><strong className={data.rentabilidad.resultadoNeto >= 0 ? 'text-green-600' : 'text-red-600'}>{pesos(data.rentabilidad.resultadoNeto)}</strong></div>
                </div>
              </Seccion>
            </div>

            {/* ===== SECCIONES 6 + 7: Por Cobrar / Por Pagar ===== */}
            <div className="grid md:grid-cols-2 gap-6">
              <Seccion titulo="📥 Dinero por Cobrar" subtitulo="Devengado, aún no disponible">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-ml-muted">MP a liberar (clearing)</span><strong>{pesos(data.porCobrar.mpALiberar)}</strong></div>
                  <div className="flex justify-between"><span className="text-ml-muted">Suscripciones en reintento ({data.porCobrar.suscripcionesEnReintento.cantidad})</span><span>{pesos(data.porCobrar.suscripcionesEnReintento.monto)}</span></div>
                  <div className="flex justify-between border-t border-ml-line pt-2 mt-2"><span className="font-semibold">Total por cobrar</span><strong className="text-blue-600">{pesos(data.porCobrar.total)}</strong></div>
                </div>
              </Seccion>

              <Seccion titulo="📤 Dinero por Pagar" subtitulo="Obligaciones pendientes">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-ml-muted">Por pagar a vendedores</span><strong>{pesos(data.porPagar.porPagarVendedores)}</strong></div>
                  <div className="flex justify-between"><span className="text-ml-muted">IVA débito fiscal ({data.porPagar.regimenFiscal})</span><span>{pesos(data.porPagar.ivaPorPagar)}</span></div>
                  <div className="flex justify-between border-t border-ml-line pt-2 mt-2"><span className="font-semibold">Total por pagar</span><strong className="text-red-600">{pesos(data.porPagar.total)}</strong></div>
                </div>
                <p className="text-[11px] text-amber-600 mt-3">{data.porPagar.notaVendedores}</p>
              </Seccion>
            </div>

            {/* ===== SECCIÓN 1: Facturación ===== */}
            <Seccion titulo="🧾 Facturación" subtitulo={`${data.facturacion.cantidad} comprobantes emitidos`}>
              {data.facturacion.advertencia && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
                  ⚠️ {data.facturacion.advertencia}
                </div>
              )}
              <div className="flex justify-end mb-3">
                <button onClick={exportarCSV} className="text-sm px-3 py-1.5 bg-ml-ink text-white rounded-lg hover:opacity-90">
                  ⬇️ Exportar CSV (Excel)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ml-muted border-b border-ml-line">
                      <th className="py-2 pr-4">Fecha</th>
                      <th className="py-2 pr-4">Comprobante</th>
                      <th className="py-2 pr-4">Tipo</th>
                      <th className="py-2 pr-4">Receptor</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.facturacion.filas.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-ml-muted">Sin comprobantes en el período</td></tr>
                    )}
                    {data.facturacion.filas.map((f, i) => (
                      <tr key={i} className="border-b border-ml-line2">
                        <td className="py-2 pr-4 whitespace-nowrap">{fechaCorta(f.fecha)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{f.numero}</td>
                        <td className="py-2 pr-4 capitalize">{f.tipo}</td>
                        <td className="py-2 pr-4">{f.receptorNombre || '—'}</td>
                        <td className="py-2 pr-4 text-right">{pesos(f.total)}</td>
                        <td className="py-2 text-center">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${f.fiscal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {f.fiscal ? 'Fiscal' : 'Interno'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {data.facturacion.filas.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold border-t-2 border-ml-line">
                        <td colSpan={4} className="py-2 text-right">Total facturado</td>
                        <td className="py-2 pr-4 text-right">{pesos(data.facturacion.totales.total)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Seccion>

            <p className="text-center text-xs text-ml-muted pt-4">
              Generado el {fechaCorta(data.generadoEn)} · Régimen: {data.config.regimenFiscal} · Costos fijos config: {pesos(data.config.costosFijosMensuales)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ===================== SUBCOMPONENTES =====================
function KpiCard({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-ml-line p-4">
      <p className="text-xs text-ml-muted">{titulo}</p>
      <p className={`text-xl md:text-2xl font-bold mt-1 ${color}`}>{valor}</p>
    </div>
  )
}

function Seccion({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-ml-line p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ml-ink">{titulo}</h2>
        {subtitulo && <p className="text-xs text-ml-muted mt-0.5">{subtitulo}</p>}
      </div>
      {children}
    </div>
  )
}

function Dato({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-ml-muted">{label}</p>
      <p className={`font-bold ${color || 'text-ml-ink'}`}>{valor}</p>
    </div>
  )
}

function Velocimetro({ porcentaje }: { porcentaje: number }) {
  // Clamp 0-100 para la barra visual, pero muestra el real (puede ser >100)
  const visual = Math.min(100, Math.max(0, porcentaje))
  const color = porcentaje >= 100 ? 'bg-green-500' : porcentaje >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div>
      <div className="flex items-end justify-between mb-1">
        <span className="text-3xl font-bold text-ml-ink">{porcentaje}%</span>
        <span className="text-xs text-ml-muted">de la meta de break-even</span>
      </div>
      <div className="h-4 bg-ml-bg rounded-full overflow-hidden border border-ml-line">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${visual}%` }} />
      </div>
    </div>
  )
}
