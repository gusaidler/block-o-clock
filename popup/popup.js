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
  const startTimeInput = document.getElementById('startTime');
  const endTimeInput = document.getElementById('endTime');
  const scheduleRedirectUrlInput = document.getElementById('scheduleRedirectUrl');
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

    if (schedule) {
      scheduleFormTitle.textContent = 'Edit';
      scheduleNameInput.value = schedule.name;
      Object.values(dayCheckboxes).forEach(cb => cb.checked = false); // Reset
      schedule.days.forEach(dayVal => {
        const dayCheckbox = Object.values(dayCheckboxes).find(cb => parseInt(cb.value) === dayVal);
        if(dayCheckbox) dayCheckbox.checked = true;
      });
      startTimeInput.value = schedule.startTime;
      endTimeInput.value = schedule.endTime;
      scheduleRedirectUrlInput.value = schedule.redirectUrl || '';
      currentScheduleSites = [...(schedule.sites || [])];
      currentScheduleKeywords = [...(schedule.keywords || [])];
    } else {
      scheduleFormTitle.textContent = 'Add New';
      scheduleNameInput.value = '';
      Object.values(dayCheckboxes).forEach(cb => cb.checked = false);
      startTimeInput.value = '09:00';
      endTimeInput.value = '17:00';
      scheduleRedirectUrlInput.value = '';
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
    startTimeInput.value = '';
    endTimeInput.value = '';
    scheduleRedirectUrlInput.value = '';
    currentScheduleSites = [];
    currentScheduleKeywords = [];
    renderScheduleSpecificItems(); 
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
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const scheduleRedirect = scheduleRedirectUrlInput.value.trim();

    if (!name || !startTime || !endTime) {
      alert('Please fill in schedule name, start time, and end time.');
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
      startTime,
      endTime,
      sites: [...currentScheduleSites],
      keywords: [...currentScheduleKeywords],
      redirectUrl: scheduleRedirect || '' // Empty string means use global
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
      div.innerHTML = `
        <strong>${schedule.name}</strong> (${schedule.startTime} - ${schedule.endTime})<br>
        Days: ${schedule.days.map(d => Object.keys(dayCheckboxes)[Object.values(dayCheckboxes).findIndex(cb => parseInt(cb.value) === d)] || 'N/A').join(', ')}<br>
        Sites: ${schedule.sites.length}, Keywords: ${schedule.keywords.length}<br>
        Redirect: ${schedule.redirectUrl || 'Global'}
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

  // Initial load
  loadSettings();

  // Set default tab to general
  document.querySelector('.tab-link[data-tab="general"]').click();
}); 