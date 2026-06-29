// --- 1. Runtime Context Installation (Your original logic) ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([
        'blockedChannels', 'fallbackChannels', 'alwaysSkipLiveChannels',
        'blockedTags', 'blockedWords', 'runConfig', 'allowedLanguages', 'useBrowserLanguage'
    ], (result) => {
        const defaultSettings = {};
        if (result.blockedChannels === undefined) defaultSettings.blockedChannels = [];
        if (result.fallbackChannels === undefined) defaultSettings.fallbackChannels = [];
        if (result.alwaysSkipLiveChannels === undefined) defaultSettings.alwaysSkipLiveChannels = [];
        if (result.blockedTags === undefined) defaultSettings.blockedTags = [];
        if (result.blockedWords === undefined) defaultSettings.blockedWords = [];
        if (result.useBrowserLanguage === undefined) defaultSettings.useBrowserLanguage = false;
        if (result.allowedLanguages === undefined) defaultSettings.allowedLanguages = ['en'];
        if (result.runConfig === undefined) {
            defaultSettings.runConfig = { enabled: false, start: "22:00", end: "06:00" };
        }

        if (Object.keys(defaultSettings).length > 0) {
            chrome.storage.local.set(defaultSettings, () => {
                console.log('[Skipper Background] Default configurations initialized.');
            });
        }
    });
});

// --- 2. State Tracking for Active Video ---
let activePlayingTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Listen for updates from content scripts
    if (message.action === "UPDATE_STATUS") {
        if (message.playing) {
            activePlayingTabId = sender.tab.id;
            console.log(`[Skipper] Tab ${activePlayingTabId} is now playing.`);
        } else if (activePlayingTabId === sender.tab.id) {
            activePlayingTabId = null;
        }
    }
});

// Clear tracking if the tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (activePlayingTabId === tabId) {
        activePlayingTabId = null;
    }
});

// --- 3. Targeted Logic Executor ---
/**
 * Call this function whenever you want to trigger your core logic.
 * It will only execute on the tab currently playing a video.
 */
async function runLogicOnActivePlayer() {
    if (!activePlayingTabId) {
        console.log("[Skipper] No active playing tab found.");
        return;
    }

    try {
        await chrome.tabs.sendMessage(activePlayingTabId, { action: "RUN_CORE_LOGIC" });
        console.log(`[Skipper] Logic sent to tab ${activePlayingTabId}`);
    } catch (err) {
        console.warn("[Skipper] Could not reach content script (it may have been closed).", err);
        activePlayingTabId = null; // Reset state if connection failed
    }
}