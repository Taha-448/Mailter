import { VERCEL_URL, MAILTER_SECRET } from './secrets.js';

const PARENT_LABEL = "Priority";

// --- AUTH & API HELPERS ---
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

// Helper to handle nested labels correctly
async function getOrCreateLabel(categoryName) {
  const fullName = `${PARENT_LABEL}/${categoryName}`;
  const data = await gmailApi('/labels');
  
  // 1. Ensure Parent "Priority" exists independently
  const parentLabel = data.labels.find(l => l.name === PARENT_LABEL);
  if (!parentLabel) {
    console.log(`MAILTER: Parent '${PARENT_LABEL}' missing. Creating now...`);
    await gmailApi('/labels', 'POST', { 
        name: PARENT_LABEL,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
    });
  }

  // 2. Check for the specific Child (e.g., "Priority/Academic")
  const existingChild = data.labels.find(l => l.name === fullName);
  if (existingChild) return existingChild.id;

  // 3. Create Child if it doesn't exist
  console.log(`MAILTER: Creating nested sublabel: ${fullName}`);
  const newLabel = await gmailApi('/labels', 'POST', {
    name: fullName,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show'
  });
  
  return newLabel.id;
}

// --- PHASE 1: DISCOVERY (500 EMAILS) ---
async function startDiscovery() {
  console.log("MAILTER: Starting Discovery Phase (500 Email Deep Scan)...");
  try {
    // FORCE CREATE PARENT LABEL AT START
    const dataLabels = await gmailApi('/labels');
    if (!dataLabels.labels.find(l => l.name === PARENT_LABEL)) {
        await gmailApi('/labels', 'POST', { name: PARENT_LABEL });
    }

    const list = await gmailApi(`/messages?maxResults=500`);
    if (!list.messages) return;

    console.log(`MAILTER: Fetching metadata for ${list.messages.length} emails...`);
    const batchSize = 25;
    let subjects = [];

    for (let i = 0; i < list.messages.length; i += batchSize) {
      const batch = list.messages.slice(i, i + batchSize);
      const promises = batch.map(async (m) => {
        try {
          const d = await gmailApi(`/messages/${m.id}?format=metadata&metadataHeaders=Subject`);
          return d?.payload?.headers?.find(h => h.name === 'Subject')?.value || "";
        } catch (e) { return ""; }
      });
      const results = await Promise.all(promises);
      subjects = subjects.concat(results.filter(s => s !== ""));
      console.log(`MAILTER: Discovery Progress: ${subjects.length}/${list.messages.length}`);
    }

    console.log("MAILTER: Sending data to Vercel for Semantic Clustering...");
    const resp = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cluster', data: subjects, secret: MAILTER_SECRET })
    });
    
    const { themes } = await resp.json();
    console.log("MAILTER: AI identified categories:", themes.map(t => t.name).join(", "));

    await chrome.storage.local.set({ 
      categories: themes, 
      isSetup: false, 
      priorityCategories: [], 
      stats: { priority: 0 },
      processedIds: []
    });

    chrome.alarms.create('checkMail', { periodInMinutes: 360 });
    console.log("MAILTER: Setup complete. Waiting for user configuration in Popup.");

  } catch (err) {
    console.error("MAILTER: Discovery Pipeline Error:", err);
  }
}

// --- PHASE 2: CLASSIFICATION (30 EMAILS BATCHED) ---
async function runClassification() {
  console.log("MAILTER: Alarm fired. Checking for new unread mail...");
  
  const { isSetup, categories, priorityCategories, stats, processedIds = [] } = 
        await chrome.storage.local.get(null);
  
  if (!isSetup) {
    console.log("MAILTER: Setup not finished. Skipping scan.");
    return;
  }

  const data = await gmailApi('/messages?q=is:unread&maxResults=30');
  if (!data || !data.messages) {
    console.log("MAILTER: Inbox clean. No unread messages.");
    return;
  }

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
      } catch (e) { console.warn("MAILTER: Skipping message due to fetch error:", m.id); }
    }
  }

  if (newEmails.length === 0) {
    console.log("MAILTER: No NEW unread mail. Cache hits: 100%");
    return;
  }

  console.log(`MAILTER: Sending batch of ${newEmails.length} new emails to Vercel...`);

  try {
    const categoryNames = categories.map(c => c.name);
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
    console.log("MAILTER: AI Classification Batch Results:", classifications);

    let priorityFound = 0;
    const currentProcessed = [...processedIds];

    for (let res of classifications) {
      currentProcessed.push(res.id);

      if (priorityCategories.includes(res.category)) {
        console.log(`MAILTER: Priority Match! Category: "${res.category}" for Email ID: ${res.id}`);
        
        // Use the Nested Label helper
        const labelId = await getOrCreateLabel(res.category);
        
        await gmailApi(`/messages/${res.id}/modify`, 'POST', { 
          addLabelIds: [labelId] 
        });
        
        priorityFound++;
      }
    }

    const newStatsCount = (stats.priority || 0) + priorityFound;
    await chrome.storage.local.set({ 
      stats: { priority: newStatsCount },
      processedIds: currentProcessed.slice(-300) 
    });

    console.log(`MAILTER: Scan finished. Prioritized ${priorityFound} emails.`);

  } catch (err) {
    console.error("MAILTER: Batch Classification Failed:", err);
  }
}

// --- EVENT LISTENERS ---
chrome.runtime.onInstalled.addListener(startDiscovery);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMail') runClassification();
});

// For Manual Console Testing
self.startDiscovery = startDiscovery;
self.runClassification = runClassification;

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "forceScan") {
    console.log("MAILTER: Manual scan triggered from Popup Button.");
    runClassification(); 
  }
});