import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { subirImagenOptimizada, UploadProgress } from '../utils/imageUpload'
import { CATEGORIAS, getCategoria, requiereCodigoBarras } from '../constants/categorias'
import CamposCategoria, { CaracteristicaItem, validarCamposObligatorios } from '../components/CamposCategoria'
import SelectorEntrega from '../components/SelectorEntrega'
import { ENTREGA_VACIA, EntregaProducto } from '../types'

const MAX_IMAGENES = 6

export default function PublicarProducto() {
  const navigate = useNavigate()
  const { tienda } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '1',
    categorias: [] as string[],
    imagenes: [] as string[],
    marca: '',
    codigoBarras: ''
  })
  // Características específicas de la categoría (IMEI, talle, vencimiento, etc.)
  const [caracteristicas, setCaracteristicas] = useState<CaracteristicaItem[]>([])
  // Modalidades de entrega (retiro / envío propio / envío por correo)
  const [entrega, setEntrega] = useState<EntregaProducto>(ENTREGA_VACIA)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [progresoImagen, setProgresoImagen] = useState<UploadProgress | null>(null)
  const [subiendoCantidad, setSubiendoCantidad] = useState({ actual: 0, total: 0 })

  // Categorías centralizadas en /constants/categorias.ts
  // Solo se permite UNA categoría principal por producto (más profesional y mejor para filtros)
  // Si el vendedor cambia de categoría, mostramos los avisos legales asociados
  const categoriaSeleccionada = form.categorias[0]
    ? getCategoria(form.categorias[0])
    : undefined

  function seleccionarCategoria(catId: string) {
    setForm(prev => ({
      ...prev,
      // Reemplazo en lugar de toggle: solo una categoría principal
      categorias: prev.categorias[0] === catId ? [] : [catId]
    }))
    // Limpiar características al cambiar de categoría (cada una tiene sus campos)
    setCaracteristicas([])
  }

  /**
   * Sube las imágenes seleccionadas, una por una, con progreso visual.
   * Si una falla, muestra error pero sigue con las demás.
   */
  async function subirImagenes(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files || [])
    if (archivos.length === 0) return

    const espacioDisponible = MAX_IMAGENES - form.imagenes.length
    if (espacioDisponible <= 0) {
      toast.warning(`Ya tenés el máximo de ${MAX_IMAGENES} fotos`)
      return
    }

    const aSubir = archivos.slice(0, espacioDisponible)
    if (archivos.length > espacioDisponible) {
      toast.info(`Solo se subirán ${espacioDisponible} fotos (máximo permitido)`)
    }

    setSubiendoCantidad({ actual: 0, total: aSubir.length })

    for (let i = 0; i < aSubir.length; i++) {
      setSubiendoCantidad({ actual: i + 1, total: aSubir.length })
      try {
        const resultado = await subirImagenOptimizada(aSubir[i], (p) => {
          setProgresoImagen(p)
        })
        setForm(prev => ({ ...prev, imagenes: [...prev.imagenes, resultado.url] }))
      } catch (err: any) {
        toast.error(err.message || 'Error al subir una imagen')
      }
    }

    setProgresoImagen(null)
    setSubiendoCantidad({ actual: 0, total: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function eliminarImagen(idx: number) {
    setForm(prev => ({ ...prev, imagenes: prev.imagenes.filter((_, i) => i !== idx) }))
  }

  function moverImagenAprincipal(idx: number) {
    if (idx === 0) return
    setForm(prev => {
      const nuevas = [...prev.imagenes]
      const [movida] = nuevas.splice(idx, 1)
      nuevas.unshift(movida)
      return { ...prev, imagenes: nuevas }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nombre || !form.precio) {
      setError('Nombre y precio son obligatorios')
      return
    }

    if (form.categorias.length === 0) {
      setError('Elegí una categoría para tu producto')
      return
    }

    if (form.imagenes.length === 0) {
      setError('Subí al menos una foto del producto')
      return
    }

    // Validar campos personalizados obligatorios de la categoría
    if (categoriaSeleccionada) {
      const { labelsFaltantes } = validarCamposObligatorios(categoriaSeleccionada, caracteristicas)
      if (labelsFaltantes.length > 0) {
        setError(
          `Te faltan completar estos datos obligatorios:\n• ${labelsFaltantes.join('\n• ')}`
        )
        return
      }
    }

    // Validar modalidades de entrega: al menos una activa + campos requeridos
    const algunaEntrega =
      entrega.retiroEnLocal.activo || entrega.envioPropio.activo || entrega.envioCorreo.activo
    if (!algunaEntrega) {
      setError('Activá al menos una forma de entrega (retiro, envío propio o envío por correo).')
      return
    }
    if (entrega.retiroEnLocal.activo && entrega.retiroEnLocal.direccion.trim().length < 5) {
      setError('Si ofrecés retiro en local, indicá la dirección.')
      return
    }
    if (entrega.envioPropio.activo && entrega.envioPropio.zonas.trim().length < 3) {
      setError('Si ofrecés envío propio, indicá qué zonas cubrís.')
      return
    }

    setCargando(true)
    setError('')

    try {
      await api.post('/productos', {
        ...form,
        precio: Number(form.precio),
        stock: Number(form.stock),
        caracteristicas,
        entrega
      })
      toast.exito('Producto publicado correctamente')
      navigate('/mi-tienda')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al publicar')
    } finally {
      setCargando(false)
    }
  }

  // Bloqueo crítico: si no tiene Mercado Pago vinculado, no puede publicar
  // (los pagos caerían en cuenta admin sin trazabilidad del vendedor)
  if (tienda && !tienda.mpVinculado) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-orange-300 rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              Vinculá Mercado Pago para empezar a vender
            </h1>
            <p className="text-gray-700 mb-2">
              Para publicar productos necesitás conectar tu cuenta de Mercado Pago.
            </p>
            <p className="text-gray-600 mb-6 text-sm">
              Así los pagos de tus ventas se acreditan directamente en tu billetera, sin intermediarios.
            </p>
            <Link
              to="/central-vendedor"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#009ee3] text-white rounded-xl font-bold text-lg hover:bg-[#0087c9] transition-colors shadow-md"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
              </svg>
              Vincular Mercado Pago
            </Link>
            <p className="text-xs text-gray-500 mt-5">
              Es rápido y solo lo hacés una vez.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const subiendoActivo = progresoImagen !== null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Publicar Producto</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm whitespace-pre-line">
              {error}
            </div>
          )}

          {/* ===== Galería de fotos ===== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fotos del producto{' '}
              <span className="text-gray-400 font-normal">
                ({form.imagenes.length}/{MAX_IMAGENES})
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {/* Fotos ya subidas */}
              {form.imagenes.map((url, idx) => (
                <div key={url + idx} className="relative aspect-square group">
                  <img
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-full object-cover rounded-xl border border-gray-200"
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                      PRINCIPAL
                    </span>
                  )}
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => moverImagenAprincipal(idx)}
                      className="absolute bottom-1 left-1 bg-white/90 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-md shadow hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Marcar como principal"
                    >
                      Hacer principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminarImagen(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-sm font-bold shadow-md"
                    aria-label="Eliminar foto"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Botón de agregar / progreso */}
              {form.imagenes.length < MAX_IMAGENES && (
                <div
                  onClick={() => !subiendoActivo && fileInputRef.current?.click()}
                  className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                    subiendoActivo
                      ? 'border-blue-500 bg-blue-50 cursor-wait'
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                  }`}
                >
                  {subiendoActivo ? (
                    <div className="w-full px-2 text-center">
                      <div className="text-[11px] text-gray-700 mb-1.5 font-medium leading-tight">
                        {progresoImagen.mensaje}
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${progresoImagen.porcentaje}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {progresoImagen.porcentaje}%
                        {subiendoCantidad.total > 1 && (
                          <span> · {subiendoCantidad.actual}/{subiendoCantidad.total}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl mb-1">📷</span>
                      <span className="text-xs text-gray-500 font-medium text-center px-2">
                        Agregar foto
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Hasta {MAX_IMAGENES} fotos. La primera es la que ven primero los compradores.
              Aceptamos JPG, PNG y HEIC (iPhone).
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={subirImagenes}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto *</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={e => setForm({...form, nombre: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nombre del producto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm({...form, descripcion: e.target.value})}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Describe tu producto..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.precio}
                onChange={e => setForm({...form, precio: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={e => setForm({...form, stock: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Elegí la categoría que mejor describa tu producto.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIAS.map(cat => {
                const seleccionada = form.categorias[0] === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => seleccionarCategoria(cat.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border-2 text-left ${
                      seleccionada
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{cat.icono}</span>
                    <span className="text-xs leading-tight">{cat.nombre}</span>
                  </button>
                )
              })}
            </div>

            {/* Avisos legales de la categoría elegida */}
            {categoriaSeleccionada && categoriaSeleccionada.avisosLegales && categoriaSeleccionada.avisosLegales.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-900 mb-1.5">
                  ⚠️ Importante para esta categoría:
                </p>
                <ul className="space-y-1">
                  {categoriaSeleccionada.avisosLegales.map((aviso, i) => (
                    <li key={i} className="text-xs text-amber-800 leading-relaxed">• {aviso}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Si no permite pago integrado (ej: Automotor), avisar */}
            {categoriaSeleccionada && !categoriaSeleccionada.permitePago && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-900">
                  ℹ️ Esta categoría no permite pago integrado. Los compradores solo podrán contactarte para coordinar la operación.
                </p>
              </div>
            )}
          </div>

          {/* ===== Marca y Código de barras ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marca <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                maxLength={80}
                value={form.marca}
                onChange={e => setForm({ ...form, marca: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Samsung, Apple, Genérico"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de barras{' '}
                {categoriaSeleccionada && requiereCodigoBarras(categoriaSeleccionada.id) ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-gray-400 font-normal">(opcional)</span>
                )}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={14}
                value={form.codigoBarras}
                onChange={e => setForm({ ...form, codigoBarras: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="Ej: 7790070451095"
              />
            </div>
          </div>

          {/* Aviso cuando código es opcional pero útil */}
          {categoriaSeleccionada && !requiereCodigoBarras(categoriaSeleccionada.id) && (
            <p className="text-xs text-gray-500 -mt-2">
              💡 Si cargás el código de barras, tu producto aparece destacado y agrupado con otros vendedores que tengan el mismo producto.
            </p>
          )}

          {/* Aviso cuando código es obligatorio */}
          {categoriaSeleccionada && requiereCodigoBarras(categoriaSeleccionada.id) && (
            <div className="-mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900 leading-relaxed">
                <span className="font-semibold">⚠️ En esta categoría el código de barras es obligatorio.</span>{' '}
                Lo encontrás en la etiqueta del producto (13 dígitos típicamente).
                Nos sirve para verificar que el producto es original.
              </p>
            </div>
          )}

          {/* ===== Campos específicos de la categoría elegida ===== */}
          {categoriaSeleccionada && (
            <CamposCategoria
              categoria={categoriaSeleccionada}
              valores={caracteristicas}
              onChange={setCaracteristicas}
            />
          )}

          {/* ===== Modalidades de entrega ===== */}
          <SelectorEntrega valor={entrega} onChange={setEntrega} />

          <button
            type="submit"
            disabled={cargando || subiendoActivo}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {cargando ? 'Publicando...' : subiendoActivo ? 'Esperá que terminen las fotos...' : 'Publicar Producto'}
          </button>
        </form>
      </div>
    </div>
  )
}
