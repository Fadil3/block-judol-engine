from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn
from judol_detector import JudolDetector
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Judol Detection API",
    description="API for detecting online gambling (judol) content based on keywords.",
    version="1.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your extension's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector
detector = JudolDetector()

# --- New Pydantic Models for Simplified API ---

class AnalysisDetail(BaseModel):
    matched_keywords: Optional[List[str]] = None
    keyword_score: Optional[float] = None
    regex_score: Optional[float] = None

class AnalysisResult(BaseModel):
    is_gambling: bool
    confidence: float
    selector: str
    type: str # 'text' or 'image_url'
    details: AnalysisDetail

class HTMLAnalysisRequest(BaseModel):
    html: str
    url: Optional[str] = None
    image_urls: Optional[List[str]] = None

# --- End of Pydantic Models ---

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Judol Keyword Detection API is running",
        "status": "healthy",
        "version": "1.1.0"
    }

@app.post("/analyze/html", response_model=List[AnalysisResult])
async def analyze_html(request: HTMLAnalysisRequest):
    """Analyze HTML content for judol content based on text and image URLs."""
    try:
        # Pass the pre-filtered image list to the detector
        results = detector.analyze_html_content(
            html_content=request.html, 
            base_url=request.url,
            image_urls=request.image_urls
        )
        return results
    except Exception as e:
        logger.error(f"Error analyzing HTML: {e}", exc_info=True)
        # Re-raise as HTTPException to be handled by FastAPI
        raise HTTPException(status_code=500, detail=f"HTML analysis error: {str(e)}")

@app.get("/keywords")
async def get_keywords():
    """Get all keywords and regex patterns"""
    return {
        "keywords": detector.keywords,
        "regex_patterns": detector.regex_patterns
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        keywords_ok = isinstance(detector.keywords, list) and len(detector.keywords) > 0
        return {
            "status": "healthy",
            "keywords_loaded": keywords_ok,
            "total_keywords": len(detector.keywords),
            "total_regex": len(detector.regex_patterns)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
