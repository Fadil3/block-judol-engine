from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from judol_detector import JudolDetector
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Judol Detection API",
    description="API for detecting online gambling (judol) content",
    version="1.0.0"
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

# Pydantic models
class TextRequest(BaseModel):
    text: str
    threshold: Optional[float] = 0.5

class HTMLRequest(BaseModel):
    html: str
    url: Optional[str] = None
    threshold: Optional[float] = 0.5

class PredictionResponse(BaseModel):
    is_judol: bool
    confidence: float
    keyword_score: int
    matched_keywords: List[str]
    features: dict

class SuspiciousElement(BaseModel):
    selector: str
    text: str
    confidence: float
    matched_keywords: List[str]

class HTMLAnalysisResponse(BaseModel):
    overall: PredictionResponse
    suspicious_elements: List[SuspiciousElement]
    total_suspicious_elements: int
    url: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    """Load the model on startup"""
    try:
        detector.load_model()
        logger.info("Model loaded successfully!")
    except FileNotFoundError:
        logger.warning("Model not found. Training new model...")
        detector.train_model()
        logger.info("New model trained and ready!")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Judol Detection API is running",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.post("/predict/text", response_model=PredictionResponse)
async def predict_text(request: TextRequest):
    """Predict if text contains judol content"""
    try:
        # Update threshold if provided
        original_threshold = detector.threshold
        detector.threshold = request.threshold
        
        result = detector.predict(request.text)
        
        # Restore original threshold
        detector.threshold = original_threshold
        
        return PredictionResponse(**result)
    
    except Exception as e:
        logger.error(f"Error predicting text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/analyze/html", response_model=HTMLAnalysisResponse)
async def analyze_html(request: HTMLRequest):
    """Analyze HTML content for judol elements"""
    try:
        # Update threshold if provided
        original_threshold = detector.threshold
        detector.threshold = request.threshold
        
        result = detector.analyze_html_content(request.html)
        
        # Restore original threshold
        detector.threshold = original_threshold
        
        # Format response
        response_data = {
            "overall": result["overall"],
            "suspicious_elements": result["suspicious_elements"],
            "total_suspicious_elements": result["total_suspicious_elements"],
            "url": request.url
        }
        
        return HTMLAnalysisResponse(**response_data)
    
    except Exception as e:
        logger.error(f"Error analyzing HTML: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.get("/keywords")
async def get_keywords():
    """Get all keywords and their scores"""
    return {
        "keywords": detector.keywords_dict,
        "total_keywords": len(detector.keywords_dict)
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        # Test prediction
        test_result = detector.predict("test")
        
        return {
            "status": "healthy",
            "model_loaded": detector.model is not None,
            "keywords_loaded": len(detector.keywords_dict) > 0,
            "total_keywords": len(detector.keywords_dict),
            "test_prediction": test_result is not None
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
