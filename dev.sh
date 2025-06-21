#!/bin/bash

# Development helper script for Docker Compose

case "$1" in
    "start")
        echo "Starting Judol Detection services..."
        docker-compose up -d
        echo ""
        echo "Services started!"
        echo "API: http://localhost:8000"
        echo "Demo: http://localhost:8080"
        echo "API Docs: http://localhost:8000/docs"
        echo ""
        echo "To view logs: ./dev.sh logs"
        echo "To stop: ./dev.sh stop"
        ;;
    "stop")
        echo "Stopping services..."
        docker-compose down
        ;;
    "restart")
        echo "Restarting services..."
        docker-compose restart
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "logs-api")
        docker-compose logs -f judol-api
        ;;
    "logs-web")
        docker-compose logs -f web
        ;;
    "build")
        echo "Building services..."
        docker-compose build
        ;;
    "rebuild")
        echo "Rebuilding services..."
        docker-compose build --no-cache
        ;;
    "shell")
        echo "Opening shell in API container..."
        docker-compose exec judol-api bash
        ;;
    "test")
        echo "Testing API..."
        curl -X POST "http://localhost:8000/analyze" \
             -H "Content-Type: application/json" \
             -d '{"text": "Test content for judol detection"}'
        ;;
    "health")
        echo "Checking API health..."
        curl -s http://localhost:8000/health | python -m json.tool
        ;;
    *)
        echo "Judol Detection Engine - Development Helper"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  start     - Start all services"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  logs      - Show logs from all services"
        echo "  logs-api  - Show logs from API only"
        echo "  logs-web  - Show logs from web server only"
        echo "  build     - Build Docker images"
        echo "  rebuild   - Rebuild Docker images from scratch"
        echo "  shell     - Open shell in API container"
        echo "  test      - Test API with sample request"
        echo "  health    - Check API health status"
        echo ""
        echo "URLs when running:"
        echo "  API: http://localhost:8000"
        echo "  Demo: http://localhost:8080"
        echo "  API Docs: http://localhost:8000/docs"
        ;;
esac
