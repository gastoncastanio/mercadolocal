#!/bin/bash

# Script para iniciar LogoAI
# Este script configura Node.js y inicia el proyecto

set -e

NODE_BIN="$HOME/node-v20.10.0-darwin-x64/bin/node"
NPM_BIN="$HOME/node-v20.10.0-darwin-x64/bin/npm"
NPX_BIN="$HOME/node-v20.10.0-darwin-x64/bin/npx"

# Verificar Node.js
if [ ! -f "$NODE_BIN" ]; then
    echo "❌ Node.js no encontrado. Descargando..."
    curl -L "https://nodejs.org/dist/v20.10.0/node-v20.10.0-darwin-x64.tar.xz" -o ~/node.tar.xz
    cd ~ && tar -xf node.tar.xz && rm node.tar.xz
    echo "✅ Node.js instalado"
fi

echo "📦 Node version: $($NODE_BIN --version)"

# Crear aliases
alias node="$NODE_BIN"
alias npm="$NPM_BIN"
alias npx="$NPX_BIN"

# Menu
echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║          🚀 LOGOAI - MENÚ PRINCIPAL            ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "1) Instalar dependencias (Backend)"
echo "2) Instalar dependencias (Frontend)"
echo "3) Iniciar Backend"
echo "4) Iniciar Frontend"
echo "5) Instalar TODO y iniciar"
echo ""
read -p "Elige una opción (1-5): " option

case $option in
    1)
        echo "📥 Instalando backend..."
        cd backend
        $NPM_BIN install
        echo "✅ Backend listo"
        ;;
    2)
        echo "📥 Instalando frontend..."
        cd frontend
        $NPM_BIN install
        echo "✅ Frontend listo"
        ;;
    3)
        echo "🚀 Iniciando backend en puerto 3001..."
        cd backend
        $NODE_BIN src/server.js
        ;;
    4)
        echo "🚀 Iniciando frontend en puerto 5173..."
        cd frontend
        $NPX_BIN vite
        ;;
    5)
        echo "📥 Instalando todo..."
        cd backend && $NPM_BIN install && cd ../frontend && $NPM_BIN install
        echo ""
        echo "✅ Todo instalado"
        echo ""
        echo "Para iniciar, abre 2 terminales:"
        echo "Terminal 1: cd backend && $NODE_BIN src/server.js"
        echo "Terminal 2: cd frontend && $NPX_BIN vite"
        echo ""
        echo "Luego abre: http://localhost:5173"
        ;;
    *)
        echo "Opción inválida"
        ;;
esac
