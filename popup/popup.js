document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.dataset.tab;

      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      link.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  const newBlockedSiteInput = document.getElementById('newBlockedSite');
  const addBlockedSiteButton = document.getElementById('addBlockedSite');
  const newBlockedKeywordInput = document.getElementById('newBlockedKeyword');
  const addBlockedKeywordButton = document.getElementById('addBlockedKeyword');
  const blockedItemsList = document.getElementById('blockedItemsList');

  const globalRedirectUrlInput = document.getElementById('globalRedirectUrlInput');
  const setGlobalRedirectButton = document.getElementById('setGlobalRedirectBtn');

  // Schedule elements
  const addScheduleBtn = document.getElementById('addScheduleBtn');
  const scheduleFormContainer = document.getElementById('scheduleFormContainer');
  const scheduleFormTitle = document.getElementById('scheduleFormTitle');
  const editingScheduleIndexInput = document.getElementById('editingScheduleIndex');
  const scheduleNameInput = document.getElementById('scheduleName');
  const dayCheckboxes = {
    Mon: document.getElementById('dayMon'),
    Tue: document.getElementById('dayTue'),
    Wed: document.getElementById('dayWed'),
    Thu: document.getElementById('dayThu'),
    Fri: document.getElementById('dayFri'),
    Sat: document.getElementById('daySat'),
    Sun: document.getElementById('daySun'),
  };
  const timeIntervalsList = document.getElementById('timeIntervalsList');
  const addIntervalBtn = document.getElementById('addIntervalBtn');

  const scheduleRedirectUrlInput = document.getElementById('scheduleRedirectUrl');
  const breakDurationInput = document.getElementById('breakDuration');
  const breakControlsContainer = document.getElementById('breakControlsContainer');
  const breakControlsContent = document.getElementById('breakControlsContent');
  const newScheduleSiteInput = document.getElementById('newScheduleSite');
  const addScheduleSiteBtn = document.getElementById('addScheduleSiteBtn');
  const newScheduleKeywordInput = document.getElementById('newScheduleKeyword');
  const addScheduleKeywordBtn = document.getElementById('addScheduleKeywordBtn');
  const scheduleSpecificItemsList = document.getElementById('scheduleSpecificItemsList');
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  const cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
  const scheduleListDiv = document.getElementById('scheduleList');

  let blockedSites = []; // For general rules: { type: 'url' or 'keyword', value: 'string' }
  let schedules = []; // Array of schedule objects
  let globalRedirectUrl = 'pages/blocked.html';

  // For the schedule form
  let currentScheduleSites = [];
  let currentScheduleKeywords = [];

  function saveSettings() {
    chrome.storage.local.set(
      { blockedSites, schedules, globalRedirectUrl },
      () => {
        console.log('Settings saved');
        // Notify background script to reload settings
        chrome.runtime.sendMessage({ action: 'updateSettings', settings: { blockedSites, schedules, globalRedirectUrl } }, response => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
          } else if (response && response.status === 'success') {
            console.log('Background script notified of settings update.');
          } else {
            console.warn('Background script did not acknowledge settings update or an error occurred.');
          }
        });
      }
    );
  }

  function loadSettings() {
    chrome.storage.local.get(['blockedSites', 'schedules', 'globalRedirectUrl'], (result) => {
      blockedSites = result.blockedSites || [];
      schedules = result.schedules || [];
      globalRedirectUrl = result.globalRedirectUrl || 'pages/blocked.html';
      globalRedirectUrlInput.value = globalRedirectUrl;
      renderBlockedItems();
      renderSchedules();
      updateBreakControls();
    });
  }

  function renderListItem(item, type, listElement, onRemove) {
    const li = document.createElement('li');
    li.textContent = `${type === 'url' ? 'URL' : 'Keyword'}: ${item.value || item}`;
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', onRemove);
    li.appendChild(removeButton);
    listElement.appendChild(li);
  }

  function renderBlockedItems() {
    blockedItemsList.innerHTML = '';
    blockedSites.forEach((item, index) => {
      renderListItem(item, item.type, blockedItemsList, () => {
        blockedSites.splice(index, 1);
        saveSettings();
        renderBlockedItems();
      });
    });
  }

  addBlockedSiteButton.addEventListener('click', () => {
    const value = newBlockedSiteInput.value.trim();
    if (value) {
      blockedSites.push({ type: 'url', value });
      newBlockedSiteInput.value = '';
      saveSettings();
      renderBlockedItems();
    }
  });

  addBlockedKeywordButton.addEventListener('click', () => {
    const value = newBlockedKeywordInput.value.trim();
    if (value) {
      blockedSites.push({ type: 'keyword', value });
      newBlockedKeywordInput.value = '';
      saveSettings();
      renderBlockedItems();
    }
  });

  setGlobalRedirectButton.addEventListener('click', () => {
    const url = globalRedirectUrlInput.value.trim();
    if (url) {
      globalRedirectUrl = url;
      saveSettings();
      alert('Global redirect URL updated!');
    } else {
      alert('Please enter a valid URL or path.');
    }
  });

  // --- Schedule UI Logic ---
  function openScheduleForm(schedule = null, index = -1) {
    scheduleFormContainer.style.display = 'block';
    addScheduleBtn.style.display = 'none';
    editingScheduleIndexInput.value = index;
    currentScheduleSites = [];
    currentScheduleKeywords = [];
    timeIntervalsList.innerHTML = ''; // Clear existing intervals

    if (schedule) {
      scheduleFormTitle.textContent = 'Edit';
      scheduleNameInput.value = schedule.name;
      Object.values(dayCheckboxes).forEach(cb => cb.checked = false); // Reset
      schedule.days.forEach(dayVal => {
        const dayCheckbox = Object.values(dayCheckboxes).find(cb => parseInt(cb.value) === dayVal);
        if(dayCheckbox) dayCheckbox.checked = true;
      });
      if (schedule.timeIntervals && schedule.timeIntervals.length > 0) {
        schedule.timeIntervals.forEach(interval => {
          addIntervalToDOM(interval.startTime, interval.endTime);
        });
      } else {
        // Fallback for old data structure or ensure at least one interval
        addIntervalToDOM('09:00', '17:00');
      }
      scheduleRedirectUrlInput.value = schedule.redirectUrl || '';
      breakDurationInput.value = schedule.breakDuration || 0;
      currentScheduleSites = [...(schedule.sites || [])];
      currentScheduleKeywords = [...(schedule.keywords || [])];
    } else {
      scheduleFormTitle.textContent = 'Add New';
      scheduleNameInput.value = '';
      Object.values(dayCheckboxes).forEach(cb => cb.checked = false);
      addIntervalToDOM('09:00', '17:00'); // Add one default interval
      scheduleRedirectUrlInput.value = '';
      breakDurationInput.value = 0;
    }
    renderScheduleSpecificItems();
  }

  function closeScheduleForm() {
    scheduleFormContainer.style.display = 'none';
    addScheduleBtn.style.display = 'block';
    editingScheduleIndexInput.value = '-1';
    // Clear form fields
    scheduleNameInput.value = '';
    Object.values(dayCheckboxes).forEach(cb => cb.checked = false);
    timeIntervalsList.innerHTML = ''; // Clear intervals
    scheduleRedirectUrlInput.value = '';
    breakDurationInput.value = 0;
    currentScheduleSites = [];
    currentScheduleKeywords = [];
    renderScheduleSpecificItems(); 
  }

  function addIntervalToDOM(startTime = '09:00', endTime = '17:00') {
    const intervalPairDiv = document.createElement('div');
    intervalPairDiv.classList.add('time-interval-pair');
    intervalPairDiv.innerHTML = `
      <input type="time" class="startTimeInput" value="${startTime}">
      <span>-</span>
      <input type="time" class="endTimeInput" value="${endTime}">
      <button type="button" class="removeIntervalBtn">Remove</button>
    `;
    timeIntervalsList.appendChild(intervalPairDiv);
    intervalPairDiv.querySelector('.removeIntervalBtn').addEventListener('click', () => {
        // Ensure at least one interval remains
        if (timeIntervalsList.querySelectorAll('.time-interval-pair').length > 1) {
            intervalPairDiv.remove();
        } else {
            alert('A schedule must have at least one time interval.');
        }
    });
  }

  function renderScheduleSpecificItems() {
    scheduleSpecificItemsList.innerHTML = '';
    currentScheduleSites.forEach((site, index) => {
      renderListItem({ value: site }, 'url', scheduleSpecificItemsList, () => {
        currentScheduleSites.splice(index, 1);
        renderScheduleSpecificItems();
      });
    });
    currentScheduleKeywords.forEach((keyword, index) => {
      renderListItem({ value: keyword }, 'keyword', scheduleSpecificItemsList, () => {
        currentScheduleKeywords.splice(index, 1);
        renderScheduleSpecificItems();
      });
    });
  }

  addScheduleSiteBtn.addEventListener('click', () => {
    const site = newScheduleSiteInput.value.trim();
    if (site) {
      currentScheduleSites.push(site);
      newScheduleSiteInput.value = '';
      renderScheduleSpecificItems();
    }
  });

  addScheduleKeywordBtn.addEventListener('click', () => {
    const keyword = newScheduleKeywordInput.value.trim();
    if (keyword) {
      currentScheduleKeywords.push(keyword);
      newScheduleKeywordInput.value = '';
      renderScheduleSpecificItems();
    }
  });

  addScheduleBtn.addEventListener('click', () => openScheduleForm());
  cancelScheduleBtn.addEventListener('click', closeScheduleForm);

  saveScheduleBtn.addEventListener('click', () => {
    const name = scheduleNameInput.value.trim();
    const scheduleRedirect = scheduleRedirectUrlInput.value.trim();

    const timeIntervals = [];
    const intervalPairs = timeIntervalsList.querySelectorAll('.time-interval-pair');
    intervalPairs.forEach(pair => {
      const startInput = pair.querySelector('.startTimeInput');
      const endInput = pair.querySelector('.endTimeInput');
      if (startInput.value && endInput.value) {
        if (startInput.value >= endInput.value) {
            alert(`Error: Start time (${startInput.value}) must be before end time (${endInput.value}) in an interval.`);
            return; // Stop execution if an interval is invalid
        }
        timeIntervals.push({ startTime: startInput.value, endTime: endInput.value });
      }
    });

    if (timeIntervals.length === 0) {
        alert('Please add at least one valid time interval.');
        return;
    }

    if (!name) {
      alert('Please fill in schedule name.');
      return;
    }

    const selectedDays = [];
    for (const dayKey in dayCheckboxes) {
        if (dayCheckboxes[dayKey].checked) {
            selectedDays.push(parseInt(dayCheckboxes[dayKey].value));
        }
    }

    if (selectedDays.length === 0) {
        alert('Please select at least one day for the schedule.');
        return;
    }

    const newSchedule = {
      name,
      days: selectedDays,
      timeIntervals: timeIntervals,
      sites: [...currentScheduleSites],
      keywords: [...currentScheduleKeywords],
      redirectUrl: scheduleRedirect || '', // Empty string means use global
      breakDuration: parseInt(breakDurationInput.value) || 0
    };

    const editIndex = parseInt(editingScheduleIndexInput.value);
    if (editIndex > -1) {
      schedules[editIndex] = newSchedule;
    } else {
      schedules.push(newSchedule);
    }
    saveSettings();
    renderSchedules();
    closeScheduleForm();
  });

  function renderSchedules() {
    scheduleListDiv.innerHTML = '';
    schedules.forEach((schedule, index) => {
      const div = document.createElement('div');
      div.classList.add('schedule-item');
      
      let intervalsString = 'No time intervals set.';
      if (schedule.timeIntervals && schedule.timeIntervals.length > 0) {
        intervalsString = schedule.timeIntervals.map(interval => `${interval.startTime} - ${interval.endTime}`).join(', ');
      } else if (schedule.startTime && schedule.endTime) { // Fallback for old structure
        intervalsString = `${schedule.startTime} - ${schedule.endTime}`;
      }

      const breakInfo = schedule.breakDuration ? `Break: ${schedule.breakDuration} min` : 'No break';

      div.innerHTML = `
        <strong>${schedule.name}</strong> (${intervalsString})<br>
        Days: ${schedule.days.map(d => Object.keys(dayCheckboxes)[Object.values(dayCheckboxes).findIndex(cb => parseInt(cb.value) === d)] || 'N/A').join(', ')}<br>
        Sites: ${schedule.sites ? schedule.sites.length : 0}, Keywords: ${schedule.keywords ? schedule.keywords.length : 0}<br>
        Redirect: ${schedule.redirectUrl || 'Global'} | ${breakInfo}
      `;
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => openScheduleForm(schedule, index));

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        schedules.splice(index, 1);
        saveSettings();
        renderSchedules();
      });

      div.appendChild(editButton);
      div.appendChild(deleteButton);
      scheduleListDiv.appendChild(div);
    });
  }

  addIntervalBtn.addEventListener('click', () => addIntervalToDOM());

  // === Break Controls ===
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function updateBreakControls() {
    chrome.runtime.sendMessage({ action: 'getBreakStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting break status:', chrome.runtime.lastError);
        return;
      }

      const breakStatuses = response || {};
      let hasActiveOrAvailableBreak = false;
      let html = '';

      for (const [index, status] of Object.entries(breakStatuses)) {
        if (status.breakDuration <= 0) continue; // Skip schedules without break configured

        if (status.hasActiveBreak) {
          hasActiveOrAvailableBreak = true;
          const stateText = status.isPaused ? 'PAUSED' : 'RUNNING';
          const stateClass = status.isPaused ? 'paused' : 'running';
          html += `
            <div class="break-control-item">
              <div class="break-info">
                <span class="break-schedule-name">${status.scheduleName}</span>
                <span class="break-timer ${stateClass}">${formatTime(status.remainingSeconds)}</span>
                <span class="break-state ${stateClass}">${stateText}</span>
              </div>
              <div class="break-buttons">
                ${status.isPaused 
                  ? `<button class="secondary-action" data-action="resume" data-index="${index}">Resume</button>`
                  : `<button class="secondary-action" data-action="pause" data-index="${index}">Pause</button>`
                }
              </div>
            </div>
          `;
        } else if (status.usedToday) {
          // Break was used today already
          html += `
            <div class="break-control-item used">
              <div class="break-info">
                <span class="break-schedule-name">${status.scheduleName}</span>
                <span class="break-used">Break used today</span>
              </div>
            </div>
          `;
          hasActiveOrAvailableBreak = true;
        }
      }

      if (hasActiveOrAvailableBreak) {
        breakControlsContainer.style.display = 'block';
        breakControlsContent.innerHTML = html;
        attachBreakButtonListeners();
      } else {
        breakControlsContainer.style.display = 'none';
      }
    });
  }

  function attachBreakButtonListeners() {
    breakControlsContent.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        
        let messageAction = '';
        if (action === 'pause') messageAction = 'pauseBreak';
        else if (action === 'resume') messageAction = 'resumeBreak';
        
        chrome.runtime.sendMessage({ action: messageAction, scheduleIndex: index }, (response) => {
          if (response && response.success) {
            updateBreakControls();
          } else {
            alert(response?.error || 'Failed to update break');
          }
        });
      });
    });
  }

  // Poll for break updates every second when popup is open
  let breakUpdateInterval = setInterval(updateBreakControls, 1000);

  // Initial load
  loadSettings();

  // Set default tab to general
  document.querySelector('.tab-link[data-tab="general"]').click();
});
