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

// --- 1. TARGETED COMMAND LISTENER ---
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "RUN_CORE_LOGIC") {
        checkAndSkipVideo();
    }
});

// --- 2. VIDEO STATUS REPORTER ---
const video = document.querySelector('video');
if (video) {
    const notify = (isPlaying) => {
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", playing: isPlaying });
    };
    video.addEventListener('play', () => notify(true));
    video.addEventListener('pause', () => notify(false));
    if (!video.paused) notify(true);
}

// --- 3. STORAGE SYNC ---
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

// --- 4. CORE UTILITIES ---
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
    if (!runConfig.enabled) return true;
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

// --- 5. AUTOPLAY MONITOR (RESTORED) ---
const randomDelay = (min = 2000, max = 8000) =>
    Math.floor(Math.random() * (max - min + 1) + min);

function startAutoplayMonitor() {
    const observer = new MutationObserver(() => {
        if (!isExtensionActive()) return;

        const autoplaySwitch = document.querySelector('.ytp-autonav-toggle-button');

        if (autoplaySwitch && autoplaySwitch.getAttribute('aria-checked') === 'false') {
            // Instead of clicking immediately, wait for a random interval
            const waitTime = randomDelay(3000, 10000); // Wait between 3 to 10 seconds

            console.log(`[Skipper] Autoplay detected OFF. Activating in ${waitTime}ms`);

            setTimeout(() => {
                // Re-verify it's still OFF before clicking
                if (autoplaySwitch.getAttribute('aria-checked') === 'false') {
                    autoplaySwitch.click();
                }
            }, waitTime);
        }
    });

// --- 6. SKIPPER & NAVIGATION LOGIC ---
function isSubscribed() {
    const subButton = document.querySelector('ytd-subscribe-button-renderer paper-button');
    if (!subButton) return false;
    const label = subButton.getAttribute('aria-label')?.toLowerCase() || "";
    return subButton.hasAttribute('subscribed') || label.includes('unsubscribe');
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
    if (!isExtensionActive() || isRedirecting) return;

    if (window.location.pathname === '/' || window.location.pathname.includes('/videos')) {
        await playRandomChannelVideo();
        return;
    }

    if (window.location.pathname.includes('/watch')) {
        if (isSubscribed()) return;
        const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
        if (!channelElement) return;

        if (blockedChannels.includes(channelElement.textContent.trim())) {
            if (document.querySelector('.ytp-live') && alwaysSkipLiveChannels.includes(channelElement.textContent.trim())) {
                await redirectToFallbackChannel();
            } else {
                const video = document.querySelector('video');
                if (video) video.currentTime = video.duration || 999999;
            }
        }
    }
}

// --- 7. INITIALIZATION & OBSERVERS ---
chrome.storage.local.get([
    'blockedChannels', 'fallbackChannels', 'alwaysSkipLiveChannels', 'blockedTags',
    'blockedWords', 'runConfig', 'allowedLanguages', 'extensionEnabled'
], (result) => {
    blockedChannels = result.blockedChannels || [];
    fallbackChannels = result.fallbackChannels || [];
    alwaysSkipLiveChannels = result.alwaysSkipLiveChannels || [];
    blockedTags = result.blockedTags || [];
    blockedWords = result.blockedWords || [];
    runConfig = result.runConfig || runConfig;
    allowedLanguages = result.allowedLanguages || ['en'];
    extensionEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true;

    // Start the monitor
    startAutoplayMonitor();

    document.addEventListener('yt-navigate-finish', () => {
        isNavigatingToRandom = false;
        isRedirecting = false;
        setTimeout(checkAndSkipVideo, 1500);
    });
});

const observer = new MutationObserver(() => {
    const popup = document.querySelector('ytd-menu-popup-renderer #items');
    if (popup && popup.offsetParent !== null && !document.getElementById('custom-block-btn')) {
        const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
        if (channelElement) {
            const btn = document.createElement('div');
            btn.id = 'custom-block-btn';
            btn.setAttribute('style', `cursor: pointer; padding: 10px 16px;`);
            btn.innerHTML = `<span>🚫</span> Block Channel`;
            btn.onclick = (e) => {
                e.stopPropagation();
                blockedChannels.push(channelElement.textContent.trim());
                chrome.storage.local.set({ blockedChannels });
                document.body.click();
            };
            popup.appendChild(btn);
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });