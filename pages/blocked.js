// Get the originally blocked URL from query params
function getBlockedUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('blockedUrl');
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize break controls
    initBreakControls();
    
    fetch('funny_content.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(contentSets => {
            if (!contentSets || contentSets.length === 0) {
                console.error('No content sets found or content is empty.');
                // Optionally, display a default static message if JSON is empty or fails to load
                displayStaticFallback();
                return;
            }

            const randomIndex = Math.floor(Math.random() * contentSets.length);
            const selectedContent = contentSets[randomIndex];

            const mainHeadline = document.getElementById('mainHeadline');
            const introMessage = document.getElementById('introMessage');
            const actionPrompt = document.getElementById('actionPrompt');
            const refocusTipsList = document.getElementById('refocusTipsList');

            if (mainHeadline) mainHeadline.textContent = selectedContent.headline;
            if (introMessage) introMessage.textContent = selectedContent.intro;
            if (actionPrompt) actionPrompt.textContent = selectedContent.actionPrompt;

            if (refocusTipsList && selectedContent.funnyTips && selectedContent.funnyTips.length > 0) {
                refocusTipsList.innerHTML = ''; // Clear existing static tips
                selectedContent.funnyTips.forEach(tip => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = tip; // Using innerHTML to allow for <strong> etc. in tips
                    refocusTipsList.appendChild(listItem);
                });
            } else if (refocusTipsList) {
                // Optionally hide or display default tips if no funnyTips are provided
                refocusTipsList.innerHTML = '<li>Consider taking a short break!</li>'; 
            }
        })
        .catch(error => {
            console.error('Error fetching or processing funny_content.json:', error);
            // Display a static fallback message in case of any error
            displayStaticFallback();
        });
});

function displayStaticFallback() {
    // This function provides a basic static message if the dynamic content fails to load.
    const mainHeadline = document.getElementById('mainHeadline');
    const introMessage = document.getElementById('introMessage');
    const actionPrompt = document.getElementById('actionPrompt');
    const refocusTipsList = document.getElementById('refocusTipsList');

    if (mainHeadline) mainHeadline.textContent = "Time to Refocus!";
    if (introMessage) introMessage.textContent = "Looks like that site is taking a break. Good time to get back on track!";
    if (actionPrompt) actionPrompt.textContent = "Here are some classic refocus tips:";

    if (refocusTipsList) {
        refocusTipsList.innerHTML = ''; // Clear just in case
        const tips = [
            "Take a Short Break: Stand up, stretch, or grab a glass of water.",
            "Review Your Goals: Briefly look at your to-do list for today.",
            "The Pomodoro Technique: Work in focused 25-minute intervals."
        ];
        tips.forEach(tipText => {
            const listItem = document.createElement('li');
            listItem.textContent = tipText;
            refocusTipsList.appendChild(listItem);
        });
    }
}

// === Break Controls ===
function initBreakControls() {
    const breakSection = document.getElementById('breakSection');
    const breakContent = document.getElementById('breakContent');
    
    if (!breakSection || !breakContent) return;
    
    // Load active schedules that have breaks available
    updateBreakUI();
    
    // Poll for updates every second
    setInterval(updateBreakUI, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateBreakUI() {
    const breakSection = document.getElementById('breakSection');
    const breakContent = document.getElementById('breakContent');
    
    chrome.runtime.sendMessage({ action: 'getBreakStatus' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting break info:', chrome.runtime.lastError);
            return;
        }
        
        const status = response || {};
        
        if (status.breakDuration <= 0) {
            breakSection.style.display = 'none';
            return;
        }
        
        breakSection.style.display = 'block';
        let html = '<div class="break-schedule-item">';
        
        if (status.hasActiveBreak) {
            const stateClass = status.isPaused ? 'paused' : 'running';
            const stateText = status.isPaused ? '◆ BREAK PAUSED ◆' : '◆ BREAK ACTIVE ◆';
            
            html += `<div class="break-timer-display ${stateClass}">${formatTime(status.remainingSeconds)}</div>`;
            html += `<span class="break-state-label ${stateClass}">${stateText}</span>`;
            html += `<div class="break-buttons">`;
            
            if (status.isPaused) {
                html += `<button class="break-btn resume" data-action="resume">Resume Break</button>`;
            } else {
                html += `<button class="break-btn pause" data-action="pause">Pause Break</button>`;
            }
            html += `</div>`;
            
        } else if (status.usedToday) {
            html += `<div class="break-used-message">Break already used today</div>`;
            
        } else if (status.canStartBreak) {
            html += `<div class="break-duration-info">You have a ${status.breakDuration} minute break available</div>`;
            html += `<div class="break-buttons">`;
            html += `<button class="break-btn start" data-action="start">Start Break</button>`;
            html += `</div>`;
        }
        
        html += `</div>`;
        
        breakContent.innerHTML = html;
        attachBreakButtonListeners();
    });
}

function attachBreakButtonListeners() {
    const breakContent = document.getElementById('breakContent');
    
    breakContent.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            
            let messageAction = '';
            if (action === 'start') messageAction = 'startBreak';
            else if (action === 'pause') messageAction = 'pauseBreak';
            else if (action === 'resume') messageAction = 'resumeBreak';
            
            chrome.runtime.sendMessage({ action: messageAction }, (response) => {
                if (response && response.success) {
                    // If starting or resuming break, redirect to the originally blocked URL
                    if ((action === 'start' || action === 'resume') && getBlockedUrl()) {
                        window.location.href = getBlockedUrl();
                    } else {
                        updateBreakUI();
                    }
                } else {
                    console.error('Break action failed:', response?.error);
                }
            });
        });
    });
}
