# SmartNiwas Cloudflare D1 & Worker Auto-Setup Script (PowerShell)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Starting SmartNiwas D1 & Worker Setup (PowerShell)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Ask user to create the database interactively to bind session tokens
Write-Host "Step 1: If you have not created your D1 database, run this in a separate terminal:" -ForegroundColor Yellow
Write-Host "npx wrangler d1 create smartniwas_cashflow" -ForegroundColor Gray
Write-Host ""

$dbId = Read-Host -Prompt "Please enter/paste your D1 Database ID (UUID)"
$dbId = $dbId.Trim()

if (-not $dbId) {
    Write-Error "D1 Database ID cannot be empty. Please run the script again."
    exit 1
}

# 2. Update wrangler.toml with the D1 Database ID
if (Test-Path "wrangler.toml") {
    Write-Host "Updating wrangler.toml with D1 Database ID: $dbId..." -ForegroundColor Cyan
    Copy-Item wrangler.toml wrangler.toml.bak -Force
    $content = Get-Content wrangler.toml -Raw
    $replacement = 'database_id = "{0}"' -f $dbId
    $content = $content -replace 'database_id = "PLACEHOLDER_DATABASE_ID"', $replacement
    Set-Content wrangler.toml $content -NoNewline
    Write-Host "[OK] wrangler.toml updated." -ForegroundColor Green
} else {
    Write-Error "wrangler.toml not found in the current directory."
    exit 1
}

# 3. Load the D1 SQLite Schema
Write-Host "Executing SQL schema migration on Cloudflare D1..." -ForegroundColor Cyan
if (Test-Path "schema.sql") {
    # Run directly (no redirection) to preserve TTY interactivity
    npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --local
    npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --remote
    Write-Host "[OK] SQL Schema applied successfully." -ForegroundColor Green
} else {
    Write-Error "schema.sql not found."
    exit 1
}

# 4. Set Resend secrets
$resendKey = Read-Host -Prompt "Please enter your Resend API Key (re_xxxx)"
if ($resendKey) {
    Write-Host "Setting RESEND_API_KEY secret on Cloudflare Workers..." -ForegroundColor Cyan
    # Run interactively so wrangler can prompt for authorization if needed
    $resendKey | npx wrangler secret put RESEND_API_KEY
    Write-Host "[OK] Secret bound successfully." -ForegroundColor Green
} else {
    Write-Host "Skipped setting Resend API key secret. You can set it manually later."
}

# 5. Deploy Worker
Write-Host "Deploying Cloudflare Worker API..." -ForegroundColor Cyan
npx wrangler deploy

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Setup Complete!" -ForegroundColor Cyan
Write-Host " Worker URL, D1 Bindings, and Cron tasks are active."
Write-Host "==================================================" -ForegroundColor Cyan
