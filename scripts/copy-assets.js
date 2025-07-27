const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const SRC_DIR = path.resolve(__dirname, '..', 'icons');
const DEST_DIR = path.resolve(__dirname, '..', 'dist', 'icons');

copyDirSync(SRC_DIR, DEST_DIR);

console.log(`✅ Icons copied to ${path.relative(process.cwd(), DEST_DIR)}`); 