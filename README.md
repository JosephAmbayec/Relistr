# Relistr - Sponsored Content Remover

A browser extension that removes sponsored listings and advertisements from websites using configurable CSS selectors, text matching, and attribute detection.

[![Build Status](https://github.com/JosephAmbayec/Relistr/actions/workflows/ci.yml/badge.svg)](https://github.com/JosephAmbayec/Relistr/actions)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/{extension-id-will-add})](https://chrome.google.com/webstore/detail/{extension-id-will-add})
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why use Relistr instead of other ad blockers?
Actually, Relistr can be used in tandum with other ad blocker extensions! Relistr exists to serve as an open-source way to programmatically remove listings and sponsored elements from webpages. Typical ad blockers may not work on hard embedded elements or on unsupported sites. With Relistr, you can add your own custom element removal rulesets, so that you can remove sponsored content/listings on typically unsupported pages! You can also share your rulesets with others, and/or contribute them to the global Relistr rulesets. See [Contributing Guide](https://github.com/JosephAmbayec/Relistr/blob/master/CONTRIBUTING.md)

## Features

- **Smart Detection**: Multiple detection methods including CSS selectors, text matching, and HTML attributes
- **Built-in Rules**: Pre-configured rules for popular websites (Amazon, Google, Reddit, etc.)
- **Custom Rules**: Upload your own JSON configuration for any website
- **Flexible Configuration**: Toggle global selectors and domain-specific rules
- **Statistics**: Track how many sponsored items have been removed
- **Privacy-Focused**: All processing happens locally, no data collection

## Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store page](https://chrome.google.com/webstore/detail/{extension-id-will-add})
2. Click "Add to Chrome"
3. Confirm the installation

### From Source
1. Clone this repository:
   ```bash
   git clone https://github.com/JosephAmbayec/Relistr.git
   cd Relistr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder

## Usage

### Basic Usage
1. Click the Relistr icon in your browser toolbar
2. Toggle "Extension Enabled" to turn on/off
3. Toggle "Use Global Selectors" to control global ad blocking rules

### Custom Rules
1. Click "Advanced Options" in the popup
2. Upload a JSON file with custom rules for specific domains
3. Use the built-in editor to preview and import rules

### Custom Rules Format
```json
{
  "domains": {
    "example.com": {
      "selectors": [
        ".sponsored",
        "[data-ad='true']"
      ],
      "textMatches": [
        "Sponsored",
        "Advertisement"
      ],
      "attributes": [
        {
          "name": "data-testid",
          "value": "sponsored-result"
        }
      ]
    }
  }
}
```

## Supported Websites

Relistr comes with built-in rules for a variety of domains, please consider [Contributing](https://github.com/JosephAmbayec/Relistr/blob/master/CONTRIBUTING.md) with your field-tested custom rulesets! 

## Configuration Options

### Detection Methods
- **CSS Selectors**: Target elements by class, ID, or attribute selectors
- **Text Matching**: Find elements containing specific text (e.g., "Sponsored")
- **Attribute Detection**: Match elements with specific HTML attributes

### Settings
- **Global Selectors**: Universal rules that work across all websites
- **Domain-Specific Rules**: Targeted rules for specific websites
- **Custom Rules**: User-uploaded JSON configurations
- **Statistics Tracking**: Monitor removal counts

## Development

### Prerequisites
- Node.js 16+ 
- npm or yarn
- TypeScript knowledge

### Setup
```bash
# Clone the repository
git clone https://github.com/JosephAmbayec/Relistr.git
cd Relistr

# Install dependencies
npm install

# Start development build
npm run watch

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

### Project Structure
```
Relistr/
├── src/                   # TypeScript source files
│   ├── content.ts        # Content script (main blocking logic)
│   ├── background.ts     # Service worker
│   ├── popup.ts          # Extension popup
│   ├── options.ts        # Options page
│   └── types.ts          # Type definitions
├── dist/                 # Compiled JavaScript (generated)
├── manifest.json         # Extension manifest
├── popup.html           # Popup UI
├── options.html         # Options page UI
├── config.json          # Built-in blocking rules
└── test-custom-selectors.json  # Example custom rules
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Adding New Website Rules

To add support for a new website:

1. Identify the sponsored content elements on the target website
2. Add rules to `config.json` under the `domains` section:
   ```json
   "newsite.com": {
     "selectors": [".sponsored-item"],
     "textMatches": ["Sponsored"],
     "attributes": [{"name": "data-ad", "value": "true"}]
   }
   ```
3. Test the rules on the website
4. Submit a pull request

## Security & Privacy

- **No Data Collection**: Relistr processes everything locally
- **No Network Requests**: Extension operates entirely offline
- **Content Security Policy**: Strict CSP prevents code injection
- **Minimal Permissions**: Only requests necessary browser permissions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/JosephAmbayec/Relistr/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/JosephAmbayec/Relistr/discussions)
- **Documentation**: Check the [Wiki](https://github.com/JosephAmbayec/Relistr/wiki)

## Acknowledgments

- Built with TypeScript and modern web extension APIs
- Inspired by the need for cleaner, ad-free browsing experiences
- Thanks to all contributors and users providing feedback

## Made with 💓 by [Joseph Ambayec](https://josephambayec.github.io)

---

**Disclaimer**: This extension is for educational and personal use. Please respect website terms of service and consider supporting content creators through legitimate means.

README autogenerated by generative AI.
