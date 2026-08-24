#!/bin/bash
# SmartNiwas Cloudflare D1 & Worker Auto-Setup Script

echo "=================================================="
echo " Starting SmartNiwas D1 & Worker Setup"
echo "=================================================="

# 1. Verify wrangler authentication
if ! npx wrangler whoami > /dev/null 2>&1; then
  echo "Error: Wrangler is not logged in. Please run: npx wrangler login"
  exit 1
fi

echo "✔ Wrangler is authenticated."

# 2. Create Cloudflare D1 database
echo "Creating Cloudflare D1 Database 'smartniwas_cashflow'..."
D1_OUTPUT=$(npx wrangler d1 create smartniwas_cashflow 2>&1)

if echo "$D1_OUTPUT" | grep -q "database_id ="; then
  DB_ID=$(echo "$D1_OUTPUT" | grep "database_id =" | head -n 1 | awk -F'"' '{print $2}')
  echo "✔ D1 Database created successfully. ID: $DB_ID"
else
  # Check if database already exists and retrieve ID
  echo "Database might already exist, fetching existing ID..."
  DB_ID=$(npx wrangler d1 list --json | grep -o '"database_id":"[^"]*' | grep -o '[^"]*$' | head -n 1)
  if [ -z "$DB_ID" ]; then
    echo "Error: Could not retrieve D1 Database ID. Output:"
    echo "$D1_OUTPUT"
    exit 1
  fi
  echo "✔ Found existing D1 Database. ID: $DB_ID"
fi

# 3. Update wrangler.toml with the D1 Database ID
if [ -f "wrangler.toml" ]; then
  echo "Updating wrangler.toml with D1 Database ID: $DB_ID..."
  # Backup wrangler.toml
  cp wrangler.toml wrangler.toml.bak
  # Replace placeholder
  sed -i "s/database_id = \"PLACEHOLDER_DATABASE_ID\"/database_id = \"$DB_ID\"/g" wrangler.toml
  echo "✔ wrangler.toml updated."
else
  echo "Error: wrangler.toml not found in the current directory."
  exit 1
fi

# 4. Load the D1 SQLite Schema
echo "Executing SQL schema migration on Cloudflare D1..."
if [ -f "schema.sql" ]; then
  npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --local
  npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --remote
  echo "✔ SQL Schema applied successfully."
else
  echo "Error: schema.sql not found."
  exit 1
fi

# 5. Set Resend secrets
echo "--------------------------------------------------"
echo "Please enter your Resend API Key (re_xxxx):"
read -r RESEND_KEY
if [ -n "$RESEND_KEY" ]; then
  echo "Setting RESEND_API_KEY secret on Cloudflare Workers..."
  echo "$RESEND_KEY" | npx wrangler secret put RESEND_API_KEY
  echo "✔ Secret bound successfully."
else
  echo "Skipped setting Resend API key secret. You can set it manually later."
fi

# 6. Deploy Worker
echo "Deploying Cloudflare Worker API..."
npx wrangler deploy

echo "=================================================="
echo " Setup Complete!"
echo " Worker URL, D1 Bindings, and Cron tasks are active."
echo "=================================================="
