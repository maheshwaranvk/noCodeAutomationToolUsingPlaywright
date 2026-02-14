#!/bin/bash
# Setup script for No-Code UI Automation
# This script installs dependencies and guides through startup

set -e

echo "🤖 No-Code UI Automation - Setup Script"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install
echo "✅ Backend dependencies installed"
echo ""

# Build backend
echo "🔨 Building backend..."
npm run build
echo "✅ Backend built successfully"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..
echo "✅ Frontend dependencies installed"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "📝 To start the application:"
echo ""
echo "   Terminal 1 (Backend - port 3001):"
echo "   $ npm start"
echo ""
echo "   Terminal 2 (Frontend - port 3000):"
echo "   $ cd frontend && npm start"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
echo "For more details, see QUICKSTART_SEPARATE_SERVERS.md"
