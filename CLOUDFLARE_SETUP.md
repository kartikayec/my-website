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

## Part 1: Configure Mosquitto WebSockets & Local Authentication (On your Raspberry Pi)

Browsers cannot connect to raw TCP ports (like default `1883`). You must configure Mosquitto to accept WebSockets and handle local user authentication securely.

### Step A: Configure WebSockets Listener
1. SSH into your Raspberry Pi.
2. Edit your Mosquitto configuration file:
   ```bash
   sudo nano /etc/mosquitto/conf.d/websockets.conf
   ```
3. Add a WebSocket listener on port `9001` and define the password file:
   ```ini
   # WebSocket listener for web browser portal
   listener 9001
   protocol websockets
   allow_anonymous false
   password_file /etc/mosquitto/passwd

   # Standard TCP listener (for physical local smart devices)
   listener 1883
   protocol mqtt
   allow_anonymous false
   password_file /etc/mosquitto/passwd
   ```

### Step B: Manage Mosquitto User Credentials
If you haven't created a password file or want to set up credentials for the portal:
1. Create a new password file and add the first user (replace `smartuser` with your username):
   ```bash
   sudo mosquitto_passwd -c /etc/mosquitto/passwd smartuser
   ```
   *Note: The `-c` flag creates a new file. If the file already exists, omit `-c` to avoid overwriting existing users.*
2. Add or update subsequent users:
   ```bash
   sudo mosquitto_passwd /etc/mosquitto/passwd another_user
   ```

### Step C: Test Local MQTT Connections
To verify the broker is working locally on the Pi before exposing it to Cloudflare:
1. Install Mosquitto command-line client tools on the Pi:
   ```bash
   sudo apt-get install mosquitto-clients
   ```
2. Open one terminal session to subscribe to your topics:
   ```bash
   mosquitto_sub -h localhost -p 1883 -t "smartniwas/#" -u "smartuser" -P "your_password"
   ```
3. Open another terminal session to publish a test message:
   ```bash
   mosquitto_pub -h localhost -p 1883 -t "smartniwas/test" -m "Local Test" -u "smartuser" -P "your_password"
   ```
4. Verify the message is printed in the subscribing terminal.

### Step D: Restart Mosquitto and Enable Boot Persistence
```bash
sudo systemctl restart mosquitto
sudo systemctl enable mosquitto
```

### Step E: Configure a Static Local IP for your Pi
Ensure the Raspberry Pi has a persistent IP address on your home router. 
* **Method 1 (Recommended)**: Log in to your home router's admin portal, find the Raspberry Pi in the DHCP clients list, and configure a **DHCP Reservation** so it is always assigned the same IP.
* **Method 2 (Local config)**: If router reservation is not possible, configure a static IP on the Pi by editing `/etc/dhcpcd.conf` (or via `nmcli` depending on your OS version).

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
