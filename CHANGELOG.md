# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-08-03

### Added
- **Zapper Tool**: Added the HTML Element Zapper that removes elements and saves the hidden attributes in the custom rules

### News
- **Relistr is now on the Chrome Web Store**: [Check it out](https://chromewebstore.google.com/detail/relistr-sponsored-content/cehkeibkjkaejmkkioiamlnoddihiamm?authuser=0&hl=en)

## [1.4.1] - 2025-07-27

### Fixed
- Fixed an issue with badge count not updating properly

## [1.4.0] - 2025-07-27

### Added
- **Custom Rule Editing**: Direct editing of custom rules through the options interface
- **Edit Modal Interface**: User-friendly modal form for modifying existing rules
- **Rule Validation**: JSON validation and required field checking for edited rules
- **In-Place Rule Management**: Edit rules without deleting and re-uploading

### Enhanced
- **Options Interface**: Added edit buttons alongside delete buttons for each custom rule
- **User Experience**: Seamless rule modification with save/cancel functionality
- **Form Handling**: Separate text areas for selectors, text matches, and attributes

### Technical Improvements
- Modal system with overlay and keyboard shortcuts (Escape to close)
- Form validation with clear error messaging
- Rule parsing and serialization for different rule types
- Event handling for modal interactions and form submission

## [1.3.0] - 2025-07-27

### Enhanced
- **Attribute Detection**: More robust matching that works with dynamic class names and varied attribute values
- **Configuration Simplicity**: Reduced number of rules needed to achieve broader element coverage

### Technical Improvements
- Better handling of complex class names and dynamic attributes

## [1.2.0] - 2025-07-27

### Added
- **Whitelist Functionality**: Complete domain whitelist system allowing users to disable the extension on specific websites
- **Whitelist Management UI**: New whitelist section in options page with add/remove domain functionality
- **Visual State Indicators**: Extension icon changes to greyscale when on whitelisted domains
- **Real-time Domain Disabling**: Extension automatically disables content removal when visiting whitelisted domains


## [1.1.3] - 2025-07-27

### Fixed
- Release workflow version synchronization

## [1.1.2] - 2025-07-27

### Fixed
- Release workflow version synchronization

## [1.1.1] - 2025-07-27

### Fixed
- Release workflow version synchronization

## [1.1.0] - 2025-07-27

### Added
- Page-specific blocked listings counter in popup alongside total count
- Real-time statistics tracking per browser tab
- Dual statistics display with grid layout ("On This Page" vs "Total Removed")
- Badge number on extension icon showing current page removal count


### Technical Improvements
- Tab-specific statistics storage with automatic cleanup on tab close
- Message passing system between content script, background, and popup

## [1.0.0] - 2025-07-27

### Added
- Initial browser extension for removing sponsored listings and advertisements
- Support for multiple detection methods: CSS selectors, text matching, HTML attributes
- Domain-specific configuration system via JSON files
- TypeScript implementation with full type safety
- Extension popup with basic controls and domain status indicator
- Advanced options page with custom rules management
- File upload functionality for custom selector rules
- Persistent settings using Chrome Storage API
- Real-time DOM manipulation with MutationObserver
- Debug logging and console helpers for troubleshooting
- Complete open source project setup with MIT license
- Automated CI/CD pipeline with GitHub Actions
- Chrome Web Store deployment automation
- Comprehensive documentation and contributing guidelines

### Fixed
- TypeScript compilation issues caused by incorrect module configuration
- Content Security Policy violations from inline event handlers
- Custom rules not applying due to build system failures
- File upload button not opening file explorer
- Domain normalization issues with www prefixes and case sensitivity
- Storage synchronization across extension components

### Technical Details
- Manifest V3 compliance for modern Chrome extensions
- TypeScript compilation with proper module system (CommonJS)
- CSP-compliant event handling and styling
- Robust error handling and validation
- Version synchronization between package.json and manifest.json
- Automated testing and build verification
- Cross-platform build scripts and packaging

[1.5.0]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.5.0
[1.4.1]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.4.1
[1.4.0]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.4.0
[1.3.0]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.3.0
[1.2.0]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.2.0
[1.1.3]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.1.3
[1.1.2]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.1.2
[1.1.1]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.1.1
[1.1.0]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.1.0
[1.0.0]: https://github.com/JosephAmbayec/Relistr/releases/tag/v1.0.0

CHANGELOG autogenerated by generative AI.