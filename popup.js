async function updateUI() {
  const { stats } = await chrome.storage.local.get('stats');
  if (stats) {
    document.getElementById('p-count').textContent = stats.priorityCount;
    document.getElementById('m-count').textContent = stats.monitorCount;
  }
}

// Update UI when opened
updateUI();

// Also update UI if storage changes while popup is open
chrome.storage.onChanged.addListener(updateUI);