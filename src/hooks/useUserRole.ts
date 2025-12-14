import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { SessionManager } from '@/lib/sessionManager';

export interface UserRole {
  id: string;
  username: string;
  name: string;
  userType: 'admin' | 'superadmin';
  email?: string;
  position?: string;
  idNumber?: string;
  profilePicture?: string;
  coverImage?: string;
  permissions?: string[];
}

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async () => {
    try {
      setLoading(true);
      console.log('[useUserRole] Starting fetchUserRole...');
      
      // Check new session format first, then fall back to old format
      const session = SessionManager.getSession();
      const adminLoggedIn = session?.isLoggedIn && session?.userType === 'admin';
      const username = session?.username || localStorage.getItem("adminUsername");
      
      // Also check old format for backward compatibility
      const oldAdminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      const oldUsername = localStorage.getItem("adminUsername");
      
      // Use new session if available, otherwise fall back to old format
      const isAdminLoggedIn = adminLoggedIn || oldAdminLoggedIn;
      const adminUsername = username || oldUsername;
      
      console.log('[useUserRole] Session check:', {
        session: session,
        adminLoggedIn: isAdminLoggedIn,
        username: adminUsername,
        newFormat: {
          hasSession: !!session,
          isLoggedIn: session?.isLoggedIn,
          userType: session?.userType,
          username: session?.username
        },
        oldFormat: {
          adminLoggedIn: oldAdminLoggedIn,
          username: oldUsername
        }
      });
      
      if (isAdminLoggedIn) {
        // Admin user - fetch from admins collection using username
        if (adminUsername) {
          console.log('[useUserRole] Querying admins collection for username:', adminUsername);
          const q = query(collection(db, "admins"), where("username", "==", adminUsername));
          const querySnapshot = await getDocs(q);
          
          console.log('[useUserRole] Query result:', {
            empty: querySnapshot.empty,
            size: querySnapshot.size,
            docs: querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
          });
          
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            
            // Build permissions array from both permissions field and hasEditPermission
            let permissions: string[] = Array.isArray(data.permissions) ? [...data.permissions] : [];
            
            // If hasEditPermission is true, add all edit permissions
            // Note: Regular admins can only add/edit, not delete
            // Handle both boolean true and string "true" (common Firestore issue)
            const hasEditPerm = data.hasEditPermission === true || data.hasEditPermission === "true";
            if (hasEditPerm) {
              const editPermissions = [
                'edit_reports',
                'edit_residents',
                'edit_announcements',
                'edit_pins',
                'add_report_to_map',
                'add_placemark',
                'change_resident_status'
              ];
              
              // Debug logging
              console.log('[useUserRole] Admin has edit permission, adding permissions:', editPermissions);
              console.log('[useUserRole] Current permissions array before merge:', permissions);
              
              // Add permissions that aren't already in the array
              editPermissions.forEach(perm => {
                if (!permissions.includes(perm)) {
                  permissions.push(perm);
                }
              });
            }
            
            const finalUserRole = {
              id: querySnapshot.docs[0].id,
              username: data.username || adminUsername,
              name: data.name || data.fullName || adminUsername,
              userType: "admin" as const,
              email: data.email || "",
              position: data.position || "",
              idNumber: data.idNumber || "",
              profilePicture: data.profilePicture || "/accizard-uploads/login-signup-cover.png",
              coverImage: data.coverImage || "",
              permissions: permissions
            };
            
            // Debug logging
            console.log('[useUserRole] Admin data from Firestore:', {
              id: querySnapshot.docs[0].id,
              username: data.username,
              hasEditPermission: data.hasEditPermission,
              permissionsFromFirestore: data.permissions,
              finalPermissions: permissions
            });
            console.log('[useUserRole] Setting userRole:', finalUserRole);
            
            setUserRole(finalUserRole);
            setLoading(false);
            console.log('[useUserRole] Successfully set userRole for admin');
            return;
          } else {
            console.warn('[useUserRole] Admin query returned empty - admin not found in Firestore');
          }
        } else {
          console.warn('[useUserRole] No username found in localStorage');
        }
      } else {
        // Super admin user - fetch from superAdmin collection using email
        console.log('[useUserRole] Not an admin login, checking for super admin...');
        const authUser = auth.currentUser;
        if (authUser && authUser.email) {
          const q = query(collection(db, "superAdmin"), where("email", "==", authUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            setUserRole({
              id: querySnapshot.docs[0].id,
              username: data.username || authUser.email?.split("@")[0] || "",
              name: data.fullName || data.name || "",
              userType: "superadmin",
              email: data.email || authUser.email,
              position: data.position || "",
              idNumber: data.idNumber || "",
              profilePicture: data.profilePicture || "/accizard-uploads/login-signup-cover.png",
              coverImage: data.coverImage || "",
              permissions: data.permissions || []
            });
            setLoading(false);
            return;
          }
          // Fallback for super admin not found in collection - use Firebase Auth data only
          setUserRole({
            id: authUser.uid,
            username: authUser.email?.split("@")[0] || "",
            name: authUser.displayName || "",
            userType: "superadmin",
            email: authUser.email || "",
            position: "",
            idNumber: "",
            profilePicture: authUser.photoURL || "/accizard-uploads/login-signup-cover.png",
            coverImage: "",
            permissions: []
          });
          setLoading(false);
          return;
        }
      }
      
      console.warn('[useUserRole] No userRole set - userRole will be null');
      setUserRole(null);
      setLoading(false);
    } catch (error) {
      console.error("[useUserRole] Error fetching user role:", error);
      console.error("[useUserRole] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setUserRole(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, []);

  // Helper functions for role checking
  const isSuperAdmin = () => userRole?.userType === 'superadmin';
  const isAdmin = () => userRole?.userType === 'admin';
  const hasPermission = (permission: string) => {
    if (!userRole) {
      console.log('[hasPermission] No userRole, returning false for:', permission);
      return false;
    }
    const hasPerm = userRole.permissions?.includes('all') || userRole.permissions?.includes(permission);
    if (!hasPerm) {
      console.log('[hasPermission] Permission check failed:', {
        permission,
        userRolePermissions: userRole.permissions,
        userType: userRole.userType
      });
    }
    return hasPerm;
  };

  // Specific permission checks
  const canManageAdmins = () => hasPermission('manage_admins') || isSuperAdmin();
  const canViewEmail = () => hasPermission('view_email') || isSuperAdmin();
  const canManageReports = () => hasPermission('manage_reports') || isSuperAdmin();
  const canManageResidents = () => hasPermission('manage_residents') || isSuperAdmin();
  
  // Report permissions
  const canEditReports = () => {
    const result = hasPermission('edit_reports') || isSuperAdmin();
    console.log('[canEditReports]', { result, isSuperAdmin: isSuperAdmin(), hasPermission: hasPermission('edit_reports') });
    return result;
  };
  const canDeleteReports = () => hasPermission('delete_reports') || isSuperAdmin();
  const canAddReportToMap = () => {
    const result = hasPermission('add_report_to_map') || isSuperAdmin();
    console.log('[canAddReportToMap]', { result, isSuperAdmin: isSuperAdmin(), hasPermission: hasPermission('add_report_to_map') });
    return result;
  };
  
  // Map/Pin permissions
  const canAddPlacemark = () => {
    const result = hasPermission('add_placemark') || isSuperAdmin();
    console.log('[canAddPlacemark]', { result, isSuperAdmin: isSuperAdmin(), hasPermission: hasPermission('add_placemark') });
    return result;
  };
  const canEditPins = () => hasPermission('edit_pins') || isSuperAdmin();
  const canDeletePins = () => hasPermission('delete_pins') || isSuperAdmin();
  
  // Announcement permissions
  const canEditAnnouncements = () => {
    const result = hasPermission('edit_announcements') || isSuperAdmin();
    console.log('[canEditAnnouncements]', { result, isSuperAdmin: isSuperAdmin(), hasPermission: hasPermission('edit_announcements') });
    return result;
  };
  const canDeleteAnnouncements = () => hasPermission('delete_announcements') || isSuperAdmin();
  
  // Resident permissions
  const canEditResidents = () => hasPermission('edit_residents') || isSuperAdmin();
  const canDeleteResidents = () => hasPermission('delete_residents') || isSuperAdmin();
  const canChangeResidentStatus = () => {
    const result = hasPermission('change_resident_status') || isSuperAdmin();
    console.log('[canChangeResidentStatus]', { result, isSuperAdmin: isSuperAdmin(), hasPermission: hasPermission('change_resident_status') });
    return result;
  };

  return {
    userRole,
    loading,
    refreshUserRole: fetchUserRole,
    isSuperAdmin,
    isAdmin,
    hasPermission,
    canManageAdmins,
    canViewEmail,
    canManageReports,
    canManageResidents,
    canEditReports,
    canDeleteReports,
    canAddReportToMap,
    canAddPlacemark,
    canEditPins,
    canDeletePins,
    canEditAnnouncements,
    canDeleteAnnouncements,
    canEditResidents,
    canDeleteResidents,
    canChangeResidentStatus
  };
}
