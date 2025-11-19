  import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Camera, Check, X, Briefcase, Building, MapPin, Hash, AtSign, Plus, Trash2, Edit3, StickyNote } from "lucide-react";
import { Layout } from "./Layout";
import { useNavigate } from "react-router-dom";
import { db, auth, storage } from "@/lib/firebase";
import { updateProfile, updateEmail, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, orderBy, limit, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "@/components/ui/sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { SUPER_ADMIN_EMAIL } from "@/lib/utils";
import { SessionManager } from "@/lib/sessionManager";
import { logActivity, ActionType } from "@/lib/activityLogger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProfilePage() {
  const navigate = useNavigate();
  const { canViewEmail, userRole, loading: roleLoading, refreshUserRole } = useUserRole();
  const [profile, setProfile] = useState({
    name: "",
    position: "",
    idNumber: "",
    username: "",
    email: "",
    profilePicture: "",
    coverImage: ""
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [pendingProfilePicture, setPendingProfilePicture] = useState<string | null>(null);
  const [pendingCoverImage, setPendingCoverImage] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteForm, setNoteForm] = useState({
    title: "",
    description: ""
  });

  // Helper function to format Firestore timestamps
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '-';
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString();
    }
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString();
    }
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  // Helper function to get timestamp milliseconds for comparison
  const getTimestampMillis = (timestamp: any): number => {
    if (!timestamp) return 0;
    if (timestamp instanceof Timestamp) {
      return timestamp.toMillis();
    }
    if (timestamp?.toMillis && typeof timestamp.toMillis === 'function') {
      return timestamp.toMillis();
    }
    if (timestamp?.seconds) {
      return timestamp.seconds * 1000;
    }
    return new Date(timestamp).getTime();
  };

  // Handle field editing
  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setTempValue("");
  };

  const saveField = async (field: string) => {
    if (tempValue === profile[field as keyof typeof profile]) {
      cancelEditing();
      return;
    }

    setSaving(true);
    try {
      const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      if (adminLoggedIn) {
        // Update admin profile in Firestore by username
        const username = localStorage.getItem("adminUsername");
        if (username) {
          const q = query(collection(db, "admins"), where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docRef = doc(db, "admins", querySnapshot.docs[0].id);
            await updateDoc(docRef, {
              [field]: tempValue
            });
            // Refresh userRole to get updated data from Firestore
            await refreshUserRole();
            toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
          } else {
            toast.error("Admin profile not found in database.");
          }
        } else {
          toast.error("Username not found. Please refresh the page and try again.");
        }
      } else {
        // Super-admin: use Firebase Auth
        const user = auth.currentUser;
        if (user) {
            // Update superAdmin profile in Firestore by email
            const q = query(collection(db, "superAdmin"), where("email", "==", user.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const docRef = doc(db, "superAdmin", querySnapshot.docs[0].id);
              const updateData: any = {};
            if (field === 'name') {
              updateData.fullName = tempValue;
            } else {
              updateData[field] = tempValue;
            }
              
              await updateDoc(docRef, updateData);
            
            // Also update Firebase Auth for name field
            if (field === 'name') {
              await updateProfile(user, { displayName: tempValue });
            } else if (field === 'email' && tempValue !== user.email) {
              await updateEmail(user, tempValue);
            }
            
            // Refresh userRole to get updated data from Firestore
            await refreshUserRole();
            toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
          } else {
            // Super admin not found in Firestore, update Firebase Auth only
            if (field === 'name') {
              await updateProfile(user, { displayName: tempValue });
            } else if (field === 'email' && tempValue !== user.email) {
              await updateEmail(user, tempValue);
            }
            // Refresh userRole to get updated data
            await refreshUserRole();
            toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
          }
        } else {
          toast.error("User not authenticated. Please refresh the page and try again.");
        }
      }
      cancelEditing();
    } catch (error: any) {
      console.error("Error updating field:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules.");
      } else {
        toast.error(`Failed to update ${field}: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Log logout activity before clearing session (so we can still get user info)
      await logActivity({
        actionType: ActionType.LOGOUT,
        action: "User logged out",
        entityType: "session",
        metadata: {
          logoutMethod: "manual"
        }
      });
      
      // Clear session using SessionManager
      SessionManager.clearSession();
      
      // Sign out from Firebase Auth (for super admins)
      await signOut(auth);
      
      toast.success("You have been logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Error during logout. Please try again.");
    }
  };

  // Confirm profile picture change
  const confirmProfilePicture = async () => {
    if (!pendingProfilePicture || !userRole) return;

    setSaving(true);
    try {
      const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      if (adminLoggedIn) {
        const username = localStorage.getItem("adminUsername");
        if (username) {
          const q = query(collection(db, "admins"), where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docRef = doc(db, "admins", querySnapshot.docs[0].id);
            await updateDoc(docRef, {
              profilePicture: pendingProfilePicture
            });
            // Refresh userRole to get updated data from Firestore
            await refreshUserRole();
            setPendingProfilePicture(null);
            toast.success("Profile picture saved successfully!");
          } else {
            toast.error("Admin profile not found in database.");
          }
        } else {
          toast.error("Username not found. Please refresh the page and try again.");
        }
      } else {
        // Super admin user - update superAdmin collection by email
        const user = auth.currentUser;
        if (user && user.email) {
          const q = query(collection(db, "superAdmin"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docRef = doc(db, "superAdmin", querySnapshot.docs[0].id);
            await updateDoc(docRef, {
              profilePicture: pendingProfilePicture
            });
            // Refresh userRole to get updated data from Firestore
            await refreshUserRole();
            setPendingProfilePicture(null);
            toast.success("Profile picture saved successfully!");
          } else {
            toast.error("Super admin profile not found in database.");
          }
        } else {
          toast.error("User not authenticated. Please refresh the page and try again.");
        }
      }
    } catch (error: any) {
      console.error("Error saving profile picture:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules.");
      } else {
        toast.error(`Failed to save profile picture: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Cancel profile picture change
  const cancelProfilePicture = () => {
    const originalPicture = userRole?.profilePicture || "/accizard-uploads/login-signup-cover.png";
    setProfile(prev => ({ ...prev, profilePicture: originalPicture }));
    setPendingProfilePicture(null);
    toast.info("Profile picture change cancelled.");
  };

  // Confirm cover image change
  const confirmCoverImage = async () => {
    if (!pendingCoverImage || !userRole) return;

    setSaving(true);
    try {
      const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      if (adminLoggedIn) {
        const username = localStorage.getItem("adminUsername");
        if (username) {
          const q = query(collection(db, "admins"), where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docRef = doc(db, "admins", querySnapshot.docs[0].id);
            await updateDoc(docRef, {
              coverImage: pendingCoverImage
            });
            // Refresh userRole to get updated data from Firestore
            await refreshUserRole();
            setPendingCoverImage(null);
            toast.success("Cover image saved successfully!");
          } else {
            toast.error("Admin profile not found in database.");
          }
        } else {
          toast.error("Username not found. Please refresh the page and try again.");
        }
      } else {
        // Super admin user - update superAdmin collection by email
        const user = auth.currentUser;
        if (user && user.email) {
          const q = query(collection(db, "superAdmin"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docRef = doc(db, "superAdmin", querySnapshot.docs[0].id);
            await updateDoc(docRef, {
              coverImage: pendingCoverImage
            });
            // Refresh userRole to get updated data from Firestore
            await refreshUserRole();
            setPendingCoverImage(null);
            toast.success("Cover image saved successfully!");
          } else {
            toast.error("Super admin profile not found in database.");
          }
        } else {
          toast.error("User not authenticated. Please refresh the page and try again.");
        }
      }
    } catch (error: any) {
      console.error("Error saving cover image:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules.");
      } else {
        toast.error(`Failed to save cover image: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Cancel cover image change
  const cancelCoverImage = () => {
    const originalCover = userRole?.coverImage || "";
    setProfile(prev => ({ ...prev, coverImage: originalCover }));
    setPendingCoverImage(null);
    toast.info("Cover image change cancelled.");
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!userRole) {
        toast.error("User information not loaded. Please refresh the page and try again.");
        return;
      }

      setUploading(true);
      try {
        if (file.size > 5 * 1024 * 1024) {
          toast.error("File size must be less than 5MB");
          return;
        }

        if (!file.type.startsWith('image/')) {
          toast.error("Please select an image file");
          return;
        }

        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const filename = `profile-pictures-web/${userRole.id}-${timestamp}.${fileExtension}`;
        
        const storageRef = ref(storage, filename);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        setPendingProfilePicture(downloadURL);
        setProfile(prev => ({ ...prev, profilePicture: downloadURL }));
        toast.success("Profile picture uploaded! Click the checkmark to confirm.");
      } catch (error: any) {
        console.error("Error uploading profile picture:", error);
          toast.error(`Failed to upload profile picture: ${error.message || 'Unknown error'}`);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!userRole) {
        toast.error("User information not loaded. Please refresh the page and try again.");
        return;
      }

      setUploadingCover(true);
      try {
        if (file.size > 5 * 1024 * 1024) {
          toast.error("File size must be less than 5MB");
          return;
        }

        if (!file.type.startsWith('image/')) {
          toast.error("Please select an image file");
          return;
        }

        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const filename = `cover-images-web/${userRole.id}-${timestamp}.${fileExtension}`;
        
        const storageRef = ref(storage, filename);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        setPendingCoverImage(downloadURL);
        setProfile(prev => ({ ...prev, coverImage: downloadURL }));
        toast.success("Cover image uploaded! Click the checkmark to confirm.");
      } catch (error: any) {
        console.error("Error uploading cover image:", error);
        toast.error(`Failed to upload cover image: ${error.message || 'Unknown error'}`);
      } finally {
        setUploadingCover(false);
      }
    }
  };

  useEffect(() => {
    if (userRole && !roleLoading) {
      // Only update profile if it's different to avoid unnecessary resets
      // This prevents overwriting user edits with stale data
      setProfile(prev => {
        const newProfile = {
        name: userRole.name || "",
        position: userRole.position || "",
        idNumber: userRole.idNumber || "",
        username: userRole.username || "",
        email: userRole.email || "",
        profilePicture: userRole.profilePicture || "/accizard-uploads/login-signup-cover.png",
        coverImage: userRole.coverImage || ""
        };
        // Only update if values actually changed (prevents overwriting during save)
        // Check each field individually to avoid unnecessary updates
        const hasChanges = 
          prev.name !== newProfile.name ||
          prev.position !== newProfile.position ||
          prev.idNumber !== newProfile.idNumber ||
          prev.username !== newProfile.username ||
          prev.email !== newProfile.email ||
          prev.profilePicture !== newProfile.profilePicture ||
          prev.coverImage !== newProfile.coverImage;
        
        if (hasChanges && !editingField) {
          return newProfile;
        }
        return prev;
      });
      // Clear any pending changes when userRole changes (only when not editing)
      if (!editingField) {
      setPendingProfilePicture(null);
      setPendingCoverImage(null);
    }
    }
  }, [userRole, roleLoading, editingField]);

  // Fetch personal activity logs
  useEffect(() => {
    async function fetchLogs() {
      if (!profile.name && !profile.username) return;
      setLogsLoading(true);
      try {
        // Activity logs store the name in 'admin' or 'actor' fields
        const userName = profile.name || profile.username;
        if (!userName) return;
        
        // Fetch logs where admin OR actor matches the user's name
        // Since Firestore doesn't support OR in a single query, we'll fetch both and merge
        const allLogs: any[] = [];
        const seenIds = new Set<string>();
        
        const convertTimestamp = (timestamp: any): Date | null => {
          if (!timestamp) return null;
          if (timestamp instanceof Date) return timestamp;
          if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
          }
          if (timestamp instanceof Timestamp) {
            return timestamp.toDate();
          }
          if (timestamp?.seconds) {
            return new Date(timestamp.seconds * 1000);
          }
          try {
            return new Date(timestamp);
          } catch {
            return null;
          }
        };
        
        // Fetch logs by admin field
        try {
          const q1 = query(
            collection(db, "activityLogs"),
            where("admin", "==", userName),
            orderBy("timestamp", "desc"),
            limit(20)
          );
          const snap1 = await getDocs(q1);
          snap1.docs.forEach(doc => {
            if (!seenIds.has(doc.id)) {
              const data = doc.data();
              const timestamp = convertTimestamp(data.timestamp);
              allLogs.push({ ...data, id: doc.id, timestamp });
              seenIds.add(doc.id);
            }
          });
        } catch (error: any) {
          // If query fails (e.g., missing index), try without orderBy
          if (error.code === 'failed-precondition') {
            const q1b = query(
              collection(db, "activityLogs"),
              where("admin", "==", userName)
            );
            const snap1b = await getDocs(q1b);
            snap1b.docs.forEach(doc => {
              if (!seenIds.has(doc.id)) {
                const data = doc.data();
                const timestamp = convertTimestamp(data.timestamp);
                allLogs.push({ ...data, id: doc.id, timestamp });
                seenIds.add(doc.id);
              }
            });
          }
        }
        
        // Fetch logs by actor field (in case some logs use actor instead of admin)
        try {
          const q2 = query(
            collection(db, "activityLogs"),
            where("actor", "==", userName),
            orderBy("timestamp", "desc"),
            limit(20)
          );
          const snap2 = await getDocs(q2);
          snap2.docs.forEach(doc => {
            if (!seenIds.has(doc.id)) {
              const data = doc.data();
              const timestamp = convertTimestamp(data.timestamp);
              allLogs.push({ ...data, id: doc.id, timestamp });
              seenIds.add(doc.id);
            }
          });
        } catch (error: any) {
          // If query fails, try without orderBy
          if (error.code === 'failed-precondition') {
            const q2b = query(
              collection(db, "activityLogs"),
              where("actor", "==", userName)
            );
            const snap2b = await getDocs(q2b);
            snap2b.docs.forEach(doc => {
              if (!seenIds.has(doc.id)) {
                const data = doc.data();
                const timestamp = convertTimestamp(data.timestamp);
                allLogs.push({ ...data, id: doc.id, timestamp });
                seenIds.add(doc.id);
              }
            });
          }
        }
        
        // Sort all logs by timestamp (descending) and limit to 20
        allLogs.sort((a: any, b: any) => {
          const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
          const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
          return bTime - aTime; // desc order
        });
        
        setActivityLogs(allLogs.slice(0, 20));
      } catch (error) {
        console.error("Error fetching activity logs:", error);
      } finally {
        setLogsLoading(false);
      }
    }
    fetchLogs();
  }, [profile.name, profile.username]);

  // Fetch personal notes
  useEffect(() => {
    async function fetchNotes() {
      if (!profile.username) return;
      setNotesLoading(true);
      try {
        const q = query(
          collection(db, "personalNotes"),
          where("username", "==", profile.username),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setNotes(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      } catch (error: any) {
        // If composite index is missing, try without orderBy
        if (error.code === 'failed-precondition') {
          const q = query(
            collection(db, "personalNotes"),
            where("username", "==", profile.username)
          );
          const snap = await getDocs(q);
          const notesData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          // Sort manually by createdAt
          notesData.sort((a: any, b: any) => {
            const aTime = getTimestampMillis(a.createdAt);
            const bTime = getTimestampMillis(b.createdAt);
            return bTime - aTime; // desc order
          });
          setNotes(notesData);
        } else {
          console.error("Error fetching notes:", error);
        }
      } finally {
        setNotesLoading(false);
      }
    }
    fetchNotes();
  }, [profile.username]);

  // Notes CRUD operations
  const handleSaveNote = async () => {
    if (!noteForm.description.trim()) {
      toast.error("Please enter a note");
      return;
    }

    if (!profile.username) {
      toast.error("Username not found. Please refresh the page and try again.");
      return;
    }

    try {
      if (editingNote) {
        // Update existing note
        await updateDoc(doc(db, "personalNotes", editingNote.id), {
          description: noteForm.description,
          updatedAt: serverTimestamp()
        });
        toast.success("Note updated successfully!");
      } else {
        // Create new note
        await addDoc(collection(db, "personalNotes"), {
          description: noteForm.description,
          username: profile.username,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Note created successfully!");
      }
      
      // Refresh notes - try with orderBy first, fallback to without if index missing
      try {
        const q = query(
          collection(db, "personalNotes"),
          where("username", "==", profile.username),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setNotes(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      } catch (queryError: any) {
        // If composite index is missing, try without orderBy
        if (queryError.code === 'failed-precondition') {
          const q = query(
            collection(db, "personalNotes"),
            where("username", "==", profile.username)
          );
          const snap = await getDocs(q);
          const notesData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          // Sort manually by createdAt
          notesData.sort((a: any, b: any) => {
            const aTime = getTimestampMillis(a.createdAt);
            const bTime = getTimestampMillis(b.createdAt);
            return bTime - aTime; // desc order
          });
          setNotes(notesData);
        } else {
          throw queryError;
        }
      }
      
      // Reset form
      setNoteForm({ title: "", description: "" });
      setEditingNote(null);
      setShowNoteDialog(false);
    } catch (error: any) {
      console.error("Error saving note:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please make sure Firestore rules are deployed.");
      } else {
        toast.error(`Failed to save note: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, "personalNotes", noteId));
      setNotes(notes.filter(note => note.id !== noteId));
      toast.success("Note deleted successfully!");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note. Please try again.");
    }
  };

  const handleEditNote = (note: any) => {
    setEditingNote(note);
    setNoteForm({
      title: "",
      description: note.description || ""
    });
    setShowNoteDialog(true);
  };

  const handleNewNote = () => {
    setEditingNote(null);
    setNoteForm({ title: "", description: "" });
    setShowNoteDialog(true);
  };

  const EditableField = ({ field, label, icon: Icon, value, type = "text" }: {
    field: string;
    label: string;
    icon: any;
    value: string;
    type?: string;
  }) => {
    const isEditing = editingField === field;
    
    return (
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Icon className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        </div>
        <div className="flex items-center space-x-3 py-1">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center space-x-2">
                <Input
                  type={type}
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField(field);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => saveField(field)}
                  disabled={saving}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="text-sm text-gray-700 cursor-pointer hover:text-gray-900 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                onClick={() => startEditing(field, value)}
              >
                {value || `Add ${label.toLowerCase()}`}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Cover Image Section */}
        <div className="relative mb-6">
          <div className="h-48 bg-gray-200 rounded-lg overflow-hidden relative">
            {profile.coverImage ? (
              <>
                <img 
                  src={profile.coverImage} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
                {pendingCoverImage && (
                  <div className="absolute top-2 right-2 flex gap-2 z-10">
                    <Button
                      size="sm"
                      onClick={confirmCoverImage}
                      disabled={saving}
                      className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg"
                      title="Confirm cover image"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={cancelCoverImage}
                      disabled={saving}
                      className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                      title="Cancel cover image change"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {!pendingCoverImage && (
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('cover-image')?.click()}
                    disabled={uploadingCover || saving}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white shadow-lg"
                    size="sm"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                )}
                <input
                  id="cover-image"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageUpload}
                  className="hidden"
                  disabled={uploadingCover || saving}
                />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('cover-image')?.click()}
                  disabled={uploadingCover}
                  className="bg-white/80 hover:bg-white"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {uploadingCover ? "Uploading..." : "Add cover image"}
                </Button>
                <input
                  id="cover-image"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageUpload}
                  className="hidden"
                  disabled={uploadingCover}
                />
              </div>
            )}
          </div>
          
          {/* Profile Picture */}
          <div className="absolute -bottom-8 left-6">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                <AvatarImage src={profile.profilePicture} alt={profile.name} />
                <AvatarFallback className="bg-gray-100 text-gray-600 text-lg">
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              {pendingProfilePicture ? (
                <div className="absolute -top-2 -right-2 flex gap-1 z-10">
                  <Button
                    size="sm"
                    onClick={confirmProfilePicture}
                    disabled={saving}
                    className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg"
                    title="Confirm profile picture"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={cancelProfilePicture}
                    disabled={saving}
                    className="h-7 w-7 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                    title="Cancel profile picture change"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label 
                  htmlFor="profile-picture" 
                  className={`absolute bottom-0 right-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg ${uploading || saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploading ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <input 
                    id="profile-picture" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProfilePictureUpload} 
                    className="hidden" 
                    disabled={uploading || saving} 
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-12">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-2 flex flex-col">
            {/* User Name */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{profile.name || "Your Name"}</h1>
              <p className="text-gray-600">{profile.position || "Your Position"}</p>
                    </div>

            {/* About Section */}
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField
                  field="name"
                  label="Full Name"
                  icon={User}
                  value={profile.name}
                />
                <EditableField
                  field="position"
                  label="Position"
                  icon={Briefcase}
                  value={profile.position}
                />
                <EditableField
                  field="idNumber"
                  label="ID Number"
                  icon={Hash}
                  value={profile.idNumber}
                />
                <EditableField
                  field="username"
                  label="Username"
                  icon={AtSign}
                  value={profile.username}
                />
                    {canViewEmail() && (
                  <EditableField
                    field="email"
                    label="Email"
                    icon={AtSign}
                    value={profile.email}
                    type="email"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity Logs and Notes */}
          <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
            {/* Personal Notes */}
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">Personal Notes</CardTitle>
                <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={handleNewNote} size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader className="border-b border-gray-200 pb-4">
                      <DialogTitle className="flex items-center gap-2">
                        <StickyNote className="h-5 w-5 text-[#FF4F0B]" />
                        {editingNote ? 'Edit Note' : 'Add New Note'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="note-description">Note</Label>
                        <Textarea
                          id="note-description"
                          value={noteForm.description}
                          onChange={(e) => setNoteForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter your note..."
                          rows={6}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveNote} className="bg-brand-orange hover:bg-brand-orange/90 text-white">
                          {editingNote ? 'Update' : 'Save'} Note
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-2">
                {notesLoading ? (
                  <div className="text-center text-gray-500 py-4 text-sm">Loading notes...</div>
                ) : notes.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <StickyNote className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No notes yet. Create your first note!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 flex-1">
                    {notes.map((note) => (
                      <div key={note.id} className="border rounded-md p-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 flex flex-col">
                            <p className="text-sm text-gray-900 mb-2 line-clamp-3">{note.description || note.title}</p>
                            <p className="text-xs text-gray-400">
                              {formatTimestamp(note.createdAt)}
                              {note.updatedAt && getTimestampMillis(note.updatedAt) !== getTimestampMillis(note.createdAt) && (
                                <span> • Updated</span>
                              )}
                            </p>
                          </div>
                          <div className="flex space-x-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditNote(note)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteNote(note.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Personal Activity Log */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">Personal Activity Log</CardTitle>
                {activityLogs.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/system-logs?search=${encodeURIComponent(profile.name || profile.username)}`)}
                    className="text-xs"
                  >
                    See all
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {logsLoading ? (
                  <div className="text-center text-gray-500 py-8 text-sm">Loading activity logs...</div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">No activity logs found.</div>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.map((log, idx) => {
                      // Format timestamp
                      let logDate: Date | null = null;
                      if (log.timestamp instanceof Date) {
                        logDate = log.timestamp;
                      } else if (log.timestamp?.toDate && typeof log.timestamp.toDate === 'function') {
                        logDate = log.timestamp.toDate();
                      } else if (log.timestamp instanceof Timestamp) {
                        logDate = log.timestamp.toDate();
                      } else if (log.timestamp?.seconds) {
                        logDate = new Date(log.timestamp.seconds * 1000);
                      } else if (log.timestamp) {
                        logDate = new Date(log.timestamp);
                      }
                      
                      const formattedDate = logDate ? logDate.toLocaleDateString() : '-';
                      const formattedTime = logDate ? logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
                      const logMessage = log.action || log.details || log.description || '-';
                      
                      return (
                        <div key={log.id || idx} className="border-b border-gray-100 pb-3 last:border-0">
                          <p className="text-xs text-gray-500 mb-1">
                            {formattedDate} • {formattedTime}
                          </p>
                          <p className="text-sm text-gray-900 break-words whitespace-normal">
                            {logMessage}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}