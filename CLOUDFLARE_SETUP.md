# Cloudflare Zero Trust Setup Guide for SmartNiwas

This guide explains how to configure Cloudflare Tunnels, DNS, WebSockets, and Access policies to securely connect your private Raspberry Pi (MQTT) and Hikvision NVR to `smartniwas.com`.

```
                  ┌───────────────── Cloudflare Edge ─────────────────┐
                  │                                                   │
                  │   ┌───────────────────┐    ┌─────────────────┐    │
                  │   │  smartniwas.com   │    │  Cloudflare     │    │
                  │   │  (Pages Website)  │    │  Access (OTP)   │    │
                  │   └─────────┬─────────┘    └────────┬────────┘    │
                  │             │                       │             │
┌───────────┐     │             ▼                       ▼             │     ┌──────────────┐
│  Browser  ├─────┼───► wss://mqtt.smartniwas.com ──► [Gate] ────────┼────►│ cloudflared  │ (Raspberry Pi)
│  Client   ├─────┼───► https://cctv.smartniwas.com ─► [Gate] ───────┼────►│   Tunnel     │
└───────────┘     │                                                   │     └──────┬───────┘
                  └───────────────────────────────────────────────────┘            │
                                                                                   ├─► ws://localhost:9001 (MQTT)
                                                                                   └─► http://<NVR_IP>:80 (Hikvision)
```

---

## Part 1: Configure Mosquitto WebSockets (On your Raspberry Pi)

Browsers cannot connect to raw TCP ports (like default `1883`). You must ensure Mosquitto is configured to accept WebSockets.

1. SSH into your Raspberry Pi.
2. Edit your Mosquitto configuration file:
   ```bash
   sudo nano /etc/mosquitto/conf.d/websockets.conf
   ```
3. Add a WebSocket listener. Make sure it binds to all interfaces:
   ```ini
   listener 9001
   protocol websockets
   allow_anonymous false
   password_file /etc/mosquitto/passwd
   ```
4. Restart Mosquitto to apply:
   ```bash
   sudo systemctl restart mosquitto
   ```

---

## Part 2: Install and Run Cloudflare Tunnel (`cloudflared`)

A Cloudflare Tunnel client (`cloudflared`) runs on your local network and creates a secure outbound-only connection to Cloudflare.

### Step 1: Install cloudflared on Raspberry Pi
Run the following commands on your Raspberry Pi:
```bash
# Add Cloudflare package repository
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared-stable-release.pub.gpg/ cloudflared main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install cloudflared
sudo apt-get update && sudo apt-get install cloudflared
```

### Step 2: Authenticate and Create Tunnel
1. Log in to your Cloudflare account:
   ```bash
   cloudflared tunnel login
   ```
   *This will print a URL. Open it in a browser, log in, and authorize your domain `smartniwas.com`.*

2. Create the tunnel:
   ```bash
   cloudflared tunnel create smartniwas-tunnel
   ```
   *Note the generated Tunnel ID (UUID) and credentials file path.*

---

## Part 3: Map Subdomains in the Cloudflare Dashboard

We recommend managing the routing through the **Cloudflare Zero Trust Dashboard** (Cloudflare-managed) rather than local config files.

1. Navigate to the **[Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)**.
2. Go to **Networks** -> **Tunnels**.
3. Choose **Access** (or create a new Cloudflare-managed tunnel if you prefer dashboard setup. If migrating your local tunnel to the dashboard, follow their "Migrate to Dashboard" prompts to run the connector commands).
4. Select your active tunnel and go to **Public Hostnames**.
5. Add the **MQTT Broker Route**:
   - **Subdomain**: `mqtt`
   - **Domain**: `smartniwas.com`
   - **Service Type**: `HTTP` (Note: Cloudflare Tunnel routes WebSocket upgrades through standard HTTP tunnels automatically).
   - **URL**: `http://localhost:9001` (If Mosquitto is on the same machine as cloudflared, otherwise use its private IP).
6. Add the **Hikvision NVR Route** (If you choose to enable the CCTV module):
   - **Subdomain**: `cctv`
   - **Domain**: `smartniwas.com`
   - **Service Type**: `HTTP`
   - **URL**: `http://<nvr-local-ip>:80` (Replace with your NVR's local IP and port).
7. Save both. Cloudflare will automatically add the CNAME records to your DNS zone.

---

## Part 4: Enable WebSockets on the Cloudflare Domain

Cloudflare must be configured to allow WebSocket traffic on your domain:

1. In the main Cloudflare Dashboard, select your domain **smartniwas.com**.
2. In the left menu, navigate to **Network**.
3. Locate the **WebSockets** toggle and ensure it is switched **ON**.

---

## Part 5: Secure the Subdomains via Cloudflare Access (Zero Trust Gate)

To ensure your home IoT broker and private security cameras are protected from public access, you **must** lock them behind Cloudflare Access policies.

1. Go to the **Zero Trust Dashboard** -> **Access** -> **Applications**.
2. Click **Add an application** -> Select **Self-hosted**.
3. Configure the application details:
   - **Application Name**: `SmartNiwas Secure Subdomains`
   - **Session Duration**: `1 Month` (so family members don't have to log in daily).
4. Add the domains to protect:
   - **Domain 1**: Subdomain = `mqtt`, Domain = `smartniwas.com`
   - **Domain 2**: Subdomain = `cctv`, Domain = `smartniwas.com` (If CCTV is enabled)
   - **Domain 3**: Subdomain = `(leave blank)`, Domain = `smartniwas.com` (To protect the main web portal itself)
5. Under **Identity Providers**, select **One-time PIN (OTP)**.
6. Click **Next** to create the policy:
   - **Policy Name**: `Family Access Only`
   - **Action**: `Allow`
   - **Configure rules**: Include -> **Emails** -> Add your family member email addresses (e.g., `kartikay@smartniwas.com`, `aditi@smartniwas.com`, etc.).
7. Click **Next** and click **Add Application**.

Now, anyone visiting your website, loading your CCTV feeds, or making connections to your MQTT broker must first pass a Cloudflare login gate using their approved email address.
