#!/usr/bin/env python3

"""
Test script for the Judol Detection Engine
Run this script to test the API endpoints and ML model
"""

import requests
import json
import time

API_BASE = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
    print()

def test_text_prediction():
    """Test text prediction endpoint"""
    print("🔍 Testing text prediction...")
    
    test_cases = [
        {
            "text": "Slot gacor maxwin hari ini! RTP live pragmatic play tertinggi!",
            "expected": True,
            "name": "High-risk gambling content"
        },
        {
            "text": "Resep masakan Indonesia yang lezat dan mudah dibuat untuk keluarga",
            "expected": False,
            "name": "Safe cooking content"
        },
        {
            "text": "Daftar situs judi online terpercaya dengan bonus new member 100%",
            "expected": True,
            "name": "Gambling site promotion"
        },
        {
            "text": "Tutorial programming Python untuk pemula dengan contoh kode",
            "expected": False,
            "name": "Programming tutorial"
        }
    ]
    
    for case in test_cases:
        try:
            response = requests.post(
                f"{API_BASE}/predict/text",
                json={"text": case["text"], "threshold": 0.5}
            )
            
            if response.status_code == 200:
                result = response.json()
                is_judol = result["is_judol"]
                confidence = result["confidence"]
                
                status = "✅" if is_judol == case["expected"] else "❌"
                print(f"{status} {case['name']}")
                print(f"   Text: {case['text'][:50]}...")
                print(f"   Predicted: {is_judol} (confidence: {confidence:.3f})")
                print(f"   Keywords: {result['matched_keywords']}")
                
            else:
                print(f"❌ Request failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error testing {case['name']}: {e}")
        
        print()

def test_html_analysis():
    """Test HTML analysis endpoint"""
    print("🔍 Testing HTML analysis...")
    
    sample_html = """
    <html>
    <head><title>Slot Gacor Maxwin - Situs Judi Online Terpercaya</title></head>
    <body>
        <h1>Selamat datang di situs slot gacor</h1>
        <div class="promo">
            <h2>Bonus New Member 100%</h2>
            <p>Daftar sekarang dan dapatkan RTP live tertinggi!</p>
            <a href="/daftar">Daftar Slot Gacor</a>
        </div>
        <div class="content">
            <p>Pragmatic Play dan PG Soft dengan anti rungkad</p>
            <p>Minimal deposit 10 ribu, maxwin jutaan rupiah!</p>
        </div>
        <footer>
            <p>Situs resmi dan terpercaya untuk judi online</p>
        </footer>
    </body>
    </html>
    """
    
    try:
        response = requests.post(
            f"{API_BASE}/analyze/html",
            json={
                "html": sample_html,
                "url": "https://example-gambling-site.com",
                "threshold": 0.5
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ HTML analysis completed")
            print(f"   Overall judol detection: {result['overall']['is_judol']}")
            print(f"   Confidence: {result['overall']['confidence']:.3f}")
            print(f"   Suspicious elements found: {result['total_suspicious_elements']}")
            
            if result['suspicious_elements']:
                print("   Suspicious elements:")
                for elem in result['suspicious_elements'][:3]:  # Show first 3
                    print(f"     - {elem['selector']}: {elem['text'][:50]}...")
                    
        else:
            print(f"❌ HTML analysis failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ HTML analysis error: {e}")
    
    print()

def test_keywords():
    """Test keywords endpoint"""
    print("🔍 Testing keywords endpoint...")
    try:
        response = requests.get(f"{API_BASE}/keywords")
        if response.status_code == 200:
            result = response.json()
            print("✅ Keywords retrieved successfully")
            print(f"   Total keywords: {result['total_keywords']}")
            
            # Show some high-scoring keywords
            high_score_keywords = {k: v for k, v in result['keywords'].items() if v >= 15}
            print(f"   High-risk keywords (score ≥15): {len(high_score_keywords)}")
            
            if high_score_keywords:
                print("   Sample high-risk keywords:")
                for keyword, score in list(high_score_keywords.items())[:5]:
                    print(f"     - '{keyword}': {score}")
                    
        else:
            print(f"❌ Keywords request failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Keywords error: {e}")
    
    print()

def main():
    """Run all tests"""
    print("🧪 Starting Judol Detection Engine Tests")
    print("=" * 50)
    print()
    
    # Check if API is running
    print("⏳ Checking if API server is running...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=5)
        if response.status_code == 200:
            print("✅ API server is running")
        else:
            print("❌ API server returned unexpected status")
            return
    except Exception as e:
        print(f"❌ Cannot connect to API server: {e}")
        print("Please make sure the API server is running:")
        print("   python api_server.py")
        return
    
    print()
    
    # Run tests
    test_health()
    test_keywords()
    test_text_prediction()
    test_html_analysis()
    
    print("🎉 Testing completed!")
    print()
    print("Next steps:")
    print("1. Install the browser extension from the 'extension' folder")
    print("2. Visit websites to test real-time detection")
    print("3. Adjust thresholds and keywords as needed")

if __name__ == "__main__":
    main()
