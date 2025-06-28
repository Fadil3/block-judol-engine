# Project Debrief: Gambling Content Detection Engine

This document outlines the development journey, challenges faced, and key learnings from our efforts to build an effective gambling ad blocker.

## 1. Initial Goal

The primary objective was to create a browser extension that could accurately detect and block gambling-related content on websites, with a particular focus on dynamic, ad-heavy sites.

---

## 2. The Development Journey: A Tale of Three Architectures

### Attempt 1: The OCR-Based Analyst

Our first approach was based on pure text extraction.

- **How it Worked:** The system would find all images on a page, use Tesseract OCR to extract any text from them (frame-by-frame for GIFs), and then analyze this text for gambling-related keywords.
- **Pros:**
  - **High Accuracy:** It was very good at finding text-heavy ads and understanding their content. It successfully blurred several ads on our target sites.
- **Cons:**
  - **Extremely Slow:** Processing GIFs frame-by-frame was computationally expensive. A single page could take up to 5 minutes to analyze, making it impractical for real-world use.

### Attempt 2: The Machine Learning Speed-Up

To solve the speed issue, we pivoted to a computer vision-based approach, dropping OCR entirely.

- **How it Worked:** This system used multiple layers of non-text analysis:
  1.  **Perceptual Hashing:** Checked images against a pre-built database of known gambling ad hashes.
  2.  **ML Image Classifier:** An autoencoder model was trained to recognize the _visual style_ of gambling ads.
  3.  **Sub-Region Detection:** We added logic to find and analyze individual panels within larger collage-style ads.
- **Pros:**
  - **Extremely Fast:** Analysis time was reduced from minutes to seconds.
  - **Good for Known Ads:** The hashing was effective at identifying previously seen ads.
- **Cons:**
  - **Brittle & Unreliable:** This approach proved too fragile for the highly dynamic nature of ad-serving websites.
  - **The Race Condition Problem:** The core issue was that ad scripts on the target websites would dynamically change image `src` URLs _after_ our extension had analyzed them. Our extension would tell the content script to "blur the image at `URL_A`," but by the time the script acted, the image's `src` had been changed to `URL_B`, so nothing was blurred.
  - **False Positives:** The ML model, while fast, was not precise enough. It often flagged non-ad images (like movie posters and tracking pixels) with low confidence, creating noise.

### Attempt 3: The Hybrid System

Our most recent approach was a hybrid model designed to combine the strengths of the previous two systems.

- **How it Worked:**
  1.  **Client-Side Filtering:** The extension would instantly blur any image with obvious keywords in its URL.
  2.  **Backend Analysis:** The remaining images would be sent to the backend for the fast ML/hash analysis.
  3.  **Selective OCR:** We planned to re-introduce OCR as a final, high-precision check for uncertain results.
- **Current Status:** We implemented the client-side filtering and the backend visual analysis, but the fundamental problem of the "race condition" with dynamic URLs persisted, preventing reliable blurring.

---

## 3. Key Learnings & Path Forward

The primary lesson is that for this specific problem, **a complex backend is fighting the wrong battle.** The true challenge is not in identifying the ads, but in reliably acting on them within the hostile, ever-changing environment of a live web page.

**The Dead End:** Relying on backend analysis to provide a "selector" (be it a CSS path or a URL) for the frontend to act upon is fundamentally flawed when ad scripts are designed to constantly mutate the DOM.

**The Path Forward: Back to Basics, But Smarter.**

As you suggested, we will revert to a simpler, more robust model that puts more power directly into the client-side extension. The plan is to:

1.  **Remove the Visual Analysis Backend:** Decommission the ML model, hash database, and the associated Python code. This dramatically simplifies the project.
2.  **Enhance the Keyword-Based Backend:** The backend's only job will be to provide an up-to-date list of keywords and patterns to the extension.
3.  **Create a Powerful Client-Side Engine:** The extension's content script will be the primary engine. It will perform all detection logic directly in the user's browser:
    - It will check all text content.
    - It will check all image URLs.
    - It will continuously monitor the page for new elements and re-analyze them, defeating the ad-rotator scripts.

This approach is faster, more resilient, and better suited to the specific problem we are trying to solve.
