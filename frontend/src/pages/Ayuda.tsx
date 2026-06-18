import { useState } from 'react'
import { Link } from 'react-router-dom'

const categorias = [
  {
    icono: '🛒',
    titulo: 'Compras',
    preguntas: [
      { pregunta: 'Como compro un producto?', respuesta: 'Busca el producto en el catalogo, hacé click en "Agregar al carrito", anda al carrito y luego al checkout. Completa tus datos de entrega y paga con Mercado Pago.' },
      { pregunta: 'Que medios de pago aceptan?', respuesta: 'Aceptamos todos los medios de Mercado Pago: tarjetas de credito y debito (Visa, Mastercard, Naranja), dinero en cuenta MP y Mercado Credito. Podes pagar en cuotas, el costo de financiacion depende de tu tarjeta y banco emisor.' },
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
      { pregunta: 'Como funciona el envio?', respuesta: 'MercadoLocal es una plataforma que conecta compradores con vendedores locales. El vendedor coordina el envio directamente con vos despues de la compra. Al pagar, el vendedor recibe tu direccion y te contacta para coordinar.' },
      { pregunta: 'Cuanto cuesta el envio?', respuesta: 'El costo de envio depende del vendedor, la distancia y el peso del producto. En la pagina de cada producto podes usar el cotizador de envio ingresando tu codigo postal para ver un precio estimado de referencia.' },
      { pregunta: 'Cuanto tarda en llegar?', respuesta: 'Depende del vendedor y tu ubicacion. Generalmente entre 1-5 dias habiles para envios dentro de la misma ciudad, y 4-8 dias para envios a otra provincia.' },
      { pregunta: 'Que hago si no recibo mi pedido?', respuesta: 'Si no recibis el pedido, abri un reclamo desde "Mis pedidos". Tu dinero queda retenido por MercadoLocal hasta que confirmes la recepcion, asi que estas protegido.' },
    ]
  },
  {
    icono: '🔄',
    titulo: 'Devoluciones',
    preguntas: [
      { pregunta: 'Tengo derecho a arrepentirme de una compra?', respuesta: 'Si. Por la Ley 24.240 de Defensa del Consumidor, tenes 10 dias corridos desde que recibis el producto para arrepentirte sin dar explicaciones y recibir el reintegro total. Para ejercerlo, anda a "Mis pedidos", busca la compra y toca el boton "Arrepentirme". Queda registrado al instante y procesamos la devolucion.' },
      { pregunta: 'Puedo devolver un producto?', respuesta: 'Si. Si el producto llego con fallas, no coincide con la descripcion o no llego, abri un reclamo desde "Mis pedidos" antes de confirmar la recepcion. El vendedor coordinara la devolucion y una vez que reciba el producto te reembolsamos en 48hs.' },
      { pregunta: 'Quien paga el envio de devolucion?', respuesta: 'Depende del motivo: si el producto no coincide con la descripcion o llego danado, el vendedor cubre el envio. Si es arrepentimiento dentro de los 10 dias, el reintegro del producto es total y los gastos de devolucion los cubre el comprador, salvo que el producto tuviera fallas.' },
      { pregunta: 'Cuanto tardan en reembolsarme?', respuesta: 'Desde que el vendedor confirma que recibio el producto en buen estado, o desde que registras tu arrepentimiento en plazo, procesamos el reembolso en maximo 48 horas habiles sobre el mismo medio de pago.' },
    ]
  },
  {
    icono: '🔒',
    titulo: 'Seguridad',
    preguntas: [
      { pregunta: 'Es seguro comprar en MercadoLocal?', respuesta: 'Si. Tu dinero queda retenido hasta que confirmes la entrega. Usamos Mercado Pago como procesador de pagos, con toda su infraestructura de seguridad.' },
      { pregunta: 'Como protegen mis datos?', respuesta: 'Usamos encriptacion para contraseñas, HTTPS para todas las comunicaciones, y no almacenamos datos de tarjetas. Cumplimos con la Ley 25.326 de Proteccion de Datos Personales. Consulta nuestra politica de privacidad para mas detalles.' },
      { pregunta: 'Puedo ver y descargar todos mis datos?', respuesta: 'Si. Desde tu menu de cuenta entra a "Privacidad y mis datos" y toca "Descargar mis datos" para obtener al instante un archivo con toda tu informacion: cuenta, tienda, pedidos, favoritos y el perfil de intereses publicitario que armamos. Es tu derecho de acceso de la Ley 25.326.' },
      { pregunta: 'Como funciona la publicidad personalizada y como la desactivo?', respuesta: 'Analizamos tu actividad (productos que miras, busquedas y compras) para mostrarte productos mas relevantes por categoria y ciudad. No usamos datos sensibles ni vendemos tu informacion. Podes oponerte cuando quieras desde "Privacidad y mis datos": al desactivarla dejamos de usar tu actividad y borramos el perfil. Los visitantes sin cuenta pueden rechazarlo desde el aviso de privacidad.' },
      { pregunta: 'Que hago si sospecho de una estafa?', respuesta: 'No confirmes la recepcion del producto. Abri un reclamo inmediatamente y escribinos a soporte@mercadolocal.com.ar. Investigaremos el caso.' },
    ]
  },
  {
    icono: '👤',
    titulo: 'Cuenta',
    preguntas: [
      { pregunta: 'Como creo una cuenta?', respuesta: 'Hace click en "Registrarse", completa tus datos (nombre, email, DNI, telefono, contraseña) y elegi si queres ser comprador o vendedor.' },
      { pregunta: 'Olvide mi contraseña', respuesta: 'Anda a la pagina de login y hacé click en "Olvidé mi contraseña". Te enviaremos un codigo de recuperacion a tu email.' },
      { pregunta: 'Como corrijo mis datos personales?', respuesta: 'Podes actualizar la mayoria de tus datos directamente desde tu perfil. Si necesitas corregir algun dato que no aparezca editable, escribinos a privacidad@mercadolocal.com.ar. Es tu derecho de rectificacion de la Ley 25.326.' },
      { pregunta: 'Como elimino o doy de baja mi cuenta?', respuesta: 'Dar de baja tu cuenta es tan facil como crearla. Anda a "Privacidad y mis datos" desde el menu de tu cuenta y toca "Eliminar mi cuenta" (te vamos a pedir tu contraseña para confirmar). Borramos tus datos personales y de navegacion. Algunos datos de operaciones ya facturadas se conservan por obligaciones fiscales y legales.' },
      { pregunta: 'Puedo cambiar de comprador a vendedor?', respuesta: 'Si. Desde "Central de vendedores" podes crear tu tienda y empezar a vender con la misma cuenta, sin necesidad de registrarte de nuevo.' },
    ]
  }
]

export default function Ayuda() {
  const [categoriaActiva, setCategoriaActiva] = useState(0)
  const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-[28px] font-extrabold text-ml-ink">Centro de Ayuda</h1>
          <p className="text-ml-muted mt-2">Encontra respuestas a las preguntas mas frecuentes</p>
        </div>

        {/* Categorias */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          {categorias.map((cat, i) => (
            <button
              key={cat.titulo}
              onClick={() => { setCategoriaActiva(i); setPreguntaAbierta(null) }}
              className={`p-4 rounded-2xl text-center transition-all ${
                categoriaActiva === i
                  ? 'mlbtn ml-grad text-white shadow-lg scale-105'
                  : 'bg-white text-ml-ink shadow-sm border border-ml-line hover:shadow-md'
              }`}
            >
              <span className="text-2xl block mb-1">{cat.icono}</span>
              <span className="text-xs font-semibold">{cat.titulo}</span>
            </button>
          ))}
        </div>

        {/* Preguntas */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-ml-line">
            <h2 className="text-xl font-bold text-ml-ink flex items-center gap-2">
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
                  <span className="font-medium text-ml-ink pr-4">{faq.pregunta}</span>
                  <svg
                    className={`w-5 h-5 text-ml-muted shrink-0 transition-transform ${preguntaAbierta === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {preguntaAbierta === i && (
                  <div className="px-6 pb-4 text-ml-soft text-sm leading-relaxed bg-blue-50/50">
                    {faq.respuesta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-ml-line p-6">
          <h3 className="font-bold text-ml-ink text-lg mb-4">No encontraste lo que buscabas?</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <span className="text-2xl">📧</span>
              <p className="font-semibold text-ml-ink mt-2">Email</p>
              <p className="text-sm text-ml-soft break-words">soporte@mercadolocal.com.ar</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <span className="text-2xl">💬</span>
              <p className="font-semibold text-ml-ink mt-2">Chat</p>
              <p className="text-sm text-ml-soft">Usa el bot en la esquina inferior derecha</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <span className="text-2xl">📋</span>
              <p className="font-semibold text-ml-ink mt-2">Reclamo de compra</p>
              <Link to="/mis-disputas" className="text-sm text-ml-blue hover:underline">Abrir reclamo de un pedido</Link>
            </div>
            <div className="p-4 bg-rose-50 rounded-xl">
              <span className="text-2xl">📕</span>
              <p className="font-semibold text-ml-ink mt-2">Libro de Quejas</p>
              <Link to="/libro-de-quejas" className="text-sm text-ml-blue hover:underline">Dejar una queja formal</Link>
            </div>
          </div>
          <div className="mt-4 p-4 bg-ml-bg rounded-xl border border-ml-line">
            <p className="text-sm text-ml-soft">
              <span className="font-semibold text-ml-ink">Privacidad y datos personales:</span> gestiona tus datos,
              la publicidad personalizada o la baja de tu cuenta desde{' '}
              <Link to="/privacidad-datos" className="text-ml-blue hover:underline font-medium">Privacidad y mis datos</Link>,
              o escribinos a privacidad@mercadolocal.com.ar.
            </p>
          </div>
        </div>

        {/* Links a politicas */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
          <Link to="/devoluciones" className="text-ml-blue hover:underline">Politica de devoluciones</Link>
          <Link to="/terminos" className="text-ml-blue hover:underline">Terminos y condiciones</Link>
          <Link to="/privacidad" className="text-ml-blue hover:underline">Politica de privacidad</Link>
          <Link to="/libro-de-quejas" className="text-ml-blue hover:underline">Libro de Quejas</Link>
        </div>
      </div>
    </div>
  )
}
