import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

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
      const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      
      if (adminLoggedIn) {
        // Admin user - fetch from admins collection using username
        const username = localStorage.getItem("adminUsername");
        if (username) {
          const q = query(collection(db, "admins"), where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            
            // Build permissions array from both permissions field and hasEditPermission
            let permissions: string[] = Array.isArray(data.permissions) ? [...data.permissions] : [];
            
            // If hasEditPermission is true, add all edit permissions
            // Include manage permissions so admins can add/edit items
            if (data.hasEditPermission === true) {
              const editPermissions = [
                'manage_admins',        // Required for canManageAdmins() - allows adding/editing admins
                'manage_residents',     // Required for canManageResidents() - allows adding/editing residents
                'edit_reports',
                'edit_residents',
                'edit_announcements',
                'edit_pins',
                'delete_reports',
                'delete_residents',
                'delete_announcements',
                'delete_pins',
                'add_report_to_map',
                'change_resident_status'
              ];
              
              // Add permissions that aren't already in the array
              editPermissions.forEach(perm => {
                if (!permissions.includes(perm)) {
                  permissions.push(perm);
                }
              });
            }
            
            setUserRole({
              id: querySnapshot.docs[0].id,
              username: data.username || username,
              name: data.name || data.fullName || username,
              userType: "admin",
              email: data.email || "",
              position: data.position || "",
              idNumber: data.idNumber || "",
              profilePicture: data.profilePicture || "/accizard-uploads/login-signup-cover.png",
              coverImage: data.coverImage || "",
              permissions: permissions
            });
            setLoading(false);
            return;
          }
        }
      } else {
        // Super admin user - fetch from superAdmin collection using email
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
        }
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching user role:", error);
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
    if (!userRole) return false;
    return userRole.permissions?.includes('all') || userRole.permissions?.includes(permission);
  };

  // Specific permission checks
  const canManageAdmins = () => hasPermission('manage_admins') || isSuperAdmin();
  const canViewEmail = () => hasPermission('view_email') || isSuperAdmin();
  const canManageReports = () => hasPermission('manage_reports') || isSuperAdmin();
  const canManageResidents = () => hasPermission('manage_residents') || isSuperAdmin();
  
  // Report permissions
  const canEditReports = () => hasPermission('edit_reports') || isSuperAdmin();
  const canDeleteReports = () => hasPermission('delete_reports') || isSuperAdmin();
  const canAddReportToMap = () => hasPermission('add_report_to_map') || isSuperAdmin();
  
  // Map/Pin permissions
  const canAddPlacemark = () => hasPermission('add_placemark') || isSuperAdmin();
  const canEditPins = () => hasPermission('edit_pins') || isSuperAdmin();
  const canDeletePins = () => hasPermission('delete_pins') || isSuperAdmin();
  
  // Announcement permissions
  const canEditAnnouncements = () => hasPermission('edit_announcements') || isSuperAdmin();
  const canDeleteAnnouncements = () => hasPermission('delete_announcements') || isSuperAdmin();
  
  // Resident permissions
  const canEditResidents = () => hasPermission('edit_residents') || isSuperAdmin();
  const canDeleteResidents = () => hasPermission('delete_residents') || isSuperAdmin();
  const canChangeResidentStatus = () => hasPermission('change_resident_status') || isSuperAdmin();

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
