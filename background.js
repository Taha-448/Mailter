// --- CONSTANTS ---
const UNI_DOMAINS = ['nust.edu.pk', 'seecs.edu.pk'];
const PRIORITY_KEYWORDS = ['deadline', 'result', 'exam', 'quiz', 'timetable', 'fee', 'challan', 'assignment', 'lecture', 'offer', 'internship'];
const TRASH_KEYWORDS = ['unsubscribe', 'marketing', 'sale', 'newsletter', 'promotion'];

// --- 1. AUTH HELPER ---
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
  if (!res.ok) return null;
  return res.json();
}

// --- 2. THE ONE-TIME PROFILER ---
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("Initial scan starting...");
    const data = await gmailApi('/messages?maxResults=500&q=is:sent');
    const repliedTo = new Set();

    if (data && data.messages) {
      for (let m of data.messages) {
        const detail = await gmailApi(`/messages/${m.id}`);
        const headers = detail.payload.headers;
        const toHeader = headers.find(h => h.name === 'To')?.value;
        const email = toHeader?.match(/<(.+?)>/)?.[1] || toHeader;
        if (email) repliedTo.add(email.toLowerCase());
      }
    }

    await chrome.storage.local.set({
      userProfile: {
        repliedTo: Array.from(repliedTo),
        whitelist: UNI_DOMAINS
      },
      stats: { priorityCount: 0, monitorCount: 0 }
    });

    // Create labels in Gmail
    await setupLabels();
    
    // Set up a check every 5 minutes
    chrome.alarms.create('checkMail', { periodInMinutes: 5 });
  }
});

async function setupLabels() {
  const existing = await gmailApi('/labels');
  const labelNames = ['Uni-Priority', 'Uni-Monitor'];
  
  for (let name of labelNames) {
    if (!existing.labels.find(l => l.name === name)) {
      await gmailApi('/labels', 'POST', {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      });
    }
  }
}

// --- 3. SCORING PIPELINE ---
async function scoreAndLabel() {
  console.log("Checking for emails...");
  const { userProfile, stats } = await chrome.storage.local.get(['userProfile', 'stats']);
  
  const data = await gmailApi('/messages?q=is:unread&maxResults=100'); 
  
  if (!data || !data.messages) {
    console.log("No messages found.");
    return;
  }

  const labels = await gmailApi('/labels');
  const pLabel = labels.labels.find(l => l.name === 'Uni-Priority');
  const mLabel = labels.labels.find(l => l.name === 'Uni-Monitor');

  for (let m of data.messages) {
    const email = await gmailApi(`/messages/${m.id}`);
    const headers = email.payload.headers;
    const from = (headers.find(h => h.name === 'From')?.value || "").toLowerCase();
    const subject = (headers.find(h => h.name === 'Subject')?.value || "").toLowerCase();
    
    let score = 0;

    // SCORING LOGIC
    if (userProfile.repliedTo.some(e => from.includes(e))) score += 50;
    if (userProfile.whitelist.some(d => from.includes(d))) score += 30;
    
    PRIORITY_KEYWORDS.forEach(word => {
      if (subject.includes(word)) score += 20;
    });

    console.log(`Email from: ${from} | Subject: ${subject} | Total Score: ${score}`);

    if (score >= 60) {
      console.log("Result: PRIORITY");
      await gmailApi(`/messages/${m.id}/modify`, 'POST', { addLabelIds: [pLabel.id] });
      stats.priorityCount++;
    } else if (score >= 25) {
      console.log("Result: MONITOR");
      await gmailApi(`/messages/${m.id}/modify`, 'POST', { addLabelIds: [mLabel.id] });
      stats.monitorCount++;
    } else {
      console.log("Result: IGNORE (Score too low)");
    }
  }
  await chrome.storage.local.set({ stats });
  console.log("Finished processing.");
}

function showNotify(sub) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png', // Ensure you have an icon.png in your folder
    title: 'Priority University Mail',
    message: sub || 'New important email detected.'
  });
}

chrome.alarms.onAlarm.addListener(scoreAndLabel);