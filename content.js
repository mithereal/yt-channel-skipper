let blockedChannels = [];
let fallbackChannels = [];
let alwaysSkipLiveChannels = [];
let runConfig = { enabled: false, start: "22:00", end: "06:00" };

// Load settings from Chrome storage
chrome.storage.local.get(['blockedChannels', 'fallbackChannels', 'runConfig', 'alwaysSkipLiveChannels'], (result) => {
    blockedChannels = result.blockedChannels || [];
    fallbackChannels = result.fallbackChannels || [];
    alwaysSkipLiveChannels = result.alwaysSkipLiveChannels || [];
    runConfig = result.runConfig || { enabled: false, start: "22:00", end: "06:00" };
});

// Update runtime settings instantly on changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedChannels) blockedChannels = changes.blockedChannels.newValue || [];
    if (changes.fallbackChannels) fallbackChannels = changes.fallbackChannels.newValue || [];
    if (changes.alwaysSkipLiveChannels) alwaysSkipLiveChannels = changes.alwaysSkipLiveChannels.newValue || [];
    if (changes.runConfig) runConfig = changes.runConfig.newValue || runConfig;
});

// Helper function to check if the current time falls within the runnable hours
function isWithinRunnableHours() {
    if (!runConfig.enabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = runConfig.start.split(':').map(Number);
    const [endH, endM] = runConfig.end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
        // Daytime block (e.g., 09:00 to 17:00)
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
        // Overnight block (e.g., 22:00 to 06:00)
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
}

// Redirects to a random fallback channel's video catalog page
function redirectToFallbackChannel() {
    if (fallbackChannels.length === 0) return;

    // Pick a random channel from your fallback list
    const randomChannel = fallbackChannels[Math.floor(Math.random() * fallbackChannels.length)];
    // Ensure the raw handle is clean, then prepend '@' strictly for the YouTube URL routing
    const cleanHandle = randomChannel.replace(/^@/, '');

    window.location.href = `https://www.youtube.com/@${cleanHandle}/videos`;
}

// Scrapes the channel page for long-form videos and picks one completely at random
function playRandomChannelVideo() {
    if (!window.location.pathname.includes('/videos')) return;

    setTimeout(() => {
        const elements = document.querySelectorAll('ytd-rich-grid-media a#video-title-link, ytd-grid-video-renderer a#video-title');

        // Filter out any link that points to a Short (/shorts/)
        const longFormVideos = Array.from(elements).filter(el => {
            const href = el.getAttribute('href') || '';
            return !href.includes('/shorts/');
        });

        if (longFormVideos.length > 0) {
            const randomIndex = Math.floor(Math.random() * longFormVideos.length);
            const selectedVideo = longFormVideos[randomIndex];

            if (selectedVideo) {
                selectedVideo.click();
            }
        }
    }, 1500);
}

function checkAndSkipVideo() {
    if (!window.location.pathname.includes('/watch')) {
        playRandomChannelVideo();
        return;
    }

    const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
    if (!channelElement) {
        setTimeout(checkAndSkipVideo, 1000);
        return;
    }

    const channelName = channelElement.textContent.trim();

    // Check live state structures
    const isLive = document.querySelector('.ytp-live, .badged-player-livestream-icon, [data-is-live="true"]');
    const isLiveBadge = document.querySelector('ytd-video-primary-info-renderer .ytd-badge-supported-renderer');
    const liveIndicator = (isLive || (isLiveBadge && isLiveBadge.textContent.toLowerCase().includes('live')));

    if (alwaysSkipLiveChannels.includes(channelName) && liveIndicator) {
        redirectToFallbackChannel();
        return;
    }

    if (blockedChannels.includes(channelName)) {
        if (isWithinRunnableHours() && liveIndicator) {
            redirectToFallbackChannel();
            return;
        }

        const video = document.querySelector('video');
        if (video) {
            video.currentTime = video.duration || 999999;
        }
    }
}

// Helper function to extract the channel handle string from the active video window links
function getChannelHandle() {
    const channelLinkElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
    if (!channelLinkElement) return null;

    const href = channelLinkElement.getAttribute('href') || '';
    const parts = href.split('/');
    const handle = parts[parts.length - 1] || parts[parts.length - 2];
    return handle ? handle.trim() : null;
}

// Listen for YouTube Single Page Application navigation events
document.addEventListener('yt-navigate-finish', () => {
    setTimeout(checkAndSkipVideo, 1500);
});

// Periodic observer checks to handle page refreshes or hard routing directly to a /videos index
setInterval(() => {
    if (window.location.pathname.includes('/videos')) {
        playRandomChannelVideo();
    }
}, 3000);

// Base inline CSS layout matching native 3-dot options
const customButtonStyles = `
    cursor: pointer; display: flex; align-items: center; padding: 0 16px;
    min-height: 40px; font-size: 14px; font-family: 'Roboto', Arial, sans-serif;
    color: var(--yt-spec-text-primary, #fff); transition: background-color 0.15s ease;
`;

// Inject the custom buttons into the 3-dots menu container
const observer = new MutationObserver(() => {
    const popup = document.querySelector('ytd-menu-popup-renderer #items, ytd-menu-popup-renderer tp-yt-paper-listbox');

    if (popup) {
        const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
        if (!channelElement) return;

        const channelName = channelElement.textContent.trim();
        const channelHandle = getChannelHandle();

        // 1. INJECT THE BLOCK CHANNEL BUTTON
        if (!document.getElementById('custom-block-btn')) {
            const blockBtn = document.createElement('div');
            blockBtn.id = 'custom-block-btn';
            blockBtn.setAttribute('style', customButtonStyles);
            blockBtn.innerHTML = `
                <span style="margin-right: 16px; font-size: 18px; display: flex; align-items: center;">🚫</span>
                <span style="flex-grow: 1;">Block Channel</span>
            `;

            blockBtn.onmouseenter = () => blockBtn.style.backgroundColor = 'var(--yt-spec-badge-chip-background, rgba(128, 128, 128, 0.15))';
            blockBtn.onmouseleave = () => blockBtn.style.backgroundColor = 'transparent';

            blockBtn.onclick = (e) => {
                e.stopPropagation();
                if (!blockedChannels.includes(channelName)) {
                    blockedChannels.push(channelName);
                    chrome.storage.local.set({ blockedChannels }, () => {
                        checkAndSkipVideo();
                    });
                }
                document.body.click();
            };
            popup.appendChild(blockBtn);
        }

        // 2. INJECT THE ADD AS FALLBACK BUTTON
        if (!document.getElementById('custom-fallback-btn') && channelHandle) {
            const fallbackBtn = document.createElement('div');
            fallbackBtn.id = 'custom-fallback-btn';
            fallbackBtn.setAttribute('style', customButtonStyles);
            fallbackBtn.innerHTML = `
                <span style="margin-right: 16px; font-size: 18px; display: flex; align-items: center;">⭐</span>
                <span style="flex-grow: 1;">Add as Fallback</span>
            `;

            fallbackBtn.onmouseenter = () => fallbackBtn.style.backgroundColor = 'var(--yt-spec-badge-chip-background, rgba(128, 128, 128, 0.15))';
            fallbackBtn.onmouseleave = () => fallbackBtn.style.backgroundColor = 'transparent';

            fallbackBtn.onclick = (e) => {
                e.stopPropagation();
                // Strip the leading '@' symbol before pushing into storage
                const cleanHandle = channelHandle.replace(/^@/, '');
                if (!fallbackChannels.includes(cleanHandle)) {
                    fallbackChannels.push(cleanHandle);
                    chrome.storage.local.set({ fallbackChannels });
                }
                document.body.click();
            };
            popup.appendChild(fallbackBtn);
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });