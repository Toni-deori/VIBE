const featureCSS = {
    contrastZoom: `
      html {
        filter: invert(100%) contrast(200%) !important;
        background-color: white !important;
      }
      img, video, [role="img"], [data-image], [aria-label*="image"] {
        filter: invert(100%) !important;
      }
    `,
    photophobia: `
      html {
        filter: invert(1) hue-rotate(180deg) contrast(90%) brightness(90%) !important;
        background: black !important;
      }
      img, video {
        filter: invert(1) hue-rotate(180deg) !important;
      }
      #eye-comfort-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0,0,0,0.3) !important;
        z-index: 999999 !important;
        pointer-events: none !important;
      }
    `,
    colorBlindness: `` // Empty because handled in early-injection
  };
  async function getStoredConditions() {
    return new Promise(resolve => {
      chrome.storage.local.get({ conditions: {} }, data => resolve(data.conditions));
    });
  }
  async function setStoredCondition(tabId, condition) {
    const conditions = await getStoredConditions();
    condition ? conditions[tabId] = condition : delete conditions[tabId];
    return new Promise(resolve => {
      chrome.storage.local.set({ conditions }, resolve);
    });
  }
  const tabConditions = new Map();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getCondition') {
      getStoredConditions().then(conditions => {
        sendResponse({ condition: conditions[sender.tab.id] });
      });
      return true; // Keep the message channel open
    }
  });
  
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0 && tabConditions.has(details.tabId)) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['early-injection.js']
      });
    }
  });
  async function applyAccessibilityFeatures(tabId, condition) {
    try {
      // Remove previous styles
      await chrome.scripting.removeCSS({
        target: { tabId },
        css: Object.values(featureCSS).join('')
      });
      if (condition && condition.includes('Color Blindness')) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['early-injection.js']
        });
        return;
      }
  
      // Apply new settings only if condition exists
      if (condition) {
        let cssToApply = '';
        let zoomLevel = 1;
  
        switch(condition) {
          case 'Blurry Vision':
          case 'Reduced Vision':
            cssToApply = featureCSS.contrastZoom;
            zoomLevel = 1.4;
            break;
          case 'Photophobia':
            cssToApply = featureCSS.photophobia;
            zoomLevel = 1.2;
            break;
        }
  
        if (cssToApply) {
          await chrome.scripting.insertCSS({
            target: { tabId },
            css: cssToApply
          });
          await chrome.tabs.setZoom(tabId, zoomLevel);
        }
      }
    } catch (error) {
      console.error('Error applying features:', error);
    }
  }
  
  // Message listener for condition changes
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'setCondition' && message.tabId) {
      setStoredCondition(message.tabId, message.condition);
      applyAccessibilityFeatures(message.tabId, message.condition);
    }
  });
  
  // Reapply settings on navigation
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      const conditions = await getStoredConditions();
      const condition = conditions[tabId];
      if (condition) applyAccessibilityFeatures(tabId, condition);
    }
  });
  
  // Cleanup closed tabs
  chrome.tabs.onRemoved.addListener(tabId => {
    setStoredCondition(tabId, null);
  });
  
  // Existing voice navigation code below...

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const query = message.text.toLowerCase();
    console.log("Received query:", query);  // For debugging

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId) {
            console.error("No active tab found.");
            return;
        }

        console.log("Tab ID:", tabId);  // For debugging

        if (query.includes("search")) {
            const q = query.replace("search", "").trim();
            chrome.tabs.update(tabId, {
                url: "https://www.google.com/search?q=" + encodeURIComponent(q)
            });

        } else if (query.includes("youtube")) {
            const q = query.replace("youtube", "").trim();
            chrome.tabs.update(tabId, {
                url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q)
            });

        } else if (query.includes("wikipedia")) {
            const q = query.replace("wikipedia", "").trim();
            chrome.tabs.update(tabId, {
                url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(q.replace(" ", "_"))
            });

        } else if (query.includes("twitter")) {
            chrome.tabs.update(tabId, { url: "https://x.com" });

        } else {
            // Handle non-web commands, or pass to content.js
            chrome.tabs.sendMessage(tabId, { text: message.text });
        }
    });
});
