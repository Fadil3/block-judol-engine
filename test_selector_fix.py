#!/usr/bin/env python3

import sys
import os
sys.path.append('/home/seryu/projects/block-judol-engine')

from judol_detector import JudolDetector

# Create test HTML content
test_html = """
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <header class="site-header">
        <nav class="main-nav">Navigation Menu</nav>
    </header>
    <main class="content">
        <div class="article">
            <h1>Normal Article Title</h1>
            <p>This is normal content about technology.</p>
        </div>
        <div class="sidebar">
            <div class="ad-block" id="promo1">
                <h2>SLOT GACOR MAXWIN! Daftar sekarang dan dapatkan bonus 100%</h2>
                <p>RTP live tertinggi anti rungkad! Link alternatif situs terpercaya.</p>
            </div>
        </div>
        <div class="footer-ads">
            <p>Some footer content here.</p>
        </div>
    </main>
    <footer class="site-footer">Footer content</footer>
</body>
</html>
"""

def test_selector_generation():
    print("🧪 Testing improved CSS selector generation...")
    
    detector = JudolDetector()
    
    try:
        # Attempt to load model, but don't worry if it fails
        detector.load_model()
        print("✅ Model loaded successfully")
    except:
        print("⚠️  Model not found, training new model...")
        detector.train_model()
        print("✅ Model trained successfully")
    
    # Analyze the test HTML
    print("\n🔍 Analyzing test HTML content...")
    result = detector.analyze_html_content(test_html)
    
    print(f"\n📊 Analysis Results:")
    print(f"Overall Judol Detection: {result['overall']['is_judol']}")
    print(f"Overall Confidence: {result['overall']['confidence']:.3f}")
    print(f"Suspicious Elements Found: {result['total_suspicious_elements']}")
    
    if result['suspicious_elements']:
        print(f"\n🎯 Suspicious Elements Details:")
        for i, element in enumerate(result['suspicious_elements'], 1):
            print(f"\n{i}. Selector: {element['selector']}")
            print(f"   Confidence: {element['confidence']:.3f}")
            print(f"   Text: {element['text']}")
            print(f"   Keywords: {element['matched_keywords']}")
            
            # Test selector specificity
            selector = element['selector']
            if '#' in selector:
                print(f"   ✅ Specific selector (uses ID)")
            elif '>' in selector and '.' in selector:
                print(f"   ✅ Specific selector (uses child combinator + class)")
            elif ':nth-child' in selector:
                print(f"   ✅ Specific selector (uses nth-child)")
            elif selector.count('.') >= 1:
                print(f"   ⚠️  Moderately specific (uses class)")
            else:
                print(f"   ❌ Generic selector - could match many elements")
    else:
        print("✅ No suspicious elements detected with high confidence")

if __name__ == "__main__":
    test_selector_generation()
