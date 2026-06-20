# 📊 Plan Maestro — Panel del Contador (Libro Mayor del Marketplace)

**Versión:** 1.0  
**Estado:** Fase 2 completada (Núcleo + Hooks)  
**Última actualización:** 2025-06-20  
**Commits:**
- 0370a04: Fase 0 + 1: Núcleo contable
- 74d4e00: Fase 2: Hooks en webhooks  

---

## Decisiones congeladas

| Tema | Decisión | Impacto |
|------|----------|---------|
| **Escrow / Por Pagar** | Mostrar ambos: real + informativo | Dos métricas: Saldos reales (tu plata) vs GMV transaccionado (volumen) |
| **Motor de datos** | MongoDB con transacciones | Partida doble en Mongoose, cero infra nueva |
| **Régimen fiscal** | Configurable (Monotributo → RI) | IVA parametrizado, switch sin reescritura |
| **ARCA / CAE** | Interno por ahora | Comprobantes "borrador"; ARCA como paso aparte |

---

## Arquitectura contable

### Plan de Cuentas (Chart of Accounts)

```
ACTIVO (ASSET)
  1.1.1  Caja MercadoPago (disponible)      ← tu plata líquida real
  1.1.2  MercadoPago a liberar (clearing)   ← se libera en 10-14 días
  1.1.3  Caja Banco                         ← retiros a tu banco
  1.2.1  Cuentas por Cobrar

PASIVO (LIABILITY)
  2.1.1  Cuentas por Pagar a Vendedores     ← SOLO ventas sin-split (real)
  2.1.2  IVA Débito Fiscal                  ← solo si RI
  2.1.3  Provisión Impuestos (ARCA/IIBB/Municipal)

INGRESOS (REVENUE)
  4.1.1  Comisiones por Venta
  4.1.2  Comisiones por Traslado
  4.1.3  Suscripciones Destacado
  4.1.4  Pauta Publicitaria (vendedores)

EGRESOS (EXPENSE)
  5.1.1  Costo Procesamiento MercadoPago    ← Margen Bruto
  5.2.1  Marketing / Pauta (Meta, Google)   ← tu $1M/mes (carga manual)
  5.2.2  Hosting e Infraestructura
  5.2.3  Honorarios Contables / Bancarios
```

### Invariantes (inviolables)

1. **Σdebe === Σhaber en cada asiento** — validación en schema, pre-save rechaza.
2. **Referencialidad única por tipo de evento** — `referenciaId` unique → webhook duplicado no duplica ingreso.
3. **Inmutabilidad de asientos** — no hay `update` de saldos; errores se corrigen con asiento reversor.
4. **Zona horaria ART** — `fechaContable` en ART usando `Intl.DateTimeFormat` (no UTC).
5. **Fire-and-forget en webhooks** — la contabilidad **nunca** bloquea un cobro; errores se loguean async.

---

## Fases de entrega

### Fase 0 — Backfill (medio día)
- Migración: `AuditoriaFinanciera` + `Comprobante` existentes → asientos retroactivos.
- Idempotente (re-ejecutable sin duplicar).
- Sin esto, el mayor arranca vacío y el contador no ve histórico.

### Fase 1 — Núcleo contable (1 día)
- Modelos: `CuentaContable`, `AsientoContable`.
- Servicio: `contabilidadService.registrarAsiento()` atómico + transacción Mongo.
- Seed: plan de cuentas de arriba.
- **No toca dinero; es la base.**

### Fase 2 — Hooks en webhooks (medio día)
- `pagos.js`: después de `AuditoriaFinanciera.save()` → dispara asiento.
- Fire-and-forget; nunca bloquea el 200 de MP.

### Fase 3 — Reportes + 7 secciones (1 día)
- `reportesContablesService.js` + las 7 vistas.
- Función `cuadre()` que valida mayor vs saldo real de MP.

### Fase 4 — Panel + Export (1 día)
- `PanelContador.tsx`, Excel/PDF, carga OPEX.

### Fase 5 — Cash-flow en vivo + Fiscal (2 días, al final)
- Saldo MP en vivo (API vs reconstrucción).
- Switch Monotributo/RI.

---

## Mejoras buscadas en implementación

- ✅ Transacciones Mongo robustas con rollback automático.
- ✅ Validaciones sofisticadas en esquemas (Σdebe=Σhaber, cada línea debe XOR haber).
- ✅ Sistema de reconciliación automática con MP (detecta diferencias).
- ✅ Audit trail completo (quién, cuándo, qué IP si webhook).
- ✅ Índices optimizados para búsqueda y agregación rápida.
- ✅ Caching de agregaciones diarias (performance en reportes).
- ✅ Alertas automáticas si descuadre (notificación a admin/contador).
- ✅ Modo borrador para asientos pre-confirmación (workflow de aprobación).
- ✅ Plantillas de asientos para eventos repetidos (reducir errores).
- ✅ Soporte multimoneda (ARS, USD) para futuro.
- ✅ Trazabilidad de cada línea del asiento (quién la creó, fuente).

---

## Testing de cierre

End-to-end en sandbox MP:
1. Venta con split → asiento de solo-comisión.
2. Venta sin split → asiento con payable.
3. Reembolso → reverso automático.
4. Suscripción → ingreso recurrente.
5. Carga OPEX → egreso.
6. `cuadre()` en verde: mayor = saldo real MP.

**Criterio de terminado:** balance del mayor coincide al peso con MP, ningún asiento descuadra.

---

## Referencias en el código

- `backend/src/models/AuditoriaFinanciera.js` — ya captura pago_aprobado / pago_rechazado.
- `backend/src/models/Comprobante.js` — ya emite Factura C de comisión + pauta.
- `backend/src/services/facturacionService.js` — disparador de emisión.
- `backend/src/routes/pagos.js` — webhook; el punto de enganche.
- `backend/src/services/arcaService.js` — stub de ARCA; solo `solicitarCAE()`.
- `backend/src/models/Contador.js` — numerador atómico sin huecos.

---
