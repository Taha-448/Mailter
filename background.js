import { VERCEL_URL, MAILTER_SECRET } from './secrets.js';

// --- HELPERS ---
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(token);
    });
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

// Optimized Parallel Fetcher for 500 emails
// Optimized Parallel Fetcher with Safety Checks
async function fetchSubjects(count) {
  const data = await gmailApi(`/messages?maxResults=${count}`);
  if (!data || !data.messages) return [];
  
  const batchSize = 25;
  let subjects = [];
  
  for (let i = 0; i < data.messages.length; i += batchSize) {
    const batch = data.messages.slice(i, i + batchSize);
    
    const promises = batch.map(async (m) => {
      try {
        const d = await gmailApi(`/messages/${m.id}?format=metadata&metadataHeaders=Subject`);
        
        // ADDED SAFETY CHECK HERE (?.)
        const subValue = d?.payload?.headers?.find(h => h.name === 'Subject')?.value;
        
        return subValue || ""; 
      } catch (e) {
        console.warn(`Skipping message ${m.id} due to error:`, e);
        return "";
      }
    });

    const results = await Promise.all(promises);
    // Filter out empty strings from skipped messages
    subjects = subjects.concat(results.filter(s => s !== ""));
    console.log(`MAILTER: Progress ${subjects.length}/${data.messages.length}`);
  }
  return subjects;
}

// --- DISCOVERY PHASE ---
async function startDiscovery() {
  console.log("MAILTER: Starting Deep Discovery (500 emails)...");
  try {
    const subjects = await fetchSubjects(500);
    const resp = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cluster', data: subjects, secret: MAILTER_SECRET })
    });
    const { themes } = await resp.json();
    await chrome.storage.local.set({ 
      categories: themes, isSetup: false, priorityCategories: [], stats: { priority: 0 } 
    });
    console.log("MAILTER: AI Clustering complete. Themes found:", themes.length);
    chrome.alarms.create('checkMail', { periodInMinutes: 5 });
    await gmailApi('/labels', 'POST', { name: 'Uni-Priority' });
  } catch (err) {
    console.error("Discovery Failed:", err);
  }
}

// --- CLASSIFICATION PHASE ---
async function runClassification() {
  const { isSetup, categories, priorityCategories, stats } = await chrome.storage.local.get(null);
  if (!isSetup) return;

  const data = await gmailApi('/messages?q=is:unread&maxResults=10');
  if (!data.messages) return;

  const categoryNames = categories.map(c => c.name);

  for (let m of data.messages) {
    const email = await gmailApi(`/messages/${m.id}`);
    const subject = email.payload.headers.find(h => h.name === 'Subject')?.value;
    const from = email.payload.headers.find(h => h.name === 'From')?.value;

    const resp = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'classify', data: { subject, from }, categories: categoryNames, secret: MAILTER_SECRET 
      })
    });
    const result = await resp.json();

    if (priorityCategories.includes(result.category)) {
      const labels = await gmailApi('/labels');
      const pId = labels.labels.find(l => l.name === 'Uni-Priority').id;
      await gmailApi(`/messages/${m.id}/modify`, 'POST', { addLabelIds: [pId] });
      stats.priority = (stats.priority || 0) + 1;
      await chrome.storage.local.set({ stats });
    }
  }
}

chrome.runtime.onInstalled.addListener(startDiscovery);
chrome.alarms.onAlarm.addListener(runClassification);
self.startDiscovery = startDiscovery; // Manual trigger