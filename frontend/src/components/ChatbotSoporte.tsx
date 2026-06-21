import { useState, useRef, useEffect } from 'react'

interface Mensaje {
  texto: string
  esBot: boolean
}

// Base de conocimiento del asistente. Tono cercano y claro (nada robótico),
// con el modelo de pago correcto: el pago lo procesa y protege Mercado Pago.
const FAQ: Record<string, string> = {
  'como comprar': '¡Es re fácil! 🛒\n1) Buscá el producto en el catálogo\n2) Agregalo al carrito\n3) Andá al checkout y completá tu dirección\n4) Pagás con Mercado Pago\n\nTu compra queda protegida por el Programa de Protección al Comprador de Mercado Pago. ¿Querés que te cuente cómo seguir tu pedido?',
  'como vender': '¡Buenísimo que quieras vender! 🏪\n1) Registrate como vendedor\n2) Creá tu tienda desde "Central de vendedores"\n3) Publicá tus productos con buenas fotos y descripción\n4) Vinculá tu Mercado Pago para cobrar automáticamente\n\nPublicar es gratis: solo pagás el 10% cuando vendés. ¿Te ayudo a crear la tienda?',
  'devolucion': 'Tranqui, estás cubierto 🔄. Si el producto no llegó, no coincide o tiene fallas, andá a "Mis pedidos", abrí el reclamo y, si hace falta, también desde Mercado Pago. Ellos median entre vos y el vendedor y gestionan la devolución según sus plazos.',
  'arrepentimiento': 'Tenés el derecho de arrepentimiento por Ley 24.240 🛡️: hasta 10 días corridos desde que recibís el producto para arrepentirte sin dar explicaciones. Lo activás desde "Mis pedidos" con el botón "Arrepentirme", y la devolución se gestiona con Mercado Pago.',
  'pago': 'Pagás con todos los medios de Mercado Pago 💳: tarjetas de crédito y débito, dinero en cuenta MP, Mercado Crédito y cuotas. Tu compra queda protegida: si algo sale mal o te arrepentís, gestionás la devolución con Mercado Pago.',
  'cuotas': '¡Sí, podés pagar en cuotas! 💳 Las que ofrezca Mercado Pago según tu tarjeta y banco. El costo de financiación lo define tu banco emisor, lo ves antes de confirmar el pago.',
  'envio': '🚚 El envío lo coordina cada vendedor. Cuando comprás, recibe tu dirección y prepara el despacho. Seguí el estado desde "Mis pedidos". En cada producto tenés un cotizador por código postal para estimar el costo.',
  'seguimiento': 'Para seguir tu pedido andá a "Mis pedidos" 📦. Ahí ves el estado en vivo: pagado, enviado o entregado. Si algo se demora, podés escribirle al vendedor por el chat o abrir un reclamo.',
  'reclamo': 'Para abrir un reclamo 📝: andá a "Mis pedidos", elegí la compra y tocá "Abrir reclamo". Contá qué pasó y sumá fotos si podés. Revisamos cada caso y, para el dinero, la devolución la gestiona Mercado Pago.',
  'seguridad': 'Comprá con confianza 🔒. Pagás de forma segura con Mercado Pago y tu compra queda protegida con su Programa de Protección al Comprador. Si el producto no llega, no coincide o te arrepentís, usás el botón de arrepentimiento o el reclamo de Mercado Pago.',
  'cuenta': 'Gestionás todo desde el menú de tu usuario (arriba a la derecha) ⚙️: pedidos, favoritos, notificaciones, datos personales y, si sos vendedor, tu central de ventas. ¿Buscás algo puntual?',
  'comision': 'La comisión es del 10% sobre cada venta confirmada 💰. Si vinculás tu Mercado Pago, al aprobarse el pago el 90% va directo a tu billetera y el 10% queda para MercadoLocal. Publicar siempre es gratis.',
  'contacto': '¿Querés hablar con una persona? 💬 Escribinos a soporte@mercadolocal.com.ar con tu número de pedido y te respondemos. También podés chatear directo con el vendedor desde la plataforma.',
  'registro': 'Crear tu cuenta lleva 1 minuto ✨. Tocá "Registrarse" arriba a la derecha y completá nombre, email, DNI, teléfono y contraseña. Elegís si querés comprar, vender, o las dos.',
  'mercado pago': 'Si sos vendedor, vinculá tu Mercado Pago desde la Central de Vendedores 🔗. Así cobrás automáticamente en tu billetera (el 90%) apenas se aprueba el pago. La comisión del 10% se descuenta sola.',
  'tienda': 'Para armar tu tienda 🏪: registrate como vendedor, andá a "Central de vendedores" y cargá nombre, descripción y ciudad. Después ya podés publicar productos y empezar a vender.',
  'producto': 'Para publicar un producto 📦: andá a "Vender", completá nombre, descripción, precio y stock, y subí buenas fotos. Aparece en el catálogo al instante. ¿Querés que tu producto aparezca primero? Mirá la sección "Promover".',
  'promocionar': '🚀 Podés destacar tu publicación para vender más rápido. Desde "Promover" elegís un plan y tu producto aparece primero en el catálogo, en las búsquedas y en los espacios de publicidad, mostrándose a la gente más interesada. Lo pagás con tu saldo o con Mercado Pago.',
  'radar': '📍 El Radar del Centro te muestra ofertas de comercios cerca tuyo y cambia según la hora del día (desayuno, almuerzo, merienda, etc.). Activás tu ubicación (queda solo en tu dispositivo) y aparecen las promos más cercanas.',
  'remis': '🚕 Con MercadoLocal Remis pedís un traslado tipo app. Elegís el viaje, un conductor verificado lo toma y seguís todo en vivo. Pagás por la app con Mercado Pago (o efectivo si ambos lo acuerdan).',
  'comisionistas': '📦 Si comprás en otra ciudad, un comisionista (viajero verificado) te puede traer el paquete. Reservás lugar en su viaje, pagás con Mercado Pago y al recibir le das tu código de entrega. Todo desde "Envíos".',
  'servicios': '🔧 En "Servicios" encontrás profesionales de tu zona (electricistas, plomeros, etc.). Pedís un presupuesto gratis, coordinás por chat y, si sos profesional, podés publicar tu perfil y destacarte.',
  'favoritos': '❤️ Tocá el corazón en cualquier producto para guardarlo en Favoritos. Los encontrás después desde el menú de tu cuenta, así no perdés lo que te gustó.',
  'comparar': '🔎 La gracia de MercadoLocal es comparar: buscás un producto y ves el mismo de varias tiendas de tu ciudad con todos los precios a la vista. Elegís el más barato sin recorrer 10 negocios.'
}

const KEYWORDS: Record<string, string[]> = {
  'como comprar': ['comprar', 'compra', 'como compro', 'quiero comprar', 'adquirir'],
  'como vender': ['vender', 'venta', 'como vendo', 'quiero vender', 'empezar a vender'],
  'arrepentimiento': ['arrepentir', 'arrepentimiento', 'me arrepenti', 'cancelar compra', 'no lo quiero', 'boton de arrepentimiento'],
  'devolucion': ['devolucion', 'devolver', 'reembolso', 'quiero devolver', 'me llego mal', 'no coincide'],
  'cuotas': ['cuotas', 'financiacion', 'financiar', 'en cuotas', 'pagar en cuotas'],
  'pago': ['pago', 'pagar', 'tarjeta', 'debito', 'credito', 'plata', 'dinero', 'medios de pago'],
  'seguimiento': ['seguir', 'seguimiento', 'estado del pedido', 'donde esta mi pedido', 'rastrear', 'tracking', 'mi pedido'],
  'envio': ['envio', 'enviar', 'envios', 'despacho', 'llega', 'llegar', 'entrega', 'cuando llega', 'cuanto tarda'],
  'reclamo': ['reclamo', 'reclamar', 'queja', 'problema', 'no llego', 'defectuoso', 'roto', 'danado', 'estafa'],
  'seguridad': ['seguro', 'seguridad', 'proteccion', 'protegida', 'confianza', 'confiable', 'es seguro'],
  'cuenta': ['cuenta', 'perfil', 'configuracion', 'mis datos', 'cambiar datos', 'contraseña', 'email'],
  'comision': ['comision', 'porcentaje', 'cuanto cobran', 'cuanto gano', 'ganancia', '10%'],
  'contacto': ['contacto', 'contactar', 'soporte', 'humano', 'persona', 'email', 'telefono', 'hablar con alguien'],
  'registro': ['registrar', 'registro', 'crear cuenta', 'nueva cuenta', 'inscribir', 'sumarme'],
  'mercado pago': ['mercadopago', 'vincular', 'vincular mp', 'billetera', 'cobrar'],
  'tienda': ['tienda', 'crear tienda', 'mi tienda', 'configurar tienda', 'negocio', 'local'],
  'producto': ['producto', 'publicar', 'subir producto', 'nueva publicacion', 'cargar producto'],
  'promocionar': ['promocionar', 'promover', 'destacar', 'destacado', 'publicidad', 'anunciar', 'vender mas rapido', 'aparecer primero'],
  'radar': ['radar', 'centro', 'ofertas cerca', 'cerca mio', 'comercios', 'descuentos hoy'],
  'remis': ['remis', 'remise', 'viaje', 'traslado', 'conductor', 'taxi', 'auto'],
  'comisionistas': ['comisionista', 'viajero', 'encomienda', 'paquete', 'otra ciudad', 'traer'],
  'servicios': ['servicio', 'servicios', 'profesional', 'electricista', 'plomero', 'gasista', 'oficio', 'presupuesto'],
  'favoritos': ['favorito', 'favoritos', 'guardar', 'corazon', 'me gusta'],
  'comparar': ['comparar', 'comparacion', 'mejor precio', 'mas barato', 'precios']
}

// Saludos / agradecimientos con un par de variantes para que no suene a robot.
const SALUDOS = [
  '¡Hola! 👋 Soy el asistente de MercadoLocal. Contame qué necesitás y te doy una mano: compras, ventas, pagos, envíos, remis, servicios… lo que sea.',
  '¡Buenas! 😊 ¿En qué te puedo ayudar hoy? Comprar, vender, seguir un pedido, devoluciones… vos decime.'
]
const AGRADECIMIENTOS = [
  '¡De nada! 🙌 Cualquier otra cosa, acá estoy.',
  '¡Un gusto ayudarte! Si te surge algo más, preguntame nomás. 😊'
]

function elegir(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buscarRespuesta(input: string): string {
  const texto = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (texto.includes('hola') || texto.includes('buenas') || texto.includes('buen dia') || texto.includes('buenos dias') || texto.includes('que tal')) {
    return elegir(SALUDOS)
  }
  if (texto.includes('gracias') || texto.includes('genial') || texto.includes('perfecto') || texto.includes('barbaro') || texto.includes('joya')) {
    return elegir(AGRADECIMIENTOS)
  }

  for (const [key, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      if (texto.includes(kw)) {
        return FAQ[key]
      }
    }
  }

  return 'Mmm, no estoy seguro de haber entendido bien 🤔. Te puedo ayudar con:\n\n🛒 Comprar y vender\n💳 Pagos, cuotas y Mercado Pago\n🚚 Envíos y seguimiento\n🔄 Devoluciones y arrepentimiento\n🚀 Promocionar tu producto\n🚕 Remis y 🔧 Servicios\n\nProbá reformular tu pregunta, o escribinos a soporte@mercadolocal.com.ar y te ayuda una persona.'
}

// Clave para recordar la posición a la que el usuario arrastró el chat.
const POS_STORAGE_KEY = 'ml_chatbot_pos'

export default function ChatbotSoporte() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { texto: '¡Hola! 👋 Soy el asistente de MercadoLocal. ¿En qué te puedo ayudar?', esBot: true }
  ])
  const [input, setInput] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)
  // Posición de la ventana cuando el usuario la arrastra. null = anclada por defecto.
  // Se recuerda entre sesiones (localStorage); si quedó fuera de pantalla, el
  // efecto de re-encuadre la vuelve a meter al abrirse.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const guardada = localStorage.getItem(POS_STORAGE_KEY)
      if (!guardada) return null
      const p = JSON.parse(guardada)
      if (typeof p?.x === 'number' && typeof p?.y === 'number') return p
    } catch { /* storage no disponible */ }
    return null
  })
  const chatRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const latestPosRef = useRef<{ x: number; y: number } | null>(pos)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensajes, escribiendo])

  // Mantener la ventana dentro de la pantalla: al abrir (por si la posición
  // guardada quedó fuera en una pantalla más chica) y al redimensionar.
  useEffect(() => {
    if (!pos) return
    function reencuadrar() {
      const el = winRef.current
      if (!el) return
      setPos(p => {
        if (!p) return p
        const x = Math.max(8, Math.min(p.x, window.innerWidth - el.offsetWidth - 8))
        const y = Math.max(8, Math.min(p.y, window.innerHeight - el.offsetHeight - 8))
        // Devolver la MISMA referencia si no cambió evita un loop de renders.
        return (x === p.x && y === p.y) ? p : { x, y }
      })
    }
    if (abierto) requestAnimationFrame(reencuadrar)   // clamp al abrirse (ya montada)
    window.addEventListener('resize', reencuadrar)
    return () => window.removeEventListener('resize', reencuadrar)
  }, [pos, abierto])

  function responder(pregunta: string) {
    setMensajes(prev => [...prev, { texto: pregunta, esBot: false }])
    setEscribiendo(true)
    // Demora variable para que se sienta una conversación, no un robot instantáneo.
    const delay = 500 + Math.min(pregunta.length * 12, 700)
    setTimeout(() => {
      const respuesta = buscarRespuesta(pregunta)
      setEscribiendo(false)
      setMensajes(prev => [...prev, { texto: respuesta, esBot: true }])
    }, delay)
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const pregunta = input.trim()
    if (!pregunta || escribiendo) return
    setInput('')
    responder(pregunta)
  }

  function preguntaRapida(texto: string) {
    if (escribiendo) return
    responder(texto)
  }

  // ===== Drag de la ventana (por el header) =====
  // Usamos listeners a nivel window (patrón robusto): el pointermove/up siguen
  // funcionando aunque el puntero salga del header o el componente re-renderice.
  function onPointerDown(e: React.PointerEvent) {
    const el = winRef.current
    if (!el || e.button === 2) return
    const rect = el.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    if (!pos) {
      const inicial = { x: rect.left, y: rect.top }
      latestPosRef.current = inicial
      setPos(inicial)
    }

    function handleMove(ev: PointerEvent) {
      const w = winRef.current
      if (!w) return
      const x = Math.max(8, Math.min(ev.clientX - dx, window.innerWidth - w.offsetWidth - 8))
      const y = Math.max(8, Math.min(ev.clientY - dy, window.innerHeight - w.offsetHeight - 8))
      const np = { x, y }
      latestPosRef.current = np
      setPos(np)
    }
    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      // Recordar dónde la dejó para la próxima vez.
      try {
        if (latestPosRef.current) localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(latestPosRef.current))
      } catch { /* storage no disponible */ }
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    e.preventDefault()
  }

  const ventanaStyle = pos
    ? { left: pos.x, top: pos.y, height: 520 }
    : { height: 520 }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="fixed bottom-6 right-6 w-14 h-14 ml-grad text-white rounded-full shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center text-2xl"
        aria-label="Abrir chat de ayuda"
      >
        {abierto ? '✕' : '\u{1F4AC}'}
      </button>

      {/* Ventana de chat (arrastrable por el header) */}
      {abierto && (
        <div
          ref={winRef}
          className={`fixed w-[360px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-ml-line z-50 flex flex-col overflow-hidden ${pos ? '' : 'bottom-24 right-6'}`}
          style={ventanaStyle}
        >
          {/* Header (zona de arrastre) */}
          <div
            onPointerDown={onPointerDown}
            className="ml-grad text-white p-4 shrink-0 cursor-move select-none touch-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">🤖</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold leading-tight">Asistente MercadoLocal</h3>
                <p className="text-xs opacity-80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block" /> En línea · 24/7
                </p>
              </div>
              {/* Asa de arrastre visual */}
              <svg className="w-5 h-5 opacity-60 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
              </svg>
              <button onClick={() => setAbierto(false)} className="text-white/80 hover:text-white text-lg leading-none shrink-0" aria-label="Cerrar chat">✕</button>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.map((msg, i) => (
              <div key={i} className={`flex ${msg.esBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line leading-relaxed ${
                  msg.esBot
                    ? 'bg-ml-bg text-ml-ink rounded-bl-md'
                    : 'bg-ml-blue text-white rounded-br-md'
                }`}>
                  {msg.texto}
                </div>
              </div>
            ))}

            {/* Indicador de "escribiendo…" */}
            {escribiendo && (
              <div className="flex justify-start">
                <div className="bg-ml-bg text-ml-ink rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                  <span className="w-2 h-2 bg-ml-muted/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-ml-muted/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-ml-muted/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Sugerencias rápidas al inicio */}
            {mensajes.length <= 2 && !escribiendo && (
              <div className="flex flex-wrap gap-2 mt-2">
                {['¿Cómo comprar?', '¿Cómo vender?', 'Devoluciones', 'Pagos y cuotas', 'Seguir mi pedido', 'Promocionar', 'Remis', 'Servicios'].map(q => (
                  <button
                    key={q}
                    onClick={() => preguntaRapida(q)}
                    className="px-3 py-1.5 bg-blue-50 text-ml-blue rounded-full text-xs font-medium hover:bg-ml-bg transition-colors"
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
              placeholder="Escribí tu pregunta..."
              className="flex-1 px-4 py-2.5 bg-ml-bg rounded-xl text-sm outline-none focus:ring-2 focus:ring-ml-purple/30"
            />
            <button type="submit" disabled={escribiendo} className="px-4 py-2.5 mlbtn ml-grad text-white rounded-xl text-sm font-medium disabled:opacity-50">
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  )
}
