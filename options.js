document.addEventListener('DOMContentLoaded', () => {
    buildGrids();
    loadSettings();
    setupInteractiveBlocklist();
});

// Programmatically populate the matrix systems
function buildGrids() {
    const startHoursContainer = document.getElementById('startHoursGrid');
    const endHoursContainer = document.getElementById('endHoursGrid');
    const startMinsContainer = document.getElementById('startMinutesGrid');
    const endMinsContainer = document.getElementById('endMinutesGrid');

    // Create 24 Hours squares (00 to 23)
    for (let h = 0; h < 24; h++) {
        const displayH = String(h).padStart(2, '0');
        startHoursContainer.appendChild(createSquare(displayH, 'start-hour'));
        endHoursContainer.appendChild(createSquare(displayH, 'end-hour'));
    }

    // Create 10-minute interval squares (00 to 50)
    for (let m = 0; m < 60; m += 10) {
        const displayM = String(m).padStart(2, '0');
        startMinsContainer.appendChild(createSquare(displayM, 'start-min'));
        endMinsContainer.appendChild(createSquare(displayM, 'end-min'));
    }
}

// Single square element factory
function createSquare(val, groupClass) {
    const div = document.createElement('div');
    div.className = `square ${groupClass}`;
    div.textContent = val;
    div.dataset.value = val;

    div.addEventListener('click', () => {
        document.querySelectorAll(`.${groupClass}`).forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
    });
    return div;
}

// Read settings out of storage
function loadSettings() {
    chrome.storage.local.get(['blockedChannels', 'fallbackChannels', 'blockedTags', 'runConfig', 'alwaysSkipLiveChannels'], (result) => {
        if (result.blockedChannels) {
            document.getElementById('channelList').value = result.blockedChannels.join('\n');
        }
        if (result.fallbackChannels) {
            document.getElementById('fallbackList').value = result.fallbackChannels.join('\n');
        }
        if (result.alwaysSkipLiveChannels) {
            document.getElementById('alwaysSkipLiveList').value = result.alwaysSkipLiveChannels.join('\n');
        }
        if (result.blockedTags) document.getElementById('tagList').value = result.blockedTags.join('\n');
        const config = result.runConfig || { enabled: false, start: "22:00", end: "06:00" };
        document.getElementById('enableTime').checked = config.enabled;

        const [startH, startM] = config.start.split(':');
        const [endH, endM] = config.end.split(':');

        setSelectedSquare('start-hour', startH);
        setSelectedSquare('start-min', startM);
        setSelectedSquare('end-hour', endH);
        setSelectedSquare('end-min', endM);
    });
}

function setSelectedSquare(groupClass, value) {
    const cleanVal = String(value).padStart(2, '0');
    const match = Array.from(document.querySelectorAll(`.${groupClass}`))
                       .find(el => el.dataset.value === cleanVal);
    if (match) match.classList.add('selected');
}

function getSelectedValue(groupClass, fallbackDefault) {
    const activeElement = document.querySelector(`.${groupClass}.selected`);
    return activeElement ? activeElement.dataset.value : fallbackDefault;
}

function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = isError ? '#ff4444' : '#4CAF50';
    setTimeout(() => status.textContent = '', 2000);
}

// --- SAVE LOGIC ---
document.getElementById('saveBtn').addEventListener('click', () => {
    const blockedList = document.getElementById('channelList').value.split('\n').map(c => c.trim()).filter(c => c.length > 0);

    // Split text input, sanitize by removing any explicit leading '@' characters, and drop empty lines
    const fallbackList = document.getElementById('fallbackList').value.split('\n').map(c => c.trim().replace(/^@/, '')).filter(c => c.length > 0);
    const alwaysSkipLiveList = document.getElementById('alwaysSkipLiveList').value.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    const tagList = document.getElementById('tagList').value.split('\n').map(t => t.trim()).filter(t => t.length > 0);

    const startH = getSelectedValue('start-hour', '22');
    const startM = getSelectedValue('start-min', '00');
    const endH = getSelectedValue('end-hour', '06');
    const endM = getSelectedValue('end-min', '00');

    const runConfig = {
        enabled: document.getElementById('enableTime').checked,
        start: `${startH}:${startM}`,
        end: `${endH}:${endM}`
    };

    chrome.storage.local.set({
        blockedChannels: blockedList,
        fallbackChannels: fallbackList,
        runConfig: runConfig,
        blockedTags: tagList,
        alwaysSkipLiveChannels: alwaysSkipLiveList
    }, () => {
        showStatus('Saved successfully!');
    });
});

// --- EXPORT LOGIC ---
document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.storage.local.get(['blockedChannels', 'fallbackChannels', 'blockedTags', 'runConfig', 'alwaysSkipLiveChannels'], (result) => {
        const backupData = {
            blockedChannels: result.blockedChannels || [],
            fallbackChannels: result.fallbackChannels || [],
            blockedTags: result.blockedTags || [],
            runConfig: result.runConfig || { enabled: false, start: "22:00", end: "06:00" },
            alwaysSkipLiveChannels: result.alwaysSkipLiveChannels || []
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'youtube_bypass_filter_settings.json';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('Exported!');
    });
});

// --- IMPORT LOGIC ---
document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});


document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && typeof importedData === 'object' && !Array.isArray(importedData)) {
                chrome.storage.local.set({
                    blockedChannels: importedData.blockedChannels || [],
                    fallbackChannels: importedData.fallbackChannels || [],
                    blockedTags: importedData.blockedTags || [],
                    runConfig: importedData.runConfig || { enabled: false, start: "22:00", end: "06:00" },
                    alwaysSkipLiveChannels: importedData.alwaysSkipLiveChannels || []
                }, () => {
                    document.querySelectorAll('.square').forEach(el => el.classList.remove('selected'));
                    loadSettings();
                    showStatus('Imported settings!');
                });
            } else {
                showStatus('Invalid file format', true);
            }
        } catch (error) {
            showStatus('Error reading file', true);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
});