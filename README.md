***

# Mailter 📧 🤖
**An AI-Native Semantic Inbox Filter for Students.**

Mailter is a sophisticated Chrome Extension (Manifest V3) that uses Large Language Models (LLMs) to transform a cluttered student inbox into a prioritized workspace. Unlike traditional filters that rely on rigid "if-this-then-that" rules, Mailter understands the **semantic intent** of your communications.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](#)
[![Vercel](https://img.shields.io/badge/Backend-Vercel-black)](#)
[![OpenAI](https://img.shields.io/badge/AI-GPT--4o--mini-green)](#)

---

## 🌟 The Philosophy
Students don't just receive "spam" and "not spam." They receive **clusters** of information: Academic Administration, Student Societies, Financial Alerts, Career Opportunities, and Automated Platform Noise. 

Mailter doesn't guess what's important. It **discovers** your unique inbox patterns and lets you choose which "themes" of your life deserve a notification.

---

## 🛠️ System Architecture

Mailter is a full-stack AI application consisting of two parts:

1.  **The Client (Chrome Extension):** Handles the "Heavy Lifting" of data fetching from the Gmail REST API, manages the local ID cache, and provides the Intent Dashboard UI.
2.  **The Brain (Vercel Middleware):** A Next.js API that acts as a secure proxy to OpenAI. It handles high-level reasoning tasks like **Unsupervised Clustering** and **Batch Classification**.

---

## 🧠 Key Engineering Features

### 1. Dynamic Semantic Clustering
On installation, Mailter performs a "Deep Scan" of 500 historical email subjects. It uses **Parallel Fetching** (`Promise.all`) to pull this data in seconds. The LLM then analyzes these 500 data points to dynamically generate 4–12 custom categories unique to the user’s specific digital footprint.

### 2. Token-Optimized Batch Classification
To minimize API costs and latency, Mailter implements **Batch Inference**. Instead of sending 10 requests for 10 emails, it bundles them into a single JSON-structured prompt. This reduces token overhead by approximately **80%**.

### 3. State-Persistence & ID Caching
Mailter maintains a local **Processed ID Cache**. By tracking unique Gmail Message IDs, the extension ensures that the AI never processes (or charges for) the same email twice, even if it remains unread in the inbox for days.

### 4. Manifest V3 Service Workers
Fully compliant with the latest Chrome standards, Mailter utilizes an event-driven Service Worker and the `chrome.alarms` API to monitor the inbox every 5–30 minutes without draining the user's system resources.

---

## 🚀 Technical Stack
- **Frontend:** JavaScript (ES6), HTML5, CSS3
- **Extension API:** Chrome Manifest V3 (Identity, Storage, Alarms, Notifications)
- **Backend:** Next.js, Vercel AI SDK
- **AI Model:** OpenAI GPT-4o-mini (Structured Outputs via Zod)
- **Database:** `chrome.storage.local` (Client-side persistence)

---

## ⚙️ Setup & Installation

### Backend Setup
1. Clone the `mailter-backend` repository.
2. Deploy to **Vercel**.
3. Set the following Environment Variables in Vercel:
   - `OPENAI_API_KEY`: Your OpenAI API Key.
   - `MAILTER_SECRET`: A secure handshake password.
   - `EXTENSION_ID`: Your Chrome Extension ID (for Origin validation).

### Extension Setup
1. Clone this repository.
2. Create a `secrets.js` file in the root:
   ```javascript
   export const VERCEL_URL = "https://your-vercel-app.vercel.app/api/mailter";
   export const MAILTER_SECRET = "your-handshake-password";
   ```
3. Update `manifest.json` with your **Google OAuth Client ID**.
4. Load the folder into Chrome via `chrome://extensions` -> **Load Unpacked**.

---

## 🛡️ Security & Privacy
- **No Data Persistence:** Mailter does not store your email content on any server. Emails are sent to the LLM for real-time classification and then immediately discarded.
- **Secure Handshake:** All communication between the extension and the Vercel backend is protected by a secret token and Origin verification.
- **Local Control:** All prioritization logic and "Processed ID" caches stay on the user's local machine.

---

## 👤 Author
**Your Name**  
*Computer Science Student at [Your University]*  
[LinkedIn] | [Portfolio] | [Email]

---
*Disclaimer: This project is for educational purposes. All API usage costs are the responsibility of the user.*