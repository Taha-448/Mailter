# Mailter 📧
**An AI-Native Semantic Inbox Filter for Students.**

Mailter is a Manifest V3 Chrome Extension that uses LLMs to dynamically categorize and prioritize student emails. By moving away from rigid keyword-based rules, Mailter understands the *intent* behind your messages, ensuring critical academic and career-related mail is always front and center.

## 🧠 Core Engineering Achievements

### 1. Dynamic Semantic Clustering
On installation, Mailter performs a "Deep Scan" of 500 historical email subjects using **Parallel Fetching** (`Promise.all`). It sends this data to a Vercel-hosted LLM middleware which performs unsupervised clustering to identify 4–12 distinct life categories unique to that user.

### 2. Token-Optimized Batch Classification
To minimize LLM API costs, Mailter implements **Batch Inference**. Multiple unread emails are bundled into a single JSON-structured prompt. Combined with a **Local ID Cache** (`processedIds`), the system ensures that each email is only ever classified once, reducing token overhead by ~80%.

### 3. Server-Side Hierarchy (Nested Labeling)
Mailter programmatically interacts with the Gmail REST API to create a hierarchical labeling system (`Priority/Category`). This allows for a clean, "nested" sidebar experience in Gmail while maintaining surgical organization.

### 4. Secure AI Middleware
Built a secure Next.js proxy on Vercel to handle LLM interactions. This architecture protects sensitive API keys and implements **Origin Validation** to ensure only the authorized extension can access the AI brain.

## 🛠️ Tech Stack
- **Extension:** JavaScript (ES6), Manifest V3, Gmail REST API, OAuth 2.0.
- **Backend:** Next.js, Vercel AI SDK, OpenAI GPT-4o-mini.
- **Infrastructure:** Vercel (Serverless), GitHub Actions.

## 🚀 How it Works
1. **Discovery:** Scans 500 emails to map your "Student World."
2. **Intent Dashboard:** User chooses which AI-discovered themes are "Priority."
3. **Silent Monitoring:** Background service worker filters mail every 5–30 minutes.
4. **Auto-Labeling:** Important mail is instantly tagged in Gmail via server-side labels.

## 👤 Author
**Muhammad Taha Anjum**
*Computer Science Student at NUST*
