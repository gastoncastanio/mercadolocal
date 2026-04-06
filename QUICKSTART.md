# 🚀 Quick Start - LogoAI

Guía rápida para empezar con LogoAI en 5 minutos.

## 1️⃣ Prerrequisitos

Asegúrate de tener:
- ✅ Node.js v18+ instalado
- ✅ Cuenta OpenAI con créditos y acceso a DALL-E 3
- ✅ MongoDB (local o MongoDB Atlas)

## 2️⃣ Setup del Backend

```bash
# Navega a la carpeta backend
cd backend

# Instala dependencias
npm install

# Crea archivo .env con tus credenciales
cat > .env << 'EOF'
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/logoai
OPENAI_API_KEY=sk-tu-clave-openai
PORT=3001
NODE_ENV=development
EOF

# Inicia el servidor
npm run dev
```

✅ Backend disponible en: **http://localhost:3001**

## 3️⃣ Setup del Frontend

En otra terminal:

```bash
# Navega a la carpeta frontend
cd frontend

# Instala dependencias
npm install

# Inicia el servidor de desarrollo
npm run dev
```

✅ Frontend disponible en: **http://localhost:5173**

## 4️⃣ Usa la Aplicación

1. Abre tu navegador en: **http://localhost:5173**
2. Haz click en "Crear Logo Ahora"
3. Completa el formulario con info de tu marca
4. Elige un estilo de diseño
5. Personaliza colores y elementos
6. ¡Espera a que se generen 12 variaciones!
7. Guarda tus favoritos y descarga en PNG, SVG o PDF

## 🔧 Troubleshooting Rápido

### Error: `OPENAI_API_KEY not found`
```bash
→ Verifica que el archivo .env existe en /backend/.env
→ Comprueba tu API key en https://platform.openai.com/account/api-keys
```

### Error: `MongoDB connection failed`
```bash
→ Si usas MongoDB Atlas: verifica IP whitelist
→ Si usas local: ejecuta `mongod` en otra terminal
```

### Error: `CORS error`
```bash
→ Asegúrate que el backend está en puerto 3001
→ Verifica que el frontend accede a http://localhost:3001/api
```

## 📚 Archivos Importantes

```
logoai/
├── frontend/src/pages/Crear.tsx      ← Flujo principal de creación
├── backend/src/routes/logos.js       ← Endpoint de generación
├── backend/src/services/dalleService.js ← Integración DALL-E
└── README.md                         ← Documentación completa
```

## 🎯 Próximos Pasos

- [ ] Haz tu primer logo
- [ ] Descarga en diferentes formatos
- [ ] Personaliza los colores
- [ ] Explora diferentes estilos
- [ ] Integra con tu marca

## 💬 Soporte

Si tienes problemas:
1. Revisa el archivo README.md
2. Verifica que todas las dependencias están instaladas
3. Comprueba que los puertos 3001 y 5173 están disponibles
4. Mira los logs en terminal para más detalles

¡Disfruta creando logos con LogoAI! 🎨✨
