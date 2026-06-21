import { useState } from 'react'
import { Link } from 'react-router-dom'

const categorias = [
  {
    icono: '🛒',
    titulo: 'Compras',
    preguntas: [
      { pregunta: 'Como compro un producto?', respuesta: 'Busca el producto en el catalogo, hacé click en "Agregar al carrito", anda al carrito y luego al checkout. Completa tus datos de entrega y paga con Mercado Pago.' },
      { pregunta: 'Que medios de pago aceptan?', respuesta: 'Aceptamos todos los medios de Mercado Pago: tarjetas de credito y debito (Visa, Mastercard, Naranja), dinero en cuenta MP y Mercado Credito. Podes pagar en cuotas, el costo de financiacion depende de tu tarjeta y banco emisor.' },
      { pregunta: 'Mi compra esta protegida?', respuesta: 'Si. Pagas con Mercado Pago y tu compra queda protegida por su Programa de Proteccion al Comprador. Si algo sale mal o te arrepentis, tenes el boton de arrepentimiento y el reclamo de Mercado Pago, que media y gestiona la devolucion.' },
      { pregunta: 'Como veo el estado de mi pedido?', respuesta: 'Anda a "Mis pedidos" desde el menu. Ahi vas a ver todos tus pedidos con su estado actual: pagado, enviado o completado.' },
    ]
  },
  {
    icono: '🏪',
    titulo: 'Ventas',
    preguntas: [
      { pregunta: 'Como empiezo a vender?', respuesta: 'Registrate como vendedor, crea tu tienda desde "Central de vendedores" (nombre, descripcion, ciudad) y empeza a publicar productos.' },
      { pregunta: 'Cuanto cobra MercadoLocal de comision?', respuesta: 'La comision es del 10% sobre cada venta confirmada. Si vinculas tu Mercado Pago, el 90% va directo a tu billetera automaticamente.' },
      { pregunta: 'Como recibo los pagos?', respuesta: 'Vincula tu cuenta de Mercado Pago desde la Central de Vendedores. Al aprobarse el pago, Mercado Pago acredita tu parte de forma automatica (el 90%); MercadoLocal retiene solo su comision del 10%.' },
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
      { pregunta: 'Que hago si no recibo mi pedido?', respuesta: 'Si no recibis el pedido, abri un reclamo desde "Mis pedidos" y, si hace falta, desde el reclamo de Mercado Pago. Tu compra esta protegida por el Programa de Proteccion al Comprador de Mercado Pago, que gestiona la devolucion.' },
    ]
  },
  {
    icono: '📦',
    titulo: 'Comisionistas',
    preguntas: [
      { pregunta: 'Que es un comisionista o viajero?', respuesta: 'Es una persona verificada con vehiculo que viaja entre ciudades y puede llevar tu paquete o traerte una compra de otra localidad. Solo operan comisionistas con su documento del vehiculo verificado.' },
      { pregunta: 'Como recibo una compra de otra ciudad?', respuesta: 'Al comprar, podes enganchar tu pedido a un viaje disponible cuyo origen sea la ciudad del vendedor y destino la tuya. Reservas lugar para tus bultos y pagas con Mercado Pago.' },
      { pregunta: 'Como confirmo que recibi el paquete?', respuesta: 'Cuando el comisionista te entrega, le das tu codigo de entrega. Recien con ese codigo se cierra el envio (es tu garantia de que nadie lo cierra sin entregartelo).' },
      { pregunta: 'Como sigo mi envio?', respuesta: 'Desde "Mis envios" (/comisionistas/mis-envios) ves el estado del envio (pendiente, aceptado, en transito, entregado) y podes chatear con el comisionista para coordinar.' },
    ]
  },
  {
    icono: '🚗',
    titulo: 'Remis',
    preguntas: [
      { pregunta: 'Como pido un remis?', respuesta: 'Entra a Remis (/remis), carga el origen y el destino y pedilo. Un conductor verificado toma tu viaje y lo seguis en vivo desde "Mis viajes".' },
      { pregunta: 'Como se calcula el precio?', respuesta: 'Con las tarifas del conductor: una bajada de bandera fija, mas un costo por kilometro, mas la espera cuando el servicio la incluye (por ejemplo ida y vuelta o dia de compras).' },
      { pregunta: 'Como pago el viaje?', respuesta: 'Por la app con Mercado Pago. Tambien se puede pagar en efectivo, pero solo si vos lo solicitas y el conductor lo acepta.' },
      { pregunta: 'Los conductores estan verificados?', respuesta: 'Si. Solo pueden ofrecer remis los conductores con su documento del vehiculo verificado por la plataforma.' },
    ]
  },
  {
    icono: '🔧',
    titulo: 'Servicios',
    preguntas: [
      { pregunta: 'Como contrato un profesional?', respuesta: 'Entra a Servicios (/servicios), busca por rubro y zona, y pedi un presupuesto. Pedir presupuesto es gratis.' },
      { pregunta: 'Cuando puedo chatear con el profesional?', respuesta: 'El chat seguro se habilita cuando aceptas la cotizacion o el profesional toma tu trabajo. Hasta ese momento se mantiene la privacidad de ambos.' },
      { pregunta: 'Soy profesional, como me sumo?', respuesta: 'Crea tu perfil gratis desde "Mi perfil profesional" (/servicios/mi-perfil) con tu rubro, zona, experiencia y fotos. Publicar y cotizar es gratis.' },
      { pregunta: 'Que es la bolsa de trabajo?', respuesta: 'En "Trabajos" (/trabajos) podes publicar un trabajo y que varios profesionales te coticen, o si sos profesional ofertar en trabajos abiertos. Cuando aceptan tu oferta se habilita el chat para coordinar.' },
    ]
  },
  {
    icono: '📍',
    titulo: 'Radar',
    preguntas: [
      { pregunta: 'Que es el Radar del Centro?', respuesta: 'Es un radar de ofertas de comercios cerca tuyo. Te muestra promociones del centro de tu ciudad ordenadas por cercania.' },
      { pregunta: 'Como lo activo?', respuesta: 'Entra al Radar (/radar) y permiti el acceso a tu ubicacion. Tu ubicacion se usa solo en tu dispositivo y no se almacena.' },
      { pregunta: 'Por que cambian las ofertas durante el dia?', respuesta: 'El Radar se adapta a la hora: tiene modos por franja (desayuno, almuerzo, shopping de siesta, merienda y cena), priorizando lo que tiene sentido en ese momento del dia.' },
    ]
  },
  {
    icono: '🚀',
    titulo: 'Promocionar',
    preguntas: [
      { pregunta: 'Como destaco mi producto?', respuesta: 'Si sos vendedor, entra a "Promover" (/promover), elegi el producto, un plan (Basico, Premium o Elite) y la duracion. Tu producto pasa a aparecer primero.' },
      { pregunta: 'Como elige a quien se lo muestra?', respuesta: 'No es solo aparecer primero: estudiamos que mira, busca y compra cada cliente y mostramos tu producto a los compradores con mas chance de comprarlo. Incluso les avisamos por notificacion cuando sos justo lo que buscaban.' },
      { pregunta: 'Que es el boost por puja?', respuesta: 'Es una puja opcional (en pesos) que te sube mas alto en los espacios premium (banner, home y primeros puestos). El puesto se define por tu puja combinada con que tan relevante es tu producto, asi que ofrecer mas ayuda pero la calidad tambien cuenta.' },
      { pregunta: 'Como pago la promocion?', respuesta: 'Con tu saldo de ventas acumulado o con Mercado Pago. La promo se activa al instante si pagas con saldo, o al confirmarse el pago si elegis Mercado Pago.' },
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
      { pregunta: 'Es seguro comprar en MercadoLocal?', respuesta: 'Si. Pagas con Mercado Pago, que protege tu compra con su Programa de Proteccion al Comprador y toda su infraestructura de seguridad. Si algo sale mal, gestionas la devolucion directo con Mercado Pago.' },
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

// Guías de punta a punta, fáciles de seguir, para cada servicio de MercadoLocal.
// Pasos basados en cómo funciona realmente la plataforma.
const GUIAS = [
  {
    icono: '🛒', titulo: 'Comprar un producto', color: 'from-blue-500 to-indigo-600',
    pasos: [
      'Buscá el producto y compará el mismo artículo en varias tiendas de tu ciudad.',
      'Agregalo al carrito y andá al checkout con tu dirección.',
      'Pagás con Mercado Pago (tarjeta, cuotas o dinero en cuenta).',
      'Seguís el pedido en "Mis compras". Tu compra queda protegida por Mercado Pago.'
    ],
    link: { to: '/catalogo', label: 'Ir al catálogo' }
  },
  {
    icono: '🏪', titulo: 'Vender en MercadoLocal', color: 'from-emerald-500 to-teal-600',
    pasos: [
      'Creá tu tienda gratis desde la Central de vendedores.',
      'Publicá tus productos con fotos, precio y stock.',
      'Vinculá tu Mercado Pago para cobrar automáticamente.',
      'Al vender, recibís el 90% al instante (la comisión es del 10%).'
    ],
    link: { to: '/central-vendedor', label: 'Central de vendedores' }
  },
  {
    icono: '🚀', titulo: 'Promocionar tu producto', color: 'from-fuchsia-600 to-purple-600',
    pasos: [
      'Entrá a "Promover" y elegí el producto a destacar.',
      'Elegí un plan (Básico, Premium o Elite) y la duración.',
      'Opcional: sumá un boost (puja) para subir más alto en los lugares premium.',
      'Pagás con tu saldo o Mercado Pago. Tu anuncio aparece primero y a quien más chance tiene de comprarlo.'
    ],
    link: { to: '/promover', label: 'Promocionar' }
  },
  {
    icono: '📍', titulo: 'Radar del Centro', color: 'from-violet-500 to-indigo-700',
    pasos: [
      'Entrá al Radar y permití el acceso a tu ubicación (queda solo en tu dispositivo).',
      'Ves las ofertas de comercios cerca tuyo, ordenadas por cercanía.',
      'El Radar cambia según la hora: desayuno, almuerzo, siesta, merienda y cena.',
      'Aprovechás la promo del momento más cercana a vos.'
    ],
    link: { to: '/radar', label: 'Abrir el Radar' }
  },
  {
    icono: '🚗', titulo: 'Pedir un Remis', color: 'from-pink-500 to-rose-600',
    pasos: [
      'Entrá a Remis y cargá origen y destino.',
      'Un conductor verificado toma tu viaje y lo seguís en vivo.',
      'Viajás y al finalizar ves el precio (banderita + km + espera si aplica).',
      'Pagás por la app con Mercado Pago, o en efectivo si ambos lo acuerdan.'
    ],
    link: { to: '/remis', label: 'Pedir un remis' }
  },
  {
    icono: '📦', titulo: 'Envíos entre ciudades', color: 'from-orange-500 to-amber-600',
    pasos: [
      'Comprás un producto de otra ciudad.',
      'Enganchás tu compra a un viaje de un comisionista verificado.',
      'Pagás con Mercado Pago.',
      'Cuando te lo entrega, le das tu código de entrega y se cierra el envío.'
    ],
    link: { to: '/comisionistas', label: 'Ver viajes' }
  },
  {
    icono: '🔧', titulo: 'Contratar un Servicio', color: 'from-cyan-500 to-blue-600',
    pasos: [
      'Entrá a Servicios y buscá un profesional por rubro y zona.',
      'Pedí un presupuesto (es gratis).',
      'Coordinás por chat seguro, que se habilita al aceptar la cotización.',
      'Al terminar el trabajo, dejás tu reseña.'
    ],
    link: { to: '/servicios', label: 'Buscar profesionales' }
  }
]

export default function Ayuda() {
  const [categoriaActiva, setCategoriaActiva] = useState(0)
  const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(null)
  const [guiaAbierta, setGuiaAbierta] = useState(0)

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-[28px] font-extrabold text-ml-ink">Centro de Ayuda</h1>
          <p className="text-ml-muted mt-2">Aprendé cómo funciona MercadoLocal y encontrá respuestas rápidas</p>
        </div>

        {/* Guías paso a paso (cómo funciona cada servicio) */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧭</span>
            <h2 className="font-display text-lg font-extrabold text-ml-ink">Cómo funciona, paso a paso</h2>
          </div>

          {/* Selector de servicio */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {GUIAS.map((g, i) => (
              <button
                key={g.titulo}
                onClick={() => setGuiaAbierta(i)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  guiaAbierta === i ? 'ml-grad text-white shadow-md' : 'bg-white text-ml-soft border border-ml-line hover:border-ml-line2'
                }`}
              >
                <span className="mr-1.5">{GUIAS[i].icono}</span>{g.titulo}
              </button>
            ))}
          </div>

          {/* Pasos del servicio elegido */}
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden">
            <div className={`p-5 text-white bg-gradient-to-r ${GUIAS[guiaAbierta].color}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{GUIAS[guiaAbierta].icono}</span>
                <h3 className="font-display text-xl font-extrabold">{GUIAS[guiaAbierta].titulo}</h3>
              </div>
            </div>
            <ol className="p-5 sm:p-6 space-y-4">
              {GUIAS[guiaAbierta].pasos.map((paso, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full ml-grad text-white text-sm font-extrabold flex items-center justify-center">{i + 1}</span>
                  <span className="text-ml-ink text-sm sm:text-[15px] leading-relaxed pt-0.5">{paso}</span>
                </li>
              ))}
            </ol>
            <div className="px-5 sm:px-6 pb-5">
              <Link
                to={GUIAS[guiaAbierta].link.to}
                className="inline-flex items-center gap-2 px-5 py-2.5 ml-grad text-white rounded-xl font-bold text-sm hover:shadow-lg transition-shadow"
              >
                {GUIAS[guiaAbierta].link.label}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Preguntas frecuentes */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">❓</span>
          <h2 className="font-display text-lg font-extrabold text-ml-ink">Preguntas frecuentes</h2>
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
