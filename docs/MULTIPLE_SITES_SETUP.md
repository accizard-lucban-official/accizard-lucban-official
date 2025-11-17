# Firebase Hosting - Multiple Sites Setup Guide

This guide explains how to host multiple websites in the same Firebase project.

## Overview

Firebase Hosting supports multiple sites within a single project. Each site gets its own:
- Hosting URL (e.g., `site1.web.app`, `site2.web.app`)
- Custom domain support
- Independent deployment history
- Separate configuration

## Step 1: Create the New Site in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **accizard-lucban-official-65ba3**
3. Navigate to **Hosting** in the left sidebar
4. Click **Add another site** or **Add site**
5. Enter a site ID (e.g., `second-website` or `landing-page`)
   - Site ID must be lowercase, alphanumeric, and can contain hyphens
   - Example: `second-website`, `landing-page`, `admin-dashboard`
6. Click **Continue**
7. Firebase will create the site and provide you with:
   - Default URL: `your-site-id.web.app`
   - Default URL: `your-site-id.firebaseapp.com`

## Step 2: Update Firebase Configuration Files

### Update `.firebaserc`

Add your new site to the `.firebaserc` file:

```json
{
  "projects": {
    "default": "accizard-lucban-official-65ba3"
  },
  "targets": {
    "accizard-lucban-official-65ba3": {
      "hosting": {
        "main-app": [
          "accizard-web-app"  // Your existing site ID
        ],
        "second-site": [
          "your-new-site-id"  // Replace with your new site ID
        ]
      }
    }
  }
}
```

### Update `firebase.json`

Convert the single hosting configuration to an array to support multiple sites:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": [
    {
      "bucket": "accizard-lucban-official-65ba3.firebasestorage.app",
      "rules": "storage.rules"
    }
  ],
  "hosting": [
    {
      "target": "main-app",
      "public": "dist",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        },
        {
          "source": "**/*.@(js|css)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        },
        {
          "source": "/index.html",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "no-cache, no-store, must-revalidate"
            }
          ]
        }
      ]
    },
    {
      "target": "second-site",
      "public": "path/to/second-site/dist",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        },
        {
          "source": "**/*.@(js|css)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        },
        {
          "source": "/index.html",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "no-cache, no-store, must-revalidate"
            }
          ]
        }
      ]
    }
  ],
  "emulators": {
    "hosting": {
      "port": 5000
    },
    "ui": {
      "enabled": true
    },
    "singleProjectMode": true
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run lint",
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ]
    }
  ]
}
```

**Important Notes:**
- `"target"` maps to the target name in `.firebaserc`
- `"public"` should point to the build output directory of each site
- Each site can have its own configuration (rewrites, headers, etc.)

## Step 3: Project Structure Options

You have several options for organizing multiple sites:

### Option A: Separate Directories (Recommended)

```
project-root/
├── main-app/              # Your current AcciZard app
│   ├── src/
│   ├── dist/              # Build output
│   ├── package.json
│   └── vite.config.ts
├── second-site/           # Your second website
│   ├── src/
│   ├── dist/              # Build output
│   ├── package.json
│   └── vite.config.ts
├── firebase.json
├── .firebaserc
└── functions/
```

### Option B: Monorepo with Shared Code

```
project-root/
├── apps/
│   ├── main-app/
│   └── second-site/
├── packages/
│   └── shared/            # Shared components/utils
├── firebase.json
└── .firebaserc
```

### Option C: Separate Repositories

Keep sites in separate repositories and deploy them independently. Each repo would have its own `firebase.json` pointing to different site IDs.

## Step 4: Deployment Commands

### Deploy a Specific Site

```bash
# Deploy only the main app
firebase deploy --only hosting:main-app

# Deploy only the second site
firebase deploy --only hosting:second-site

# Deploy both sites
firebase deploy --only hosting
```

### Deploy with Build

For each site, you'll need to build before deploying:

```bash
# Main app
cd main-app
npm run build
cd ..
firebase deploy --only hosting:main-app

# Second site
cd second-site
npm run build
cd ..
firebase deploy --only hosting:second-site
```

## Step 5: Update GitHub Actions (If Using CI/CD)

If you're using GitHub Actions for automatic deployments, update your workflow files:

### Option 1: Deploy Both Sites on Push

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [ main ]

jobs:
  deploy-main-app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build Main App
        run: |
          cd main-app
          npm ci
          npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          # ... other env vars
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: accizard-lucban-official-65ba3
          target: main-app

  deploy-second-site:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build Second Site
        run: |
          cd second-site
          npm ci
          npm run build
        env:
          # Add env vars for second site if needed
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: accizard-lucban-official-65ba3
          target: second-site
```

### Option 2: Deploy Based on Changed Files

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [ main ]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      main-app: ${{ steps.filter.outputs.main-app }}
      second-site: ${{ steps.filter.outputs.second-site }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            main-app:
              - 'main-app/**'
            second-site:
              - 'second-site/**'

  deploy-main-app:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.main-app == 'true' }}
    runs-on: ubuntu-latest
    steps:
      # ... build and deploy main-app

  deploy-second-site:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.second-site == 'true' }}
    runs-on: ubuntu-latest
    steps:
      # ... build and deploy second-site
```

## Step 6: Custom Domains

Each site can have its own custom domain:

1. Go to Firebase Console → Hosting
2. Select the site you want to configure
3. Click **Add custom domain**
4. Follow the DNS configuration instructions
5. Firebase will automatically provision SSL certificates

## Step 7: Environment Variables

If your second site needs different environment variables:

### Option A: Separate .env Files

```
main-app/.env.production
second-site/.env.production
```

### Option B: Use Different Variable Prefixes

```bash
# Main app
VITE_APP_NAME=AcciZard

# Second site
VITE_SECOND_SITE_NAME=Landing Page
```

## Troubleshooting

### Error: "Service Account User" Permission Denied

**Symptom:**
```
Service account: accizard-lucban@appspot.gserviceaccount.com (old project)
URL: project=accizard-lucban (old project)
But we're using: Project: accizard-lucban-official-65ba3 (new project)
```

**Cause:**
The error message may reference an old project's service account, but the actual issue is that your user account doesn't have the "Service Account User" role in the new project.

**Solution:**
1. Go to the new project's IAM page:
   - https://console.cloud.google.com/iam-admin/iam?project=accizard-lucban-official-65ba3
2. Find your email address (e.g., `accizardlucbanofficial22@gmail.com`)
3. Click **Edit** (pencil icon) next to your email
4. Click **Add Another Role**
5. Select **Service Account User** from the dropdown
6. Click **Save**
7. The service account that needs permission is:
   - `accizard-lucban-official-65ba3@appspot.gserviceaccount.com`
8. Try deploying again: `firebase deploy --only hosting:your-target-name`

**Note:** Make sure you're adding the role in the **new project** (`accizard-lucban-official-65ba3`), not the old one.

### Error: "Target not found"

- Make sure the target name in `firebase.json` matches the target name in `.firebaserc`
- Verify the site ID exists in Firebase Console

### Error: "Site not found"

- Create the site in Firebase Console first
- Verify the site ID in `.firebaserc` matches the site ID in Firebase Console

### Build Output Not Found

- Ensure the `public` path in `firebase.json` points to the correct build directory
- Verify the build command creates output in the expected location

### GitHub Actions Deployment Fails with Service Account Error

If you're using GitHub Actions and getting service account errors:

1. **Verify the GitHub Secret:**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Check that `FIREBASE_SERVICE_ACCOUNT_ACCIZARD_LUCBAN` contains the JSON key for the **new project**
   - If it contains the old project's key, generate a new service account key:
     - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=accizard-lucban-official-65ba3
     - Find or create a service account
     - Create a new JSON key
     - Update the GitHub secret with the new key

2. **Verify IAM Permissions:**
   - Follow the steps in the "Service Account User Permission Denied" section above
   - Ensure the service account itself has the necessary roles:
     - Firebase Admin SDK Administrator Service Agent
     - Service Account User

## Best Practices

1. **Use descriptive target names**: `main-app`, `landing-page`, `admin-dashboard`
2. **Keep build outputs separate**: Each site should have its own `dist` or `build` directory
3. **Share common code**: If sites share components, consider a monorepo structure
4. **Independent deployments**: Deploy sites independently to avoid unnecessary builds
5. **Environment-specific configs**: Use different environment variables for each site if needed

## Example: Complete Setup

Here's a complete example with two sites:

**`.firebaserc`:**
```json
{
  "projects": {
    "default": "accizard-lucban-official-65ba3"
  },
  "targets": {
    "accizard-lucban-official-65ba3": {
      "hosting": {
        "main-app": ["accizard-web-app"],
        "landing": ["accizard-landing"]
      }
    }
  }
}
```

**`firebase.json` (hosting section):**
```json
"hosting": [
  {
    "target": "main-app",
    "public": "dist",
    "rewrites": [{"source": "**", "destination": "/index.html"}]
  },
  {
    "target": "landing",
    "public": "../accizard-landing/dist",
    "rewrites": [{"source": "**", "destination": "/index.html"}]
  }
]
```

## Next Steps

1. Create the new site in Firebase Console
2. Update `.firebaserc` with the new site target
3. Update `firebase.json` to use hosting array format
4. Organize your project structure
5. Test deployment: `firebase deploy --only hosting:your-target-name`
6. Update CI/CD workflows if needed

For more information, see the [Firebase Hosting Multiple Sites Documentation](https://firebase.google.com/docs/hosting/multisites).

