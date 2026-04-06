import { Link } from 'react-router-dom'

export default function Privacidad() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Politica de Privacidad</h1>
          <p className="text-gray-500 mt-2">Ultima actualizacion: 1 de abril de 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {/* Introduccion */}
          <section>
            <p>
              En MercadoLocal nos comprometemos a proteger la privacidad y los datos personales de nuestros usuarios
              en cumplimiento con la Ley 25.326 de Proteccion de Datos Personales de la Republica Argentina y su
              normativa complementaria. Esta Politica de Privacidad describe como recopilamos, usamos, almacenamos
              y protegemos su informacion personal.
            </p>
          </section>

          {/* 1. Datos que recopilamos */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Datos Personales que Recopilamos</h2>
            <p>Recopilamos los siguientes datos personales cuando usted se registra y utiliza la Plataforma:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Datos de identificacion:</strong> nombre completo, DNI/CUIT (para vendedores).</li>
              <li><strong>Datos de contacto:</strong> direccion de correo electronico, numero de telefono.</li>
              <li><strong>Datos de ubicacion:</strong> direccion postal, ciudad, provincia, codigo postal.</li>
              <li><strong>Datos de la cuenta:</strong> nombre de usuario, contrasena (almacenada de forma cifrada).</li>
              <li><strong>Datos de uso:</strong> historial de compras, productos visitados, busquedas realizadas.</li>
              <li><strong>Datos del dispositivo:</strong> direccion IP, tipo de navegador, sistema operativo.</li>
            </ul>
          </section>

          {/* 2. Como usamos los datos */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Uso de los Datos Personales</h2>
            <p>Utilizamos sus datos personales para los siguientes fines:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Gestionar su cuenta y brindarle acceso a los servicios de la Plataforma.</li>
              <li>Procesar compras, ventas y transacciones entre usuarios.</li>
              <li>Facilitar la comunicacion entre compradores y vendedores.</li>
              <li>Enviar notificaciones relacionadas con sus pedidos y actividad en la Plataforma.</li>
              <li>Mejorar nuestros servicios y la experiencia del usuario.</li>
              <li>Prevenir fraudes y actividades ilicitas.</li>
              <li>Cumplir con obligaciones legales y regulatorias.</li>
              <li>Enviar comunicaciones comerciales (con su consentimiento previo).</li>
            </ul>
          </section>

          {/* 3. Datos de pago */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Datos de Pago</h2>
            <p>
              Los pagos en MercadoLocal se procesan integramente a traves de <strong>Mercado Pago</strong>.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-3">
              <p className="text-blue-800 font-medium">
                MercadoLocal NO almacena, procesa ni tiene acceso a datos de tarjetas de credito, debito ni informacion
                financiera sensible de los usuarios. Toda la informacion de pago es gestionada directamente por Mercado Pago
                bajo sus propias politicas de seguridad y privacidad.
              </p>
            </div>
            <p className="mt-3">
              Para mas informacion sobre el tratamiento de sus datos financieros, consulte la{' '}
              <a
                href="https://www.mercadopago.com.ar/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Politica de Privacidad de Mercado Pago
              </a>.
            </p>
          </section>

          {/* 4. Comparticion de datos */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Comparticion de Datos con Terceros</h2>
            <p>
              Sus datos personales no seran vendidos, alquilados ni cedidos a terceros con fines comerciales.
              Unicamente compartimos datos en los siguientes casos:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Mercado Pago:</strong> compartimos los datos necesarios para procesar las transacciones de pago
                (nombre, email, monto de la transaccion).
              </li>
              <li>
                <strong>Entre usuarios:</strong> los datos de contacto del vendedor y del comprador se comparten
                mutuamente al concretarse una venta para coordinar la entrega.
              </li>
              <li>
                <strong>Autoridades competentes:</strong> cuando sea requerido por orden judicial, requerimiento fiscal
                u obligacion legal vigente.
              </li>
            </ul>
          </section>

          {/* 5. Derechos del usuario - ARCO */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Derechos del Titular de los Datos (Derechos ARCO)</h2>
            <p>
              De conformidad con la Ley 25.326, usted tiene los siguientes derechos sobre sus datos personales:
            </p>
            <div className="mt-3 space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800">Acceso</h3>
                <p className="text-sm mt-1">
                  Derecho a solicitar informacion sobre los datos personales que tenemos almacenados sobre usted.
                  Puede ejercer este derecho de forma gratuita en intervalos no menores a 6 meses, salvo interes
                  legitimo acreditado.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800">Rectificacion</h3>
                <p className="text-sm mt-1">
                  Derecho a solicitar la correccion de datos personales inexactos o incompletos. Puede actualizar
                  la mayoria de sus datos directamente desde su perfil en la Plataforma.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800">Cancelacion (Supresion)</h3>
                <p className="text-sm mt-1">
                  Derecho a solicitar la eliminacion de sus datos personales cuando ya no sean necesarios para la
                  finalidad para la que fueron recopilados. Algunos datos podran ser retenidos por obligaciones
                  legales o fiscales.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800">Oposicion</h3>
                <p className="text-sm mt-1">
                  Derecho a oponerse al tratamiento de sus datos personales para fines especificos, como el envio
                  de comunicaciones comerciales.
                </p>
              </div>
            </div>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos, envie un correo electronico a{' '}
              <span className="text-blue-600">privacidad@mercadolocal.com.ar</span> indicando su nombre completo,
              DNI y el derecho que desea ejercer. Responderemos en un plazo maximo de 10 dias habiles.
            </p>
          </section>

          {/* 6. Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Cookies y Tecnologias Similares</h2>
            <p>
              MercadoLocal utiliza cookies y tecnologias similares para mejorar la experiencia del usuario:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Cookies esenciales:</strong> necesarias para el funcionamiento de la Plataforma (sesion, autenticacion).</li>
              <li><strong>Cookies de rendimiento:</strong> para analizar el uso de la Plataforma y mejorar su rendimiento.</li>
              <li><strong>Cookies de preferencias:</strong> para recordar sus preferencias de navegacion.</li>
            </ul>
            <p className="mt-2">
              Puede configurar su navegador para rechazar cookies, aunque esto podria afectar la funcionalidad
              de la Plataforma.
            </p>
          </section>

          {/* 7. Seguridad */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Medidas de Seguridad</h2>
            <p>
              Implementamos medidas tecnicas y organizativas para proteger sus datos personales contra el acceso
              no autorizado, la alteracion, divulgacion o destruccion:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Cifrado de contrasenas mediante algoritmos de hash seguros (bcrypt).</li>
              <li>Comunicaciones cifradas mediante protocolo HTTPS/TLS.</li>
              <li>Acceso restringido a datos personales solo al personal autorizado.</li>
              <li>Copias de seguridad periodicas de la informacion.</li>
              <li>Monitoreo continuo de actividad sospechosa en la Plataforma.</li>
              <li>Tokens de autenticacion con expiracion temporal (JWT).</li>
            </ul>
          </section>

          {/* 8. Contacto */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Contacto para Solicitudes de Datos</h2>
            <p>
              Para ejercer sus derechos ARCO o realizar cualquier consulta relacionada con el tratamiento de sus
              datos personales, puede contactarnos a traves de:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Email: <span className="text-blue-600">privacidad@mercadolocal.com.ar</span></li>
              <li>Domicilio legal: Ciudad Autonoma de Buenos Aires, Republica Argentina.</li>
            </ul>
            <p className="mt-3">
              Asimismo, le informamos que la Agencia de Acceso a la Informacion Publica, en su caracter de Organo de
              Control de la Ley 25.326, tiene la atribucion de atender las denuncias y reclamos que se interpongan con
              relacion al incumplimiento de las normas sobre proteccion de datos personales.
            </p>
          </section>

          {/* Referencia a Terminos */}
          <section>
            <p className="text-sm text-gray-500">
              Esta Politica de Privacidad forma parte integrante de los{' '}
              <Link to="/terminos" className="text-blue-600 hover:underline">
                Terminos y Condiciones
              </Link>{' '}
              de MercadoLocal.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <Link to="/" className="text-blue-600 hover:underline font-medium">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
