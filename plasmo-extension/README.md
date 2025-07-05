# Judol Content Blocker - Plasmo Extension

A modern browser extension built with [Plasmo](https://www.plasmo.com) to detect and block online gambling (judol) content.

## Features

- 🛡️ **Real-time detection** of gambling content using machine learning
- 🎯 **Multiple blocking modes**: Highlight, Blur, or Hide suspicious content
- ⚙️ **Customizable settings**: Adjust detection threshold and notification preferences
- 🔄 **Live scanning** with manual page analysis option
- 📱 **Modern UI** with React and TypeScript

## Installation

### Development

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Start development server:**

   ```bash
   yarn dev
   ```

3. **Load extension in browser:**
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `build/chrome-mv3-dev` folder

### Production Build

1. **Build the extension:**

   ```bash
   yarn build
   ```

2. **Load the built extension:**
   - The built extension will be in the `build/chrome-mv3-prod` folder
   - Load this folder in your browser using the same steps as development

## API Server

This extension requires the Judol detection API server to be running:

```bash
# In the main project directory
cd /home/seryu/projects/block-judol-engine
python api_server.py
```

The extension will communicate with the API server at `https://block-engine.server-fadil.my.id`.

## Project Structure

```
plasmo-extension/
├── popup.tsx              # Main popup component
├── popup.css              # Popup styles
├── background.ts           # Background service worker
├── contents/
│   └── judol-detector.ts   # Content script for page analysis
├── package.json            # Dependencies and configuration
└── README.md              # This file
```

## How It Works

1. **Content Detection**: The content script analyzes web pages for gambling-related content
2. **API Analysis**: Page content is sent to the local API server for machine learning analysis
3. **Action Application**: Based on settings, suspicious content is highlighted, blurred, or hidden
4. **User Control**: Users can adjust detection sensitivity and blocking behavior via the popup

## Technologies Used

- **Plasmo Framework**: Modern extension development platform
- **React**: UI components with hooks
- **TypeScript**: Type-safe development
- **Chrome Extension Manifest V3**: Latest extension standards
- **Plasmo Storage**: Persistent settings storage

## Configuration

The extension uses the following default settings:

- Detection threshold: 50%
- Blocking mode: Highlight
- Notifications: Enabled
- Extension: Enabled

All settings can be customized through the popup interface.

## Development

To modify the extension:

1. Edit the source files (`.tsx`, `.ts`, `.css`)
2. The development server will automatically reload the extension
3. Refresh any web pages to see content script changes

## Building for Distribution

```bash
# Build for production
yarn build

# Package for distribution (creates .zip file)
yarn package
```

## Browser Compatibility

- ✅ Chrome (Recommended)
- ✅ Edge
- ✅ Brave
- ✅ Other Chromium-based browsers
- ❓ Firefox (requires manifest conversion)

## License

This project is part of the Judol Content Blocker system.

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
