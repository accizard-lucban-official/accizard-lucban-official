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

  useEffect(() => {
    async function fetchUserRole() {
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
              setUserRole({
                id: querySnapshot.docs[0].id,
                username: data.username || username,
                name: data.name || data.fullName || username,
                userType: "admin",
                email: data.email || "", // Add email field for admins
                position: data.position || "Admin",
                idNumber: data.idNumber || "", // Add idNumber field
                profilePicture: data.profilePicture || "/accizard-uploads/login-signup-cover.png", // Add profilePicture field with default
                coverImage: data.coverImage || "", // Add coverImage field
                permissions: data.permissions || ["view_reports", "manage_residents"]
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
                username: data.username || authUser.email?.split("@")[0] || "Super Admin",
                name: data.fullName || data.name || "Super Admin",
                userType: "superadmin",
                email: data.email || authUser.email,
                position: data.position || "Super Admin",
                idNumber: data.idNumber || "", // Add idNumber field
                profilePicture: data.profilePicture || "/accizard-uploads/login-signup-cover.png", // Add profilePicture field with default
                coverImage: data.coverImage || "", // Add coverImage field
                permissions: data.permissions || ["all"] // Super admins have all permissions
              });
              setLoading(false);
              return;
            }
            // Fallback for super admin not found in collection
            setUserRole({
              id: authUser.uid,
              username: authUser.email?.split("@")[0] || "Super Admin",
              name: authUser.displayName || authUser.email?.split("@")[0] || "Super Admin",
              userType: "superadmin",
              email: authUser.email || "",
              position: "Super Admin",
              idNumber: "", // No idNumber for fallback
              profilePicture: authUser.photoURL || "/accizard-uploads/login-signup-cover.png", // Use Firebase Auth photoURL or default
              coverImage: "", // No coverImage for fallback
              permissions: ["all"]
            });
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setLoading(false);
      }
    }
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

  return {
    userRole,
    loading,
    isSuperAdmin,
    isAdmin,
    hasPermission,
    canManageAdmins,
    canViewEmail,
    canManageReports,
    canManageResidents
  };
}
