import pandas as pd
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

class JudolDetector:
    def __init__(self, keywords_file='keywords.csv'):
        self.keywords_df = pd.read_csv(keywords_file)
        self.keywords_dict = dict(zip(
            self.keywords_df['Keyword'].str.lower(), 
            self.keywords_df['Score']
        ))
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 3),
            stop_words='english'
        )
        self.model = None
        self.threshold = 0.5
        
        # Download NLTK data if not present
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords')
    
    def preprocess_text(self, text):
        """Clean and preprocess text"""
        if not isinstance(text, str):
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        
        # Remove special characters but keep spaces
        text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
        
        # Remove extra whitespaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def extract_keyword_features(self, text):
        """Extract keyword-based features"""
        text = self.preprocess_text(text)
        
        # Calculate keyword score
        total_score = 0
        matched_keywords = []
        
        for keyword, score in self.keywords_dict.items():
            if keyword in text:
                count = text.count(keyword)
                total_score += score * count
                matched_keywords.extend([keyword] * count)
        
        # Additional features
        features = {
            'keyword_score': total_score,
            'keyword_count': len(matched_keywords),
            'unique_keywords': len(set(matched_keywords)),
            'avg_keyword_score': total_score / max(len(matched_keywords), 1),
            'text_length': len(text),
            'word_count': len(text.split()),
        }
        
        return features, matched_keywords
    
    def create_training_data(self):
        """Create training data from keywords"""
        # Positive samples (judol content)
        positive_samples = []
        
        # Generate synthetic positive samples using keywords
        for keyword, score in self.keywords_dict.items():
            # Create variations of text containing the keyword
            positive_samples.extend([
                f"Dapatkan {keyword} terbaik sekarang juga!",
                f"Situs {keyword} terpercaya dan gacor",
                f"Main {keyword} dapat bonus besar",
                f"Daftar {keyword} gratis tanpa deposit",
                f"{keyword} dengan RTP tinggi",
                f"Link alternatif {keyword} resmi",
                f"Bonus new member {keyword}",
                f"{keyword} minimal deposit 10 ribu",
            ])
        
        # Negative samples (clean content)
        negative_samples = [
            "Resep masakan Indonesia yang lezat",
            "Tutorial belajar programming Python",
            "Berita terkini politik dan ekonomi",
            "Review gadget dan teknologi terbaru",
            "Tips kesehatan dan olahraga",
            "Panduan traveling ke berbagai destinasi",
            "Artikel pendidikan dan pembelajaran",
            "Informasi lowongan kerja terbaru",
            "Tutorial makeup dan fashion",
            "Berita olahraga sepak bola",
            "Resep kue dan dessert",
            "Tips investasi dan keuangan",
            "Artikel parenting dan keluarga",
            "Review film dan entertainment",
            "Panduan budidaya tanaman",
            "Berita teknologi dan inovasi",
            "Tutorial musik dan instrumen",
            "Artikel sejarah dan budaya",
            "Tips fotografi dan videografi",
            "Panduan DIY dan kerajinan",
        ] * 50  # Multiply to balance the dataset
        
        # Create DataFrame
        data = []
        
        # Add positive samples
        for text in positive_samples:
            data.append({'text': text, 'label': 1})
        
        # Add negative samples
        for text in negative_samples:
            data.append({'text': text, 'label': 0})
        
        return pd.DataFrame(data)
    
    def train_model(self):
        """Train the judol detection model"""
        print("Creating training data...")
        df = self.create_training_data()
        
        print(f"Training data size: {len(df)} samples")
        print(f"Positive samples: {len(df[df['label'] == 1])}")
        print(f"Negative samples: {len(df[df['label'] == 0])}")
        
        # Extract features
        print("Extracting features...")
        X_text = []
        X_features = []
        y = df['label'].values
        
        for text in df['text']:
            processed_text = self.preprocess_text(text)
            X_text.append(processed_text)
            
            features, _ = self.extract_keyword_features(text)
            X_features.append(list(features.values()))
        
        # TF-IDF features
        X_tfidf = self.vectorizer.fit_transform(X_text)
        
        # Combine features
        X_combined = np.hstack([
            X_tfidf.toarray(),
            np.array(X_features)
        ])
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_combined, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train model
        print("Training model...")
        self.model = RandomForestClassifier(
            n_estimators=100,
            random_state=42,
            class_weight='balanced'
        )
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        print(f"Accuracy: {accuracy_score(y_test, y_pred):.3f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        # Save model
        self.save_model()
        print("Model saved successfully!")
    
    def predict(self, text):
        """Predict if text contains judol content"""
        if self.model is None:
            self.load_model()
        
        # Preprocess text
        processed_text = self.preprocess_text(text)
        
        # Extract features
        features, matched_keywords = self.extract_keyword_features(text)
        
        # TF-IDF features
        X_tfidf = self.vectorizer.transform([processed_text])
        
        # Combine features
        X_combined = np.hstack([
            X_tfidf.toarray(),
            np.array([list(features.values())])
        ])
        
        # Predict
        probability = self.model.predict_proba(X_combined)[0][1]
        is_judol = probability > self.threshold
        
        return {
            'is_judol': bool(is_judol),
            'confidence': float(probability),
            'keyword_score': features['keyword_score'],
            'matched_keywords': matched_keywords,
            'features': features
        }
    
    def analyze_html_content(self, html_content):
        """Analyze HTML content and identify judol elements"""
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        text_content = soup.get_text()
        
        # Analyze full content
        overall_result = self.predict(text_content)
        
        # Analyze individual elements
        suspicious_elements = []
        
        # Check specific elements that commonly contain judol content
        elements_to_check = soup.find_all(['div', 'span', 'p', 'a', 'h1', 'h2', 'h3', 'title'])
        
        for element in elements_to_check:
            element_text = element.get_text().strip()
            if len(element_text) > 10:  # Only check elements with substantial text
                result = self.predict(element_text)
                if result['is_judol'] and result['confidence'] > 0.7:
                    # Get element selector
                    selector = self._generate_css_selector(element)
                    suspicious_elements.append({
                        'selector': selector,
                        'text': element_text[:100] + '...' if len(element_text) > 100 else element_text,
                        'confidence': result['confidence'],
                        'matched_keywords': result['matched_keywords']
                    })
        
        return {
            'overall': overall_result,
            'suspicious_elements': suspicious_elements,
            'total_suspicious_elements': len(suspicious_elements)
        }
    
    def _generate_css_selector(self, element):
        """Generate CSS selector for an element"""
        selector_parts = []
        
        # Add tag name
        selector_parts.append(element.name)
        
        # Add ID if available
        if element.get('id'):
            selector_parts.append(f"#{element.get('id')}")
        
        # Add classes if available
        if element.get('class'):
            classes = '.'.join(element.get('class'))
            selector_parts.append(f".{classes}")
        
        return ''.join(selector_parts)
    
    def save_model(self):
        """Save the trained model and vectorizer"""
        os.makedirs('models', exist_ok=True)
        
        with open('models/judol_model.pkl', 'wb') as f:
            pickle.dump(self.model, f)
        
        with open('models/vectorizer.pkl', 'wb') as f:
            pickle.dump(self.vectorizer, f)
    
    def load_model(self):
        """Load the trained model and vectorizer"""
        try:
            with open('models/judol_model.pkl', 'rb') as f:
                self.model = pickle.load(f)
            
            with open('models/vectorizer.pkl', 'rb') as f:
                self.vectorizer = pickle.load(f)
                
            print("Model loaded successfully!")
        except FileNotFoundError:
            print("Model not found. Please train the model first.")
            raise

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
        print(f"Is Judol: {result['is_judol']}")
        print(f"Confidence: {result['confidence']:.3f}")
        print(f"Matched Keywords: {result['matched_keywords']}")
