let blockedChannels = [];
let fallbackChannels = [];
let alwaysSkipLiveChannels = [];
let runConfig = { enabled: false, start: "22:00", end: "06:00" };
let isNavigatingToRandom = false;
let isRedirecting = false;
let extensionEnabled = true;
let blockedTags = [];
let blockedWords = [];
let allowedLanguages = ['en'];

// --- STORAGE SYNC ---
chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedChannels) blockedChannels = changes.blockedChannels.newValue || blockedChannels;
    if (changes.fallbackChannels) fallbackChannels = changes.fallbackChannels.newValue || fallbackChannels;
    if (changes.runConfig) runConfig = changes.runConfig.newValue || runConfig;
    if (changes.blockedTags) blockedTags = changes.blockedTags.newValue || blockedTags;
    if (changes.blockedWords) blockedWords = changes.blockedWords.newValue || blockedWords;
    if (changes.alwaysSkipLiveChannels) alwaysSkipLiveChannels = changes.alwaysSkipLiveChannels.newValue || alwaysSkipLiveChannels;
    if (changes.allowedLanguages) allowedLanguages = changes.allowedLanguages.newValue || allowedLanguages;
    if (changes.extensionEnabled) extensionEnabled = changes.extensionEnabled.newValue !== undefined ? changes.extensionEnabled.newValue : extensionEnabled;
});

// --- UTILITIES ---
const isExtensionActive = () => extensionEnabled && isWithinRunnableHours();

const randomWait = (min = 2000, max = 5000) =>
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

async function waitForElements(selector, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return elements;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return [];
}

function isWithinRunnableHours() {
    if (!runConfig.enabled) return true; // If scheduling is disabled, consider hours "active"
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = runConfig.start.split(':').map(Number);
    const [endH, endM] = runConfig.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return startMinutes <= endMinutes
        ? (currentMinutes >= startMinutes && currentMinutes <= endMinutes)
        : (currentMinutes >= startMinutes || currentMinutes <= endMinutes);
}

// --- CORE LOGIC ---
function isSubscribed() {
    const subButton = document.querySelector('ytd-subscribe-button-renderer paper-button');
    if (!subButton) return false;
    const label = subButton.getAttribute('aria-label')?.toLowerCase() || "";
    return subButton.hasAttribute('subscribed') || label.includes('unsubscribe');
}

function startAutoplayMonitor() {
    const observer = new MutationObserver(() => {
        if (!isExtensionActive()) return;
        const autoplaySwitch = document.querySelector('.ytp-autonav-toggle-button');
        // Logic: Turn OFF autoplay if it's currently ON
        if (autoplaySwitch && autoplaySwitch.getAttribute('aria-checked') === 'true') {
            autoplaySwitch.click();
        }
    });
    const player = document.querySelector('#movie_player');
    if (player) observer.observe(player, { attributes: true, subtree: true });
}

async function redirectToFallbackChannel() {
    if (isRedirecting) return;
    isRedirecting = true;
    await randomWait(1000, 2500);
    const target = fallbackChannels.length > 0
        ? `https://www.youtube.com/@${fallbackChannels[Math.floor(Math.random() * fallbackChannels.length)].replace(/^@/, '').trim()}/videos`
        : 'https://www.youtube.com/';
    window.location.assign(target);
    setTimeout(() => { isRedirecting = false; }, 5000);
}

// --- INITIALIZATION ---
chrome.storage.local.get(['blockedChannels', 'fallbackChannels', 'blockedTags', 'blockedWords', 'runConfig', 'alwaysSkipLiveChannels', 'allowedLanguages', 'extensionEnabled'], (result) => {
    if (result.blockedChannels) blockedChannels = result.blockedChannels;
    if (result.fallbackChannels) fallbackChannels = result.fallbackChannels;
    if (result.runConfig) runConfig = result.runConfig;
    if (result.extensionEnabled !== undefined) extensionEnabled = result.extensionEnabled;
    startAutoplayMonitor();
});

// --- NAVIGATION & BLOCKING ---
async function playRandomChannelVideo() {
    if (!isExtensionActive() || isNavigatingToRandom || isRedirecting) return;
    const videos = await waitForElements('a#video-title-link, ytd-rich-grid-media a[href*="/watch?v="]');
    const longForm = Array.from(videos).filter(el => !el.href.includes('/shorts/'));
    if (longForm.length > 0) {
        isNavigatingToRandom = true;
        await randomWait(1500, 3000);
        longForm[Math.floor(Math.random() * longForm.length)].click();
    }
}

async function checkAndSkipVideo() {
    if (!isExtensionActive() || isRedirecting || !window.location.pathname.includes('/watch')) {
        if (isExtensionActive() && (window.location.pathname === '/' || window.location.pathname.includes('/videos'))) playRandomChannelVideo();
        return;
    }

    // IGNORE if subscribed
    if (isSubscribed()) return;

    const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
    if (!channelElement) { setTimeout(checkAndSkipVideo, 1000); return; }

    if (blockedChannels.includes(channelElement.textContent.trim())) {
        if (document.querySelector('.ytp-live')) {
            await redirectToFallbackChannel();
        } else {
            const video = document.querySelector('video');
            if (video) video.currentTime = video.duration || 999999;
        }
    }
}

document.addEventListener('yt-navigate-finish', () => {
    isNavigatingToRandom = false;
    isRedirecting = false;
    setTimeout(checkAndSkipVideo, 1500);
});

setInterval(() => {
    if (isExtensionActive() && !isRedirecting && (window.location.pathname === '/' || window.location.pathname.includes('/videos'))) {
        playRandomChannelVideo();
    }
}, 5000);

// --- MENU INJECTION ---
const observer = new MutationObserver(() => {
    const popup = document.querySelector('ytd-menu-popup-renderer #items');
    if (popup && popup.offsetParent !== null && !document.getElementById('custom-block-btn')) {
        const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
        if (channelElement) {
            const btn = document.createElement('div');
            btn.id = 'custom-block-btn';
            btn.setAttribute('style', `cursor: pointer; padding: 10px 16px;`);
            btn.innerHTML = `<span>🚫</span> Block Channel`;
            btn.onclick = (e) => { e.stopPropagation(); blockedChannels.push(channelElement.textContent.trim()); chrome.storage.local.set({ blockedChannels }); document.body.click(); };
            popup.appendChild(btn);
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });