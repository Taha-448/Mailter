document.addEventListener('DOMContentLoaded', async () => {
  const view = document.getElementById('view');
  const data = await chrome.storage.local.get(null);

  if (!data.isSetup) {
    if (!data.categories) {
      view.innerHTML = "Processing your 500 emails... Please wait 30 seconds.";
      return;
    }
    view.innerHTML = `<h4>Prioritize these categories:</h4>` + data.categories.map(c => `
      <div class="card">
        <input type="checkbox" name="cat" value="${c.name}">
        <div class="card-text"><b>${c.name}</b><small>${c.description}</small></div>
      </div>
    `).join('') + `<button id="save">Save Preferences</button>`;

    document.getElementById('save').onclick = async () => {
      const selected = Array.from(document.querySelectorAll('input:checked')).map(i => i.value);
      await chrome.storage.local.set({ priorityCategories: selected, isSetup: true });
      location.reload();
    };
  } else {
    view.innerHTML = `<div id="stats">
      <h1>${data.stats?.priority || 0}</h1>
      <p>Priority Emails Detected</p>
      <small>Active: ${data.priorityCategories.join(', ')}</small>
      <button id="reset" style="background:#ddd; color:#333;">Reset</button>
    </div>`;
    document.getElementById('reset').onclick = async () => {
      await chrome.storage.local.set({ isSetup: false });
      location.reload();
    };
  }
});