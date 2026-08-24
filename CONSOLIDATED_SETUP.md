# SmartNiwas Consolidated Infrastructure Setup Manual

This document details how to configure the SmartNiwas ecosystem using **Cloudflare Serverless** and your **Oracle Free Tier VM** after the lapse of your cPanel hosting.

---

## Part 1: Cloudflare Subdomain Restructuring

Follow these steps in your **Cloudflare Dashboard** to re-route your sub-apps:

1. **Member Portal (`portal.smartniwas.com`)**:
   - Go to **Workers & Pages** -> **smartniwas** Pages project -> **Custom Domains**.
   - Delete `smartniwas.com` and `www.smartniwas.com`.
   - Click **Set up a custom domain** and bind **`portal.smartniwas.com`**.

2. **Cash Flow & Payments (`cashflow.smartniwas.com`)**:
   - After deploying the Cash Flow Pages frontend (detailed in Part 2), map its custom domain to **`cashflow.smartniwas.com`**.

3. **Tickets & Tasks (`tickets.smartniwas.com`)**:
   - Open your `todo-email-reminders` Pages project -> **Custom Domains** and bind **`tickets.smartniwas.com`**.

---

## Part 2: Deploying the Cash Flow System on Cloudflare Serverless

### 1. Initialize the Cloudflare D1 SQLite Database
Navigate to the `cashflow` folder in your terminal and execute:
```bash
# Create the D1 Database
npx wrangler d1 create smartniwas_cashflow
```
*Note the generated **Database ID** output in your terminal.*

### 2. Configure Wrangler Bindings
Open [`cashflow/wrangler.toml`](file:///c:/Users/karti/OneDrive/Antigravity/Projects/smartniwas/cashflow/wrangler.toml) and replace `PLACEHOLDER_DATABASE_ID` with the Database ID generated in the previous step:
```toml
[[d1_databases]]
binding = "DB"
database_name = "smartniwas_cashflow"
database_id = "your-actual-d1-uuid-here"
```

### 3. Load the SQL Schema
Run this command to build the tables inside your Cloudflare D1 database:
```bash
npx wrangler d1 execute smartniwas_cashflow --file=schema.sql
```

### 4. Set Worker Secrets (Resend Email API Key)
Bind your Resend API token securely to the Worker:
```bash
npx wrangler secret put RESEND_API_KEY
```
*Paste your `re_xxxx` API key when prompted.*

### 5. Deploy the Worker and Frontend
1. Deploy the API Worker backend:
   ```bash
   npx wrangler deploy
   ```
2. Deploy the Cash Flow frontend Page project on Cloudflare:
   - **Method A: Continuous Git Deployment (Recommended)**:
     - Go to **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git**.
     - Connect your GitHub account and select the `kartikayec/my-website` repository.
     - **Build Configuration**:
       - Framework preset: `None`
       - Build command: *(Leave empty)*
       - Build output directory: `cashflow`
     - Click **Save and Deploy**.
     - Once deployed, go to **Custom Domains** on the project page and map it to **`cashflow.smartniwas.com`**.
     - *Any future git push to the main branch will automatically deploy updates in real-time.*
   
   - **Method B: Manual Asset Upload**:
     - Go to **Workers & Pages** -> **Create Application** -> **Pages** -> **Upload assets**.
     - Name the project `smartniwas-cashflow`.
     - Upload the `index.html` file inside the `cashflow/` folder.
     - Go to **Custom Domains** and map it to **`cashflow.smartniwas.com`**.

---

## Part 3: Deploying the Landing Menu on the Oracle VM

To host the main entry menu (`smartniwas.com` and `www.smartniwas.com`) securely on your Oracle VM without opening public firewall ports:

### 1. Copy the Landing Page Files to the VM
SSH into your Oracle VM and create a web directory:
```bash
sudo mkdir -p /var/www/smartniwas-menu
```
Upload the [`landing-menu/index.html`](file:///c:/Users/karti/OneDrive/Antigravity/Projects/smartniwas/landing-menu/index.html) file to this directory on the VM: `/var/www/smartniwas-menu/index.html`.

### 2. Configure Nginx Server Blocks
1. Install Nginx if not already present:
   ```bash
   sudo apt update && sudo apt install nginx -y
   ```
2. Create a virtual host configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/smartniwas-menu
   ```
3. Paste the following block:
   ```nginx
   server {
       listen 80;
       server_name smartniwas.com www.smartniwas.com;

       root /var/www/smartniwas-menu;
       index index.html;

       location / {
           try_files $uri $uri/ =404;
       }
   }
   ```
4. Enable the site and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/smartniwas-menu /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl restart nginx
   ```

### 3. Route Traffic Securely via Cloudflare Tunnel
Configure the `cloudflared` tunnel on your VM to direct incoming domain requests to Nginx.
1. Open your tunnel configurations:
   ```bash
   nano ~/.cloudflared/config.yml
   ```
2. Update the ingress mapping logic to route the root hosts to local port `80`:
   ```yaml
   tunnel: <YOUR_TUNNEL_UUID>
   credentials-file: /home/ubuntu/.cloudflared/<YOUR_TUNNEL_UUID>.json

   ingress:
     # Main portal menu routes to Nginx
     - hostname: smartniwas.com
       service: http://localhost:80
     - hostname: www.smartniwas.com
       service: http://localhost:80

     # Support Ticket System API routes to Express (port 8080)
     - hostname: api.smartniwas.com
       service: http://localhost:8080

     - service: http_status:404
   ```
3. Map the DNS records in Cloudflare:
   ```bash
   cloudflared tunnel route dns ticketflow-tunnel smartniwas.com
   cloudflared tunnel route dns ticketflow-tunnel www.smartniwas.com
   ```
4. Restart the tunnel service:
   ```bash
   sudo systemctl restart cloudflared
   ```

---

## Part 4: Cloudflare Email Routing Setup (12+ Custom Accounts)

Set up free email forwarding rules for your household members under the Cloudflare dashboard:

1. Select your domain **`smartniwas.com`** in Cloudflare.
2. Go to **Email** -> **Email Routing** -> click **Get Started / Enable Email Routing**.
3. **Verify Destination Addresses**:
   - Go to **Destination addresses** and click **Add destination address**.
   - Input the personal email addresses of your users (e.g. `user1.personal@gmail.com`).
   - Each user will receive a verification email from Cloudflare. They must click the validation link to confirm.
4. **Create Forwarding Rules**:
   - Go to **Routes** -> **Custom addresses** -> click **Create address**.
   - **Custom address**: Enter custom username (e.g., `father`).
   - **Action**: Select `Send to`.
   - **Destination**: Select their verified personal email address from the dropdown.
   - Click **Save**.
5. Repeat this process for all 12+ household members.
