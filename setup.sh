#!/bin/bash

# Setup script for Judol Detection Engine

echo "🚀 Setting up Judol Detection Engine..."

# Create virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📚 Installing Python dependencies..."
pip install -r requirements.txt

# Download NLTK data
echo "📝 Downloading NLTK data..."
python -m nltk.downloader -d /home/appuser/nltk_data punkt stopwords

# Train the model
echo "🤖 Training the ML model..."
python judol_detector.py

# Create models directory if not exists
mkdir -p models

echo "✅ Setup complete!"
echo ""
echo "🔧 To start the API server:"
echo "   source venv/bin/activate"
echo "   python api_server.py"
echo ""
echo "🌐 To install the browser extension:"
echo "   1. Open Chrome/Edge and go to chrome://extensions/"
echo "   2. Enable 'Developer mode'"
echo "   3. Click 'Load unpacked' and select the 'extension' folder"
echo ""
echo "📡 API will be available at: http://localhost:8000"
echo "📖 API docs will be available at: http://localhost:8000/docs"

exec uvicorn api_server:app --host 0.0.0.0 --port 8000 --reload
