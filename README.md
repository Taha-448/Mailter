
***

# UniPriority Filter 📧
**A Privacy-First, Heuristic-Based Gmail Filter for University Students.**

UniPriority is a Chrome Extension built with Manifest V3 that automatically categorizes university-related emails using a custom-built scoring engine. It helps students cut through the noise of newsletters and promotional mail by identifying high-importance communications from faculty and university departments.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Manifest](https://img.shields.io/badge/Manifest-V3-blue)
![API](https://img.shields.io/badge/API-Gmail-red)

---

## 🚀 The Problem
Students often receive hundreds of emails weekly. Critical notifications (exam results, fee deadlines, internship offers) are frequently buried under bulk mail from platforms like Canva, Notion, or LinkedIn. 

**UniPriority** solves this by acting as a "Local Secretary" that intelligently labels emails and notifies the user only when it matters.

## ✨ Key Features
- **Heuristic Scoring Engine:** Uses a two-layer logic (Sender Relevance + Keyword Analysis) to calculate an importance score for every unread email.
- **Replied-To Profiling:** On initial install, the extension performs a one-time scan of the user's 'Sent' folder to identify and whitelist professors/contacts the user has previously interacted with.
- **Bulk Mail Detection:** Checks for the `List-Unsubscribe` header to instantly penalize marketing mail.
- **Native Gmail Integration:** Programmatically creates and applies Gmail labels (`Uni-Priority` and `Uni-Monitor`) so the organization is visible across all devices.
- **Privacy-Centric:** All processing happens locally in the browser's Service Worker. No email content ever leaves the user's machine.

---

## 🛠️ Technical Stack
- **Engine:** JavaScript (ES6+), Chrome Extension API (Manifest V3)
- **Auth:** OAuth 2.0 via `chrome.identity`
- **Data Fetching:** Gmail REST API
- **Storage:** `chrome.storage.local` for persistent user profiles and statistics.
- **Scheduling:** `chrome.alarms` for resource-efficient background polling.

---

## 🧠 How the Scoring Works
The extension calculates a score for each unread email:
| Signal | Weight |
| :--- | :--- |
| Sender is in "Replied-To" list | +50 |
| Sender domain matches University whitelist | +30 |
| Priority Keywords (Result, Deadline, Exam, etc.) | +20 |
| Bulk Mail Header detected | -40 |

**Decisions:**
- **Score 60+:** Labeled as `Uni-Priority` + Desktop Notification.
- **Score 25-59:** Labeled as `Uni-Monitor` (for routine university updates).

---

## ⚙️ Installation & Setup

### Prerequisites
To run this locally, you must create a Project in the [Google Cloud Console](https://console.cloud.google.com/) to obtain an OAuth Client ID.

1. **Enable Gmail API** for your Google Cloud project.
2. **Configure OAuth Consent Screen** and add your email as a **Test User**.
3. **Create Credentials** -> OAuth Client ID (Select "Chrome Extension").
4. **Extension ID:** Get this from `chrome://extensions` after loading the unpacked folder.

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/uni-priority-extension.git
   ```
2. Open `manifest.json` and replace `PASTE_YOUR_CLIENT_ID_HERE` with your actual Google Client ID.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer Mode** (top right).
5. Click **Load Unpacked** and select the project folder.

---

## 🛡️ Security Note
This repository uses the "Assume-Unchanged" Git strategy to ensure that personal OAuth credentials are not leaked during commits. Contributors should follow the template structure provided in the `manifest.json`.

---

## 👤 Author
**Your Name**  
*Student at [Your University]*  
[Your LinkedIn] | [Your Portfolio]

---

*Disclaimer: This project is for educational purposes and is not affiliated with Google or Gmail.*