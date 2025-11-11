import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Shield, ShieldOff, ShieldCheck, ShieldX, Eye, User, FileText, Calendar, CheckSquare, Square, UserPlus, EyeOff, ChevronUp, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, Upload, X, FileDown } from "lucide-react";
import { Layout } from "./Layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { db, deleteResidentUserFunction, storage } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";

// Add this helper at the top (after imports):
function formatTimeNoSeconds(time: string | number | null | undefined) {
  if (!time) return '-';
  let dateObj;
  if (typeof time === 'number') {
    dateObj = new Date(time);
  } else if (/\d{1,2}:\d{2}:\d{2}/.test(time)) { // e.g. '14:23:45'
    const today = new Date();
    dateObj = new Date(`${today.toDateString()} ${time}`);
  } else {
    dateObj = new Date(time);
  }
  if (isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

const ADMIN_POSITIONS_COLLECTION = "adminPositions";

export function ManageUsersPage() {
  const { userRole, loading: roleLoading, canManageAdmins } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [permissionFilter, setPermissionFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [isEditResidentOpen, setIsEditResidentOpen] = useState(false);
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [showResidentPreview, setShowResidentPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<boolean>(false);
  const [activeResidentTab, setActiveResidentTab] = useState<'profile' | 'reports'>('profile');
  const [residentReports, setResidentReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [confirmPermissionChange, setConfirmPermissionChange] = useState<any>(null);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [selectedResidents, setSelectedResidents] = useState<string[]>([]);
  const [adminDateRange, setAdminDateRange] = useState<DateRange | undefined>();
  const [residentDateRange, setResidentDateRange] = useState<DateRange | undefined>();
  const [confirmBatchAction, setConfirmBatchAction] = useState<{
    type: 'delete' | 'permission' | 'verification';
    value?: boolean;
    items: string[];
  } | null>(null);
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    position: "",
    idNumber: "",
    username: "",
    password: ""
  });
  const [newResident, setNewResident] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    barangay: "",
    cityTown: "",
    homeAddress: "",
    validId: "",
    validIdUrl: "",
    additionalInfo: ""
  });
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);

  // Add new state for account status modal
  const [accountStatusModal, setAccountStatusModal] = useState<{ open: boolean, resident: any | null }>({ open: false, resident: null });
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([]);
  const [newPosition, setNewPosition] = useState("");
  const [confirmDeletePosition, setConfirmDeletePosition] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showAdminPasswords, setShowAdminPasswords] = useState<{ [id: string]: boolean }>({});
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState<string | null>(null);
  const [isAddingResident, setIsAddingResident] = useState(false);
  const [isDeletingResident, setIsDeletingResident] = useState<string | null>(null);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState<string | null>(null);
  const [showAllAdminPasswords, setShowAllAdminPasswords] = useState(false);
  const [showAdminFormErrors, setShowAdminFormErrors] = useState(false);
  const [showEditAdminErrors, setShowEditAdminErrors] = useState(false);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingResidents, setIsLoadingResidents] = useState(true);

  const { toast } = useToast();

  const positionOptions = useMemo(() => positions.map(position => position.name), [positions]);

  useEffect(() => {
    async function fetchPositions() {
      try {
        const snapshot = await getDocs(collection(db, ADMIN_POSITIONS_COLLECTION));
        if (snapshot.empty) {
          setPositions([]);
          return;
        }

        const fetched = snapshot.docs
          .map(docSnap => {
            const data = docSnap.data();
            const name = (data?.name || data?.title || "").toString().trim();
            if (!name) return null;
            return {
              id: docSnap.id,
              name
            };
          })
          .filter((option): option is { id: string; name: string } => option !== null)
          .sort((a, b) => a.name.localeCompare(b.name));

        setPositions(fetched);
      } catch (error) {
        console.error("Error fetching admin positions:", error);
        setPositions([]);
      }
    }

    fetchPositions();
  }, []);

  const parseDateString = (value: string): Date | null => {
    if (!value) return null;

    const direct = new Date(value);
    if (!isNaN(direct.getTime())) {
      return direct;
    }

    const parts = value.split(/[\/\-]/).map(part => part.trim());
    if (parts.length !== 3) {
      return null;
    }

    let year: number;
    let month: number;
    let day: number;

    if (value.includes("-") && parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      const yearPart = parts[2];
      const yearNumber = parseInt(yearPart, 10);
      if (Number.isNaN(yearNumber)) {
        return null;
      }
      year = yearPart.length === 2 ? 2000 + yearNumber : yearNumber;
    }

    if ([year, month, day].some(num => Number.isNaN(num))) {
      return null;
    }

    const result = new Date(year, month - 1, day);
    return Number.isNaN(result.getTime()) ? null : result;
  };

  const parseDateValue = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
      return parseDateString(value);
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in (value as { toDate?: () => unknown }) &&
      typeof (value as { toDate?: () => unknown }).toDate === "function"
    ) {
      return parseDateValue(
        (value as { toDate: () => Date }).toDate()
      );
    }
    return null;
  };

  const isWithinDateRange = (date: Date | null, range: DateRange | undefined) => {
    if (!range?.from || !range?.to) {
      return true;
    }
    if (!date) {
      return true;
    }
    const from = new Date(range.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(range.to);
    to.setHours(23, 59, 59, 999);
    return date >= from && date <= to;
  };

  const location = useLocation();

  // Validation function for new admin
  const isNewAdminValid = () => {
    return newAdmin.name.trim() !== "" && 
           newAdmin.position.trim() !== "" && 
           newAdmin.idNumber.trim() !== "" && 
           newAdmin.username.trim() !== "" && 
           newAdmin.password.trim() !== "" &&
           passwordError === "";
  };

  // Validation function for new resident
  const isNewResidentValid = () => {
    return newResident.fullName.trim() !== "" && 
           newResident.phoneNumber.trim() !== "" && 
           newResident.email.trim() !== "" && 
           newResident.barangay.trim() !== "" && 
           newResident.cityTown.trim() !== "";
  };

  // Add state for residentReportsCount
  const [residentReportsCount, setResidentReportsCount] = useState(0);

  // Add sorting state for admin table
  const [adminSortField, setAdminSortField] = useState<string>('');
  const [adminSortDirection, setAdminSortDirection] = useState<'asc' | 'desc'>('asc');

  // Add sorting state for resident table
  const [residentSortField, setResidentSortField] = useState<string>('');
  const [residentSortDirection, setResidentSortDirection] = useState<'asc' | 'desc'>('asc');

  // Add pagination state
  const [adminPage, setAdminPage] = useState(1);
  const [residentPage, setResidentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Add rows per page state
  const [adminRowsPerPage, setAdminRowsPerPage] = useState(20);
  const [residentRowsPerPage, setResidentRowsPerPage] = useState(20);
  const ROWS_OPTIONS = [10, 20, 50, 100];

  // Add state to force re-render after resetting badge counts
  const [badgeResetKey, setBadgeResetKey] = useState(0);

  useEffect(() => {
    async function fetchAdmins() {
      try {
        const querySnapshot = await getDocs(collection(db, "admins"));
        const admins = querySnapshot.docs.map(doc => {
          let userId = doc.data().userId;
          if (typeof userId === 'number') {
            userId = `AID-${userId}`;
          } else if (typeof userId === 'string' && !userId.startsWith('AID-')) {
            // Try to parse as number and reformat
            const num = parseInt(userId);
            if (!isNaN(num)) userId = `AID-${num}`;
          }
          return {
            id: doc.id,
            ...doc.data(),
            userId: userId || `AID-${doc.id.slice(-6)}`
          };
        });
        setAdminUsers(admins);
        setIsLoadingAdmins(false);
      } catch (error) {
        console.error("Error fetching admins:", error);
        setIsLoadingAdmins(false);
      }
    }
    
    async function fetchResidents() {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        console.log("📊 Fetched residents from Firestore:", querySnapshot.size, "documents");
        
        const usersPromises = querySnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          
          // Handle different field names for profile picture
          const profilePicture = data.profilePicture || data.profilePictureUrl || data.profile_picture || data.avatar || "";
          
          // Handle different field names for valid ID image
          let validIdImage = data.validIdImage || data.validIdUrl || data.valid_id_image || data.valid_id_url || data.idImage || data.idUrl || "";
          
          // If validIdImage is a storage path (not a URL), fetch the download URL
          if (validIdImage && !validIdImage.startsWith('http') && !validIdImage.startsWith('data:')) {
            try {
              console.log("🔄 Converting storage path to download URL:", validIdImage);
              const storageRef = ref(storage, validIdImage);
              validIdImage = await getDownloadURL(storageRef);
              console.log("✅ Successfully fetched download URL:", validIdImage);
            } catch (storageError) {
              console.error("❌ Failed to fetch download URL for:", validIdImage, storageError);
              // Keep the original value if fetch fails
            }
          }
          
          console.log("👤 User document:", docSnap.id);
          console.log("  - profilePicture field:", data.profilePicture);
          console.log("  - profilePictureUrl field:", data.profilePictureUrl);
          console.log("  - Final profilePicture value:", profilePicture);
          console.log("  - validIdImage field:", data.validIdImage);
          console.log("  - validIdUrl field:", data.validIdUrl);
          console.log("  - Final validIdImage value:", validIdImage);
          
          let userId = data.userId;
          if (typeof userId === 'number') {
            userId = `RID-${userId}`;
          } else if (typeof userId === 'string' && !userId.startsWith('RID-')) {
            // Try to parse as number and reformat
            const num = parseInt(userId);
            if (!isNaN(num)) userId = `RID-${num}`;
          }
          return {
            id: docSnap.id,
            ...data,
            verified: data.verified || false,
            createdDate: data.createdDate || new Date().toLocaleDateString(),
            createdTime: data.createdTime || null,
            userId: userId || `RID-${docSnap.id.slice(-6)}`,
            fullName: data.fullName || data.name || "Unknown",
            phoneNumber: data.phoneNumber || data.phone || "N/A",
            barangay: data.barangay || "Unknown",
            cityTown: data.cityTown || data.city || "Unknown",
            profilePicture: profilePicture,  // Use the resolved value
            validIdImage: validIdImage,  // Use the resolved value (now a download URL if it was a path)
            validIdUrl: validIdImage  // Also set validIdUrl for backward compatibility
          };
        });
        
        const users = await Promise.all(usersPromises);
        
        console.log("✅ Processed residents:", users.length);
        console.log("🖼️ Residents with profile pictures:", users.filter(u => u.profilePicture).length);
        console.log("🆔 Residents with valid ID images:", users.filter(u => u.validIdImage).length);
        setResidents(users);
        setIsLoadingResidents(false);
      } catch (error) {
        console.error("❌ Error fetching residents:", error);
        // If users collection doesn't exist, set empty array
        setResidents([]);
        setIsLoadingResidents(false);
      }
    }

    fetchAdmins();
    fetchResidents();
  }, []);

  // Sorting function for admin table
  const handleAdminSort = (field: string) => {
    if (adminSortField === field) {
      setAdminSortDirection(adminSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setAdminSortField(field);
      setAdminSortDirection('asc');
    }
  };

  // Sort admin data
  const sortedAdmins = [...adminUsers].sort((a, b) => {
    if (!adminSortField) return 0;
    let aValue = a[adminSortField as keyof typeof a];
    let bValue = b[adminSortField as keyof typeof b];
    // Handle date sorting
    if (adminSortField === 'createdDate') {
      // Prefer createdTime if it's a number (timestamp)
      const aTime = typeof a.createdTime === 'number' ? a.createdTime : Date.parse(a.createdDate + (a.createdTime ? ' ' + a.createdTime : ''));
      const bTime = typeof b.createdTime === 'number' ? b.createdTime : Date.parse(b.createdDate + (b.createdTime ? ' ' + b.createdTime : ''));
      if (adminSortDirection === 'asc') {
        return aTime - bTime;
      } else {
        return bTime - aTime;
      }
    }
    // Convert to strings for comparison for other fields
    const aStr = String(aValue || '').toLowerCase();
    const bStr = String(bValue || '').toLowerCase();
    if (adminSortDirection === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  // Filter functions
  const filteredAdmins = sortedAdmins.filter(admin => {
    const matchesSearch = admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) || admin.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === "all" || admin.position === positionFilter;
    const matchesPermission = permissionFilter === "all" || permissionFilter === "has_permission" && admin.hasEditPermission || permissionFilter === "no_permission" && !admin.hasEditPermission;
    const adminCreatedDate =
      parseDateValue(admin.createdTime) ?? parseDateValue(admin.createdDate);
    const matchesDate = isWithinDateRange(adminCreatedDate, adminDateRange);
    return matchesSearch && matchesPosition && matchesPermission && matchesDate;
  });

  // Sorting function for resident table
  const handleResidentSort = (field: string) => {
    if (residentSortField === field) {
      setResidentSortDirection(residentSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setResidentSortField(field);
      setResidentSortDirection('asc');
    }
  };

  // Sort resident data
  const sortedResidents = [...residents].sort((a, b) => {
    if (!residentSortField) return 0;
    
    let aValue = a[residentSortField as keyof typeof a];
    let bValue = b[residentSortField as keyof typeof b];
    
    // Handle date sorting
    if (residentSortField === 'createdDate') {
      aValue = a.createdDate || '';
      bValue = b.createdDate || '';
    }
    
    // Convert to strings for comparison
    const aStr = String(aValue || '').toLowerCase();
    const bStr = String(bValue || '').toLowerCase();
    
    if (residentSortDirection === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });
  
  // Enhanced search: match any field
  const filteredResidents = sortedResidents.filter(resident => {
    const search = searchTerm.toLowerCase();
    const matchesAnyField = [
      resident.fullName,
      resident.userId,
      resident.phoneNumber,
      resident.email,
      resident.barangay,
      resident.cityTown,
      resident.homeAddress,
      resident.gender,
      resident.verified ? 'verified' : 'pending',
      resident.suspended ? 'suspended' : ''
    ].some(field => (field || '').toString().toLowerCase().includes(search));
    const matchesBarangay = barangayFilter === "all" || resident.barangay === barangayFilter;
    const matchesVerification = verificationFilter === "all" || 
      (verificationFilter === "verified" && resident.verified) || 
      (verificationFilter === "pending" && !resident.verified && !resident.suspended) ||
      (verificationFilter === "suspended" && resident.suspended);
    const residentCreatedDate =
      parseDateValue(resident.createdTime) ?? parseDateValue(resident.createdDate);
    const matchesDate = isWithinDateRange(residentCreatedDate, residentDateRange);
    return matchesAnyField && matchesBarangay && matchesVerification && matchesDate;
  });

  const handleAddAdmin = async () => {
    setIsAddingAdmin(true);
    try {
      // Find the highest userId in the current adminUsers
      const maxUserId = adminUsers.length > 0
        ? Math.max(...adminUsers.map(a => {
            const raw = a.userId;
            if (typeof raw === 'string' && raw.startsWith('AID-')) {
              const num = parseInt(raw.replace('AID-', ''));
              return isNaN(num) ? 0 : num;
            }
            return Number(raw) || 0;
          }))
        : 0;
      const nextUserId = maxUserId + 1;
      const formattedUserId = `AID-${nextUserId}`;
      const now = new Date();
      const docRef = await addDoc(collection(db, "admins"), {
        userId: formattedUserId,
        name: newAdmin.name,
        position: newAdmin.position,
        idNumber: newAdmin.idNumber,
        username: newAdmin.username,
        password: newAdmin.password,
        hasEditPermission: false,
        role: "admin",
        createdDate: now.toLocaleDateString(),
        createdTime: now.toLocaleTimeString()
      });
      setAdminUsers(prev => [
        ...prev,
        {
          id: docRef.id,
          userId: formattedUserId,
          name: newAdmin.name,
          position: newAdmin.position,
          idNumber: newAdmin.idNumber,
          username: newAdmin.username,
          password: newAdmin.password,
          hasEditPermission: false,
            role: "admin",
            createdDate: now.toLocaleDateString(),
            createdTime: now.toLocaleTimeString()
        }
      ]);
      setIsAddAdminOpen(false);
      setNewAdmin({
        name: "",
        position: "",
        idNumber: "",
        username: "",
        password: ""
      });
      toast({
        title: 'Success',
        description: 'Admin account added successfully!'
      });
    } catch (error) {
      console.error("Error adding admin:", error);
      toast({
        title: 'Error',
        description: 'Failed to add admin account. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleEditAdmin = (admin: any) => {
    setShowEditAdminErrors(false);
    setEditingAdmin({
      ...admin
    });
  };

  const handleSaveAdminEdit = async () => {
    try {
      await updateDoc(doc(db, "admins", editingAdmin.id), {
        name: editingAdmin.name,
        position: editingAdmin.position,
        idNumber: editingAdmin.idNumber,
        username: editingAdmin.username
      });
      setAdminUsers(adminUsers.map(a => a.id === editingAdmin.id ? editingAdmin : a));
      setEditingAdmin(null);
    } catch (error) {
      console.error("Error updating admin:", error);
    }
  };

  const handleTogglePermission = (admin: any) => {
    setConfirmPermissionChange(admin);
  };

  const confirmTogglePermission = async () => {
    try {
      await updateDoc(doc(db, "admins", confirmPermissionChange.id), {
        hasEditPermission: !confirmPermissionChange.hasEditPermission
      });
      setAdminUsers(adminUsers.map(admin => admin.id === confirmPermissionChange.id ? {
        ...admin,
        hasEditPermission: !admin.hasEditPermission
      } : admin));
      toast({
        title: "Permission Updated",
        description: `${confirmPermissionChange.name || 'Admin'} now ${!confirmPermissionChange.hasEditPermission ? 'has' : 'no longer has'} edit access.`
      });
      setConfirmPermissionChange(null);
    } catch (error) {
      console.error("Error updating permission:", error);
    }
  };

  const formatCSVValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvRows = [
      headers.map(formatCSVValue).join(","),
      ...rows.map(row => row.map(formatCSVValue).join(","))
    ];
    const blob = new Blob([csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAdminsToCSV = () => {
    if (adminUsers.length === 0) {
      toast({
        title: "No Admin Data",
        description: "There are no admin records to export."
      });
      return;
    }

    const headers = ["User ID", "Name", "Position", "ID Number", "Username", "Created Date", "Created Time", "Has Edit Permission"];
    const rows = adminUsers.map(admin => [
      admin.userId || "",
      admin.name || "",
      admin.position || "",
      admin.idNumber || "",
      admin.username || "",
      admin.createdDate || "",
      formatTimeNoSeconds(admin.createdTime) || "",
      admin.hasEditPermission ? "Yes" : "No"
    ]);

    downloadCSV("admin-accounts", headers, rows);
    toast({
      title: "Export Started",
      description: `Exported ${adminUsers.length} admin account(s) to CSV.`
    });
  };

  const exportResidentsToCSV = () => {
    if (residents.length === 0) {
      toast({
        title: "No Resident Data",
        description: "There are no resident records to export."
      });
      return;
    }

    const headers = ["User ID", "Full Name", "Phone Number", "Email", "Barangay", "City/Town", "Verified", "Suspended", "Created Date", "Created Time"];
    const rows = residents.map(resident => [
      resident.userId || "",
      resident.fullName || "",
      resident.phoneNumber || "",
      resident.email || "",
      resident.barangay || "",
      resident.cityTown || "",
      resident.verified ? "Yes" : "No",
      resident.suspended ? "Yes" : "No",
      resident.createdDate || "",
      formatTimeNoSeconds(resident.createdTime) || ""
    ]);

    downloadCSV("resident-accounts", headers, rows);
    toast({
      title: "Export Started",
      description: `Exported ${residents.length} resident account(s) to CSV.`
    });
  };

  const handleDeleteAdmin = async (adminId: string) => {
    setIsDeletingAdmin(adminId);
    try {
      // Admins are stored in Firestore only (no Firebase Auth)
      const adminToDelete = adminUsers.find(a => a.id === adminId);
      
      await deleteDoc(doc(db, "admins", adminId));
      setAdminUsers(adminUsers.filter(a => a.id !== adminId));
      
      
      toast({
        title: 'Success',
        description: 'Admin account deleted successfully!'
      });
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast({
        title: 'Error',
        description: 'Failed to delete admin account',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingAdmin(null);
    }
  };

  const handleEditResident = (resident: any) => {
    setSelectedResident({
      ...resident
    });
    setIsEditResidentOpen(true);
  };

  const handlePreviewResident = (resident: any) => {
    console.log("🔍 Opening resident preview:", resident);
    console.log("🖼️ Profile picture URL:", resident?.profilePicture);
    console.log("🆔 Valid ID URL:", resident?.validIdUrl || resident?.validIdImage);
    console.log("📋 All resident fields:", Object.keys(resident));
    
    setSelectedResident(resident);
    setShowResidentPreview(true);
  };

  const handleSaveResidentEdit = async () => {
    try {
      await updateDoc(doc(db, "users", selectedResident.id), {
        fullName: selectedResident.fullName,
        phoneNumber: selectedResident.phoneNumber,
        barangay: selectedResident.barangay,
        cityTown: selectedResident.cityTown,
        homeAddress: selectedResident.homeAddress,
        email: selectedResident.email,
        validId: selectedResident.validId,
        validIdUrl: selectedResident.validIdUrl || selectedResident.validIdImage || "",
        additionalInfo: selectedResident.additionalInfo
      });
      setResidents(residents.map(r => r.id === selectedResident.id ? selectedResident : r));
      setIsEditResidentOpen(false);
      setSelectedResident(null);
    } catch (error) {
      console.error("Error updating resident:", error);
    }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file',
          variant: 'destructive'
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload an image smaller than 5MB',
          variant: 'destructive'
        });
        return;
      }

      try {
        // Convert to base64
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setSelectedResident({
            ...selectedResident,
            validIdUrl: result,
            validIdImage: result
          });
          
          toast({
            title: 'Success',
            description: 'ID image uploaded successfully'
          });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: 'Failed to upload image. Please try again.',
          variant: 'destructive'
        });
      }
    };

    const handleDeleteId = () => {
      setSelectedResident({
        ...selectedResident,
        validIdUrl: '',
        validIdImage: ''
      });
      setConfirmDeleteId(false);
      toast({
        title: 'Success',
        description: 'Valid ID image removed successfully'
      });
    };
  
    const handleDeleteResident = async (residentId: string) => {
    setIsDeletingResident(residentId);
    try {
      // Get resident data to retrieve email
      const residentToDelete = residents.find(r => r.id === residentId);
      const email = residentToDelete?.email || '';
      
      if (email) {
        // Use Cloud Function to delete from both Auth and Firestore
        try {
          await deleteResidentUserFunction({ 
            email, 
            docId: residentId 
          });
        } catch (funcError) {
          console.error("Cloud function error, falling back to Firestore-only deletion:", funcError);
          // Fallback to direct Firestore deletion if Cloud Function fails
          await deleteDoc(doc(db, "users", residentId));
        }
      } else {
        // No email, just delete from Firestore
        await deleteDoc(doc(db, "users", residentId));
      }
      
      setResidents(residents.filter(r => r.id !== residentId));
      
      
      toast({
        title: 'Success',
        description: 'Resident account deleted successfully!'
      });
    } catch (error) {
      console.error("Error deleting resident:", error);
      toast({
        title: 'Error',
        description: 'Failed to delete resident account',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingResident(null);
    }
  };

  const handleToggleVerification = async (residentId: string) => {
    try {
      const resident = residents.find(r => r.id === residentId);
      if (resident) {
        await updateDoc(doc(db, "users", residentId), {
          verified: !resident.verified
        });
        setResidents(residents.map(resident => resident.id === residentId ? {
          ...resident,
          verified: !resident.verified
        } : resident));
      }
    } catch (error) {
      console.error("Error updating verification:", error);
    }
  };

  const handleSelectAdmin = (adminId: string) => {
    setSelectedAdmins(prev => 
      prev.includes(adminId) 
        ? prev.filter(id => id !== adminId)
        : [...prev, adminId]
    );
  };

  const handleSelectAllAdmins = () => {
    setSelectedAdmins(prev => 
      prev.length === adminUsers.length 
        ? [] 
        : adminUsers.map(admin => admin.id)
    );
  };

  const handleSelectResident = (residentId: string) => {
    setSelectedResidents(prev => 
      prev.includes(residentId) 
        ? prev.filter(id => id !== residentId)
        : [...prev, residentId]
    );
  };

  const handleSelectAllResidents = () => {
    setSelectedResidents(prev => 
      prev.length === residents.length 
        ? [] 
        : residents.map(resident => resident.id)
    );
  };

  const handleBatchDelete = (type: 'admin' | 'resident') => {
    const items = type === 'admin' ? selectedAdmins : selectedResidents;
    setConfirmBatchAction({
      type: 'delete',
      items
    });
  };

  const handleBatchPermission = (value: boolean) => {
    setConfirmBatchAction({
      type: 'permission',
      value,
      items: selectedAdmins
    });
  };

  const handleBatchVerification = (value: boolean) => {
    setConfirmBatchAction({
      type: 'verification',
      value,
      items: selectedResidents
    });
  };

  const executeBatchAction = async () => {
    if (!confirmBatchAction) return;

    const { type, value, items } = confirmBatchAction;

    try {
      switch (type) {
        case 'delete':
          if (items === selectedAdmins) {
            // Delete admins (Firestore only)
            for (const adminId of items) {
              await deleteDoc(doc(db, "admins", adminId));
            }
            setAdminUsers(prev => prev.filter(admin => !items.includes(admin.id)));
            setSelectedAdmins([]);
          } else {
            // Delete residents (both Auth and Firestore)
            for (const residentId of items) {
              const residentToDelete = residents.find(r => r.id === residentId);
              const email = residentToDelete?.email || '';
              
              if (email) {
                try {
                  await deleteResidentUserFunction({ 
                    email, 
                    docId: residentId 
                  });
                } catch (funcError) {
                  console.error("Cloud function error, falling back to Firestore-only deletion:", funcError);
                  await deleteDoc(doc(db, "users", residentId));
                }
              } else {
                await deleteDoc(doc(db, "users", residentId));
              }
            }
            setResidents(prev => prev.filter(resident => !items.includes(resident.id)));
            setSelectedResidents([]);
          }
          break;

        case 'permission':
          // Update admin permissions
          for (const adminId of items) {
            await updateDoc(doc(db, "admins", adminId), {
              hasEditPermission: value
            });
          }
          setAdminUsers(prev => prev.map(admin => 
            items.includes(admin.id) 
              ? { ...admin, hasEditPermission: value }
              : admin
          ));
          setSelectedAdmins([]);
          break;

        case 'verification':
          // Update resident verification
          for (const residentId of items) {
            await updateDoc(doc(db, "users", residentId), {
              verified: value
            });
          }
          setResidents(prev => prev.map(resident => 
            items.includes(resident.id) 
              ? { ...resident, verified: value }
              : resident
          ));
          setSelectedResidents([]);
          break;
      }
      
      toast({
        title: 'Success',
        description: `Successfully ${type === 'delete' ? 'deleted' : type === 'permission' ? 'updated permissions for' : 'updated verification for'} ${items.length} account(s)!`
      });
    } catch (error) {
      console.error("Error executing batch action:", error);
      toast({
        title: 'Error',
        description: 'Failed to complete batch action',
        variant: 'destructive'
      });
    }

    setConfirmBatchAction(null);
  };

  // Add resident with auto-incremented userId
  const handleAddResident = async (newResident: any) => {
    setIsAddingResident(true);
    try {
      // Fetch all userIds and find the max number
      const querySnapshot = await getDocs(collection(db, "users"));
      // Extract the number from userId if it matches 'RID-[Number]'
      const userIds = querySnapshot.docs.map(doc => {
        const raw = doc.data().userId;
        if (typeof raw === 'string' && raw.startsWith('RID-')) {
          const num = parseInt(raw.replace('RID-', ''));
          return isNaN(num) ? 0 : num;
        }
        // fallback for legacy userIds
        return Number(raw) || 0;
      });
      const maxUserId = userIds.length > 0 ? Math.max(...userIds) : 0;
      const nextUserId = maxUserId + 1;
      const formattedUserId = `RID-${nextUserId}`;
      const now = new Date();
      const docRef = await addDoc(collection(db, "users"), {
        ...newResident,
        userId: formattedUserId,
        verified: false,
        suspended: false,
        createdDate: now.toLocaleDateString(),
        createdTime: now.getTime()
      });
      setResidents(prev => [
        ...prev,
        {
          id: docRef.id,
          ...newResident,
          userId: formattedUserId,
          verified: false,
          suspended: false,
          createdDate: now.toLocaleDateString(),
          createdTime: now.getTime()
        }
      ]);
    } catch (error) {
      console.error("Error adding resident:", error);
      toast({
        title: 'Error',
        description: 'Failed to add resident account. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAddingResident(false);
    }
  };

  // Account status modal actions
  const handleAccountStatus = (resident: any) => {
    setAccountStatusModal({ open: true, resident });
  };
  const closeAccountStatusModal = () => {
    setAccountStatusModal({ open: false, resident: null });
  };
  const updateAccountStatus = async (status: 'verify' | 'unverify' | 'suspend') => {
    if (!accountStatusModal.resident) return;
    const residentId = accountStatusModal.resident.id;
    let updates: any = {};
    if (status === 'verify') updates.verified = true, updates.suspended = false;
    if (status === 'unverify') updates.verified = false, updates.suspended = false;
    if (status === 'suspend') updates.suspended = true, updates.verified = false;
    try {
      await updateDoc(doc(db, "users", residentId), updates);
      setResidents(residents.map(r => r.id === residentId ? { ...r, ...updates } : r));
      closeAccountStatusModal();
    } catch (error) {
      console.error("Error updating account status:", error);
    }
  };

  // Add position
  const handleAddPosition = async () => {
    const trimmed = newPosition.trim();
    if (!trimmed) {
      return;
    }

    const exists = positionOptions.some(position => position.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast({
        title: "Position already exists",
        description: `"${trimmed}" is already in the position list.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const docRef = await addDoc(collection(db, ADMIN_POSITIONS_COLLECTION), {
        name: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setPositions(prev => [...prev, { id: docRef.id, name: trimmed }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPosition("");
      toast({
        title: "Position added",
        description: `"${trimmed}" has been added to the list.`
      });
    } catch (error) {
      console.error("Error adding position:", error);
      toast({
        title: "Failed to add position",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };
  // Delete position with confirmation
  const handleDeletePosition = (pos: string) => {
    setConfirmDeletePosition(pos);
  };
  const confirmDeletePositionAction = async () => {
    if (!confirmDeletePosition) {
      return;
    }

    const positionRecord = positions.find(position => position.name === confirmDeletePosition);

    try {
      if (positionRecord) {
        await deleteDoc(doc(db, ADMIN_POSITIONS_COLLECTION, positionRecord.id));
      }

      setPositions(prev => prev.filter(position => position.name !== confirmDeletePosition));

      if (newAdmin.position === confirmDeletePosition) {
        setNewAdmin({ ...newAdmin, position: "" });
      }
      if (positionFilter === confirmDeletePosition) {
        setPositionFilter("all");
      }

      toast({
        title: "Position deleted",
        description: `"${confirmDeletePosition}" has been removed.`
      });
    } catch (error) {
      console.error("Error deleting position:", error);
      toast({
        title: "Failed to delete position",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setConfirmDeletePosition(null);
    }
  };

  // Add New Admin confirmation
  const handleAddAdminClick = () => {
    setShowAdminFormErrors(true);
    if (isNewAdminValid()) setIsAddAdminOpen(true);
  };

  // Add New Resident confirmation
  const handleAddResidentClick = () => {
    if (isNewResidentValid()) {
      handleAddResident(newResident);
      setIsAddResidentOpen(false);
      setNewResident({
        fullName: "",
        phoneNumber: "",
        email: "",
        barangay: "",
        cityTown: "",
        homeAddress: "",
        validId: "",
        validIdUrl: "",
        additionalInfo: ""
      });
      toast({
        title: 'Success',
        description: 'Resident account added successfully!'
      });
    }
  };

  // Password validation
  const validatePassword = (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters.";
    // Add more rules as needed
    return "";
  };

  const toggleShowAdminPassword = (adminId: string) => {
    setShowAdminPasswords(prev => ({ ...prev, [adminId]: !prev[adminId] }));
  };

  // Fetch report count and data when previewing a resident
  useEffect(() => {
    async function fetchReportData() {
      if (showResidentPreview && selectedResident) {
        setLoadingReports(true);
        try {
          const querySnapshot = await getDocs(collection(db, "reports"));
          // Prefer userId if available, else fallback to fullName
          const reports = querySnapshot.docs
            .filter(doc => {
              const data = doc.data();
              return (data.userId && selectedResident.userId && data.userId === selectedResident.userId) ||
                     (data.reportedBy && selectedResident.fullName && data.reportedBy === selectedResident.fullName);
            })
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp || doc.data().createdAt || doc.data().createdDate
            }))
            .sort((a, b) => {
              // Sort by timestamp descending (newest first)
              const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
              const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
              return bTime.getTime() - aTime.getTime();
            });
          
          setResidentReports(reports);
          setResidentReportsCount(reports.length);
        } catch (e) {
          console.error("Error fetching resident reports:", e);
          setResidentReports([]);
          setResidentReportsCount(0);
        } finally {
          setLoadingReports(false);
        }
      }
    }
    fetchReportData();
  }, [showResidentPreview, selectedResident]);

  // Admins pagination
  const pagedAdmins = filteredAdmins.slice((adminPage - 1) * adminRowsPerPage, adminPage * adminRowsPerPage);
  const adminTotalPages = Math.ceil(filteredAdmins.length / adminRowsPerPage);
  // Residents pagination
  const pagedResidents = filteredResidents.slice((residentPage - 1) * residentRowsPerPage, residentPage * residentRowsPerPage);
  const residentTotalPages = Math.ceil(filteredResidents.length / residentRowsPerPage);

  // Tab click handlers to update last seen timestamps
  const handleResidentsTabClick = () => {
    localStorage.setItem('lastSeenResidentsTab', Date.now().toString());
    setBadgeResetKey(k => k + 1); // force re-render
  };

  // Calculate badge counts (depend on badgeResetKey)
  const lastSeenResidents = Number(localStorage.getItem('lastSeenResidentsTab') || 0);
  const newResidentsCount = useMemo(() => residents.filter(r => Number(r.createdTime) > lastSeenResidents).length, [residents, lastSeenResidents, badgeResetKey]);
  const manageUsersBadge = newResidentsCount;

  // Manage active tab state
  const [activeTab, setActiveTab] = useState(() => {
    // Determine initial tab based on navigation state and user role
    if (location.state && (location.state as any).tab) {
      return (location.state as any).tab;
    }
    return canManageAdmins() ? "admins" : "residents";
  });

  // On mount, prefill search bar and update tab if redirected from chat or sidebar
  useEffect(() => {
    if (location.state && (location.state as any).search) {
      setSearchTerm((location.state as any).search);
    }
    if (location.state && (location.state as any).tab) {
      setActiveTab((location.state as any).tab);
    }
  }, [location.state]);

  return <Layout>
      <TooltipProvider>
      <div className="">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Hidden TabsList - tabs are now controlled via sidebar dropdown */}
          <TabsList className="hidden">
            {canManageAdmins() && (
              <TabsTrigger value="admins">Admin Accounts</TabsTrigger>
            )}
            <TabsTrigger value="residents" onClick={handleResidentsTabClick}>
              Residents
            </TabsTrigger>
          </TabsList>

          
          
          {canManageAdmins() && (
            <TabsContent value="admins">

            {/* Admin Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Total Admins</p>
                        <p className="text-xs text-brand-orange font-medium">All time</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{adminUsers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <div className="h-2.5 w-2.5 bg-brand-orange rounded-full"></div>
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Online Admins</p>
                        <p className="text-xs text-brand-orange font-medium">Currently active</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{adminUsers.filter(admin => admin.isOnline).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">With Permission</p>
                        <p className="text-xs text-brand-orange font-medium">Edit access</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{adminUsers.filter(admin => admin.hasEditPermission).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShieldOff className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Without Permission</p>
                        <p className="text-xs text-brand-orange font-medium">No edit access</p>
                    </div>
                  </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{adminUsers.filter(admin => !admin.hasEditPermission).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>

            {/* Admin Table */}
            <Card>
              {/* Table Toolbar */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3 flex-wrap">
            {/* Add New Admin Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
              <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
                <DialogTrigger asChild>
                          <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                            New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader className="border-b border-gray-200 pb-4">
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-[#FF4F0B]" />
                      Add New Admin Account
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Full Name{(showAdminFormErrors && newAdmin.name.trim() === "") && <span className="text-red-500"> *</span>}</Label>
                      <Input 
                        value={newAdmin.name} 
                        onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} 
                        className={showAdminFormErrors && newAdmin.name.trim() === "" ? "border-red-500" : ""}
                        placeholder="Enter full name"
                      />
                      {showAdminFormErrors && newAdmin.name.trim() === "" && (
                        <div className="text-xs text-red-600 mt-1">Full name is required</div>
                      )}
                    </div>
                    <div>
                      <Label>Position{(showAdminFormErrors && newAdmin.position.trim() === "") && <span className="text-red-500"> *</span>}</Label>
                      <Select value={newAdmin.position} onValueChange={value => setNewAdmin({ ...newAdmin, position: value })}>
                        <SelectTrigger className={showAdminFormErrors && newAdmin.position.trim() === "" ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              No positions available. Add a new position below.
                            </div>
                          )}
                          {positions.map(position => (
                            <div key={position.id} className="flex items-center justify-between pr-2">
                              <SelectItem value={position.name}>{position.name}</SelectItem>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeletePosition(position.name)}
                                className="ml-2 text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2 p-2 border-t border-gray-100 mt-2">
                            <Input
                              value={newPosition}
                              onChange={e => setNewPosition(e.target.value)}
                              placeholder="Add new position"
                              className="flex-1"
                            />
                            <Button type="button" onClick={handleAddPosition} disabled={!newPosition.trim()} className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                              Add
                            </Button>
                          </div>
                        </SelectContent>
                      </Select>
                      {showAdminFormErrors && newAdmin.position.trim() === "" && (
                        <div className="text-xs text-red-600 mt-1">Position is required</div>
                      )}
                    </div>
                    <div>
                      <Label>ID Number{(showAdminFormErrors && newAdmin.idNumber.trim() === "") && <span className="text-red-500"> *</span>}</Label>
                      <Input 
                        value={newAdmin.idNumber} 
                        onChange={e => setNewAdmin({...newAdmin, idNumber: e.target.value})} 
                        className={showAdminFormErrors && newAdmin.idNumber.trim() === "" ? "border-red-500" : ""}
                        placeholder="Enter ID number"
                      />
                      {showAdminFormErrors && newAdmin.idNumber.trim() === "" && (
                        <div className="text-xs text-red-600 mt-1">ID number is required</div>
                      )}
                    </div>
                    <div>
                      <Label>Account Username{(showAdminFormErrors && newAdmin.username.trim() === "") && <span className="text-red-500"> *</span>}</Label>
                      <Input 
                        value={newAdmin.username} 
                        onChange={e => setNewAdmin({...newAdmin, username: e.target.value})} 
                        className={showAdminFormErrors && newAdmin.username.trim() === "" ? "border-red-500" : ""}
                        placeholder="Enter username"
                      />
                      {showAdminFormErrors && newAdmin.username.trim() === "" && (
                        <div className="text-xs text-red-600 mt-1">Username is required</div>
                      )}
                    </div>
                    <div>
                      <Label>Password{showAdminFormErrors && newAdmin.password.trim() === "" && <span className="text-red-500"> *</span>}</Label>
                      <div className="relative flex items-center">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={newAdmin.password}
                          onChange={e => {
                            setNewAdmin({ ...newAdmin, password: e.target.value });
                            setPasswordError(validatePassword(e.target.value));
                          }}
                          className={`pr-10 ${(passwordError || (showAdminFormErrors && newAdmin.password.trim() === "")) ? "border-red-500" : ""}`}
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowPassword(v => !v)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {showAdminFormErrors && newAdmin.password.trim() === "" && (
                        <div className="text-xs text-red-600 mt-1">Password is required</div>
                      )}
                      {passwordError && <div className="text-xs text-red-600 mt-1">{passwordError}</div>}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={handleAddAdmin} 
                      disabled={isAddingAdmin}
                      className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingAdmin ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                        </div>
                      ) : (
                        "Add New Admin"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a new admin account</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Search Bar */}
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search admin accounts..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="w-full pl-9" 
                    />
                  </div>

                  <div className="flex items-end gap-3">
                    <DateRangePicker
                      value={adminDateRange}
                      onChange={setAdminDateRange}
                      className="w-[260px]"
                    />
                    {(adminDateRange?.from || adminDateRange?.to) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdminDateRange(undefined)}
                        className="h-9"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportAdminsToCSV}
                        className="flex items-center gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download admin accounts as CSV</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Position Filter */}
                  <Select value={positionFilter} onValueChange={setPositionFilter}>
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="All Positions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Positions</SelectItem>
                      {positionOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No positions available.
                        </div>
                      )}
                      {positionOptions.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Permission Filter */}
                  <Select value={permissionFilter} onValueChange={setPermissionFilter}>
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="All Permissions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Permissions</SelectItem>
                      <SelectItem value="has_permission">Has Edit Permission</SelectItem>
                      <SelectItem value="no_permission">No Edit Permission</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Batch Action Buttons */}
            {selectedAdmins.length > 0 && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                            onClick={() => handleBatchPermission(true)}
                            className="ml-auto text-green-600 border-green-600 hover:bg-green-50"
                >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Grant ({selectedAdmins.length})
                </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Grant edit permission to {selectedAdmins.length} admin(s)</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                            onClick={() => handleBatchPermission(false)}
                            className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                >
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Revoke ({selectedAdmins.length})
                </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Revoke edit permission from {selectedAdmins.length} admin(s)</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                <Button
                            variant="destructive"
                  size="sm"
                            onClick={() => handleBatchDelete('admin')}
                            className="bg-brand-red hover:bg-brand-red-700 text-white"
                >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete ({selectedAdmins.length})
                </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete {selectedAdmins.length} selected admin(s)</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedAdmins.length === adminUsers.length && adminUsers.length > 0}
                            onCheckedChange={handleSelectAllAdmins}
                          />
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleAdminSort('userId')}
                        >
                            User ID
                            {adminSortField === 'userId' && adminSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : adminSortField === 'userId' && adminSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleAdminSort('name')}
                        >
                            Name
                            {adminSortField === 'name' && adminSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : adminSortField === 'name' && adminSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleAdminSort('idNumber')}
                        >
                            ID Number
                            {adminSortField === 'idNumber' && adminSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : adminSortField === 'idNumber' && adminSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleAdminSort('username')}
                        >
                            Username
                            {adminSortField === 'username' && adminSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : adminSortField === 'username' && adminSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleAdminSort('createdDate')}
                        >
                            Created Date
                            {adminSortField === 'createdDate' && adminSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : adminSortField === 'createdDate' && adminSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Password
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setShowAllAdminPasswords(v => !v)}
                              className="ml-1"
                              title={showAllAdminPasswords ? 'Hide All Passwords' : 'Show All Passwords'}
                            >
                              {showAllAdminPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingAdmins ? (
                        // Loading skeleton
                        Array.from({ length: adminRowsPerPage }).map((_, index) => (
                          <TableRow key={`loading-admin-${index}`}>
                            <TableCell><div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          </TableRow>
                        ))
                      ) : pagedAdmins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                            No results found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedAdmins.map(admin => (
                          <TableRow key={admin.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedAdmins.includes(admin.id)}
                                onCheckedChange={() => handleSelectAdmin(admin.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{admin.userId}</TableCell>
                            <TableCell className="font-medium">{admin.name}</TableCell>
                            <TableCell>{admin.position}</TableCell>
                            <TableCell>{admin.idNumber}</TableCell>
                            <TableCell>{admin.username}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{admin.createdDate || 'N/A'}</span>
                                <span className="text-xs text-gray-500">{formatTimeNoSeconds(admin.createdTime)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {showAllAdminPasswords ? (
                                <span>{admin.password}</span>
                              ) : (
                                <span>{'•'.repeat(Math.max(8, (admin.password || '').length))}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditAdmin(admin)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTogglePermission(admin)}
                                  title={admin.hasEditPermission ? "Revoke Permission" : "Grant Permission"}
                                  className={admin.hasEditPermission ? "text-green-600" : "text-yellow-600"}
                                >
                                  {admin.hasEditPermission ? (
                                    <Shield className="h-4 w-4" />
                                  ) : (
                                    <ShieldOff className="h-4 w-4" />
                                  )}
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-red-600">
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                                          <Trash2 className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div>
                                          <AlertDialogTitle className="text-red-800">Delete Admin Account</AlertDialogTitle>
                                          <AlertDialogDescription className="text-red-600">
                                            Are you sure you want to delete {admin.name}'s admin account? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </div>
                                      </div>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteAdmin(admin.id)}
                                        disabled={isDeletingAdmin === admin.id}
                                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                      >
                                        {isDeletingAdmin === admin.id ? (
                                          <div className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Deleting...
                                          </div>
                                        ) : (
                                          "Delete"
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-700">
                      Showing {filteredAdmins.length > 0 ? ((adminPage - 1) * adminRowsPerPage + 1) : 0} to {Math.min(adminPage * adminRowsPerPage, filteredAdmins.length)} of {filteredAdmins.length} results
                    </div>
                    <label className="text-sm text-gray-700 flex items-center gap-1">
                      Rows per page:
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={adminRowsPerPage}
                        onChange={e => { setAdminRowsPerPage(Number(e.target.value)); setAdminPage(1); }}
                      >
                        {ROWS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAdminPage(p => Math.max(1, p - 1))} disabled={adminPage === 1}>
                      Previous
                    </Button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, adminTotalPages) }, (_, i) => {
                        let pageNum;
                        if (adminTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (adminPage <= 3) {
                          pageNum = i + 1;
                        } else if (adminPage >= adminTotalPages - 2) {
                          pageNum = adminTotalPages - 4 + i;
                        } else {
                          pageNum = adminPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={adminPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAdminPage(pageNum)}
                            className={adminPage === pageNum ? "bg-brand-orange hover:bg-brand-orange-400 text-white" : ""}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {adminTotalPages > 5 && adminPage < adminTotalPages - 2 && (
                        <>
                          <span className="px-2 text-gray-500">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdminPage(adminTotalPages)}
                          >
                            {adminTotalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={() => setAdminPage(p => Math.min(adminTotalPages, p + 1))} disabled={adminPage === adminTotalPages || adminTotalPages === 0}>
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
          
          <TabsContent value="residents">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Total Residents</p>
                        <p className="text-xs text-brand-orange font-medium">All time</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{residents.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Verified</p>
                        <p className="text-xs text-brand-orange font-medium">Active accounts</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{residents.filter(r => r.verified).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShieldX className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Pending</p>
                        <p className="text-xs text-brand-orange font-medium">Needs verification</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{residents.filter(r => !r.verified).length}</p>
                    </div>
                  </div>
                </CardContent>                
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShieldOff className="h-5 w-5 text-brand-orange" />
                    </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Suspended</p>
                        <p className="text-xs text-brand-orange font-medium">Inactive accounts</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{residents.filter(r => r.suspended).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              
            </div>

            {/* Residents Table */}
            <Card>
              {/* Table Toolbar */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Add New Resident Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Dialog open={isAddResidentOpen} onOpenChange={setIsAddResidentOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                            <UserPlus className="h-4 w-4 mr-2" />
                            New Resident
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader className="border-b border-gray-200 pb-4">
                            <DialogTitle className="flex items-center gap-2">
                              <UserPlus className="h-5 w-5 text-[#FF4F0B]" />
                              Add New Resident Account
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label>Full Name *</Label>
                                <Input 
                                  value={newResident.fullName} 
                                  onChange={e => setNewResident({...newResident, fullName: e.target.value})} 
                                  placeholder="Enter full name"
                                />
                              </div>
                              <div>
                                <Label>Phone Number *</Label>
                                <Input 
                                  value={newResident.phoneNumber} 
                                  onChange={e => setNewResident({...newResident, phoneNumber: e.target.value})} 
                                  placeholder="Enter phone number"
                                />
                              </div>
                              <div>
                                <Label>Email Address *</Label>
                                <Input 
                                  value={newResident.email} 
                                  onChange={e => setNewResident({...newResident, email: e.target.value})} 
                                  placeholder="Enter email address"
                                  type="email"
                                />
                              </div>
                              <div>
                                <Label>Barangay *</Label>
                                <Select value={newResident.barangay} onValueChange={value => setNewResident({ ...newResident, barangay: value })}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select barangay" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Abang">Abang</SelectItem>
                                    <SelectItem value="Aliliw">Aliliw</SelectItem>
                                    <SelectItem value="Atulinao">Atulinao</SelectItem>
                                    <SelectItem value="Ayuti">Ayuti</SelectItem>
                                    <SelectItem value="Barangay 1">Barangay 1</SelectItem>
                                    <SelectItem value="Barangay 2">Barangay 2</SelectItem>
                                    <SelectItem value="Barangay 3">Barangay 3</SelectItem>
                                    <SelectItem value="Barangay 4">Barangay 4</SelectItem>
                                    <SelectItem value="Barangay 5">Barangay 5</SelectItem>
                                    <SelectItem value="Barangay 6">Barangay 6</SelectItem>
                                    <SelectItem value="Barangay 7">Barangay 7</SelectItem>
                                    <SelectItem value="Barangay 8">Barangay 8</SelectItem>
                                    <SelectItem value="Barangay 9">Barangay 9</SelectItem>
                                    <SelectItem value="Barangay 10">Barangay 10</SelectItem>
                                    <SelectItem value="Igang">Igang</SelectItem>
                                    <SelectItem value="Kabatete">Kabatete</SelectItem>
                                    <SelectItem value="Kakawit">Kakawit</SelectItem>
                                    <SelectItem value="Kalangay">Kalangay</SelectItem>
                                    <SelectItem value="Kalyaat">Kalyaat</SelectItem>
                                    <SelectItem value="Kilib">Kilib</SelectItem>
                                    <SelectItem value="Kulapi">Kulapi</SelectItem>
                                    <SelectItem value="Mahabang Parang">Mahabang Parang</SelectItem>
                                    <SelectItem value="Malupak">Malupak</SelectItem>
                                    <SelectItem value="Manasa">Manasa</SelectItem>
                                    <SelectItem value="May-it">May-it</SelectItem>
                                    <SelectItem value="Nagsinamo">Nagsinamo</SelectItem>
                                    <SelectItem value="Nalunao">Nalunao</SelectItem>
                                    <SelectItem value="Palola">Palola</SelectItem>
                                    <SelectItem value="Piis">Piis</SelectItem>
                                    <SelectItem value="Samil">Samil</SelectItem>
                                    <SelectItem value="Tiawe">Tiawe</SelectItem>
                                    <SelectItem value="Tinamnan">Tinamnan</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>City/Town *</Label>
                                <Input 
                                  value={newResident.cityTown} 
                                  onChange={e => setNewResident({...newResident, cityTown: e.target.value})} 
                                  placeholder="Enter city/town"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label>Home Address</Label>
                                <Input 
                                  value={newResident.homeAddress} 
                                  onChange={e => setNewResident({...newResident, homeAddress: e.target.value})} 
                                  placeholder="Enter home address"
                                />
                              </div>
                              <div>
                                <Label>Valid ID Type</Label>
                                <Input 
                                  value={newResident.validId} 
                                  onChange={e => setNewResident({...newResident, validId: e.target.value})} 
                                  placeholder="e.g., Driver's License, Passport"
                                />
                              </div>
                              <div>
                                <Label>Valid ID Image URL</Label>
                                <Input 
                                  value={newResident.validIdUrl} 
                                  onChange={e => setNewResident({...newResident, validIdUrl: e.target.value})} 
                                  placeholder="Enter image URL"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label>Additional Information</Label>
                                <Input 
                                  value={newResident.additionalInfo} 
                                  onChange={e => setNewResident({...newResident, additionalInfo: e.target.value})} 
                                  placeholder="Any additional information"
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              onClick={handleAddResidentClick} 
                              disabled={isAddingResident || !isNewResidentValid()}
                              className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAddingResident ? (
                                <div className="flex items-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Adding...
                                </div>
                              ) : (
                                "Add New Resident"
                              )}
                            </Button>
                            <Button variant="secondary" onClick={() => setIsAddResidentOpen(false)}>Cancel</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add a new resident account</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Search Bar */}
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search residents..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9" 
                    />
                  </div>

                  <div className="flex items-end gap-3">
                    <DateRangePicker
                      value={residentDateRange}
                      onChange={setResidentDateRange}
                      className="w-[260px]"
                    />
                    {(residentDateRange?.from || residentDateRange?.to) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResidentDateRange(undefined)}
                        className="h-9"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportResidentsToCSV}
                        className="flex items-center gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download resident accounts as CSV</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Barangay Filter */}
                    <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="All Barangays" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Barangays</SelectItem>
                        {Array.from(new Set(residents.map(r => r.barangay).filter(Boolean))).map(barangay => (
                          <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  {/* Verification Filter */}
                    <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="pending">Pending Verification</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>

                  {/* Batch Action Buttons */}
            {selectedResidents.length > 0 && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                            onClick={() => handleBatchVerification(true)}
                            className="ml-auto text-green-600 border-green-600 hover:bg-green-50"
                >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Verify ({selectedResidents.length})
                </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Verify {selectedResidents.length} selected resident(s)</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                            onClick={() => handleBatchVerification(false)}
                            className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                >
                            <ShieldX className="h-4 w-4 mr-2" />
                            Revoke ({selectedResidents.length})
                </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Revoke verification from {selectedResidents.length} resident(s)</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                <Button
                            variant="destructive"
                  size="sm"
                            onClick={() => handleBatchDelete('resident')}
                            className="bg-brand-red hover:bg-brand-red-700 text-white"
                >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete ({selectedResidents.length})
                </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete {selectedResidents.length} selected resident(s)</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedResidents.length === residents.length && residents.length > 0}
                            onCheckedChange={handleSelectAllResidents}
                          />
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleResidentSort('userId')}
                        >
                            User ID
                            {residentSortField === 'userId' && residentSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : residentSortField === 'userId' && residentSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleResidentSort('fullName')}
                        >
                            Full Name
                            {residentSortField === 'fullName' && residentSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : residentSortField === 'fullName' && residentSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>Mobile Number</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleResidentSort('barangay')}
                        >
                            Barangay
                            {residentSortField === 'barangay' && residentSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : residentSortField === 'barangay' && residentSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleResidentSort('cityTown')}
                        >
                            City/Town
                            {residentSortField === 'cityTown' && residentSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : residentSortField === 'cityTown' && residentSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                          onClick={() => handleResidentSort('createdDate')}
                        >
                            Created Date
                            {residentSortField === 'createdDate' && residentSortDirection === 'asc' ? (
                              <ArrowUp className="h-4 w-4 text-brand-orange" />
                            ) : residentSortField === 'createdDate' && residentSortDirection === 'desc' ? (
                              <ArrowDown className="h-4 w-4 text-brand-orange" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingResidents ? (
                        // Loading skeleton
                        Array.from({ length: residentRowsPerPage }).map((_, index) => (
                          <TableRow key={`loading-resident-${index}`}>
                            <TableCell><div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          </TableRow>
                        ))
                      ) : pagedResidents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                            No residents found. {residents.length === 0 ? "No residents have been registered yet." : "No residents match your search criteria."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedResidents.map(resident => (
                          <TableRow key={resident.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedResidents.includes(resident.id)}
                                onCheckedChange={() => handleSelectResident(resident.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{
                              resident.userId && resident.userId.startsWith('RID-')
                                ? resident.userId
                                : `RID-${resident.userId || resident.id?.slice(-6) || ''}`
                            }</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2">
                                {resident.fullName}
                                {resident.isOnline && <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Online"></span>}
                              </span>
                            </TableCell>
                            <TableCell>{resident.phoneNumber}</TableCell>
                            <TableCell>{resident.barangay}</TableCell>
                            <TableCell>{resident.cityTown}</TableCell>
                            <TableCell>{resident.createdDate}<br />
                              <span className="text-xs text-gray-500">{formatTimeNoSeconds(resident.createdTime)}</span>
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={
                                  resident.suspended ? 'Suspended' : 
                                  resident.verified ? 'Verified' : 
                                  'Pending'
                                } 
                                onValueChange={async (newStatus) => {
                                  try {
                                    const updates: any = {};
                                    if (newStatus === 'Verified') {
                                      updates.verified = true;
                                      updates.suspended = false;
                                    } else if (newStatus === 'Pending') {
                                      updates.verified = false;
                                      updates.suspended = false;
                                    } else if (newStatus === 'Suspended') {
                                      updates.suspended = true;
                                      updates.verified = false;
                                    }
                                    
                                    await updateDoc(doc(db, "users", resident.id), updates);
                                    setResidents(residents.map(r => r.id === resident.id ? { ...r, ...updates } : r));
                                    toast({
                                      title: 'Success',
                                      description: `Status updated to ${newStatus}`
                                    });
                                  } catch (error) {
                                    console.error("Error updating resident status:", error);
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to update status. Please try again.',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className={cn(
                                  "w-auto border-0 bg-transparent font-medium focus:ring-1 focus:ring-brand-orange",
                                  resident.suspended && 'text-red-600',
                                  resident.verified && 'text-green-600',
                                  !resident.verified && !resident.suspended && 'text-yellow-600'
                                )}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Verified">Verified</SelectItem>
                                  <SelectItem value="Pending">Pending</SelectItem>
                                  <SelectItem value="Suspended">Suspended</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                                                        <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreviewResident(resident)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-red-600" title="Delete Resident">
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                                          <Trash2 className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div>
                                          <AlertDialogTitle className="text-red-800">Delete Resident Account</AlertDialogTitle>
                                          <AlertDialogDescription className="text-red-600">
                                            Are you sure you want to delete {resident.fullName}'s account? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </div>
                                      </div>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteResident(resident.id)}
                                        disabled={isDeletingResident === resident.id}
                                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                      >
                                        {isDeletingResident === resident.id ? (
                                          <div className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Deleting...
                                          </div>
                                        ) : (
                                          "Delete"
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={resident.suspended ? "text-gray-400" : resident.verified ? "text-green-600" : "text-yellow-600"}
                                  onClick={() => handleAccountStatus(resident)}
                                  title="Account Status"
                                >
                                  {resident.suspended ? <ShieldOff className="h-4 w-4" /> : resident.verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-700">
                      Showing {filteredResidents.length > 0 ? ((residentPage - 1) * residentRowsPerPage + 1) : 0} to {Math.min(residentPage * residentRowsPerPage, filteredResidents.length)} of {filteredResidents.length} results
                    </div>
                    <label className="text-sm text-gray-700 flex items-center gap-1">
                      Rows per page:
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={residentRowsPerPage}
                        onChange={e => { setResidentRowsPerPage(Number(e.target.value)); setResidentPage(1); }}
                      >
                        {ROWS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setResidentPage(p => Math.max(1, p - 1))} disabled={residentPage === 1}>
                      Previous
                    </Button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, residentTotalPages) }, (_, i) => {
                        let pageNum;
                        if (residentTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (residentPage <= 3) {
                          pageNum = i + 1;
                        } else if (residentPage >= residentTotalPages - 2) {
                          pageNum = residentTotalPages - 4 + i;
                        } else {
                          pageNum = residentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={residentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setResidentPage(pageNum)}
                            className={residentPage === pageNum ? "bg-brand-orange hover:bg-brand-orange-400 text-white" : ""}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {residentTotalPages > 5 && residentPage < residentTotalPages - 2 && (
                        <>
                          <span className="px-2 text-gray-500">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResidentPage(residentTotalPages)}
                          >
                            {residentTotalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={() => setResidentPage(p => Math.min(residentTotalPages, p + 1))} disabled={residentPage === residentTotalPages || residentTotalPages === 0}>
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Permission Change Confirmation Dialog */}
        <AlertDialog
          open={!!confirmPermissionChange}
          onOpenChange={() => setConfirmPermissionChange(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  confirmPermissionChange?.hasEditPermission ? 'bg-yellow-100' : 'bg-green-100'
                }`}>
                  {confirmPermissionChange?.hasEditPermission ? (
                    <ShieldOff className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <div>
                  <AlertDialogTitle className={
                    confirmPermissionChange?.hasEditPermission ? 'text-yellow-800' : 'text-green-800'
                  }>
                    {confirmPermissionChange?.hasEditPermission ? 'Revoke Permission' : 'Grant Permission'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className={
                    confirmPermissionChange?.hasEditPermission ? 'text-yellow-600' : 'text-green-600'
                  }>
                    Are you sure you want to {confirmPermissionChange?.hasEditPermission ? 'revoke' : 'grant'} edit permission for {confirmPermissionChange?.name}?
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmTogglePermission}
                className={confirmPermissionChange?.hasEditPermission ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Action Confirmation Dialog */}
        <AlertDialog
          open={!!confirmBatchAction}
          onOpenChange={() => setConfirmBatchAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  confirmBatchAction?.type === 'delete' ? 'bg-red-100' : 
                  confirmBatchAction?.value ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {confirmBatchAction?.type === 'delete' ? (
                    <Trash2 className="h-5 w-5 text-red-600" />
                  ) : confirmBatchAction?.type === 'permission' ? (
                    confirmBatchAction.value ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldOff className="h-5 w-5 text-yellow-600" />
                  ) : (
                    confirmBatchAction?.value ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldX className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <div>
                  <AlertDialogTitle className={
                    confirmBatchAction?.type === 'delete' ? 'text-red-800' : 
                    confirmBatchAction?.value ? 'text-green-800' : 'text-yellow-800'
                  }>
                    {confirmBatchAction?.type === 'delete'
                      ? 'Delete Selected Items'
                      : confirmBatchAction?.type === 'permission'
                      ? `${confirmBatchAction.value ? 'Grant' : 'Revoke'} Permissions`
                      : `${confirmBatchAction?.value ? 'Verify' : 'Revoke Verification for'} Selected Accounts`}
                  </AlertDialogTitle>
                  <AlertDialogDescription className={
                    confirmBatchAction?.type === 'delete' ? 'text-red-600' : 
                    confirmBatchAction?.value ? 'text-green-600' : 'text-yellow-600'
                  }>
                    Are you sure you want to {confirmBatchAction?.type === 'delete'
                      ? 'delete'
                      : confirmBatchAction?.type === 'permission'
                      ? `${confirmBatchAction.value ? 'grant permissions to' : 'revoke permissions from'}`
                      : `${confirmBatchAction?.value ? 'verify' : 'revoke verification for'}`
                    } the selected {confirmBatchAction?.items.length} {
                      confirmBatchAction?.items === selectedAdmins ? 'admin' : 'resident'
                    } accounts?
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeBatchAction}
                className={
                  confirmBatchAction?.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmBatchAction?.value
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Resident Preview Modal */}
        <Dialog open={showResidentPreview} onOpenChange={setShowResidentPreview}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resident Details</DialogTitle>
            </DialogHeader>
            
            {/* Profile Picture at the top - large and clickable */}
            <div className="flex flex-col items-center py-4">
              <div className="relative">
                {selectedResident?.profilePicture ? (
                  <button
                    type="button"
                    onClick={() => window.open(selectedResident.profilePicture, '_blank')}
                    className="focus:outline-none group relative"
                    title="Click to view full size"
                  >
                    <img 
                      src={selectedResident.profilePicture} 
                      alt="Profile" 
                      className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 group-hover:border-brand-orange transition-all duration-200 shadow-lg group-hover:shadow-xl"
                      onLoad={() => console.log("✅ Profile picture loaded successfully:", selectedResident.profilePicture)}
                      onError={(e) => {
                        console.error("❌ Failed to load profile picture:", selectedResident.profilePicture);
                        console.log("📋 Selected resident data:", selectedResident);
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = 'w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200';
                          fallback.innerHTML = '<svg class="h-16 w-16 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </button>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200 shadow-lg">
                    <User className="h-16 w-16 text-gray-400" />
                  </div>
                )}
                
                {/* Camera Icon Overlay */}
                <button
                  type="button"
                  className="absolute bottom-0 right-0 h-8 w-8 bg-brand-orange hover:bg-brand-orange-400 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                  title="Change Profile Picture"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
            
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex">
            <button
              onClick={() => setActiveResidentTab('profile')}
              className={`flex-1 py-2 px-1 border-b-2 font-semibold text-sm transition-colors text-center ${
                activeResidentTab === 'profile' ? 'border-brand-orange text-brand-orange bg-orange-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              View Profile
            </button>
            <button
              onClick={() => setActiveResidentTab('reports')}
              className={`flex-1 py-2 px-1 border-b-2 font-semibold text-sm transition-colors text-center ${
                activeResidentTab === 'reports' ? 'border-brand-orange text-brand-orange bg-orange-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Submitted Reports
            </button>
          </nav>
        </div>
            
            {/* Tab Content */}
            {activeResidentTab === 'profile' ? (
              <div>
                <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">User ID</TableCell>
                    <TableCell>{selectedResident?.userId || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Full Name</TableCell>
                    <TableCell>
                      <Input 
                        value={selectedResident?.fullName || ''} 
                        onChange={e => setSelectedResident({
                          ...selectedResident,
                          fullName: e.target.value
                        })}
                        className="border-0 bg-transparent p-0 h-auto font-normal"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Phone Number</TableCell>
                    <TableCell>
                      <Input 
                        value={selectedResident?.phoneNumber || ''} 
                        onChange={e => setSelectedResident({
                          ...selectedResident,
                          phoneNumber: e.target.value
                        })}
                        className="border-0 bg-transparent p-0 h-auto font-normal"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Email</TableCell>
                    <TableCell>
                      <Input 
                        value={selectedResident?.email || ''} 
                        onChange={e => setSelectedResident({
                          ...selectedResident,
                          email: e.target.value
                        })}
                        className="border-0 bg-transparent p-0 h-auto font-normal"
                        type="email"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Barangay</TableCell>
                    <TableCell>
                      <Select 
                        value={selectedResident?.barangay || ''} 
                        onValueChange={value => setSelectedResident({
                          ...selectedResident,
                          barangay: value
                        })}
                      >
                        <SelectTrigger className="border-0 bg-transparent p-0 h-auto font-normal shadow-none">
                          <SelectValue placeholder="Select barangay" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Abang">Abang</SelectItem>
                          <SelectItem value="Aliliw">Aliliw</SelectItem>
                          <SelectItem value="Atulinao">Atulinao</SelectItem>
                          <SelectItem value="Ayuti">Ayuti</SelectItem>
                          <SelectItem value="Barangay 1">Barangay 1</SelectItem>
                          <SelectItem value="Barangay 2">Barangay 2</SelectItem>
                          <SelectItem value="Barangay 3">Barangay 3</SelectItem>
                          <SelectItem value="Barangay 4">Barangay 4</SelectItem>
                          <SelectItem value="Barangay 5">Barangay 5</SelectItem>
                          <SelectItem value="Barangay 6">Barangay 6</SelectItem>
                          <SelectItem value="Barangay 7">Barangay 7</SelectItem>
                          <SelectItem value="Barangay 8">Barangay 8</SelectItem>
                          <SelectItem value="Barangay 9">Barangay 9</SelectItem>
                          <SelectItem value="Barangay 10">Barangay 10</SelectItem>
                          <SelectItem value="Igang">Igang</SelectItem>
                          <SelectItem value="Kabatete">Kabatete</SelectItem>
                          <SelectItem value="Kakawit">Kakawit</SelectItem>
                          <SelectItem value="Kalangay">Kalangay</SelectItem>
                          <SelectItem value="Kalyaat">Kalyaat</SelectItem>
                          <SelectItem value="Kilib">Kilib</SelectItem>
                          <SelectItem value="Kulapi">Kulapi</SelectItem>
                          <SelectItem value="Mahabang Parang">Mahabang Parang</SelectItem>
                          <SelectItem value="Malupak">Malupak</SelectItem>
                          <SelectItem value="Manasa">Manasa</SelectItem>
                          <SelectItem value="May-it">May-it</SelectItem>
                          <SelectItem value="Nagsinamo">Nagsinamo</SelectItem>
                          <SelectItem value="Nalunao">Nalunao</SelectItem>
                          <SelectItem value="Palola">Palola</SelectItem>
                          <SelectItem value="Piis">Piis</SelectItem>
                          <SelectItem value="Samil">Samil</SelectItem>
                          <SelectItem value="Tiawe">Tiawe</SelectItem>
                          <SelectItem value="Tinamnan">Tinamnan</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">City/Town</TableCell>
                    <TableCell>
                      <Input 
                        value={selectedResident?.cityTown || ''} 
                        onChange={e => setSelectedResident({
                          ...selectedResident,
                          cityTown: e.target.value
                        })}
                        className="border-0 bg-transparent p-0 h-auto font-normal"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Province</TableCell>
                    <TableCell>{selectedResident?.province || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Valid ID Type</TableCell>
                    <TableCell>
                      <Input 
                        value={selectedResident?.validId || ''} 
                        onChange={e => setSelectedResident({
                          ...selectedResident,
                          validId: e.target.value
                        })}
                        className="border-0 bg-transparent p-0 h-auto font-normal"
                        placeholder="e.g., Driver's License, Passport"
                      />
                    </TableCell>
                  </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Valid ID Image</TableCell>
                      <TableCell>
                        <div className="space-y-3">
                          {/* Image Recycler View */}
                          <div className="flex flex-wrap gap-3">
                            {(selectedResident?.validIdUrl || selectedResident?.validIdImage) && (
                              <div className="relative group">
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(selectedResident.validIdUrl || selectedResident.validIdImage)}
                                  className="relative w-24 h-16 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-brand-orange transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                  <img
                                    src={selectedResident.validIdUrl || selectedResident.validIdImage}
                                    alt="ID Preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      const nextElement = target.nextElementSibling as HTMLElement;
                                      target.style.display = 'none';
                                      if (nextElement) nextElement.style.display = 'flex';
                                    }}
                                  />
                                  <div className="hidden w-full h-full items-center justify-center bg-gray-100">
                                    <FileText className="h-6 w-6 text-gray-400" />
                                  </div>
                                  
                                  {/* Hover overlay with view text */}
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex flex-col items-center justify-center">
                                    <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 mb-1" />
                                    <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center px-1">View ID</span>
                                  </div>
                                </button>
                                
                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(true)}
                                  className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Verification Status</TableCell>
                    <TableCell>
                      <Select 
                        value={
                          selectedResident?.suspended ? 'Suspended' : 
                          selectedResident?.verified ? 'Verified' : 
                          'Pending'
                        } 
                        onValueChange={async (newStatus) => {
                          try {
                            const updates: any = {};
                            if (newStatus === 'Verified') {
                              updates.verified = true;
                              updates.suspended = false;
                            } else if (newStatus === 'Pending') {
                              updates.verified = false;
                              updates.suspended = false;
                            } else if (newStatus === 'Suspended') {
                              updates.suspended = true;
                              updates.verified = false;
                            }
                            
                            await updateDoc(doc(db, "users", selectedResident.id), updates);
                            setSelectedResident({ ...selectedResident, ...updates });
                            toast({
                              title: 'Success',
                              description: `Status updated to ${newStatus}`
                            });
                          } catch (error) {
                            console.error("Error updating resident status:", error);
                            toast({
                              title: 'Error',
                              description: 'Failed to update status. Please try again.',
                              variant: 'destructive'
                            });
                          }
                        }}
                      >
                        <SelectTrigger className={cn(
                          "w-auto border-0 bg-transparent font-medium focus:ring-1 focus:ring-brand-orange",
                          selectedResident?.suspended && 'text-red-600',
                          selectedResident?.verified && 'text-green-600',
                          !selectedResident?.verified && !selectedResident?.suspended && 'text-yellow-600'
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Verified">Verified</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Created Date</TableCell>
                    <TableCell>
                      {selectedResident?.createdDate}
                      {selectedResident?.createdTime && (
                        <><br /><span className="text-xs text-gray-500">{formatTimeNoSeconds(selectedResident.createdTime)}</span></>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* 4. Add total number of submitted reports by the resident in the details preview */}
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Total Reports Submitted</TableCell>
                    <TableCell>{residentReportsCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              </div>
            ) : (
              <div>
                {loadingReports ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
                    <p className="mt-2 text-gray-500">Loading reports...</p>
                  </div>
                ) : residentReports.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Submitted</h3>
                    <p className="text-gray-500">This resident hasn't submitted any reports yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        Submitted Reports ({residentReports.length})
                      </h3>
                    </div>
                    
                    <div className="space-y-3">
                      {residentReports.map((report) => (
                        <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  report.hazardType === 'Fire' ? 'bg-red-100 text-red-800' :
                                  report.hazardType === 'Flood' ? 'bg-blue-100 text-blue-800' :
                                  report.hazardType === 'Earthquake' ? 'bg-yellow-100 text-yellow-800' :
                                  report.hazardType === 'Landslide' ? 'bg-orange-100 text-orange-800' :
                                  report.hazardType === 'Typhoon' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {report.hazardType || 'Unknown'}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  report.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                  report.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                  report.status === 'Pending' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {report.status || 'Pending'}
                                </span>
                              </div>
                              
                              <h4 className="font-medium text-gray-900 mb-1">
                                {report.title || report.description || 'Untitled Report'}
                              </h4>
                              
                              {report.description && report.description !== report.title && (
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {report.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {report.location || report.barangay || 'Unknown Location'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {report.timestamp ? (
                                    report.timestamp.toDate ? 
                                      report.timestamp.toDate().toLocaleDateString() :
                                      new Date(report.timestamp).toLocaleDateString()
                                  ) : 'Unknown Date'}
                                </span>
                              </div>
                            </div>
                            
                            {report.imageUrl && (
                              <div className="ml-4 flex-shrink-0">
                                <img 
                                  src={report.imageUrl} 
                                  alt="Report" 
                                  className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={handleSaveResidentEdit}
                className="bg-brand-orange hover:bg-brand-orange-400 text-white"
              >
                Save Changes
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Valid ID Preview</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img src={previewImage || ""} alt="Valid ID Preview" className="max-w-full h-auto rounded-lg" />
            </div>
          </DialogContent>
        </Dialog>

        {/* Account Status Modal */}
        <Dialog open={accountStatusModal.open} onOpenChange={closeAccountStatusModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Account Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Choose an action for <b>{accountStatusModal.resident?.fullName}</b>:</p>
              <div className="flex gap-2">
                <Button onClick={() => updateAccountStatus('verify')} className="bg-green-600 hover:bg-green-700 text-white">Verify</Button>
                <Button onClick={() => updateAccountStatus('unverify')} className="bg-yellow-600 hover:bg-yellow-700 text-white">Unverify</Button>
                <Button onClick={() => updateAccountStatus('suspend')} className="bg-gray-600 hover:bg-gray-700 text-white">Suspend</Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Delete Position Modal */}
        <AlertDialog open={!!confirmDeletePosition} onOpenChange={() => setConfirmDeletePosition(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <AlertDialogTitle className="text-red-800">Delete Position</AlertDialogTitle>
                  <AlertDialogDescription className="text-red-600">
                    Are you sure you want to delete the position <b>{confirmDeletePosition}</b>? This action cannot be undone.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePositionAction} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Admin Account Modal */}
        <Dialog
          open={!!editingAdmin}
          onOpenChange={(open) => {
            if (!open) {
              setEditingAdmin(null);
              setShowEditAdminErrors(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader className="border-b border-gray-200 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-[#FF4F0B]" />
                Edit Admin Account
              </DialogTitle>
            </DialogHeader>
            {editingAdmin && (
              <div className="space-y-4">
                <div>
                  <Label>Name{showEditAdminErrors && !editingAdmin.name?.trim() && <span className="text-red-500"> *</span>}</Label>
                  <Input
                    value={editingAdmin.name}
                    onChange={e => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                    className={showEditAdminErrors && !editingAdmin.name?.trim() ? "border-red-500" : ""}
                  />
                  {showEditAdminErrors && !editingAdmin.name?.trim() && <div className="text-xs text-red-600 mt-1">Name is required</div>}
                </div>
                <div>
                  <Label>Position{showEditAdminErrors && !editingAdmin.position?.trim() && <span className="text-red-500"> *</span>}</Label>
                  <Select
                    value={editingAdmin.position}
                    onValueChange={value => setEditingAdmin({ ...editingAdmin, position: value })}
                  >
                    <SelectTrigger className={showEditAdminErrors && !editingAdmin.position?.trim() ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No positions available. Add positions from the admin list.
                        </div>
                      )}
                      {positionOptions.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showEditAdminErrors && !editingAdmin.position?.trim() && <div className="text-xs text-red-600 mt-1">Position is required</div>}
                </div>
                <div>
                  <Label>ID Number{showEditAdminErrors && !editingAdmin.idNumber?.trim() && <span className="text-red-500"> *</span>}</Label>
                  <Input
                    value={editingAdmin.idNumber}
                    onChange={e => setEditingAdmin({ ...editingAdmin, idNumber: e.target.value })}
                    className={showEditAdminErrors && !editingAdmin.idNumber?.trim() ? "border-red-500" : ""}
                  />
                  {showEditAdminErrors && !editingAdmin.idNumber?.trim() && <div className="text-xs text-red-600 mt-1">ID number is required</div>}
                </div>
                <div>
                  <Label>Username{showEditAdminErrors && !editingAdmin.username?.trim() && <span className="text-red-500"> *</span>}</Label>
                  <Input
                    value={editingAdmin.username}
                    onChange={e => setEditingAdmin({ ...editingAdmin, username: e.target.value })}
                    className={showEditAdminErrors && !editingAdmin.username?.trim() ? "border-red-500" : ""}
                  />
                  {showEditAdminErrors && !editingAdmin.username?.trim() && <div className="text-xs text-red-600 mt-1">Username is required</div>}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={async () => {
                  setShowEditAdminErrors(true);
                  if (
                    editingAdmin.name?.trim() &&
                    editingAdmin.position?.trim() &&
                    editingAdmin.idNumber?.trim() &&
                    editingAdmin.username?.trim()
                  ) {
                    await handleSaveAdminEdit();
                    setEditingAdmin(null);
                    setShowEditAdminErrors(false);
                  }
                }}
                disabled={!(editingAdmin && editingAdmin.name?.trim() && editingAdmin.position?.trim() && editingAdmin.idNumber?.trim() && editingAdmin.username?.trim())}
              >
                Save Changes
              </Button>
              <Button variant="secondary" onClick={() => { setEditingAdmin(null); setShowEditAdminErrors(false); }}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Resident Modal */}
        <Dialog open={isEditResidentOpen} onOpenChange={setIsEditResidentOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-gray-200 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-[#FF4F0B]" />
                Edit Resident Information
              </DialogTitle>
            </DialogHeader>
            {selectedResident && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={selectedResident.fullName} onChange={e => setSelectedResident({
                      ...selectedResident,
                      fullName: e.target.value
                    })} />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input value={selectedResident.phoneNumber} onChange={e => setSelectedResident({
                      ...selectedResident,
                      phoneNumber: e.target.value
                    })} />
                  </div>
                  <div>
                    <Label>Email Address</Label>
                    <Input value={selectedResident.email} onChange={e => setSelectedResident({
                      ...selectedResident,
                      email: e.target.value
                    })} />
                  </div>
                  <div>
                    <Label>Barangay</Label>
                    <Select value={selectedResident.barangay} onValueChange={value => setSelectedResident({
                      ...selectedResident,
                      barangay: value
                    })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Abang">Abang</SelectItem>
                        <SelectItem value="Aliliw">Aliliw</SelectItem>
                        <SelectItem value="Atulinao">Atulinao</SelectItem>
                        <SelectItem value="Ayuti">Ayuti</SelectItem>
                        <SelectItem value="Barangay 1">Barangay 1</SelectItem>
                        <SelectItem value="Barangay 2">Barangay 2</SelectItem>
                        <SelectItem value="Barangay 3">Barangay 3</SelectItem>
                        <SelectItem value="Barangay 4">Barangay 4</SelectItem>
                        <SelectItem value="Barangay 5">Barangay 5</SelectItem>
                        <SelectItem value="Barangay 6">Barangay 6</SelectItem>
                        <SelectItem value="Barangay 7">Barangay 7</SelectItem>
                        <SelectItem value="Barangay 8">Barangay 8</SelectItem>
                        <SelectItem value="Barangay 9">Barangay 9</SelectItem>
                        <SelectItem value="Barangay 10">Barangay 10</SelectItem>
                        <SelectItem value="Igang">Igang</SelectItem>
                        <SelectItem value="Kabatete">Kabatete</SelectItem>
                        <SelectItem value="Kakawit">Kakawit</SelectItem>
                        <SelectItem value="Kalangay">Kalangay</SelectItem>
                        <SelectItem value="Kalyaat">Kalyaat</SelectItem>
                        <SelectItem value="Kilib">Kilib</SelectItem>
                        <SelectItem value="Kulapi">Kulapi</SelectItem>
                        <SelectItem value="Mahabang Parang">Mahabang Parang</SelectItem>
                        <SelectItem value="Malupak">Malupak</SelectItem>
                        <SelectItem value="Manasa">Manasa</SelectItem>
                        <SelectItem value="May-it">May-it</SelectItem>
                        <SelectItem value="Nagsinamo">Nagsinamo</SelectItem>
                        <SelectItem value="Nalunao">Nalunao</SelectItem>
                        <SelectItem value="Palola">Palola</SelectItem>
                        <SelectItem value="Piis">Piis</SelectItem>
                        <SelectItem value="Samil">Samil</SelectItem>
                        <SelectItem value="Tiawe">Tiawe</SelectItem>
                        <SelectItem value="Tinamnan">Tinamnan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>City/Town</Label>
                    <Input value={selectedResident.cityTown} onChange={e => setSelectedResident({
                      ...selectedResident,
                      cityTown: e.target.value
                    })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Home Address</Label>
                    <Input value={selectedResident.homeAddress} onChange={e => setSelectedResident({
                      ...selectedResident,
                      homeAddress: e.target.value
                    })} />
                  </div>
                  <div>
                    <Label>Valid ID Type</Label>
                    <Input value={selectedResident.validId} onChange={e => setSelectedResident({
                      ...selectedResident,
                      validId: e.target.value
                    })} />
                  </div>
                  <div>
                    <Label>Valid ID Image URL</Label>
                    <Input value={selectedResident.validIdUrl || selectedResident.validIdImage || ''} onChange={e => setSelectedResident({ ...selectedResident, validIdUrl: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Additional Information</Label>
                    <Input value={selectedResident.additionalInfo} onChange={e => setSelectedResident({
                      ...selectedResident,
                      additionalInfo: e.target.value
                    })} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleSaveResidentEdit} className="bg-brand-orange hover:bg-brand-orange-400 text-white">Save Changes</Button>
              <Button variant="secondary" onClick={() => setIsEditResidentOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete ID Confirmation Dialog */}
        <AlertDialog open={confirmDeleteId} onOpenChange={setConfirmDeleteId}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <AlertDialogTitle className="text-red-800">Delete Valid ID Image</AlertDialogTitle>
                  <AlertDialogDescription className="text-red-700">
                    Are you sure you want to delete the valid ID image for {selectedResident?.fullName}? This action cannot be undone.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteId}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete ID Image
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </TooltipProvider>
    </Layout>;
}