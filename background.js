let blockedSites = []; // { type: 'url' | 'keyword', value: 'example.com' }
let schedules = []; // { name: 'Work Hours', days: [1,2,3,4,5], startTime: '09:00', endTime: '17:00', sites: [], keywords: [], redirectUrl: 'pages/blocked.html', breakDuration: 30 }
let globalRedirectUrl = 'pages/blocked.html';
let activeBreaks = {}; // { [scheduleIndex]: { remainingSeconds, isPaused, lastUsedDate } }
let breakTimerInterval = null;

// Load settings from storage when the extension starts
chrome.storage.local.get(['blockedSites', 'schedules', 'globalRedirectUrl', 'activeBreaks'], (result) => {
  if (result.blockedSites) {
    blockedSites = result.blockedSites;
  }
  if (result.schedules) {
    schedules = result.schedules;
  }
  if (result.globalRedirectUrl) {
    globalRedirectUrl = result.globalRedirectUrl;
  }
  if (result.activeBreaks) {
    activeBreaks = result.activeBreaks;
    // Resume timer if there are active unpaused breaks
    startBreakTimerIfNeeded();
  }
  console.log('Initial settings loaded:', { blockedSites, schedules, globalRedirectUrl, activeBreaks });
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
    return true;
  }

  if (message.action === 'startBreak') {
    const result = handleStartBreak(message.scheduleIndex);
    sendResponse(result);
    return true;
  }

  if (message.action === 'pauseBreak') {
    const result = handlePauseBreak(message.scheduleIndex);
    sendResponse(result);
    return true;
  }

  if (message.action === 'resumeBreak') {
    const result = handleResumeBreak(message.scheduleIndex);
    sendResponse(result);
    return true;
  }

  if (message.action === 'endBreak') {
    const result = handleEndBreak(message.scheduleIndex);
    sendResponse(result);
    return true;
  }

  if (message.action === 'getBreakStatus') {
    sendResponse(getBreakStatus());
    return true;
  }

  if (message.action === 'getActiveSchedulesForBreak') {
    sendResponse(getActiveSchedulesForBreak());
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
  let blockingScheduleIndex = -1;

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
      // Check if this schedule has an active unpaused break
      const breakState = activeBreaks[i];
      if (breakState && !breakState.isPaused && breakState.remainingSeconds > 0) {
        // Break is active and running - don't block for this schedule
        continue;
      }

      // This schedule is active, check its sites and keywords
      for (const blocked of schedule.sites) {
        if (matchesPattern(url, blocked)) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          blockingScheduleIndex = i;
          break;
        }
      }
      if (siteIsBlocked) break;

      for (const keyword of schedule.keywords) {
        if (url.toLowerCase().includes(keyword.toLowerCase())) {
          siteIsBlocked = true;
          effectiveRedirectUrl = schedule.redirectUrl || globalRedirectUrl;
          blockingScheduleIndex = i;
          break;
        }
      }
      if (siteIsBlocked) break;
    }
  }

  return siteIsBlocked 
    ? { blocked: true, redirectUrl: effectiveRedirectUrl, scheduleIndex: blockingScheduleIndex } 
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

      chrome.tabs.update(details.tabId, { url: finalRedirectUrl });
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
);

// === Break Management Functions ===

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function saveActiveBreaks() {
  chrome.storage.local.set({ activeBreaks }, () => {
    console.log('Active breaks saved:', activeBreaks);
  });
}

function updateBadge() {
  // Find the first active unpaused break to display
  let displayBreak = null;
  let displayIndex = null;
  
  for (const [index, breakState] of Object.entries(activeBreaks)) {
    if (breakState && breakState.remainingSeconds > 0) {
      if (!breakState.isPaused) {
        displayBreak = breakState;
        displayIndex = index;
        break; // Prefer unpaused breaks
      } else if (!displayBreak) {
        displayBreak = breakState;
        displayIndex = index;
      }
    }
  }

  if (displayBreak) {
    const mins = Math.floor(displayBreak.remainingSeconds / 60);
    const secs = displayBreak.remainingSeconds % 60;
    const text = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
    
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ 
      color: displayBreak.isPaused ? '#FFA500' : '#4CAF50' // Orange if paused, green if running
    });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

function startBreakTimerIfNeeded() {
  // Check if there are any active unpaused breaks
  const hasActiveBreak = Object.values(activeBreaks).some(
    b => b && !b.isPaused && b.remainingSeconds > 0
  );

  if (hasActiveBreak && !breakTimerInterval) {
    breakTimerInterval = setInterval(tickBreakTimer, 1000);
    console.log('Break timer started');
  }
  updateBadge();
}

function stopBreakTimerIfNotNeeded() {
  const hasActiveBreak = Object.values(activeBreaks).some(
    b => b && !b.isPaused && b.remainingSeconds > 0
  );

  if (!hasActiveBreak && breakTimerInterval) {
    clearInterval(breakTimerInterval);
    breakTimerInterval = null;
    console.log('Break timer stopped');
  }
  updateBadge();
}

function tickBreakTimer() {
  let changed = false;
  
  for (const [index, breakState] of Object.entries(activeBreaks)) {
    if (breakState && !breakState.isPaused && breakState.remainingSeconds > 0) {
      breakState.remainingSeconds--;
      changed = true;
      
      if (breakState.remainingSeconds <= 0) {
        console.log(`Break for schedule ${index} has expired`);
        // Keep the record so we know it was used today, but mark as done
        breakState.remainingSeconds = 0;
        breakState.isPaused = true;
      }
    }
  }

  if (changed) {
    saveActiveBreaks();
    updateBadge();
    stopBreakTimerIfNotNeeded();
  }
}

function handleStartBreak(scheduleIndex) {
  const schedule = schedules[scheduleIndex];
  if (!schedule) {
    return { success: false, error: 'Schedule not found' };
  }

  const breakDuration = schedule.breakDuration || 0;
  if (breakDuration <= 0) {
    return { success: false, error: 'No break duration configured for this schedule' };
  }

  const today = getTodayDateString();
  const existingBreak = activeBreaks[scheduleIndex];

  // Check if break was already used today
  if (existingBreak && existingBreak.lastUsedDate === today && existingBreak.remainingSeconds <= 0) {
    return { success: false, error: 'Break already used today for this schedule' };
  }

  // If there's an existing break with time remaining, don't restart
  if (existingBreak && existingBreak.remainingSeconds > 0) {
    return { success: false, error: 'Break already active' };
  }

  // Start new break
  activeBreaks[scheduleIndex] = {
    remainingSeconds: breakDuration * 60,
    isPaused: false,
    lastUsedDate: today
  };

  saveActiveBreaks();
  startBreakTimerIfNeeded();
  console.log(`Break started for schedule ${scheduleIndex}: ${breakDuration} minutes`);
  
  return { success: true, remainingSeconds: activeBreaks[scheduleIndex].remainingSeconds };
}

function handlePauseBreak(scheduleIndex) {
  const breakState = activeBreaks[scheduleIndex];
  if (!breakState || breakState.remainingSeconds <= 0) {
    return { success: false, error: 'No active break to pause' };
  }

  breakState.isPaused = true;
  saveActiveBreaks();
  stopBreakTimerIfNotNeeded();
  console.log(`Break paused for schedule ${scheduleIndex}`);
  
  return { success: true, remainingSeconds: breakState.remainingSeconds };
}

function handleResumeBreak(scheduleIndex) {
  const breakState = activeBreaks[scheduleIndex];
  if (!breakState || breakState.remainingSeconds <= 0) {
    return { success: false, error: 'No break to resume' };
  }

  breakState.isPaused = false;
  saveActiveBreaks();
  startBreakTimerIfNeeded();
  console.log(`Break resumed for schedule ${scheduleIndex}`);
  
  return { success: true, remainingSeconds: breakState.remainingSeconds };
}

function handleEndBreak(scheduleIndex) {
  const breakState = activeBreaks[scheduleIndex];
  if (!breakState) {
    return { success: false, error: 'No break to end' };
  }

  // Mark break as used up
  breakState.remainingSeconds = 0;
  breakState.isPaused = true;
  
  saveActiveBreaks();
  stopBreakTimerIfNotNeeded();
  console.log(`Break ended for schedule ${scheduleIndex}`);
  
  return { success: true };
}

function getBreakStatus() {
  const today = getTodayDateString();
  const status = {};

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
    const breakState = activeBreaks[i];
    
    status[i] = {
      scheduleName: schedule.name,
      breakDuration: schedule.breakDuration || 0,
      hasActiveBreak: breakState && breakState.remainingSeconds > 0,
      remainingSeconds: breakState ? breakState.remainingSeconds : 0,
      isPaused: breakState ? breakState.isPaused : false,
      usedToday: breakState && breakState.lastUsedDate === today && breakState.remainingSeconds <= 0,
      canStartBreak: (schedule.breakDuration || 0) > 0 && 
        (!breakState || breakState.lastUsedDate !== today || breakState.remainingSeconds > 0)
    };
  }

  return status;
}

function getActiveSchedulesForBreak() {
  const currentTime = getCurrentTime();
  const currentDay = getCurrentDay();
  const today = getTodayDateString();
  const activeSchedules = [];

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
      if (currentTime >= schedule.startTime && currentTime < schedule.endTime) {
        isInTime = true;
      }
    }

    if (isInDay && isInTime && (schedule.breakDuration || 0) > 0) {
      const breakState = activeBreaks[i];
      activeSchedules.push({
        index: i,
        name: schedule.name,
        breakDuration: schedule.breakDuration,
        hasActiveBreak: breakState && breakState.remainingSeconds > 0,
        remainingSeconds: breakState ? breakState.remainingSeconds : 0,
        isPaused: breakState ? breakState.isPaused : false,
        usedToday: breakState && breakState.lastUsedDate === today && breakState.remainingSeconds <= 0,
        canStartBreak: !breakState || breakState.lastUsedDate !== today || breakState.remainingSeconds > 0
      });
    }
  }

  return activeSchedules;
}

console.log('Background script loaded.');
