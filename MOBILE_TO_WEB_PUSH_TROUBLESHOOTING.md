# Mobile to Web Push Notifications Troubleshooting Guide

Use this comprehensive guide to troubleshoot why push notifications from mobile to web are not working.

## ✅ Step 1: Verify Cloud Functions Are Deployed

1. **Check if functions are deployed:**
   ```powershell
   firebase functions:list
   ```

2. **Verify these functions exist:**
   - `sendChatNotification`
   - `sendReportCreatedNotification`
   - `sendNewUserRegistrationNotification`

3. **If functions are missing or outdated, deploy them:**
   ```powershell
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions
   ```

---

## ✅ Step 2: Verify Web User Has FCM Token Saved

### For Super Admins:
1. **Open Firebase Console** → Firestore Database
2. **Go to `superAdmin` collection**
3. **Find your document** (by email)
4. **Check for these fields:**
   - `webFcmToken` - Should contain a token string
   - `webFcmTokenUpdatedAt` - Should have a recent timestamp

### For Regular Admins:
1. **Open Firebase Console** → Firestore Database
2. **Go to `admins` collection**
3. **Find your document** (by username)
4. **Check for these fields:**
   - `webFcmToken` - Should contain a token string
   - `webFcmTokenUpdatedAt` - Should have a recent timestamp

### For Regular Users:
1. **Open Firebase Console** → Firestore Database
2. **Go to `users` collection**
3. **Find your document** (by UID)
4. **Check for these fields:**
   - `webFcmToken` - Should contain a token string
   - `webFcmTokenUpdatedAt` - Should have a recent timestamp

**If token is missing:**
- Go to Profile Page in web app
- Toggle push notifications OFF and ON again
- Check browser console for errors during token generation

---

## ✅ Step 3: Verify Mobile User Identification

The Cloud Functions identify mobile users by checking if they have `fcmToken` but NOT `webFcmToken`.

1. **Open Firebase Console** → Firestore Database
2. **Go to `users` collection**
3. **Find the mobile user's document**
4. **Verify:**
   - ✅ `fcmToken` exists (mobile FCM token)
   - ✅ `webFcmToken` does NOT exist (or is null/empty)

**If mobile user has both tokens:**
- The function will treat them as a web user
- Notifications won't be sent to web users
- Solution: Remove `webFcmToken` from mobile user's document

---

## ✅ Step 4: Check Cloud Function Logs

1. **Open Firebase Console** → Functions
2. **Click on `sendChatNotification`** (or `sendReportCreatedNotification`)
3. **Go to "Logs" tab**
4. **Send a test message from mobile app**
5. **Check logs for these messages:**

### Expected Success Logs:
- ✅ `Mobile user sent message, sending notification to web users`
- ✅ `Sending chat notification to X web users` (where X > 0)
- ✅ `Successfully sent chat notification to web user`
- ✅ `Chat notification sent to web users. Success: X, Failed: Y`

### Error Indicators:
- ❌ `No web users with FCM tokens found` → Your token is not in Firestore (go back to Step 2)
- ❌ `Report creator is not a mobile user` → Mobile user has `webFcmToken` (go back to Step 3)
- ❌ `Sender document not found` → Mobile user document doesn't exist
- ❌ `messaging/invalid-registration-token` → Token is invalid, will be auto-removed

---

## ✅ Step 5: Test Chat Notifications

1. **Open web app** (keep it open in foreground)
2. **Send a message from mobile app** to the web admin
3. **Expected behavior:**
   - Browser notification should appear
   - Toast notification should also appear in the app
   - Check browser console for: `Message received in foreground:`

**If no notification appears:**
- Check browser console for errors
- Verify service worker is active (Application tab → Service Workers)
- Check notification permissions: `Notification.permission` should return `"granted"`

---

## ✅ Step 6: Test Report Created Notifications

1. **Open web app** (keep it open)
2. **Create a new report from mobile app**
3. **Expected behavior:**
   - Browser notification should appear: "📋 New Report Submitted"
   - Clicking notification should navigate to reports page

**If no notification appears:**
- Check Cloud Function logs for `sendReportCreatedNotification`
- Verify mobile user has `fcmToken` but not `webFcmToken`
- Check if report was created successfully in Firestore

---

## ✅ Step 7: Verify Service Worker

1. **Open browser DevTools** (F12)
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Click "Service Workers" in left sidebar**
4. **Check:**
   - Service worker should be **"activated and is running"**
   - Status should be **green/active**
   - Scope should be `/`

**If service worker is not active:**
- Hard refresh the page (Ctrl+Shift+R)
- Unregister the service worker and refresh
- Check if `/firebase-messaging-sw.js` is accessible

---

## ✅ Step 8: Check Browser Console

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Look for these messages:**
   - ✅ `Service Worker registered:`
   - ✅ `FCM Token obtained:`
   - ✅ `FCM Token saved to [collection] collection`
   - ✅ `Message received in foreground:`
   - ❌ Any red error messages

**Common errors:**
- `Invalid VAPID key format` → Check VAPID key in `.env`
- `Failed to register service worker` → Check if service worker file exists
- `No registration token available` → VAPID key issue

---

## ✅ Step 9: Verify VAPID Key

1. **Check local `.env` file:**
   ```env
   VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
   ```
   - Should be a base64url string (contains `-`, `_`, `=`)
   - No spaces or newlines
   - Should be 87+ characters long

2. **Check GitHub Secrets** (for deployed version):
   - Go to repository → Settings → Secrets and variables → Actions
   - Verify `VITE_FIREBASE_VAPID_KEY` exists
   - Value should match your local `.env`

3. **Verify VAPID key in Firebase Console:**
   - Firebase Console → Project Settings → Cloud Messaging
   - Web Push certificates → Should show your VAPID key pair

---

## ✅ Step 10: Test Background Notifications

1. **Minimize or switch to another tab** (web app in background)
2. **Send a message from mobile app**
3. **Expected behavior:**
   - Browser notification should appear
   - Clicking notification should open/focus the web app

**If no notification appears:**
- Check service worker logs (Application tab → Service Workers → Inspect)
- Verify `onBackgroundMessage` handler in `firebase-messaging-sw.js`
- Check if service worker is receiving push events

---

## 🔍 Quick Diagnostic Commands

Run these in browser console to check status:

```javascript
// Check notification permission
Notification.permission

// Check service worker registration
navigator.serviceWorker.getRegistration().then(reg => console.log(reg))

// Check if messaging is supported
import('firebase/messaging').then(m => m.isSupported().then(console.log))

// Check localStorage for session
localStorage.getItem('accizard_session')
```

---

## 🐛 Common Issues and Solutions

### Issue: "No web users with FCM tokens found"
**Solution:** 
- Your token is not saved in Firestore
- Go to Profile Page and toggle push notifications OFF and ON again
- Check browser console for errors during token generation

### Issue: "Report creator is not a mobile user"
**Solution:**
- Mobile user has `webFcmToken` in their document
- Remove `webFcmToken` from mobile user's document in Firestore
- Mobile users should only have `fcmToken`, not `webFcmToken`

### Issue: Cloud Function not triggered
**Solution:**
- Verify function is deployed: `firebase functions:list`
- Check Firestore rules allow function to read `chat_messages` and `reports`
- Check function logs for errors

### Issue: Notifications work in foreground but not background
**Solution:**
- Check service worker is active
- Verify `onBackgroundMessage` handler in service worker
- Check service worker console for errors

### Issue: Invalid token errors
**Solution:**
- Token may have expired or been revoked
- Toggle push notifications OFF and ON again to get a new token
- Check Cloud Function logs - invalid tokens are auto-removed

---

## 📝 What to Share for Help

If you're still having issues, share:
1. Cloud Function logs (from Firebase Console)
2. Browser console errors (screenshot or copy)
3. Service worker status (from Application tab)
4. Firestore document showing your `webFcmToken` (redact the token)
5. Firestore document showing mobile user's `fcmToken` (redact the token)
6. Steps you've completed from this checklist

---

## 🔄 Deployment Checklist

After making changes, ensure:
1. ✅ Functions are built: `cd functions && npm run build`
2. ✅ Functions are deployed: `firebase deploy --only functions`
3. ✅ Web app is rebuilt with latest code
4. ✅ Web app is deployed (if using hosting)
5. ✅ Browser cache is cleared (hard refresh: Ctrl+Shift+R)

---

## 📊 Testing Flow

1. **Mobile User Sends Message:**
   - Mobile app → Creates `chat_messages` document
   - Cloud Function → Detects mobile user (has `fcmToken`, no `webFcmToken`)
   - Cloud Function → Queries all web users with `webFcmToken`
   - Cloud Function → Sends notifications to all web users
   - Web app → Receives notification (foreground or background)

2. **Mobile User Creates Report:**
   - Mobile app → Creates `reports` document
   - Cloud Function → Detects mobile creator (has `fcmToken`, no `webFcmToken`)
   - Cloud Function → Queries all web users with `webFcmToken`
   - Cloud Function → Sends notifications to all web users
   - Web app → Receives notification

---

## ✅ Final Verification

Run this complete test:
1. ✅ Web user has `webFcmToken` in Firestore (superAdmin/admins/users collection)
2. ✅ Mobile user has `fcmToken` but NOT `webFcmToken` in Firestore
3. ✅ Cloud Functions are deployed and running
4. ✅ Service worker is active in browser
5. ✅ Notification permission is granted
6. ✅ Send test message from mobile → Check web app receives notification
7. ✅ Create test report from mobile → Check web app receives notification

If all steps pass but notifications still don't work, check Cloud Function logs for specific error messages.

