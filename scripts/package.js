const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');
const manifestJson = require('../manifest.json');

// Ensure versions match
if (packageJson.version !== manifestJson.version) {
  console.error(`Version mismatch: package.json (${packageJson.version}) !== manifest.json (${manifestJson.version})`);
  process.exit(1);
}

const version = packageJson.version;
const outputDir = 'releases';
const outputFile = `relistr-${version}.zip`;

// Create releases directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Files to include in the package
const filesToInclude = [
  'manifest.json',
  'popup.html',
  'options.html', 
  'config.json',
  'test-custom-selectors.json',
  'dist/',
  'icons/',
  'README.md',
  'LICENSE'
];

// Create zip file using system command
const filePaths = filesToInclude.map(file => {
  if (file.endsWith('/')) {
    // Directory
    return file;
  }
  // File
  return file;
}).join(' ');

try {
  // Use PowerShell on Windows to create zip
  const zipCommand = process.platform === 'win32' 
    ? `powershell Compress-Archive -Path ${filePaths} -DestinationPath ${outputDir}/${outputFile} -Force`
    : `zip -r ${outputDir}/${outputFile} ${filePaths}`;
    
  console.log(`Creating package: ${outputFile}`);
  console.log(`Command: ${zipCommand}`);
  
  // For now, just create a simple package manifest
  const packageManifest = {
    name: packageJson.name,
    version: version,
    timestamp: new Date().toISOString(),
    files: filesToInclude,
    build: {
      node: process.version,
      platform: process.platform
    }
  };
  
  fs.writeFileSync(
    path.join(outputDir, `package-${version}.json`), 
    JSON.stringify(packageManifest, null, 2)
  );
  
  console.log(`✅ Package manifest created: package-${version}.json`);
  console.log(`📦 Version: ${version}`);
  console.log(`📁 Files: ${filesToInclude.length} items`);
  console.log(`\nTo create zip manually:`);
  console.log(`1. Ensure 'dist/' folder is built`);
  console.log(`2. Select: ${filesToInclude.join(', ')}`);
  console.log(`3. Create zip file: ${outputFile}`);
  
} catch (error) {
  console.error('❌ Package creation failed:', error.message);
  process.exit(1);
}