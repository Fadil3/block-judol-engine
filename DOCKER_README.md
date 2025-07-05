# Docker Compose Setup for Judol Detection Engine

This setup provides a convenient way to run the Judol Detection Engine using Docker Compose, eliminating the need for virtual environments and manual dependency management.

## Quick Start

1. **Start the services:**

   ```bash
   ./dev.sh start
   ```

2. **Access the applications:**

   - **API Tester:** http://localhost:8080 (Interactive testing interface)
   - **API Documentation:** http://localhost:7000/docs (Swagger UI)
   - **Demo Page:** http://localhost:8080/demo.html (Extension testing page)
   - **API Health:** http://localhost:7000/health

3. **Stop the services:**
   ```bash
   ./dev.sh stop
   ```

## Available Services

### judol-api (Port 7000)

- FastAPI application with the Judol Detection Engine
- Automatic reload on code changes
- Health check endpoint
- CORS enabled for browser extension testing

### redis (Port 6380)

- Redis cache with persistent storage
- AOF (Append-Only File) enabled for data durability
- Caches text and image analysis results
- Data survives container restarts

### web (Port 8080)

- Nginx server serving static files
- API Tester interface (default homepage)
- Demo page for extension testing
- Extension files for manual loading

## Development Commands

Use the `./dev.sh` script for common development tasks:

```bash
./dev.sh start      # Start all services
./dev.sh stop       # Stop all services
./dev.sh restart    # Restart all services
./dev.sh logs       # Show logs from all services
./dev.sh logs-api   # Show API logs only
./dev.sh build      # Build Docker images
./dev.sh rebuild    # Rebuild from scratch
./dev.sh shell      # Open shell in API container
./dev.sh test       # Test API with sample request
./dev.sh health     # Check API health
```

## Testing the Wrong Element Selection Issue

1. Start the services: `./dev.sh start`
2. Open the API Tester: http://localhost:8080
3. Test the problematic text: "Resep masakan Indonesia yang lezat dan mudah dibuat untuk keluarga tercinta."
4. Check the API response to see if it's incorrectly flagged as judol content
5. Use the HTML analyzer to test how elements are being selected

## Browser Extension Testing

1. Load the extension from the `extension/` directory
2. Visit http://localhost:8080/demo.html
3. Check how the extension behaves with the test content
4. The extension should communicate with the API at http://localhost:8000

## File Structure in Docker

```
/app/                 # Working directory in container
├── api_server.py     # FastAPI application
├── judol_detector.py # Detection engine
├── models/           # ML models and vectorizer
├── keywords.csv      # Keywords database
└── requirements.txt  # Python dependencies
```

## Volumes

- Current directory is mounted to `/app` for live code reloading
- `__pycache__` is excluded to prevent host/container conflicts
- Static files are served by nginx for browser testing
- `redis_data` volume for persistent Redis cache storage
- `nltk_data` volume for NLTK language data

## Environment Variables

- `PYTHONPATH=/app` - Ensures proper Python imports
- `PYTHONUNBUFFERED=1` - Real-time log output

## Troubleshooting

### API not starting

```bash
./dev.sh logs-api
```

### Web server issues

```bash
./dev.sh logs-web
```

### Rebuild if dependencies change

```bash
./dev.sh rebuild
```

### Check API health

```bash
./dev.sh health
```
