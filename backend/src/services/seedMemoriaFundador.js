/**
 * Seed inicial de la memoria del fundador.
 *
 * Carga los hechos básicos que todos los agentes deben recordar siempre.
 * Idempotente: si ya existe el hecho con el mismo texto, no lo duplica.
 *
 * Más adelante, los agentes podrán agregar hechos nuevos automáticamente
 * cuando detecten que el fundador les contó algo importante en una
 * conversación. Por ahora, lo cargamos manualmente con lo que sabemos.
 */

import MemoriaFundador from '../models/MemoriaFundador.js'

const HECHOS_INICIALES = [
  // Identidad del fundador
  {
    hecho: 'El fundador se llama Gastón Castaño. Vive en Lobos, provincia de Buenos Aires, Argentina.',
    categoria: 'identidad',
    importancia: 10
  },
  {
    hecho: 'Gastón ya tiene una empresa real funcionando: Green Garden Lobos, dedicada a alambrados, tejidos, postes y materiales para campos y granjas.',
    categoria: 'negocio',
    importancia: 8
  },
  {
    hecho: 'El email admin del fundador en MercadoLocal es admmercadolocal@gmail.com. Su email personal es gastonrosascastanio84@gmail.com.',
    categoria: 'identidad',
    importancia: 7
  },

  // Visión del proyecto
  {
    hecho: 'El objetivo FINAL de MercadoLocal es beneficiar al comprador local. Cada decisión técnica o de negocio debe medirse contra este norte.',
    categoria: 'vision',
    importancia: 10
  },
  {
    hecho: 'MercadoLocal va a ser un "Mercado Libre por ciudad" — una app adaptada a cada ciudad argentina (Lobos, Tandil, Mar del Plata, etc.), no una sola app nacional.',
    categoria: 'vision',
    importancia: 10
  },
  {
    hecho: 'El modelo combina dos mundos: la inmediatez y conexión local del marketplace de Facebook + la seguridad de pago protegido de Mercado Libre.',
    categoria: 'vision',
    importancia: 9
  },
  {
    hecho: 'Los vendedores (supermercados, comercios, particulares) compiten entre sí en cada ciudad por brindar mejor producto a mejor precio. La competencia honesta beneficia al comprador.',
    categoria: 'vision',
    importancia: 9
  },
  {
    hecho: 'Plan de expansión: arrancar en Lobos (validación), después otras ciudades de Buenos Aires, luego resto de Argentina, eventualmente Latinoamérica entera.',
    categoria: 'vision',
    importancia: 8
  },
  {
    hecho: 'Gastón cree que este proyecto va a cruzar fronteras y dar que hablar para los medios nacionales e internacionales. Esa convicción guía las decisiones de calidad.',
    categoria: 'vision',
    importancia: 7
  },

  // Cultura del equipo IA
  {
    hecho: 'Gastón eligió construir este equipo con IAs (no humanos) porque cree que la IA permite un equipo sin ego: con datos sobre opinión, honestidad brutal, y competencia sana basada solo en resultados.',
    categoria: 'vision',
    importancia: 8
  },

  // Preferencias de comunicación
  {
    hecho: 'Toda comunicación con Gastón debe ser en español rioplatense (vos, no tú). Sin tecnicismos innecesarios. Sin servilismos. Directo al grano.',
    categoria: 'preferencia',
    importancia: 9
  },
  {
    hecho: 'Gastón valora más una respuesta concisa con datos reales que una respuesta larga con generalidades. Si tenés algo importante para decir, decilo en pocas oraciones.',
    categoria: 'preferencia',
    importancia: 8
  },
  {
    hecho: 'Gastón aprecia la honestidad cuando algo falla. Si nos equivocamos, lo admitimos sin disfrazarlo. No le gustan las promesas vacías ni el "ya está, probá" sin haber verificado realmente.',
    categoria: 'preferencia',
    importancia: 9
  },

  // Restricciones
  {
    hecho: 'PROHIBIDO tocar el cotizador de presupuestos de Green Garden (presupuestos.html), sus precios, códigos o lógica de cálculo, sin autorización EXPLÍCITA del fundador. Es una regla crítica.',
    categoria: 'restriccion',
    importancia: 10
  },

  // Histórico
  {
    hecho: 'Este equipo IA está vivo y en producción desde mayo de 2026. Los 3 fundadores son Diego Castro (CEO), Sofía Mendoza (CMO) y Tomás Vega (CTO). En el próximo sprint sumamos a Lucía Romero (CFO), Martín Fernández (CLO) y Valentina Acosta (CGO).',
    categoria: 'historico',
    importancia: 6
  },
  {
    hecho: 'El stack técnico actual: React + Vite + Tailwind en el frontend (Vercel), Express + MongoDB Atlas en el backend (Railway), Google Gemini 2.5 Flash como modelo IA, Mercado Pago para pagos.',
    categoria: 'negocio',
    importancia: 5
  }
]

/**
 * Siembra los hechos iniciales en la base. Idempotente.
 */
export async function sembrarMemoriaFundador() {
  let creados = 0
  let yaExistían = 0
  for (const hecho of HECHOS_INICIALES) {
    const ya = await MemoriaFundador.findOne({ hecho: hecho.hecho }).lean()
    if (ya) {
      yaExistían += 1
      continue
    }
    await new MemoriaFundador({ ...hecho, creadoPor: 'sistema_seed' }).save()
    creados += 1
  }
  return { creados, yaExistían, total: HECHOS_INICIALES.length }
}

/**
 * Devuelve los hechos activos ordenados por importancia (los más importantes
 * primero). Es lo que se inyecta en el system prompt de cada agente.
 */
export async function obtenerMemoriaActiva() {
  return await MemoriaFundador
    .find({ activo: true })
    .sort({ importancia: -1, createdAt: 1 })
    .lean()
}
