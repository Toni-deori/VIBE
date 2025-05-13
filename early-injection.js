(function() {
  const FILTERS = {
    protanopia: 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'protanopia\'><feColorMatrix type=\'matrix\' values=\'0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0\'/></filter></svg>#protanopia")',
    tritanopia: 'hue-rotate(180deg) saturate(2.5)',
    achromatopsia: 'grayscale(100%)'
  };
  function applyWCAGContrast() {
    const style = document.createElement('style');
    style.textContent = `
      body {
        background-color: white !important;
        color: black !important;
      }
      a {
        color: #0066cc !important;
        text-decoration: underline !important;
      }
      button, [role="button"] {
        background-color: #f0f0f0 !important;
        color: #000 !important;
        border: 2px solid #000 !important;
      }
    `;
    document.head.appendChild(style);
  }
  function applyColorFilter(condition) {
    const style = document.createElement('style');
    style.id = 'color-accessibility-filter';
    
    let filter = '';
    switch(condition) {
      case 'Red-Green Color Blindness':
        filter = `contrast(1.5) ${FILTERS.protanopia}`;
        break;
      case 'Blue-Yellow Color Blindness':
        filter = `contrast(1.5) ${FILTERS.tritanopia}`;
        break;
      case 'Total Color Blindness':
        filter = `contrast(1.5) ${FILTERS.achromatopsia}`;
        break;
    }
    style.textContent = `
      html {
        filter: ${filter} !important;
      }
    `;
    document.documentElement.appendChild(style);
    applyWCAGContrast();
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message.condition) {
      const condition = message.condition;
      if (condition.includes('Color Blindness')) {
        applyColorFilter(condition);
      }
      sessionStorage.setItem('accessibilityCondition', condition);
    }
  });
  chrome.runtime.sendMessage({ action: 'getCondition' }, response => {
    if (response.condition && response.condition.includes('Color Blindness')) {
      applyColorFilter(response.condition);
    }
  });
  // Immediately check storage for condition
  chrome.runtime.sendMessage({ action: 'getCondition' }, response => {
    if (response.condition) applyCSS(response.condition);
  });

  // Listen for future condition changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.condition) {
      applyCSS(message.condition);
      sessionStorage.setItem('accessibilityCondition', message.condition);
    }
  });
  
    function applyCSS(condition) {
      const style = document.createElement('style');
      style.id = 'accessibility-overrides';
      
      switch(condition) {
        case 'Photophobia':
          style.textContent = `
            html {
              filter: invert(1) hue-rotate(180deg) contrast(90%) brightness(90%) !important;
              background: black !important;
              transition: none !important;
            }
            img, video, [role="img"], [data-image], [aria-label*="image"] {
              filter: invert(1) hue-rotate(180deg) !important;
            }
            #eye-comfort-overlay {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              height: 100% !important;
              background: rgba(0,0,0,0.3) !important;
              z-index: 2147483647 !important;
              pointer-events: none !important;
            }
          `;
          document.documentElement.appendChild(style);
          
          // Add overlay immediately
          const overlay = document.createElement('div');
          overlay.id = 'eye-comfort-overlay';
          document.documentElement.appendChild(overlay);
          break;
  
        case 'Blurry Vision':
        case 'Reduced Vision':
          style.textContent = `
            html {
              filter: invert(100%) contrast(200%) !important;
              background-color: white !important;
              transition: none !important;
            }
            img, video, [role="img"], [data-image], [aria-label*="image"] {
              filter: invert(100%) !important;
            }
          `;
          document.documentElement.prepend(style);
          break;
      }
    }
  })();