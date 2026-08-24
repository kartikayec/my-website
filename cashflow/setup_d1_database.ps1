# SmartNiwas Cloudflare D1 & Worker Auto-Setup Script (PowerShell)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Starting SmartNiwas D1 & Worker Setup (PowerShell)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Verify wrangler authentication
$whoami = npx wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Wrangler is not logged in. Please run: npx wrangler login"
    exit 1
}

Write-Host "✔ Wrangler is authenticated." -ForegroundColor Green

# 2. Create Cloudflare D1 database
Write-Host "Creating Cloudflare D1 Database 'smartniwas_cashflow'..."
$d1Output = npx wrangler d1 create smartniwas_cashflow 2>&1

$dbId = ""
# Use regex to extract database_id
if ($d1Output -match 'database_id = "([^"]+)"') {
    $dbId = $Matches[1]
    Write-Host "✔ D1 Database created successfully. ID: $dbId" -ForegroundColor Green
} else {
    Write-Host "Database might already exist, fetching existing ID..."
    $listJson = npx wrangler d1 list --json 2>&1
    if ($LASTEXITCODE -eq 0 -and $listJson) {
        $list = $listJson | ConvertFrom-Json
        $db = $list | Where-Object { $_.name -eq "smartniwas_cashflow" } | Select-Object -First 1
        if ($db) {
            $dbId = $db.database_id
            Write-Host "✔ Found existing D1 Database. ID: $dbId" -ForegroundColor Green
        }
    }
    
    if (-not $dbId) {
        Write-Error "Could not retrieve D1 Database ID. Output:"
        Write-Output $d1Output
        exit 1
    }
}

# 3. Update wrangler.toml with the D1 Database ID
if (Test-Path "wrangler.toml") {
    Write-Host "Updating wrangler.toml with D1 Database ID: $dbId..."
    Copy-Item wrangler.toml wrangler.toml.bak -Force
    $content = Get-Content wrangler.toml -Raw
    $content = $content -replace 'database_id = "PLACEHOLDER_DATABASE_ID"', "database_id = `"$dbId`""
    Set-Content wrangler.toml $content -NoNewline
    Write-Host "✔ wrangler.toml updated." -ForegroundColor Green
} else {
    Write-Error "wrangler.toml not found in the current directory."
    exit 1
}

# 4. Load the D1 SQLite Schema
Write-Host "Executing SQL schema migration on Cloudflare D1..."
if (Test-Path "schema.sql") {
    npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --local
    npx wrangler d1 execute smartniwas_cashflow --file=schema.sql --remote
    Write-Host "✔ SQL Schema applied successfully." -ForegroundColor Green
} else {
    Write-Error "schema.sql not found."
    exit 1
}

# 5. Set Resend secrets
$resendKey = Read-Host -Prompt "Please enter your Resend API Key (re_xxxx)"
if ($resendKey) {
    Write-Host "Setting RESEND_API_KEY secret on Cloudflare Workers..."
    $resendKey | npx wrangler secret put RESEND_API_KEY
    Write-Host "✔ Secret bound successfully." -ForegroundColor Green
} else {
    Write-Host "Skipped setting Resend API key secret. You can set it manually later."
}

# 6. Deploy Worker
Write-Host "Deploying Cloudflare Worker API..."
npx wrangler deploy

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Setup Complete!" -ForegroundColor Cyan
Write-Host " Worker URL, D1 Bindings, and Cron tasks are active."
Write-Host "==================================================" -ForegroundColor Cyan
