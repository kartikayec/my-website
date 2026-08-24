#!/bin/bash
# SmartNiwas Oracle VM Nginx Web Server Auto-Setup Script

echo "=================================================="
echo " Starting SmartNiwas Oracle VM Nginx Configuration"
echo "=================================================="

# 1. Update system package index
echo "Updating system packages..."
sudo apt-get update --allow-releaseinfo-change

# 2. Install Nginx and Git
echo "Installing Nginx, Git, and utilities..."
sudo apt install nginx git curl -y

# 3. Create Web Directory and structure
echo "Configuring portal landing folder /var/www/smartniwas-menu..."
sudo mkdir -p /var/www/smartniwas-menu

# Copy the menu page and auth assets to target folder
if [ -d "js" ]; then
  sudo cp -r js /var/www/smartniwas-menu/
  echo "✔ js assets directory copied to web directory."
fi

if [ -f "demo-auth.html" ]; then
  sudo cp demo-auth.html /var/www/smartniwas-menu/demo-auth.html
  echo "✔ demo-auth.html copied to web directory."
fi

if [ -f "index.html" ]; then
  sudo cp index.html /var/www/smartniwas-menu/index.html
  echo "✔ index.html copied to web directory."
else
  # Fallback: create empty landing page if run standalone
  echo "Warning: index.html not found in current directory. Creating basic index.html..."
  sudo bash -c 'cat <<EOF > /var/www/smartniwas-menu/index.html
<!DOCTYPE html>
<html>
<head><title>SmartNiwas Hub</title></head>
<body><h1>SmartNiwas Hub Loading...</h1></body>
</html>
EOF'
fi

# 4. Create Nginx Virtual Host config
echo "Creating Nginx configuration block..."
sudo bash -c 'cat <<EOF > /etc/nginx/sites-available/smartniwas-menu
server {
    listen 80;
    server_name smartniwas.com www.smartniwas.com;

    root /var/www/smartniwas-menu;
    index index.html demo-auth.html;

    location = /demo-auth {
        rewrite ^/demo-auth$ /demo-auth.html last;
    }

    location /api/ {
        proxy_pass https://portal.smartniwas.com/api/;
        proxy_set_header Host portal.smartniwas.com;
        proxy_ssl_server_name on;
    }

    location / {
        try_files \$uri \$uri/ \$uri.html =404;
    }
}
EOF'

# 5. Enable the virtual host and restart Nginx
echo "Enabling virtual host symlinks..."
if [ -f "/etc/nginx/sites-enabled/default" ]; then
  sudo rm -f /etc/nginx/sites-enabled/default
  echo "✔ Removed default site template."
fi

sudo ln -sf /etc/nginx/sites-available/smartniwas-menu /etc/nginx/sites-enabled/

echo "Testing Nginx configuration syntax..."
if sudo nginx -t; then
  echo "Restarting Nginx service..."
  sudo systemctl restart nginx
  sudo systemctl enable nginx
  echo "✔ Nginx web server configured and restarted."
else
  echo "Error: Nginx configuration check failed. Please check logs."
  exit 1
fi

# 6. Install Cloudflare Tunnel Client (cloudflared)
if ! command -v cloudflared &> /dev/null; then
  echo "Installing Cloudflare Tunnel client (cloudflared)..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
    CF_ARCH="amd64"
  elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    CF_ARCH="arm64"
  else
    CF_ARCH="386"
  fi
  echo "Detected architecture: $ARCH. Downloading cloudflared for $CF_ARCH..."
  curl -L --output cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.deb"
  sudo dpkg -i cloudflared.deb
  rm -f cloudflared.deb
  if command -v cloudflared &> /dev/null; then
    echo "✔ cloudflared client installed."
  else
    echo "Error: cloudflared installation failed."
    exit 1
  fi
else
  echo "✔ cloudflared is already installed."
fi

echo "=================================================="
echo " Setup Complete!"
echo " Web server is running. Follow Part 3 of the guide"
echo " to authenticate your Cloudflare Tunnel (cloudflared login)"
echo "=================================================="
