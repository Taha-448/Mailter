import { VERCEL_URL, MAILTER_SECRET } from './secrets.js';

// --- AUTH & API HELPERS ---
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => resolve(token));
  });
}

async function gmailApi(endpoint, method = 'GET', body = null) {
  const token = await getAuthToken();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
}

// --- DISCOVERY PHASE (500 EMAILS) ---
async function startDiscovery() {
  console.log("MAILTER: Starting 500-email Deep Discovery...");
  try {
    const data = await gmailApi(`/messages?maxResults=500`);
    if (!data.messages) return;

    // Parallel fetch for speed
    const batchSize = 25;
    let subjects = [];
    for (let i = 0; i < data.messages.length; i += batchSize) {
      const batch = data.messages.slice(i, i + batchSize);
      const promises = batch.map(async (m) => {
        const d = await gmailApi(`/messages/${m.id}?format=metadata&metadataHeaders=Subject`);
        return d.payload?.headers?.find(h => h.name === 'Subject')?.value || "";
      });
      const results = await Promise.all(promises);
      subjects = subjects.concat(results.filter(s => s !== ""));
    }

    const resp = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cluster', data: subjects, secret: MAILTER_SECRET })
    });
    const { themes } = await resp.json();

    await chrome.storage.local.set({ 
      categories: themes, isSetup: false, priorityCategories: [], 
      stats: { priority: 0 }, processedIds: [] 
    });

    chrome.alarms.create('checkMail', { periodInMinutes: 5 });
    await gmailApi('/labels', 'POST', { name: 'Uni-Priority' });
    console.log("MAILTER: Setup Complete.");
  } catch (err) {
    console.error("Discovery Failed:", err);
  }
}

// --- CLASSIFICATION PHASE (30 EMAILS / BATCHED) ---
async function runClassification() {
  const { isSetup, categories, priorityCategories, stats, processedIds = [] } = 
        await chrome.storage.local.get(null);
  
  if (!isSetup) return;

  // 1. Fetch 30 unread emails
  const data = await gmailApi('/messages?q=is:unread&maxResults=30');
  if (!data || !data.messages) return;

  // 2. Only process IDs we HAVEN'T seen before
  const newEmails = [];
  for (let m of data.messages) {
    if (!processedIds.includes(m.id)) {
      try {
        const email = await gmailApi(`/messages/${m.id}`);
        newEmails.push({
          id: m.id,
          subject: email.payload.headers.find(h => h.name === 'Subject')?.value,
          from: email.payload.headers.find(h => h.name === 'From')?.value
        });
      } catch (e) { console.warn("Skip email", m.id); }
    }
  }

  if (newEmails.length === 0) {
    console.log("MAILTER: No new unread mail since last check.");
    return;
  }

  console.log(`MAILTER: Processing batch of ${newEmails.length} new emails...`);

  // 3. Batch Call to Vercel (Saves Tokens!)
  const categoryNames = categories.map(c => c.name);
  try {
    const resp = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'classify', 
        data: newEmails, 
        categories: categoryNames, 
        secret: MAILTER_SECRET 
      })
    });
    
    const { classifications } = await resp.json();

    // 4. Update Stats and Cache
    let priorityFound = 0;
    const currentProcessed = [...processedIds];

    for (let res of classifications) {
      currentProcessed.push(res.id); // Add to seen list
      if (priorityCategories.includes(res.category)) {
        const allLabels = await gmailApi('/labels');
        const pId = allLabels.labels.find(l => l.name === 'Uni-Priority').id;
        await gmailApi(`/messages/${res.id}/modify`, 'POST', { addLabelIds: [pId] });
        priorityFound++;
      }
    }

    // Keep cache at a reasonable size (last 200 IDs)
    const updatedStats = (stats.priority || 0) + priorityFound;
    await chrome.storage.local.set({ 
      stats: { priority: updatedStats }, 
      processedIds: currentProcessed.slice(-200) 
    });

  } catch (err) {
    console.error("Batch Classification Failed:", err);
  }
}

chrome.runtime.onInstalled.addListener(startDiscovery);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMail') runClassification();
});
self.startDiscovery = startDiscovery; // For manual testing