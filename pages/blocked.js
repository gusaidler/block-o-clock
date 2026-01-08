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
            const funnyImage = document.getElementById('funnyImage');
            const refocusTipsList = document.getElementById('refocusTipsList');

            if (mainHeadline) mainHeadline.textContent = selectedContent.headline;
            if (introMessage) introMessage.textContent = selectedContent.intro;
            if (actionPrompt) actionPrompt.textContent = selectedContent.actionPrompt;
            if (funnyImage && selectedContent.image) {
                funnyImage.src = selectedContent.image;
                funnyImage.alt = selectedContent.headline; // Use headline as alt text
                funnyImage.style.display = 'block';
            } else if (funnyImage) {
                funnyImage.style.display = 'none'; // Hide if no image URL
            }

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
    const funnyImage = document.getElementById('funnyImage');

    if (mainHeadline) mainHeadline.textContent = "Time to Refocus!";
    if (introMessage) introMessage.textContent = "Looks like that site is taking a break. Good time to get back on track!";
    if (actionPrompt) actionPrompt.textContent = "Here are some classic refocus tips:";
    if (funnyImage) funnyImage.style.display = 'none'; // Hide image on fallback

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
    
    chrome.runtime.sendMessage({ action: 'getActiveSchedulesForBreak' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting break info:', chrome.runtime.lastError);
            return;
        }
        
        const activeSchedules = response || [];
        
        if (activeSchedules.length === 0) {
            breakSection.style.display = 'none';
            return;
        }
        
        breakSection.style.display = 'block';
        let html = '';
        
        for (const schedule of activeSchedules) {
            html += `<div class="break-schedule-item" data-index="${schedule.index}">`;
            html += `<span class="break-schedule-name">${schedule.name}</span>`;
            
            if (schedule.hasActiveBreak) {
                // Break is active - show timer and controls
                const stateClass = schedule.isPaused ? 'paused' : 'running';
                const stateText = schedule.isPaused ? '◆ BREAK PAUSED ◆' : '◆ BREAK ACTIVE ◆';
                
                html += `<div class="break-timer-display ${stateClass}">${formatTime(schedule.remainingSeconds)}</div>`;
                html += `<span class="break-state-label ${stateClass}">${stateText}</span>`;
                html += `<div class="break-buttons">`;
                
                if (schedule.isPaused) {
                    html += `<button class="break-btn resume" data-action="resume" data-index="${schedule.index}">Resume Break</button>`;
                } else {
                    html += `<button class="break-btn pause" data-action="pause" data-index="${schedule.index}">Pause Break</button>`;
                }
                html += `</div>`;
                
            } else if (schedule.usedToday) {
                // Break was already used today
                html += `<div class="break-used-message">Break already used today for this schedule</div>`;
                
            } else if (schedule.canStartBreak) {
                // Break available to start
                html += `<div class="break-duration-info">You have a ${schedule.breakDuration} minute break available</div>`;
                html += `<div class="break-buttons">`;
                html += `<button class="break-btn start" data-action="start" data-index="${schedule.index}">Start Break</button>`;
                html += `</div>`;
            }
            
            html += `</div>`;
        }
        
        breakContent.innerHTML = html;
        attachBreakButtonListeners();
    });
}

function attachBreakButtonListeners() {
    const breakContent = document.getElementById('breakContent');
    
    breakContent.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index);
            
            let messageAction = '';
            if (action === 'start') messageAction = 'startBreak';
            else if (action === 'pause') messageAction = 'pauseBreak';
            else if (action === 'resume') messageAction = 'resumeBreak';
            
            chrome.runtime.sendMessage({ action: messageAction, scheduleIndex: index }, (response) => {
                if (response && response.success) {
                    updateBreakUI();
                } else {
                    console.error('Break action failed:', response?.error);
                }
            });
        });
    });
}
