# Plan de Inversión en Seguridad — MercadoLocal

> Auditoría realizada el 2026-06-14. La base de seguridad ya es **sólida** para un
> marketplace en esta etapa. Lo que sigue son refinamientos, no agujeros críticos.

## ✅ Ya cubierto (auditado)
- Headers: Helmet + CSP + HSTS
- CORS validado por origen (dominio + previews Vercel + localhost)
- Inyección NoSQL (express-mongo-sanitize)
- HTTP Parameter Pollution (hpp)
- Rate limiting por ruta (general, login, registro, reset, recuperar, upload, webhook, recordatorio)
- Límite de body (2mb)
- Tokens de Mercado Pago encriptados (AES-256-GCM con clave separada de JWT)
- Webhook MP: verificación de firma HMAC + idempotencia + re-consulta del pago a MP
- Reset de contraseña: token hasheado (sha256), expiry 30min, anti-enumeración, password fuerte
- Sin secretos commiteados (.gitignore correcto)
- Rutas admin y cerebro IA: todas con `verificarToken, soloAdmin`
- DNI no se filtra vía populate (todos usan `select` explícito)
- Error handler enmascara detalles en producción

## ✅ Aplicado en esta auditoría (commit d98ae8b)
1. Webhook MP: comparación de firma en **tiempo constante** (`crypto.timingSafeEqual`) — anti timing-attack.
2. `Usuario.toJSON`: ya **no expone el DNI** (PII) en respuestas de API ni populates.

## 📋 Pendientes — rankeados por ROI

### 🔴 Prioridad alta (gratis, rápido)
1. **Configurar `MP_WEBHOOK_SECRET` en Railway.**
   Hoy, si la variable no está seteada, `verificarFirmaWebhook` retorna `true`
   (fail-open) y solo se apoya en la re-consulta del pago a MP. Setear el secret
   cierra esto del todo.
   - Una vez confirmado que está seteado en prod, evaluar cambiar el fallback a
     **fail-closed en producción** (rechazar si no hay secret). NO hacerlo antes
     de confirmar el secret, o se rompen todos los pagos.

2. **`npm audit fix` (backend).**
   15 vulnerabilidades detectadas (14 moderate, 1 high). Notable: `ws` 8.0.0–8.20.0
   (uninitialized memory disclosure) vía socket.io/engine.io. Requiere correr y testear
   el backend después.

### 🟠 Prioridad media
3. **Lockout por cuenta.** El anti-fuerza-bruta actual es por IP (20 logins/15min).
   Un ataque distribuido (muchas IPs) podría evadirlo. Agregar contador de intentos
   fallidos por cuenta + bloqueo temporal.

### 🟡 Inversión a futuro (según crecimiento)
4. **JWT en cookie httpOnly** en vez de localStorage (mitiga robo de token por XSS;
   la CSP ya reduce el riesgo de XSS). Refactor mediano (~1 día).
5. **2FA para vendedores/admin.** Cuando el volumen de plata lo justifique.
6. **Alertas de login** (email "iniciaste sesión desde un nuevo dispositivo").

---
_Generado durante la auditoría del Bloque 4. Próxima revisión: al sumar 2FA o al
cambiar el manejo de sesiones._
