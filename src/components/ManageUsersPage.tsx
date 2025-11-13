import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Shield, ShieldOff, ShieldCheck, ShieldX, Eye, User, FileText, Calendar as CalendarIcon, CheckSquare, Square, UserPlus, EyeOff, ChevronUp, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, Upload, X, FileDown, Camera, Check } from "lucide-react";
import { Layout } from "./Layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { db, deleteResidentUserFunction, storage, auth } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { uploadProfilePicture, uploadValidIdImage } from "@/lib/storage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { logActivity, ActionType, formatLogMessage } from "@/lib/activityLogger";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

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

// Helper function to parse MM/DD/YYYY format and convert to yyyy-MM-dd
function parseMMDDYYYY(input: string): string {
  if (!input) return "";
  
  // Check if input matches MM/DD/YYYY format
  const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = input.match(mmddyyyyPattern);
  
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    // Validate date
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= new Date().getFullYear()) {
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return format(date, "yyyy-MM-dd");
      }
    }
  }
  
  // If not MM/DD/YYYY format, try to parse as is
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return format(date, "yyyy-MM-dd");
  }
  
  return input; // Return as is if can't parse
}

// Helper function to format yyyy-MM-dd to MM/DD/YYYY for display in input
function formatToMMDDYYYY(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return dateString;
  }
}

const ADMIN_POSITIONS_COLLECTION = "adminPositions";

export function ManageUsersPage() {
  const navigate = useNavigate();
  const { userRole, loading: roleLoading, canManageAdmins, canEditResidents, canDeleteResidents, canChangeResidentStatus } = useUserRole();
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
  const [showAdminPreview, setShowAdminPreview] = useState(false);
  const [previewAdmin, setPreviewAdmin] = useState<any>(null);
  const [isEditingPreviewAdmin, setIsEditingPreviewAdmin] = useState(false);
  const [editingPreviewAdmin, setEditingPreviewAdmin] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<boolean>(false);
  const [activeResidentTab, setActiveResidentTab] = useState<'profile' | 'reports'>('profile');
  const [residentReports, setResidentReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [confirmPermissionChange, setConfirmPermissionChange] = useState<any>(null);
  const [confirmSuspendResident, setConfirmSuspendResident] = useState<any>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>("");
  const [isEditingResidentPreview, setIsEditingResidentPreview] = useState(false);
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
    email: "",
    password: "",
    profilePicture: ""
  });
  const [newResident, setNewResident] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    password: "",
    province: "",
    cityTown: "",
    houseNumberStreetSubdivision: "",
    barangay: "",
    birthday: "",
    gender: "",
    civilStatus: "",
    religion: "",
    bloodType: "",
    pwdStatus: "",
    profilePicture: "",
    validIdType: "",
    validIdImage: "",
    validIdUrl: ""
  });
  const [residentFormStep, setResidentFormStep] = useState(1);
  const [birthdayInput, setBirthdayInput] = useState("");
  const [previewBirthdayInput, setPreviewBirthdayInput] = useState("");
  const [barangaySuggestions, setBarangaySuggestions] = useState<string[]>([]);
  const [showBarangaySuggestions, setShowBarangaySuggestions] = useState(false);
  
  const barangayOptions = [
    "Abang",
    "Aliliw",
    "Atulinao",
    "Ayuti",
    "Barangay 1",
    "Barangay 2",
    "Barangay 3",
    "Barangay 4",
    "Barangay 5",
    "Barangay 6",
    "Barangay 7",
    "Barangay 8",
    "Barangay 9",
    "Barangay 10",
    "Igang",
    "Kabatete",
    "Kakawit",
    "Kalangay",
    "Kalyaat",
    "Kilib",
    "Kulapi",
    "Mahabang Parang",
    "Malupak",
    "Manasa",
    "May-it",
    "Nagsinamo",
    "Nalunao",
    "Palola",
    "Piis",
    "Samil",
    "Tiawe",
    "Tinamnan"
  ];
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

  // Step-specific validation functions
  const isStep1Valid = () => {
    return newResident.firstName.trim() !== "" && 
           newResident.lastName.trim() !== "" && 
           newResident.phoneNumber.trim() !== "" && 
           newResident.email.trim() !== "" && 
           newResident.password.trim() !== "" &&
           passwordError === "";
  };

  const isStep2Valid = () => {
    return newResident.birthday.trim() !== "" && 
           newResident.gender.trim() !== "" && 
           newResident.civilStatus.trim() !== "" && 
           newResident.religion.trim() !== "" && 
           newResident.bloodType.trim() !== "" && 
           newResident.pwdStatus.trim() !== "";
  };

  const isStep3Valid = () => {
    return newResident.barangay.trim() !== "" && 
           newResident.cityTown.trim() !== "" &&
           newResident.province.trim() !== "";
  };

  const isStep4Valid = () => {
    return newResident.profilePicture.trim() !== "";
  };

  const isStep5Valid = () => {
    return newResident.validIdType.trim() !== "" && 
           newResident.validIdImage.trim() !== "";
  };

  // Validation function for new resident (overall)
  const isNewResidentValid = () => {
    return isStep1Valid() && 
           isStep2Valid() && 
           isStep3Valid() && 
           isStep4Valid() && 
           isStep5Valid();
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
            province: data.province || "",
            cityTown: data.cityTown || data.city || "Unknown",
            houseNumberStreetSubdivision: data.houseNumberStreetSubdivision || "",
            barangay: data.barangay || "Unknown",
            profilePicture: profilePicture,  // Use the resolved value
            validIdImage: validIdImage,  // Use the resolved value (now a download URL if it was a path)
            validIdUrl: validIdImage,  // Also set validIdUrl for backward compatibility
            // Map Firestore field names to component state
            civil_status: data.civil_status || data.civilStatus,
            civilStatus: data.civil_status || data.civilStatus,
            blood_type: data.blood_type || data.bloodType,
            bloodType: data.blood_type || data.bloodType,
            pwd: data.pwd,
            pwdStatus: data.pwd === true || data.pwd === 'Yes' ? 'Yes' : data.pwd === false || data.pwd === 'No' ? 'No' : undefined,
            isPWD: data.pwd === true || data.pwd === 'Yes',
            validIdType: data.validIdType || data.validId,
            validId: data.validIdType || data.validId
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
        email: newAdmin.email || "",
        password: newAdmin.password,
        profilePicture: newAdmin.profilePicture || "",
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
          email: newAdmin.email || "",
          password: newAdmin.password,
          profilePicture: newAdmin.profilePicture || "",
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
        email: "",
        password: "",
        profilePicture: ""
      });
      
      // Log activity
      await logActivity({
        actionType: ActionType.ADMIN_CREATED,
        action: formatLogMessage('Created', 'admin account', newAdmin.name, formattedUserId),
        entityType: 'admin',
        entityId: docRef.id,
        entityName: newAdmin.name,
        metadata: {
          position: newAdmin.position,
          username: newAdmin.username,
          hasEditPermission: false
        }
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
      const oldAdmin = adminUsers.find(a => a.id === editingAdmin.id);
      const changes: Record<string, { from: any; to: any }> = {};
      
      if (oldAdmin) {
        if (oldAdmin.name !== editingAdmin.name) changes.name = { from: oldAdmin.name, to: editingAdmin.name };
        if (oldAdmin.position !== editingAdmin.position) changes.position = { from: oldAdmin.position, to: editingAdmin.position };
        if (oldAdmin.idNumber !== editingAdmin.idNumber) changes.idNumber = { from: oldAdmin.idNumber, to: editingAdmin.idNumber };
        if (oldAdmin.username !== editingAdmin.username) changes.username = { from: oldAdmin.username, to: editingAdmin.username };
        if (oldAdmin.email !== editingAdmin.email) changes.email = { from: oldAdmin.email || '', to: editingAdmin.email || '' };
      }
      
      await updateDoc(doc(db, "admins", editingAdmin.id), {
        name: editingAdmin.name,
        position: editingAdmin.position,
        idNumber: editingAdmin.idNumber,
        username: editingAdmin.username,
        email: editingAdmin.email || ""
      });
      setAdminUsers(adminUsers.map(a => a.id === editingAdmin.id ? editingAdmin : a));
      
      // Log activity
      await logActivity({
        actionType: ActionType.ADMIN_UPDATED,
        action: formatLogMessage('Updated', 'admin account', editingAdmin.name, editingAdmin.userId || editingAdmin.id),
        entityType: 'admin',
        entityId: editingAdmin.id,
        entityName: editingAdmin.name,
        changes: Object.keys(changes).length > 0 ? changes : undefined
      });
      
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
      const wasGranted = !confirmPermissionChange.hasEditPermission;
      await updateDoc(doc(db, "admins", confirmPermissionChange.id), {
        hasEditPermission: wasGranted
      });
      setAdminUsers(adminUsers.map(admin => admin.id === confirmPermissionChange.id ? {
        ...admin,
        hasEditPermission: wasGranted
      } : admin));
      
      // Log activity
      await logActivity({
        actionType: wasGranted ? ActionType.ADMIN_PERMISSION_GRANTED : ActionType.ADMIN_PERMISSION_REVOKED,
        action: wasGranted 
          ? `Granted edit permission to admin "${confirmPermissionChange.name}" (${confirmPermissionChange.userId || confirmPermissionChange.id})`
          : `Revoked edit permission from admin "${confirmPermissionChange.name}" (${confirmPermissionChange.userId || confirmPermissionChange.id})`,
        entityType: 'admin',
        entityId: confirmPermissionChange.id,
        entityName: confirmPermissionChange.name || 'Admin',
        changes: {
          hasEditPermission: { from: !wasGranted, to: wasGranted }
        }
      });
      
      toast({
        title: "Permission Updated",
        description: `${confirmPermissionChange.name || 'Admin'} now ${wasGranted ? 'has' : 'no longer has'} edit access.`
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
      
      // Log activity
      if (adminToDelete) {
        await logActivity({
          actionType: ActionType.ADMIN_DELETED,
          action: formatLogMessage('Deleted', 'admin account', adminToDelete.name, adminToDelete.userId || adminId),
          entityType: 'admin',
          entityId: adminId,
          entityName: adminToDelete.name
        });
      }
      
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
    setPreviewBirthdayInput(resident?.birthday ? formatToMMDDYYYY(resident.birthday) : "");
    setShowResidentPreview(true);
  };

  const handlePreviewAdmin = (admin: any) => {
    setPreviewAdmin(admin);
    setEditingPreviewAdmin({ ...admin });
    setIsEditingPreviewAdmin(false);
    setShowAdminPreview(true);
  };

  const handleSavePreviewAdminEdit = async () => {
    if (!editingPreviewAdmin) return;
    try {
      await updateDoc(doc(db, "admins", editingPreviewAdmin.id), {
        name: editingPreviewAdmin.name,
        position: editingPreviewAdmin.position,
        idNumber: editingPreviewAdmin.idNumber,
        username: editingPreviewAdmin.username,
        email: editingPreviewAdmin.email || "",
        password: editingPreviewAdmin.password || "",
        profilePicture: editingPreviewAdmin.profilePicture || ""
      });
      setAdminUsers(adminUsers.map(a => a.id === editingPreviewAdmin.id ? editingPreviewAdmin : a));
      setPreviewAdmin(editingPreviewAdmin);
      setIsEditingPreviewAdmin(false);
      toast({
        title: 'Success',
        description: 'Admin account updated successfully!'
      });
    } catch (error) {
      console.error("Error updating admin:", error);
      toast({
        title: 'Error',
        description: 'Failed to update admin account. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleCancelPreviewEdit = () => {
    setEditingPreviewAdmin({ ...previewAdmin });
    setIsEditingPreviewAdmin(false);
  };

  const handleSaveResidentEdit = async () => {
    try {
      const oldResident = residents.find(r => r.id === selectedResident.id);
      const changes: Record<string, { from: any; to: any }> = {};
      
      if (oldResident) {
        if (oldResident.fullName !== selectedResident.fullName) changes.fullName = { from: oldResident.fullName, to: selectedResident.fullName };
        if (oldResident.phoneNumber !== selectedResident.phoneNumber) changes.phoneNumber = { from: oldResident.phoneNumber, to: selectedResident.phoneNumber };
        if (oldResident.email !== selectedResident.email) changes.email = { from: oldResident.email, to: selectedResident.email };
        if (oldResident.barangay !== selectedResident.barangay) changes.barangay = { from: oldResident.barangay, to: selectedResident.barangay };
        if (oldResident.cityTown !== selectedResident.cityTown) changes.cityTown = { from: oldResident.cityTown, to: selectedResident.cityTown };
      }
      
      const updateData: any = {
        fullName: selectedResident.fullName,
        phoneNumber: selectedResident.phoneNumber,
        province: selectedResident.province,
        cityTown: selectedResident.cityTown,
        houseNumberStreetSubdivision: selectedResident.houseNumberStreetSubdivision,
        barangay: selectedResident.barangay,
        homeAddress: selectedResident.homeAddress,
        email: selectedResident.email,
        validIdUrl: selectedResident.validIdUrl || selectedResident.validIdImage || "",
        additionalInfo: selectedResident.additionalInfo
      };
      
      // Add new fields with correct Firestore field names
      if (selectedResident.birthday !== undefined) updateData.birthday = selectedResident.birthday;
      if (selectedResident.gender !== undefined) updateData.gender = selectedResident.gender;
      if (selectedResident.civil_status !== undefined || selectedResident.civilStatus !== undefined) {
        updateData.civil_status = selectedResident.civil_status || selectedResident.civilStatus;
      }
      if (selectedResident.religion !== undefined) updateData.religion = selectedResident.religion;
      if (selectedResident.blood_type !== undefined || selectedResident.bloodType !== undefined) {
        updateData.blood_type = selectedResident.blood_type || selectedResident.bloodType;
      }
      if (selectedResident.pwd !== undefined || selectedResident.pwdStatus !== undefined || selectedResident.isPWD !== undefined) {
        updateData.pwd = selectedResident.pwd === true || selectedResident.pwd === 'Yes' || selectedResident.pwdStatus === 'Yes' || selectedResident.isPWD;
      }
      if (selectedResident.validIdType !== undefined || selectedResident.validId !== undefined) {
        updateData.validIdType = selectedResident.validIdType || selectedResident.validId;
      }
      
      await updateDoc(doc(db, "users", selectedResident.id), updateData);
      setResidents(residents.map(r => r.id === selectedResident.id ? selectedResident : r));
      
      // Log activity
      await logActivity({
        actionType: ActionType.RESIDENT_UPDATED,
        action: formatLogMessage('Updated', 'resident account', selectedResident.fullName, selectedResident.userId || selectedResident.id),
        entityType: 'resident',
        entityId: selectedResident.id,
        entityName: selectedResident.fullName,
        changes: Object.keys(changes).length > 0 ? changes : undefined
      });
      
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
        // Use resident's firebaseUid, userId, or email as identifier
        const userId = selectedResident.firebaseUid || selectedResident.userId || selectedResident.email || `resident-${selectedResident.id}`;
        const result = await uploadValidIdImage(file, userId);
          setSelectedResident({
            ...selectedResident,
          validIdUrl: result.url,
          validIdImage: result.url
          });
          
          toast({
            title: 'Success',
            description: 'ID image uploaded successfully'
          });
      } catch (error: any) {
        console.error('Error uploading valid ID image:', error);
        toast({
          title: 'Upload failed',
          description: error.message || 'Failed to upload image. Please try again.',
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
      
      // Log activity
      if (residentToDelete) {
        await logActivity({
          actionType: ActionType.RESIDENT_DELETED,
          action: formatLogMessage('Deleted', 'resident account', residentToDelete.fullName, residentToDelete.userId || residentId),
          entityType: 'resident',
          entityId: residentId,
          entityName: residentToDelete.fullName
        });
      }
      
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
        const newVerifiedStatus = !resident.verified;
        await updateDoc(doc(db, "users", residentId), {
          verified: newVerifiedStatus
        });
        setResidents(residents.map(resident => resident.id === residentId ? {
          ...resident,
          verified: newVerifiedStatus
        } : resident));
        
        // Log activity
        await logActivity({
          actionType: newVerifiedStatus ? ActionType.RESIDENT_VERIFIED : ActionType.RESIDENT_UNVERIFIED,
          action: newVerifiedStatus
            ? formatLogMessage('Verified', 'resident account', resident.fullName, resident.userId || residentId)
            : formatLogMessage('Unverified', 'resident account', resident.fullName, resident.userId || residentId),
          entityType: 'resident',
          entityId: residentId,
          entityName: resident.fullName,
          changes: {
            verified: { from: !newVerifiedStatus, to: newVerifiedStatus }
          }
        });
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
            const deletedAdmins = adminUsers.filter(admin => items.includes(admin.id));
            for (const adminId of items) {
              await deleteDoc(doc(db, "admins", adminId));
            }
            setAdminUsers(prev => prev.filter(admin => !items.includes(admin.id)));
            setSelectedAdmins([]);
            
            // Log bulk delete activity
            await logActivity({
              actionType: ActionType.BULK_OPERATION,
              action: `Bulk deleted ${items.length} admin account(s)`,
              entityType: 'admin',
              metadata: {
                count: items.length,
                deletedAdmins: deletedAdmins.map(a => ({ id: a.id, name: a.name, userId: a.userId }))
              }
            });
          } else {
            // Delete residents (both Auth and Firestore)
            const deletedResidents = residents.filter(resident => items.includes(resident.id));
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
            
            // Log bulk delete activity
            await logActivity({
              actionType: ActionType.BULK_OPERATION,
              action: `Bulk deleted ${items.length} resident account(s)`,
              entityType: 'resident',
              metadata: {
                count: items.length,
                deletedResidents: deletedResidents.map(r => ({ id: r.id, name: r.fullName, userId: r.userId }))
              }
            });
          }
          break;

        case 'permission':
          // Update admin permissions
          const updatedAdmins = adminUsers.filter(admin => items.includes(admin.id));
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
          
          // Log bulk permission activity
          await logActivity({
            actionType: value ? ActionType.ADMIN_PERMISSION_GRANTED : ActionType.ADMIN_PERMISSION_REVOKED,
            action: `Bulk ${value ? 'granted' : 'revoked'} edit permission for ${items.length} admin account(s)`,
            entityType: 'admin',
            metadata: {
              count: items.length,
              updatedAdmins: updatedAdmins.map(a => ({ id: a.id, name: a.name, userId: a.userId }))
            }
          });
          break;

        case 'verification':
          // Update resident verification
          const updatedResidents = residents.filter(resident => items.includes(resident.id));
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
          
          // Log bulk verification activity
          await logActivity({
            actionType: value ? ActionType.RESIDENT_VERIFIED : ActionType.RESIDENT_UNVERIFIED,
            action: `Bulk ${value ? 'verified' : 'unverified'} ${items.length} resident account(s)`,
            entityType: 'resident',
            metadata: {
              count: items.length,
              updatedResidents: updatedResidents.map(r => ({ id: r.id, name: r.fullName, userId: r.userId }))
            }
          });
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
    let firebaseUser: any = null;
    
    try {
      // Step 1: Create Firebase Authentication account
      try {
        firebaseUser = await createUserWithEmailAndPassword(
          auth,
          newResident.email,
          newResident.password
        );
        
        // Step 2: Send verification email
        await sendEmailVerification(firebaseUser.user);
        console.log("✅ Verification email sent to:", newResident.email);
      } catch (authError: any) {
        console.error("Firebase Auth error:", authError);
        let errorMessage = 'Failed to create authentication account. ';
        
        if (authError.code === 'auth/email-already-in-use') {
          errorMessage = 'This email is already registered. Please use a different email.';
        } else if (authError.code === 'auth/invalid-email') {
          errorMessage = 'Invalid email address. Please check and try again.';
        } else if (authError.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else {
          errorMessage += authError.message || 'Please try again.';
        }
        
        toast({
          title: 'Authentication Error',
          description: errorMessage,
          variant: 'destructive'
        });
        throw authError; // Stop execution if Auth fails
      }

      // Step 3: Fetch all userIds and find the max number
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
      
      // Step 4: Map form fields to Firestore field names
      const fullName = `${newResident.firstName.trim()} ${newResident.lastName.trim()}`.trim();
      const residentData: any = {
        fullName: fullName,
        firstName: newResident.firstName,
        lastName: newResident.lastName,
        phoneNumber: newResident.phoneNumber,
        email: newResident.email,
        // Don't store password in Firestore - it's in Firebase Auth
        firebaseUid: firebaseUser.user.uid, // Store Firebase Auth UID
        province: newResident.province || "",
        cityTown: newResident.cityTown,
        houseNumberStreetSubdivision: newResident.houseNumberStreetSubdivision || "",
        barangay: newResident.barangay,
        birthday: newResident.birthday || "",
        gender: newResident.gender || "",
        civil_status: newResident.civilStatus || "",
        religion: newResident.religion || "",
        blood_type: newResident.bloodType || "",
        pwd: newResident.pwdStatus === "Yes",
        profilePicture: newResident.profilePicture || "",
        validIdType: newResident.validIdType || "",
        validIdUrl: newResident.validIdImage || newResident.validIdUrl || "",
        validIdImage: newResident.validIdImage || newResident.validIdUrl || "",
        userId: formattedUserId,
        verified: false,
        suspended: false,
        createdDate: now.toLocaleDateString(),
        createdTime: now.getTime()
      };
      
      // Step 5: Create Firestore document
      const docRef = await addDoc(collection(db, "users"), residentData);
      setResidents(prev => [
        ...prev,
        {
          id: docRef.id,
          ...residentData,
          civilStatus: residentData.civil_status,
          bloodType: residentData.blood_type,
          pwdStatus: residentData.pwd ? "Yes" : "No",
          isPWD: residentData.pwd
        }
      ]);
      
      // Log activity
      await logActivity({
        actionType: ActionType.RESIDENT_CREATED,
        action: formatLogMessage('Created', 'resident account', fullName, formattedUserId),
        entityType: 'resident',
        entityId: docRef.id,
        entityName: fullName,
        metadata: {
          email: newResident.email,
          barangay: newResident.barangay,
          cityTown: newResident.cityTown,
          verified: false
        }
      });
      
      toast({
        title: 'Success',
        description: 'Resident account created successfully! A verification email has been sent to their email address.'
      });
    } catch (error: any) {
      console.error("Error adding resident:", error);
      
      // If Firestore creation failed but Auth succeeded, we could clean up the Auth user
      // However, it's better to let admins handle this manually or use a Cloud Function
      
      if (!error.code || !error.code.startsWith('auth/')) {
        // This is a Firestore or other error (not Auth)
      toast({
        title: 'Error',
        description: 'Failed to add resident account. Please try again.',
        variant: 'destructive'
      });
      }
      // Auth errors are already handled above
      // Re-throw error so handleAddResidentClick can handle dialog closing
      throw error;
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
    const resident = accountStatusModal.resident;
    let updates: any = {};
    let actionType: ActionType;
    let actionMessage: string;
    
    if (status === 'verify') {
      updates.verified = true;
      updates.suspended = false;
      actionType = ActionType.RESIDENT_VERIFIED;
      actionMessage = formatLogMessage('Verified', 'resident account', resident.fullName, resident.userId || residentId);
    } else if (status === 'unverify') {
      updates.verified = false;
      updates.suspended = false;
      actionType = ActionType.RESIDENT_UNVERIFIED;
      actionMessage = formatLogMessage('Unverified', 'resident account', resident.fullName, resident.userId || residentId);
    } else {
      updates.suspended = true;
      updates.verified = false;
      actionType = ActionType.RESIDENT_SUSPENDED;
      actionMessage = formatLogMessage('Suspended', 'resident account', resident.fullName, resident.userId || residentId);
    }
    
    try {
      await updateDoc(doc(db, "users", residentId), updates);
      setResidents(residents.map(r => r.id === residentId ? { ...r, ...updates } : r));
      
      // Log activity
      await logActivity({
        actionType,
        action: actionMessage,
        entityType: 'resident',
        entityId: residentId,
        entityName: resident.fullName,
          changes: {
            verified: { from: resident.verified, to: (updates.verified ?? resident.verified) },
            suspended: { from: (resident.suspended || false), to: (updates.suspended ?? (resident.suspended || false)) }
          }
      });
      
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
  const handleAddResidentClick = async () => {
    if (isNewResidentValid()) {
      try {
        await handleAddResident(newResident);
        // Only close dialog and reset form on success
      setIsAddResidentOpen(false);
        setResidentFormStep(1);
        setBirthdayInput("");
      setNewResident({
          firstName: "",
          lastName: "",
        phoneNumber: "",
        email: "",
          password: "",
          province: "",
        cityTown: "",
          houseNumberStreetSubdivision: "",
          barangay: "",
          birthday: "",
          gender: "",
          civilStatus: "",
          religion: "",
          bloodType: "",
          pwdStatus: "",
          profilePicture: "",
          validIdType: "",
          validIdImage: "",
          validIdUrl: ""
        });
      } catch (error) {
        // Error is already handled in handleAddResident
        // Keep dialog open so user can fix errors
      }
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
          // Use firebaseUid to match reports (reports use Firebase Auth UID)
          const reports = querySnapshot.docs
            .filter(doc => {
              const data = doc.data();
              // Match by Firebase UID (most reliable)
              if (selectedResident.firebaseUid && data.userId === selectedResident.firebaseUid) {
                return true;
              }
              // Fallback: match by userId field (RID- format)
              if (selectedResident.userId && data.userId === selectedResident.userId) {
                return true;
              }
              // Fallback: match by reportedBy name
              if (data.reportedBy && selectedResident.fullName && data.reportedBy === selectedResident.fullName) {
                return true;
              }
              return false;
            })
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              reportId: doc.data().reportId || doc.id,
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
                        placeholder="EMP"
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
                      <Label>Email</Label>
                      <Input 
                        type="email"
                        value={newAdmin.email} 
                        onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} 
                        placeholder="Enter email address"
                      />
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
                    <div>
                      <Label>Profile Picture</Label>
                      <div className="mt-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
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
                                // Use temporary ID based on email or timestamp
                                const tempUserId = newAdmin.email || `temp-${Date.now()}`;
                                const result = await uploadProfilePicture(file, tempUserId);
                                setNewAdmin({ ...newAdmin, profilePicture: result.url });
                                toast({
                                  title: 'Success',
                                  description: 'Profile picture uploaded successfully'
                                });
                              } catch (error: any) {
                                console.error('Error uploading profile picture:', error);
                                toast({
                                  title: 'Upload failed',
                                  description: error.message || 'Failed to upload profile picture. Please try again.',
                                  variant: 'destructive'
                                });
                              }
                            }
                          }}
                          className="hidden"
                          id="admin-profile-picture-upload"
                        />
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {newAdmin.profilePicture ? (
                              <>
                                <img
                                  src={newAdmin.profilePicture}
                                  alt="Profile preview"
                                  className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => setNewAdmin({ ...newAdmin, profilePicture: "" })}
                                  className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                                <label
                                  htmlFor="admin-profile-picture-upload"
                                  className="absolute bottom-0 left-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg"
                                >
                                  <Camera className="h-4 w-4" />
                                </label>
                              </>
                            ) : (
                              <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative">
                                <User className="h-12 w-12 text-gray-400" />
                                <label
                                  htmlFor="admin-profile-picture-upload"
                                  className="absolute bottom-0 left-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg"
                                >
                                  <Camera className="h-4 w-4" />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Upload a profile picture (max 5MB, JPG/PNG)
                        </p>
                      </div>
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

                  {/* Edit Admin Button */}
                  {selectedAdmins.length === 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const adminToEdit = adminUsers.find(a => selectedAdmins.includes(a.id));
                            if (adminToEdit) {
                              handleEditAdmin(adminToEdit);
                            }
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit selected admin</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

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

                    <DateRangePicker
                      value={adminDateRange}
                      onChange={setAdminDateRange}
                    className="w-auto"
                    />

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

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportAdminsToCSV}
                        className="ml-auto flex items-center gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download admin accounts as CSV</p>
                    </TooltipContent>
                  </Tooltip>
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
                            <TableCell><div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            <TableCell><div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          </TableRow>
                        ))
                      ) : pagedAdmins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-8">
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
                            <TableCell>{admin.username}</TableCell>
                            <TableCell>
                              {showAllAdminPasswords ? (
                                <span>{admin.password}</span>
                              ) : (
                                <span>{'•'.repeat(Math.max(8, (admin.password || '').length))}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{admin.createdDate || 'N/A'}</span>
                                <span className="text-xs text-gray-500">{formatTimeNoSeconds(admin.createdTime)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePreviewAdmin(admin)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Preview Admin Details</p>
                                  </TooltipContent>
                                </Tooltip>
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
                      <Dialog open={isAddResidentOpen} onOpenChange={(open) => {
                        setIsAddResidentOpen(open);
                        if (!open) {
                          // Reset form when dialog closes
                          setResidentFormStep(1);
                          setBirthdayInput("");
                          setNewResident({
                            firstName: "",
                            lastName: "",
                            phoneNumber: "",
                            email: "",
                            password: "",
                            province: "",
                            cityTown: "",
                            houseNumberStreetSubdivision: "",
                            barangay: "",
                            birthday: "",
                            gender: "",
                            civilStatus: "",
                            religion: "",
                            bloodType: "",
                            pwdStatus: "",
                            profilePicture: "",
                            validIdType: "",
                            validIdImage: "",
                            validIdUrl: ""
                          });
                        }
                      }}>
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
                          
                          {/* Progress Indicator */}
                          <div className="px-6 pt-4 pb-2">
                            <div className="flex items-center justify-center">
                              {[1, 2, 3, 4, 5].map((step, index) => {
                                const isStepCompleted = 
                                  (step === 1 && isStep1Valid()) ||
                                  (step === 2 && isStep2Valid()) ||
                                  (step === 3 && isStep3Valid()) ||
                                  (step === 4 && isStep4Valid()) ||
                                  (step === 5 && isStep5Valid());
                                
                                return (
                                  <div key={step} className="flex items-center">
                                    <div
                                      className={cn(
                                        "h-10 w-10 rounded-full border-2 bg-white flex items-center justify-center transition-all duration-300",
                                        residentFormStep === step
                                          ? "border-green-500"
                                          : isStepCompleted
                                          ? "border-green-500"
                                          : "border-gray-300"
                                      )}
                                    >
                                      {isStepCompleted ? (
                                        <Check className="h-5 w-5 text-green-500" />
                                      ) : (
                                        <span className={cn(
                                          "text-sm font-medium",
                                          residentFormStep === step ? "text-green-500" : "text-gray-400"
                                        )}>
                                          {step}
                                        </span>
                                      )}
                                    </div>
                                    {index < 4 && (
                                      <div
                                        className={cn(
                                          "h-0.5 w-12 transition-all duration-300",
                                          isStepCompleted ? "bg-green-500" : "bg-gray-300"
                                        )}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="space-y-4 py-4">
                            {/* Step 1: Account Information */}
                            {residentFormStep === 1 && (
                          <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                  I. Account Information
                                </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                    <Label>First Name</Label>
                                <Input 
                                      value={newResident.firstName} 
                                      onChange={e => setNewResident({...newResident, firstName: e.target.value})} 
                                      placeholder="Enter first name"
                                />
                              </div>
                              <div>
                                    <Label>Last Name</Label>
                                    <Input 
                                      value={newResident.lastName} 
                                      onChange={e => setNewResident({...newResident, lastName: e.target.value})} 
                                      placeholder="Enter last name"
                                    />
                                  </div>
                                  <div>
                                    <Label>Phone Number</Label>
                                <Input 
                                  value={newResident.phoneNumber} 
                                  onChange={e => setNewResident({...newResident, phoneNumber: e.target.value})} 
                                  placeholder="Enter phone number"
                                />
                              </div>
                              <div>
                                    <Label>Email Address</Label>
                                <Input 
                                  value={newResident.email} 
                                  onChange={e => setNewResident({...newResident, email: e.target.value})} 
                                  placeholder="Enter email address"
                                  type="email"
                                />
                              </div>
                                  <div className="md:col-span-2">
                                    <Label>Password</Label>
                                    <div className="relative flex items-center">
                                      <Input
                                        type={showPassword ? "text" : "password"}
                                        value={newResident.password}
                                        onChange={e => {
                                          setNewResident({ ...newResident, password: e.target.value });
                                          setPasswordError(validatePassword(e.target.value));
                                        }}
                                        className={`pr-10 ${passwordError ? "border-red-500" : ""}`}
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
                                    {passwordError && <div className="text-xs text-red-600 mt-1">{passwordError}</div>}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Step 2: Personal Information */}
                            {residentFormStep === 2 && (
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                  II. Personal Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                    <Label>Birthday</Label>
                                    <Popover>
                                      <div className="relative">
                                        <Input
                                          placeholder="MM/DD/YYYY"
                                          value={birthdayInput || (newResident.birthday ? formatToMMDDYYYY(newResident.birthday) : "")}
                                          onChange={(e) => {
                                            const inputValue = e.target.value;
                                            setBirthdayInput(inputValue);
                                            
                                            // Parse MM/DD/YYYY format
                                            const parsed = parseMMDDYYYY(inputValue);
                                            if (parsed && parsed !== inputValue) {
                                              // Successfully parsed, update the birthday
                                              setNewResident({
                                                ...newResident,
                                                birthday: parsed
                                              });
                                            } else if (!inputValue) {
                                              // Empty input, clear birthday
                                              setNewResident({
                                                ...newResident,
                                                birthday: ""
                                              });
                                            }
                                          }}
                                          onBlur={(e) => {
                                            // On blur, try to parse and format the input
                                            const parsed = parseMMDDYYYY(e.target.value);
                                            if (parsed && parsed !== e.target.value) {
                                              setBirthdayInput(formatToMMDDYYYY(parsed));
                                              setNewResident({
                                                ...newResident,
                                                birthday: parsed
                                              });
                                            } else if (e.target.value && !newResident.birthday) {
                                              // Invalid format, show error
                                              toast({
                                                title: 'Invalid Date Format',
                                                description: 'Please enter date in MM/DD/YYYY format (e.g., 01/15/1990)',
                                                variant: 'destructive'
                                              });
                                            }
                                          }}
                                          className="pr-10"
                                        />
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                          >
                                            <CalendarIcon className="h-4 w-4" />
                                          </button>
                                        </PopoverTrigger>
                                      </div>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={newResident.birthday ? new Date(newResident.birthday) : undefined}
                                          onSelect={(date) => {
                                            if (date) {
                                              const formatted = format(date, "yyyy-MM-dd");
                                              const displayFormat = formatToMMDDYYYY(formatted);
                                              setNewResident({
                                                ...newResident,
                                                birthday: formatted
                                              });
                                              setBirthdayInput(displayFormat);
                                            } else {
                                              setNewResident({
                                                ...newResident,
                                                birthday: ""
                                              });
                                              setBirthdayInput("");
                                            }
                                          }}
                                          initialFocus
                                          captionLayout="dropdown"
                                          fromYear={1900}
                                          toYear={new Date().getFullYear()}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div>
                                    <Label>Gender</Label>
                                    <Select value={newResident.gender} onValueChange={value => setNewResident({ ...newResident, gender: value })}>
                                  <SelectTrigger>
                                        <SelectValue placeholder="Select gender" />
                                  </SelectTrigger>
                                  <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                    <Label>Civil Status</Label>
                                    <Select value={newResident.civilStatus} onValueChange={value => setNewResident({ ...newResident, civilStatus: value })}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select civil status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Single">Single</SelectItem>
                                        <SelectItem value="Married">Married</SelectItem>
                                        <SelectItem value="Divorced">Divorced</SelectItem>
                                        <SelectItem value="Widowed">Widowed</SelectItem>
                                        <SelectItem value="Separated">Separated</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Religion</Label>
                                    <Select value={newResident.religion} onValueChange={value => setNewResident({ ...newResident, religion: value })}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select religion" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Roman Catholic">Roman Catholic</SelectItem>
                                        <SelectItem value="Christian">Christian</SelectItem>
                                        <SelectItem value="Iglesia ni Christo">Iglesia ni Christo</SelectItem>
                                        <SelectItem value="Islam">Islam</SelectItem>
                                        <SelectItem value="Buddhism">Buddhism</SelectItem>
                                        <SelectItem value="Hinduism">Hinduism</SelectItem>
                                        <SelectItem value="Others">Others</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Blood Type</Label>
                                    <Select value={newResident.bloodType} onValueChange={value => setNewResident({ ...newResident, bloodType: value })}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select blood type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="A+">A+</SelectItem>
                                        <SelectItem value="A-">A-</SelectItem>
                                        <SelectItem value="B+">B+</SelectItem>
                                        <SelectItem value="B-">B-</SelectItem>
                                        <SelectItem value="AB+">AB+</SelectItem>
                                        <SelectItem value="AB-">AB-</SelectItem>
                                        <SelectItem value="O+">O+</SelectItem>
                                        <SelectItem value="O-">O-</SelectItem>
                                        <SelectItem value="Unknown">Unknown</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="block mb-2">PWD Status</Label>
                                    <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
                                      <button
                                        type="button"
                                        className={cn(
                                          "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                          newResident.pwdStatus === "Yes"
                                            ? "bg-brand-orange text-white shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50"
                                        )}
                                        onClick={() => {
                                          setNewResident({
                                            ...newResident,
                                            pwdStatus: "Yes"
                                          });
                                        }}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        className={cn(
                                          "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                          newResident.pwdStatus !== "Yes"
                                            ? "bg-brand-orange text-white shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50"
                                        )}
                                        onClick={() => {
                                          setNewResident({
                                            ...newResident,
                                            pwdStatus: "No"
                                          });
                                        }}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Step 3: Address */}
                            {residentFormStep === 3 && (
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                  III. Address
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Province</Label>
                                    <Input 
                                      value={newResident.province} 
                                      onChange={e => setNewResident({...newResident, province: e.target.value})} 
                                      placeholder="Enter province"
                                    />
                                  </div>
                                  <div>
                                    <Label>City/Town</Label>
                                <Input 
                                  value={newResident.cityTown} 
                                  onChange={e => setNewResident({...newResident, cityTown: e.target.value})} 
                                  placeholder="Enter city/town"
                                />
                              </div>
                              <div className="md:col-span-2">
                                    <Label>House Number/Street/Subdivision (Optional)</Label>
                                <Input 
                                      value={newResident.houseNumberStreetSubdivision} 
                                      onChange={e => setNewResident({...newResident, houseNumberStreetSubdivision: e.target.value})} 
                                      placeholder="Enter house number, street, or subdivision"
                                />
                              </div>
                                  <div className="md:col-span-2 relative">
                                    <Label>Barangay</Label>
                                <Input 
                                      value={newResident.barangay} 
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setNewResident({...newResident, barangay: value});
                                        if (value.trim() === "") {
                                          setBarangaySuggestions([]);
                                          setShowBarangaySuggestions(false);
                                        } else {
                                          const filtered = barangayOptions.filter(option =>
                                            option.toLowerCase().includes(value.toLowerCase())
                                          );
                                          setBarangaySuggestions(filtered);
                                          setShowBarangaySuggestions(filtered.length > 0);
                                        }
                                      }}
                                      onFocus={(e) => {
                                        if (e.target.value.trim() !== "") {
                                          const filtered = barangayOptions.filter(option =>
                                            option.toLowerCase().includes(e.target.value.toLowerCase())
                                          );
                                          setBarangaySuggestions(filtered);
                                          setShowBarangaySuggestions(filtered.length > 0);
                                        }
                                      }}
                                      onBlur={() => {
                                        // Delay hiding suggestions to allow click events
                                        setTimeout(() => setShowBarangaySuggestions(false), 200);
                                      }}
                                      placeholder="Type to search barangay"
                                    />
                                    {showBarangaySuggestions && barangaySuggestions.length > 0 && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                        {barangaySuggestions.map((barangay, index) => (
                                          <button
                                            key={index}
                                            type="button"
                                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                            onClick={() => {
                                              setNewResident({...newResident, barangay});
                                              setBarangaySuggestions([]);
                                              setShowBarangaySuggestions(false);
                                            }}
                                          >
                                            {barangay}
                                          </button>
                                        ))}
                              </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Step 4: Profile Picture */}
                            {residentFormStep === 4 && (
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                  IV. Profile Picture
                                </h3>
                              <div>
                                  <Label className="text-base font-medium mb-4 block text-center">Profile Picture</Label>
                                </div>
                                <div className="flex flex-col items-center justify-center py-8">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (!file.type.startsWith('image/')) {
                                          toast({
                                            title: 'Invalid file type',
                                            description: 'Please upload an image file',
                                            variant: 'destructive'
                                          });
                                          return;
                                        }
                                        if (file.size > 5 * 1024 * 1024) {
                                          toast({
                                            title: 'File too large',
                                            description: 'Please upload an image smaller than 5MB',
                                            variant: 'destructive'
                                          });
                                          return;
                                        }
                                        try {
                                          // Use temporary ID based on email or timestamp
                                          const tempUserId = newResident.email || `temp-${Date.now()}`;
                                          const result = await uploadProfilePicture(file, tempUserId);
                                          setNewResident({ ...newResident, profilePicture: result.url });
                                          toast({
                                            title: 'Success',
                                            description: 'Profile picture uploaded successfully'
                                          });
                                        } catch (error: any) {
                                          console.error('Error uploading profile picture:', error);
                                          toast({
                                            title: 'Upload failed',
                                            description: error.message || 'Failed to upload profile picture. Please try again.',
                                            variant: 'destructive'
                                          });
                                        }
                                      }
                                    }}
                                    className="hidden"
                                    id="resident-profile-picture-upload"
                                  />
                                  {newResident.profilePicture ? (
                                    <div className="relative">
                                      <img
                                        src={newResident.profilePicture}
                                        alt="Profile preview"
                                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setNewResident({ ...newResident, profilePicture: "" })}
                                        className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                      <label
                                        htmlFor="resident-profile-picture-upload"
                                        className="absolute bottom-0 left-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg"
                                      >
                                        <Camera className="h-4 w-4" />
                                      </label>
                              </div>
                                  ) : (
                                    <label
                                      htmlFor="resident-profile-picture-upload"
                                      className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-orange transition-colors relative"
                                    >
                                      <User className="h-12 w-12 text-gray-400" />
                                      <div className="absolute bottom-0 left-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full shadow-lg">
                                        <Camera className="h-4 w-4" />
                                      </div>
                                    </label>
                                  )}
                                  <p className="text-xs text-gray-500 mt-4 text-center">
                                    Upload a profile picture (max 5MB, JPG/PNG)
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Step 5: Valid ID */}
                            {residentFormStep === 5 && (
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                                  V. Valid ID
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                  <div>
                                    <Label>Valid ID Type</Label>
                                    <Select value={newResident.validIdType} onValueChange={value => setNewResident({ ...newResident, validIdType: value })}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select valid ID type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="National ID">National ID</SelectItem>
                                        <SelectItem value="Driver's License">Driver's License</SelectItem>
                                        <SelectItem value="Passport">Passport</SelectItem>
                                        <SelectItem value="UMID">UMID</SelectItem>
                                        <SelectItem value="SSS">SSS</SelectItem>
                                        <SelectItem value="PhilHealth">PhilHealth</SelectItem>
                                        <SelectItem value="Voter's ID">Voter's ID</SelectItem>
                                        <SelectItem value="Postal ID">Postal ID</SelectItem>
                                        <SelectItem value="Student ID">Student ID</SelectItem>
                                        <SelectItem value="Others">Others</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <div className="flex flex-col items-center justify-center pt-2 pb-8 w-full">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (!file.type.startsWith('image/')) {
                                              toast({
                                                title: 'Invalid file type',
                                                description: 'Please upload an image file',
                                                variant: 'destructive'
                                              });
                                              return;
                                            }
                                            if (file.size > 5 * 1024 * 1024) {
                                              toast({
                                                title: 'File too large',
                                                description: 'Please upload an image smaller than 5MB',
                                                variant: 'destructive'
                                              });
                                              return;
                                            }
                                            try {
                                              // Use temporary ID based on email or timestamp
                                              const tempUserId = newResident.email || `temp-${Date.now()}`;
                                              const result = await uploadValidIdImage(file, tempUserId);
                                              setNewResident({ ...newResident, validIdImage: result.url, validIdUrl: result.url });
                                              toast({
                                                title: 'Success',
                                                description: 'Valid ID image uploaded successfully'
                                              });
                                            } catch (error: any) {
                                              console.error('Error uploading valid ID image:', error);
                                              toast({
                                                title: 'Upload failed',
                                                description: error.message || 'Failed to upload valid ID image. Please try again.',
                                                variant: 'destructive'
                                              });
                                            }
                                          }
                                        }}
                                        className="hidden"
                                        id="resident-valid-id-upload"
                                      />
                                      {newResident.validIdImage ? (
                                        <div className="relative w-full max-w-2xl">
                                          <img
                                            src={newResident.validIdImage}
                                            alt="Valid ID preview"
                                            className="w-full h-auto max-h-96 rounded-lg object-contain border-4 border-gray-200 shadow-lg"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setNewResident({ ...newResident, validIdImage: "", validIdUrl: "" })}
                                            className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                          <label
                                            htmlFor="resident-valid-id-upload"
                                            className="absolute bottom-0 left-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg"
                                          >
                                            <Camera className="h-4 w-4" />
                                          </label>
                              </div>
                                      ) : (
                                        <label
                                          htmlFor="resident-valid-id-upload"
                                          className="w-full max-w-2xl h-48 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-orange transition-colors relative"
                                        >
                                          <div className="flex flex-col items-center">
                                            <Upload className="h-12 w-12 text-gray-400 mb-2" />
                                            <span className="text-sm text-gray-500 text-center px-2">Upload Valid ID</span>
                            </div>
                                        </label>
                                      )}
                                      <p className="text-xs text-gray-500 mt-4 text-center">
                                        Upload a valid ID image (max 5MB, JPG/PNG)
                                      </p>
                          </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <DialogFooter>
                            <div className="flex items-center justify-between w-full">
                              <div>
                                {residentFormStep > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setResidentFormStep(residentFormStep - 1)}
                                  >
                                    Previous
                                  </Button>
                                )}
                              </div>
                              <div>
                                {residentFormStep < 5 ? (
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setResidentFormStep(residentFormStep + 1);
                                    }}
                                    className="bg-brand-orange hover:bg-brand-orange-400 text-white"
                                  >
                                    Next
                                  </Button>
                                ) : (
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
                                )}
                              </div>
                            </div>
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

                    <DateRangePicker
                      value={residentDateRange}
                      onChange={setResidentDateRange}
                    className="w-auto"
                    />

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

                      {canDeleteResidents() ? (
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
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled
                                className="bg-brand-red hover:bg-brand-red-700 text-white opacity-50 cursor-not-allowed"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete ({selectedResidents.length})
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>You don't have permission to delete resident accounts. Contact your super admin for access.</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportResidentsToCSV}
                        className="ml-auto flex items-center gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download resident accounts as CSV</p>
                    </TooltipContent>
                  </Tooltip>
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
                          </TableRow>
                        ))
                      ) : pagedResidents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-8">
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
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreviewResident(resident)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canChangeResidentStatus() ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={resident.suspended ? "text-gray-400" : resident.verified ? "text-green-600" : "text-yellow-600"}
                                      title="Account Status"
                                    >
                                      {resident.suspended ? <ShieldOff className="h-4 w-4" /> : resident.verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          await updateDoc(doc(db, "users", resident.id), {
                                            verified: true,
                                            suspended: false
                                          });
                                          setResidents(residents.map(r => r.id === resident.id ? { ...r, verified: true, suspended: false } : r));
                                          
                                          // Log activity
                                          await logActivity({
                                            actionType: ActionType.RESIDENT_VERIFIED,
                                            action: formatLogMessage('Verified', 'resident account', resident.fullName, resident.userId || resident.id),
                                            entityType: 'resident',
                                            entityId: resident.id,
                                            entityName: resident.fullName,
                                            changes: {
                                              verified: { from: false, to: true },
                                              suspended: { from: resident.suspended || false, to: false }
                                            }
                                          });
                                          
                                          toast({
                                            title: 'Success',
                                            description: 'Resident account verified'
                                          });
                                        } catch (error) {
                                          console.error("Error updating verification:", error);
                                          toast({
                                            title: 'Error',
                                            description: 'Failed to update status. Please try again.',
                                            variant: 'destructive'
                                          });
                                        }
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <ShieldCheck className="h-4 w-4 mr-2 text-green-600" />
                                      Verify
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          await updateDoc(doc(db, "users", resident.id), {
                                            verified: false,
                                            suspended: false
                                          });
                                          setResidents(residents.map(r => r.id === resident.id ? { ...r, verified: false, suspended: false } : r));
                                          
                                          // Log activity
                                          await logActivity({
                                            actionType: ActionType.RESIDENT_UNVERIFIED,
                                            action: formatLogMessage('Unverified', 'resident account', resident.fullName, resident.userId || resident.id),
                                            entityType: 'resident',
                                            entityId: resident.id,
                                            entityName: resident.fullName,
                                            changes: {
                                              verified: { from: true, to: false },
                                              suspended: { from: resident.suspended || false, to: false }
                                            }
                                          });
                                          
                                          toast({
                                            title: 'Success',
                                            description: 'Verification revoked'
                                          });
                                        } catch (error) {
                                          console.error("Error updating verification:", error);
                                          toast({
                                            title: 'Error',
                                            description: 'Failed to update status. Please try again.',
                                            variant: 'destructive'
                                          });
                                        }
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <ShieldX className="h-4 w-4 mr-2 text-yellow-600" />
                                      Unverify
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setConfirmSuspendResident(resident)}
                                      className="cursor-pointer"
                                    >
                                      <ShieldOff className="h-4 w-4 mr-2 text-gray-600" />
                                      Suspend
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className={cn(
                                            "opacity-50 cursor-not-allowed",
                                            resident.suspended ? "text-gray-400" : resident.verified ? "text-green-600" : "text-yellow-600"
                                          )}
                                        >
                                          {resident.suspended ? <ShieldOff className="h-4 w-4" /> : resident.verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>You don't have permission to change resident account status. Contact your super admin for access.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {canDeleteResidents() ? (
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
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button size="sm" variant="outline" disabled className="text-red-600 opacity-50 cursor-not-allowed">
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>You don't have permission to delete resident accounts. Contact your super admin for access.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
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
        <Dialog open={showResidentPreview} onOpenChange={(open) => {
          setShowResidentPreview(open);
          if (!open) {
            setIsEditingResidentPreview(false);
            setPreviewBirthdayInput("");
          }
        }}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader className="border-b border-gray-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-brand-orange/10 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-brand-orange" />
                </div>
                <DialogTitle>Resident Details</DialogTitle>
              </div>
            </DialogHeader>
            
            {/* Profile Picture at the top - large and clickable */}
            {activeResidentTab === 'profile' && (
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  {selectedResident?.profilePicture ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(selectedResident.profilePicture)}
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
                      
                      {/* Status Badge */}
                      {!isEditingResidentPreview && (
                        <div className="absolute bottom-0 right-0 h-8 w-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                          style={{
                            backgroundColor: selectedResident?.suspended ? '#ef4444' : 
                                           selectedResident?.verified ? '#10b981' : 
                                           '#eab308'
                          }}
                        >
                          {selectedResident?.suspended ? (
                            <ShieldOff className="h-4 w-4 text-white" />
                          ) : selectedResident?.verified ? (
                            <ShieldCheck className="h-4 w-4 text-white" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-white" />
                          )}
                        </div>
                      )}
                    </button>
                  ) : (
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200 shadow-lg">
                        <User className="h-16 w-16 text-gray-400" />
                      </div>
                      
                      {/* Status Badge */}
                      {!isEditingResidentPreview && (
                        <div className="absolute bottom-0 right-0 h-8 w-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                          style={{
                            backgroundColor: selectedResident?.suspended ? '#ef4444' : 
                                           selectedResident?.verified ? '#10b981' : 
                                           '#eab308'
                          }}
                        >
                          {selectedResident?.suspended ? (
                            <ShieldOff className="h-4 w-4 text-white" />
                          ) : selectedResident?.verified ? (
                            <ShieldCheck className="h-4 w-4 text-white" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-white" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Camera Icon Overlay - only show in edit mode */}
                  {isEditingResidentPreview && (
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 h-8 w-8 bg-brand-orange hover:bg-brand-orange-400 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                      title="Change Profile Picture"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {/* Edit Button - only show in view profile tab and not in edit mode */}
                {!isEditingResidentPreview && (
                  canEditResidents() ? (
                  <Button
                    onClick={() => setIsEditingResidentPreview(true)}
                    className="mt-4"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            disabled
                            className="mt-4 opacity-50 cursor-not-allowed"
                            variant="outline"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Profile
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>You don't have permission to edit resident accounts. Contact your super admin for access.</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                )}
              </div>
            )}
            
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
                    <TableCell className="font-medium text-gray-700 align-top">Created Date</TableCell>
                    <TableCell>
                      {selectedResident?.createdDate}
                      {selectedResident?.createdTime && (
                        <><br /><span className="text-xs text-gray-500">{formatTimeNoSeconds(selectedResident.createdTime)}</span></>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Full Name</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Input 
                          value={selectedResident?.fullName || ''} 
                          onChange={e => setSelectedResident({
                            ...selectedResident,
                            fullName: e.target.value
                          })}
                          className="border-gray-300"
                        />
                      ) : (
                        <span>{selectedResident?.fullName || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Phone Number</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Input 
                          value={selectedResident?.phoneNumber || ''} 
                          onChange={e => setSelectedResident({
                            ...selectedResident,
                            phoneNumber: e.target.value
                          })}
                          className="border-gray-300"
                        />
                      ) : (
                        <span>{selectedResident?.phoneNumber || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Email</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Input 
                          value={selectedResident?.email || ''} 
                          onChange={e => setSelectedResident({
                            ...selectedResident,
                            email: e.target.value
                          })}
                          className="border-gray-300"
                          type="email"
                        />
                      ) : (
                        <span>{selectedResident?.email || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">House Number/Street/Subdivision</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Input 
                          value={selectedResident?.houseNumberStreetSubdivision || ''} 
                          onChange={e => setSelectedResident({
                            ...selectedResident,
                            houseNumberStreetSubdivision: e.target.value
                          })}
                          className="border-gray-300"
                          placeholder="Optional"
                        />
                      ) : (
                        <span>{selectedResident?.houseNumberStreetSubdivision || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Province</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Input 
                          value={selectedResident?.province || ''} 
                          onChange={e => setSelectedResident({
                            ...selectedResident,
                            province: e.target.value
                          })}
                          className="border-gray-300"
                        />
                      ) : (
                        <span>{selectedResident?.province || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">City/Town</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Input 
                          value={selectedResident?.cityTown || ''} 
                          onChange={e => setSelectedResident({
                            ...selectedResident,
                            cityTown: e.target.value
                          })}
                          className="border-gray-300"
                        />
                      ) : (
                        <span>{selectedResident?.cityTown || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Barangay</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <div className="relative">
                          <Input 
                            value={selectedResident?.barangay || ''} 
                            onChange={(e) => {
                              const value = e.target.value;
                              setSelectedResident({...selectedResident, barangay: value});
                              if (value.trim() === "") {
                                setBarangaySuggestions([]);
                                setShowBarangaySuggestions(false);
                              } else {
                                const filtered = barangayOptions.filter(option =>
                                  option.toLowerCase().includes(value.toLowerCase())
                                );
                                setBarangaySuggestions(filtered);
                                setShowBarangaySuggestions(filtered.length > 0);
                              }
                            }}
                            onFocus={(e) => {
                              if (e.target.value.trim() !== "") {
                                const filtered = barangayOptions.filter(option =>
                                  option.toLowerCase().includes(e.target.value.toLowerCase())
                                );
                                setBarangaySuggestions(filtered);
                                setShowBarangaySuggestions(filtered.length > 0);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowBarangaySuggestions(false), 200);
                            }}
                            className="border-gray-300"
                            placeholder="Type to search barangay"
                          />
                          {showBarangaySuggestions && barangaySuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                              {barangaySuggestions.map((barangay, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                  onClick={() => {
                                    setSelectedResident({...selectedResident, barangay});
                                    setBarangaySuggestions([]);
                                    setShowBarangaySuggestions(false);
                                  }}
                                >
                                  {barangay}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span>{selectedResident?.barangay || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Birthday</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Popover>
                          <div className="relative">
                        <Input 
                              placeholder="MM/DD/YYYY"
                              value={previewBirthdayInput || (selectedResident?.birthday ? formatToMMDDYYYY(selectedResident.birthday) : "")}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                setPreviewBirthdayInput(inputValue);
                                
                                // Parse MM/DD/YYYY format
                                const parsed = parseMMDDYYYY(inputValue);
                                if (parsed && parsed !== inputValue) {
                                  // Successfully parsed, update the birthday
                                  setSelectedResident({
                            ...selectedResident,
                                    birthday: parsed
                                  });
                                } else if (!inputValue) {
                                  // Empty input, clear birthday
                                  setSelectedResident({
                                    ...selectedResident,
                                    birthday: ""
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                // On blur, try to parse and format the input
                                const parsed = parseMMDDYYYY(e.target.value);
                                if (parsed && parsed !== e.target.value) {
                                  setPreviewBirthdayInput(formatToMMDDYYYY(parsed));
                                  setSelectedResident({
                                    ...selectedResident,
                                    birthday: parsed
                                  });
                                } else if (e.target.value && !selectedResident?.birthday) {
                                  // Invalid format, show error
                                  toast({
                                    title: 'Invalid Date Format',
                                    description: 'Please enter date in MM/DD/YYYY format (e.g., 01/15/1990)',
                                    variant: 'destructive'
                                  });
                                }
                              }}
                              className="pr-10 border-gray-300"
                            />
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              >
                                <CalendarIcon className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                          </div>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedResident?.birthday ? new Date(selectedResident.birthday) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const formatted = format(date, "yyyy-MM-dd");
                                  const displayFormat = formatToMMDDYYYY(formatted);
                                  setSelectedResident({
                                    ...selectedResident,
                                    birthday: formatted
                                  });
                                  setPreviewBirthdayInput(displayFormat);
                                } else {
                                  setSelectedResident({
                                    ...selectedResident,
                                    birthday: ""
                                  });
                                  setPreviewBirthdayInput("");
                                }
                              }}
                              initialFocus
                              captionLayout="dropdown"
                              fromYear={1900}
                              toYear={new Date().getFullYear()}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span>{selectedResident?.birthday ? format(new Date(selectedResident.birthday), "PPP") : '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Gender</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Select 
                          value={selectedResident?.gender || ''} 
                          onValueChange={value => setSelectedResident({
                            ...selectedResident,
                            gender: value
                          })}
                        >
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                            <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{selectedResident?.gender || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Civil Status</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Select 
                          value={selectedResident?.civil_status || selectedResident?.civilStatus || ''} 
                          onValueChange={value => setSelectedResident({
                            ...selectedResident,
                            civil_status: value,
                            civilStatus: value
                          })}
                        >
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="Select civil status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Single">Single</SelectItem>
                            <SelectItem value="Married">Married</SelectItem>
                            <SelectItem value="Divorced">Divorced</SelectItem>
                            <SelectItem value="Widowed">Widowed</SelectItem>
                            <SelectItem value="Separated">Separated</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{selectedResident?.civil_status || selectedResident?.civilStatus || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Religion</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Select 
                          value={selectedResident?.religion || ''} 
                          onValueChange={value => setSelectedResident({
                            ...selectedResident,
                            religion: value
                          })}
                        >
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="Select religion" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Roman Catholic">Roman Catholic</SelectItem>
                            <SelectItem value="Christian">Christian</SelectItem>
                            <SelectItem value="Iglesia ni Christo">Iglesia ni Christo</SelectItem>
                            <SelectItem value="Islam">Islam</SelectItem>
                            <SelectItem value="Buddhism">Buddhism</SelectItem>
                            <SelectItem value="Hinduism">Hinduism</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{selectedResident?.religion || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Blood Type</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <Select 
                          value={selectedResident?.blood_type || selectedResident?.bloodType || ''} 
                          onValueChange={value => setSelectedResident({
                            ...selectedResident,
                            blood_type: value,
                            bloodType: value
                          })}
                        >
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="Select blood type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem>
                            <SelectItem value="AB-">AB-</SelectItem>
                            <SelectItem value="O+">O+</SelectItem>
                            <SelectItem value="O-">O-</SelectItem>
                            <SelectItem value="Unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{selectedResident?.blood_type || selectedResident?.bloodType || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">PWD Status</TableCell>
                    <TableCell>
                      {isEditingResidentPreview ? (
                        <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
                          <button
                            type="button"
                            className={cn(
                              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                              (selectedResident?.pwd === true || selectedResident?.pwd === 'Yes' || selectedResident?.pwdStatus === 'Yes' || selectedResident?.isPWD)
                                ? "bg-brand-orange text-white shadow-sm"
                                : "text-gray-600 hover:bg-gray-50"
                            )}
                            onClick={() => {
                              setSelectedResident({
                            ...selectedResident,
                                pwd: true,
                                pwdStatus: 'Yes',
                                isPWD: true
                              });
                            }}
                        >
                            Yes
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                              !(selectedResident?.pwd === true || selectedResident?.pwd === 'Yes' || selectedResident?.pwdStatus === 'Yes' || selectedResident?.isPWD)
                                ? "bg-brand-orange text-white shadow-sm"
                                : "text-gray-600 hover:bg-gray-50"
                            )}
                            onClick={() => {
                              setSelectedResident({
                                ...selectedResident,
                                pwd: false,
                                pwdStatus: 'No',
                                isPWD: false
                              });
                            }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <span>{selectedResident?.pwd === true || selectedResident?.pwd === 'Yes' || selectedResident?.pwdStatus === 'Yes' || selectedResident?.isPWD ? 'Yes' : selectedResident?.pwd === false || selectedResident?.pwd === 'No' || selectedResident?.pwdStatus === 'No' ? 'No' : '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-700 align-top">Valid ID</TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        <div className="mb-2">
                          {isEditingResidentPreview ? (
                            <Select 
                              value={selectedResident?.validIdType || selectedResident?.validId || ''} 
                              onValueChange={value => setSelectedResident({
                                ...selectedResident,
                                validIdType: value,
                                validId: value
                              })}
                            >
                              <SelectTrigger className="border-gray-300">
                                <SelectValue placeholder="Select valid ID type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="National ID">National ID</SelectItem>
                                <SelectItem value="Driver's License">Driver's License</SelectItem>
                                <SelectItem value="Passport">Passport</SelectItem>
                                <SelectItem value="UMID">UMID</SelectItem>
                                <SelectItem value="SSS">SSS</SelectItem>
                                <SelectItem value="PhilHealth">PhilHealth</SelectItem>
                                <SelectItem value="Voter's ID">Voter's ID</SelectItem>
                                <SelectItem value="Postal ID">Postal ID</SelectItem>
                                <SelectItem value="Student ID">Student ID</SelectItem>
                                <SelectItem value="Others">Others</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-gray-600">{selectedResident?.validIdType || selectedResident?.validId || 'No ID type specified'}</span>
                          )}
                        </div>
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
                              
                              {/* Delete button - only show in edit mode */}
                              {isEditingResidentPreview && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(true)}
                                  className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                          {(!selectedResident?.validIdUrl && !selectedResident?.validIdImage) && (
                            <span className="text-sm text-gray-400 italic">No ID image uploaded</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
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
                    {/* Total Reports Summary */}
                    <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Total Reports Submitted</p>
                          <p className="text-2xl font-bold text-brand-orange mt-1">{residentReports.length}</p>
                        </div>
                        <FileText className="h-8 w-8 text-brand-orange/50" />
                      </div>
                    </div>

                    {/* Reports Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>RID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {residentReports.map((report) => {
                            const reportDate = report.timestamp?.toDate 
                              ? report.timestamp.toDate() 
                              : report.timestamp 
                                ? new Date(report.timestamp) 
                                : null;
                            const formattedDate = reportDate 
                              ? reportDate.toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })
                              : 'Unknown Date';
                            
                            return (
                              <TableRow key={report.id}>
                                <TableCell>
                                  <button
                                    onClick={() => {
                                      navigate('/manage-reports', { 
                                        state: { highlightReportId: report.id } 
                                      });
                                    }}
                                    className="text-brand-orange hover:text-brand-orange-400 hover:underline font-medium transition-colors"
                                  >
                                    {report.reportId || report.id}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <Badge className={
                                    report.hazardType === 'Fire' ? 'bg-red-100 text-red-800 hover:bg-red-50' :
                                    report.hazardType === 'Flood' ? 'bg-blue-100 text-blue-800 hover:bg-blue-50' :
                                    report.hazardType === 'Earthquake' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-50' :
                                    report.hazardType === 'Landslide' ? 'bg-orange-100 text-orange-800 hover:bg-orange-50' :
                                    report.hazardType === 'Typhoon' ? 'bg-purple-100 text-purple-800 hover:bg-purple-50' :
                                    'bg-gray-100 text-gray-800 hover:bg-gray-50'
                                  }>
                                    {report.hazardType || report.type || 'Unknown'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formattedDate}</TableCell>
                                <TableCell>
                                  <Badge className={
                                    report.status === 'Resolved' ? 'bg-green-100 text-green-800 hover:bg-green-50' :
                                    report.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-50' :
                                    report.status === 'Pending' ? 'bg-gray-100 text-gray-800 hover:bg-gray-50' :
                                    'bg-gray-100 text-gray-800 hover:bg-gray-50'
                                  }>
                                    {report.status || 'Pending'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isEditingResidentPreview && activeResidentTab === 'profile' && (
              <DialogFooter>
                <Button
                  onClick={async () => {
                    await handleSaveResidentEdit();
                    setIsEditingResidentPreview(false);
                  }}
                  className="bg-brand-orange hover:bg-brand-orange-400 text-white"
                >
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditingResidentPreview(false);
                    setPreviewBirthdayInput(selectedResident?.birthday ? formatToMMDDYYYY(selectedResident.birthday) : "");
                  }}
                >
                  Cancel
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Admin Preview Modal */}
        <Dialog open={showAdminPreview} onOpenChange={setShowAdminPreview}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-brand-orange" />
                </div>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  Admin Account Details
                </DialogTitle>
              </div>
            </DialogHeader>
            
            {/* Profile Picture at the top */}
            <div className="flex flex-col items-center py-4">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && isEditingPreviewAdmin) {
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
                        // Use admin's userId or email as identifier
                        const userId = editingPreviewAdmin.userId || editingPreviewAdmin.email || `admin-${editingPreviewAdmin.id}`;
                        const result = await uploadProfilePicture(file, userId);
                        setEditingPreviewAdmin({ ...editingPreviewAdmin, profilePicture: result.url });
                        toast({
                          title: 'Success',
                          description: 'Profile picture uploaded successfully'
                        });
                      } catch (error: any) {
                        console.error('Error uploading profile picture:', error);
                        toast({
                          title: 'Upload failed',
                          description: error.message || 'Failed to upload profile picture. Please try again.',
                          variant: 'destructive'
                        });
                      }
                    }
                  }}
                  className="hidden"
                  id="preview-admin-profile-picture-upload"
                  disabled={!isEditingPreviewAdmin}
                />
                {editingPreviewAdmin?.profilePicture ? (
                  <button
                    type="button"
                    onClick={() => !isEditingPreviewAdmin && setPreviewImage(editingPreviewAdmin.profilePicture)}
                    className="focus:outline-none group relative"
                    title={isEditingPreviewAdmin ? "Click camera to change" : "Click to view full size"}
                  >
                    <img 
                      src={editingPreviewAdmin.profilePicture} 
                      alt="Profile" 
                      className="w-40 h-40 rounded-full object-cover border-4 border-gray-200 group-hover:border-brand-orange shadow-lg group-hover:shadow-xl transition-all duration-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = 'w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200';
                          fallback.innerHTML = '<svg class="h-20 w-20 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    {!isEditingPreviewAdmin && (
                      <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    )}
                    {isEditingPreviewAdmin && (
                      <label
                        htmlFor="preview-admin-profile-picture-upload"
                        className="absolute bottom-0 right-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg z-10"
                      >
                        <Camera className="h-4 w-4" />
                      </label>
                    )}
                    {/* Edit Permission Badge Icon */}
                    {previewAdmin && !isEditingPreviewAdmin && (
                      <div className={`absolute bottom-0 right-0 rounded-full p-2 shadow-lg ${
                        (editingPreviewAdmin?.hasEditPermission ?? previewAdmin.hasEditPermission)
                          ? 'bg-green-100 hover:bg-green-50'
                          : 'bg-gray-100 hover:bg-gray-50'
                      } transition-colors`}>
                        <Shield className={`h-4 w-4 ${
                          (editingPreviewAdmin?.hasEditPermission ?? previewAdmin.hasEditPermission)
                            ? 'text-green-800'
                            : 'text-gray-800'
                        }`} />
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200 shadow-lg relative">
                    <User className="h-20 w-20 text-gray-400" />
                    {isEditingPreviewAdmin && (
                      <label
                        htmlFor="preview-admin-profile-picture-upload"
                        className="absolute bottom-0 right-0 bg-brand-orange hover:bg-brand-orange/90 text-white p-2 rounded-full cursor-pointer shadow-lg z-10"
                      >
                        <Camera className="h-4 w-4" />
                      </label>
                    )}
                    {/* Edit Permission Badge Icon */}
                    {previewAdmin && !isEditingPreviewAdmin && (
                      <div className={`absolute bottom-0 right-0 rounded-full p-2 shadow-lg ${
                        (editingPreviewAdmin?.hasEditPermission ?? previewAdmin.hasEditPermission)
                          ? 'bg-green-100 hover:bg-green-50'
                          : 'bg-gray-100 hover:bg-gray-50'
                      } transition-colors`}>
                        <Shield className={`h-4 w-4 ${
                          (editingPreviewAdmin?.hasEditPermission ?? previewAdmin.hasEditPermission)
                            ? 'text-green-800'
                            : 'text-gray-800'
                        }`} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Button */}
            {previewAdmin && !isEditingPreviewAdmin && (
              <div className="flex justify-center mb-2 px-6">
                <Button
                  variant="outline"
                  onClick={() => setIsEditingPreviewAdmin(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Admin
                </Button>
              </div>
            )}
            
            {/* Admin Information Table */}
            {previewAdmin && (
              <div className="px-6">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">User ID</TableCell>
                      <TableCell>{editingPreviewAdmin?.userId || previewAdmin.userId || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Created Date</TableCell>
                      <TableCell>
                        {editingPreviewAdmin?.createdDate || previewAdmin.createdDate || 'N/A'}
                        {(editingPreviewAdmin?.createdTime || previewAdmin.createdTime) && (
                          <><br /><span className="text-xs text-gray-500">{formatTimeNoSeconds(editingPreviewAdmin?.createdTime || previewAdmin.createdTime)}</span></>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Role</TableCell>
                      <TableCell>{editingPreviewAdmin?.role || previewAdmin.role || 'admin'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Full Name</TableCell>
                      <TableCell>
                        {isEditingPreviewAdmin ? (
                          <Input
                            value={editingPreviewAdmin?.name || ''}
                            onChange={e => setEditingPreviewAdmin({ ...editingPreviewAdmin, name: e.target.value })}
                            className="w-full"
                          />
                        ) : (
                          editingPreviewAdmin?.name || previewAdmin.name || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Username</TableCell>
                      <TableCell>
                        {isEditingPreviewAdmin ? (
                          <Input
                            value={editingPreviewAdmin?.username || ''}
                            onChange={e => setEditingPreviewAdmin({ ...editingPreviewAdmin, username: e.target.value })}
                            className="w-full"
                          />
                        ) : (
                          editingPreviewAdmin?.username || previewAdmin.username || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Position</TableCell>
                      <TableCell>
                        {isEditingPreviewAdmin ? (
                          <Select
                            value={editingPreviewAdmin?.position || ''}
                            onValueChange={value => setEditingPreviewAdmin({ ...editingPreviewAdmin, position: value })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              {positionOptions.map(pos => (
                                <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          editingPreviewAdmin?.position || previewAdmin.position || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">ID Number</TableCell>
                      <TableCell>
                        {isEditingPreviewAdmin ? (
                          <Input
                            value={editingPreviewAdmin?.idNumber || ''}
                            onChange={e => setEditingPreviewAdmin({ ...editingPreviewAdmin, idNumber: e.target.value })}
                            className="w-full"
                            placeholder="EMP"
                          />
                        ) : (
                          editingPreviewAdmin?.idNumber || previewAdmin.idNumber || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Email</TableCell>
                      <TableCell>
                        {isEditingPreviewAdmin ? (
                          <Input
                            type="email"
                            value={editingPreviewAdmin?.email || ''}
                            onChange={e => setEditingPreviewAdmin({ ...editingPreviewAdmin, email: e.target.value })}
                            className="w-full"
                          />
                        ) : (
                          editingPreviewAdmin?.email || previewAdmin.email || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Password</TableCell>
                      <TableCell>
                        {isEditingPreviewAdmin ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type={showAllAdminPasswords ? "text" : "password"}
                              value={editingPreviewAdmin?.password || ''}
                              onChange={e => setEditingPreviewAdmin({ ...editingPreviewAdmin, password: e.target.value })}
                              className="w-full"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowAllAdminPasswords(v => !v)}
                            >
                              {showAllAdminPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        ) : (
                          <>
                            {showAllAdminPasswords ? (
                              <span>{editingPreviewAdmin?.password || previewAdmin.password || 'N/A'}</span>
                            ) : (
                              <span>{'•'.repeat(Math.max(8, ((editingPreviewAdmin?.password || previewAdmin.password || '').length)))}</span>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowAllAdminPasswords(v => !v)}
                              className="ml-2"
                            >
                              {showAllAdminPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            {isEditingPreviewAdmin && (
              <DialogFooter className="px-6 pb-6">
                <Button
                  variant="outline"
                  onClick={handleCancelPreviewEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePreviewAdminEdit}
                  className="bg-brand-orange hover:bg-brand-orange-400 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img src={previewImage || ""} alt="Preview" className="max-w-full h-auto rounded-lg" />
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

        {/* Suspend Account Confirmation Modal */}
        <AlertDialog open={!!confirmSuspendResident} onOpenChange={() => {
          setConfirmSuspendResident(null);
          setSuspensionReason("");
        }}>
          <AlertDialogContent className="sm:max-w-[500px]">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <ShieldOff className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <AlertDialogTitle className="text-gray-800">Suspend Resident Account</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-600">
                    Are you sure you want to suspend {confirmSuspendResident?.fullName}'s account? Suspended accounts will be unable to log in to the mobile app. This action can be reversed later.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="suspension-reason" className="text-sm font-medium text-gray-700">
                  Reason for Suspension <span className="text-gray-400">(Optional)</span>
                </label>
                <Textarea
                  id="suspension-reason"
                  placeholder="Enter the reason for suspending this account..."
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="min-h-[100px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500">
                  {suspensionReason.length}/500 characters
                </p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setSuspensionReason("");
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!confirmSuspendResident) return;
                  try {
                    const updateData: any = {
                      suspended: true,
                      verified: false
                    };
                    if (suspensionReason.trim()) {
                      updateData.suspensionReason = suspensionReason.trim();
                      updateData.suspensionDate = new Date().toISOString();
                    }
                    await updateDoc(doc(db, "users", confirmSuspendResident.id), updateData);
                    setResidents(residents.map(r => r.id === confirmSuspendResident.id ? { ...r, suspended: true, verified: false, suspensionReason: suspensionReason.trim() || undefined } : r));
                    
                    // Log activity
                    await logActivity({
                      actionType: ActionType.RESIDENT_SUSPENDED,
                      action: formatLogMessage('Suspended', 'resident account', confirmSuspendResident.fullName, confirmSuspendResident.userId || confirmSuspendResident.id),
                      entityType: 'resident',
                      entityId: confirmSuspendResident.id,
                      entityName: confirmSuspendResident.fullName,
                      changes: {
                        suspended: { from: false, to: true },
                        verified: { from: confirmSuspendResident.verified || false, to: false }
                      },
                      metadata: suspensionReason.trim() ? { suspensionReason: suspensionReason.trim() } : undefined
                    });
                    
                    toast({
                      title: 'Success',
                      description: 'Resident account suspended. They will be unable to log in to the mobile app.'
                    });
                    setConfirmSuspendResident(null);
                    setSuspensionReason("");
                  } catch (error) {
                    console.error("Error updating suspension:", error);
                    toast({
                      title: 'Error',
                      description: 'Failed to suspend account. Please try again.',
                      variant: 'destructive'
                    });
                  }
                }}
                className="bg-gray-600 hover:bg-gray-700"
              >
                Suspend Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingAdmin.email || ""}
                    onChange={e => setEditingAdmin({ ...editingAdmin, email: e.target.value })}
                    placeholder="Enter email address"
                  />
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
                    <Select value={selectedResident.validId || selectedResident.validIdType || ''} onValueChange={value => setSelectedResident({
                      ...selectedResident,
                      validId: value,
                      validIdType: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select valid ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="National ID">National ID</SelectItem>
                        <SelectItem value="Driver's License">Driver's License</SelectItem>
                        <SelectItem value="Passport">Passport</SelectItem>
                        <SelectItem value="UMID">UMID</SelectItem>
                        <SelectItem value="SSS">SSS</SelectItem>
                        <SelectItem value="PhilHealth">PhilHealth</SelectItem>
                        <SelectItem value="Voter's ID">Voter's ID</SelectItem>
                        <SelectItem value="Postal ID">Postal ID</SelectItem>
                        <SelectItem value="Student ID">Student ID</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
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