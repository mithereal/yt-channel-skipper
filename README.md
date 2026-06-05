
# YouTube Live Bypass Filter (YT Channel Skipper)

A smart, theme-adaptive Chrome extension built to automatically fast-forward through videos from unwanted creators or seamlessly reroute live streams to a selection of curated fallback channels during specific timeframes.

---

## 🚀 Key Features

- **Instant Video Auto-Skipping**: Detects configured channels on long-form `/watch` pages and immediately fast-forwards the video to its end sequence, skipping it entirely.
- **Smart Live Stream Redirection**: If an unwanted channel goes **LIVE** during your custom restriction hours, the extension dynamically selects a random fallback channel from your library, navigates to its video directory, and loads a random long-form video.
- **Native YouTube Integration**: Adds interactive custom overlay options (**🚫 Block Channel** and **⭐ Add as Fallback**) directly into YouTube's native 3-dot options menu wrapper dynamically via MutationObservers.
- **Theme-Adaptive Popup Layout**: Features a compact browser action layout that matches your system or browser preferences seamlessly, supporting native dark and light modes. Includes quick block triggers and a rotatable options gateway.
- **Advanced Centralized Configuration Grid**: A fully custom matrix selection grid for granular hour/minute configuration, bulk channel text areas, and safety sanitization rules (such as automatic removal of prefixing `@` rules for handles).
- **Data Portability**: Complete control over configurations with dedicated local storage backup tools allowing one-click **JSON Export** and **JSON Import**.
- **Absolute Live Bypass (Always Skip)**: A dedicated override list for channels that should *always* trigger fallback redirection when live—completely ignoring time restriction configurations.

---

## 🛠️ Installation Guide

Because this extension is tailored for specialized channel routing rules, it can be loaded instantly as an unpacked developer utility:

1. **Download/Extract the Extension**: Download or clone the directory containing the extension files (`manifest.json`, `content.js`, `popup.html`, `options.html`, etc.) and unpack them onto your machine.
2. **Open Extensions Panel**: Launch Google Chrome or a Chromium-based browser and navigate to `chrome://extensions/`.
3. **Enable Developer Mode**: Flip the toggle switch labeled **Developer mode** in the upper right-hand corner of the page.
4. **Load Unpacked**: Click the **Load unpacked** button visible in the top-left section.
5. **Select Directory**: Navigate to and select the root directory containing the extension assets.

---

## ⚙️ Configuration & Usage

### 1. Context Menus on YouTube
When browsing YouTube or viewing an active stream, click on the standard native 3-dot options panel. The extension adds t options at the bottom of the list box:
* **Block Channel**: Automatically extracts the creator name and appends it to your instant block list.
* **Add as Fallback**: Extracts the channel name appends it to your fallback list
### 2. Time-Restriction Hours Matrix
Accessible by clicking the spinning option gear (`⚙`) in the bottom right corner of the extension popup window:
* **Interval Coordinates**: Pick start and end execution periods using the interactive 24-hour block tiles and 10-minute interval sliders.
* **Overnight Spans Supported**: The scheduling logic handles cross-day transitions perfectly (e.g., an overnight block window starting at `22:00` and ending at `06:00`).
* **Always Skip Live Channels**: A separate text block dedicated to channels that must be intercepted and rerouted any time they are live, regardless of the active schedule.

### 3. Fallback Layouts & Storage Sync
* Textarea line editors allow you to bulk edit block rules (one channel per line).
* Fallbacks are recorded cleanly (e.g., typing `LofiGirl` instead of `@LofiGirl`).
---

## 📁 File Structure Overview

* **`manifest.json`**: Configures Manifest V3 parameters, defines background extension boundaries, isolated execution rules matching `*://*.youtube.com/*`, and security permissions layout (`storage`).
* **`content.js`**: Houses the background monitoring framework, video duration bypass loops, YouTube Single Page Application SPA hook bindings (`yt-navigate-finish`), DOM web-scrapers, and menu injector nodes.
* **`popup.html` / `popup.js`**: Provides the responsive toolbar UI which respects layout variables (`prefers-color-scheme`), quick switch state synchronization via `chrome.storage.onChanged`, and entry deduplication.
* **`options.html` / `options.js`**: Serves up the centered configuration suite, hosting flexbox panels, responsive data forms, cell matrices, and file-parsing filters.

---

## 📄 License

This project is open-source and free to use. Modify, extend, and adapt!