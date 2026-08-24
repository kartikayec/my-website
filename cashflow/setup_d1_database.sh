#!/bin/bash
# SmartNiwas Cloudflare D1 & Worker Auto-Setup Script (Bash)

echo "=================================================="
echo " Starting SmartNiwas D1 & Worker Setup"
echo "=================================================="

# 1. Ask user to create the database interactively to bind session tokens
echo "Step 1: If you have not created your D1 database, run this in a separate terminal:"
echo "npx wrangler d1 create smartniwas_cashflow"
echo ""

echo "Please enter/paste your D1 Database ID (UUID):"
read -r DB_ID
DB_ID=$(echo "$DB_ID" | xargs) # trim whitespace

if [ -z "$DB_ID" ]; then
  echo "Error: D1 Database ID cannot be empty. Please run the script again."
  exit 1
fi

# 2. Update wrangler.toml with the D1 Database ID
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

# 3. Load the D1 SQLite Schema
echo "Executing SQL schema migration on Cloudflare D1..."
if [ -f "schema.sql" ]; then
  npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --local
  npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --remote
  echo "✔ SQL Schema applied successfully."
else
  echo "Error: schema.sql not found."
  exit 1
fi

# 4. Set Resend secrets
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

# 5. Deploy Worker
echo "Deploying Cloudflare Worker API..."
npx wrangler deploy

echo "=================================================="
echo " Setup Complete!"
echo " Worker URL, D1 Bindings, and Cron tasks are active."
echo "=================================================="
