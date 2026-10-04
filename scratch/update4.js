const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'public/css/style.css');
if (fs.existsSync(stylePath)) {
  let content = fs.readFileSync(stylePath, 'utf8');
  
  // Make the gradient a bit more legible on a dark background (light blue to deep blue)
  // so it still looks "white blue" but doesn't wash out white text completely,
  // or we just change the text color.
  content = content.replace(
    /--gradient-accent: linear-gradient\(135deg, #ffffff 0%, #3b82f6 100%\);/g,
    '--gradient-accent: linear-gradient(135deg, #e0f2fe 0%, #2563eb 100%);'
  );
  content = content.replace(
    /--gradient-header: linear-gradient\(135deg, #ffffff 0%, #93c5fd 50%, #3b82f6 100%\);/g,
    '--gradient-header: linear-gradient(135deg, #f8fafc 0%, #60a5fa 50%, #1d4ed8 100%);'
  );

  // Update button text color so it's readable against the light part of the gradient
  content = content.replace(
    /\.btn-primary \{\n  background: var\(--gradient-accent\);\n  color: #fff;/g,
    '.btn-primary {\n  background: var(--gradient-accent);\n  color: #0f172a;'
  );
  
  fs.writeFileSync(stylePath, content, 'utf8');
  console.log('Updated style.css contrast');
}
