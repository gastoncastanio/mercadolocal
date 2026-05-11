/**
 * Selector de modalidades de entrega — usado en PublicarProducto y MiTienda.
 *
 * MercadoLocal NO procesa pagos de envío. El costo del envío se coordina
 * directamente entre comprador y vendedor por chat / WhatsApp.
 * Más adelante integraremos API de Andreani para cotización automática.
 *
 * 3 modalidades disponibles, activables por separado:
 * - 🏪 Retiro en local (gratis, requiere dirección)
 * - 🛵 Envío propio (vendedor entrega, requiere zonas)
 * - 📦 Envío por correo (a coordinar con el comprador)
 *
 * Al menos UNA debe estar activa para poder publicar.
 */

import { EntregaProducto } from '../types'

interface Props {
  valor: EntregaProducto
  onChange: (nuevo: EntregaProducto) => void
}

export default function SelectorEntrega({ valor, onChange }: Props) {
  function toggleRetiro() {
    onChange({
      ...valor,
      retiroEnLocal: { ...valor.retiroEnLocal, activo: !valor.retiroEnLocal.activo }
    })
  }

  function toggleEnvioPropio() {
    onChange({
      ...valor,
      envioPropio: { ...valor.envioPropio, activo: !valor.envioPropio.activo }
    })
  }

  function toggleEnvioCorreo() {
    onChange({
      ...valor,
      envioCorreo: { ...valor.envioCorreo, activo: !valor.envioCorreo.activo }
    })
  }

  const algunaActiva =
    valor.retiroEnLocal.activo || valor.envioPropio.activo || valor.envioCorreo.activo

  return (
    <div className="space-y-3 border-t border-gray-100 pt-5">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-1">
          📦 Formas de entrega <span className="text-red-500">*</span>
        </h3>
        <p className="text-xs text-gray-500">
          Activá al menos una. El costo del envío lo coordinás directamente con el comprador
          (no se procesa por la app).
        </p>
      </div>

      {!algunaActiva && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            ⚠️ Activá al menos una forma de entrega para poder publicar.
          </p>
        </div>
      )}

      {/* ===== Retiro en local ===== */}
      <div
        className={`border-2 rounded-xl overflow-hidden transition-colors ${
          valor.retiroEnLocal.activo ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
        }`}
      >
        <button
          type="button"
          onClick={toggleRetiro}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏪</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">Retiro en mi local</p>
              <p className="text-[11px] text-gray-500">El comprador pasa a buscar el producto</p>
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              valor.retiroEnLocal.activo ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                valor.retiroEnLocal.activo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {valor.retiroEnLocal.activo && (
          <div className="px-4 pb-4 space-y-3 border-t border-blue-100 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Dirección de retiro <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={valor.retiroEnLocal.direccion}
                onChange={e =>
                  onChange({
                    ...valor,
                    retiroEnLocal: { ...valor.retiroEnLocal, direccion: e.target.value }
                  })
                }
                maxLength={200}
                placeholder="Ej: San Martín 123, Lobos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Horarios <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={valor.retiroEnLocal.horarios}
                onChange={e =>
                  onChange({
                    ...valor,
                    retiroEnLocal: { ...valor.retiroEnLocal, horarios: e.target.value }
                  })
                }
                maxLength={200}
                placeholder="Ej: Lunes a viernes 9-18 hs · Sábados 9-13 hs"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ===== Envío propio ===== */}
      <div
        className={`border-2 rounded-xl overflow-hidden transition-colors ${
          valor.envioPropio.activo ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
        }`}
      >
        <button
          type="button"
          onClick={toggleEnvioPropio}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛵</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">Envío propio</p>
              <p className="text-[11px] text-gray-500">Llevás el producto vos o con cadetería propia</p>
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              valor.envioPropio.activo ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                valor.envioPropio.activo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {valor.envioPropio.activo && (
          <div className="px-4 pb-4 space-y-3 border-t border-blue-100 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Zonas que cubrís <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={valor.envioPropio.zonas}
                onChange={e =>
                  onChange({
                    ...valor,
                    envioPropio: { ...valor.envioPropio, zonas: e.target.value }
                  })
                }
                maxLength={300}
                placeholder="Ej: Lobos centro y alrededores · Saladillo · Roque Pérez"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notas sobre tu envío <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={valor.envioPropio.notas}
                onChange={e =>
                  onChange({
                    ...valor,
                    envioPropio: { ...valor.envioPropio, notas: e.target.value }
                  })
                }
                maxLength={300}
                placeholder="Ej: Entregas martes y jueves · Costo aprox $1.500 según zona"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ===== Envío por correo / encomienda ===== */}
      <div
        className={`border-2 rounded-xl overflow-hidden transition-colors ${
          valor.envioCorreo.activo ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
        }`}
      >
        <button
          type="button"
          onClick={toggleEnvioCorreo}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">Envío por correo</p>
              <p className="text-[11px] text-gray-500">
                Andreani / OCA / Correo Argentino — a coordinar con el comprador
              </p>
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              valor.envioCorreo.activo ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                valor.envioCorreo.activo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {valor.envioCorreo.activo && (
          <div className="px-4 pb-4 space-y-2 border-t border-blue-100 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Empresas que usás <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={valor.envioCorreo.empresas}
                onChange={e =>
                  onChange({
                    ...valor,
                    envioCorreo: { ...valor.envioCorreo, empresas: e.target.value }
                  })
                }
                maxLength={200}
                placeholder="Ej: Andreani, OCA, Correo Argentino"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-gray-500 italic">
              💡 El costo del envío lo coordina y paga el comprador directamente con la empresa elegida.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
