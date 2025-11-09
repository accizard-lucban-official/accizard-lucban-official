# Firebase Hosting with GitHub Integration Setup Guide

This guide will help you set up automatic deployments from GitHub to Firebase Hosting.

## Method 1: Firebase Console GitHub Integration (Recommended - Easiest)

This method uses Firebase's built-in GitHub integration, which is the simplest approach.

### Step 1: Connect GitHub Repository in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **accizard-lucban-official-65ba3**
3. Navigate to **Hosting** in the left sidebar
4. Click on **Get started** or go to the **Hosting** section
5. Look for **GitHub** or **Connect GitHub** option
6. Click **Connect repository** or **Add GitHub repository**
7. Authorize Firebase to access your GitHub account
8. Select your repository from the list
9. Choose the branch (usually `main` or `master`)
10. Configure build settings:
    - **Build command**: `npm run build`
    - **Output directory**: `dist`
    - **Root directory**: `/` (or leave empty)
11. Click **Save** or **Deploy**

### Step 2: Verify Configuration

Firebase will automatically:
- Create a GitHub Actions workflow (if needed)
- Set up automatic deployments on push to your main branch
- Handle authentication and secrets automatically

### Step 3: Test Deployment

1. Make a small change to your code
2. Commit and push to your main branch
3. Check the Firebase Console Hosting section for deployment status
4. Your site will be automatically deployed!

## Method 2: GitHub Actions Workflow (Alternative)

If you prefer to use the GitHub Actions workflow file we've created, follow these steps:

### Step 1: Get Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **accizard-lucban-official-65ba3**
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select **Project settings**
5. Go to the **Service accounts** tab
6. Click **Generate new private key**
7. Download the JSON file (keep it secure!)

### Step 2: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Copy the entire contents of the JSON file you downloaded
6. Click **Add secret**

### Step 3: Push to GitHub

1. Commit the `.github/workflows/firebase-hosting.yml` file
2. Push to your main branch
3. GitHub Actions will automatically build and deploy on each push

## Verification

After setup, you can verify the deployment by:

1. **Check Firebase Console**:
   - Go to Hosting section
   - You should see deployment history

2. **Check GitHub Actions**:
   - Go to your repository → **Actions** tab
   - You should see workflow runs

3. **Visit your site**:
   - Your Firebase Hosting URL will be: `https://accizard-lucban-official-65ba3.web.app`
   - Or custom domain if configured

## Troubleshooting

### Build Fails
- Check that `npm run build` works locally
- Verify Node.js version in workflow matches your local version
- Check build logs in GitHub Actions or Firebase Console

### Deployment Fails
- Verify Firebase project ID is correct: `accizard-lucban-official-65ba3`
- Check that `dist` directory is being generated
- Ensure `firebase.json` is correctly configured

### Authentication Issues
- Re-authenticate GitHub connection in Firebase Console
- Regenerate service account key if using Method 2

## Current Configuration

- **Project ID**: accizard-lucban-official-65ba3
- **Build Output**: `dist` directory
- **Build Command**: `npm run build`
- **Hosting Config**: `firebase.json`

## Next Steps

1. Choose Method 1 (recommended) for easiest setup
2. Or use Method 2 if you prefer more control
3. Test with a small change and push to main branch
4. Monitor deployments in Firebase Console

