// Runtime Context Installation Initialization Entrypoint
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([
        'blockedChannels',
        'fallbackChannels',
        'alwaysSkipLiveChannels',
        'blockedTags',
        'blockedWords',
        'runConfig',
        'allowedLanguages',
        'useBrowserLanguage'
    ], (result) => {
        const defaultSettings = {};

        // Only set values if they do not already exist in storage
        if (result.blockedChannels === undefined) defaultSettings.blockedChannels = [];
        if (result.fallbackChannels === undefined) defaultSettings.fallbackChannels = [];
        if (result.alwaysSkipLiveChannels === undefined) defaultSettings.alwaysSkipLiveChannels = [];
        if (result.blockedTags === undefined) defaultSettings.blockedTags = [];
        if (result.blockedWords === undefined) defaultSettings.blockedWords = [];
        if (result.useBrowserLanguage === undefined) defaultSettings.useBrowserLanguage = false;

        if (result.allowedLanguages === undefined) {
            defaultSettings.allowedLanguages = ['en'];
        }

        if (result.runConfig === undefined) {
            defaultSettings.runConfig = {
                enabled: false,
                start: "22:00",
                end: "06:00"
            };
        }

        // Commit missing defaults to engine storage structures safely
        if (Object.keys(defaultSettings).length > 0) {
            chrome.storage.local.set(defaultSettings, () => {
                console.log('[Skipper Background] Default baseline configurations initialized safely.');
            });
        }
    });
});