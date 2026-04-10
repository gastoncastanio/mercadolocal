import { useState } from 'react'
import { Link } from 'react-router-dom'

const categorias = [
  {
    icono: '🛒',
    titulo: 'Compras',
    preguntas: [
      { pregunta: 'Como compro un producto?', respuesta: 'Busca el producto en el catalogo, hacé click en "Agregar al carrito", anda al carrito y luego al checkout. Completa tus datos de entrega y paga con Mercado Pago.' },
      { pregunta: 'Que medios de pago aceptan?', respuesta: 'Aceptamos todos los medios de Mercado Pago: tarjetas de credito y debito (Visa, Mastercard, Naranja), dinero en cuenta MP, Mercado Credito y cuotas sin interes.' },
      { pregunta: 'Mi compra esta protegida?', respuesta: 'Si. Tu dinero queda retenido por MercadoLocal hasta que confirmes que recibiste el producto en buenas condiciones. No liberamos el pago al vendedor sin tu aprobacion.' },
      { pregunta: 'Como veo el estado de mi pedido?', respuesta: 'Anda a "Mis pedidos" desde el menu. Ahi vas a ver todos tus pedidos con su estado actual: pagado, enviado o completado.' },
    ]
  },
  {
    icono: '🏪',
    titulo: 'Ventas',
    preguntas: [
      { pregunta: 'Como empiezo a vender?', respuesta: 'Registrate como vendedor, crea tu tienda desde "Central de vendedores" (nombre, descripcion, ciudad) y empeza a publicar productos.' },
      { pregunta: 'Cuanto cobra MercadoLocal de comision?', respuesta: 'La comision es del 10% sobre cada venta confirmada. Si vinculas tu Mercado Pago, el 90% va directo a tu billetera automaticamente.' },
      { pregunta: 'Como recibo los pagos?', respuesta: 'Vincula tu cuenta de Mercado Pago desde la Central de Vendedores. Los pagos se acreditan automaticamente cuando el comprador confirma la entrega.' },
      { pregunta: 'Que pasa si el comprador no paga?', respuesta: 'La orden queda en estado "pendiente" y no aparece en tus ventas confirmadas. Solo ves ventas reales con pago aprobado. Podes enviar un recordatorio al comprador.' },
    ]
  },
  {
    icono: '🚚',
    titulo: 'Envios',
    preguntas: [
      { pregunta: 'Quien se encarga del envio?', respuesta: 'El vendedor coordina el envio directamente. Al comprar, el vendedor recibe tu direccion de entrega y prepara el despacho.' },
      { pregunta: 'Cuanto tarda en llegar?', respuesta: 'Depende del vendedor y tu ubicacion. Generalmente entre 1-5 dias habiles para envios dentro de la misma ciudad. El vendedor te notificara cuando despache.' },
      { pregunta: 'Que hago si no recibo mi pedido?', respuesta: 'Si no recibis el pedido, abri un reclamo desde "Mis pedidos". Nuestro equipo revisara el caso y te reembolsaremos si corresponde.' },
    ]
  },
  {
    icono: '🔄',
    titulo: 'Devoluciones',
    preguntas: [
      { pregunta: 'Puedo devolver un producto?', respuesta: 'Si, antes de confirmar la recepcion podes abrir un reclamo. El vendedor coordinara la devolucion y una vez que reciba el producto te reembolsamos en 48hs.' },
      { pregunta: 'Quien paga el envio de devolucion?', respuesta: 'Depende del motivo: si el producto no coincide con la descripcion o llego danado, el vendedor cubre el envio. Si es arrepentimiento, lo cubre el comprador.' },
      { pregunta: 'Cuanto tardan en reembolsarme?', respuesta: 'Desde que el vendedor confirma que recibio el producto en buen estado, procesamos el reembolso en maximo 48 horas habiles.' },
    ]
  },
  {
    icono: '🔒',
    titulo: 'Seguridad',
    preguntas: [
      { pregunta: 'Es seguro comprar en MercadoLocal?', respuesta: 'Si. Tu dinero queda retenido hasta que confirmes la entrega. Usamos Mercado Pago como procesador de pagos, con toda su infraestructura de seguridad.' },
      { pregunta: 'Como protegen mis datos?', respuesta: 'Usamos encriptacion para contraseñas, HTTPS para todas las comunicaciones, y no almacenamos datos de tarjetas. Consulta nuestra politica de privacidad para mas detalles.' },
      { pregunta: 'Que hago si sospecho de una estafa?', respuesta: 'No confirmes la recepcion del producto. Abri un reclamo inmediatamente y escribinos a soporte@mercadolocal.com.ar. Investigaremos el caso.' },
    ]
  },
  {
    icono: '👤',
    titulo: 'Cuenta',
    preguntas: [
      { pregunta: 'Como creo una cuenta?', respuesta: 'Hace click en "Registrarse", completa tus datos (nombre, email, DNI, telefono, contraseña) y elegi si queres ser comprador o vendedor.' },
      { pregunta: 'Olvide mi contraseña', respuesta: 'Anda a la pagina de login y hacé click en "Olvidé mi contraseña". Te enviaremos un codigo de recuperacion a tu email.' },
      { pregunta: 'Puedo cambiar de comprador a vendedor?', respuesta: 'Por ahora necesitas crear una cuenta nueva como vendedor. Proximamente vamos a habilitar el cambio de rol.' },
    ]
  }
]

export default function Ayuda() {
  const [categoriaActiva, setCategoriaActiva] = useState(0)
  const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Centro de Ayuda</h1>
          <p className="text-gray-500 mt-2">Encontra respuestas a las preguntas mas frecuentes</p>
        </div>

        {/* Categorias */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          {categorias.map((cat, i) => (
            <button
              key={cat.titulo}
              onClick={() => { setCategoriaActiva(i); setPreguntaAbierta(null) }}
              className={`p-4 rounded-2xl text-center transition-all ${
                categoriaActiva === i
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
              }`}
            >
              <span className="text-2xl block mb-1">{cat.icono}</span>
              <span className="text-xs font-semibold">{cat.titulo}</span>
            </button>
          ))}
        </div>

        {/* Preguntas */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>{categorias[categoriaActiva].icono}</span>
              {categorias[categoriaActiva].titulo}
            </h2>
          </div>
          <div className="divide-y">
            {categorias[categoriaActiva].preguntas.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setPreguntaAbierta(preguntaAbierta === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-800 pr-4">{faq.pregunta}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${preguntaAbierta === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {preguntaAbierta === i && (
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed bg-blue-50/50">
                    {faq.respuesta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 text-lg mb-4">No encontraste lo que buscabas?</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <span className="text-2xl">📧</span>
              <p className="font-semibold text-gray-800 mt-2">Email</p>
              <p className="text-sm text-gray-600">soporte@mercadolocal.com.ar</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <span className="text-2xl">💬</span>
              <p className="font-semibold text-gray-800 mt-2">Chat</p>
              <p className="text-sm text-gray-600">Usa el bot en la esquina inferior derecha</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <span className="text-2xl">📋</span>
              <p className="font-semibold text-gray-800 mt-2">Reclamos</p>
              <Link to="/mis-disputas" className="text-sm text-blue-600 hover:underline">Abrir reclamo formal</Link>
            </div>
          </div>
        </div>

        {/* Links a politicas */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
          <Link to="/devoluciones" className="text-blue-600 hover:underline">Politica de devoluciones</Link>
          <Link to="/terminos" className="text-blue-600 hover:underline">Terminos y condiciones</Link>
          <Link to="/privacidad" className="text-blue-600 hover:underline">Politica de privacidad</Link>
        </div>
      </div>
    </div>
  )
}
