let blockedChannels = [];

// Load the initial blocklist from Chrome storage
chrome.storage.local.get(['blockedChannels'], (result) => {
    blockedChannels = result.blockedChannels || [];
});

// Update the list immediately if you change it in the popup
chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedChannels) {
        blockedChannels = changes.blockedChannels.newValue;
    }
});

// Logic to check the current video and skip it
function checkAndSkipVideo() {
    if (!window.location.pathname.includes('/watch')) return;

    // Grab the channel name from the video owner renderer
    const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
    
    if (!channelElement) {
        // If the DOM hasn't loaded the channel name yet, try again in 1 second
        setTimeout(checkAndSkipVideo, 1000);
        return;
    }

    const channelName = channelElement.textContent.trim();

    if (blockedChannels.includes(channelName)) {
        const video = document.querySelector('video');
        if (video) {
            // Skip directly to the end of the video
            video.currentTime = video.duration; 
            
            // Turn the playbar red
            const playbar = document.querySelector('.ytp-play-progress');
            if (playbar) playbar.classList.add('blocked-playbar');
        }
    }
}

// YouTube is a Single Page Application. Listen for its native navigation event.
document.addEventListener('yt-navigate-finish', () => {
    // Reset the playbar color for the new video
    const playbar = document.querySelector('.ytp-play-progress');
    if (playbar) playbar.classList.remove('blocked-playbar');
    
    setTimeout(checkAndSkipVideo, 1500);
});

// Inject the custom button into the 3-dots menu
const observer = new MutationObserver(() => {
    // Resilient selector targeting both old and updated YouTube menu item containers
    const popup = document.querySelector('ytd-menu-popup-renderer #items, ytd-menu-popup-renderer tp-yt-paper-listbox');
    
    if (popup && !document.getElementById('custom-block-btn')) {
        const blockBtn = document.createElement('div');
        blockBtn.id = 'custom-block-btn';
        
        // Match YouTube's native menu item layout exactly
        blockBtn.setAttribute('style', `
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            padding: 0 16px; 
            min-height: 40px; 
            font-size: 14px; 
            font-family: 'Roboto', Arial, sans-serif;
            color: var(--yt-spec-text-primary, #fff);
            transition: background-color 0.15s ease;
        `);

        // Inner layout matching native 3-dot options
        blockBtn.innerHTML = `
            <span style="margin-right: 16px; font-size: 18px; display: flex; align-items: center;">🚫</span>
            <span style="flex-grow: 1;">Block Channel</span>
        `;
        
        // Seamless hover handling using YouTube's dynamic background variables
        blockBtn.onmouseenter = () => {
            blockBtn.style.backgroundColor = 'var(--yt-spec-badge-chip-background, rgba(128, 128, 128, 0.15))';
        };
        blockBtn.onmouseleave = () => {
            blockBtn.style.backgroundColor = 'transparent';
        };
        
        // Click Action
        blockBtn.onclick = (e) => {
            e.stopPropagation(); // Stop menu layout glitches
            const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name yt-formatted-string a');
            if (channelElement) {
                const name = channelElement.textContent.trim();
                if (!blockedChannels.includes(name)) {
                    blockedChannels.push(name);
                    chrome.storage.local.set({blockedChannels}, () => {
                        alert(`Added "${name}" to blocklist.`);
                        checkAndSkipVideo();
                    });
                }
            }
            // Force the YouTube menu to close
            document.body.click();
        };
        
        popup.appendChild(blockBtn);
    }
});

// Watch the DOM for the popup menu opening
observer.observe(document.body, { childList: true, subtree: true });