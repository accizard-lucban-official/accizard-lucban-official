import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { collection as getCollection, query, where, getDocs } from 'firebase/firestore';
import { SessionManager } from './sessionManager';

// Action Types Enum
export enum ActionType {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',
  
  // CRUD Operations
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  
  // Admin Management
  ADMIN_CREATED = 'admin_created',
  ADMIN_UPDATED = 'admin_updated',
  ADMIN_DELETED = 'admin_deleted',
  ADMIN_PERMISSION_GRANTED = 'admin_permission_granted',
  ADMIN_PERMISSION_REVOKED = 'admin_permission_revoked',
  
  // Resident Management
  RESIDENT_CREATED = 'resident_created',
  RESIDENT_UPDATED = 'resident_updated',
  RESIDENT_DELETED = 'resident_deleted',
  RESIDENT_VERIFIED = 'resident_verified',
  RESIDENT_UNVERIFIED = 'resident_unverified',
  RESIDENT_SUSPENDED = 'resident_suspended',
  RESIDENT_UNSUSPENDED = 'resident_unsuspended',
  
  // Report Management
  REPORT_CREATED = 'report_created',
  REPORT_UPDATED = 'report_updated',
  REPORT_DELETED = 'report_deleted',
  REPORT_ADDED_TO_MAP = 'report_added_to_map',
  REPORT_REMOVED_FROM_MAP = 'report_removed_from_map',
  
  // Announcement Management
  ANNOUNCEMENT_CREATED = 'announcement_created',
  ANNOUNCEMENT_UPDATED = 'announcement_updated',
  ANNOUNCEMENT_DELETED = 'announcement_deleted',
  
  // Map/Pin Management
  PIN_CREATED = 'pin_created',
  PIN_UPDATED = 'pin_updated',
  PIN_DELETED = 'pin_deleted',
  PLACEMARK_ADDED = 'placemark_added',
  
  // System
  SYSTEM_SETTINGS_UPDATED = 'system_settings_updated',
  BULK_OPERATION = 'bulk_operation',
  DATA_EXPORTED = 'data_exported',
  DATA_IMPORTED = 'data_imported',
}

export interface LogOptions {
  actionType: ActionType | string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

interface UserInfo {
  id: string;
  name: string;
  userType: 'admin' | 'superadmin';
  userId?: string; // For admin userId field
}

/**
 * Get current user information for logging
 */
async function getCurrentUserInfo(): Promise<UserInfo | null> {
  try {
    // Try SessionManager first (newer approach)
    const session = SessionManager.getCurrentUser();
    if (session && session.isLoggedIn) {
      if (session.userType === 'admin') {
        // Admin user - get additional info from Firestore if needed
        try {
          const q = query(getCollection(db, "admins"), where("username", "==", session.username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            return {
              id: querySnapshot.docs[0].id,
              name: session.name || data.name || data.fullName || session.username,
              userType: 'admin',
              userId: data.userId || session.userId || `AID-${querySnapshot.docs[0].id.slice(-6)}`
            };
          }
        } catch (error) {
          console.error("Error fetching admin info for logging:", error);
        }
        
        // Fallback to session data
        return {
          id: session.userId,
          name: session.name || session.username,
          userType: 'admin',
          userId: session.userId
        };
      } else {
        // Super admin
        const authUser = auth.currentUser;
        if (authUser && authUser.email) {
          try {
            const q = query(getCollection(db, "superAdmin"), where("email", "==", authUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const data = querySnapshot.docs[0].data();
              return {
                id: querySnapshot.docs[0].id,
                name: session.name || data.fullName || data.name || authUser.displayName || authUser.email.split("@")[0],
                userType: 'superadmin'
              };
            }
          } catch (error) {
            console.error("Error fetching super admin info for logging:", error);
          }
        }
        
        // Fallback to session/auth data
        return {
          id: session.userId,
          name: session.name || session.email?.split("@")[0] || "Super Admin",
          userType: 'superadmin'
        };
      }
    }
    
    // Fallback to old localStorage approach
    const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
    
    if (adminLoggedIn) {
      const username = localStorage.getItem("adminUsername");
      const userId = localStorage.getItem("adminUserId");
      
      if (username) {
        try {
          const q = query(getCollection(db, "admins"), where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            return {
              id: querySnapshot.docs[0].id,
              name: data.name || data.fullName || username,
              userType: 'admin',
              userId: data.userId || userId || `AID-${querySnapshot.docs[0].id.slice(-6)}`
            };
          }
        } catch (error) {
          console.error("Error fetching admin info for logging:", error);
        }
        
        return {
          id: userId || 'unknown',
          name: username,
          userType: 'admin',
          userId: userId || undefined
        };
      }
    } else {
      const authUser = auth.currentUser;
      if (authUser && authUser.email) {
        return {
          id: authUser.uid,
          name: authUser.displayName || authUser.email?.split("@")[0] || "Super Admin",
          userType: 'superadmin'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting current user info:", error);
    return null;
  }
}

/**
 * Log an activity to Firestore
 * This function should be called after any important user action
 * 
 * @param options - Log options including action type, description, and metadata
 * 
 * @example
 * await logActivity({
 *   actionType: ActionType.ADMIN_CREATED,
 *   action: 'Created admin account "John Doe" (AID-123)',
 *   entityType: 'admin',
 *   entityId: docRef.id,
 *   entityName: 'John Doe'
 * });
 */
export async function logActivity(options: LogOptions): Promise<void> {
  try {
    // Get current user info
    const userInfo = await getCurrentUserInfo();
    
    if (!userInfo) {
      console.warn("Cannot log activity: No user information available");
      return;
    }
    
    // Prepare log data
    const logData: any = {
      userId: userInfo.userId || userInfo.id,
      userName: userInfo.name,
      userRole: userInfo.userType,
      admin: userInfo.name, // Keep for backward compatibility
      actor: userInfo.name, // Keep for backward compatibility
      actionType: options.actionType,
      action: options.action,
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
    
    // Add optional fields
    if (options.entityType) logData.entityType = options.entityType;
    if (options.entityId) logData.entityId = options.entityId;
    if (options.entityName) logData.entityName = options.entityName;
    if (options.changes) logData.changes = options.changes;
    if (options.metadata) logData.metadata = options.metadata;
    
    // Write to Firestore (non-blocking)
    await addDoc(collection(db, 'activityLogs'), logData);
  } catch (error) {
    // Fail silently - logging failures shouldn't break the app
    console.error('Failed to log activity:', error);
  }
}

/**
 * Helper function to format log messages consistently
 * Format: [Action] [EntityType] "[EntityName]" ([EntityId])
 */
export function formatLogMessage(
  action: string,
  entityType: string,
  entityName: string,
  entityId: string
): string {
  return `${action} ${entityType} "${entityName}" (${entityId})`;
}

/**
 * Helper function to create change log entry
 */
export function createChangeLog(
  field: string,
  oldValue: any,
  newValue: any
): Record<string, { from: any; to: any }> {
  return {
    [field]: { from: oldValue, to: newValue }
  };
}

