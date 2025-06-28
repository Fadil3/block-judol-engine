import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import pickle
import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import os
import io
import requests
import redis
import json
import ahocorasick
import polars as pl
from urllib.parse import urljoin
from bs4 import BeautifulSoup

class JudolDetector:
    def __init__(self, keywords_file='keywords.csv'):
        # --- Polars Optimization ---
        # Use Polars for fast keyword loading and manipulation
        try:
            keyword_df = pl.read_csv(keywords_file)
            keyword_df = keyword_df.with_columns(
                pl.col("Keyword").str.to_lowercase().alias("keyword")
            )
            # For now, treat all entries as keywords. Regex can be added back later if needed.
            self.keywords = keyword_df.select(["keyword", "Score"]).rename({"Score": "score"}).to_dicts()
            self.regex_patterns = [] # No regex from this file for now
            print(f"✅ Loaded {len(self.keywords)} keywords using Polars.")
        except Exception as e:
            print(f"❌ Error loading keywords with Polars: {e}")
            self.keywords = []
            self.regex_patterns = []

        # --- Aho-Corasick for fast keyword matching ---
        self.automaton = ahocorasick.Automaton()
        for idx, keyword_data in enumerate(self.keywords):
            self.automaton.add_word(keyword_data['keyword'], (keyword_data['keyword'], keyword_data['score']))
        self.automaton.make_automaton()
        print("✅ Aho-Corasick automaton built.")
        
        self.vectorizer = TfidfVectorizer(max_features=5000)
        self.model = None
        self.redis_client = redis.StrictRedis(host='redis', port=6379, db=0)

        # Download necessary NLTK data if not present
        try:
            stopwords.words('english')
        except LookupError:
            print("Downloading NLTK stopwords...")
            nltk.download('stopwords')
        try:
            word_tokenize('test')
        except LookupError:
            print("Downloading NLTK punkt...")
            nltk.download('punkt')


    def preprocess_text(self, text):
        if not isinstance(text, str):
            return ""
        text = text.lower()
        text = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
        text = re.sub(r'[^a-zA-Z\s]', '', text)  # Remove punctuation and numbers
        tokens = word_tokenize(text)
        stop_words = set(stopwords.words('english'))
        tokens = [word for word in tokens if word not in stop_words and len(word) > 1]
        return " ".join(tokens)

    def extract_keyword_features(self, text):
        """
        Extracts features based on keyword matches and regex patterns.
        Returns a dictionary of features.
        """
        features = {'keyword_score': 0, 'regex_score': 0}
        
        # Use Aho-Corasick for keyword matching
        for end_index, (keyword, score) in self.automaton.iter(text.lower()):
            features['keyword_score'] += score

        # Use pre-compiled regex for pattern matching
        for pattern_data in self.regex_patterns:
            if re.search(pattern_data['keyword'], text.lower()):
                features['regex_score'] += pattern_data['score']
        
        return features

    def predict(self, text):
        """
        Predicts if the text is gambling-related based on a hybrid approach.
        First, it checks for direct keyword hits for a fast path.
        If keywords are present, it returns a high confidence score.
        If not, it can eventually fall back to a trained text classifier model (future).
        """
        
        processed_text = self.preprocess_text(text)
        
        # Check cache first
        try:
            cached_result = self.redis_client.get(f"judol-text:{processed_text}")
            if cached_result:
                print("✅ Text cache hit")
                return json.loads(cached_result)
        except redis.exceptions.RedisError as e:
            print(f"⚠️ Redis cache read error: {e}")


        # --- Keyword & Regex Analysis ---
        keyword_features = self.extract_keyword_features(text) # Use original text for keywords
        total_score = keyword_features['keyword_score'] + keyword_features['regex_score']
        
        # The confidence is normalized based on an arbitrary max score.
        # Let's say a score of 20+ is a very strong signal.
        confidence = min(1.0, total_score / 20.0)
        
        is_gambling = confidence > 0.5  # Use a threshold

        result = {
            'is_gambling': is_gambling,
            'confidence': confidence,
            'details': {
                'type': 'text',
                'keyword_score': keyword_features['keyword_score'],
                'regex_score': keyword_features['regex_score']
            }
        }
        
        # Cache the result
        try:
            self.redis_client.setex(f"judol-text:{processed_text}", 3600, json.dumps(result))
        except redis.exceptions.RedisError as e:
            print(f"⚠️ Redis cache write error: {e}")

        return result


    def analyze_html_content(self, html_content, base_url=None, image_urls=None):
        """
        Analyzes the HTML content for gambling-related material.
        It checks text content and image URLs.
        """
        results = []
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 1. Analyze all text content from the page
        all_text = soup.get_text(separator=' ', strip=True)
        text_prediction = self.predict(all_text)
        if text_prediction['is_gambling']:
            results.append({
                'is_gambling': True,
                'confidence': text_prediction['confidence'],
                'selector': 'body',
                'type': 'text',
                'details': text_prediction['details']
            })

        # 2. Analyze image URLs for keywords
        if image_urls is None:
            image_urls = [img.get('src') for img in soup.find_all('img') if img.get('src')]
        
        for url in image_urls:
            prediction = self._analyze_url_for_keywords(url)
            if prediction:
                 results.append({
                    'is_gambling': True,
                    'confidence': prediction['confidence'],
                    'selector': f"img[src='{url}']",
                    'type': 'image_url',
                    'details': {'matched_keywords': prediction['matched_keywords']}
                })

        return results

    def _analyze_url_for_keywords(self, url):
        """Analyzes a single URL for keywords."""
        if not isinstance(url, str):
            return None
            
        text_to_check = url.lower()
        matched_keywords = []
        total_score = 0
        
        # Aho-Corasick for keywords
        for _, (keyword, score) in self.automaton.iter(text_to_check):
            matched_keywords.append(keyword)
            total_score += score
        
        # Regex for patterns
        for pattern_data in self.regex_patterns:
            if re.search(pattern_data['keyword'], text_to_check):
                total_score += pattern_data['score']
                matched_keywords.append(pattern_data['keyword']) # Add pattern for context

        if matched_keywords:
            return {
                'confidence': min(1.0, total_score / 20.0),
                'matched_keywords': list(set(matched_keywords))
            }
        return None

    def _is_structural_element(self, element):
        """Check if element is likely a structural/navigation element"""
        element_class = ' '.join(element.get('class', [])).lower()
        element_id = (element.get('id') or '').lower()
        
        structural_indicators = [
            'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
            'pagination', 'toolbar', 'status', 'loading', 'modal'
        ]
        
        return any(indicator in element_class or indicator in element_id 
                  for indicator in structural_indicators)
    
    def _generate_css_selector(self, element):
        if element.get('id'):
            return f"#{element.get('id')}"
        
        path = []
        current = element
        
        while current:
            if current.name:
                path.append(current.name)
            # Stop if we hit the body or run out of parents
            if current.name == 'body' or not current.parent:
                break
            current = current.parent
        # Reverse the list to get the path from body to element
        path.reverse()
        return ' > '.join(path)

    def save_model(self, model_path='models/judol_model.pkl', vectorizer_path='models/vectorizer.pkl'):
        """Saves the trained model and vectorizer."""
        if not os.path.exists('models'):
            os.makedirs('models')
        with open(model_path, 'wb') as f:
            pickle.dump(self.model, f)
        with open(vectorizer_path, 'wb') as f:
            pickle.dump(self.vectorizer, f)
        print(f"✅ Model saved to {model_path} and vectorizer to {vectorizer_path}")

    def load_model(self, model_path='models/judol_model.pkl', vectorizer_path='models/vectorizer.pkl'):
        """Loads a pre-trained model and vectorizer."""
        try:
            if os.path.exists(model_path) and os.path.exists(vectorizer_path):
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                with open(vectorizer_path, 'rb') as f:
                    self.vectorizer = pickle.load(f)
                print(f"✅ Model loaded from {model_path} and vectorizer from {vectorizer_path}")
            else:
                print("⚠️ Model files not found. Please train the model first.")
        except Exception as e:
            print(f"❌ Error loading model: {e}")

if __name__ == "__main__":
    # Initialize detector
    detector = JudolDetector()
    
    # Train model
    detector.train_model()
    
    # Test prediction
    test_texts = [
        "Slot gacor maxwin hari ini! Daftar sekarang dapat bonus 100%",
        "Resep masakan Indonesia yang lezat dan mudah dibuat",
        "RTP live pragmatic play tertinggi, anti rungkad!",
        "Tutorial programming Python untuk pemula"
    ]
    
    print("\n" + "="*50)
    print("Testing predictions:")
    print("="*50)
    
    for text in test_texts:
        result = detector.predict(text)
        print(f"\nText: {text}")
        print(f"Is Judol: {result['is_gambling']}")
        print(f"Confidence: {result['confidence']:.3f}")
        print(f"Matched Keywords: {result['details']['matched_keywords']}")
