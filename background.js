let blockedSites = []; // { type: 'url' | 'keyword', value: 'example.com' }
let schedules = []; // { name: 'Work Hours', days: [1,2,3,4,5], startTime: '09:00', endTime: '17:00', sites: [], keywords: [], redirectUrl: 'pages/blocked.html' }
let globalRedirectUrl = 'pages/blocked.html';

// Load settings from storage when the extension starts
chrome.storage.local.get(['blockedSites', 'schedules', 'globalRedirectUrl'], (result) => {
  if (result.blockedSites) {
    blockedSites = result.blockedSites;
  }
  if (result.schedules) {
    schedules = result.schedules;
  }
  if (result.globalRedirectUrl) {
    globalRedirectUrl = result.globalRedirectUrl;
  }
  console.log('Initial settings loaded:', { blockedSites, schedules, globalRedirectUrl });
});

// Listen for messages from the popup to update settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    blockedSites = message.settings.blockedSites || [];
    schedules = message.settings.schedules || [];
    globalRedirectUrl = message.settings.globalRedirectUrl || 'pages/blocked.html';
    chrome.storage.local.set(
      {
        blockedSites: blockedSites,
        schedules: schedules,
        globalRedirectUrl: globalRedirectUrl,
      },
      () => {
        console.log('Settings updated:', { blockedSites, schedules, globalRedirectUrl });
        sendResponse({ status: 'success' });
      }
    );
    return true; // Indicates that the response is sent asynchronously
  }
});

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getCurrentDay() {
  const now = new Date();
  return now.getDay(); // Sunday is 0, Monday is 1, ..., Saturday is 6
}

function isCurrentlyBlocked(url) {
  const currentTime = getCurrentTime();
  const currentDay = getCurrentDay();
  let siteIsBlocked = false;
  let effectiveRedirectUrl = globalRedirectUrl;

  // Check general blocked sites (not tied to a schedule)
  for (const site of blockedSites) {
    if (site.type === 'url' && url.includes(site.value)) {
      siteIsBlocked = true;
      break;
    }
    if (site.type === 'keyword' && url.toLowerCase().includes(site.value.toLowerCase())) {
      siteIsBlocked = true;
      break;
    }
  }

  // Check schedules
  for (const schedule of schedules) {
    const isInDay = schedule.days.includes(currentDay);
    const isInTime = currentTime >= schedule.startTime && currentTime < schedule.endTime;

    if (isInDay && isInTime) {
      // This schedule is active, check its sites and keywords
      for (const blocked of schedule.sites) { // Assuming schedule.sites is an array of strings (URLs)
        if (url.includes(blocked)) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          break;
        }
      }
      if (siteIsBlocked) break; // Found a block in this active schedule

      for (const keyword of schedule.keywords) { // Assuming schedule.keywords is an array of strings
        if (url.toLowerCase().includes(keyword.toLowerCase())) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          break;
        }
      }
      if (siteIsBlocked) break; // Found a block in this active schedule
    }
  }

  return siteIsBlocked ? { blocked: true, redirectUrl: effectiveRedirectUrl } : { blocked: false };
}

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) {
      // Only act on top-level navigations
      return;
    }

    const result = isCurrentlyBlocked(details.url);

    if (result.blocked) {
      console.log(`Blocking navigation to: ${details.url}`);
      let finalRedirectUrl = result.redirectUrl;
      // Ensure the redirect URL is an absolute URL if it's from an external source
      // or a chrome-extension URL if it's a local page.
      if (!finalRedirectUrl.startsWith('http://') && !finalRedirectUrl.startsWith('https://') && !finalRedirectUrl.startsWith('chrome-extension://')) {
        finalRedirectUrl = chrome.runtime.getURL(finalRedirectUrl);
      }

      // Check if the target URL is already the redirect URL to prevent redirect loops
      if (details.url === finalRedirectUrl) {
        console.log('Navigation target is already the redirect URL. Allowing navigation.');
        return;
      }
      
      // Also check if the target is our internal blocked page already
      if (details.url.includes(chrome.runtime.getURL('pages/blocked.html'))) {
           console.log('Navigation target is already the internal blocked page. Allowing navigation.');
        return;
      }

      chrome.tabs.update(details.tabId, { url: finalRedirectUrl });
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
);

console.log('Background script loaded.'); 