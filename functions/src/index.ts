/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentDeleted, onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({
  region: "asia-southeast1",
  maxInstances: 10,
});

// Cloud Function: Delete Auth user when Firestore user document is deleted
// This handles the case when a resident user is deleted from Firestore
// Note: Admins use username-only authentication and are stored in Firestore only
export const deleteAuthUserOnFirestoreDelete = onDocumentDeleted(
  "users/{docId}",
  async (event) => {
    const deletedData = event.data?.data();
    
    if (!deletedData || !deletedData.email) {
      logger.warn(`No email found in deleted document ${event.params.docId}`);
      return;
    }

    const email = deletedData.email;
    
    try {
      // Find user by email and delete from Auth
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(userRecord.uid);
      logger.info(`Successfully deleted auth user with email: ${email}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        logger.warn(`Auth user not found for email: ${email}`);
      } else {
        logger.error(`Error deleting auth user for email: ${email}`, error);
      }
    }
  }
);

// Callable Function: Delete resident user from both Auth and Firestore
// This is called from the frontend when deleting a resident user
// Note: Admin accounts are Firestore-only and don't use Firebase Auth
export const deleteResidentUser = onCall(async (request) => {
  // Check if user is authenticated and has admin privileges
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { email, docId } = request.data;

  if (!email || !docId) {
    throw new HttpsError(
      "invalid-argument",
      "Email and docId are required"
    );
  }

  try {
    // Delete from Firebase Auth first
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(userRecord.uid);
      logger.info(`Deleted auth user: ${email}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        logger.warn(`Auth user not found for email: ${email}, continuing with Firestore deletion`);
      } else {
        throw authError;
      }
    }

    // Delete from Firestore
    await admin.firestore().collection("users").doc(docId).delete();
    logger.info(`Deleted Firestore document: users/${docId}`);

    return { success: true, message: "User deleted successfully" };
  } catch (error: any) {
    logger.error(`Error deleting user: ${email}`, error);
    throw new HttpsError("internal", error.message);
  }
});

// Note: Manual deletions from Firebase Console
// If a user is manually deleted from Firebase Authentication Console,
// you should also manually delete the corresponding Firestore document from the 'users' collection.
// The primary deletion flow is through the app, which handles both Auth and Firestore automatically.

// Cloud Function: Send push notification when new chat message is created
// Bidirectional: Sends to mobile users when web app user sends, and to web users when mobile app user sends
export const sendChatNotification = onDocumentCreated(
  "chat_messages/{messageId}",
  async (event) => {
    const messageData = event.data?.data();
    
    if (!messageData) {
      logger.warn("No message data found");
      return;
    }

    const { userId, senderId, senderName, message, imageUrl, videoUrl, audioUrl, fileUrl, fileName, isSystemMessage } = messageData;

    // Don't send notification for system messages
    if (isSystemMessage) {
      logger.info("System message detected, skipping notification");
      return;
    }

    // Don't send notification if sender is the user themselves
    if (userId === senderId) {
      logger.info("Message sent by user themselves, skipping notification");
      return;
    }

    try {
      // Check if sender is a web user or mobile user
      // Web user: has webFcmToken OR doesn't have fcmToken (admin)
      // Mobile user: has fcmToken but not webFcmToken
      let isWebSender = false;
      
      // Try to get sender document (may not exist for admin users)
      const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
      
      if (senderDoc.exists) {
        const senderData = senderDoc.data();
        // If has webFcmToken → web user
        // If doesn't have fcmToken → web user (admin)
        // If has fcmToken but not webFcmToken → mobile user
        isWebSender = !!senderData?.webFcmToken || !senderData?.fcmToken;
      } else {
        // If sender document doesn't exist, assume it's a web admin user
        // (admins might not have user documents, or senderId might be in admin-{userId} format)
        isWebSender = true;
        logger.info(`Sender document not found for senderId: ${senderId}, assuming web user`);
      }

      // Determine notification body based on message type
      let notificationBody = message || "New message";
      
      if (imageUrl) {
        notificationBody = "📷 Sent a photo";
      } else if (videoUrl) {
        notificationBody = "🎥 Sent a video";
      } else if (audioUrl) {
        notificationBody = "🎵 Sent an audio";
      } else if (fileUrl) {
        notificationBody = `📎 Sent ${fileName || "a file"}`;
      }

      if (isWebSender) {
        // Web user sent message → notify mobile user
        logger.info("Web user sent message, sending notification to mobile user");
        
        // Get recipient user's mobile FCM token
        const userDoc = await admin.firestore().collection("users").doc(userId).get();
        
        if (!userDoc.exists) {
          logger.warn(`User document not found for userId: ${userId}`);
          return;
        }

        const userData = userDoc.data();
        // Only send to mobile users (fcmToken, not webFcmToken)
        const fcmToken = userData?.fcmToken;

        if (!fcmToken) {
          logger.info(`No mobile FCM token found for user: ${userId}, skipping mobile notification`);
          return;
        }

        // Prepare notification payload for mobile user
        const notificationPayload = {
          token: fcmToken,
          notification: {
            title: senderName || "AcciZard Lucban",
            body: notificationBody,
          },
          data: {
            type: "chat_message",
            userId: userId,
            messageId: event.params.messageId,
            senderId: senderId,
            senderName: senderName || "AcciZard Lucban",
          },
          android: {
            priority: "high" as const,
            notification: {
              sound: "default",
              channelId: "chat_messages",
              priority: "high" as const,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        };

        // Send notification to mobile user
        const response = await admin.messaging().send(notificationPayload);
        logger.info(`Successfully sent chat notification to mobile user ${userId}. Response: ${response}`);
        
      } else {
        // Mobile user sent message → notify all web users
        logger.info("Mobile user sent message, sending notification to web users");
        
        // Check if this is the mobile user's first message
        // Query for all messages from this user (where userId === senderId means mobile user sent it)
        const allUserMessages = await admin.firestore()
          .collection("chat_messages")
          .where("userId", "==", userId)
          .where("senderId", "==", senderId)
          .get();
        
        // If there's only 1 message (the current one), it's the first message
        const isFirstMessage = allUserMessages.size === 1;
        
        if (isFirstMessage) {
          logger.info(`First message from mobile user ${senderId}, sending automatic welcome message`);
          
          // Create automatic welcome message
          const welcomeMessage = `Thank you for reaching out! Our admins will get back to you as soon as they're available.\n\nFor urgent matters, please contact us:\n📞 Emergency: 540-1709 or 0917 520 4211\n📘 Facebook: https://www.facebook.com/LucbanDRRMO`;
          
          const welcomeMessageData = {
            userId: userId,
            userID: userId, // Also set userID for mobile app compatibility
            senderId: "system",
            senderName: "AcciZard Lucban",
            message: welcomeMessage,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            isSystemMessage: true
          };
          
          // Add the welcome message to chat_messages collection
          await admin.firestore().collection("chat_messages").add(welcomeMessageData);
          
          // Update chat metadata
          const chatRef = admin.firestore().collection("chats").doc(userId);
          const userDoc = await admin.firestore().collection("users").doc(userId).get();
          const userData = userDoc.data();
          
          await chatRef.set({
            userId: userId,
            userName: userData?.name || userData?.fullName || senderName || "Unknown User",
            userEmail: userData?.email || "",
            lastMessage: welcomeMessage.substring(0, 100), // Truncate for preview
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageSenderName: "AcciZard Lucban",
            lastAccessTime: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          logger.info(`Automatic welcome message sent to user ${userId}`);
        }
        
        // Get all web users (users with webFcmToken)
        const usersSnapshot = await admin.firestore().collection("users").get();
        
        const webUsers = usersSnapshot.docs
          .map(doc => ({
            userId: doc.id,
            webFcmToken: doc.data().webFcmToken
          }))
          .filter(user => user.webFcmToken); // Only users with web FCM tokens

        if (webUsers.length === 0) {
          logger.info("No web users with FCM tokens found");
          return;
        }

        logger.info(`Sending chat notification to ${webUsers.length} web users`);

        // Prepare base notification payload
        const basePayload = {
          notification: {
            title: senderName || "New Message",
            body: notificationBody,
          },
          data: {
            type: "chat_message",
            userId: userId,
            messageId: event.params.messageId,
            senderId: senderId,
            senderName: senderName || "New Message",
          },
          android: {
            priority: "high" as const,
            notification: {
              sound: "default",
              channelId: "chat_messages",
              priority: "high" as const,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        };

        // Send notifications in batches (FCM limit: 500 per batch)
        const batchSize = 500;
        const batches = [];
        
        for (let i = 0; i < webUsers.length; i += batchSize) {
          const batch = webUsers.slice(i, i + batchSize);
          batches.push(batch);
        }

        let successCount = 0;
        let failureCount = 0;
        const invalidTokens: string[] = [];

        for (const batch of batches) {
          const messages = batch.map(user => ({
            ...basePayload,
            token: user.webFcmToken,
          }));

          try {
            const response = await admin.messaging().sendEach(messages);
            
            successCount += response.successCount;
            failureCount += response.failureCount;

            // Track invalid tokens
            response.responses.forEach((result, index) => {
              if (!result.success && result.error) {
                const errorCode = result.error.code;
                if (errorCode === "messaging/invalid-registration-token" ||
                    errorCode === "messaging/registration-token-not-registered") {
                  invalidTokens.push(batch[index].userId);
                }
              }
            });
            
          } catch (error: any) {
            logger.error("Error sending batch notifications:", error);
            failureCount += batch.length;
          }
        }

        // Remove invalid tokens from Firestore
        if (invalidTokens.length > 0) {
          logger.info(`Removing ${invalidTokens.length} invalid web FCM tokens`);
          
          const deletePromises = invalidTokens.map(userId =>
            admin.firestore().collection("users").doc(userId).update({
              webFcmToken: admin.firestore.FieldValue.delete()
            })
          );
          
          await Promise.all(deletePromises);
        }

        logger.info(`Chat notification sent to web users. Success: ${successCount}, Failed: ${failureCount}, Invalid tokens removed: ${invalidTokens.length}`);
      }
      
    } catch (error: any) {
      logger.error(`Error sending chat notification:`, error);
      
      // If token is invalid, remove it from Firestore
      if (error.code === "messaging/invalid-registration-token" || 
          error.code === "messaging/registration-token-not-registered") {
        logger.info(`Removing invalid FCM token for user ${userId}`);
        await admin.firestore().collection("users").doc(userId).update({
          fcmToken: admin.firestore.FieldValue.delete(),
          webFcmToken: admin.firestore.FieldValue.delete()
        });
      }
    }
  }
);

// Cloud Function: Send push notification to web users when a mobile user creates a report
export const sendReportCreatedNotification = onDocumentCreated(
  "reports/{reportId}",
  async (event) => {
    const reportData = event.data?.data();
    
    if (!reportData) {
      logger.warn("No report data found");
      return;
    }

    const { userId, type, barangay, location, reportId: reportNumber } = reportData;

    if (!userId) {
      logger.warn("No userId found in report, cannot determine if mobile user");
      return;
    }

    try {
      // Check if report creator is a mobile user (has fcmToken but not webFcmToken)
      const creatorDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!creatorDoc.exists) {
        logger.warn(`Creator document not found for userId: ${userId}`);
        return;
      }

      const creatorData = creatorDoc.data();
      const isMobileCreator = creatorData?.fcmToken && !creatorData?.webFcmToken;

      // Only send to web users if creator is a mobile user
      if (!isMobileCreator) {
        logger.info("Report creator is not a mobile user, skipping web notification");
        return;
      }

      // Get all web users (users with webFcmToken)
      const usersSnapshot = await admin.firestore().collection("users").get();
      
      const webUsers = usersSnapshot.docs
        .map(doc => ({
          userId: doc.id,
          webFcmToken: doc.data().webFcmToken
        }))
        .filter(user => user.webFcmToken); // Only users with web FCM tokens

      if (webUsers.length === 0) {
        logger.info("No web users with FCM tokens found");
        return;
      }

      logger.info(`Sending report created notification to ${webUsers.length} web users`);

      // Prepare notification
      const notificationTitle = "📋 New Report Submitted";
      const notificationBody = `A new ${type || 'emergency'} report has been submitted${barangay ? ` in ${barangay}` : ''}`;

      // Prepare notification payload
      const basePayload = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: "report_created",
          reportId: event.params.reportId,
          reportNumber: reportNumber || "",
          reportType: type || "emergency",
          barangay: barangay || "",
          location: location || "",
          createdBy: userId,
        },
        android: {
          priority: "high" as const,
          notification: {
            sound: "default",
            channelId: "report_updates",
            priority: "high" as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      // Send notifications in batches (FCM limit: 500 per batch)
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < webUsers.length; i += batchSize) {
        const batch = webUsers.slice(i, i + batchSize);
        batches.push(batch);
      }

      let successCount = 0;
      let failureCount = 0;
      const invalidTokens: string[] = [];

      for (const batch of batches) {
        const messages = batch.map(user => ({
          ...basePayload,
          token: user.webFcmToken,
        }));

        try {
          const response = await admin.messaging().sendEach(messages);
          
          successCount += response.successCount;
          failureCount += response.failureCount;

          // Track invalid tokens
          response.responses.forEach((result, index) => {
            if (!result.success && result.error) {
              const errorCode = result.error.code;
              if (errorCode === "messaging/invalid-registration-token" ||
                  errorCode === "messaging/registration-token-not-registered") {
                invalidTokens.push(batch[index].userId);
              }
            }
          });
          
        } catch (error: any) {
          logger.error("Error sending batch notifications:", error);
          failureCount += batch.length;
        }
      }

      // Remove invalid tokens from Firestore
      if (invalidTokens.length > 0) {
        logger.info(`Removing ${invalidTokens.length} invalid web FCM tokens`);
        
        const deletePromises = invalidTokens.map(userId =>
          admin.firestore().collection("users").doc(userId).update({
            webFcmToken: admin.firestore.FieldValue.delete()
          })
        );
        
        await Promise.all(deletePromises);
      }

      logger.info(`Report created notification sent. Success: ${successCount}, Failed: ${failureCount}, Invalid tokens removed: ${invalidTokens.length}`);
      
    } catch (error: any) {
      logger.error("Error sending report created notifications:", error);
    }
  }
);

// Cloud Function: Send push notifications when new announcement is created
// Only sends to mobile users (not web users)
export const sendAnnouncementNotification = onDocumentCreated(
  "announcements/{announcementId}",
  async (event) => {
    const announcementData = event.data?.data();
    
    if (!announcementData) {
      logger.warn("No announcement data found");
      return;
    }

    const { type, description, priority, date } = announcementData;

    try {
      // Get all mobile users with FCM tokens (not web users)
      const usersSnapshot = await admin.firestore().collection("users").get();
      
      const usersWithTokens = usersSnapshot.docs
        .map(doc => {
          const data = doc.data();
          // Only mobile users (fcmToken, not webFcmToken)
          return {
            userId: doc.id,
            fcmToken: data.fcmToken && !data.webFcmToken ? data.fcmToken : null
          };
        })
        .filter(user => user.fcmToken); // Only mobile users with FCM tokens

      if (usersWithTokens.length === 0) {
        logger.info("No users with FCM tokens found");
        return;
      }

      logger.info(`Sending announcement notification to ${usersWithTokens.length} users`);

      // Determine notification title based on priority
      let notificationTitle = "New Announcement";
      if (priority === "high") {
        notificationTitle = "🚨 Important Announcement";
      } else if (priority === "medium") {
        notificationTitle = "📢 New Announcement";
      } else {
        notificationTitle = "ℹ️ Announcement";
      }

      // Truncate description for notification body (max 100 chars)
      const notificationBody = description && description.length > 100
        ? description.substring(0, 97) + "..."
        : description || "Check the app for details";

      // Prepare notification payload
      const basePayload = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: "announcement",
          announcementId: event.params.announcementId,
          announcementType: type || "general",
          priority: priority || "low",
          date: date || "",
        },
        android: {
          priority: priority === "high" ? "high" as const : "normal" as const,
          notification: {
            sound: "default",
            channelId: priority === "high" ? "high_priority_announcements" : "announcements",
            priority: priority === "high" ? "high" as const : "default" as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      // Send notifications in batches (FCM limit: 500 per batch)
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < usersWithTokens.length; i += batchSize) {
        const batch = usersWithTokens.slice(i, i + batchSize);
        batches.push(batch);
      }

      let successCount = 0;
      let failureCount = 0;
      const invalidTokens: string[] = [];

      for (const batch of batches) {
        const messages = batch.map(user => ({
          ...basePayload,
          token: user.fcmToken,
        }));

        try {
          const response = await admin.messaging().sendEach(messages);
          
          successCount += response.successCount;
          failureCount += response.failureCount;

          // Track invalid tokens
          response.responses.forEach((result, index) => {
            if (!result.success && result.error) {
              const errorCode = result.error.code;
              if (errorCode === "messaging/invalid-registration-token" ||
                  errorCode === "messaging/registration-token-not-registered") {
                invalidTokens.push(batch[index].userId);
              }
            }
          });
          
        } catch (error: any) {
          logger.error("Error sending batch notifications:", error);
          failureCount += batch.length;
        }
      }

      // Remove invalid tokens from Firestore
      if (invalidTokens.length > 0) {
        logger.info(`Removing ${invalidTokens.length} invalid FCM tokens`);
        
        // Get user data to determine which token field to delete
        const deletePromises = await Promise.all(
          invalidTokens.map(async (userId) => {
            const userDoc = await admin.firestore().collection("users").doc(userId).get();
            const userData = userDoc.data();
            const updateData: any = {};
            if (userData?.fcmToken) {
              updateData.fcmToken = admin.firestore.FieldValue.delete();
            }
            if (userData?.webFcmToken) {
              updateData.webFcmToken = admin.firestore.FieldValue.delete();
            }
            if (Object.keys(updateData).length > 0) {
              return admin.firestore().collection("users").doc(userId).update(updateData);
            }
            return Promise.resolve();
          })
        );
        
        await Promise.all(deletePromises);
      }

      logger.info(`Announcement notification sent. Success: ${successCount}, Failed: ${failureCount}, Invalid tokens removed: ${invalidTokens.length}`);
      
    } catch (error: any) {
      logger.error("Error sending announcement notifications:", error);
    }
  }
);

// Cloud Function: Send push notification to web users when a new mobile user registers
export const sendNewUserRegistrationNotification = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const userData = event.data?.data();
    
    if (!userData) {
      logger.warn("No user data found");
      return;
    }

    // Check if this is a mobile user registration (has fcmToken but not webFcmToken)
    const isMobileUser = userData?.fcmToken && !userData?.webFcmToken;

    // Only send to web users if this is a mobile user registration
    if (!isMobileUser) {
      logger.info("New user is not a mobile user, skipping web notification");
      return;
    }

    try {
      // Get all web users (users with webFcmToken)
      const usersSnapshot = await admin.firestore().collection("users").get();
      
      const webUsers = usersSnapshot.docs
        .map(doc => ({
          userId: doc.id,
          webFcmToken: doc.data().webFcmToken
        }))
        .filter(user => user.webFcmToken && user.userId !== event.params.userId); // Exclude the new user and only web users

      if (webUsers.length === 0) {
        logger.info("No web users with FCM tokens found");
        return;
      }

      logger.info(`Sending new user registration notification to ${webUsers.length} web users`);

      // Prepare notification
      const userName = userData?.name || userData?.email || "A new user";
      const notificationTitle = "👤 New User Registered";
      const notificationBody = `${userName} has registered on the mobile app`;

      // Prepare notification payload
      const basePayload = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: "user_registered",
          newUserId: event.params.userId,
          userName: userName,
        },
        android: {
          priority: "normal" as const,
          notification: {
            sound: "default",
            channelId: "user_updates",
            priority: "default" as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      // Send notifications in batches (FCM limit: 500 per batch)
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < webUsers.length; i += batchSize) {
        const batch = webUsers.slice(i, i + batchSize);
        batches.push(batch);
      }

      let successCount = 0;
      let failureCount = 0;
      const invalidTokens: string[] = [];

      for (const batch of batches) {
        const messages = batch.map(user => ({
          ...basePayload,
          token: user.webFcmToken,
        }));

        try {
          const response = await admin.messaging().sendEach(messages);
          
          successCount += response.successCount;
          failureCount += response.failureCount;

          // Track invalid tokens
          response.responses.forEach((result, index) => {
            if (!result.success && result.error) {
              const errorCode = result.error.code;
              if (errorCode === "messaging/invalid-registration-token" ||
                  errorCode === "messaging/registration-token-not-registered") {
                invalidTokens.push(batch[index].userId);
              }
            }
          });
          
        } catch (error: any) {
          logger.error("Error sending batch notifications:", error);
          failureCount += batch.length;
        }
      }

      // Remove invalid tokens from Firestore
      if (invalidTokens.length > 0) {
        logger.info(`Removing ${invalidTokens.length} invalid web FCM tokens`);
        
        const deletePromises = invalidTokens.map(userId =>
          admin.firestore().collection("users").doc(userId).update({
            webFcmToken: admin.firestore.FieldValue.delete()
          })
        );
        
        await Promise.all(deletePromises);
      }

      logger.info(`New user registration notification sent. Success: ${successCount}, Failed: ${failureCount}, Invalid tokens removed: ${invalidTokens.length}`);
      
    } catch (error: any) {
      logger.error("Error sending new user registration notifications:", error);
    }
  }
);

// Cloud Function: Send push notification when report status is updated
// Notifies the user who submitted the report about status changes (mobile users only)
export const sendReportStatusNotification = onDocumentUpdated(
  "reports/{reportId}",
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    
    if (!beforeData || !afterData) {
      logger.warn("Missing report data");
      return;
    }

    // Check if status actually changed
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;
    
    if (oldStatus === newStatus) {
      logger.info("Status unchanged, skipping notification");
      return;
    }

    const { userId, type, barangay, location, reportId: reportNumber } = afterData;

    // Get the user who submitted this report
    if (!userId) {
      logger.warn("No userId found in report, cannot send notification");
      return;
    }

    try {
      // Get user's FCM token from Firestore
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      
      if (!userDoc.exists) {
        logger.warn(`User document not found for userId: ${userId}`);
        return;
      }

      const userData = userDoc.data();
      // Only send to mobile users (fcmToken) for status updates
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        logger.info(`No mobile FCM token found for user: ${userId}, skipping status notification`);
        return;
      }

      // Determine notification title and body based on status
      let notificationTitle = "";
      let notificationBody = "";
      
      switch (newStatus?.toLowerCase()) {
        case "responding":
        case "in progress":
          notificationTitle = "🚨 Responders Dispatched";
          notificationBody = `Your ${type || 'emergency'} report is being responded to`;
          break;
        case "resolved":
        case "completed":
          notificationTitle = "✅ Report Resolved";
          notificationBody = `Your ${type || 'emergency'} report has been resolved`;
          break;
        case "cancelled":
        case "rejected":
          notificationTitle = "❌ Report Cancelled";
          notificationBody = `Your ${type || 'emergency'} report has been cancelled`;
          break;
        case "pending":
          notificationTitle = "⏳ Report Pending";
          notificationBody = `Your ${type || 'emergency'} report is pending review`;
          break;
        default:
          notificationTitle = "📋 Report Status Updated";
          notificationBody = `Your ${type || 'emergency'} report status: ${newStatus}`;
      }

      // Add location context
      const locationText = barangay || location;
      if (locationText) {
        notificationBody += ` at ${locationText}`;
      }

      // Prepare notification payload
      const notificationPayload = {
        token: fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: "report_update",
          reportId: event.params.reportId,
          reportNumber: reportNumber || "",
          reportType: type || "emergency",
          oldStatus: oldStatus || "",
          newStatus: newStatus || "",
          barangay: barangay || "",
          location: location || "",
        },
        android: {
          priority: "high" as const,
          notification: {
            sound: "default",
            channelId: "report_updates",
            priority: "high" as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      // Send notification
      const response = await admin.messaging().send(notificationPayload);
      logger.info(`Successfully sent report status notification to user ${userId}. Response: ${response}`);
      logger.info(`Status changed from "${oldStatus}" to "${newStatus}" for report ${event.params.reportId}`);
      
    } catch (error: any) {
      logger.error(`Error sending report status notification to user ${userId}:`, error);
      
      // If token is invalid, remove it from Firestore
      if (error.code === "messaging/invalid-registration-token" || 
          error.code === "messaging/registration-token-not-registered") {
        logger.info(`Removing invalid mobile FCM token for user ${userId}`);
        await admin.firestore().collection("users").doc(userId).update({
          fcmToken: admin.firestore.FieldValue.delete()
        });
      }
    }
  }
);

