# SmartNiwas Portal Notification Alternatives

This guide outlines the benefits of your current email setup, along with simpler alternatives that reduce intermediaries, eliminate complex DNS verification (DKIM/SPF/DMARC), and simplify notification management for your private home portal.

---

## 1. The Current Setup: Resend + AWS SES
* **Flow**: Web Portal/Pi -> Resend API -> AWS SES SMTP servers -> Recipient Inbox.
* **Benefits**: 
  - Industry-standard deliverability (guaranteed inbox placement).
  - Domain protection (prevents email spoofing).
* **Drawbacks**: Requires managing multiple configuration keys across services, verifying 3 CNAME records on Cloudflare, and updating SPF/DMARC records.

---

## 2. Alternative A: Telegram Bot Integration (Recommended)
This completely replaces email with instant push notifications in a private Telegram chat group.

### Benefits
* **Zero Intermediaries**: Your portal or Pi sends messages directly to Telegram.
* **No DNS Configuration**: You can delete the SPF, DMARC, and MX records from Cloudflare.
* **Rich Alerts**: Supports sending text alerts, system logs, and live camera snapshot images directly to your phone.

### Step-by-Step Setup
1. **Create the Bot**:
   - Open Telegram and search for `@BotFather`.
   - Send the command `/newbot` and follow the instructions to name your bot.
   - Save the **HTTP API Token** generated (e.g. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
2. **Get your Chat ID**:
   - Create a new Telegram group for your family.
   - Add your newly created bot to the group.
   - Search for `@RawDataBot` in Telegram, add it to the group temporarily, and copy the `chat.id` value (usually a negative number like `-100123456789`). Remove `@RawDataBot` once you have the ID.
3. **Send a Test Notification**:
   Trigger a test from any browser console or script:
   ```javascript
   fetch(`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           chat_id: '<YOUR_CHAT_ID>',
           text: "🔔 SmartNiwas Alert: Main Gate has been unlocked!"
       })
   });
   ```

---

## 3. Alternative B: Direct Gmail SMTP
If you still want email alerts but want to eliminate Resend and AWS SES.

### Benefits
* **Reduced Intermediaries**: Your Raspberry Pi/portal connects directly to Google SMTP.
* **No DKIM Setup**: Google handles all verification since the mail originates directly from your personal Gmail account.

### Step-by-Step Setup
1. **Generate a Google App Password**:
   - Go to your Google Account Settings -> Security.
   - Under "How you sign in to Google", ensure **2-Step Verification** is enabled.
   - Search for **App passwords** (or go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
   - Generate a new App Password (e.g. named "SmartNiwas Portal") and copy the 16-character code.
2. **Configure your SMTP Script**:
   - **SMTP Host**: `smtp.gmail.com`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **Username**: `your_email@gmail.com`
   - **Password**: `<16-CHARACTER-APP-PASSWORD>`

---

## 4. Alternative C: Cloudflare Email Routing (Inbound Only)
If you do not need to *send* emails, but want a professional address (like `admin@smartniwas.com`) that automatically forwards incoming mail to your personal Gmail.

### Benefits
* **Free & Zero Maintenance**: Configured entirely within Cloudflare.
* **Easy setup**: Cloudflare automatically adds the correct MX records with one click.

### Step-by-Step Setup
1. Go to your **Cloudflare Dashboard** -> Select `smartniwas.com`.
2. Navigate to **Email** -> **Email Routing**.
3. Click **Enable Email Routing**.
4. Cloudflare will prompt you to automatically add the required DNS MX and SPF records. Click **Add records automatically**.
5. Create a routing rule:
   - **Source Address**: `admin@smartniwas.com`
   - **Destination Address**: `your_personal_email@gmail.com`
6. Verify your destination email address via the link sent by Cloudflare.
