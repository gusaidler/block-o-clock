// Block-O-Clock Break Timer Overlay
// Injected into all web pages to show break countdown

(function() {
  'use strict';

  let overlayContainer = null;
  let updateInterval = null;
  let currentBreakState = null;

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function createOverlay() {
    if (overlayContainer) return;

    overlayContainer = document.createElement('div');
    overlayContainer.id = 'block-o-clock-break-overlay';
    overlayContainer.innerHTML = `
      <div class="boc-overlay-content">
        <div class="boc-header">
          <span class="boc-icon">☕</span>
          <span class="boc-title">BREAK</span>
        </div>
        <div class="boc-timer">00:00</div>
        <div class="boc-status">RUNNING</div>
        <button class="boc-btn boc-pause-btn">Pause</button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
      
      #block-o-clock-break-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
        pointer-events: auto;
      }

      #block-o-clock-break-overlay .boc-overlay-content {
        background: #FFFFFF;
        border: 1px solid #CFEAE6;
        border-radius: 16px;
        padding: 16px 20px;
        box-shadow: 0 2px 10px rgba(15,23,22,.08), 0 18px 48px rgba(15,23,22,.12);
        min-width: 150px;
        text-align: center;
      }

      #block-o-clock-break-overlay .boc-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      #block-o-clock-break-overlay .boc-icon {
        font-size: 14px;
      }

      #block-o-clock-break-overlay .boc-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #1E857B;
        text-transform: uppercase;
      }

      #block-o-clock-break-overlay .boc-timer {
        font-size: 32px;
        font-weight: 700;
        color: #0F1716;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }

      #block-o-clock-break-overlay .boc-status {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #28A69A;
        margin: 4px 0 12px;
        text-transform: uppercase;
      }

      #block-o-clock-break-overlay .boc-btn {
        background: radial-gradient(120% 100% at 50% 0%, #2CB0A4 0%, #249A8F 100%);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-family: 'DM Sans', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2px;
        cursor: pointer;
        transition: all 0.15s ease;
        width: 100%;
        box-shadow: 0 4px 12px rgba(40,166,154,.28);
      }

      #block-o-clock-break-overlay .boc-btn:hover {
        filter: brightness(1.03);
        box-shadow: 0 6px 16px rgba(40,166,154,.35);
      }

      #block-o-clock-break-overlay .boc-btn:active {
        transform: translateY(1px);
      }

      /* Minimized state */
      #block-o-clock-break-overlay.minimized .boc-overlay-content {
        padding: 10px 14px;
        min-width: auto;
        cursor: pointer;
      }

      #block-o-clock-break-overlay.minimized .boc-header,
      #block-o-clock-break-overlay.minimized .boc-status,
      #block-o-clock-break-overlay.minimized .boc-btn {
        display: none;
      }

      #block-o-clock-break-overlay.minimized .boc-timer {
        font-size: 20px;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlayContainer);

    // Attach event listener to pause/resume button
    const btn = overlayContainer.querySelector('.boc-pause-btn');
    btn.addEventListener('click', togglePause);

    // Double-click to minimize/expand
    overlayContainer.addEventListener('dblclick', (e) => {
      if (e.target === btn) return;
      overlayContainer.classList.toggle('minimized');
    });
  }

  function removeOverlay() {
    if (overlayContainer) {
      overlayContainer.remove();
      overlayContainer = null;
    }
  }

  function updateOverlay(breakInfo) {
    if (!overlayContainer) return;

    const timerEl = overlayContainer.querySelector('.boc-timer');
    const statusEl = overlayContainer.querySelector('.boc-status');
    const btnEl = overlayContainer.querySelector('.boc-pause-btn');

    timerEl.textContent = formatTime(breakInfo.remainingSeconds);
    
    if (breakInfo.isPaused) {
      overlayContainer.classList.add('paused');
      statusEl.textContent = 'PAUSED';
      btnEl.textContent = 'Resume';
    } else {
      overlayContainer.classList.remove('paused');
      statusEl.textContent = 'RUNNING';
      btnEl.textContent = 'Pause';
    }

    currentBreakState = breakInfo;
  }

  function togglePause() {
    if (!currentBreakState) return;

    const action = currentBreakState.isPaused ? 'resumeBreak' : 'pauseBreak';
    
    chrome.runtime.sendMessage({ action: action }, (response) => {
      if (response && response.success) {
        // If we just paused, check if current page should be blocked
        if (action === 'pauseBreak') {
          checkIfShouldRedirect();
        } else {
          checkBreakStatus();
        }
      }
    });
  }

  function checkIfShouldRedirect() {
    chrome.runtime.sendMessage({ 
      action: 'checkIfCurrentUrlBlocked', 
      url: window.location.href 
    }, (response) => {
      if (response && response.blocked) {
        // Redirect to blocked page with original URL
        const blockedPageUrl = chrome.runtime.getURL('pages/blocked.html');
        window.location.href = `${blockedPageUrl}?blockedUrl=${encodeURIComponent(window.location.href)}`;
      } else {
        checkBreakStatus();
      }
    });
  }

  function checkBreakStatus() {
    chrome.runtime.sendMessage({ action: 'getActiveBreakForOverlay' }, (response) => {
      if (chrome.runtime.lastError) {
        // Extension context invalidated, stop polling
        stopPolling();
        removeOverlay();
        return;
      }

      if (response && response.hasActiveBreak && !response.isPaused) {
        if (!overlayContainer) {
          createOverlay();
        }
        updateOverlay(response);
      } else {
        removeOverlay();
      }
    });
  }

  function startPolling() {
    if (updateInterval) return;
    checkBreakStatus();
    updateInterval = setInterval(checkBreakStatus, 1000);
  }

  function stopPolling() {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  // Start polling when script loads
  startPolling();

  // Listen for visibility changes to pause/resume polling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });
})();
