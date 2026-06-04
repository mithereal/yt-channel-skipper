document.addEventListener('DOMContentLoaded', () => {
    loadList();
});

// Helper function to load list from storage to the textarea
function loadList() {
    chrome.storage.local.get(['blockedChannels'], (result) => {
        if (result.blockedChannels) {
            document.getElementById('channelList').value = result.blockedChannels.join('\n');
        }
    });
}

// Helper function for success/error messages
function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = isError ? '#ff4444' : '#4CAF50';
    setTimeout(() => status.textContent = '', 2000);
}

// --- SAVE LOGIC ---
document.getElementById('saveBtn').addEventListener('click', () => {
    const list = document.getElementById('channelList').value
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);
        
    chrome.storage.local.set({ blockedChannels: list }, () => {
        showStatus('Saved successfully!');
    });
});

// --- EXPORT LOGIC ---
document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.storage.local.get(['blockedChannels'], (result) => {
        const data = result.blockedChannels || [];
        // Create a JSON blob
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'youtube_blocked_channels.json';
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        showStatus('Exported!');
    });
});

// --- IMPORT LOGIC ---
document.getElementById('importBtn').addEventListener('click', () => {
    // Click the hidden file input
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Validate that the imported file is actually a list (array)
            if (Array.isArray(importedData)) {
                chrome.storage.local.set({ blockedChannels: importedData }, () => {
                    loadList();
                    showStatus('Imported successfully!');
                });
            } else {
                showStatus('Invalid file format', true);
            }
        } catch (error) {
            showStatus('Error reading file', true);
        }
        
        // Reset the input so you can import the same file again if needed
        event.target.value = '';
    };
    reader.readAsText(file);
});