const fs = require('fs');
const path = require('path');

// Update style.css
const stylePath = path.join(__dirname, '..', 'public/css/style.css');
if (fs.existsSync(stylePath)) {
  let styleContent = fs.readFileSync(stylePath, 'utf8');
  
  const oldCardsRegex = /\/\* Card styling inspired by PDF \*\/[\s\S]*\.game-card\[data-bulls="7"\] \.card-bulls \{ color: #ffffff; \}/m;
  const newCards = `/* Exact Card Images from PDF */
.game-card {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 8px rgba(0,0,0,0.4);
}
.game-card::before, .game-card::after, .game-card .card-number, .game-card .card-bulls {
  display: none !important; /* Hide any fallback text since the image has it all */
}`;

  styleContent = styleContent.replace(oldCardsRegex, newCards);
  fs.writeFileSync(stylePath, styleContent, 'utf8');
  console.log('Updated style.css');
}

// Update app.js
const appJsPath = path.join(__dirname, '..', 'public/js/app.js');
if (fs.existsSync(appJsPath)) {
  let appContent = fs.readFileSync(appJsPath, 'utf8');
  
  // Replace the card creation function body
  const oldFunc = `  function createCardDOM(card) {
    const div = document.createElement('div');
    div.className = 'game-card';
    div.dataset.bulls = card.bullHeads;
    div.dataset.num = card.number;

    const numSpan = document.createElement('span');
    numSpan.className = 'card-number';
    numSpan.textContent = card.number;

    const bullsSpan = document.createElement('span');
    bullsSpan.className = 'card-bulls';
    bullsSpan.textContent = '🌶️'.repeat(card.bullHeads);

    div.appendChild(numSpan);
    div.appendChild(bullsSpan);
    return div;
  }`;

  const newFunc = `  function createCardDOM(card) {
    const div = document.createElement('div');
    div.className = 'game-card';
    div.dataset.bulls = card.bullHeads;
    div.dataset.num = card.number;
    div.style.backgroundImage = \`url('img/cards/card-\${card.number}.jpg')\`;
    return div;
  }`;

  appContent = appContent.replace(oldFunc, newFunc);
  fs.writeFileSync(appJsPath, appContent, 'utf8');
  console.log('Updated app.js card DOM logic');
}
