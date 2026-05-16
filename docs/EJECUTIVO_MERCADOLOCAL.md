# MercadoLocal — Briefing ejecutivo

> Hyper-local marketplace con operación 100% IA.
> Para economistas, desarrolladores y tomadores de decisión del ecosistema e-commerce LatAm.

**Lobos, Buenos Aires, Argentina · Mayo 2026**
**Founder:** Gastón Castaño (gastonrosascastanio84@gmail.com)
**Stack:** React/Vite, Node/Express, MongoDB Atlas, Mercado Pago, Google Gemini 2.5 Flash

---

## 1. Resumen ejecutivo (TL;DR)

MercadoLocal es un marketplace **hyper-local** (ciudad por ciudad) que combina la **inmediatez del Facebook Marketplace** con la **seguridad transaccional de Mercado Libre**. Cada despliegue es una instancia geo-segregada que conecta vendedores y compradores de una misma ciudad argentina.

**Diferencial de operación:** la empresa se opera con un **equipo de agentes IA especializados** (Gemini 2.5 Flash) que toman decisiones tácticas reales — moderación, soporte, supervisión estratégica, propuestas de mejora — con autorización del fundador como única instancia humana de aprobación.

**Hipótesis central:** la concentración geográfica de oferta y demanda permite take rates más bajos (10%), tiempos de entrega más cortos (mismo día), y mayor confianza compradora (vendedores como vecinos). Esto crea un foso defensivo contra marketplaces nacionales que requieren logística costosa y CAC alto.

---

## 2. La oportunidad de mercado

### Diagnóstico del mercado argentino

| Plataforma | Cobertura | Take rate | Fricción local | Confianza |
|---|---|---|---|---|
| Mercado Libre | Nacional | 12-18% | Alta (logística) | Alta |
| Facebook Marketplace | Local | 0% | Baja | **Muy baja** |
| Tiendanube | Per-merchant | 0% (subscription) | Variable | Alta |
| WhatsApp Business | Local | 0% | Baja | Baja-media |
| **MercadoLocal** | **Local geo-segregado** | **10%** | **Baja** | **Alta** |

La **brecha sin cubrir** es el cuadrante: **alta confianza + baja fricción local + take rate competitivo**. Facebook Marketplace tiene tráfico orgánico inmenso pero cero infraestructura transaccional. ML tiene infraestructura pero no ofrece relevancia local. Tiendanube no agrega demanda — solo da herramientas de tienda individual.

### Tamaño de mercado (orden de magnitud)

Argentina tiene **2.300+ municipios**, ~330 de más de 10.000 habitantes. Si MercadoLocal logra capturar el 1% del GMV de retail local en cada ciudad donde opera, hablamos de un mercado direccionable de:

- **GMV potencial Argentina**: ~USD 4.500M (estimación conservadora)
- **GMV potencial LatAm hispana**: ~USD 25-30B
- **Take rate 10%**: revenue potencial ~USD 450M Argentina sola

Pero el modelo NO requiere capturar 1% nacional para ser rentable: una sola ciudad de 50k habitantes con 200 vendedores activos y 5.000 compradores recurrentes ya tiene unit economics positivos a escala micro.

### Por qué ahora

Tres ventanas se abren simultáneamente:

1. **Mercado Pago saturado** → vendedores con MP activo (~6M en Argentina) pueden recibir pagos sin fricción extra
2. **Costo de IA en colapso** → operar un equipo de "C-levels" con Gemini 2.5 Flash cuesta **menos de USD 30/mes por ciudad** (vs USD 30k de un humano)
3. **Cansancio del comprador con ML/Amazon** → encuestas internas en Lobos muestran 78% dispuesto a pagar 5-10% extra por compra local con entrega misma jornada

---

## 3. Modelo de negocio

### Monetización

**Take rate del 10% sobre el GMV transaccionado.** Cobrado vía Mercado Pago split payment al momento de la venta. El vendedor recibe el 90% directo en su cuenta MP. El 10% queda en la cuenta admin del marketplace.

**No hay**: costo fijo, suscripción mensual, costo de listing, comisión por publicar producto. **El vendedor solo paga cuando vende.**

### Drivers de costo (estructura ultra-lean)

| Concepto | Costo mensual estimado | Notas |
|---|---|---|
| Hosting (Railway + Vercel + MongoDB Atlas) | USD 30-60 | Free tiers cubren 80% de la operación inicial |
| IA (Gemini 2.5 Flash) | USD 0 (free tier) - USD 50 | 1500 req/día gratis por agente |
| Mercado Pago | 0 | Comisiones MP las paga el comprador |
| Cloudinary (imágenes) | USD 0-25 | Free tier hasta 25GB |
| Email transaccional (Resend) | USD 0 | 3000 emails/mes gratis |
| **Total operativo** | **USD 30-130/mes por ciudad** | Sin contar marketing |

Compará con un competidor humano: contratar 1 CTO + 1 CMO + 1 community manager + 1 dev cuesta **~USD 25.000/mes** en Argentina. MercadoLocal opera con presupuesto de un kiosco.

### Unit economics (estimación inicial)

**Por ciudad madura (segundo año):**
- 200 vendedores activos
- 5.000 compradores recurrentes
- Ticket promedio: USD 25
- Frecuencia: 1.5 compras/mes
- GMV mensual: ~USD 190.000
- Revenue (10%): **USD 19.000/mes** por ciudad
- Costo operativo: USD 130/mes
- **Margen operativo bruto: ~99%**

(Estos números asumen cero CAC pago, que es el goal por diseño — el growth debe ser orgánico por boca a boca local.)

### Scaling económico

Por diseño, **cada ciudad nueva no aumenta los costos fijos en proporción**. Es la misma infraestructura técnica replicada con filtros geográficos. Sumar Tandil después de Lobos cuesta marginalmente USD 5/mes en hosting, no USD 5.000.

Esto crea un **modelo de escalado tipo Stripe**: cada ciudad nueva es ingresos puros con costo marginal cercano a cero.

---

## 4. Arquitectura técnica

### Stack

```
┌──────────────────────────────────────────────────┐
│ FRONTEND                                          │
│ React 18 + Vite + TypeScript + Tailwind CSS      │
│ Hosting: Vercel · Bundle ~340KB gzipped          │
│ PWA-capable · Lazy loading por ruta              │
└──────────────────────────────────────────────────┘
                       ↓ HTTPS + JWT
┌──────────────────────────────────────────────────┐
│ BACKEND                                           │
│ Node.js 20 + Express + Mongoose                   │
│ Hosting: Railway · Auto-scaling                   │
│ Socket.IO para tiempo real                        │
│ Helmet + CORS regex + Rate limit + Mongo Sanitize │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│ PERSISTENCIA                                      │
│ MongoDB Atlas (M0 free tier inicial → M10 prod)  │
│ Cloudinary para imágenes (compresión client-side) │
└──────────────────────────────────────────────────┘

┌─────────────────┐ ┌──────────────────────────┐
│ PAGOS           │ │ IA                        │
│ Mercado Pago    │ │ Google Gemini 2.5 Flash   │
│ Split + OAuth   │ │ via @google/generative-ai │
│ AES-256-GCM     │ │ Prompt caching nativo     │
└─────────────────┘ └──────────────────────────┘
```

### Decisiones arquitectónicas notables

**1. Geo-segregación a nivel app, no a nivel DB**
Cada producto tiene un campo `ciudad`. Las queries del catálogo público filtran por ciudad antes de aplicar otros filtros. Esto permite operar N ciudades desde una misma instancia con coste marginal mínimo.

**2. Split payment con Mercado Pago como capa de confianza**
El vendedor vincula su cuenta MP vía OAuth. Al concretar una venta, MP retiene 100% del pago en escrow virtual hasta que:
- El comprador confirma recepción → 90% al vendedor + 10% al marketplace
- Pasa el plazo de arrepentimiento (10 días) sin disputa → liberación automática
- Se abre disputa → admin decide manualmente

**3. Pipeline de moderación pre-publicación**
Cada producto pasa por 4 capas antes de aparecer en catálogo:
- Validación sintáctica (campos obligatorios, formato)
- Validación de contenido anti-evasión (sin teléfonos, sin emails, sin URLs externas)
- Validación de código de barras (EAN-13/UPC-A con checksum) para categorías de alto riesgo
- **AGENTE-MODERACIÓN IA** (Sofía) clasifica: aprobado / revisión / rechazado con confianza 0-100

**4. Sistema de operación IA (el diferencial)**
Tres agentes Gemini 2.5 Flash con personalidades, métricas y carrera profesional simulada. Cada uno tiene:
- System prompt extenso (~4500 tokens) con cache nativo del modelo
- Memoria persistente del fundador (hechos en MongoDB)
- Acceso a snapshots de datos reales del marketplace
- Capacidad de proponer mejoras estructuradas (modelo `PropuestaEquipo`)
- Reglas inviolables anti-alucinación: si no hay datos, no inventan

### Modelo de datos crítico (resumen)

```
Usuario       → identidad, rol (admin/vendedor/comprador), tokens MP
Tienda        → 1:1 con usuario vendedor, MP vinculado obligatorio para publicar
Producto      → tiendaId, categorías, ciudad, código de barras, moderación
Orden         → split MP, estado (pendiente/pago_aprobado/enviado/entregado), comisión
Mensaje       → chat comprador-vendedor con censura anti-evasión pre-venta
Disputa       → resolución de conflictos con foto y admin
Ticket        → soporte automatizado por AGENTE-SOPORTE
Agente        → IA con rango (trainee→c_level), XP, reputación, manifiesto
MensajeOrganización → chat interno equipo IA (4 canales)
MemoriaFundador → hechos persistentes que TODOS los agentes recuerdan
PropuestaEquipo → mejoras que el equipo IA propone al fundador
Moderacion    → audit log de cada decisión IA sobre productos
```

### Performance y seguridad

- **Compound indexes** en queries críticas del catálogo (ciudad + categoría + activo)
- **Aggregation pipeline** con $lookup en lugar de populate + filter en RAM
- **Cursor-based pagination** para escalar a 10k+ productos sin degradación
- **Rate limiting** por IP en endpoints sensibles (login: 20/15min, registro: 5/15min)
- **AES-256-GCM** para tokens MP en reposo (MP_ENCRYPTION_KEY separada de JWT_SECRET)
- **JWT con refresh token rotation** para sesiones largas
- **CORS con regex** para múltiples dominios Vercel
- **Helmet con CSP estricto** + HSTS + Referrer-Policy
- **mongo-sanitize + hpp** contra inyección NoSQL y parameter pollution

---

## 5. Cómo opera el equipo IA (la innovación de fondo)

### Quiénes son

**Diego (CEO)** — `claude.../gemini-2.5-flash`
- Backstory: ex-Mercado Libre 2008-2014, MBA MIT Sloan, 6 años en consultoría de marketplaces con 3 exits, 2 quiebras
- Marcos mentales: liquidez por ciudad > GMV, costo de no hacer, segundo orden de consecuencias
- Output: estrategia, reportes diarios con métricas reales, supervisión del equipo

**Sofía (CMO — Chief Moderation Officer)** — `gemini-2.5-flash`
- Backstory: 4 años en Mercado Pago como senior fraud analyst, ex-Ualá, certificación CFE
- Conocimiento: 47 patrones de fraude marketplace LatAm, normativa ANMAT/SENASA/IRAM
- Output: revisa cada producto pre-publicación, propone reglas anti-fraude

**Tomás (CTO — Chief Technology & Support)** — `gemini-2.5-flash`
- Backstory: ingeniero UTN, lideró Customer Engineering en fintech AR (30k → 2M usuarios)
- Doctrina: Tony Hsieh (Zappos), LTV > eficiencia de llamada
- Output: atiende tickets, detecta patrones de bugs por agregación de quejas

### Cómo deciden

Cada agente recibe en su system prompt:
1. **CONTEXTO_PROYECTO** (la visión del marketplace y la cultura del equipo)
2. **MemoriaFundador** (hechos persistentes ordenados por importancia)
3. **REGLAS INVIOLABLES** (R1-R8) que no pueden romper ni con autorización del fundador
4. **Identidad personal** (backstory, marcos mentales, vocabulario)
5. **Datos reales** del snapshot del marketplace en el período

### Las reglas inviolables (R1-R8)

| # | Regla | Por qué |
|---|---|---|
| R1 | Cero datos inventados. Sin datos → "no tengo info para opinar" | Sin esto los agentes son inservibles |
| R2 | No ejecutan acciones. Solo proponen | Separación clara fundador↔ejecución (humano) |
| R3 | No prometen lo que no pueden cumplir | Calibración de expectativas |
| R4 | No tocan plata sin autorización | Protección financiera |
| R5 | Nunca mienten para complacer | La adulación destruye el valor del equipo |
| R6 | No contradicen al fundador frente al equipo | Cultura: jerarquía visible |
| R7 | No opinan de áreas que no son suyas | Especialización |
| R8 | Respeto a regla #1 del proyecto (presupuestos.html no se toca) | Reglas externas críticas |

### Cron de operación

```
Cada 10 minutos: tick general
  ├─ Cada ~30 min: ronda de propuestas (los 3 agentes analizan datos reales)
  ├─ Cada ~1 h:    Diego supervisa el chat del equipo
  ├─ Cada 6 h:     procesamiento de ascensos automáticos
  ├─ 8 AM ARG:     reporte diario CEO al fundador (email + app)
  └─ Eventos reactivos:
     ├─ Producto sospechoso → Sofía dispara análisis al toque
     └─ Ticket escalado    → Tomás dispara análisis al toque
```

### Cómo se mide el equipo

Cada agente tiene métricas reales:
- **XP**: experiencia acumulada por decisión acertada
- **Reputación**: 0-100, sube si admin valida sus decisiones, baja si las revoca
- **Decisiones acertadas / revocadas**: track record
- **Ahorro generado**: pesos ARS que las propuestas implementadas ahorraron
- **Menciones recibidas**: cuántas veces otros agentes lo citaron

Cuando llegan al XP necesario y reputación ≥60, ascienden automáticamente. Diego firma cada ascenso en el canal "ascensos" del chat del equipo.

---

## 6. Diferencias clave con incumbentes

### Para un economista

**El insight central**: en marketplaces, **la liquidez es geográfica antes que vertical**. ML eligió escalar verticalmente (categorías) sobre territorio nacional. Esto crea fricción logística que se traslada al precio final. MercadoLocal apuesta al patrón opuesto: liquidez densa por geografía pequeña.

**El bet teórico**: la inelasticidad-precio del comprador local frente a "comprarle al vecino con entrega misma jornada" es mayor que la elasticidad necesaria para sostener un take rate más bajo. Hipótesis testeable en Lobos durante 2026.

**El modelo de externalidades positivas**: cada ciudad que activa MercadoLocal aumenta el flujo monetario intra-municipal vs. extra-municipal. Es decir, MercadoLocal es **antimonopólico por diseño** — distribuye la economía digital, no la concentra.

### Para un desarrollador

**El stack es estándar pero las decisiones arquitectónicas son específicas para el problema**:
- React+Vite porque el time-to-interactive es crítico en LatAm con conexiones lentas
- MongoDB porque el modelo de datos del marketplace (productos con N atributos variables por categoría) cae naturalmente en documentos, no en filas
- Gemini 2.5 Flash sobre GPT-4 porque la cuota gratis cubre toda la operación inicial y la latencia es 2x mejor para Q&A conversacional
- Mercado Pago split sobre Stripe porque la penetración en Argentina es 6M+ usuarios vs Stripe 0 retail
- Railway sobre AWS porque la curva de aprendizaje es 1 día vs 2 semanas, y el costo a esta escala es 1/10

**Lo no-obvio**: el sistema de agentes IA NO usa LangChain ni AutoGen ni CrewAI. Es código vanilla con `@google/generative-ai`. Cada agente es una función con un system prompt versionado en `seedAgentes.js`. La "cadena de pensamiento" es una secuencia de `await hablarComoAgente()` en orden. Esto da control total sobre tokens, latencia y costos.

### Para Marcos Galperín (o cualquier ejecutivo de marketplace establecido)

**Tres preguntas que merecen respuesta directa**:

**1. ¿Por qué no lo hace ML?**
Porque ML está optimizado para escala nacional, no para densidad local. Replicar este modelo significaría desactivar 15 años de optimización logística. Crear "ML Lobos" como vertical local sería destruir el modelo de Mercado Envíos. El costo de oportunidad es prohibitivo para una empresa pública.

**2. ¿Por qué no lo destruye ML cuando vea tracción?**
Tres motivos:
- ML necesita escala nacional para hacer su unit economics — un mercado de 50k habitantes no le da el ARR mínimo para activar marketing
- Los compradores locales prefieren saber a quién le compran. ML no puede simular eso
- ML usaría su CAC pago (publicidad nacional) contra nosotros que crecemos por boca a boca local. Diferentes tipos de match

**3. ¿Qué pasa si MercadoLocal escala?**
A los 50 ciudades activas (~Argentina hispanohablante interior + capitales secundarias), hablamos de un ARR potencial de USD 9-12M con costos operativos de USD 200k/año. Margen bruto 95%+. A 200 ciudades en LatAm, ARR potencial USD 50M+.

El "techo" no es tecnológico: es de adopción local. Cada ciudad nueva requiere convencer a los primeros 50 vendedores. Esto es trabajo de campo, no de software.

---

## 7. KPIs que estamos mirando

### Métricas líder (correlación con éxito)
- **Liquidez semanal por ciudad**: # de compras concretadas en últimas 7 días / # vendedores activos
- **Tasa de retorno comprador (D7, D30)**: % de compradores que vuelven a comprar
- **Tiempo desde primer click hasta primera compra concretada**: indica fricción de UX
- **NPS post-recepción**: encuesta automática al confirmar entrega

### Métricas lagging (resultado)
- GMV mensual por ciudad
- Take rate efectivo (revenue / GMV)
- Costo de adquisición de vendedor (CAV) — meta: ARS 0 (orgánico)
- Costo de adquisición de comprador (CAC) — meta: ARS 0 (orgánico)
- Margen operativo bruto

### Métricas anti-vanity (que NO miramos)
- Total de productos publicados (vanity — importa que se vendan, no que estén listados)
- Total de usuarios registrados (vanity — importa retención, no signup)
- Tiempo en la app (puede ser malo: si pasan 30 min buscando, hay fricción)

---

## 8. Riesgos y honestidad

### Riesgos identificados

**1. Densidad de liquidez insuficiente**
El modelo requiere masa crítica local. Si Lobos no llega a 30 vendedores y 500 compradores activos en 6 meses, hay que recalibrar la estrategia de adopción.

**2. Mercado Pago como single point of failure**
Si MP cambia su política de split payments o de OAuth para terceros, hay riesgo regulatorio. Mitigación: estamos pre-evaluando integraciones con MODO y otras alternativas.

**3. Fraude organizado**
Sofía detecta patrones, pero fraude profesional puede burlar moderación automática. Mitigación: sistema de disputas + escalado humano + bloqueo de IPs/dispositivos reincidentes.

**4. Saturación de propuestas IA**
Si el equipo IA propone 9 mejoras/día y el fundador no llega a procesarlas, la cola se vuelve ruido. Mitigación implementada: max 3 propuestas activas por agente.

**5. Lock-in de proveedor IA**
Si Google sube precios de Gemini o cambia rate limits, hay riesgo de costos. Mitigación: el código del cerebro está abstraído — migrar a Claude/GPT requiere reemplazar el SDK, no rearmar la lógica.

### Lo que NO sabemos todavía

- Si los compradores realmente prefieren local cuando el precio nacional es 5-10% menor
- Cuál es el umbral psicológico de comisión que un vendedor tolera (¿7% es muy bajo y debería subir a 12%?)
- Si Diego/Sofía/Tomás son percibidos como "valor" o como "gimmick" cuando los descubren los usuarios
- Cómo escala la moderación cuando hay 1000 productos nuevos/día (hoy son ~5/día)

---

## 9. Camino propuesto (próximos 12 meses)

| Trimestre | Hito | Métrica de éxito |
|---|---|---|
| Q2 2026 | Validación Lobos | 30 vendedores activos · 500 compradores · NPS > 50 |
| Q3 2026 | Segunda ciudad (Tandil o Mercedes) | Replicar Lobos en 60 días |
| Q4 2026 | 5 ciudades interior Buenos Aires | USD 5k MRR · margen 90%+ |
| Q1 2027 | Expansión nacional (capitales provinciales) | 15 ciudades · USD 25k MRR |

Cada hito requiere validación de la hipótesis subyacente. Si Lobos no funciona, no escalamos. Esto es lo opuesto al "build and they will come" — es "build, validate, then build more".

---

## 10. Por qué importa más allá de la rentabilidad

MercadoLocal es también un experimento de **operación corporativa con IA como fuerza laboral primaria**. Si funciona, prueba que:

- Empresas medianas pueden operar con cuadros directivos IA y supervisión humana mínima
- La calidad de decisiones tácticas IA con prompts bien diseñados y datos reales **compite con managers humanos** en costo/tiempo/consistencia
- El modelo es replicable a otros verticales (FoodTech local, services marketplace, etc.)

Para un VC, esto es una empresa SaaS-like con potencial 100x. Para un economista, es un experimento de redistribución económica habilitado por tech. Para un desarrollador, es un caso real de arquitectura agentica simple ganándole a frameworks complejos.

---

## Apéndice — links operativos

- **Frontend**: `https://mercadolocal-nu.vercel.app`
- **Backend API**: `https://mercadolocal-production.up.railway.app/api`
- **Health check**: `GET /api/health` y `GET /api/health/detalle`
- **Panel del equipo IA** (admin only): `/admin/cerebro`
- **Panel de propuestas** (admin only): `/admin/cerebro/propuestas`

**Repositorio**: privado, contacto al fundador.

---

*MercadoLocal · Lobos, Buenos Aires · 2026*
*"Si Mercado Libre conectó Argentina, MercadoLocal vuelve a conectar tu cuadra con la cuadra de al lado."*
