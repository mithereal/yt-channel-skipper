let blockedChannels = [];
let fallbackChannels = [];
let alwaysSkipLiveChannels = [];
let runConfig = { enabled: false, start: "22:00", end: "06:00" };
let isNavigatingToRandom = false;
let isRedirecting = false;
let blockedTags = [];
let blockedWords = [];
let allowedLanguages = ['en'];
let isActive = true; // State-gate for multi-tab prevention

// --- TAB STATE MANAGEMENT ---
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "SET_STATE") {
        isActive = request.enabled;
        console.log(`[Skipper] Tab state updated: ${isActive ? "ACTIVE" : "SUSPENDED"}`);
    }
});

// --- UTILITIES ---
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

// --- AUTOPLAY MANAGEMENT ---
function isAutoplayEnabled() {
    const autoplaySwitch = document.querySelector('.ytp-autonav-toggle-button');
    return autoplaySwitch && autoplaySwitch.getAttribute('aria-checked') === 'true';
}

function startAutoplayMonitor() {
    const observer = new MutationObserver(() => {
        if (!isActive || !runConfig.enabled || !isWithinRunnableHours()) return;
        const autoplaySwitch = document.querySelector('.ytp-autonav-toggle-button');
        if (autoplaySwitch && autoplaySwitch.getAttribute('aria-checked') === 'true') {
            autoplaySwitch.click();
        }
    });
    const player = document.querySelector('#movie_player');
    if (player) observer.observe(player, { attributes: true, subtree: true });
}

function isWithinRunnableHours() {
    if (!runConfig.enabled) return false;
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

// --- CORE ACTION ENGINE ---
async function redirectToFallbackChannel() {
    if (!isActive || isRedirecting) return;
    isRedirecting = true;

    await randomWait(1000, 2500);
    const target = fallbackChannels.length > 0
        ? `https://www.youtube.com/@${fallbackChannels[Math.floor(Math.random() * fallbackChannels.length)].replace(/^@/, '').trim()}/videos`
        : 'https://www.youtube.com/';
    window.location.assign(target);
    setTimeout(() => { isRedirecting = false; }, 5000);
}

// --- INITIALIZATION ---
chrome.storage.local.get(['blockedChannels', 'fallbackChannels', 'blockedTags', 'blockedWords', 'runConfig', 'alwaysSkipLiveChannels', 'allowedLanguages'], (result) => {
    blockedChannels = result.blockedChannels || [];
    fallbackChannels = result.fallbackChannels || [];
    blockedTags = result.blockedTags || [];
    blockedWords = result.blockedWords || [];
    alwaysSkipLiveChannels = result.alwaysSkipLiveChannels || [];
    runConfig = result.runConfig || { enabled: false, start: "22:00", end: "06:00" };
    startAutoplayMonitor();
});

// --- NAVIGATION ---
async function playRandomChannelVideo() {
    if (isNavigatingToRandom || isRedirecting) return;
    const videos = await waitForElements('a#video-title-link, ytd-rich-grid-media a[href*="/watch?v="]');
    const longForm = Array.from(videos).filter(el => !el.href.includes('/shorts/'));
    if (longForm.length > 0) {
        isNavigatingToRandom = true;
        await randomWait(1500, 3000);
        longForm[Math.floor(Math.random() * longForm.length)].click();
    }
}

async function checkAndSkipVideo() {
    if (isRedirecting || !window.location.pathname.includes('/watch')) {
        if (window.location.pathname === '/' || window.location.pathname.includes('/videos')) playRandomChannelVideo();
        return;
    }

    // Respect user Autoplay toggle
    if (isAutoplayEnabled()) return;

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
    if (!isRedirecting && (window.location.pathname === '/' || window.location.pathname.includes('/videos'))) {
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