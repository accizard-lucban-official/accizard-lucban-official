# Web Push Notifications Setup Guide

## 📱 Overview

This guide explains how to set up and use web push notifications in the AcciZard web app. Users can opt-in to receive push notifications for announcements, report updates, and chat messages, even when the web app is not installed as a PWA.

---

## ✅ What's Implemented

### **1. Service Worker**
- Located at: `public/firebase-messaging-sw.js`
- Handles background push notifications
- Manages notification clicks and navigation

### **2. Push Notification Hook**
- Located at: `src/hooks/usePushNotifications.ts`
- Manages permission requests
- Handles subscription/unsubscription
- Listens for foreground messages

### **3. Notification Settings UI**
- Located at: `src/components/NotificationSettings.tsx`
- Added to ProfilePage
- Allows users to enable/disable push notifications

### **4. Firebase Integration**
- Firebase Cloud Messaging (FCM) for web
- Token storage in Firestore (`users/{userId}/webFcmToken`)
- Compatible with existing Cloud Functions

---

## 🔧 Setup Instructions

### **Step 1: Get Firebase VAPID Key**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Cloud Messaging** tab
4. Under **Web configuration**, find or generate a **Web Push certificate** (VAPID key)
5. Copy the key pair (it looks like: `BElGGi...`)

### **Step 2: Add Environment Variables**

Add the VAPID key to your `.env` file:

```env
VITE_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE
```

**Note:** The following Firebase config variables should already be set:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### **Step 3: Update Cloud Functions (Optional)**

Your existing Cloud Functions (`sendAnnouncementNotification`, `sendChatNotification`, `sendReportStatusNotification`) should work with web push tokens. They already check for `fcmToken` in the user document.

To support both mobile and web tokens, you can update your Cloud Functions to check for both:
- `fcmToken` (mobile)
- `webFcmToken` (web)

**Example Cloud Function Update:**

```typescript
// In your Cloud Function
const userDoc = await admin.firestore().doc(`users/${userId}`).get();
const userData = userDoc.data();

// Check for both mobile and web tokens
const fcmToken = userData?.fcmToken || userData?.webFcmToken;

if (fcmToken) {
  await admin.messaging().send({
    token: fcmToken,
    notification: {
      title: 'Notification Title',
      body: 'Notification Body',
    },
    data: {
      type: 'announcement',
      // ... other data
    },
  });
}
```

---

## 🎯 How It Works

### **User Flow:**

1. **User visits Profile Page**
   - Sees "Push Notifications" card
   - Can click "Request Permission" or "Enable"

2. **Permission Request**
   - Browser prompts user for notification permission
   - If granted, service worker is registered
   - FCM token is obtained and saved to Firestore

3. **Receiving Notifications**
   - **Foreground:** Toast notification + browser notification
   - **Background:** Browser notification (handled by service worker)
   - **Click:** Navigates to relevant page (announcements, reports, chat)

4. **Unsubscribing**
   - User can disable notifications from Profile Page
   - Token is removed from Firestore

### **Notification Types:**

| Type | Trigger | Navigation |
|------|---------|------------|
| `announcement` | New announcement created | `/announcements` |
| `report_update` | Report status changed | `/reports?highlight={reportId}` |
| `chat_message` | New chat message | `/chat` |

---

## 🧪 Testing

### **Test 1: Permission Request**
1. Go to Profile Page
2. Click "Request Permission"
3. Allow notifications in browser prompt
4. Verify "Notifications Enabled" appears

### **Test 2: Receive Notification (Foreground)**
1. Enable notifications
2. Keep browser tab open
3. Create a test announcement (as admin)
4. Verify toast notification appears
5. Verify browser notification appears

### **Test 3: Receive Notification (Background)**
1. Enable notifications
2. Minimize or switch to another tab
3. Create a test announcement (as admin)
4. Verify browser notification appears
5. Click notification
6. Verify it navigates to announcements page

### **Test 4: Unsubscribe**
1. Go to Profile Page
2. Click "Disable" button
3. Verify token is removed from Firestore
4. Verify no more notifications are received

---

## 🔍 Browser Support

Web push notifications work in:
- ✅ Chrome/Edge (Windows, macOS, Android)
- ✅ Firefox (Windows, macOS, Android)
- ✅ Safari (macOS 16.4+, iOS 16.4+)
- ❌ Safari (older versions)
- ❌ Internet Explorer

**Note:** Service workers are required, so HTTPS is necessary (except for localhost).

---

## 📊 Firestore Structure

### **User Document:**
```javascript
{
  // ... other user fields
  webFcmToken: "dGhpcyBpcyBhIHRva2Vu...", // FCM token for web
  webFcmTokenUpdatedAt: "2024-01-15T10:30:00.000Z" // ISO timestamp
}
```

---

## 🛠️ Troubleshooting

### **Issue: "VAPID key not configured"**
- **Solution:** Add `VITE_FIREBASE_VAPID_KEY` to your `.env` file

### **Issue: "Service worker registration failed"**
- **Solution:** Ensure you're using HTTPS (or localhost)
- Check browser console for errors
- Verify `firebase-messaging-sw.js` is in the `public` folder

### **Issue: "Notification permission denied"**
- **Solution:** User must enable notifications in browser settings
- Guide user to browser settings > Site permissions > Notifications

### **Issue: "No registration token available"**
- **Solution:** 
  - Verify VAPID key is correct
  - Check Firebase project settings
  - Ensure service worker is registered

### **Issue: Notifications not received**
- **Solution:**
  - Verify token is saved in Firestore
  - Check Cloud Functions logs
  - Verify Cloud Function is sending to `webFcmToken` field

---

## 🔐 Security Considerations

1. **VAPID Key:** Keep your VAPID key secure. It's used to identify your app to push services.
2. **Token Storage:** FCM tokens are stored in Firestore. Ensure proper security rules.
3. **HTTPS Required:** Service workers require HTTPS (except localhost).

---

## 📝 Firestore Security Rules

Ensure your Firestore rules allow users to update their own `webFcmToken`:

```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

---

## 🎉 Summary

Your web app now supports push notifications! Users can:
- ✅ Opt-in to receive push notifications
- ✅ Receive notifications even when the app is not a PWA
- ✅ Get notified about announcements, report updates, and chat messages
- ✅ Control notifications from their profile settings

The implementation uses Firebase Cloud Messaging and is compatible with your existing mobile app push notification system.

