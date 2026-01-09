let blockedSites = []; // { type: 'url' | 'keyword', value: 'example.com' }
let schedules = []; // { name: 'Work Hours', days: [1,2,3,4,5], startTime: '09:00', endTime: '17:00', sites: [], keywords: [], redirectUrl: 'pages/blocked.html' }
let globalRedirectUrl = 'pages/blocked.html';
let globalBreakDuration = 30; // minutes
let globalBreak = null; // { remainingSeconds, isPaused, lastUsedDate }
let breakTimerInterval = null;

// Load settings from storage when the extension starts
chrome.storage.local.get(['blockedSites', 'schedules', 'globalRedirectUrl', 'globalBreakDuration', 'globalBreak'], (result) => {
  if (result.blockedSites) {
    blockedSites = result.blockedSites;
  }
  if (result.schedules) {
    schedules = result.schedules;
  }
  if (result.globalRedirectUrl) {
    globalRedirectUrl = result.globalRedirectUrl;
  }
  if (result.globalBreakDuration !== undefined) {
    globalBreakDuration = result.globalBreakDuration;
  }
  if (result.globalBreak) {
    globalBreak = result.globalBreak;
    // Clear if from previous day
    clearStaleBreak();
    // Resume timer if break is active and unpaused
    startBreakTimerIfNeeded();
  }
  console.log('Initial settings loaded:', { blockedSites, schedules, globalRedirectUrl, globalBreakDuration, globalBreak });
});

// Listen for messages from the popup to update settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    blockedSites = message.settings.blockedSites || [];
    schedules = message.settings.schedules || [];
    globalRedirectUrl = message.settings.globalRedirectUrl || 'pages/blocked.html';
    if (message.settings.globalBreakDuration !== undefined) {
      globalBreakDuration = message.settings.globalBreakDuration;
    }
    chrome.storage.local.set(
      {
        blockedSites: blockedSites,
        schedules: schedules,
        globalRedirectUrl: globalRedirectUrl,
        globalBreakDuration: globalBreakDuration,
      },
      () => {
        console.log('Settings updated:', { blockedSites, schedules, globalRedirectUrl, globalBreakDuration });
        sendResponse({ status: 'success' });
      }
    );
    return true;
  }

  if (message.action === 'startBreak') {
    const result = handleStartBreak();
    sendResponse(result);
    return true;
  }

  if (message.action === 'pauseBreak') {
    const result = handlePauseBreak();
    sendResponse(result);
    return true;
  }

  if (message.action === 'resumeBreak') {
    const result = handleResumeBreak();
    sendResponse(result);
    return true;
  }

  if (message.action === 'getBreakStatus') {
    sendResponse(getGlobalBreakStatus());
    return true;
  }

  if (message.action === 'getActiveBreakForOverlay') {
    sendResponse(getActiveBreakForOverlay());
    return true;
  }

  if (message.action === 'checkIfCurrentUrlBlocked') {
    const url = message.url;
    const result = isCurrentlyBlocked(url);
    sendResponse(result);
    return true;
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
  
  // Check always-on blocked sites FIRST - these are ALWAYS enforced regardless of break
  for (const site of blockedSites) {
    if (site.type === 'url' && matchesPattern(url, site.value)) {
      return { blocked: true, redirectUrl: effectiveRedirectUrl };
    }
    // Keyword matching remains as .includes, as keywords are expected to be substrings
    if (site.type === 'keyword' && url.toLowerCase().includes(site.value.toLowerCase())) {
      return { blocked: true, redirectUrl: effectiveRedirectUrl };
    }
  }

  // If global break is active and running, don't block scheduled content
  if (globalBreak && !globalBreak.isPaused && globalBreak.remainingSeconds > 0) {
    return { blocked: false };
  }

  // Check schedules
  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
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
      for (const blocked of schedule.sites) {
        if (matchesPattern(url, blocked)) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          break;
        }
      }
      if (siteIsBlocked) break;

      for (const keyword of schedule.keywords) {
        if (url.toLowerCase().includes(keyword.toLowerCase())) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          break;
        }
      }
      if (siteIsBlocked) break;
    }
  }

  return siteIsBlocked 
    ? { blocked: true, redirectUrl: effectiveRedirectUrl } 
    : { blocked: false };
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

      // Append the original URL as a query parameter so blocked page can redirect back after break
      const redirectWithOriginal = `${finalRedirectUrl}?blockedUrl=${encodeURIComponent(details.url)}`;
      chrome.tabs.update(details.tabId, { url: redirectWithOriginal });
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
);

// === Break Management Functions ===

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function clearStaleBreak() {
  const today = getTodayDateString();
  
  if (globalBreak && globalBreak.lastUsedDate !== today) {
    globalBreak = null;
    saveGlobalBreak();
    console.log('Cleared stale global break from previous day');
  }
}

function saveGlobalBreak() {
  chrome.storage.local.set({ globalBreak }, () => {
    console.log('Global break saved:', globalBreak);
  });
}

function startBreakTimerIfNeeded() {
  const hasActiveBreak = globalBreak && !globalBreak.isPaused && globalBreak.remainingSeconds > 0;

  if (hasActiveBreak && !breakTimerInterval) {
    breakTimerInterval = setInterval(tickBreakTimer, 1000);
    console.log('Break timer started');
  }
}

function stopBreakTimerIfNotNeeded() {
  const hasActiveBreak = globalBreak && !globalBreak.isPaused && globalBreak.remainingSeconds > 0;

  if (!hasActiveBreak && breakTimerInterval) {
    clearInterval(breakTimerInterval);
    breakTimerInterval = null;
    console.log('Break timer stopped');
  }
}

function tickBreakTimer() {
  // Check for day change (midnight crossover)
  clearStaleBreak();
  
  if (globalBreak && !globalBreak.isPaused && globalBreak.remainingSeconds > 0) {
    globalBreak.remainingSeconds--;
    
    if (globalBreak.remainingSeconds <= 0) {
      console.log('Global break has expired');
      globalBreak.remainingSeconds = 0;
      globalBreak.isPaused = true;
    }
    
    saveGlobalBreak();
    stopBreakTimerIfNotNeeded();
  }
}

function handleStartBreak() {
  if (globalBreakDuration <= 0) {
    return { success: false, error: 'No break duration configured' };
  }

  const today = getTodayDateString();

  // Check if break was already used today
  if (globalBreak && globalBreak.lastUsedDate === today && globalBreak.remainingSeconds <= 0) {
    return { success: false, error: 'Break already used today' };
  }

  // If there's an existing break with time remaining, don't restart
  if (globalBreak && globalBreak.remainingSeconds > 0) {
    return { success: false, error: 'Break already active' };
  }

  // Start new break
  globalBreak = {
    remainingSeconds: globalBreakDuration * 60,
    isPaused: false,
    lastUsedDate: today
  };

  saveGlobalBreak();
  startBreakTimerIfNeeded();
  console.log(`Global break started: ${globalBreakDuration} minutes`);
  
  return { success: true, remainingSeconds: globalBreak.remainingSeconds };
}

function handlePauseBreak() {
  if (!globalBreak || globalBreak.remainingSeconds <= 0) {
    return { success: false, error: 'No active break to pause' };
  }

  globalBreak.isPaused = true;
  saveGlobalBreak();
  stopBreakTimerIfNotNeeded();
  console.log('Global break paused');
  
  return { success: true, remainingSeconds: globalBreak.remainingSeconds };
}

function handleResumeBreak() {
  if (!globalBreak || globalBreak.remainingSeconds <= 0) {
    return { success: false, error: 'No break to resume' };
  }

  globalBreak.isPaused = false;
  saveGlobalBreak();
  startBreakTimerIfNeeded();
  console.log('Global break resumed');
  
  return { success: true, remainingSeconds: globalBreak.remainingSeconds };
}

function getGlobalBreakStatus() {
  const today = getTodayDateString();
  
  return {
    breakDuration: globalBreakDuration,
    hasActiveBreak: globalBreak && globalBreak.remainingSeconds > 0,
    remainingSeconds: globalBreak ? globalBreak.remainingSeconds : 0,
    isPaused: globalBreak ? globalBreak.isPaused : false,
    usedToday: globalBreak && globalBreak.lastUsedDate === today && globalBreak.remainingSeconds <= 0,
    canStartBreak: globalBreakDuration > 0 && 
      (!globalBreak || globalBreak.lastUsedDate !== today || globalBreak.remainingSeconds > 0)
  };
}

function getActiveBreakForOverlay() {
  if (globalBreak && globalBreak.remainingSeconds > 0) {
    return {
      hasActiveBreak: true,
      remainingSeconds: globalBreak.remainingSeconds,
      isPaused: globalBreak.isPaused
    };
  }
  return { hasActiveBreak: false };
}

console.log('Background script loaded.');
