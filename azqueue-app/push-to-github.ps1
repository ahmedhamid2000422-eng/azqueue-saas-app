# AzQueue — Push to GitHub & Deploy to Vercel
# Run this in PowerShell from the azqueue-app folder

Write-Host "`n=== AzQueue GitHub Setup ===" -ForegroundColor Cyan

# ── Step 1: Initialize git ─────────────────────────────────────────────
git init -b main
git config user.email "ahmedhamid2000422@gmail.com"
git config user.name "Ahmed Hamid"

# ── Step 2: Commit everything ──────────────────────────────────────────
git add .
git commit -m "Initial commit - AzQueue SaaS queue management platform"

Write-Host "`n✓ Local repo ready." -ForegroundColor Green

# ── Step 3: Create GitHub repo & push ─────────────────────────────────
Write-Host "`nNow do this in 30 seconds:" -ForegroundColor Yellow
Write-Host "  1. Go to https://github.com/new"
Write-Host "  2. Repo name: azqueue-app"
Write-Host "  3. Set to Private (you own the IP)"
Write-Host "  4. Do NOT add README/gitignore (we already have them)"
Write-Host "  5. Click 'Create repository'"
Write-Host "  6. Copy the repo URL (e.g. https://github.com/YOUR_USERNAME/azqueue-app.git)"

$repoUrl = Read-Host "`nPaste your GitHub repo URL here"

git remote add origin $repoUrl
git push -u origin main

Write-Host "`n✓ Code is on GitHub!" -ForegroundColor Green

# ── Step 4: Vercel deployment ──────────────────────────────────────────
Write-Host "`n=== Deploy to Vercel ===" -ForegroundColor Cyan
Write-Host "  1. Go to https://vercel.com/new"
Write-Host "  2. Click 'Import Git Repository'"
Write-Host "  3. Select your azqueue-app repo"
Write-Host "  4. Framework: Vite (auto-detected)"
Write-Host "  5. Add Environment Variables:"
Write-Host "     VITE_SUPABASE_URL       = (from your .env.local)"
Write-Host "     VITE_SUPABASE_ANON_KEY  = (from your .env.local)"
Write-Host "     VITE_OPENAI_API_KEY     = (from your .env.local, optional)"
Write-Host "  6. Click Deploy"
Write-Host "`n  Once deployed, go to Project Settings → Domains to add your custom domain."

Write-Host "`n=== Custom Domain ===`n" -ForegroundColor Cyan
Write-Host "  Recommended registrars: Namecheap, Google Domains, Cloudflare Registrar"
Write-Host "  Suggested names: azqueue.io / getazqueue.com / azqueue.app"
Write-Host "  Point DNS to Vercel from Project Settings → Domains → Add."
Write-Host "`n  That's it! Future deploys happen automatically on every git push.`n"
