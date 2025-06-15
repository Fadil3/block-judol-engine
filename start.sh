#!/bin/bash

# Quick start guide for Judol Detection Engine

echo "🚀 Judol Detection Engine - Quick Start"
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run setup.sh first."
    exit 1
fi

echo "🔧 Starting services..."
echo ""

# Start API server in background
echo "📡 Starting API server..."
source venv/bin/activate
nohup python api_server.py > api.log 2>&1 &
API_PID=$!
echo "API Server started with PID: $API_PID"
echo "API available at: http://localhost:8000"
echo "API docs available at: http://localhost:8000/docs"
echo ""

# Wait a moment for server to start
sleep 3

# Test API health
echo "🧪 Testing API health..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ API is healthy and ready!"
else
    echo "❌ API health check failed. Check api.log for errors."
fi

echo ""
echo "🌐 Opening demo page..."
echo "Demo page: file://$(pwd)/demo.html"

# Open demo page if browser is available
if command -v xdg-open > /dev/null; then
    xdg-open "file://$(pwd)/demo.html"
elif command -v open > /dev/null; then
    open "file://$(pwd)/demo.html"
fi

echo ""
echo "📱 Browser Extension Installation:"
echo "1. Open Chrome/Edge and go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked' and select the 'extension' folder"
echo ""
echo "🛑 To stop the API server:"
echo "   kill $API_PID"
echo ""
echo "📊 View API logs:"
echo "   tail -f api.log"
echo ""
echo "Happy testing! 🎉"
