import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import api, { SOCKET_URL } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { subirImagenOptimizada, UploadProgress } from '../utils/imageUpload'
import { CATEGORIAS, getCategoria, requiereCodigoBarras } from '../constants/categorias'
import { LOCALIDADES, COBERTURA_TEXTO } from '../constants/localidades'
import CamposCategoria, { CaracteristicaItem, validarCamposObligatorios } from '../components/CamposCategoria'
import SelectorEntrega from '../components/SelectorEntrega'
import CalculadorCostos from '../components/CalculadorCostos'
import { ENTREGA_VACIA, EntregaProducto } from '../types'
import { Producto } from '../types'
import { OPCIONES_CUOTAS, valorCuotaSinInteres, formatPesos } from '../utils/cuotas'

export default function MiTienda() {
  const { tienda, actualizarTienda, refreshAccessToken } = useAuth()
  const toast = useToast()
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  // Nudge de adopción de cuotas sin interés (dismissible, recordado en localStorage)
  const [nudgeCuotasOculto, setNudgeCuotasOculto] = useState(() => localStorage.getItem('nudge_cuotas_oculto') === '1')
  const [editando, setEditando] = useState(false)
  // Edicion inline rapida de precio/stock
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null)
  const [editandoStockId, setEditandoStockId] = useState<string | null>(null)
  const [guardandoRapido, setGuardandoRapido] = useState(false)
  const [form, setForm] = useState({
    nombre: tienda?.nombre || '',
    nombreCorto: tienda?.nombreCorto || '',
    descripcion: tienda?.descripcion || '',
    ciudad: tienda?.ciudad || '',
    tipo: tienda?.tipo || 'online',
    telefono: tienda?.telefono || '',
    logo: tienda?.logo || ''
  })
  const [progresoLogo, setProgresoLogo] = useState<UploadProgress | null>(null)
  const [previewLogo, setPreviewLogo] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Compatibilidad con código que aún use subiendoLogo
  const subiendoLogo = progresoLogo !== null

  // Estado para editar/eliminar productos
  const [productoEditando, setProductoEditando] = useState<string | null>(null)
  const [productoEliminando, setProductoEliminando] = useState<string | null>(null)
  // Menu kebab (3 puntitos) abierto: ID del producto cuyo menu esta abierto
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '',
    categorias: [] as string[],
    imagenes: [] as string[],
    marca: '',
    codigoBarras: '',
    cuotasSinInteres: 1 as number
  })
  // Características específicas de la categoría (separadas del form porque
  // tienen su propio renderer y validación)
  const [editCaracteristicas, setEditCaracteristicas] = useState<CaracteristicaItem[]>([])
  // Modalidades de entrega (retiro / envío propio / envío por correo)
  const [editEntrega, setEditEntrega] = useState<EntregaProducto>(ENTREGA_VACIA)
  const [editError, setEditError] = useState('')
  const [editCargando, setEditCargando] = useState(false)
  const [progresoImagenEdit, setProgresoImagenEdit] = useState<UploadProgress | null>(null)
  const subiendoImagenEdit = progresoImagenEdit !== null
  const editFileRef = useRef<HTMLInputElement>(null)

  // Categorías centralizadas en /constants/categorias.ts (NO hardcodear acá)
  // Si tenés que agregar/sacar categorías, tocá ese archivo único.
  const categoriaSeleccionadaEdit = editForm.categorias[0]
    ? getCategoria(editForm.categorias[0])
    : undefined

  useEffect(() => {
    cargarProductos()
  }, [tienda])

  // Listeners de Socket.IO para sincronizacion en tiempo real
  useEffect(() => {
    if (!tienda) return
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })

    socket.on('producto:actualizado', (data: any) => {
      setProductos(prev => prev.map(p => p._id === data.id ? { ...p, ...data } : p))
    })

    socket.on('producto:eliminado', (data: any) => {
      setProductos(prev => prev.filter(p => p._id !== data.id))
    })

    return () => { socket.disconnect() }
  }, [tienda])

  async function cargarProductos() {
    if (!tienda) { setCargando(false); return }
    try {
      // Endpoint específico que retorna TODOS los productos del vendedor
      // (sin filtrar por mpVinculado, para que pueda ver/editar aunque no haya vinculado MP)
      const res = await api.get('/productos/mis-productos')
      setProductos(res.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setCargando(false)
    }
  }

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview local mientras se sube (mejora percepción de velocidad)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewLogo(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const resultado = await subirImagenOptimizada(file, (p) => setProgresoLogo(p))
      setForm(prev => ({ ...prev, logo: resultado.url }))
      toast.exito('Logo cargado')
    } catch (err: any) {
      toast.error(err.message || 'Error al subir el logo')
      setPreviewLogo(null)
    } finally {
      setProgresoLogo(null)
    }
  }

  function eliminarLogo() {
    setForm(prev => ({ ...prev, logo: '' }))
    setPreviewLogo(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function guardarTienda(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (tienda) {
        const res = await api.put('/tienda', form)
        actualizarTienda(res.data)
      } else {
        const res = await api.post('/tienda', form)
        actualizarTienda(res.data)
        // Recién abrió su tienda: el JWT actual todavía tiene tieneVendedor=false.
        // Refrescamos el access token para que las rutas de vendedor lo dejen pasar
        // sin necesidad de re-loguearse.
        await refreshAccessToken()
      }
      setEditando(false)
      setPreviewLogo(null)
      toast.exito('Tienda guardada')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  // Guardar rapido un campo (precio o stock) sin abrir el modal completo
  async function guardarCampoRapido(productoId: string, campo: 'precio' | 'stock', valor: number) {
    if (isNaN(valor) || valor < 0) {
      toast.error('Valor inválido')
      setEditandoPrecioId(null)
      setEditandoStockId(null)
      return
    }
    setGuardandoRapido(true)
    try {
      const producto = productos.find(p => p._id === productoId)
      if (!producto) return
      const res = await api.put(`/productos/${productoId}`, {
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: campo === 'precio' ? valor : producto.precio,
        stock: campo === 'stock' ? valor : producto.stock,
        imagenes: producto.imagenes,
        categorias: producto.categorias,
        // Preservar campos existentes (no pisarlos al editar inline)
        marca: producto.marca || '',
        codigoBarras: producto.codigoBarras || '',
        caracteristicas: producto.caracteristicas || []
        // NOTA: NO mandamos `entrega` acá — el backend solo valida entrega cuando viene definida.
        // Si la mandamos vacía romperíamos productos viejos que no la tienen configurada.
      })
      setProductos(prev => prev.map(p => p._id === productoId ? res.data : p))
      toast.exito(`${campo === 'precio' ? 'Precio' : 'Stock'} actualizado`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar')
    } finally {
      setGuardandoRapido(false)
      setEditandoPrecioId(null)
      setEditandoStockId(null)
    }
  }

  // ===== EDITAR PRODUCTO =====
  function abrirEditorProducto(producto: Producto) {
    setProductoEditando(producto._id)
    setEditForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio.toString(),
      stock: producto.stock.toString(),
      categorias: producto.categorias || [],
      imagenes: producto.imagenes || [],
      marca: producto.marca || '',
      codigoBarras: producto.codigoBarras || '',
      cuotasSinInteres: producto.cuotasSinInteres || 1
    })
    setEditCaracteristicas(producto.caracteristicas || [])
    // Cargar modalidades de entrega (productos viejos pueden no tenerlas)
    setEditEntrega(producto.entrega || ENTREGA_VACIA)
    setEditError('')
  }

  function cerrarEditorProducto() {
    setProductoEditando(null)
    setEditError('')
    setEditCargando(false)
  }

  async function subirImagenEdit(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditError('')
    try {
      const resultado = await subirImagenOptimizada(file, (p) => setProgresoImagenEdit(p))
      setEditForm(prev => ({ ...prev, imagenes: [resultado.url] }))
    } catch (err: any) {
      setEditError(err.message || 'Error al subir la imagen.')
    } finally {
      setProgresoImagenEdit(null)
    }
  }

  // Single-select: solo una categoría por producto (igual que PublicarProducto)
  function seleccionarCategoriaEdit(catId: string) {
    setEditForm(prev => ({
      ...prev,
      categorias: prev.categorias[0] === catId ? [] : [catId]
    }))
    // Limpiar características al cambiar de categoría (cada una tiene sus campos)
    setEditCaracteristicas([])
  }

  async function guardarProducto(e: React.FormEvent) {
    e.preventDefault()
    if (!productoEditando) return
    if (!editForm.nombre || !editForm.precio) {
      setEditError('Nombre y precio son obligatorios')
      return
    }

    // Validar campos personalizados obligatorios de la categoría
    if (categoriaSeleccionadaEdit) {
      const { labelsFaltantes } = validarCamposObligatorios(categoriaSeleccionadaEdit, editCaracteristicas)
      if (labelsFaltantes.length > 0) {
        setEditError(
          `Te faltan completar estos datos obligatorios:\n• ${labelsFaltantes.join('\n• ')}`
        )
        return
      }
    }

    // Validar modalidades de entrega
    const algunaEntrega =
      editEntrega.retiroEnLocal.activo || editEntrega.envioPropio.activo || editEntrega.envioCorreo.activo
    if (!algunaEntrega) {
      setEditError('Activá al menos una forma de entrega (retiro, envío propio o envío por correo).')
      return
    }
    if (editEntrega.retiroEnLocal.activo && editEntrega.retiroEnLocal.direccion.trim().length < 5) {
      setEditError('Si ofrecés retiro en local, indicá la dirección.')
      return
    }
    if (editEntrega.envioPropio.activo && editEntrega.envioPropio.zonas.trim().length < 3) {
      setEditError('Si ofrecés envío propio, indicá qué zonas cubrís.')
      return
    }

    setEditCargando(true)
    setEditError('')
    try {
      const res = await api.put(`/productos/${productoEditando}`, {
        ...editForm,
        precio: Number(editForm.precio),
        stock: Number(editForm.stock),
        caracteristicas: editCaracteristicas,
        entrega: editEntrega
      })
      setProductos(prev => prev.map(p => p._id === productoEditando ? res.data : p))
      cerrarEditorProducto()
      toast.exito('Producto actualizado')
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Error al guardar los cambios')
    } finally {
      setEditCargando(false)
    }
  }

  // ===== PAUSAR / REACTIVAR PRODUCTO =====
  // Togglea el campo activo. Cuando activo=false el producto desaparece del catalogo
  // publico pero sigue siendo visible para el dueno en MiTienda.
  async function toggleActivoProducto(producto: Producto) {
    try {
      const res = await api.put(`/productos/${producto._id}`, {
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        stock: producto.stock,
        imagenes: producto.imagenes,
        categorias: producto.categorias,
        marca: producto.marca || '',
        codigoBarras: producto.codigoBarras || '',
        caracteristicas: producto.caracteristicas || [],
        // NO mandamos entrega: solo togglemos activo, no editamos modalidades.
        activo: !producto.activo
      })
      setProductos(prev => prev.map(p => p._id === producto._id ? res.data : p))
      toast.exito(producto.activo ? 'Producto pausado' : 'Producto reactivado')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar')
    }
    setMenuAbierto(null)
  }

  // ===== ELIMINAR PRODUCTO =====
  async function eliminarProducto(productoId: string) {
    try {
      await api.delete(`/productos/${productoId}`)
      setProductos(prev => prev.filter(p => p._id !== productoId))
      setProductoEliminando(null)
      toast.exito('Producto eliminado')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar el producto')
    }
  }

  // ===== RENDER: Sin tienda =====
  if (!tienda && !editando) {
    return (
      <div className="min-h-screen bg-ml-bg flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg border border-ml-line p-12 max-w-md">
          <div className="w-20 h-20 bg-ml-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-ml-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0A2.997 2.997 0 017.5 6.2l.4-2.1A1.5 1.5 0 019.375 3h5.25a1.5 1.5 0 011.475 1.1l.4 2.1a2.997 2.997 0 014.5 3.149" />
            </svg>
          </div>
          <h2 className="font-display text-[24px] font-extrabold text-ml-ink mb-2">Crea tu Tienda</h2>
          <p className="text-ml-muted mb-6">Configura tu tienda para empezar a vender</p>
          <button onClick={() => setEditando(true)}
            className="px-6 py-3 mlbtn ml-grad text-white rounded-xl font-semibold">
            Crear Mi Tienda
          </button>
        </div>
      </div>
    )
  }

  // ===== RENDER: Editando tienda =====
  if (editando) {
    const logoSrc = previewLogo || form.logo
    return (
      <div className="min-h-screen bg-ml-bg py-8">
        <div className="max-w-lg mx-auto px-4">
          <h1 className="font-display text-[28px] font-extrabold text-ml-ink mb-8">{tienda ? 'Editar' : 'Crear'} Tienda</h1>
          <form onSubmit={guardarTienda} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-2">Logo de la tienda</label>
              {logoSrc ? (
                <div className="relative inline-block">
                  <img src={logoSrc} alt="Logo" className="w-32 h-32 rounded-2xl object-cover border-2 border-ml-line" />
                  {progresoLogo && (
                    <div className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center px-3">
                      <div className="text-white text-xs font-medium mb-2 text-center leading-tight">
                        {progresoLogo.mensaje}
                      </div>
                      <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${progresoLogo.porcentaje}%` }}
                        />
                      </div>
                      <div className="text-white text-[10px] mt-1">{progresoLogo.porcentaje}%</div>
                    </div>
                  )}
                  <button type="button" onClick={eliminarLogo}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-sm font-bold">x</button>
                </div>
              ) : (
                <div onClick={() => logoInputRef.current?.click()}
                  className="w-32 h-32 border-2 border-dashed border-ml-line rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <svg className="w-8 h-8 text-ml-muted mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <span className="text-ml-muted text-xs text-center">Subir logo</span>
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*,.heic,.heif" onChange={subirLogo} className="hidden" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-1">Nombre de la tienda</label>
              <input type="text" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-1">Nombre corto <span className="text-ml-muted font-normal">(opcional)</span></label>
              <input type="text" maxLength={40} value={form.nombreCorto} onChange={e => setForm({...form, nombreCorto: e.target.value})}
                placeholder="Cómo se muestra en las tarjetas (ej. tu marca)"
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none" />
              <p className="text-[11px] text-ml-muted mt-1">Si el nombre completo es largo, este se usa en las tarjetas de producto. Vacío = el nombre completo.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-1">Localidad</label>
              <select required value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})}
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none bg-white">
                <option value="">Elegí tu localidad</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <p className="text-xs text-ml-muted mt-1">{COBERTURA_TEXTO}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-1">Descripcion</label>
              <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={3}
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-1">Telefono</label>
              <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none" placeholder="Ej: +54 11 1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ml-ink mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value as 'online' | 'fisica' | 'ambas'})}
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none">
                <option value="online">Solo Online</option>
                <option value="fisica">Tienda Fisica</option>
                <option value="ambas">Ambas</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={subiendoLogo} className="flex-1 py-3 mlbtn ml-grad text-white rounded-xl font-semibold disabled:opacity-50">
                {subiendoLogo ? 'Esperando logo...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => { setEditando(false); setPreviewLogo(null) }} className="px-6 py-3 bg-ml-bg text-ml-ink rounded-xl font-semibold">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const logoUrl = tienda?.logo

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Info tienda */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt={tienda?.nombre} className="w-20 h-20 rounded-2xl object-cover border-2 border-ml-line" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ml-bg to-ml-bg flex items-center justify-center">
                  <svg className="w-10 h-10 text-ml-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0A2.997 2.997 0 017.5 6.2l.4-2.1A1.5 1.5 0 019.375 3h5.25a1.5 1.5 0 011.475 1.1l.4 2.1a2.997 2.997 0 014.5 3.149" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:font-display text-[28px] font-extrabold text-ml-ink">{tienda?.nombre}</h1>
                <p className="text-ml-muted mt-1 text-sm">{tienda?.ciudad} · {tienda?.tipo === 'online' ? 'Solo Online' : tienda?.tipo === 'fisica' ? 'Tienda Fisica' : 'Online + Fisica'}</p>
                {tienda?.descripcion && <p className="text-ml-soft mt-1 text-sm">{tienda.descripcion}</p>}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-ml-muted">Ganancias totales</p>
              <p className="text-2xl font-bold text-green-600">${tienda?.ganancias?.toLocaleString('es-AR') || 0}</p>
              <p className="text-xs text-ml-muted">{tienda?.totalVentas || 0} ventas</p>
              <button onClick={() => { setForm({nombre: tienda?.nombre||'', nombreCorto: tienda?.nombreCorto||'', descripcion: tienda?.descripcion||'', ciudad: tienda?.ciudad||'', tipo: tienda?.tipo||'online', telefono: tienda?.telefono||'', logo: tienda?.logo||''}); setEditando(true) }}
                className="mt-2 text-sm text-ml-blue hover:underline font-medium">Editar tienda</button>
            </div>
          </div>
        </div>

        {/* Banner: tienda sin Mercado Pago vinculado */}
        {tienda && !tienda.mpVinculado && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-2xl p-5 mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">⚠️</span>
                <div>
                  <h3 className="font-bold text-ml-ink text-base">
                    Tus productos NO son visibles en el catálogo público
                  </h3>
                  <p className="text-sm text-ml-ink mt-1">
                    Vinculá Mercado Pago para que los compradores puedan verlos y comprarlos. Los pagos se acreditan directamente en tu billetera.
                  </p>
                </div>
              </div>
              <Link
                to="/central-vendedor"
                className="flex-shrink-0 px-5 py-3 mlbtn bg-ml-mp text-white rounded-xl font-bold text-sm whitespace-nowrap"
              >
                Vincular Mercado Pago
              </Link>
            </div>
          </div>
        )}

        {/* Acceso a Ofertas Compartidas */}
        <Link
          to="/mi-tienda/ofertas-compartidas"
          className="flex items-center gap-3 p-4 mb-6 rounded-2xl border border-rose-200 bg-gradient-to-r from-pink-50 to-rose-50 hover:shadow-md transition-shadow"
        >
          <span className="text-3xl">🤝</span>
          <div className="flex-1">
            <p className="font-bold text-ml-ink">Ofertas Compartidas</p>
            <p className="text-xs text-ml-muted">La plataforma co-financia descuentos con vos. Revisá tus propuestas.</p>
          </div>
          <span className="text-rose-500 font-bold">→</span>
        </Link>

        {/* Productos */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ml-ink">Mis Productos ({productos.length})</h2>
          {tienda?.mpVinculado ? (
            <Link to="/publicar" className="flex items-center gap-2 px-4 py-2.5 mlbtn ml-grad text-white rounded-xl font-semibold text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Publicar
            </Link>
          ) : (
            <Link
              to="/central-vendedor"
              title="Vinculá Mercado Pago primero"
              className="flex items-center gap-2 px-4 py-2.5 bg-ml-bg border border-ml-line text-ml-muted rounded-xl font-semibold cursor-not-allowed text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Publicar
            </Link>
          )}
        </div>

        {/* Nudge: activá cuotas sin interés (es lo que más vende). Se muestra si
            hay productos sin cuotas y el vendedor no lo cerró. */}
        {!cargando && !nudgeCuotasOculto && productos.length > 0 && productos.some(p => (p.cuotasSinInteres || 1) <= 1) && (
          <div className="mb-6 flex items-start gap-3 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
            <span className="text-2xl leading-none mt-0.5">💳</span>
            <div className="flex-1 text-sm">
              <p className="font-bold text-ml-ink">Activá cuotas sin interés — es lo que más vende</p>
              <p className="text-ml-soft mt-0.5">
                Tenés {productos.filter(p => (p.cuotasSinInteres || 1) <= 1).length} producto(s) sin cuotas. Editá uno y elegí 3, 6 o 12 cuotas sin interés: el comprador paga lo mismo y vos ves el costo al instante.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { localStorage.setItem('nudge_cuotas_oculto', '1'); setNudgeCuotasOculto(true) }}
              className="text-ml-muted hover:text-ml-ink text-lg leading-none px-1"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="spinner" />
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-ml-line">
            <div className="w-16 h-16 bg-ml-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-ml-ink mb-2">No tienes productos</h3>
            <p className="text-ml-muted mb-4">Publica tu primer producto y empeza a vender</p>
            <Link to="/publicar" className="inline-block px-6 py-3 mlbtn ml-grad text-white rounded-xl font-semibold">
              Publicar Mi Primer Producto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {productos.map(p => (
              <div key={p._id} className="bg-white rounded-xl shadow-sm border border-ml-line2 overflow-hidden group relative">
                {/* Menu kebab (3 puntitos) en esquina superior derecha */}
                <div className="absolute top-2 right-2 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuAbierto(menuAbierto === p._id ? null : p._id)
                    }}
                    className="w-8 h-8 bg-white/95 backdrop-blur rounded-full shadow-md flex items-center justify-center hover:bg-white hover:shadow-lg transition-all"
                    aria-label="Más opciones"
                  >
                    <svg className="w-5 h-5 text-ml-ink" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                    </svg>
                  </button>

                  {menuAbierto === p._id && (
                    <>
                      {/* Backdrop invisible para cerrar al click afuera */}
                      <div className="fixed inset-0 z-20" onClick={() => setMenuAbierto(null)} />

                      {/* Dropdown menu */}
                      <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-2xl border border-ml-line2 overflow-hidden z-30 animate-dropdown-in">
                        <button
                          onClick={() => { abrirEditorProducto(p); setMenuAbierto(null) }}
                          className="w-full px-4 py-3 text-left text-sm text-ml-ink hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <svg className="w-4 h-4 text-ml-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                          Editar producto
                        </button>

                        <button
                          onClick={() => toggleActivoProducto(p)}
                          className="w-full px-4 py-3 text-left text-sm text-ml-ink hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-50"
                        >
                          {p.activo === false ? (
                            <>
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Reactivar producto
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pausar temporalmente
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => { setProductoEliminando(p._id); setMenuAbierto(null) }}
                          className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors border-t border-gray-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          Eliminar producto
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Imagen */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {p.imagenes[0] ? (
                    <img src={p.imagenes[0]} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </div>
                  )}
                  {/* Stock badge */}
                  {p.stock <= 0 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      Sin stock
                    </div>
                  )}
                  {p.stock > 0 && p.stock <= 3 && (
                    <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      Quedan {p.stock}
                    </div>
                  )}
                  {/* Overlay PAUSADO cuando el producto esta desactivado */}
                  {p.activo === false && (
                    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center pointer-events-none">
                      <span className="bg-gray-900 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">Pausado</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-ml-ink truncate">{p.nombre}</h3>
                  {/* Precio editable inline */}
                  {editandoPrecioId === p._id ? (
                    <input
                      type="number"
                      autoFocus
                      defaultValue={p.precio}
                      onBlur={(e) => guardarCampoRapido(p._id, 'precio', Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditandoPrecioId(null)
                      }}
                      className="text-ml-blue font-bold text-lg w-full px-2 py-1 border-2 border-blue-500 rounded-lg outline-none"
                      disabled={guardandoRapido}
                    />
                  ) : (
                    <button
                      onClick={() => setEditandoPrecioId(p._id)}
                      className="text-ml-blue font-bold text-lg hover:bg-blue-50 px-1 -ml-1 rounded transition-colors text-left w-full"
                      title="Click para editar precio"
                    >
                      ${p.precio.toLocaleString('es-AR')} <span className="text-xs text-gray-300 font-normal">✏</span>
                    </button>
                  )}
                  <div className="flex items-center gap-3 text-xs text-ml-muted mt-1">
                    {/* Stock editable inline */}
                    {editandoStockId === p._id ? (
                      <input
                        type="number"
                        autoFocus
                        min="0"
                        defaultValue={p.stock}
                        onBlur={(e) => guardarCampoRapido(p._id, 'stock', Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') setEditandoStockId(null)
                        }}
                        className="w-20 px-2 py-0.5 border-2 border-blue-500 rounded text-xs text-ml-ink outline-none"
                        disabled={guardandoRapido}
                      />
                    ) : (
                      <button
                        onClick={() => setEditandoStockId(p._id)}
                        className="hover:bg-gray-100 px-1 -ml-1 rounded transition-colors"
                        title="Click para editar stock"
                      >
                        Stock: {p.stock} <span className="text-ml-line">✏</span>
                      </button>
                    )}
                    <span>·</span>
                    <span>Ventas: {p.totalVentas}</span>
                  </div>
                  {p.categorias?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.categorias.slice(0, 2).map(cat => (
                        <span key={cat} className="text-[10px] bg-gray-100 text-ml-muted px-2 py-0.5 rounded-full">{cat}</span>
                      ))}
                    </div>
                  )}
                  {/* Las acciones (editar/pausar/eliminar) ahora viven en el menu kebab arriba a la derecha */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODAL: Editar Producto ===== */}
      {productoEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cerrarEditorProducto} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-ml-ink">Editar Producto</h2>
              <button onClick={cerrarEditorProducto} className="text-ml-muted hover:text-ml-soft p-1" aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={guardarProducto} className="p-6 space-y-4">
              {editError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm whitespace-pre-line">
                  {editError}
                </div>
              )}

              {/* Imagen */}
              <div>
                <label className="block text-sm font-medium text-ml-ink mb-2">Foto del producto</label>
                {editForm.imagenes[0] ? (
                  <div className="relative">
                    <img src={editForm.imagenes[0]} alt="Producto" className="w-full h-48 object-cover rounded-xl border border-ml-line" />
                    {progresoImagenEdit && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center px-6">
                        <div className="text-white text-sm font-medium mb-2 text-center">
                          {progresoImagenEdit.mensaje}
                        </div>
                        <div className="w-full max-w-[200px] h-2 bg-white/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${progresoImagenEdit.porcentaje}%` }}
                          />
                        </div>
                        <div className="text-white text-xs mt-1.5">{progresoImagenEdit.porcentaje}%</div>
                      </div>
                    )}
                    <button type="button" onClick={() => { setEditForm(prev => ({ ...prev, imagenes: [] })); if (editFileRef.current) editFileRef.current.value = '' }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 font-bold">x</button>
                  </div>
                ) : (
                  <div onClick={() => editFileRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-ml-line rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <svg className="w-8 h-8 text-ml-muted mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <span className="text-ml-muted text-sm font-medium">Subir foto</span>
                  </div>
                )}
                <input ref={editFileRef} type="file" accept="image/*,.heic,.heif" onChange={subirImagenEdit} className="hidden" />
              </div>

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Nombre *</label>
                <input type="text" required value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})}
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Descripcion</label>
                <textarea value={editForm.descripcion} onChange={e => setEditForm({...editForm, descripcion: e.target.value})} rows={3}
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ml-ink mb-1">Precio *</label>
                  <input type="number" required min="0" step="0.01" value={editForm.precio} onChange={e => setEditForm({...editForm, precio: e.target.value})}
                    className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ml-ink mb-1">Stock</label>
                  <input type="number" min="0" value={editForm.stock} onChange={e => setEditForm({...editForm, stock: e.target.value})}
                    className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none" />
                </div>
              </div>

              {/* Cuotas sin interés a ofrecer. El comprador paga el mismo total;
                  el vendedor absorbe el costo (visible en el neto de abajo). */}
              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Cuotas sin interés</label>
                <p className="text-xs text-ml-muted mb-2">
                  El comprador paga lo mismo en 1 pago o en cuotas. Vos absorbés el costo de financiación de Mercado Pago (mirá el neto y ajustá el precio si querés).
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {([1, ...OPCIONES_CUOTAS.filter(c => c > 1)] as number[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, cuotasSinInteres: c })}
                      className={`py-2.5 px-1 rounded-xl text-sm font-semibold transition-colors ${
                        editForm.cuotasSinInteres === c
                          ? 'bg-ml-purple text-white shadow'
                          : 'bg-white text-ml-ink border border-ml-line hover:border-ml-purple'
                      }`}
                    >
                      {c === 1 ? 'No ofrezco' : `${c} cuotas`}
                    </button>
                  ))}
                </div>
                {editForm.cuotasSinInteres > 1 && Number(editForm.precio) > 0 && (
                  <p className="text-xs text-green-700 font-semibold mt-2">
                    El comprador verá: {editForm.cuotasSinInteres} cuotas sin interés de ${formatPesos(valorCuotaSinInteres(Number(editForm.precio), editForm.cuotasSinInteres))}
                  </p>
                )}
              </div>

              {Number(editForm.precio) > 0 && (
                <CalculadorCostos precioProducto={Number(editForm.precio)} vista="vendedor" cuotasSinInteres={editForm.cuotasSinInteres} onAplicarPrecio={(p) => setEditForm({ ...editForm, precio: String(p) })} />
              )}

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-2">Categoría</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIAS.map(cat => {
                    const seleccionada = editForm.categorias[0] === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => seleccionarCategoriaEdit(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border-2 text-left ${
                          seleccionada
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-ml-line text-ml-ink hover:border-ml-line'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">{cat.icono}</span>
                        <span className="leading-tight">{cat.nombre}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Avisos legales de la categoría elegida */}
                {categoriaSeleccionadaEdit && categoriaSeleccionadaEdit.avisosLegales && categoriaSeleccionadaEdit.avisosLegales.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-900 mb-1.5">⚠️ Importante para esta categoría:</p>
                    <ul className="space-y-1">
                      {categoriaSeleccionadaEdit.avisosLegales.map((aviso, i) => (
                        <li key={i} className="text-xs text-amber-800 leading-relaxed">• {aviso}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ===== Marca y Código de barras ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ml-ink mb-1">
                    Marca <span className="text-ml-muted font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={editForm.marca}
                    onChange={e => setEditForm({ ...editForm, marca: e.target.value })}
                    className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none"
                    placeholder="Ej: Samsung, Genérico"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ml-ink mb-1">
                    Código de barras{' '}
                    {categoriaSeleccionadaEdit && requiereCodigoBarras(categoriaSeleccionadaEdit.id) ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-ml-muted font-normal">(opcional)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    value={editForm.codigoBarras}
                    onChange={e => setEditForm({ ...editForm, codigoBarras: e.target.value })}
                    className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none font-mono"
                    placeholder="Ej: 7790070451095"
                  />
                </div>
              </div>

              {/* ===== Campos específicos de la categoría elegida ===== */}
              {categoriaSeleccionadaEdit && (
                <CamposCategoria
                  categoria={categoriaSeleccionadaEdit}
                  valores={editCaracteristicas}
                  onChange={setEditCaracteristicas}
                />
              )}

              {/* ===== Modalidades de entrega ===== */}
              <SelectorEntrega valor={editEntrega} onChange={setEditEntrega} />

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editCargando || subiendoImagenEdit}
                  className="flex-1 py-3 mlbtn ml-grad text-white rounded-xl font-semibold  disabled:opacity-50 transition-colors">
                  {editCargando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button type="button" onClick={cerrarEditorProducto}
                  className="px-6 py-3 bg-ml-bg text-ml-ink rounded-xl font-semibold hover:bg-gray-300 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL: Confirmar Eliminacion ===== */}
      {productoEliminando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setProductoEliminando(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-ml-ink mb-2">Eliminar producto</h3>
            <p className="text-ml-muted text-sm mb-1">
              {productos.find(p => p._id === productoEliminando)?.nombre}
            </p>
            <p className="text-ml-muted text-xs mb-6">
              El producto dejara de aparecer en el catalogo. Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setProductoEliminando(null)}
                className="flex-1 py-2.5 bg-gray-100 text-ml-ink rounded-xl font-semibold hover:bg-ml-bg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarProducto(productoEliminando)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
