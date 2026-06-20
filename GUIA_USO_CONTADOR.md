# 📊 Guía de Uso — Sistema Contable de MercadoLocal

## Pruebas

### Invariante contable (corre en cualquier lado, sin DB)
```bash
node src/scripts/test-contabilidad-invariantes.js
```
Prueba que es **matemáticamente imposible** guardar un asiento descuadrado.
12 casos, corre en memoria (no necesita MongoDB).

### Prueba end-to-end completa (necesita un MongoDB)
```bash
# Opción A: contra una base de test local o Atlas
MONGODB_TEST_URI="mongodb+srv://...tu-base-de-test" node src/scripts/test-contabilidad-e2e.js

# Opción B: con Mongo en memoria (descarga binario; requiere red a fastdl.mongodb.org)
node src/scripts/test-contabilidad-e2e.js
```
Simula ventas split/sin-split, suscripción, pauta, OPEX, idempotencia y verifica
el cuadre global. ⚠️ La opción A **limpia las colecciones contables** de esa base
(usar SIEMPRE una base de test, no producción).

---

## Inicio rápido (primeros pasos)

### 1. Seeding del plan de cuentas (una sola vez)

```bash
# En el directorio backend
node src/scripts/seed-plan-cuentas.js
```

Salida esperada:
```
✅ Conectado a MongoDB
✓ Creada: 1.1.1 - Caja MercadoPago (Disponible)
✓ Creada: 1.1.2 - MercadoPago a Liberar (Clearing)
...
✅ Seed completado:
   Creadas: 20
   Actualizadas: 0
   Errores: 0
```

**O vía API:**
```bash
curl -X POST http://localhost:3000/api/contador/init-plan-cuentas \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"
```

### 2. Backfill del histórico (importa auditoría pasada)

```bash
node src/scripts/backfill-asientos-historicos.js
```

Salida esperada:
```
📋 Procesando AuditoriaFinanciera...
  → Encontradas 250 auditoras
  → Procesadas: 248 | Saltadas: 2 | Errores: 0

📄 Procesando Comprobantes (Pauta + Comisión)...
  → Encontrados 45 comprobantes
  → Procesadas: 43 | Saltadas: 2 | Errores: 0

✅ Backfill completado:
   Asientos creados: 291
   Saltadas (ya existían): 4
   Errores: 0
```

### 3. Verificar cuadre (¿cuadra el mayor?)

```bash
curl http://localhost:3000/api/contador/cuadre \
  -H "Authorization: Bearer <admin-token>"
```

Respuesta OK:
```json
{
  "cuadra": true,
  "totalActivos": 1250000.00,
  "totalPasivos": 50000.00,
  "totalPatrimonio": 1200000.00,
  "diferencia": 0.00,
  "ecuacion": "1250000 = 1250000"
}
```

---

## Operaciones diarias

### Registrar un gasto (OPEX manual)

```bash
curl -X POST http://localhost:3000/api/contador/gasto \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoria": "marketing",
    "concepto": "Pauta Meta Lobos - Junio",
    "monto": 1000000,
    "fechaGasto": "2025-06-20",
    "comprobanteUrl": "https://...",
    "notas": "Campaña regional"
  }'
```

**Resultado:** El gasto se guarda + se genera automáticamente un asiento contable.

### Ver resumen del mes

```bash
curl http://localhost:3000/api/contador/resumen \
  -H "Authorization: Bearer <admin-token>"
```

Respuesta:
```json
{
  "periodo": { "desde": "2025-06-01", "hasta": "2025-06-20" },
  "ingresos": 2500000.00,
  "egresos": 1000000.00,
  "resultado": 1500000.00,
  "saldos": {
    "cajaMP": 1250000.00,
    "cajaBanco": 0.00,
    "cuentasPorPagar": 50000.00
  }
}
```

### Listar asientos contables

```bash
# Todos los asientos del mes actual
curl "http://localhost:3000/api/contador/asientos?desde=2025-06-01&hasta=2025-06-30&limit=50" \
  -H "Authorization: Bearer <admin-token>"

# Solo asientos de tipo venta_split
curl "http://localhost:3000/api/contador/asientos?tipo=venta_split" \
  -H "Authorization: Bearer <admin-token>"
```

---

## Cómo funciona internamente

### 🔄 Flujo de un pago

1. **Comprador paga** en MP → webhook a `/api/pagos/webhook`
2. **Backend verifica firma + idempotencia** (si ya procesó, ignora)
3. **Guarda AuditoriaFinanciera** (registro de entrada)
4. **Actualiza Orden + stock** (la realidad operativa)
5. **Genera asiento contable** (fire-and-forget) ← aquí entra contabilidad
6. **Responde 200 a MP** (webhook completado)

### 💾 Asiento guardado = balance inmutable

Cada asiento que entra es **atómico**: Σdebe === Σhaber o falla.

**Ejemplo: Venta con split de $50k, comisión 5%**

```
Fecha:       2025-06-20
Descripción: Venta orden #ab12cd | Split | Comisión: $2.500
Líneas:
  1. DEBE  1.1.2 (MP a liberar)    $2.500
  2. HABER 4.1.1 (Comisiones)      $2.500
  
Cuadra:      ✅ $2.500 = $2.500
```

### 🎯 Cuentas disponibles

**ACTIVO:**
- `1.1.1` — Caja MP (disponible)
- `1.1.2` — MP a liberar (clearing)
- `1.1.3` — Caja Banco
- `1.2.1` — Cuentas por Cobrar

**PASIVO:**
- `2.1.1` — Cuentas por Pagar a Vendedores ⚠️ (solo sin-split)
- `2.1.2` — IVA Débito Fiscal (si RI)
- `2.1.3` — Provisión Impuestos

**INGRESOS:**
- `4.1.1` — Comisiones por Venta
- `4.1.2` — Comisiones por Traslado
- `4.1.3` — Suscripciones Destacado
- `4.1.4` — Pauta Publicitaria
- `4.1.5` — Otros Ingresos

**EGRESOS:**
- `5.1.1` — Costo Procesamiento MP
- `5.2.1` — Marketing / Pauta
- `5.2.2` — Hosting e Infraestructura
- `5.2.3` — Honorarios Contables
- `5.2.4` — Otros Gastos Operativos

---

## Debugging

### Si hay descuadre

```bash
# Verificar cuadre detallado
curl http://localhost:3000/api/contador/cuadre \
  -H "Authorization: Bearer <admin-token>" | jq

# Si no cuadra, buscar asientos descuadrados en BD
# (La BD rechaza asientos que no cuadren, así que es muy raro)
```

### Si falta el backfill

Los logs de asientos pueden estar vacíos si:
1. **No ejecutaste el seed** → corre `seed-plan-cuentas.js`
2. **No ejecutaste el backfill** → corre `backfill-asientos-historicos.js`
3. **Los webhooks aún no procesaron** → espera nuevos pagos

### Logs del sistema

```bash
# Backend (tail -f de los logs)
# Buscar:
# - "💰 Asiento registrado" → contabilidad OK
# - "⚠️ Error registrando asiento" → fallo async (raro)
# - "🚨 DESCUADRE" → mayor no cuadra (muy raro)
```

---

## Próximos pasos (Fase 3+)

- **Fase 3:** Reportes + 7 secciones del panel (`reportesContablesService.js`)
- **Fase 4:** Frontend (`PanelContador.tsx`) + Excel/PDF export
- **Fase 5:** Cash-flow en vivo + switch fiscal Monotributo/RI

---

## Preguntas frecuentes

**P: ¿Qué pasa si un asiento falla?**  
R: El webhook igual responde 200 (el pago se guardó en auditoría). El asiento se intenta async; si falla, queda logueado pero no bloquea nada. La contabilidad nunca detiene el dinero.

**P: ¿Y si un webhook llega dos veces?**  
R: `referenciaId` unique + `findOne` antes de crear → la segunda vez se salta. Idempotencia garantizada.

**P: ¿El contador puede editar un asiento?**  
R: No. Los asientos son inmutables. Si hay error, se crea un asiento reversor (que deja el rastro).

**P: ¿Dónde está la plata que le debo a los vendedores?**  
R: En `2.1.1` (Cuentas por Pagar). Pero ojo: **SOLO si la venta fue sin-split**. Con split, el vendedor cobra directo en MP (no es tu pasivo).

---

## Contacto

Dudas sobre la contabilidad → revisar `PLAN_CONTADOR.md` y el código de `contabilidadService.js` (bien documentado).
