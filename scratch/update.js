const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'public/index.html',
  'public/js/app.js',
  'server/index.js',
  'README.md',
  'server/game/Game.js'
];

for (const file of filesToUpdate) {
  const p = path.join(__dirname, '..', file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/🐂/g, '🌶️');
    content = content.replace(/bulls/g, 'bulls'); // Keeping variable names as bulls to avoid refactoring everything
    fs.writeFileSync(p, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}

// Update style.css specifically
const stylePath = path.join(__dirname, '..', 'public/css/style.css');
if (fs.existsSync(stylePath)) {
  let styleContent = fs.readFileSync(stylePath, 'utf8');
  
  // Replace font
  styleContent = styleContent.replace(
    `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');`,
    `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');`
  );
  styleContent = styleContent.replace(
    `--font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;`,
    `--font-main: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;`
  );

  // Logo font
  styleContent = styleContent.replace(
    `.game-logo h1 {\r\n  font-size: 4rem;\r\n  font-weight: 900;`,
    `.game-logo h1 {\r\n  font-family: 'Luckiest Guy', cursive;\r\n  font-size: 4rem;\r\n  font-weight: 400;`
  );
  styleContent = styleContent.replace(
    `.game-logo h1 {\n  font-size: 4rem;\n  font-weight: 900;`,
    `.game-logo h1 {\n  font-family: 'Luckiest Guy', cursive;\n  font-size: 4rem;\n  font-weight: 400;`
  );
  
  // Card styles
  const oldCards = `/* Bull head colors by count */
.game-card[data-bulls="1"] { background: var(--card-bg-1); border-color: rgba(148, 163, 184, 0.2); }
.game-card[data-bulls="2"] { background: var(--card-bg-2); border-color: rgba(34, 197, 94, 0.25); }
.game-card[data-bulls="3"] { background: var(--card-bg-3); border-color: rgba(245, 158, 11, 0.25); }
.game-card[data-bulls="5"] { background: var(--card-bg-5); border-color: rgba(249, 115, 22, 0.3); }
.game-card[data-bulls="7"] { background: var(--card-bg-7); border-color: rgba(239, 68, 68, 0.35); }

.game-card[data-bulls="1"] .card-number { color: #94a3b8; }
.game-card[data-bulls="2"] .card-number { color: var(--green-400); }
.game-card[data-bulls="3"] .card-number { color: var(--amber-400); }
.game-card[data-bulls="5"] .card-number { color: #fb923c; }
.game-card[data-bulls="7"] .card-number { color: var(--red-400); }

.game-card[data-bulls="1"] .card-bulls { color: #64748b; }
.game-card[data-bulls="2"] .card-bulls { color: var(--green-500); }
.game-card[data-bulls="3"] .card-bulls { color: var(--amber-500); }
.game-card[data-bulls="5"] .card-bulls { color: #f97316; }
.game-card[data-bulls="7"] .card-bulls { color: var(--red-500); }`;

  const newCards = `/* Card styling inspired by PDF */
.game-card { background: #ffffff; border: 2px solid rgba(0,0,0,0.1); border-radius: 12px; }
.game-card::before, .game-card::after {
  content: attr(data-num);
  position: absolute;
  font-family: 'Luckiest Guy', cursive;
  font-size: 0.7rem;
  color: #1e3a8a; /* Blue */
  text-shadow: -1px -1px 0 #fbcfe8, 1px -1px 0 #fbcfe8, -1px 1px 0 #fbcfe8, 1px 1px 0 #fbcfe8; /* Pink outline */
}
.game-card::before { top: 4px; left: 4px; }
.game-card::after { bottom: 4px; right: 4px; transform: rotate(180deg); }

.game-card .card-number {
  font-family: 'Luckiest Guy', cursive;
  font-size: 2.2rem;
  color: #000 !important; /* Default black, override below for special */
}

/* Backgrounds based on chilli count */
.game-card[data-bulls="1"] { background: #ffffff; }
.game-card[data-bulls="2"] { background: #fdf2f8; } /* Pinkish */
.game-card[data-bulls="3"] { background: #fffbeb; } /* Yellowish */
.game-card[data-bulls="5"] { background: #fef2f2; } /* Reddish */
.game-card[data-bulls="7"] { background: #ef4444; } /* Solid red for 55 */

.game-card[data-bulls="7"] .card-number { color: #000 !important; }

.game-card[data-bulls="1"] .card-bulls { color: #ef4444; }
.game-card[data-bulls="2"] .card-bulls { color: #ef4444; }
.game-card[data-bulls="3"] .card-bulls { color: #ef4444; }
.game-card[data-bulls="5"] .card-bulls { color: #ef4444; }
.game-card[data-bulls="7"] .card-bulls { color: #ffffff; }`;

  // Use regex to replace carefully (LF or CRLF)
  styleContent = styleContent.replace(/\/\* Bull head colors by count \*\/[\s\S]*\.game-card\[data-bulls="7"\] \.card-bulls \{ color: var\(--red-500\); \}/m, newCards);
  
  fs.writeFileSync(stylePath, styleContent, 'utf8');
  console.log('Updated style.css');
}

// Update game card render logic in app.js
const appJsPath = path.join(__dirname, '..', 'public/js/app.js');
if (fs.existsSync(appJsPath)) {
  let appContent = fs.readFileSync(appJsPath, 'utf8');
  appContent = appContent.replace(
    `div.dataset.bulls = card.bullHeads;`,
    `div.dataset.bulls = card.bullHeads;\n    div.dataset.num = card.number;`
  );
  fs.writeFileSync(appJsPath, appContent, 'utf8');
  console.log('Updated app.js card render logic');
}
