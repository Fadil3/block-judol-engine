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
        self.regex_patterns = {
            r'\w*bet\d+': 15,
            r'\w*slot\d+': 15,
            r'\w*toto\d+': 15,
            r'gacor\d+': 15,
            r'hoki\d+': 12
        }
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
        
        for pattern, score in self.regex_patterns.items():
            matches = re.findall(pattern, text)
            if matches:
                count = len(matches)
                total_score += score * count
                matched_keywords.extend(matches)

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
            "Resep masakan Indonesia yang lezat dan mudah dibuat untuk keluarga tercinta.",
            "Tutorial programming Python untuk pemula dengan contoh kode yang lengkap.",
            "Berita terkini tentang teknologi dan inovasi terbaru di Indonesia.",
            "Tips kesehatan dan olahraga untuk menjaga kondisi tubuh tetap prima.",
            "Panduan lengkap cara menanam bunga mawar di halaman rumah.",
            "Review mendalam mengenai kamera mirrorless terbaru di pasaran.",
            "Sejarah kemerdekaan Indonesia dan perjuangan para pahlawan.",
            "Diskusi mengenai dampak kecerdasan buatan terhadap pasar kerja.",
            "Cara efektif mengelola keuangan pribadi untuk mencapai kebebasan finansial.",
            "Belajar bahasa Inggris otodidak melalui film dan musik.",
            "Kumpulan resep kue kering untuk Lebaran yang renyah dan nikmat.",
            "Analisis pertandingan sepak bola antara tim nasional Indonesia dan Vietnam.",
            "Tips dan trik fotografi landscape untuk pemula.",
            "Pentingnya pendidikan karakter sejak usia dini bagi perkembangan anak.",
            "Menjelajahi keindahan alam bawah laut di Raja Ampat, Papua.",
            "Teknik dasar bermain gitar untuk pemula, dari kunci dasar hingga melodi sederhana.",
            "Perkembangan terbaru dalam penelitian sel punca untuk pengobatan penyakit degeneratif.",
            "Cara membuat pupuk kompos dari sampah organik rumah tangga.",
            "Ulasan buku fiksi ilmiah terbaik sepanjang masa yang wajib dibaca.",
            "Membangun portofolio desain grafis yang menarik bagi calon klien.",
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
            "Cara membuat kue bolu yang empuk dan lezat",
            "Tutorial menjahit baju untuk pemula",
            "Belajar bermain gitar dengan mudah",
            "Tips menanam sayuran hidroponik di rumah",
            "Panduan lengkap ibadah haji dan umroh",
            "Kumpulan doa-doa harian untuk anak",
            "Cerita nabi dan rasul untuk anak-anak",
            "Belajar bahasa Arab dasar untuk pemula",
            "Peluang bisnis online di tahun 2025",
            "Strategi marketing digital untuk UMKM",
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
        # Prioritize elements that are more likely to contain meaningful content
        elements_to_check = []
        
        # High priority elements (likely to contain suspicious content)
        high_priority = soup.find_all(['h1', 'h2', 'h3', 'title', 'a'])
        elements_to_check.extend(high_priority)
        
        # Medium priority elements (might contain suspicious content)
        medium_priority = soup.find_all(['p', 'span', 'button'])
        elements_to_check.extend(medium_priority)
        
        # Low priority elements (less likely but still check)
        low_priority = soup.find_all(['div'])
        # Limit div elements to avoid checking too many generic containers
        elements_to_check.extend(low_priority[:50])  # Only check first 50 divs
        
        # Track processed text to avoid duplicates
        processed_texts = set()
        
        for element in elements_to_check:
            element_text = element.get_text().strip()
            
            # Skip if text is too short, too long, or already processed
            if (len(element_text) < 15 or 
                len(element_text) > 500 or 
                element_text in processed_texts):
                continue
                
            # Skip if element is likely to be navigation or structure
            if self._is_structural_element(element):
                continue
                
            processed_texts.add(element_text)
            
            result = self.predict(element_text)
            
            # Use a higher confidence threshold to reduce false positives
            if result['is_judol'] and result['confidence'] > 0.7:
                # Get element selector
                selector = self._generate_css_selector(element)
                
                # Verify selector doesn't match too many elements
                try:
                    # Simple check: if selector contains only tag name, it's too generic
                    if selector and not any(char in selector for char in ['.', '#', ':', '>']):
                        continue
                        
                    suspicious_elements.append({
                        'selector': selector,
                        'text': element_text[:100] + '...' if len(element_text) > 100 else element_text,
                        'confidence': result['confidence'],
                        'matched_keywords': result['matched_keywords']
                    })
                except Exception as e:
                    print(f"Error processing element: {e}")
                    continue
        
        return {
            'overall': overall_result,
            'suspicious_elements': suspicious_elements,
            'total_suspicious_elements': len(suspicious_elements)
        }
    
    def _is_structural_element(self, element):
        """Check if element is likely a structural/navigation element"""
        # Check tag attributes for structural indicators
        element_class = ' '.join(element.get('class', [])).lower()
        element_id = (element.get('id') or '').lower()
        
        structural_indicators = [
            'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
            'pagination', 'toolbar', 'status', 'loading', 'modal'
        ]
        
        return any(indicator in element_class or indicator in element_id 
                  for indicator in structural_indicators)
    
    def _generate_css_selector(self, element):
        """Generate a specific CSS selector for an element"""
        if element.get('id'):
            return f"#{element.get('id')}"
        
        path_parts = []
        current = element
        
        for _ in range(5):  # Limit depth to avoid overly long selectors
            if current is None or current.name is None:
                break
                
            part = current.name
            
            # Add class information if available
            if current.get('class'):
                classes = '.'.join(current.get('class'))
                if classes:
                    part += f".{classes}"
            
            # Add nth-of-type if there are siblings of the same type
            if current.parent:
                siblings = current.parent.find_all(current.name, recursive=False)
                if len(siblings) > 1:
                    try:
                        index = [i for i, s in enumerate(siblings) if s is current][0]
                        part += f":nth-of-type({index + 1})"
                    except (ValueError, IndexError):
                        pass # Could fail if element is not in siblings, though it should be
            
            path_parts.append(part)
            current = current.parent
            
            # Stop if we reach a good anchor (body, html, or an element with an ID)
            if current is None or current.name in ['body', 'html'] or current.get('id'):
                if current and current.get('id'):
                    path_parts.append(f"#{current.get('id')}")
                break
        
        # Reverse to get top-down path and join with descendant combinator
        if path_parts:
            path_parts.reverse()
            return ' '.join(path_parts)
        
        # Fallback for elements that couldn't generate a path
        selector = element.name
        if element.get('class'):
            classes = '.'.join(element.get('class')[:2])
            if classes:
                selector += f".{classes}"
        
        return selector
    
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
