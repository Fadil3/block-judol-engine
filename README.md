# Judol Detection Engine

A comprehensive system to detect and block online gambling (judol) content using Machine Learning and browser extension technology.

## 🚀 Features

### ML Detection Engine

- **Keyword-based scoring** using your comprehensive keyword list
- **TF-IDF text analysis** for context understanding
- **Random Forest classifier** for accurate content detection
- **RESTful API** for integration with web extensions
- **HTML element analysis** to identify specific suspicious content

### Browser Extension

- **Real-time content analysis** of web pages
- **Multiple blocking modes**: Highlight, Blur, or Hide suspicious content
- **Adjustable sensitivity** threshold
- **Visual warnings** for high-risk pages
- **Cross-browser compatibility** (Chrome, Edge, Firefox)

## 📁 Project Structure

```
block-judol-engine/
├── keywords.csv              # Your judol keywords with scores
├── judol_detector.py         # ML detection engine
├── api_server.py            # FastAPI server
├── requirements.txt         # Python dependencies
├── setup.sh                # Setup script
├── models/                 # Trained ML models (created after training)
└── extension/              # Browser extension
    ├── manifest.json       # Extension manifest
    ├── background.js       # Background service worker
    ├── content.js          # Content script for page analysis
    ├── content.css         # Styles for blocking/highlighting
    ├── popup.html          # Extension popup interface
    ├── popup.js            # Popup functionality
    └── icons/              # Extension icons
```

## 🛠️ Setup Instructions

### 1. Quick Setup

```bash
chmod +x setup.sh
./setup.sh
```

### 2. Manual Setup

#### Python Environment

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Train the model
python judol_detector.py
```

#### Start API Server

```bash
source venv/bin/activate
python api_server.py
```

The API will be available at `http://localhost:8000`

#### Install Browser Extension

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` folder
4. The extension will appear in your browser toolbar

## 🔧 Usage

### API Endpoints

#### Health Check

```bash
curl http://localhost:8000/health
```

#### Analyze Text

```bash
curl -X POST http://localhost:8000/predict/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Slot gacor maxwin hari ini!", "threshold": 0.5}'
```

#### Analyze HTML Content

```bash
curl -X POST http://localhost:8000/analyze/html \
  -H "Content-Type: application/json" \
  -d '{"html": "<html>...</html>", "url": "https://example.com"}'
```

#### Get Keywords

```bash
curl http://localhost:8000/keywords
```

### Browser Extension

1. **Automatic Detection**: The extension automatically scans pages you visit
2. **Visual Indicators**: Suspicious content is highlighted/blurred/hidden based on your settings
3. **Popup Control**: Click the extension icon to view page analysis and adjust settings
4. **Blocking Modes**:
   - **Highlight**: Red border around suspicious content
   - **Blur**: Blur suspicious content with click-to-reveal
   - **Hide**: Completely hide suspicious content with show button

## 🤖 Machine Learning Details

### Features Used

- **Keyword Scoring**: Based on your curated keyword list with weights
- **TF-IDF Vectors**: Term frequency analysis of text content
- **Text Statistics**: Length, word count, keyword density
- **N-gram Analysis**: 1-3 word combinations for context

### Model Training

- **Synthetic Data Generation**: Creates training samples using your keywords
- **Balanced Dataset**: Equal positive/negative samples
- **Random Forest**: Ensemble method for robust classification
- **Cross-validation**: 80/20 train/test split

### Performance Metrics

The model achieves high accuracy on the synthetic dataset and can be improved with real-world data.

## 📊 Customization

### Adding Keywords

Edit `keywords.csv` to add new judol-related terms:

```csv
Keyword,Score
new_term,10
high_risk_term,15
```

### Adjusting Thresholds

- **API**: Use the `threshold` parameter in requests (0.0-1.0)
- **Extension**: Adjust sensitivity in the popup interface

### Blocking Modes

Configure how suspicious content is handled:

- `highlight`: Visual indicators only
- `blur`: Blur content with reveal option
- `hide`: Completely hide with manual reveal

## 🔒 Security Considerations

- The extension requires minimal permissions
- All analysis is done locally or on your controlled API server
- No user data is collected or transmitted to third parties
- API can be configured with authentication for production use

## 🚀 Deployment

### Production API

For production deployment, consider:

- Using a proper WSGI server (Gunicorn, uWSGI)
- Adding authentication middleware
- Setting up HTTPS
- Implementing rate limiting
- Adding monitoring and logging

### Extension Distribution

- Package the extension for Chrome Web Store
- Set up proper API endpoints for production
- Configure CSP (Content Security Policy)
- Add telemetry for improvement

## 🤝 Contributing

1. Add more sophisticated ML features
2. Improve keyword detection algorithms
3. Add support for more languages
4. Enhance UI/UX of the extension
5. Add unit tests for better reliability

## 📜 License

This project is for educational and protection purposes. Use responsibly and in accordance with local laws and regulations.

## ⚠️ Disclaimer

This tool is designed to help users avoid unwanted gambling content. It should not be the only measure for content filtering and may not catch all variations of gambling content. Users should exercise their own judgment when browsing online.
