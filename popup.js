document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enabled-toggle');
    const input = document.getElementById('channel-input');
    const addButton = document.getElementById('add-button');
    const channelsList = document.getElementById('channels-list');
    const optionsGear = document.getElementById('options-gear');

    // Load saved settings using normalized global extension keys including alwaysSkipLiveChannels
    chrome.storage.local.get({ extensionEnabled: true, blockedChannels: [], alwaysSkipLiveChannels: [] }, (data) => {
        toggle.checked = data.extensionEnabled;
        updateAndRender(data.blockedChannels, data.alwaysSkipLiveChannels);
    });

    // Save the toggle state change across components
    toggle.addEventListener('change', () => {
        chrome.storage.local.set({ extensionEnabled: toggle.checked });
    });

    // Option gear click listener to open full-width options tab panel
    optionsGear.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // Add new channel to blocklist with deduplication and key events
    addButton.addEventListener('click', addChannel);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addChannel();
    });

    function addChannel() {
        const channelName = input.value.trim();
        if (!channelName) return;

        chrome.storage.local.get({ blockedChannels: [], alwaysSkipLiveChannels: [] }, (data) => {
            const blockedChannels = data.blockedChannels;
            const alwaysSkipLiveChannels = data.alwaysSkipLiveChannels;

            // Case-insensitive deduplication check across both combined lists
            const combinedLower = [...blockedChannels, ...alwaysSkipLiveChannels].map(c => c.toLowerCase());

            if (!combinedLower.includes(channelName.toLowerCase())) {
                blockedChannels.push(channelName);
                chrome.storage.local.set({ blockedChannels }, () => {
                    updateAndRender(blockedChannels, alwaysSkipLiveChannels);
                    input.value = '';
                });
            }
        });
    }

    // Helper function to merge both storage arrays uniquely and trigger the layout renderer
    function updateAndRender(blocked, alwaysSkip) {
        const combinedChannels = [...new Set([...blocked, ...alwaysSkip])];
        renderChannels(combinedChannels);
    }

    function renderChannels(channels) {
        channelsList.innerHTML = '';

        if (!channels || channels.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'channel-item';
            emptyLi.style.color = 'var(--text-muted)';
            emptyLi.style.justifyContent = 'center';
            emptyLi.textContent = 'No channels blocked yet';
            channelsList.appendChild(emptyLi);
            return;
        }

        channels.forEach((channel) => {
            const li = document.createElement('li');
            li.className = 'channel-item';

            const span = document.createElement('span');
            span.textContent = channel;
            span.style.color = 'var(--text-main)';

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.className = 'remove-btn';
            removeBtn.addEventListener('click', () => {
                removeChannel(channel);
            });

            li.appendChild(span);
            li.appendChild(removeBtn);
            channelsList.appendChild(li);
        });
    }

    function removeChannel(channelToRemove) {
        chrome.storage.local.get({ blockedChannels: [], alwaysSkipLiveChannels: [] }, (data) => {
            // Deletes the selected entry from BOTH storage contexts simultaneously as requested
            const blockedChannels = data.blockedChannels.filter(c => c !== channelToRemove);
            const alwaysSkipLiveChannels = data.alwaysSkipLiveChannels.filter(c => c !== channelToRemove);

            chrome.storage.local.set({ blockedChannels, alwaysSkipLiveChannels }, () => {
                updateAndRender(blockedChannels, alwaysSkipLiveChannels);
            });
        });
    }

    // Listens to cross-page modifications (e.g. options page updates or native context clicks)
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.extensionEnabled) {
            toggle.checked = changes.extensionEnabled.newValue !== false;
        }
        if (changes.blockedChannels || changes.alwaysSkipLiveChannels) {
            chrome.storage.local.get({ blockedChannels: [], alwaysSkipLiveChannels: [] }, (data) => {
                updateAndRender(data.blockedChannels, data.alwaysSkipLiveChannels);
            });
        }
    });
});