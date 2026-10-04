const fs = require('fs');
const path = require('path');

// Update style.css
const stylePath = path.join(__dirname, '..', 'public/css/style.css');
if (fs.existsSync(stylePath)) {
  let content = fs.readFileSync(stylePath, 'utf8');
  
  // Replace gradients
  content = content.replace(
    /--gradient-accent: linear-gradient\(135deg, var\(--amber-500\) 0%, var\(--red-500\) 100%\);/g,
    '--gradient-accent: linear-gradient(135deg, #ffffff 0%, #3b82f6 100%);'
  );
  content = content.replace(
    /--gradient-header: linear-gradient\(135deg, #f59e0b 0%, #ef4444 50%, #a855f7 100%\);/g,
    '--gradient-header: linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #3b82f6 100%);'
  );

  // Add view transition CSS
  const vtCss = `
/* ════════════════════════════════
   VIEW TRANSITIONS
   ════════════════════════════════ */
html.zoom-transition::view-transition-old(root) {
  animation: zoomOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
html.zoom-transition::view-transition-new(root) {
  animation: zoomIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes zoomOut {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(1.1); }
}
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
`;
  if (!content.includes('zoomOut')) {
    content += vtCss;
  }
  
  fs.writeFileSync(stylePath, content, 'utf8');
  console.log('Updated style.css');
}

// Update app.js
const appJsPath = path.join(__dirname, '..', 'public/js/app.js');
if (fs.existsSync(appJsPath)) {
  let appContent = fs.readFileSync(appJsPath, 'utf8');
  
  const oldFunc = `  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    // Close overlays when switching screens
    scoreboardOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
  }`;

  const newFunc = `  function showScreen(name) {
    const doSwitch = () => {
      Object.values(screens).forEach(s => s.classList.remove('active'));
      screens[name].classList.add('active');
      // Close overlays when switching screens
      scoreboardOverlay.classList.remove('active');
      gameoverOverlay.classList.remove('active');
    };

    if (!document.startViewTransition) {
      doSwitch();
      return;
    }

    document.documentElement.classList.add('zoom-transition');
    const transition = document.startViewTransition(doSwitch);
    transition.finished.finally(() => {
      document.documentElement.classList.remove('zoom-transition');
    });
  }`;

  if (!appContent.includes('document.startViewTransition')) {
    appContent = appContent.replace(oldFunc, newFunc);
    fs.writeFileSync(appJsPath, appContent, 'utf8');
    console.log('Updated app.js');
  } else {
    console.log('app.js already updated');
  }
}
