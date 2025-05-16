# Block-O-Clock Chrome Extension

## Description

Block-O-Clock is a Chrome extension designed to help you stay focused by blocking specific websites and URL keywords based on a schedule or an always-on list. Take control of your browsing habits and minimize distractions during work or study sessions.

## Features

*   **Always-On Blocking**: Block specified URLs or keywords at all times.
*   **Scheduled Blocking**:
    *   Create custom schedules (e.g., "Work Hours", "Study Time").
    *   Define active days of the week for each schedule.
    *   Set start and end times for blocking.
    *   Assign specific URLs and keywords to be blocked only during that schedule.
*   **URL & Keyword Blocking**:
    *   Block entire websites by adding their URL (e.g., `example.com`).
    *   Block pages containing specific keywords in their URL (e.g., "social", "gaming").
*   **Customizable Redirects**:
    *   Set a global redirect URL for all blocked content.
    *   Optionally, specify a different redirect URL for each schedule.
    *   Default blocked page (`pages/blocked.html`) offers refocusing tips and productive links.
*   **User-Friendly Interface**:
    *   Manage settings easily through the extension popup.
    *   Tabbed navigation for "General" (always-on) blocking, "Schedules", and global "Settings".
    *   Intuitive forms for adding/removing blocked items and configuring schedules.
*   **Persistent Settings**: Your blocking rules and schedules are saved locally.

## Installation

1.  **Download or Clone the Repository**:
    *   If you have a ZIP file, extract it to a folder on your computer.
    *   If you have Git, clone the repository: `git clone <repository-url>`
2.  **Open Chrome Extensions**:
    *   Open Google Chrome.
    *   Navigate to `chrome://extensions/`.
3.  **Enable Developer Mode**:
    *   In the top right corner of the Extensions page, toggle "Developer mode" ON.
4.  **Load Unpacked Extension**:
    *   Click the "Load unpacked" button that appears.
    *   Select the folder where you extracted or cloned the extension files (the folder containing `manifest.json`).
5.  **Done!** Block-O-Clock should now be installed and visible in your Chrome extensions list and toolbar.

## How to Use

1.  **Open the Popup**: Click the Block-O-Clock icon in your Chrome toolbar.
2.  **General Tab (Always-On Blocking)**:
    *   **Add URL**: Enter a full or partial URL (e.g., `youtube.com`, ` distracting-site.org/feed`) and click "Add URL".
    *   **Add Keyword**: Enter a keyword (e.g., `news`, `socialmedia`) and click "Add Keyword". URLs containing this keyword will be blocked.
    *   Blocked items will appear in a list below, where you can remove them.
3.  **Schedules Tab**:
    *   **Create New Schedule**: Click "Create New Schedule".
        *   **Schedule Name**: Give your schedule a descriptive name (e.g., "Morning Focus").
        *   **Active Days**: Select the days of the week for this schedule.
        *   **Start Time / End Time**: Set the time range for blocking.
        *   **Redirect to (optional)**: Specify a custom redirect URL for this schedule. If left blank, the global redirect URL will be used.
        *   **Blocked Content for this Schedule**: Add URLs and keywords specific to this schedule.
        *   Click "Save Schedule".
    *   Existing schedules will be listed. You can **Edit** or **Delete** them.
4.  **Settings Tab**:
    *   **Global Redirect URL**: Set the default URL to redirect to when a site is blocked (and no schedule-specific redirect applies). The default is `pages/blocked.html` within the extension.
    *   Click "Set Global Redirect".

When you try to navigate to a blocked site or a URL matching a blocked keyword during an active blocking period, you will be redirected to the configured redirect URL.

## Key Components

*   `manifest.json`: Defines the extension's properties, permissions, and core files.
*   `background.js`: The service worker that handles all the blocking logic, listens for navigation events, manages schedules, and stores/retrieves settings from `chrome.storage`.
*   `popup/`: Contains the HTML, CSS, and JavaScript for the extension's user interface.
    *   `popup.html`: Structure of the popup.
    *   `popup.css`: Styles for the popup.
    *   `popup.js`: Handles user interactions within the popup, saving settings, and communicating with `background.js`.
*   `pages/`:
    *   `blocked.html`: The default page displayed when a site is blocked. It includes tips for refocusing and links to productive resources.
*   `images/`: Contains icons for the extension.

## Potential Future Enhancements

*   Allow whitelisting of specific subdomains or pages within a blocked domain.
*   Import/Export of blocking lists and schedules.
*   "Strict mode" to prevent unblocking during active schedules.
*   Customizable block page themes or messages.
*   Statistics on blocked attempts.
*   Password protection for settings.
*   Temporary unblock / "focus break" timer.

## Contributing

Contributions are welcome! If you have ideas for improvements or find any bugs, please feel free to open an issue or submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details (if one is created). 