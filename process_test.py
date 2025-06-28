import requests
import time

# URL of the API server
API_URL = "http://127.0.0.1:8000"

def test_html_analysis():
    """
    Tests the /analyze/html endpoint with a sample HTML containing multiple images,
    including a mix of suspicious and non-suspicious URLs and content.
    """
    print("--- Testing HTML Analysis with ProcessPoolExecutor ---")

    # Sample HTML with various images
    # - one with a keyword in the URL
    # - one standard banner (will be OCR'd)
    # - one clean image
    # - one non-existent image
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Page for Judol Detection</title>
    </head>
    <body>
        <h1>Welcome</h1>
        <p>This is a test page.</p>
        
        <!-- Suspicious image based on URL -->
        <img id="suspicious_by_url" src="https://example.com/ads/banner-slotgacor-777.gif">
        
        <!-- Image that requires OCR -->
        <img id="ocr_needed" src="https://i.imgur.com/jUAPJCB.png">
        
        <!-- Clean image -->
        <img id="clean" src="https://www.python.org/static/community_logos/python-logo-master-v3-TM.png">

        <!-- Broken image link -->
        <img id="broken" src="https://example.com/nonexistent.jpg">

        <div class="promo">
            <p>Check out our special offers! Main slot dapat bonus besar!</p>
        </div>
    </body>
    </html>
    """

    payload = {
        "html": html_content,
        "url": "https://example.com"
    }

    try:
        start_time = time.time()
        response = requests.post(f"{API_URL}/analyze/html", json=payload, timeout=60)
        end_time = time.time()

        print(f"Request completed in {end_time - start_time:.2f} seconds.")
        
        if response.status_code == 200:
            data = response.json()
            print("\n--- Analysis Results ---")
            print(f"Overall Judol Confidence: {data['overall']['confidence']:.2f}")
            print(f"Total Suspicious Elements Found: {data['total_suspicious_elements']}")
            
            print("\n--- Suspicious Elements Details ---")
            for element in data['suspicious_elements']:
                print(f"  - Selector: {element['selector']}")
                print(f"    Confidence: {element['confidence']:.2f}")
                print(f"    Text/Reason: {element['text']}")
                print(f"    Keywords: {element['matched_keywords']}")
            
            # Assertions to verify correctness
            assert data['total_suspicious_elements'] >= 2, "Should find at least 2 suspicious elements"
            
            selectors = [el['selector'] for el in data['suspicious_elements']]
            assert '#suspicious_by_url' in selectors, "Did not flag image with suspicious URL"
            assert '#ocr_needed' in selectors, "Did not flag image after OCR"
            # Make the text selector assertion more robust
            assert any('div.promo' in s for s in selectors), "Did not flag suspicious text element"

            print("\n[SUCCESS] Test passed. Results are consistent with expectations.")

        else:
            print(f"\n[ERROR] API returned status code {response.status_code}")
            print(f"Response: {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"\n[ERROR] Failed to connect to the API server: {e}")
        print("Please ensure the API server is running (`python api_server.py`) and accessible at", API_URL)

if __name__ == "__main__":
    test_html_analysis()
