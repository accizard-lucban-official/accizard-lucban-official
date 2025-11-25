# Push Notification Diagnostics Checklist

Use this checklist to troubleshoot why push notifications aren't working in the web app.

## ✅ Step 1: Verify Token is Saved in Firestore

1. **Open Firebase Console** → Firestore Database
2. **Check your user document:**
   - If you're a **super admin**: Check `superAdmin` collection (find by your email)
   - If you're a **regular admin/user**: Check `users` collection (find by your UID)
3. **Verify the following fields exist:**
   - `webFcmToken` - Should contain a long token string (starts with something like `c...` or `f...`)
   - `webFcmTokenUpdatedAt` - Should have a recent timestamp

**If token is missing:**
- Toggle push notifications OFF and ON again in ProfilePage
- Check browser console for errors during token generation
- Verify VAPID key is correctly set in environment variables

---

## ✅ Step 2: Check Browser Console for Errors

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Look for these messages:**
   - ✅ `Service Worker registered:` - Should appear
   - ✅ `FCM Token obtained:` - Should show your token
   - ✅ `FCM Token saved to [collection] collection` - Confirms save to Firestore
   - ❌ Any red error messages

**Common errors:**
- `Invalid VAPID key format` → Check VAPID key in `.env` or GitHub Secrets
- `Failed to register service worker` → Check if service worker file exists at `/firebase-messaging-sw.js`
- `No registration token available` → VAPID key issue or service worker not registered

---

## ✅ Step 3: Verify Service Worker is Active

1. **Open browser DevTools** (F12)
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Click "Service Workers" in left sidebar**
4. **Check:**
   - Service worker should be **"activated and is running"**
   - Status should be **green/active**
   - Scope should be `/`

**If service worker is not active:**
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Unregister the service worker and refresh
- Check browser console for service worker errors

---

## ✅ Step 4: Check Notification Permissions

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Run this command:**
   ```javascript
   Notification.permission
   ```
4. **Expected result:** Should return `"granted"`

**If permission is not granted:**
- Go to ProfilePage and toggle push notifications ON
- Browser should prompt for permission
- If denied, go to browser settings → Site Settings → Notifications → Allow

---

## ✅ Step 5: Verify Cloud Function is Triggered

1. **Open Firebase Console** → Functions
2. **Click on `sendChatNotification` function**
3. **Go to "Logs" tab**
4. **Send a test message from mobile app**
5. **Check logs for:**
   - ✅ `Mobile user sent message, sending notification to web users`
   - ✅ `Sending chat notification to X web users` (where X > 0)
   - ✅ `Successfully sent chat notification to web user`
   - ❌ Any error messages

**If function is not triggered:**
- Check if `chat_messages` collection has new documents
- Verify Cloud Function is deployed: `firebase deploy --only functions:sendChatNotification`

**If function shows "No web users with FCM tokens found":**
- Your token is not in Firestore (go back to Step 1)

**If function shows errors:**
- Check error message in logs
- Common: Invalid tokens, network errors, permission issues

---

## ✅ Step 6: Test Foreground Notifications

1. **Keep the web app open and visible** (in foreground)
2. **Send a message from mobile app**
3. **Expected behavior:**
   - Browser notification should appear (even if app is open)
   - Toast notification should also appear in the app

**If no notification appears:**
- Check browser console for `Message received in foreground:` log
- Verify `onMessage` handler is set up in `usePushNotifications.ts`

---

## ✅ Step 7: Test Background Notifications

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

## ✅ Step 8: Verify VAPID Key Configuration

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

## ✅ Step 9: Check Network Tab

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Filter by "fetch" or "xhr"**
4. **Send a message from mobile app**
5. **Look for:**
   - Requests to Firebase Cloud Messaging API
   - Any failed requests (red status codes)

---

## ✅ Step 10: Verify Deployment

1. **Check if latest code is deployed:**
   - Verify Cloud Functions are deployed: `firebase functions:list`
   - Verify web app is deployed: Check hosting URL matches latest build

2. **Clear browser cache:**
   - Hard refresh (Ctrl+Shift+R)
   - Or clear site data and reload

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

// Check current FCM token (if messaging is initialized)
// This requires the app to be loaded and messaging initialized
```

---

## 🐛 Common Issues and Solutions

### Issue: "No web users with FCM tokens found"
**Solution:** Your token is not saved in Firestore. Toggle push notifications OFF and ON again.

### Issue: "Invalid VAPID key format"
**Solution:** Check VAPID key has no spaces/newlines. Trim it in the code or in GitHub Secrets.

### Issue: Service worker not registering
**Solution:** 
- Verify `/firebase-messaging-sw.js` exists in `public` folder
- Check file is accessible: `https://your-domain.com/firebase-messaging-sw.js`
- Clear browser cache and hard refresh

### Issue: Notifications work in foreground but not background
**Solution:** 
- Check service worker is active
- Verify `onBackgroundMessage` handler in service worker
- Check service worker console for errors

### Issue: Cloud Function not triggered
**Solution:**
- Verify function is deployed
- Check Firestore rules allow function to read `chat_messages`
- Check function logs for errors

---

## 📝 What to Share for Help

If you're still having issues, share:
1. Browser console errors (screenshot or copy)
2. Cloud Function logs (from Firebase Console)
3. Service worker status (from Application tab)
4. Firestore document showing your `webFcmToken` (redact the token)
5. Steps you've completed from this checklist



