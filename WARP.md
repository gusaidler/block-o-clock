# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
Block-O-Clock is a Chrome Manifest V3 extension that helps users stay focused by blocking websites and URL keywords based on schedules or always-on rules. The extension uses a service worker architecture and stores all settings in Chrome's local storage.

## Core Architecture

### Service Worker Model
- `background.js`: The central service worker that handles all blocking logic, navigation interception, and storage management
- Listens to `chrome.webNavigation.onBeforeNavigate` events to intercept and redirect blocked URLs
- Maintains in-memory state synchronized with `chrome.storage.local`

### Storage Schema
The extension uses three main data structures in `chrome.storage.local`:

1. **blockedSites** (Array): `[{ type: 'url' | 'keyword', value: string }]`
   - Always-on blocking rules not tied to schedules
   - URL type: matches full or partial domain patterns
   - Keyword type: matches any URL containing the substring

2. **schedules** (Array): Schedule objects with structure:
   ```
   {
     name: string,
     days: number[],  // 0-6 (Sunday-Saturday)
     timeIntervals: [{ startTime: 'HH:MM', endTime: 'HH:MM' }],
     sites: string[],
     keywords: string[],
     redirectUrl: string
   }
   ```
   - Legacy data may have single `startTime`/`endTime` fields instead of `timeIntervals`
   - `redirectUrl` empty string means use global redirect

3. **globalRedirectUrl**: Default redirect destination (default: `pages/blocked.html`)

### URL Matching Logic
The `matchesPattern` function in `background.js` uses regex-based domain matching:
- Escapes special regex characters in patterns
- Matches domains with optional `www.` prefix: `^(www\.)?{pattern}(\/|$)`
- Falls back to substring matching for malformed URLs or keywords
- Example: Pattern `x.com` matches `x.com` and `www.x.com` but NOT `electrolux.com`

### Dynamic Redirect Content
The blocked page (`pages/blocked.html`) displays randomized content:
- `blocked.js` fetches from `funny_content.json` on page load
- Content includes themed headlines, intro messages, action prompts, and tips
- Fallback to static content if JSON fetch fails

## Development Commands

### Testing the Extension
1. Navigate to `chrome://extensions/` in Chrome
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select this repository folder
4. After code changes, click the refresh icon on the extension card

### Debugging
- **Service Worker Console**: `chrome://extensions/` → "Inspect views: service worker"
- **Popup Console**: Right-click extension icon → Inspect
- **Blocked Page Console**: Open blocked page → F12 DevTools

### File Structure
```
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main logic)
├── popup/
│   ├── popup.html        # UI structure
│   ├── popup.js          # UI logic and storage interface
│   └── popup.css         # Styling
├── pages/
│   ├── blocked.html      # Redirect page
│   ├── blocked.js        # Dynamic content loader
│   ├── funny_content.json # Redirect page content variations
│   └── content_not_available.gif
└── images/               # Extension icons
```

## Key Implementation Details

### Time Comparison
- All time comparisons use 24-hour string format: `HH:MM`
- Current time: `getCurrentTime()` returns zero-padded string
- Interval matching uses simple string comparison: `currentTime >= startTime && currentTime < endTime`

### Schedule Day Indexing
- Sunday = 0, Monday = 1, ..., Saturday = 6
- Checkbox values in popup: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0

### Message Passing
- Popup sends `{ action: 'updateSettings', settings: {...} }` to background script
- Background script responds with `{ status: 'success' }`
- Use `chrome.runtime.onMessage.addListener` with `return true` for async responses

### Redirect Loop Prevention
- Background script checks if target URL is already the redirect URL
- Also checks if target already includes the internal blocked page path
- Allows navigation if either condition is true

## Code Patterns to Follow

### Adding New Schedule Fields
1. Update the schedule object structure in both `background.js` and `popup.js` comments
2. Modify `openScheduleForm()` to populate new fields when editing
3. Update `saveScheduleBtn` event handler to capture new fields
4. Ensure `renderSchedules()` displays the new field
5. Consider backward compatibility with existing stored schedules

### URL Pattern Matching Changes
- Always test the `matchesPattern` helper function in `background.js`
- Ensure keyword matching remains substring-based (not regex)
- Test edge cases: subdomains, paths, malformed URLs

### Storage Updates
- Always call `saveSettings()` in popup.js after modifying data structures
- This triggers `chrome.runtime.sendMessage` to notify background script
- Background script then updates `chrome.storage.local` and its in-memory state

### UI State Management
- Use `renderBlockedItems()`, `renderSchedules()`, and `renderScheduleSpecificItems()` after data changes
- Clear input fields after adding items
- Use `closeScheduleForm()` to reset form state completely

## Common Gotchas
- Service workers don't persist state across restarts; always reload from storage on startup
- The `webNavigation` listener only acts on `frameId === 0` (top-level navigation)
- Time intervals must have `startTime < endTime` (validation in popup.js)
- Schedules require at least one day and one time interval
- Extension paths like `pages/blocked.html` need `chrome.runtime.getURL()` for absolute URLs
