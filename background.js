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

  // Helper function to check if a URL matches a blocked pattern
  const matchesPattern = (urlToCheck, pattern) => {
    try {
      // Attempt to parse the URL to extract the hostname
      const parsedUrl = new URL(urlToCheck);
      const hostname = parsedUrl.hostname;
      // Construct a regex to match the pattern as a whole domain or subdomain
      // e.g., "x.com" should match "x.com", "www.x.com", but not "electrolux.com"
      // It should also match "x.com/path"
      // The pattern should be escaped for any special regex characters
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^(www\\.)?${escapedPattern}(\\/|$)`, 'i');
      return regex.test(hostname);
    } catch (e) {
      // If URL parsing fails, fall back to simple includes for keywords
      // or for patterns not clearly identifiable as hostnames (e.g. if user enters "news" as a URL type)
      // This maintains some backward compatibility if the pattern isn't a valid domain part.
      return urlToCheck.toLowerCase().includes(pattern.toLowerCase());
    }
  };
  
  // Check general blocked sites (not tied to a schedule)
  for (const site of blockedSites) {
    if (site.type === 'url' && matchesPattern(url, site.value)) {
      siteIsBlocked = true;
      break;
    }
    // Keyword matching remains as .includes, as keywords are expected to be substrings
    if (site.type === 'keyword' && url.toLowerCase().includes(site.value.toLowerCase())) {
      siteIsBlocked = true;
      break;
    }
  }

  // Check schedules
  for (const schedule of schedules) {
    const isInDay = schedule.days.includes(currentDay);

    let isInTime = false;
    if (schedule.timeIntervals && schedule.timeIntervals.length > 0) {
      for (const interval of schedule.timeIntervals) {
        if (currentTime >= interval.startTime && currentTime < interval.endTime) {
          isInTime = true;
          break;
        }
      }
    } else if (schedule.startTime && schedule.endTime) {
      // Fallback for old data structure if timeIntervals is missing
      if (currentTime >= schedule.startTime && currentTime < schedule.endTime) {
        isInTime = true;
      }
    }

    if (isInDay && isInTime) {
      // This schedule is active, check its sites and keywords
      for (const blocked of schedule.sites) { // Assuming schedule.sites is an array of strings (URLs)
        if (matchesPattern(url, blocked)) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          break;
        }
      }
      if (siteIsBlocked) break; // Found a block in this active schedule

      for (const keyword of schedule.keywords) { // Assuming schedule.keywords is an array of strings
        // Keyword matching remains as .includes
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