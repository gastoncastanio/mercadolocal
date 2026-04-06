import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface ConfigItem {
  _id: string
  clave: string
  valor: string
  tipo: 'texto' | 'numero' | 'boolean' | 'imagen' | 'html' | 'color'
  categoria: string
  descripcion: string
}

const ICONOS_CATEGORIA: Record<string, string> = {
  'General': '\u2699\uFE0F',
  'Landing': '\uD83C\uDFE0',
  'Negocio': '\uD83D\uDCB0',
  'Contacto': '\uD83D\uDCDE',
  'SEO': '\uD83D\uDD0D',
  'Mensajes': '\uD83D\uDCAC',
  'Funcionalidades': '\u26A1',
}

export default function AdminCMS() {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState('General')
  const [cambios, setCambios] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarConfigs()
  }, [])

  async function cargarConfigs() {
    setCargando(true)
    try {
      const res = await api.get('/config')
      setConfigs(res.data)
    } catch (error: any) {
      if (error.response?.status === 403) {
        navigate('/admin')
      }
      // Si no hay configs, inicializar
      try {
        await api.post('/config/inicializar')
        const res = await api.get('/config')
        setConfigs(res.data)
      } catch {
        console.error('Error cargando configuraciones')
      }
    } finally {
      setCargando(false)
    }
  }

  function handleChange(clave: string, valor: string) {
    setCambios(prev => ({ ...prev, [clave]: valor }))
  }

  function getValor(config: ConfigItem) {
    return cambios[config.clave] !== undefined ? cambios[config.clave] : config.valor
  }

  async function guardarCambios() {
    const cambiosArray = Object.entries(cambios).map(([clave, valor]) => ({ clave, valor }))
    if (cambiosArray.length === 0) {
      setMensaje('No hay cambios para guardar')
      setTimeout(() => setMensaje(''), 3000)
      return
    }

    setGuardando(true)
    try {
      await api.put('/config', { cambios: cambiosArray })
      setMensaje(`\u2705 ${cambiosArray.length} configuraciones guardadas`)
      setCambios({})
      await cargarConfigs()
    } catch (err: any) {
      setMensaje('\u274C Error al guardar: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
      setTimeout(() => setMensaje(''), 4000)
    }
  }

  const categorias = [...new Set(configs.map(c => c.categoria))]
  const configsFiltradas = configs.filter(c => c.categoria === categoriaActiva)
  const totalCambios = Object.keys(cambios).length

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">&#x2699;&#xFE0F;</div>
          <p className="text-gray-500">Cargando configuraciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Panel de Configuraci&oacute;n</h1>
            <p className="text-gray-500 mt-1">Personalizá textos, colores y funcionalidades del marketplace</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
            >
              &larr; Dashboard
            </button>
            {totalCambios > 0 && (
              <button
                onClick={guardarCambios}
                disabled={guardando}
                className="px-6 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {guardando ? 'Guardando...' : `\uD83D\uDCBE Guardar (${totalCambios})`}
              </button>
            )}
          </div>
        </div>

        {/* Mensaje */}
        {mensaje && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${mensaje.includes('\u274C') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {mensaje}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar categorías */}
          <div className="col-span-12 md:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm p-4 sticky top-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wider">Categor&iacute;as</h3>
              <div className="space-y-1">
                {categorias.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoriaActiva(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors flex items-center gap-2 ${
                      categoriaActiva === cat
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{ICONOS_CATEGORIA[cat] || '\uD83D\uDCC4'}</span>
                    {cat}
                    {configs.filter(c => c.categoria === cat && cambios[c.clave] !== undefined).length > 0 && (
                      <span className="ml-auto w-2 h-2 bg-orange-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Campos de configuración */}
          <div className="col-span-12 md:col-span-9">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
                <span>{ICONOS_CATEGORIA[categoriaActiva] || '\uD83D\uDCC4'}</span>
                {categoriaActiva}
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                {categoriaActiva === 'General' && 'Configuraciones básicas del marketplace'}
                {categoriaActiva === 'Landing' && 'Textos e imágenes de la página de inicio'}
                {categoriaActiva === 'Negocio' && 'Comisiones, moneda y reglas del negocio'}
                {categoriaActiva === 'Contacto' && 'Información de contacto y redes sociales'}
                {categoriaActiva === 'SEO' && 'Optimización para motores de búsqueda'}
                {categoriaActiva === 'Mensajes' && 'Textos que ven los usuarios en distintos momentos'}
                {categoriaActiva === 'Funcionalidades' && 'Activar o desactivar funciones del sitio'}
              </p>

              <div className="space-y-5">
                {configsFiltradas.map(config => (
                  <div key={config._id} className="border-b border-gray-100 pb-5 last:border-0">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      {config.descripcion}
                    </label>
                    <p className="text-xs text-gray-400 mb-2">Clave: {config.clave}</p>

                    {config.tipo === 'boolean' ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleChange(config.clave, getValor(config) === 'true' ? 'false' : 'true')}
                          className={`relative w-14 h-7 rounded-full transition-colors ${
                            getValor(config) === 'true' ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            getValor(config) === 'true' ? 'translate-x-7' : 'translate-x-0.5'
                          }`} />
                        </button>
                        <span className={`text-sm font-medium ${getValor(config) === 'true' ? 'text-green-600' : 'text-gray-400'}`}>
                          {getValor(config) === 'true' ? 'Activado' : 'Desactivado'}
                        </span>
                      </div>
                    ) : config.tipo === 'color' ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={getValor(config) || '#000000'}
                          onChange={e => handleChange(config.clave, e.target.value)}
                          className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={getValor(config)}
                          onChange={e => handleChange(config.clave, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="#000000"
                        />
                      </div>
                    ) : config.tipo === 'numero' ? (
                      <input
                        type="number"
                        value={getValor(config)}
                        onChange={e => handleChange(config.clave, e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : config.tipo === 'imagen' ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={getValor(config)}
                          onChange={e => handleChange(config.clave, e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="URL de la imagen"
                        />
                        {getValor(config) && (
                          <img src={getValor(config)} alt="Preview" className="h-20 rounded-lg object-cover" />
                        )}
                      </div>
                    ) : config.tipo === 'html' ? (
                      <textarea
                        value={getValor(config)}
                        onChange={e => handleChange(config.clave, e.target.value)}
                        rows={5}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
                        placeholder="HTML content..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={getValor(config)}
                        onChange={e => handleChange(config.clave, e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder={config.descripcion}
                      />
                    )}

                    {cambios[config.clave] !== undefined && (
                      <p className="text-xs text-orange-500 mt-1">&#x26A0;&#xFE0F; Modificado (sin guardar)</p>
                    )}
                  </div>
                ))}
              </div>

              {totalCambios > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={guardarCambios}
                    disabled={guardando}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {guardando ? 'Guardando...' : `\uD83D\uDCBE Guardar ${totalCambios} cambio${totalCambios > 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
