# Deployment Guide - Environment Variables

Since `.env` files are gitignored for security, you need to set environment variables during the build process. Here are the options:

## Option 1: Local Build with .env.production (Recommended for Manual Deployments)

1. Create a `.env.production` file in your project root (this should also be gitignored)
2. Copy your Firebase config values into it:
   ```
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Deploy to Firebase:
   ```bash
   firebase deploy --only hosting
   ```

## Option 2: Export Variables Before Build (Quick Manual Method)

Before running the build command, export the variables:

**Windows (PowerShell):**
```powershell
$env:VITE_FIREBASE_API_KEY="your-api-key"
$env:VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID="your-project-id"
$env:VITE_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
$env:VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
$env:VITE_FIREBASE_APP_ID="your-app-id"
$env:VITE_FIREBASE_MEASUREMENT_ID="your-measurement-id"
npm run build
firebase deploy --only hosting
```

**Windows (CMD):**
```cmd
set VITE_FIREBASE_API_KEY=your-api-key
set VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
set VITE_FIREBASE_PROJECT_ID=your-project-id
set VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
set VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
set VITE_FIREBASE_APP_ID=your-app-id
set VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
npm run build
firebase deploy --only hosting
```

**Mac/Linux:**
```bash
export VITE_FIREBASE_API_KEY="your-api-key"
export VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
export VITE_FIREBASE_PROJECT_ID="your-project-id"
export VITE_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
export VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
export VITE_FIREBASE_APP_ID="your-app-id"
export VITE_FIREBASE_MEASUREMENT_ID="your-measurement-id"
npm run build
firebase deploy --only hosting
```

## Option 3: CI/CD Pipeline (Recommended for Automated Deployments)

If you're using GitHub Actions, GitLab CI, or similar:

1. Add environment variables as **Secrets** in your repository settings
2. In your CI/CD workflow file, reference them during build:

**Example GitHub Actions (.github/workflows/deploy.yml):**
```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

## Option 4: Build Scripts (Easiest for Local Deployments)

We've included helper scripts to make building easier:

**Windows (PowerShell):**
```powershell
.\build-production.ps1
firebase deploy --only hosting
```

**Mac/Linux:**
```bash
chmod +x build-production.sh
./build-production.sh
firebase deploy --only hosting
```

These scripts will:
1. Check for `.env.production` file
2. Load environment variables from it
3. Run the build with those variables
4. Report success/failure

**First-time setup:**
1. Copy your `.env` file to `.env.production` (or create it manually)
2. Ensure it contains all the `VITE_FIREBASE_*` variables
3. Run the build script

## Important Notes:

1. **Never commit `.env` or `.env.production` files** - they contain sensitive API keys
2. **The `.env.example` file is safe to commit** - it only shows the structure, not actual values
3. **Environment variables are embedded at build time** - they become part of your JavaScript bundle
4. **Firebase API keys are safe to expose** - they're meant to be public, but should have domain restrictions in Firebase Console
5. **Always verify your build** - Check the browser console after deployment to ensure Firebase initializes correctly

## Verifying Your Deployment:

After deploying, check the browser console. You should see:
- No errors about missing API keys
- Firebase initializing successfully
- The validation messages in `firebase.ts` should not appear (unless there's an actual issue)

## Getting Your Firebase Config:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → Project Settings
4. Scroll down to "Your apps" section
5. Click on your web app (or create one)
6. Copy the config values from the `firebaseConfig` object

