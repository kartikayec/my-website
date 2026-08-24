# Standing Instructions for Spreadsheet Design & ITR Modeling

Whenever generating or formatting Excel spreadsheets or CSVs, always adhere to the following layout and design rules from the first iteration:

## 1. Data Integrity & Numeric Cleanliness
* **Pure Numerical Columns:** Never combine descriptive notes or annotations (e.g. joint payment remarks) in the same cell as currency values. Use a separate `Remarks` or `Notes` column for explanations so the amount column remains strictly numeric and fully compatible with native Excel formulas (like `=SUM()`).
* **Consolidated Entries:** For joint booking amounts or transaction sets, represent them in a single row with the combined sum, listing the constituent cheque numbers in the reference column.

## 2. Reference Key & Path Simplification
* **Remove Redundant Parent Nodes:** When mapping hierarchical paths (e.g. e-filing schema references), strip out redundant root nodes (like `Property a ->`).
* **Letter-Matching Simplification:** If a reference path starts and ends with matching letters (e.g. `b -> bi` or `ei -> eiA`), simplify to the terminal code (e.g. `bi` or `eiA`).
* **Duplicate Suffix Removal:** If the text after the final `->` in a key matches the description in the adjacent column, remove the `->` and the duplicate suffix.
* **Buyer Details Shorthand:** Replace all reference instances matching the pattern `f -> 1` with **`f1`**.

## 3. Formatting & Alignment
* **Remove Bullets:** Avoid bullet points (`•`) and leading double spaces in field description columns. Keep labels clean and left-aligned.
* **Text Wrapping & Widths:** Always enable text wrapping (`wrap_text = True`) on columns containing long descriptions or addresses, and set column widths explicitly to fit wrapped text.
* **Vertical Alignment Rules:** 
  * Use **`top`** vertical alignment for all text-heavy or wrapped columns so that paragraph lines align neatly when rows expand.
  * Use **`center`** vertical alignment for standard single-line short cells (like dates, codes, and numerical amounts).
* **Gridlines:** Explicitly show gridlines (`ws.views.sheetView[0].showGridLines = True`) across all sheets.
* **Cohesive Styling:** Use a professional Classic Navy header style (`#1F4E78` fill with bold white text) and soft zebra formatting (`#F9FAFB` alternating rows) with a clean font family (like `Segoe UI` or `Calibri`).

## 4. Encryption Policy
* **Never Decrypt Encrypted Files:** Under no circumstances should you attempt to decrypt, crack, or use user passwords to unlock password-protected/encrypted PDF or data files.
* **Request Unencrypted Versions:** If you encounter a password-protected or encrypted file, immediately stop and instruct the user to place a clean, unencrypted version of the file in the workspace directory.

## 5. Holder Exclusivity for Capital Gains
* **Sole/First Holder Only:** For Capital Gains (CG) and Schedule 112A, only take into consideration transactions where the assessee is the **sole or first holder**. Nominee status has no impact on taxation and nominee transactions must be excluded from the tax computation.

## 6. Private IoT Dashboard & MQTT Design Rules
* **No Hardcoded Credentials**: Never write, mock, or commit MQTT broker passwords, usernames, or CCTV NVR credentials into code files. Always store connection details strictly inside browser `localStorage` (`smartniwasSettings`) and load them dynamically on runtime.
* **Browser WebSocket Protocol**: Browsers cannot communicate using raw TCP to MQTT brokers. All browser MQTT clients must connect via WebSockets (`ws://` or `wss://`), and brokers (like Mosquitto) must have a WebSocket listener active (typically port `9001` or `/mqtt`).
* **Dynamic Device Inventories**: The list of active switches and sensors must not be statically hardcoded in JS arrays. All active devices must be retrieved from `localStorage` (`smartniwasDevices`) and support dynamic additions/deletions (CRUD) directly from the settings interface.
* **Placeholder Fallbacks**: Do not hide the Smart Controls or Security Monitor panels when broker settings are missing. Always keep the sections visible and render clean, glassmorphic placeholder cards with instructions to prompt settings configuration.
* **Browser RTSP Bypass**: Browsers do not play native RTSP camera video streams. Instead of using heavy transcoding servers to stream video, query the NVR's ISAPI picture snapshot endpoint (over HTTPS) at a periodic interval (e.g. 1.5s) to view live frames, and open the static image in a separate tab when clicked.

## 7. Email Authentication & Webhook Notification Rules
* **DMARC Compliance Guard**: If a domain utilizes a strict DMARC policy (`p=reject`), never send outbound mail via third-party providers (like Resend, Amazon SES, or SendGrid) without verifying that DKIM CNAME records are added to the DNS dashboard. Senders failing DKIM/DMARC alignment will be silently rejected by receivers.
* **Inbound Mail MX Verification**: Always ensure valid `MX` records are configured if inbound mail forwarding (like Cloudflare Email Routing) or DMARC reporting mailboxes (`rua` / `ruf`) are configured. Without MX records, mail routing fails and emails bounce.
* **Prefer Webhook Messaging (Telegram)**: For lightweight home portal alerts, system notifications, or camera snapshot delivery, recommend direct webhook integrations (such as Telegram Bots or Discord Webhooks) over standard email setups. This bypasses DNS validations, supports instant rich alerts, and removes third-party mail intermediaries.

## 8. Cross-Platform PowerShell & VM Scripting Invariants
* **PowerShell ASCII Scripting Invariants:** PowerShell script files (`.ps1`) intended for local developer execution must be saved in **100% pure 7-bit ASCII**. Do not use Unicode characters like checkmarks (`✔`), as Windows PowerShell parses files using legacy OEM code pages (e.g. CP850/CP437) by default, causing multi-byte encoding mismatches that corrupt quote boundaries and trigger compiler errors.
* **PowerShell Quote Escaping:** In PowerShell scripting, use the backtick (`` ` ``) rather than backslash (`\`) to escape quotes inside double-quoted strings. To avoid escaping conflicts altogether, prefer the format operator (`-f`) with single-quoted templates.
* **Avoid npx Script Freezes:** Always include the `--yes` or `-y` flag in automated script command runners (like `npx`) to prevent hidden interactive npm prompts (e.g. "Ok to proceed? (y)") from freezing background execution.
* **Non-Interactive Wrangler Prevention:** When writing setup/deployment scripts that automate Cloudflare Wrangler commands (like database creation, secret binding, or migrations), never redirect stdout/stderr to variables (e.g. `$db = wrangler ...` or `OUTPUT=$(wrangler ...)`). Redirecting output hides TTY authentication, triggering Cloudflare CLI "non-interactive environment" errors. Always run these commands directly or prompt users to enter/paste IDs interactively.
* **ARM64 VM Installer Detection:** VM installer scripts that download binary dependencies (like `cloudflared`) must detect host architectures dynamically (`uname -m`) to ensure `arm64` deb/rpm packages are downloaded for Oracle Free Tier ARM instances instead of hardcoded `amd64` packages.
* **Wildcard Port 80 Routing Conflict:** When configuring standard static Nginx servers alongside control panels (like HestiaCP), remember that Nginx favors explicit IP bindings (`listen 10.0.0.x:80;`) over wildcard bindings (`listen 80;`). Always map custom static blocks to the explicit host interface IP to prevent default control panel proxy blocks from intercepting and throwing 502 Bad Gateway errors.

## 9. Cloudflare Portal & Dashboard Navigation Rules
* **Workers & Pages Consolidated Setup Bypass:** In the consolidated Workers & Pages creation wizard, if a repository contains a `wrangler.toml` file, Cloudflare will default to creating a Worker. To deploy a static website Page project instead, you must scroll to the bottom of the page and click the small link **`Looking to deploy Pages? Get started`** to open the Pages-specific Git importer.
* **Zero Trust Public Hostnames Tab Name:** In the Cloudflare Zero Trust tunnel dashboard, the tab for routing public domains (e.g. mapping `smartniwas.com` to local port 80) is named **`Published application routes`** on some layouts instead of "Public Hostname".

## 10. Cloudflare Serverless APIs & DB Integrity
* **Pages Redirects Absolute URL Bypass**: Cloudflare Pages `_redirects` files do not support `200` proxy rewrites pointing to absolute external URLs (only relative local paths are allowed). To proxy `/api/*` requests from a Pages frontend to a serverless Worker API backend, always use a Cloudflare Pages Function at `functions/api/[[path]].js` that intercepts requests and forwards them using a background `fetch` command.
* **D1 NOT NULL Password Constraints**: When inviting users without pre-set credentials, if the database schema enforces a `NOT NULL` constraint on the `password_hash` column, insert an empty string `''` (not `NULL`) as the placeholder. Ensure both the login API and authentication middleware treat `''` and `NULL` as valid triggers for first-time password setup.



