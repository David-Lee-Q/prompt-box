let promptWindowId = null;

chrome.action.onClicked.addListener(function() {
  if (promptWindowId !== null) {
    chrome.windows.get(promptWindowId, { populate: false }, function(win) {
      if (chrome.runtime.lastError || !win) {
        promptWindowId = null;
        openWindow();
      } else {
        chrome.windows.update(promptWindowId, { focused: true });
      }
    });
  } else {
    openWindow();
  }
});

function openWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('side_panel.html'),
    type: 'popup',
    width: 960,
    height: 720,
    focused: true,
  }, function(win) {
    promptWindowId = win.id;
  });
}

chrome.windows.onRemoved.addListener(function(winId) {
  if (winId === promptWindowId) {
    promptWindowId = null;
  }
});

// ── Content script readiness tracking ──
const readyTabs = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CONTENT_SCRIPT_READY' && sender.tab?.id) {
    readyTabs.set(sender.tab.id, { platform: msg.platform, time: Date.now() });
  }
  if (msg.type === 'QUERY_READY_TABS') {
    sendResponse(Object.fromEntries(readyTabs));
  }
  if (msg.type === 'IS_TAB_READY') {
    sendResponse(readyTabs.has(msg.tabId));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  readyTabs.delete(tabId);
});
