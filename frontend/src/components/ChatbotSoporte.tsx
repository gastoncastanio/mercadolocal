import { useState, useRef, useEffect } from 'react'

interface Mensaje {
  texto: string
  esBot: boolean
}

const FAQ: Record<string, string> = {
  'como comprar': 'Para comprar: 1) Busca el producto en el catalogo, 2) Agregalo al carrito, 3) Anda al checkout, 4) Completa tus datos de entrega, 5) Paga con Mercado Pago. Tu dinero queda protegido hasta que confirmes la entrega.',
  'como vender': 'Para vender: 1) Registrate como vendedor, 2) Crea tu tienda desde "Central de vendedores", 3) Publica tus productos con fotos y descripcion, 4) Vincula tu Mercado Pago para recibir pagos automaticamente.',
  'devolucion': 'Para pedir una devolucion: 1) Anda a "Mis pedidos", 2) Selecciona la compra, 3) Abri un reclamo explicando el motivo. El vendedor coordinara la devolucion. Una vez que confirme que recibio el producto, te reembolsamos en 48hs.',
  'pago': 'Aceptamos todos los medios de pago de Mercado Pago: tarjetas de credito/debito, dinero en cuenta MP, Mercado Credito y cuotas. Tu dinero queda retenido hasta que confirmes que recibiste el producto.',
  'envio': 'El envio lo coordina cada vendedor. Al comprar, el vendedor recibe tu direccion y prepara el envio. Podes ver el estado desde "Mis pedidos". Si no recibes el producto, abri un reclamo.',
  'reclamo': 'Para abrir un reclamo: anda a "Mis pedidos", selecciona la compra y hace click en "Abrir reclamo". Explica el motivo y adjunta fotos si es necesario. Nuestro equipo revisa cada caso en 72hs.',
  'seguridad': 'Tu compra esta protegida. El dinero queda retenido por MercadoLocal hasta que confirmes que recibiste el producto en buenas condiciones. No liberamos el pago al vendedor hasta tu confirmacion.',
  'cuenta': 'Para gestionar tu cuenta anda al menu de usuario (arriba a la derecha). Desde ahi podes ver tus pedidos, favoritos, notificaciones, y si sos vendedor acceder a tu central de ventas.',
  'comision': 'MercadoLocal cobra una comision del 10% sobre cada venta. Si sos vendedor y vinculas tu Mercado Pago, el 90% va directo a tu billetera y el 10% a MercadoLocal automaticamente.',
  'contacto': 'Podes escribirnos a soporte@mercadolocal.com.ar indicando tu numero de pedido. Tambien podes usar el chat con el vendedor directamente desde la plataforma.',
  'registro': 'Para registrarte hace click en "Registrarse" arriba a la derecha. Necesitas: nombre, email, DNI, telefono y contraseña. Elegí si queres ser comprador o vendedor.',
  'mercado pago': 'Si sos vendedor, vincula tu Mercado Pago desde la Central de Vendedores. Asi recibís los pagos automaticamente en tu billetera, menos la comision del 10%.',
  'tienda': 'Para crear tu tienda: registrate como vendedor, anda a "Central de vendedores" y completa los datos de tu tienda (nombre, descripcion, ciudad). Despues ya podes publicar productos.',
  'producto': 'Para publicar un producto: anda a "Vender" en el menu, completa nombre, descripcion, precio, stock y subi fotos. Tu producto aparecera en el catalogo inmediatamente.',
}

const KEYWORDS: Record<string, string[]> = {
  'como comprar': ['comprar', 'compra', 'como compro', 'quiero comprar', 'adquirir'],
  'como vender': ['vender', 'venta', 'como vendo', 'quiero vender', 'publicar venta'],
  'devolucion': ['devolucion', 'devolver', 'reembolso', 'quiero devolver', 'no quiero'],
  'pago': ['pago', 'pagar', 'tarjeta', 'debito', 'credito', 'cuotas', 'plata', 'dinero', 'mercado pago'],
  'envio': ['envio', 'enviar', 'envios', 'despacho', 'llega', 'llegar', 'entrega', 'cuando llega'],
  'reclamo': ['reclamo', 'reclamar', 'queja', 'problema', 'no llego', 'defectuoso', 'roto', 'danado'],
  'seguridad': ['seguro', 'seguridad', 'proteccion', 'estafa', 'confianza', 'confiable'],
  'cuenta': ['cuenta', 'perfil', 'configuracion', 'mis datos', 'cambiar datos'],
  'comision': ['comision', 'porcentaje', 'cuanto cobran', 'cuanto gano', 'ganancia'],
  'contacto': ['contacto', 'contactar', 'soporte', 'ayuda', 'email', 'telefono', 'hablar'],
  'registro': ['registrar', 'registro', 'crear cuenta', 'nueva cuenta', 'inscribir'],
  'mercado pago': ['mercadopago', 'vincular', 'vincular mp', 'billetera'],
  'tienda': ['tienda', 'crear tienda', 'mi tienda', 'configurar tienda', 'negocio'],
  'producto': ['producto', 'publicar', 'subir producto', 'nueva publicacion'],
}

function buscarRespuesta(input: string): string {
  const texto = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  for (const [key, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      if (texto.includes(kw)) {
        return FAQ[key]
      }
    }
  }

  if (texto.includes('hola') || texto.includes('buenas') || texto.includes('buen dia')) {
    return 'Hola! Soy el asistente de MercadoLocal. Puedo ayudarte con: compras, ventas, envios, pagos, devoluciones, reclamos y mas. Preguntame lo que necesites!'
  }

  if (texto.includes('gracias') || texto.includes('genial') || texto.includes('perfecto')) {
    return 'De nada! Si necesitas algo mas, estoy aca. Podes preguntarme sobre compras, ventas, pagos, envios o cualquier otra cosa.'
  }

  return 'No estoy seguro de entender tu pregunta. Puedo ayudarte con:\n\n- Como comprar o vender\n- Pagos y Mercado Pago\n- Envios y entregas\n- Devoluciones y reclamos\n- Comisiones\n- Seguridad de compras\n- Crear tienda o publicar productos\n\nEscribi tu pregunta o contacta a soporte@mercadolocal.com.ar'
}

export default function ChatbotSoporte() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { texto: 'Hola! Soy el asistente de MercadoLocal. ¿En que puedo ayudarte?', esBot: true }
  ])
  const [input, setInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensajes])

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const pregunta = input.trim()
    setInput('')
    setMensajes(prev => [...prev, { texto: pregunta, esBot: false }])

    setTimeout(() => {
      const respuesta = buscarRespuesta(pregunta)
      setMensajes(prev => [...prev, { texto: respuesta, esBot: true }])
    }, 400)
  }

  function preguntaRapida(texto: string) {
    setMensajes(prev => [...prev, { texto, esBot: false }])
    setTimeout(() => {
      const respuesta = buscarRespuesta(texto)
      setMensajes(prev => [...prev, { texto: respuesta, esBot: true }])
    }, 400)
  }

  return (
    <>
      {/* Boton flotante */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center text-2xl"
        aria-label="Abrir chat de ayuda"
      >
        {abierto ? '\u2715' : '\u{1F4AC}'}
      </button>

      {/* Ventana de chat */}
      {abierto && (
        <div className="fixed bottom-24 right-6 w-[360px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden" style={{ height: '500px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <h3 className="font-bold">Asistente MercadoLocal</h3>
                <p className="text-xs opacity-80">Disponible 24/7</p>
              </div>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.map((msg, i) => (
              <div key={i} className={`flex ${msg.esBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
                  msg.esBot
                    ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                    : 'bg-blue-600 text-white rounded-br-md'
                }`}>
                  {msg.texto}
                </div>
              </div>
            ))}

            {/* Preguntas rapidas al inicio */}
            {mensajes.length <= 2 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {['Como comprar?', 'Como vender?', 'Devoluciones', 'Pagos', 'Envios', 'Seguridad'].map(q => (
                  <button
                    key={q}
                    onClick={() => preguntaRapida(q)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={enviar} className="border-t p-3 flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribi tu pregunta..."
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  )
}
