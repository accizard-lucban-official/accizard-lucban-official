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
import { updateProfile, updateEmail } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "@/components/ui/sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { SUPER_ADMIN_EMAIL } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProfilePage() {
  const navigate = useNavigate();
  const { canViewEmail, userRole, loading: roleLoading } = useUserRole();
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
            setProfile(prev => ({ ...prev, [field]: tempValue }));
            toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
          }
        }
      } else {
        // Super-admin: use Firebase Auth
        const user = auth.currentUser;
        if (user) {
          if (user.email === SUPER_ADMIN_EMAIL) {
            // Update superAdmin profile in Firestore by email
            const q = query(collection(db, "superAdmin"), where("email", "==", user.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const docRef = doc(db, "superAdmin", querySnapshot.docs[0].id);
              const updateData: any = {};
              if (field === 'name') updateData.fullName = tempValue;
              else updateData[field] = tempValue;
              
              await updateDoc(docRef, updateData);
              setProfile(prev => ({ ...prev, [field]: tempValue }));
              toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
            }
          } else {
            // For other super-admins, update Firebase Auth profile
            if (field === 'name') {
              await updateProfile(user, { displayName: tempValue });
            } else if (field === 'email' && tempValue !== user.email) {
              await updateEmail(user, tempValue);
            }
            setProfile(prev => ({ ...prev, [field]: tempValue }));
            toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
          }
        }
      }
      cancelEditing();
    } catch (error) {
      toast.error(`Failed to update ${field}.`);
      console.error("Error updating field:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    console.log("Signing out...");
    navigate('/login');
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
            setProfile(prev => ({ ...prev, profilePicture: pendingProfilePicture }));
            setPendingProfilePicture(null);
            toast.success("Profile picture saved successfully!");
          }
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
            setProfile(prev => ({ ...prev, profilePicture: pendingProfilePicture }));
            setPendingProfilePicture(null);
            toast.success("Profile picture saved successfully!");
          } else {
            toast.error("Super admin profile not found in database.");
          }
        }
      }
    } catch (error) {
      console.error("Error saving profile picture:", error);
      toast.error("Failed to save profile picture.");
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
            setProfile(prev => ({ ...prev, coverImage: pendingCoverImage }));
            setPendingCoverImage(null);
            toast.success("Cover image saved successfully!");
          }
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
            setProfile(prev => ({ ...prev, coverImage: pendingCoverImage }));
            setPendingCoverImage(null);
            toast.success("Cover image saved successfully!");
          } else {
            toast.error("Super admin profile not found in database.");
          }
        }
      }
    } catch (error) {
      console.error("Error saving cover image:", error);
      toast.error("Failed to save cover image.");
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
      setProfile({
        name: userRole.name || "",
        position: userRole.position || "",
        idNumber: userRole.idNumber || "",
        username: userRole.username || "",
        email: userRole.email || "",
        profilePicture: userRole.profilePicture || "/accizard-uploads/login-signup-cover.png",
        coverImage: userRole.coverImage || ""
      });
      // Clear any pending changes when userRole changes
      setPendingProfilePicture(null);
      setPendingCoverImage(null);
    }
  }, [userRole, roleLoading]);

  // Fetch personal activity logs
  useEffect(() => {
    async function fetchLogs() {
      if (!profile.username) return;
      setLogsLoading(true);
      const q = query(
        collection(db, "activityLogs"),
        where("username", "==", profile.username),
        orderBy("timestamp", "desc"),
        limit(15)
      );
      const snap = await getDocs(q);
      setActivityLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLogsLoading(false);
    }
    fetchLogs();
  }, [profile.username]);

  // Fetch personal notes
  useEffect(() => {
    async function fetchNotes() {
      if (!profile.username) return;
      setNotesLoading(true);
      const q = query(
        collection(db, "personalNotes"),
        where("username", "==", profile.username),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setNotes(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setNotesLoading(false);
    }
    fetchNotes();
  }, [profile.username]);

  // Notes CRUD operations
  const handleSaveNote = async () => {
    if (!noteForm.title.trim() || !noteForm.description.trim()) {
      toast.error("Please fill in both title and description");
      return;
    }

    try {
      if (editingNote) {
        // Update existing note
        await updateDoc(doc(db, "personalNotes", editingNote.id), {
          title: noteForm.title,
          description: noteForm.description,
          updatedAt: serverTimestamp()
        });
        toast.success("Note updated successfully!");
      } else {
        // Create new note
        await addDoc(collection(db, "personalNotes"), {
          title: noteForm.title,
          description: noteForm.description,
          username: profile.username,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Note created successfully!");
      }
      
      // Refresh notes
      const q = query(
        collection(db, "personalNotes"),
        where("username", "==", profile.username),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setNotes(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      
      // Reset form
      setNoteForm({ title: "", description: "" });
      setEditingNote(null);
      setShowNoteDialog(false);
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note. Please try again.");
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
      title: note.title,
      description: note.description
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
          <div className="lg:col-span-2 space-y-6">
            {/* User Name */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{profile.name || "Your Name"}</h1>
              <p className="text-gray-600">{profile.position || "Your Position"}</p>
                    </div>

            {/* About Section */}
            <Card>
              <CardHeader>
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
          <div className="lg:col-span-3 space-y-6">
            {/* Personal Notes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
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
                        <Label htmlFor="note-title">Title</Label>
                        <Input
                          id="note-title"
                          value={noteForm.title}
                          onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter note title..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="note-description">Description</Label>
                        <Textarea
                          id="note-description"
                          value={noteForm.description}
                          onChange={(e) => setNoteForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter note description..."
                          rows={4}
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
              <CardContent>
                {notesLoading ? (
                  <div className="text-center text-gray-500 py-8">Loading notes...</div>
                ) : notes.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <StickyNote className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No notes yet. Create your first note!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <div key={note.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-2">{note.title}</h4>
                            <p className="text-sm text-gray-600 mb-2">{note.description}</p>
                            <p className="text-xs text-gray-500">
                              Created: {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : '-'}
                              {note.updatedAt && note.updatedAt !== note.createdAt && (
                                <span> • Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditNote(note)}
                              className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteNote(note.id)}
                              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Personal Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="text-center text-gray-500 py-8">Loading activity logs...</div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No activity logs found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Created Date</TableHead>
                          <TableHead>Action Type</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs.map((log, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">
                              {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{log.action || '-'}</TableCell>
                            <TableCell className="text-sm">{log.details || log.description || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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