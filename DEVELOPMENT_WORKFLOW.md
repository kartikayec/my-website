# SmartNiwas Local Development & Git Workflow Guide

This guide outlines the standard operating procedure for developing `smartniwas.com` locally, validating changes, and pushing commits to GitHub for automatic Cloudflare Pages deployment.

---

## 1. Environment Setup (One-time)

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher) — For running Wrangler local emulation.
- **Git** — For version control.

To set up your project dependencies:
1. Open your terminal in the project directory.
2. Run the installation command:
   ```bash
   npm install
   ```

---

## 2. Daily Development Loop

When you want to make changes (edit text, add styling, modify layout):

### Step A: Pull Latest Changes
If you work from multiple machines or make direct edits on GitHub, always ensure your local repository is up to date before editing:
```bash
git pull origin main
```

### Step B: Start the Local Emulation Server
Run the local dev server. This emulates Cloudflare Pages locally:
```bash
npm run dev
```
- Open your browser and navigate to **[http://127.0.0.1:8788](http://127.0.0.1:8788)**.
- Keep this terminal window open in the background. It will automatically re-load static files when you make edits.

### Step C: Write Code
Edit your code files (`index.html`, `style.css`, `app.js`).
- **SEO Rule**: Keep heading hierarchy clean (only one `<h1>` for the site title).
- **Aesthetics**: Ensure glassmorphism overlays and animations are responsive.

---

## 3. Verification & Quality Check

Before staging your changes for Git, perform these checks:

1. **Console Check**: Open Browser Developer Tools (`F12`) and check the **Console** tab. Ensure there are no red JavaScript errors.
2. **Mobile Viewport Check**: Toggle the Device Toolbar in DevTools to simulate mobile screens (iPhone, Android). Confirm the member directory grid collapses to a single column cleanly and the notice board is readable.
3. **Modal Verification**: Click **Add Note**, fill out the custom modal, submit it, and then close it. Ensure the animations transition smoothly and there are no overlapping elements.

---

## 4. Staging, Committing, and Pushing to GitHub

Once your changes are verified locally, you are ready to push them to GitHub.

### Step 1: Check Git Status
See which files were modified:
```bash
git status
```

### Step 2: Stage Changes
Stage only the files you want to commit. Avoid staging `node_modules` (our `.gitignore` should handle this automatically):
```bash
# Stage all changes
git add -A

# OR stage specific files
git add index.html style.css
```

### Step 3: Commit with a Descriptive Message
Create a local commit describing the changes you made:
```bash
git commit -m "feat: updated notice board modal styling and fixed mobile grid spacing"
```

### Step 4: Push to GitHub
Upload your local commits to your remote GitHub repository:
```bash
git push origin main
```

---

## 5. Cloudflare Pages Deployment Verification

Once the push succeeds:
1. Cloudflare Pages will detect the new commit on your `main` branch.
2. It will trigger a build automatically.
3. You can monitor the progress by logging into the **[Cloudflare Dashboard](https://dash.cloudflare.com/)** under **Compute (Workers & Pages)** -> **Pages** -> **smartniwas**.
4. Once the build status turns green, your changes are live at [smartniwas.com](https://smartniwas.com).

---

## 6. Pro-Tips & Gotchas

- **Do Not Deploy Manually via CLI**: Do not run `npx wrangler pages deploy` unless you want to bypass GitHub. Pushing to GitHub keeps the repository as the single source of truth.
- **Handling Merge Conflicts**: If a conflict occurs during a `git pull`, resolve the files manually in your editor, add them (`git add`), and run `git commit` to complete the merge.
