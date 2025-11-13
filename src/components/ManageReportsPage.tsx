import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import { Eye, Edit, Trash2, Plus, FileText, Calendar as CalendarIcon, Clock, MapPin, Upload, FileIcon, Image, Printer, Download, X, Search, FileDown, Car, Flame, Ambulance, Waves, Mountain, CircleAlert, Users, ShieldAlert, Activity, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown, Layers, ZoomIn, ZoomOut, LocateFixed, Wrench, AlertTriangle, Zap, Leaf, Check, ChevronDown, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layout } from "./Layout";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn, ensureOk, getHttpStatusMessage } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MapboxMap } from "./MapboxMap";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, getDocs, getDoc, where, updateDoc, doc, serverTimestamp, deleteDoc, addDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";
import { useUserRole } from "@/hooks/useUserRole";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { logActivity, ActionType, formatLogMessage } from "@/lib/activityLogger";

// Helper function to get icon for report type
const getReportTypeIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    'Road Crash': Car,
    'Fire': Flame,
    'Medical Emergency': Ambulance,
    'Flooding': Waves,
    'Volcanic Activity': Mountain,
    'Landslide': Mountain,
    'Earthquake': CircleAlert,
    'Civil Disturbance': Users,
    'Armed Conflict': ShieldAlert,
    'Infectious Disease': Activity,
    'Poor Infrastructure': Wrench,
    'Obstructions': AlertTriangle,
    'Electrical Hazard': Zap,
    'Environmental Hazard': Leaf,
  };
  return iconMap[type] || FileText;
};

const REPORT_TYPE_OPTIONS = [
  { value: 'road-crash', label: 'Road Crash' },
  { value: 'medical-emergency', label: 'Medical Emergency' },
  { value: 'flooding', label: 'Flooding' },
  { value: 'volcanic-activity', label: 'Volcanic Activity' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'civil-disturbance', label: 'Civil Disturbance' },
  { value: 'armed-conflict', label: 'Armed Conflict' },
  { value: 'infectious-disease', label: 'Infectious Disease' },
  { value: 'poor-infrastructure', label: 'Poor Infrastructure' },
  { value: 'obstructions', label: 'Obstructions' },
  { value: 'electrical-hazard', label: 'Electrical Hazard' },
  { value: 'environmental-hazard', label: 'Environmental Hazard' },
  { value: 'others', label: 'Others' },
];

const REPORT_TYPE_LABELS = REPORT_TYPE_OPTIONS.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const renderReportTypeOption = (label: string) => {
  const Icon = getReportTypeIcon(label);
  return (
    <span className="flex items-center gap-2 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange">
      <Icon className="h-4 w-4 text-gray-500 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange" />
      <span>{label}</span>
    </span>
  );
};

type AgencyOption = {
  id: string;
  name: string;
  isLocal?: boolean;
};

type DriverOption = {
  id: string;
  name: string;
  position?: string;
};

type VehicleOption = {
  id: string;
  name: string;
  isLocal?: boolean;
};

const NO_DRIVER_SELECTION = "__no_driver_selection__";
const NO_VEHICLE_SELECTION = "__no_vehicle_selection__";

type DispatchDataState = {
  receivedBy: string;
  timeCallReceived: string;
  timeOfDispatch: string;
  timeOfArrival: string;
  hospitalArrival: string;
  returnedToOpcen: string;
  disasterRelated: string;
  agencyPresent: string[];
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleName: string;
  typeOfEmergency: string;
  vehicleInvolved: string;
  injuryClassification: string;
  majorInjuryTypes: string[];
  minorInjuryTypes: string[];
  medicalClassification: string;
  majorMedicalSymptoms: string[];
  minorMedicalSymptoms: string[];
  chiefComplaint: string;
  diagnosis: string;
  natureOfIllness: string;
  natureOfIllnessOthers: string;
  actionsTaken: string[];
  referredTo: string;
  transportFrom: string;
  transportTo: string;
  othersDescription: string;
  vitalSigns: {
    temperature: string;
    pulseRate: string;
    respiratoryRate: string;
    bloodPressure: string;
  };
  responders: Array<{
    id: string;
    team: string;
    drivers: string[];
    responders: string[];
  }>;
};

const createInitialDispatchState = (): DispatchDataState => ({
  receivedBy: "",
  timeCallReceived: "",
  timeOfDispatch: "",
  timeOfArrival: "",
  hospitalArrival: "",
  returnedToOpcen: "",
  disasterRelated: "",
  agencyPresent: [],
  driverId: "",
  driverName: "",
  vehicleId: "",
  vehicleName: "",
  typeOfEmergency: "",
  vehicleInvolved: "",
  injuryClassification: "",
  majorInjuryTypes: [],
  minorInjuryTypes: [],
  medicalClassification: "",
  majorMedicalSymptoms: [],
  minorMedicalSymptoms: [],
  chiefComplaint: "",
  diagnosis: "",
  natureOfIllness: "",
  natureOfIllnessOthers: "",
  actionsTaken: [],
  referredTo: "",
  transportFrom: "",
  transportTo: "",
  othersDescription: "",
  vitalSigns: {
    temperature: "",
    pulseRate: "",
    respiratoryRate: "",
    bloodPressure: ""
  },
  responders: []
});

const normalizeDispatchData = (data: any): DispatchDataState => {
  const base = createInitialDispatchState();
  if (!data) {
    return base;
  }

  return {
    ...base,
    ...data,
    agencyPresent: Array.isArray(data.agencyPresent)
      ? data.agencyPresent
      : data.agencyPresent
        ? [data.agencyPresent]
        : [],
    driverId: typeof data.driverId === "string" ? data.driverId : "",
    driverName: typeof data.driverName === "string"
      ? data.driverName
      : typeof data.driver === "string"
        ? data.driver
        : "",
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    vehicleName: typeof data.vehicleName === "string"
      ? data.vehicleName
      : typeof data.vehicle === "string"
        ? data.vehicle
        : "",
    majorInjuryTypes: Array.isArray(data.majorInjuryTypes)
      ? data.majorInjuryTypes
      : data.majorInjuryTypes
        ? [data.majorInjuryTypes]
        : [],
    minorInjuryTypes: Array.isArray(data.minorInjuryTypes)
      ? data.minorInjuryTypes
      : data.minorInjuryTypes
        ? [data.minorInjuryTypes]
        : [],
    majorMedicalSymptoms: Array.isArray(data.majorMedicalSymptoms)
      ? data.majorMedicalSymptoms
      : data.majorMedicalSymptoms
        ? [data.majorMedicalSymptoms]
        : [],
    minorMedicalSymptoms: Array.isArray(data.minorMedicalSymptoms)
      ? data.minorMedicalSymptoms
      : data.minorMedicalSymptoms
        ? [data.minorMedicalSymptoms]
        : [],
    actionsTaken: Array.isArray(data.actionsTaken)
      ? data.actionsTaken
      : data.actionsTaken
        ? [data.actionsTaken]
        : [],
    responders: Array.isArray(data.responders) ? data.responders : base.responders,
  };
};

export function ManageReportsPage() {
  const navigate = useNavigate();
  const { canEditReports, canDeleteReports, canAddReportToMap } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [date, setDate] = useState<DateRange | undefined>();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [viewedReports, setViewedReports] = useState<Set<string>>(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem("viewedReports");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  
  // Preview Map (Report Modal - Directions Tab) state
  const [previewMapCenter, setPreviewMapCenter] = useState<[number, number]>([121.5556, 14.1139]);
  const [previewMapZoom, setPreviewMapZoom] = useState(14);
  const [previewSearchQuery, setPreviewSearchQuery] = useState("");
  const [previewSearchSuggestions, setPreviewSearchSuggestions] = useState<any[]>([]);
  const [isPreviewSearchOpen, setIsPreviewSearchOpen] = useState(false);
  const [addLocationSearchQuery, setAddLocationSearchQuery] = useState("");
  const [addLocationSearchSuggestions, setAddLocationSearchSuggestions] = useState<any[]>([]);
  const [isAddLocationSearchOpen, setIsAddLocationSearchOpen] = useState(false);
  const [locationMapSearchQuery, setLocationMapSearchQuery] = useState("");
  const [locationMapSearchSuggestions, setLocationMapSearchSuggestions] = useState<any[]>([]);
  const [isLocationMapSearchOpen, setIsLocationMapSearchOpen] = useState(false);
  
  // Initialize preview map center when a report is selected
  useEffect(() => {
    if (selectedReport && selectedReport.latitude && selectedReport.longitude) {
      const lat = Number(selectedReport.latitude);
      const lng = Number(selectedReport.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        setPreviewMapCenter([lng, lat]);
        setPreviewMapZoom(14);
      }
    }
  }, [selectedReport]);

  // Preview: Locate user helper
  const handlePreviewLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPreviewMapCenter([longitude, latitude]);
          setPreviewMapZoom(15);
        },
        () => {}
      );
    }
  };

  // Preview: Geocoding search
  const handlePreviewGeocodingSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setPreviewSearchSuggestions([]);
      setIsPreviewSearchOpen(false);
      return;
    }
    try {
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) return;
      // Philippines bbox: 116.0,4.0,127.0,21.5
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${accessToken}&limit=5&proximity=121.5569,14.1133&country=PH&bbox=116,4,127,21.5`;
      const data = await ensureOk(await fetch(url)).then(r => r.json());
      setPreviewSearchSuggestions(data.features || []);
      setIsPreviewSearchOpen(data.features && data.features.length > 0);
    } catch {
      setPreviewSearchSuggestions([]);
      setIsPreviewSearchOpen(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => handlePreviewGeocodingSearch(previewSearchQuery), 300);
    return () => clearTimeout(t);
  }, [previewSearchQuery, handlePreviewGeocodingSearch]);

  const handleAddLocationGeocodingSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setAddLocationSearchSuggestions([]);
      setIsAddLocationSearchOpen(false);
      return;
    }

    try {
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) return;

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${accessToken}&limit=5&proximity=121.5569,14.1133&country=PH&bbox=116,4,127,21.5`;
      const data = await ensureOk(await fetch(url)).then((r) => r.json());
      setAddLocationSearchSuggestions(data.features || []);
      setIsAddLocationSearchOpen(Boolean(data.features && data.features.length > 0));
    } catch {
      setAddLocationSearchSuggestions([]);
      setIsAddLocationSearchOpen(false);
    }
  }, []);

  const handleLocationMapGeocodingSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setLocationMapSearchSuggestions([]);
      setIsLocationMapSearchOpen(false);
      return;
    }

    try {
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) return;

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${accessToken}&limit=5&proximity=121.5569,14.1133&country=PH&bbox=116,4,127,21.5`;
      const data = await ensureOk(await fetch(url)).then((r) => r.json());
      setLocationMapSearchSuggestions(data.features || []);
      setIsLocationMapSearchOpen(Boolean(data.features && data.features.length > 0));
    } catch {
      setLocationMapSearchSuggestions([]);
      setIsLocationMapSearchOpen(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => handleLocationMapGeocodingSearch(locationMapSearchQuery), 300);
    return () => clearTimeout(t);
  }, [locationMapSearchQuery, handleLocationMapGeocodingSearch]);

  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  
  // Loading states
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState<string | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  
  // Sort state for Date Submitted column
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>('desc'); // Default to descending (newest first)
  
  // Sort state for Report ID column
  const [idSort, setIdSort] = useState<'asc' | 'desc' | null>(null);
  
  // New report alert state (moved before useEffect to ensure availability)
  const [showNewReportAlert, setShowNewReportAlert] = useState(false);
  const [newReportData, setNewReportData] = useState<any>(null);
  const previousReportCountRef = useRef<number>(0);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sync viewed reports to localStorage
  useEffect(() => {
    localStorage.setItem("viewedReports", JSON.stringify(Array.from(viewedReports)));
  }, [viewedReports]);
  
  // Fallback function using Web Audio API (defined before useCallback dependencies)
  const playWebAudioAlarm = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // More attention-grabbing alarm pattern
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.4);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.6);
      
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1.0);
    } catch (error) {
      console.log("Web Audio API also failed:", error);
      // Final fallback: try to play a simple beep using a data URL
      try {
        const fallbackAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        fallbackAudio.volume = 0.3;
        fallbackAudio.play().catch(() => console.log("Final fallback audio also failed"));
      } catch (finalError) {
        console.log("All audio playback methods failed:", finalError);
      }
    }
  }, []);

  // Function to play a single alarm sound
  const playSingleAlarm = useCallback(() => {
    try {
      // Play the custom alarm sound from the uploaded MP3 file
      const audio = new Audio('/accizard-uploads/alarmsoundfx.mp3');
      audio.volume = 0.8; // Increased volume for better attention
      
      // Set a timeout to fall back to Web Audio API if MP3 fails to load
      const fallbackTimeout = setTimeout(() => {
        console.log("MP3 loading too slow, falling back to Web Audio API");
        playWebAudioAlarm();
      }, 1500); // Reduced timeout for faster fallback
      
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(fallbackTimeout); // Cancel fallback if MP3 loads successfully
        audio.play().catch((error) => {
          console.log("MP3 playback failed, using fallback:", error);
          playWebAudioAlarm();
        });
      });
      
      audio.addEventListener('error', () => {
        clearTimeout(fallbackTimeout);
        console.log("MP3 file error, using fallback");
        playWebAudioAlarm();
      });
      
      // Start loading the audio
      audio.load();
      
    } catch (error) {
      console.log("Error initializing MP3 alarm, using fallback:", error);
      playWebAudioAlarm();
    }
  }, [playWebAudioAlarm]);

  // Function to play alarming sound for new reports (continuous until dismissed)
  const playAlarmSound = useCallback(() => {
    // Clear any existing alarm interval
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    
    // Play alarm immediately
    playSingleAlarm();
    
    // Set up continuous alarm every 3 seconds
    const interval = setInterval(() => {
      playSingleAlarm();
    }, 3000);
    
    alarmIntervalRef.current = interval;
  }, [playSingleAlarm]);

  // Function to stop the alarm
  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
      console.log("Alarm stopped");
    }
  }, []);

  // Cleanup alarm interval on component unmount
  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch current user information
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
        
        if (adminLoggedIn) {
          // Admin user - fetch from admins collection using username
          const username = localStorage.getItem("adminUsername");
          if (username) {
            const q = query(collection(db, "admins"), where("username", "==", username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const data = querySnapshot.docs[0].data();
              setCurrentUser({
                id: querySnapshot.docs[0].id,
                username: data.username || username,
                name: data.name || data.fullName || username,
                userType: "admin"
              });
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
              setCurrentUser({
                id: querySnapshot.docs[0].id,
                username: data.username || authUser.email?.split("@")[0] || "Super Admin",
                name: data.fullName || data.name || "Super Admin",
                userType: "superadmin"
              });
              return;
            }
            // Fallback for super admin not found in collection
            setCurrentUser({
              id: authUser.uid,
              username: authUser.email?.split("@")[0] || "Super Admin",
              name: authUser.displayName || authUser.email?.split("@")[0] || "Super Admin",
              userType: "superadmin"
            });
          }
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    }
    fetchCurrentUser();
  }, []);
  
  // Fetch reports from Firestore in real-time
  useEffect(() => {
    try {
      const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
        console.log("Snapshot received:", snapshot.docs.length, "documents");
        setIsLoadingReports(false);
        
        const fetched = snapshot.docs.map((doc, index) => {
          const data: any = doc.data() || {};
          
          // Map timestamp to dateSubmitted and timeSubmitted
          let dateSubmitted = "";
          let timeSubmitted = "";
          try {
            const timestamp: any = data.timestamp;
            if (timestamp) {
              let d;
              if (typeof timestamp.toDate === "function") {
                d = timestamp.toDate();
              } else if (timestamp instanceof Date) {
                d = timestamp;
              } else if (typeof timestamp === "number") {
                d = new Date(timestamp);
              } else if (typeof timestamp === "string") {
                d = new Date(timestamp);
              }
              
              if (d && !isNaN(d.getTime())) {
                // MM/dd/yy and h:mm a formatting
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                const yy = String(d.getFullYear()).slice(-2);
                dateSubmitted = `${mm}/${dd}/${yy}`;
                const hours12 = d.getHours() % 12 || 12;
                const minutes = String(d.getMinutes()).padStart(2, "0");
                const ampm = d.getHours() >= 12 ? "PM" : "AM";
                timeSubmitted = `${hours12}:${minutes} ${ampm}`;
              }
            }
          } catch (error) {
            console.log("Error parsing timestamp:", error);
          }

          // Map imageUrls to attachedMedia (from mobile users)
          const mobileMedia = Array.isArray(data.imageUrls) ? data.imageUrls : [];
          
          // Get admin-added media from the report data
          const adminMedia = Array.isArray(data.adminMedia) ? data.adminMedia : [];

          // Use default coordinates if Firebase data doesn't have separate lat/lng fields
          const defaultLatitude = 14.1139;  // Lucban, Quezon
          const defaultLongitude = 121.5556; // Lucban, Quezon

          return {
            id: data.reportId || doc.id,
            firestoreId: doc.id, // Store the actual Firestore document ID for deletion
            userId: data.userId || "",
            type: data.reportType || "", // Map from Firestore reportType field
            reportedBy: data.reporterName || "", // Map from Firestore reporterName field
            barangay: "", // Not in your schema, will show empty
            description: data.description || "",
            responders: "", // Not in your schema, will show empty
            location: data.locationName || data.location || "", // Use locationName from Firestore, fallback to location
            dateSubmitted,
            timeSubmitted,
            status: data.status || "Pending",
            mobileMedia,
            adminMedia,
            attachedDocument: "", // Not in your schema, will show empty
            mobileNumber: data.reporterMobile || "", // Map from Firestore reporterMobile field
            timeOfDispatch: "", // Not in your schema, will show empty
            timeOfArrival: "", // Not in your schema, will show empty
            // Use separate latitude and longitude fields from Firestore
            latitude: data.latitude || defaultLatitude,
            longitude: data.longitude || defaultLongitude,
            // Keep coordinates for backward compatibility (formatted as string)
            coordinates: data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : `${defaultLatitude}, ${defaultLongitude}`
          };
        });
        
        // Check for new reports and trigger alert (only if count increased)
        const previousCount = previousReportCountRef.current;
        if (previousCount > 0 && fetched.length > previousCount) {
          const newReportCount = fetched.length - previousCount;
          
          if (newReportCount > 0) {
            // Get the newest report (first in the array since we order by timestamp desc)
            const latestNewReport = fetched[0];
            
            // Set alert data and show modal
            setNewReportData(latestNewReport);
            setShowNewReportAlert(true);
            
            // Play alarm sound (continuous until dismissed)
            playAlarmSound();
          }
        }
        
        // Always update the reports state and ref (this handles deletions automatically)
        previousReportCountRef.current = fetched.length;
        setReports(fetched);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Error subscribing to reports:", err);
    }
  }, [playAlarmSound]);

  // Fetch team members from database
  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const [formData, setFormData] = useState({
    type: "",
    reportedBy: "",
    barangay: "",
    description: "",
    location: "",
    status: "Pending",
    attachedMedia: [] as File[],
    timeOfDispatch: "",
    timeOfArrival: "",
    latitude: 14.1139,
    longitude: 121.5556
  });
  
  // State for resident search
  const [residentSearch, setResidentSearch] = useState("");
  const [residents, setResidents] = useState<any[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<any[]>([]);
  const [showResidentSearch, setShowResidentSearch] = useState(false);
  const [showAddLocationMap, setShowAddLocationMap] = useState(false);
  const [addLocationData, setAddLocationData] = useState<{lat: number, lng: number, address: string} | null>(null);

  useEffect(() => {
    if (!showAddLocationMap) return;
    const t = setTimeout(() => handleAddLocationGeocodingSearch(addLocationSearchQuery), 300);
    return () => clearTimeout(t);
  }, [addLocationSearchQuery, handleAddLocationGeocodingSearch, showAddLocationMap]);
  
  // Memoize the single marker to prevent flinching
  const singleMarkerForMap = useMemo(() => {
    if (!addLocationData) return undefined;
    return {
      id: 'selected-location',
      type: 'Default',
      title: formData.location || addLocationData.address,
      description: formData.location || addLocationData.address,
      reportId: '',
      coordinates: [addLocationData.lng, addLocationData.lat] as [number, number],
      locationName: formData.location || addLocationData.address,
      latitude: addLocationData.lat,
      longitude: addLocationData.lng
    };
  }, [addLocationData, formData.location]);
  const addLocationMapCenter = addLocationData
    ? [addLocationData.lng, addLocationData.lat] as [number, number]
    : formData.longitude && formData.latitude
    ? [Number(formData.longitude), Number(formData.latitude)] as [number, number]
    : [121.5556, 14.1139] as [number, number];
  const addLocationMapZoom = addLocationData
    ? 16
    : formData.longitude && formData.latitude
    ? 15
    : 14;
  
  const handleAddReport = async () => {
    setIsAddingReport(true);
    try {
      console.log("Adding new report:", formData);
      
      // Validate required fields
      if (!formData.type) {
        toast.error("Please select a report type");
        setIsAddingReport(false);
        return;
      }
      
      if (!formData.location || !formData.latitude || !formData.longitude) {
        toast.error("Please select a location on the map");
        setIsAddingReport(false);
        return;
      }

      // Generate report ID with incremented value (RID-[Incremented value])
      // Fetch all reports to find the maximum RID number
      const reportsQuery = query(collection(db, "reports"));
      const reportsSnapshot = await getDocs(reportsQuery);
      
      // Extract the number from reportId if it matches 'RID-[Number]'
      const reportIds = reportsSnapshot.docs.map(doc => {
        const raw = doc.data().reportId;
        if (typeof raw === 'string' && raw.startsWith('RID-')) {
          const num = parseInt(raw.replace('RID-', ''));
          return isNaN(num) ? 0 : num;
        }
        // fallback for legacy reportIds (RPT- format or others)
        return 0;
      });
      
      const maxReportId = reportIds.length > 0 ? Math.max(...reportIds) : 0;
      const nextReportId = maxReportId + 1;
      const reportId = `RID-${nextReportId}`;
      
      // Get current user ID
      const userId = currentUser?.id || auth.currentUser?.uid || "admin";
      
      // Upload media files if any are selected
      let uploadedMediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setIsUploadingMedia(true);
        try {
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            console.log(`Uploading file ${i + 1}/${selectedFiles.length}:`, file.name, file.type, file.size);
            
            // Validate file type
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            if (!isImage && !isVideo) {
              toast.error(`${file.name} is not a valid image or video file`);
              continue;
            }
            
            // Validate file size (max 50MB)
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (file.size > maxSize) {
              toast.error(`${file.name} is too large. Maximum size is 50MB`);
              continue;
            }
            
            // Create unique filename with timestamp and random suffix
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const fileExtension = file.name.split('.').pop() || '';
            const fileName = `media_${timestamp}_${randomSuffix}.${fileExtension}`;
            
            // Create storage reference using the same structure as mobile app
            // Structure: report_images/{userId}/{reportId}/admin/{fileName}
            const storageRef = ref(storage, `report_images/${userId}/${reportId}/admin/${fileName}`);
            console.log('Storage path:', `report_images/${userId}/${reportId}/admin/${fileName}`);
            
            // Upload file
            await uploadBytes(storageRef, file);
            
            // Get download URL
            const downloadURL = await getDownloadURL(storageRef);
            uploadedMediaUrls.push(downloadURL);
            console.log(`File ${i + 1} uploaded successfully:`, downloadURL);
          }
          
          if (uploadedMediaUrls.length > 0) {
            toast.success(`${uploadedMediaUrls.length} file(s) uploaded successfully!`);
          }
        } catch (error: any) {
          console.error("Error uploading media files:", error);
          let errorMessage = "Failed to upload media files. Please try again.";
          if (error.code === 'storage/unauthorized') {
            errorMessage = "You are not authorized to upload files. Please check your permissions.";
          } else if (error.code === 'storage/canceled') {
            errorMessage = "Upload was canceled.";
          } else if (error.code === 'storage/quota-exceeded') {
            errorMessage = "Storage quota exceeded. Please contact administrator.";
          }
          toast.error(errorMessage);
          setIsUploadingMedia(false);
          setIsAddingReport(false);
          return;
        } finally {
          setIsUploadingMedia(false);
        }
      }
      
      // Convert report type from kebab-case to Title Case for Firestore
      const reportType = REPORT_TYPE_LABELS[formData.type] || formData.type;
      
      // Create report document in Firestore
      const reportData = {
        reportId: reportId,
        userId: userId,
        reportType: reportType,
        reporterName: formData.reportedBy || "",
        reporterMobile: "", // Can be added later if needed
        description: formData.description || "",
        location: formData.location || "",
        locationName: formData.location || "",
        latitude: formData.latitude || 14.1139,
        longitude: formData.longitude || 121.5556,
        status: formData.status || "Pending",
        timestamp: serverTimestamp(),
        imageUrls: [], // Mobile user media (empty for admin-created reports)
        adminMedia: uploadedMediaUrls, // Admin-uploaded media
        barangay: formData.barangay || "",
        createdBy: currentUser?.id || auth.currentUser?.uid || "admin",
        createdByName: currentUser?.name || currentUser?.username || "Admin"
      };
      
      // Add document to Firestore
      const docRef = await addDoc(collection(db, "reports"), reportData);
      console.log("Report created with ID:", docRef.id);
      
      // Log activity
      await logActivity({
        actionType: ActionType.REPORT_CREATED,
        action: formatLogMessage('Created', 'report', `${formData.type} Incident`, docRef.id),
        entityType: 'report',
        entityId: docRef.id,
        entityName: `${formData.type} Incident`,
        metadata: {
          reportId: reportData.reportId,
          type: formData.type,
          status: 'Pending',
          barangay: formData.barangay || '',
          reportedBy: formData.reportedBy || ''
        }
      });
      
      // Move uploaded files from temp folder to actual report folder if needed
      // (Optional: can be done later or files can stay in temp folder)
      
      // Reset form and close modal
      setShowAddModal(false);
      setFormData({
        type: "",
        reportedBy: "",
        barangay: "",
        description: "",
        location: "",
        status: "Pending",
        attachedMedia: [],
        timeOfDispatch: "",
        timeOfArrival: "",
        latitude: 14.1139,
        longitude: 121.5556
      });
      setSelectedFiles([]); // Clear selected files
      setResidentSearch("");
      setAddLocationData(null);
      toast.success("Report added successfully!");
    } catch (error: any) {
      console.error("Error adding report:", error);
      toast.error(error.message || "Failed to add report. Please try again.");
    } finally {
      setIsAddingReport(false);
    }
  };
  
  // Fetch residents from database
  const fetchResidents = async () => {
    try {
      const residentsQuery = query(collection(db, "users"), orderBy("name"));
      const querySnapshot = await getDocs(residentsQuery);
      const residentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResidents(residentsData);
      setFilteredResidents(residentsData);
    } catch (error) {
      console.error("Error fetching residents:", error);
    }
  };

  // State for preview edit mode (declared before useEffects that use them)
  const [previewTab, setPreviewTab] = useState("details");
  const [isPreviewEditMode, setIsPreviewEditMode] = useState(false);
  const [isDispatchEditMode, setIsDispatchEditMode] = useState(false);
  const [isPatientEditMode, setIsPatientEditMode] = useState(false);
  const [previewEditData, setPreviewEditData] = useState<any>(null);
  const [previewResidentSearch, setPreviewResidentSearch] = useState("");
  const [previewResidents, setPreviewResidents] = useState<any[]>([]);
  const [previewFilteredResidents, setPreviewFilteredResidents] = useState<any[]>([]);
  const [showPreviewResidentSearch, setShowPreviewResidentSearch] = useState(false);
  const [barangayComboboxOpen, setBarangayComboboxOpen] = useState(false);
  const [barangaySearchValue, setBarangaySearchValue] = useState("");

  // Fetch residents for preview edit mode
  const fetchPreviewResidents = async () => {
    try {
      const residentsQuery = query(collection(db, "users"), orderBy("name"));
      const querySnapshot = await getDocs(residentsQuery);
      const residentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().fullName || "",
        email: doc.data().email || "",
        mobileNumber: doc.data().mobileNumber || doc.data().phoneNumber || "",
        ...doc.data()
      }));
      setPreviewResidents(residentsData);
      setPreviewFilteredResidents(residentsData);
    } catch (error) {
      console.error("Error fetching residents for preview:", error);
    }
  };
  
  // Filter residents based on search
  useEffect(() => {
    if (residentSearch.trim() === "") {
      setFilteredResidents(residents);
    } else {
      const filtered = residents.filter(resident =>
        resident.name?.toLowerCase().includes(residentSearch.toLowerCase()) ||
        resident.email?.toLowerCase().includes(residentSearch.toLowerCase()) ||
        resident.mobileNumber?.includes(residentSearch)
      );
      setFilteredResidents(filtered);
    }
  }, [residentSearch, residents]);
  
  // Fetch residents when modal opens
  useEffect(() => {
    if (showAddModal) {
      fetchResidents();
    }
    if (!showAddModal) {
      setShowResidentSearch(false);
      setResidentSearch("");
      setSelectedFiles([]); // Clear selected files when modal closes
    }
  }, [showAddModal]);

  // Filter preview residents based on search
  useEffect(() => {
    if (previewResidentSearch.trim() === "") {
      setPreviewFilteredResidents(previewResidents);
    } else {
      const filtered = previewResidents.filter(resident =>
        resident.name?.toLowerCase().includes(previewResidentSearch.toLowerCase()) ||
        resident.email?.toLowerCase().includes(previewResidentSearch.toLowerCase()) ||
        resident.mobileNumber?.includes(previewResidentSearch)
      );
      setPreviewFilteredResidents(filtered);
    }
  }, [previewResidentSearch, previewResidents]);

  // Fetch residents when entering preview edit mode
  useEffect(() => {
    if (isPreviewEditMode) {
      fetchPreviewResidents();
    }
    if (!isPreviewEditMode) {
      setShowPreviewResidentSearch(false);
      setPreviewResidentSearch("");
    }
  }, [isPreviewEditMode]);

  // Close preview resident search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on the dropdown or the input field
      if (!target.closest('.preview-resident-search-dropdown') && 
          target.id !== 'preview-reported-by' && 
          !target.closest('#preview-reported-by')) {
        setShowPreviewResidentSearch(false);
      }
    };
    
    if (showPreviewResidentSearch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPreviewResidentSearch]);
  
  // Close resident search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on the dropdown or the input field
      if (!target.closest('.resident-search-dropdown') && 
          target.id !== 'reported-by' && 
          !target.closest('#reported-by')) {
        setShowResidentSearch(false);
      }
    };
    
    if (showResidentSearch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showResidentSearch]);
  
  // Initialize existing location when map modal opens
  useEffect(() => {
    if (showAddLocationMap && !addLocationData && formData.location && formData.latitude && formData.longitude) {
      setAddLocationData({
        lat: formData.latitude,
        lng: formData.longitude,
        address: formData.location
      });
    }
  }, [showAddLocationMap, formData, addLocationData]);

useEffect(() => {
  if (!showAddLocationMap) {
    setAddLocationSearchQuery("");
    setAddLocationSearchSuggestions([]);
    setIsAddLocationSearchOpen(false);
  }
}, [showAddLocationMap]);
  
  // Handle location map click for add report
  const handleAddReportMapClick = async (lngLat: { lng: number; lat: number }) => {
    try {
      const address = await reverseGeocode(lngLat.lat, lngLat.lng);
      setAddLocationData({
        lat: lngLat.lat,
        lng: lngLat.lng,
        address: address
      });
      setFormData(prev => ({
        ...prev,
        location: address,
        latitude: lngLat.lat,
        longitude: lngLat.lng
      }));
    } catch (error) {
      console.error('Error getting address for clicked location:', error);
      toast.error('Failed to get address for selected location');
    }
  };

  const handleSelectAddLocationSuggestion = (feature: any) => {
    if (!feature?.geometry?.coordinates) return;
    const [lng, lat] = feature.geometry.coordinates;
    const address = feature.place_name || feature.text || 'Selected location';

    setAddLocationData({
      lat,
      lng,
      address,
    });

    setFormData((prev) => ({
      ...prev,
      location: address,
      latitude: lat,
      longitude: lng,
    }));

    setAddLocationSearchSuggestions([]);
    setIsAddLocationSearchOpen(false);
  };

  const handleSelectLocationMapSuggestion = (feature: any) => {
    if (!feature?.geometry?.coordinates) return;
    const [lng, lat] = feature.geometry.coordinates;
    const address = feature.place_name || feature.text || 'Selected location';

    setNewLocation({
      lat,
      lng,
      address,
    });

    setLocationMapSearchSuggestions([]);
    setIsLocationMapSearchOpen(false);
    setLocationMapSearchQuery(address);
  };
  const handleDeleteReport = (reportId: string) => {
    setReportToDelete(reportId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) {
      console.error("No report ID to delete");
      return;
    }

    setIsDeletingReport(reportToDelete);
    console.log("Attempting to delete report:", reportToDelete);

    try {
      // Find the report data to generate PDF
      const reportToDeleteData = reports.find(r => r.firestoreId === reportToDelete);
      
      if (reportToDeleteData) {
        // Load dispatch and patient data if available
        let dispatchDataForPDF = dispatchData;
        let patientsDataForPDF = patients;
        
        try {
          const loadedDispatch = await loadDispatchDataFromDatabase(reportToDelete);
          if (loadedDispatch) dispatchDataForPDF = loadedDispatch;
          
          const loadedPatients = await loadPatientDataFromDatabase(reportToDelete);
          if (loadedPatients && loadedPatients.patients) patientsDataForPDF = loadedPatients.patients;
        } catch (error) {
          console.log("Error loading additional data for PDF:", error);
        }

        // Helper function to calculate GCS total
        const calculateGCSTotal = (patient: any) => {
          const eyes = patient.gcs?.eyes ? parseInt(patient.gcs.eyes) : 0;
          const verbal = patient.gcs?.verbal ? parseInt(patient.gcs.verbal) : 0;
          const motor = patient.gcs?.motor ? parseInt(patient.gcs.motor) : 0;
          return eyes + verbal + motor;
        };

        // Generate PDF HTML content
        const generatePDFHTML = () => {
          const report = reportToDeleteData;
          const dispatch = dispatchDataForPDF;
          const patientData = patientsDataForPDF;
          
          return `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Emergency Report - ${report?.id || 'N/A'}</title>
                <style>
                  body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                    background: #fff;
                  }
                  
                  .header {
                    border-bottom: 3px solid #f97316;
                    padding-bottom: 15px;
                    margin-bottom: 25px;
                  }
                  
                  .header h1 {
                    color: #f97316;
                    margin: 0 0 5px 0;
                    font-size: 28px;
                  }
                  
                  .header-info {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 10px;
                    font-size: 12px;
                    color: #666;
                  }
                  
                  .section {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                  }
                  
                  .section-title {
                    background: #f97316;
                    color: white;
                    padding: 10px 15px;
                    margin: 0 0 15px 0;
                    font-size: 18px;
                    font-weight: bold;
                    border-radius: 4px;
                  }
                  
                  table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                  }
                  
                  table td, table th {
                    padding: 10px;
                    border: 1px solid #ddd;
                    text-align: left;
                  }
                  
                  table th {
                    background-color: #f8f9fa;
                    font-weight: 600;
                    width: 30%;
                  }
                  
                  .value-cell {
                    background-color: #fff;
                  }
                  
                  .badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                  }
                  
                  .status-pending { background-color: #fef3c7; color: #92400e; }
                  .status-ongoing { background-color: #dbeafe; color: #1e40af; }
                  .status-not-responded { background-color: #fee2e2; color: #991b1b; }
                  .status-responded { background-color: #d1fae5; color: #065f46; }
                  .status-false-report { background-color: #f3f4f6; color: #374151; }
                  .status-redundant { background-color: #f3e8ff; color: #6b21a8; }
                  
                  .patient-section {
                    margin-top: 20px;
                    border: 2px solid #e5e7eb;
                    padding: 15px;
                    border-radius: 8px;
                  }
                  
                  .patient-header {
                    background: #f3f4f6;
                    padding: 10px;
                    margin: -15px -15px 15px -15px;
                    border-radius: 6px 6px 0 0;
                    font-weight: bold;
                    color: #1f2937;
                  }
                  
                  .sub-section {
                    margin-top: 15px;
                    margin-left: 20px;
                  }
                  
                  .sub-section-title {
                    font-weight: 600;
                    color: #f97316;
                    margin-bottom: 8px;
                  }
                  
                  .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #e5e7eb;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>AcciZard Emergency Report</h1>
                  <div class="header-info">
                    <div>Report ID: <strong>${report?.id || 'N/A'}</strong></div>
                    <div>Generated: ${new Date().toLocaleString()}</div>
                  </div>
                
                <!-- Section I: Report Details -->
                <div class="section">
                  <div class="section-title">I. Report Details</div>
                  <table>
                    <tr>
                      <th>Report Type</th>
                      <td class="value-cell">${report?.type || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Status</th>
                      <td class="value-cell">
                        <span class="badge status-${report?.status?.toLowerCase().replace(' ', '-') || 'pending'}">
                          ${report?.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th>Reported By</th>
                      <td class="value-cell">${report?.reportedBy || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Date and Time Submitted</th>
                      <td class="value-cell">
                        ${report?.dateSubmitted || 'N/A'} ${report?.timeSubmitted ? `at ${report.timeSubmitted}` : ''}
                      </td>
                    </tr>
                    <tr>
                      <th>Mobile Number</th>
                      <td class="value-cell">${report?.mobileNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Barangay</th>
                      <td class="value-cell">${report?.barangay || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Description</th>
                      <td class="value-cell">${report?.description || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Location</th>
                      <td class="value-cell">
                        ${report?.location || 'N/A'}<br>
                        <small style="color: #666;">
                          Coordinates: ${report?.latitude && report?.longitude 
                            ? `${report.latitude}, ${report.longitude}` 
                            : 'N/A'}
                        </small>
                      </td>
                    </tr>
                  </table>
                
                <!-- Section II: Dispatch Form -->
                <div class="section">
                  <div class="section-title">II. Dispatch Form</div>
                  <table>
                    <tr>
                      <th>Received By</th>
                      <td class="value-cell">${dispatch?.receivedBy || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Responders</th>
                      <td class="value-cell">
                        ${dispatch?.responders && dispatch.responders.length > 0
                          ? dispatch.responders.map((r: any) => 
                              `${r.team}: ${r.responders ? r.responders.join(', ') : 'N/A'}`
                            ).join('<br>')
                          : 'N/A'}
                      </td>
                    </tr>
                <tr>
                  <th>Driver</th>
                  <td class="value-cell">${dispatch?.driverName || dispatch?.driverId || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Vehicle Used</th>
                  <td class="value-cell">${dispatch?.vehicleName || dispatch?.vehicleId || 'N/A'}</td>
                </tr>
                    <tr>
                      <th>Time Call Received</th>
                      <td class="value-cell">${dispatch?.timeCallReceived || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Time of Dispatch</th>
                      <td class="value-cell">${dispatch?.timeOfDispatch || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Time of Arrival</th>
                      <td class="value-cell">${dispatch?.timeOfArrival || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Response Time</th>
                      <td class="value-cell">
                        ${dispatch?.timeOfDispatch && dispatch?.timeOfArrival
                          ? calculateResponseTime(dispatch.timeOfDispatch, dispatch.timeOfArrival)
                          : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <th>Hospital Arrival</th>
                      <td class="value-cell">${dispatch?.hospitalArrival || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Returned to OPCEN</th>
                      <td class="value-cell">${dispatch?.returnedToOpcen || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Disaster Related</th>
                      <td class="value-cell">${dispatch?.disasterRelated || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Agency Present</th>
                      <td class="value-cell">${Array.isArray(dispatch?.agencyPresent) ? dispatch.agencyPresent.join(', ') : (dispatch?.agencyPresent || 'N/A')}</td>
                    </tr>
                    <tr>
                      <th>Type of Emergency</th>
                      <td class="value-cell">${dispatch?.typeOfEmergency || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Vehicle Involved</th>
                      <td class="value-cell">${dispatch?.vehicleInvolved || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Classification of Injury</th>
                      <td class="value-cell">${dispatch?.injuryClassification || 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Actions Taken</th>
                      <td class="value-cell">
                        ${dispatch?.actionsTaken && dispatch.actionsTaken.length > 0
                          ? '<ul style="margin: 0; padding-left: 20px;">' + 
                            dispatch.actionsTaken.map((action: string) => `<li>${action}</li>`).join('') +
                            '</ul>'
                          : 'N/A'}
                      </td>
                    </tr>
                  </table>
                
                <!-- Section III: Patient Information -->
                <div class="section">
                  <div class="section-title">III. Patient Information</div>
                  ${patientData && patientData.length > 0
                    ? patientData.map((patient: any, index: number) => {
                        const gcsTotal = calculateGCSTotal(patient);
                        return `
                          <div class="patient-section">
                            <div class="patient-header">Patient ${index + 1}${patient.name ? ` - ${patient.name}` : ''}</div>
                            
                            <table>
                              <tr>
                                <th>Name</th>
                                <td class="value-cell">${patient.name || 'N/A'}</td>
                              </tr>
                              <tr>
                                <th>Contact Number</th>
                                <td class="value-cell">${patient.contactNumber || 'N/A'}</td>
                              </tr>
                              <tr>
                                <th>Address</th>
                                <td class="value-cell">${patient.address || 'N/A'}</td>
                              </tr>
                              <tr>
                                <th>Age</th>
                                <td class="value-cell">${patient.age ? `${patient.age} years old` : 'N/A'}</td>
                              </tr>
                              <tr>
                                <th>Gender</th>
                                <td class="value-cell">${patient.gender || 'N/A'}</td>
                              </tr>
                            </table>
                            
                            <div class="sub-section">
                              <div class="sub-section-title">A. Glasgow Coma Scale</div>
                              <table>
                                <tr>
                                  <th>Eyes Response</th>
                                  <td class="value-cell">${patient.gcs?.eyes || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <th>Verbal Response</th>
                                  <td class="value-cell">${patient.gcs?.verbal || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <th>Motor Response</th>
                                  <td class="value-cell">${patient.gcs?.motor || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <th>GCS Total Score</th>
                                  <td class="value-cell" style="font-weight: bold; color: #f97316;">${gcsTotal > 0 ? gcsTotal : 'N/A'}</td>
                                </tr>
                              </table>
                            </div>
                            
                            <div class="sub-section">
                              <div class="sub-section-title">E. Vital Signs</div>
                              <table>
                                <tr>
                                  <th>Temperature</th>
                                  <td class="value-cell">${patient.vitalSigns?.temperature ? `${patient.vitalSigns.temperature}°C` : 'N/A'}</td>
                                </tr>
                                <tr>
                                  <th>Pulse Rate</th>
                                  <td class="value-cell">${patient.vitalSigns?.pulseRate ? `${patient.vitalSigns.pulseRate} bpm` : 'N/A'}</td>
                                </tr>
                                <tr>
                                  <th>Respiratory Rate</th>
                                  <td class="value-cell">${patient.vitalSigns?.respiratoryRate ? `${patient.vitalSigns.respiratoryRate} breaths/min` : 'N/A'}</td>
                                </tr>
                                <tr>
                                  <th>Blood Pressure</th>
                                  <td class="value-cell">${patient.vitalSigns?.bloodPressure ? `${patient.vitalSigns.bloodPressure} mmHg` : 'N/A'}</td>
                                </tr>
                              </table>
                            </div>
                          </div>
                        `;
                      }).join('')
                    : '<p style="color: #666; font-style: italic;">No patient information available</p>'}
              </div>
              
              <div class="footer">
                <p>AcciZard Emergency Management System</p>
                <p>Lucban, Quezon - Local Disaster Risk Reduction and Management Office</p>
              </div>
            </body>
          </html>
        `;
        };

        // Generate and download PDF
        const htmlContent = generatePDFHTML();
        const pdfContent = document.createElement('div');
        pdfContent.innerHTML = htmlContent;
        pdfContent.style.position = 'absolute';
        pdfContent.style.left = '-9999px';
        pdfContent.style.width = '210mm';
        document.body.appendChild(pdfContent);
        
        try {
          const canvas = await html2canvas(pdfContent, {
            allowTaint: true,
            logging: false,
            useCORS: true,
            scale: 2 as any
          } as any);
          
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgWidth = 210;
          const pageHeight = 297;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          let heightLeft = imgHeight;
          let position = 0;
          
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          
          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
          
          pdf.save(`Report_${reportToDeleteData.id}_${new Date().getTime()}.pdf`);
          toast.success("PDF downloaded successfully");
        } catch (error) {
          console.error("Error generating PDF:", error);
          toast.error("Failed to generate PDF");
        } finally {
          document.body.removeChild(pdfContent);
        }
      } else {
        console.log("Report data not found for PDF generation");
      }

      // Delete the report from Firestore
      await deleteDoc(doc(db, "reports", reportToDelete));
      console.log("Successfully deleted report from Firestore:", reportToDelete);
      
      // Log activity (reportToDeleteData was already declared above)
      if (reportToDeleteData) {
        await logActivity({
          actionType: ActionType.REPORT_DELETED,
          action: formatLogMessage('Deleted', 'report', `${reportToDeleteData.type || 'Unknown'} Incident`, reportToDelete),
          entityType: 'report',
          entityId: reportToDelete,
          entityName: `${reportToDeleteData.type || 'Unknown'} Incident`,
          metadata: {
            reportId: reportToDeleteData.id,
            type: reportToDeleteData.type || 'Unknown'
          }
        });
      }
      
      // Remove from viewed reports if it exists
      setViewedReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportToDelete);
        console.log("Removed from viewed reports:", reportToDelete);
        return newSet;
      });
      
      // Remove from selected reports if it exists
      setSelectedReports(prev => {
        const filtered = prev.filter(id => id !== reportToDelete);
        console.log("Removed from selected reports:", reportToDelete);
        return filtered;
      });
      
      toast.success("Report deleted successfully");
      setShowDeleteDialog(false);
      setReportToDelete(null);
      
      // Force a small delay to ensure Firestore listener has processed the change
      setTimeout(() => {
        console.log("Delete operation completed");
      }, 100);
      
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("Failed to delete report. Please try again.");
    } finally {
      setIsDeletingReport(null);
    }
  };
  const handlePinOnMap = (report: any) => {
    console.log("Redirecting to map for report:", report.id);
    navigate("/risk-map", { state: { report } });
  };
  const handleViewLocation = (location: string) => {
    console.log("Viewing location:", location);
  };
  const handleReportedByClick = (reportedBy: string) => {
    console.log("Redirecting to user:", reportedBy);
    navigate("/manage-users");
  };
  const barangayOptions = [
    "Abang", "Aliliw", "Atulinao", "Ayuti", 
    "Barangay 1", "Barangay 2", "Barangay 3", "Barangay 4", "Barangay 5", 
    "Barangay 6", "Barangay 7", "Barangay 8", "Barangay 9", "Barangay 10", 
    "Igang", "Kabatete", "Kakawit", "Kalangay", "Kalyaat", "Kilib", 
    "Kulapi", "Mahabang Parang", "Malupak", "Manasa", "May-it", 
    "Nagsinamo", "Nalunao", "Palola", "Piis", "Samil", "Tiawe", "Tinamnan"
  ];
  const [adminOptions, setAdminOptions] = useState(["Admin 1", "Admin 2", "Admin 3", "Admin 4", "Admin 5"]);
  const [agencyOptions, setAgencyOptions] = useState<AgencyOption[]>([]);
  const [newAgencyName, setNewAgencyName] = useState("");
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [newVehicleName, setNewVehicleName] = useState("");
  const emergencyTypeOptions = ["Road Crash", "Medical Assistance", "Medical Emergency"];
  const vehicleInvolvedOptions = [
    "MV to MV",
    "MV to Object on the road",
    "MV loss of control",
    "Pedestrian Struck",
    "Bicycle Struck"
  ];
  const injuryClassificationOptions = ["Major", "Minor"];
  const majorInjuryTypeOptions = [
    "Airway",
    "Breathing",
    "Circulation",
    "Fractures",
    "Head Injury",
    "Eye Injury",
    "Deep Lacerations",
    "Severe/Extensive Burns",
    "Injuries with Chest Pain, Paralysis, Confusion, Severe Bleeding, Unconsciousness"
  ];
  const minorInjuryTypeOptions = [
    "Shallow Cuts or Abrasions",
    "Sprains and Muscle Strain",
    "Bruises",
    "Minor Burns Covering Small Area of Skin"
  ];
  const majorMedicalSymptomsOptions = [
    "Unconsciousness",
    "Severe Chest Pain",
    "Difficulty Breathing",
    "Severe Bleeding",
    "Cardiac Arrest",
    "Stroke Symptoms",
    "Severe Allergic Reaction",
    "Severe Burns",
    "Multiple Trauma",
    "Severe Head Injury",
    "Airway Obstruction",
    "Severe Dehydration",
    "Severe Abdominal Pain",
    "High Fever with Confusion",
    "Severe Nausea/Vomiting"
  ];
  const minorMedicalSymptomsOptions = [
    "Mild Chest Discomfort",
    "Minor Cuts/Abrasions",
    "Mild Burns",
    "Minor Headache",
    "Mild Nausea",
    "Low-grade Fever",
    "Mild Abdominal Pain",
    "Minor Allergic Reaction",
    "Mild Dehydration",
    "Minor Sprains",
    "Mild Breathing Difficulty",
    "Moderate Bleeding",
    "Moderate Burns",
    "Moderate Head Injury"
  ];
  const natureOfIllnessOptions = [
    "Infectious disease",
    "Lung disease",
    "Cancer",
    "Cardiovascular disease",
    "Neurological disorder",
    "Skin disease",
    "Mental health issues",
    "Autoimmune disease",
    "Inflammatory conditions",
    "Metabolic disorder",
    "Others"
  ];
  const actionsTakenOptions = [
    "Ensured scene safety",
    "Coordinated with on-scene personnel",
    "Coordinated with PNP",
    "Coordinated with BFP",
    "Coordinated with MTMO",
    "Coordinated and Contacted Relative",
    "Primary and Secondary Assessments",
    "First Aid Management Done",
    "Vital Signs Taken",
    "Interviewed patient or relative/s",
    "Coordinated with RHU",
    "Coordinated with Refer Quezon",
    "Referred",
    "Endorsed patient/s to nurse on duty",
    "Assisted patient/s in Response Vehicle",
    "Transported",
    "Others"
  ];
  const [teamOptions, setTeamOptions] = useState([
    "Alpha Team",
    "Bravo Team", 
    "Charlie Team",
    "Delta Team",
    "Echo Team"
  ]);
  // Team definitions for automatic assignment - now dynamic from database
  const [teamAlpha, setTeamAlpha] = useState<string[]>([]);
  const [teamSulu, setTeamSulu] = useState<string[]>([]);
  
  // Team management state
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [selectedTeamForManagement, setSelectedTeamForManagement] = useState<"Team Alpha" | "Team Sulu">("Team Alpha");

  const truncateLocation = (location: string, maxLength: number = 30) => {
    return location.length > maxLength ? `${location.substring(0, maxLength)}...` : location;
  };
  
  // Filter and paginate reports
  const filteredReports = reports.filter(report => {
    // Search filter
    const searchMatch = searchTerm === "" || 
      report.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Type filter - convert kebab-case to Title Case for matching
    const typeMatch = typeFilter === "all" || 
      report.type === typeFilter || 
      report.type?.toLowerCase().replace(/ /g, '-') === typeFilter.toLowerCase();
    
    // Status filter - convert kebab-case to Title Case for matching
    const statusMatch = statusFilter === "all" || 
      report.status === statusFilter ||
      report.status?.toLowerCase().replace(/ /g, '-') === statusFilter.toLowerCase();
    
    // Date filter
    let dateMatch = true;
    if (date?.from) {
      try {
        const [month, day, year] = report.dateSubmitted.split('/');
        const fullYear = 2000 + parseInt(year);
        const reportDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        
        if (date.from) {
          dateMatch = reportDate >= date.from;
        }
        if (date.to && dateMatch) {
          dateMatch = reportDate <= date.to;
        }
      } catch (error) {
        dateMatch = true;
      }
    }
    
    return searchMatch && typeMatch && statusMatch && dateMatch;
  });
  
  // Sort filtered reports by date or ID if sort is active
  const sortedReports = [...filteredReports].sort((a, b) => {
    // Report ID sorting takes precedence
    if (idSort) {
      const idA = a.id || '';
      const idB = b.id || '';
      const comparison = idA.localeCompare(idB, undefined, { numeric: true });
      return idSort === 'asc' ? comparison : -comparison;
    }
    
    // Date sorting
    if (dateSort) {
      try {
        // Parse date format: MM/DD/YY
        const parseDate = (dateStr: string) => {
          const [month, day, year] = dateStr.split('/');
          const fullYear = 2000 + parseInt(year);
          return new Date(fullYear, parseInt(month) - 1, parseInt(day));
        };
        
        const dateA = parseDate(a.dateSubmitted);
        const dateB = parseDate(b.dateSubmitted);
        
        if (dateSort === 'asc') {
          return dateA.getTime() - dateB.getTime();
        } else {
          return dateB.getTime() - dateA.getTime();
        }
      } catch (error) {
        return 0;
      }
    }
    
    return 0;
  });
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReports = sortedReports.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter, date]);
  
  // Calculate dynamic statistics
  const totalReports = reports.length;
  
  const reportsThisWeek = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return reports.filter(report => {
      try {
        if (!report.dateSubmitted || !report.timeSubmitted) return false;
        
        // Parse MM/DD/YY format
        const [month, day, year] = report.dateSubmitted.split('/');
        const fullYear = 2000 + parseInt(year);
        
        // Parse HH:MM AM/PM format
        const timeMatch = report.timeSubmitted.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!timeMatch) return false;
        
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        const reportDate = new Date(fullYear, parseInt(month) - 1, parseInt(day), hours, minutes);
        
        return reportDate >= oneWeekAgo && reportDate <= now;
      } catch (error) {
        console.error('Error parsing report date:', error);
        return false;
      }
    }).length;
  }, [reports]);
  
  const pendingReports = reports.filter(report => report.status === 'Pending').length;
  
  const averageResponseTime = useMemo(() => {
    // Filter reports that have both dispatch and arrival times
    const reportsWithResponseTime = reports.filter(report => {
      try {
        // Check if report has dispatch data with both times
        const hasDispatchData = report.dispatchInfo?.timeOfDispatch && report.dispatchInfo?.timeOfArrival;
        return hasDispatchData;
      } catch (error) {
        return false;
      }
    });

    if (reportsWithResponseTime.length === 0) {
      return null;
    }

    // Calculate total response time in minutes
    const totalMinutes = reportsWithResponseTime.reduce((total, report) => {
      try {
        const dispatchTime = report.dispatchInfo.timeOfDispatch;
        const arrivalTime = report.dispatchInfo.timeOfArrival;
        
        const [dispatchHours, dispatchMinutes] = dispatchTime.split(':').map(Number);
        const [arrivalHours, arrivalMinutes] = arrivalTime.split(':').map(Number);
        
        const dispatchTotalMinutes = dispatchHours * 60 + dispatchMinutes;
        const arrivalTotalMinutes = arrivalHours * 60 + arrivalMinutes;
        
        let diffMinutes = arrivalTotalMinutes - dispatchTotalMinutes;
        
        if (diffMinutes < 0) {
          diffMinutes += 24 * 60;
        }
        
        return total + diffMinutes;
      } catch (error) {
        return total;
      }
    }, 0);

    const avgMinutes = Math.round(totalMinutes / reportsWithResponseTime.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;

    return {
      avgMinutes,
      formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      count: reportsWithResponseTime.length
    };
  }, [reports]);
  
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const handleBatchStatusUpdate = (newStatus: string) => {
    console.log(`Updating status to ${newStatus} for reports:`, selectedReports);
    // Implement the actual status update logic here
  };
  const handleBatchDelete = () => {
    setShowBatchDeleteDialog(true);
  };

  const confirmBatchDelete = async () => {
    if (!selectedReports || selectedReports.length === 0) {
      console.error("No reports selected for deletion");
      return;
    }

    console.log("Attempting to delete reports:", selectedReports);

    try {
      // Generate PDFs for each report before deletion
      for (const reportId of selectedReports) {
        const reportData = reports.find(r => r.firestoreId === reportId);
        if (reportData) {
          try {
            // Load dispatch and patient data if available
            let dispatchDataForPDF = dispatchData;
            let patientsDataForPDF = patients;
            
            try {
              const loadedDispatch = await loadDispatchDataFromDatabase(reportId);
              if (loadedDispatch) dispatchDataForPDF = loadedDispatch;
              
              const loadedPatients = await loadPatientDataFromDatabase(reportId);
              if (loadedPatients && loadedPatients.patients) patientsDataForPDF = loadedPatients.patients;
            } catch (error) {
              console.log("Error loading additional data for PDF:", error);
            }

            // Helper function to calculate GCS total
            const calculateGCSTotal = (patient: any) => {
              const eyes = patient.gcs?.eyes ? parseInt(patient.gcs.eyes) : 0;
              const verbal = patient.gcs?.verbal ? parseInt(patient.gcs.verbal) : 0;
              const motor = patient.gcs?.motor ? parseInt(patient.gcs.motor) : 0;
              return eyes + verbal + motor;
            };

            // Generate PDF HTML content
            const generatePDFHTML = () => {
              const report = reportData;
              const dispatch = dispatchDataForPDF;
              const patientData = patientsDataForPDF;
              
              return `
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>Emergency Report - ${report?.id || 'N/A'}</title>
                    <style>
                      body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                        background: #fff;
                      }
                      
                      .header {
                        border-bottom: 3px solid #f97316;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                      }
                      
                      .header h1 {
                        color: #f97316;
                        margin: 0 0 5px 0;
                        font-size: 28px;
                      }
                      
                      .header-info {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 10px;
                        font-size: 12px;
                        color: #666;
                      }
                      
                      .section {
                        margin-bottom: 30px;
                        page-break-inside: avoid;
                      }
                      
                      .section-title {
                        background: #f97316;
                        color: white;
                        padding: 10px 15px;
                        margin: 0 0 15px 0;
                        font-size: 18px;
                        font-weight: bold;
                        border-radius: 4px;
                      }
                      
                      table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                      }
                      
                      table td, table th {
                        padding: 10px;
                        border: 1px solid #ddd;
                        text-align: left;
                      }
                      
                      table th {
                        background-color: #f8f9fa;
                        font-weight: 600;
                        width: 30%;
                      }
                      
                      .value-cell {
                        background-color: #fff;
                      }
                      
                      .badge {
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                      }
                      
                      .status-pending { background-color: #fef3c7; color: #92400e; }
                      .status-ongoing { background-color: #dbeafe; color: #1e40af; }
                      .status-not-responded { background-color: #fee2e2; color: #991b1b; }
                      .status-responded { background-color: #d1fae5; color: #065f46; }
                      .status-false-report { background-color: #f3f4f6; color: #374151; }
                      .status-redundant { background-color: #f3e8ff; color: #6b21a8; }
                      
                      .patient-section {
                        margin-top: 20px;
                        border: 2px solid #e5e7eb;
                        padding: 15px;
                        border-radius: 8px;
                      }
                      
                      .patient-header {
                        background: #f3f4f6;
                        padding: 10px;
                        margin: -15px -15px 15px -15px;
                        border-radius: 6px 6px 0 0;
                        font-weight: bold;
                        color: #1f2937;
                      }
                      
                      .sub-section {
                        margin-top: 15px;
                        margin-left: 20px;
                      }
                      
                      .sub-section-title {
                        font-weight: 600;
                        color: #f97316;
                        margin-bottom: 8px;
                      }
                      
                      .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #e5e7eb;
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <h1>AcciZard Emergency Report</h1>
                      <div class="header-info">
                        <div>Report ID: <strong>${report?.id || 'N/A'}</strong></div>
                        <div>Generated: ${new Date().toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <!-- Section I: Report Details -->
                    <div class="section">
                      <div class="section-title">I. Report Details</div>
                      <table>
                        <tr>
                          <th>Report Type</th>
                          <td class="value-cell">${report?.type || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Status</th>
                          <td class="value-cell">
                            <span class="badge status-${report?.status?.toLowerCase().replace(' ', '-') || 'pending'}">
                              ${report?.status || 'N/A'}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <th>Reported By</th>
                          <td class="value-cell">${report?.reportedBy || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Date and Time Submitted</th>
                          <td class="value-cell">
                            ${report?.dateSubmitted || 'N/A'} ${report?.timeSubmitted ? `at ${report.timeSubmitted}` : ''}
                          </td>
                        </tr>
                        <tr>
                          <th>Mobile Number</th>
                          <td class="value-cell">${report?.mobileNumber || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Description</th>
                          <td class="value-cell">${report?.description || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Location</th>
                          <td class="value-cell">
                            ${report?.location || 'N/A'}<br>
                            <small style="color: #666;">
                              Coordinates: ${report?.latitude && report?.longitude 
                                ? `${report.latitude}, ${report.longitude}` 
                                : 'N/A'}
                            </small>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Section II: Dispatch Form -->
                    <div class="section">
                      <div class="section-title">II. Dispatch Form</div>
                      <table>
                        <tr>
                          <th>Received By</th>
                          <td class="value-cell">${dispatch?.receivedBy || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Responders</th>
                          <td class="value-cell">
                            ${dispatch?.responders && dispatch.responders.length > 0
                              ? dispatch.responders.map((r: any) => 
                                  `${r.team}: ${r.responders ? r.responders.join(', ') : 'N/A'}`
                                ).join('<br>')
                              : 'N/A'}
                          </td>
                        </tr>
                        <tr>
                          <th>Time Call Received</th>
                          <td class="value-cell">${dispatch?.timeCallReceived || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Time of Dispatch</th>
                          <td class="value-cell">${dispatch?.timeOfDispatch || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Time of Arrival</th>
                          <td class="value-cell">${dispatch?.timeOfArrival || 'N/A'}</td>
                        </tr>
                        <tr>
                          <th>Response Time</th>
                          <td class="value-cell">
                            ${dispatch?.timeOfDispatch && dispatch?.timeOfArrival
                              ? calculateResponseTime(dispatch.timeOfDispatch, dispatch.timeOfArrival)
                              : 'N/A'}
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Section III: Patient Information -->
                    <div class="section">
                      <div class="section-title">III. Patient Information</div>
                      ${patientData && patientData.length > 0
                        ? patientData.map((patient: any, index: number) => {
                            const gcsTotal = calculateGCSTotal(patient);
                            return `
                              <div class="patient-section">
                                <div class="patient-header">Patient ${index + 1}${patient.name ? ` - ${patient.name}` : ''}</div>
                                
                                <table>
                                  <tr>
                                    <th>Name</th>
                                    <td class="value-cell">${patient.name || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <th>Contact Number</th>
                                    <td class="value-cell">${patient.contactNumber || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <th>Address</th>
                                    <td class="value-cell">${patient.address || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <th>Age</th>
                                    <td class="value-cell">${patient.age ? `${patient.age} years old` : 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <th>Gender</th>
                                    <td class="value-cell">${patient.gender || 'N/A'}</td>
                                  </tr>
                                </table>
                              </div>
                            `;
                          }).join('')
                        : '<p style="color: #666; font-style: italic;">No patient information available</p>'}
                  </div>
                  
                  <div class="footer">
                    <p>AcciZard Emergency Management System</p>
                    <p>Lucban, Quezon - Local Disaster Risk Reduction and Management Office</p>
                  </div>
                </body>
              </html>
            `;
            };

            // Generate and download PDF
            const htmlContent = generatePDFHTML();
            const pdfContent = document.createElement('div');
            pdfContent.innerHTML = htmlContent;
            pdfContent.style.position = 'absolute';
            pdfContent.style.left = '-9999px';
            pdfContent.style.width = '210mm';
            document.body.appendChild(pdfContent);
            
            try {
              const canvas = await html2canvas(pdfContent, {
                allowTaint: true,
                logging: false,
                useCORS: true,
                scale: 2 as any
              } as any);
              
              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF('p', 'mm', 'a4');
              const imgWidth = 210;
              const pageHeight = 297;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              let heightLeft = imgHeight;
              let position = 0;
              
              pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
              
              while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
              }
              
              pdf.save(`Report_${reportData.id}_${new Date().getTime()}.pdf`);
            } catch (error) {
              console.error("Error generating PDF:", error);
            } finally {
              document.body.removeChild(pdfContent);
            }
          } catch (pdfError) {
            console.error("Error generating PDF:", pdfError);
          }
        }
      }

      // Delete all selected reports from Firestore
      const deletePromises = selectedReports.map(reportId => {
        console.log("Deleting report:", reportId);
        return deleteDoc(doc(db, "reports", reportId));
      });
      
      await Promise.all(deletePromises);
      console.log("Successfully deleted all reports from Firestore");
      
      // Remove from viewed reports
      setViewedReports(prev => {
        const newSet = new Set(prev);
        selectedReports.forEach(id => {
          newSet.delete(id);
          console.log("Removed from viewed reports:", id);
        });
        return newSet;
      });
      
      // Clear selected reports
      setSelectedReports([]);
      
      toast.success(`PDFs downloaded and ${selectedReports.length} report(s) deleted successfully`);
      setShowBatchDeleteDialog(false);
      
      // Force a small delay to ensure Firestore listener has processed the changes
      setTimeout(() => {
        console.log("Batch delete operation completed");
      }, 100);
      
    } catch (error) {
      console.error("Error deleting reports:", error);
      toast.error("Failed to delete some reports. Please try again.");
    }
  };

  // Handle status change directly from table
  const handleStatusChange = async (reportFirestoreId: string, newStatus: string) => {
    try {
      console.log(`Updating report ${reportFirestoreId} status to ${newStatus}`);
      
      // Update in Firestore
      const report = reports.find(r => r.firestoreId === reportFirestoreId);
      
      await updateDoc(doc(db, "reports", reportFirestoreId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastModifiedBy: currentUser?.id
      });
      
      // Log activity
      if (report) {
        await logActivity({
          actionType: ActionType.REPORT_UPDATED,
          action: `Updated report "${report.type || 'Unknown'} Incident" (${reportFirestoreId}) - Changed status to "${newStatus}"`,
          entityType: 'report',
          entityId: reportFirestoreId,
          entityName: `${report.type || 'Unknown'} Incident`,
          changes: {
            status: { from: report.status || 'Unknown', to: newStatus }
          }
        });
      }
      
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
    }
  };
  const handleCheckboxChange = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Add all reports on current page to selection
      const pageReportIds = paginatedReports.map(report => report.firestoreId);
      setSelectedReports(prev => [...new Set([...prev, ...pageReportIds])]);
    } else {
      // Remove all reports on current page from selection
      const pageReportIds = paginatedReports.map(report => report.firestoreId);
      setSelectedReports(prev => prev.filter(id => !pageReportIds.includes(id)));
    }
  };
  const handlePrintTable = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      // Define CSV headers
      const headers = ['Report ID', 'Type', 'Reported By', 'Mobile Number', 'Location', 'Description', 'Date Submitted', 'Time Submitted', 'Status'];
      
      // Map filtered reports to CSV rows
      const rows = filteredReports.map(report => [
        report.id || '',
        report.type || '',
        report.reportedBy || '',
        report.mobileNumber || '',
        report.location || '',
        (report.description || '').replace(/,/g, ';').replace(/\n/g, ' '), // Replace commas and newlines
        report.dateSubmitted || '',
        report.timeSubmitted || '',
        report.status || ''
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `accizard_reports_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${filteredReports.length} reports to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV. Please try again.');
    }
  };
  const handlePrintPreview = async () => {
    // Load dispatch and patient data if not already loaded
    if (selectedReport) {
      if (!dispatchData.timeCallReceived && !dispatchData.receivedBy) {
        await loadDispatchDataFromDatabase(selectedReport.firestoreId);
      }
      if (!patients[0]?.name && patients.length === 1) {
        await loadPatientDataFromDatabase(selectedReport.firestoreId);
      }
    }

    // Helper function to calculate GCS total
    const calculateGCSTotal = (patient: any) => {
      const eyes = patient.gcs?.eyes ? parseInt(patient.gcs.eyes) : 0;
      const verbal = patient.gcs?.verbal ? parseInt(patient.gcs.verbal) : 0;
      const motor = patient.gcs?.motor ? parseInt(patient.gcs.motor) : 0;
      return eyes + verbal + motor;
    };

    // Create comprehensive HTML template
    const generateHTML = () => {
      const report = selectedReport;
      const dispatch = dispatchData;
      const patientData = patients;
      
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Emergency Report - ${report?.id || 'N/A'}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none; }
                .page-break { page-break-after: always; }
              }
              
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                background: #fff;
              }
              
              .header {
                border-bottom: 3px solid #f97316;
                padding-bottom: 15px;
                margin-bottom: 25px;
              }
              
              .header h1 {
                color: #f97316;
                margin: 0 0 5px 0;
                font-size: 28px;
              }
              
              .header-info {
                display: flex;
                justify-content: space-between;
                margin-top: 10px;
                font-size: 12px;
                color: #666;
              }
              
              .section {
                margin-bottom: 30px;
                page-break-inside: avoid;
              }
              
              .section-title {
                background: #f97316;
                color: white;
                padding: 10px 15px;
                margin: 0 0 15px 0;
                font-size: 18px;
                font-weight: bold;
                border-radius: 4px;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }
              
              table td, table th {
                padding: 10px;
                border: 1px solid #ddd;
                text-align: left;
              }
              
              table th {
                background-color: #f8f9fa;
                font-weight: 600;
                width: 30%;
              }
              
              .value-cell {
                background-color: #fff;
              }
              
              .badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
              }
              
              .status-pending { background-color: #fef3c7; color: #92400e; }
              .status-ongoing { background-color: #dbeafe; color: #1e40af; }
              .status-not-responded { background-color: #fee2e2; color: #991b1b; }
              .status-responded { background-color: #d1fae5; color: #065f46; }
              .status-false-report { background-color: #f3f4f6; color: #374151; }
              .status-redundant { background-color: #f3e8ff; color: #6b21a8; }
              
              .patient-section {
                margin-top: 20px;
                border: 2px solid #e5e7eb;
                padding: 15px;
                border-radius: 8px;
              }
              
              .patient-header {
                background: #f3f4f6;
                padding: 10px;
                margin: -15px -15px 15px -15px;
                border-radius: 6px 6px 0 0;
                font-weight: bold;
                color: #1f2937;
              }
              
              .sub-section {
                margin-top: 15px;
                margin-left: 20px;
              }
              
              .sub-section-title {
                font-weight: 600;
                color: #f97316;
                margin-bottom: 8px;
              }
              
              .grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
              }
              
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>AcciZard Emergency Report</h1>
              <div class="header-info">
                <div>Report ID: <strong>${report?.id || 'N/A'}</strong></div>
                <div>Generated: ${new Date().toLocaleString()}</div>
              </div>
            </div>
            
            <!-- Section I: Report Details -->
            <div class="section">
              <div class="section-title">I. Report Details</div>
              <table>
                <tr>
                  <th>Report Type</th>
                  <td class="value-cell">${report?.type || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td class="value-cell">
                    <span class="badge status-${report?.status?.toLowerCase().replace(' ', '-') || 'pending'}">
                      ${report?.status || 'N/A'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th>Reported By</th>
                  <td class="value-cell">${report?.reportedBy || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Date and Time Submitted</th>
                  <td class="value-cell">
                    ${report?.dateSubmitted || 'N/A'} ${report?.timeSubmitted ? `at ${report.timeSubmitted}` : ''}
                  </td>
                </tr>
                <tr>
                  <th>Mobile Number</th>
                  <td class="value-cell">${report?.mobileNumber || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Barangay</th>
                  <td class="value-cell">${report?.barangay || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td class="value-cell">${report?.description || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Location</th>
                  <td class="value-cell">
                    ${report?.location || 'N/A'}<br>
                    <small style="color: #666;">
                      Coordinates: ${report?.latitude && report?.longitude 
                        ? `${report.latitude}, ${report.longitude}` 
                        : 'N/A'}
                    </small>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Section II: Dispatch Form -->
            <div class="section">
              <div class="section-title">II. Dispatch Form</div>
              <table>
                <tr>
                  <th>Received By</th>
                  <td class="value-cell">${dispatch?.receivedBy || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Responders</th>
                  <td class="value-cell">
                    ${dispatch?.responders && dispatch.responders.length > 0
                      ? dispatch.responders.map((r: any) => 
                          `${r.team}: ${r.responders ? r.responders.join(', ') : 'N/A'}`
                        ).join('<br>')
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <th>Driver</th>
                  <td class="value-cell">${dispatch?.driverName || dispatch?.driverId || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Vehicle Used</th>
                  <td class="value-cell">${dispatch?.vehicleName || dispatch?.vehicleId || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Time Call Received</th>
                  <td class="value-cell">${dispatch?.timeCallReceived || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Time of Dispatch</th>
                  <td class="value-cell">${dispatch?.timeOfDispatch || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Time of Arrival</th>
                  <td class="value-cell">${dispatch?.timeOfArrival || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Response Time</th>
                  <td class="value-cell">
                    ${dispatch?.timeOfDispatch && dispatch?.timeOfArrival
                      ? calculateResponseTime(dispatch.timeOfDispatch, dispatch.timeOfArrival)
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <th>Hospital Arrival</th>
                  <td class="value-cell">${dispatch?.hospitalArrival || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Returned to OPCEN</th>
                  <td class="value-cell">${dispatch?.returnedToOpcen || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Disaster Related</th>
                  <td class="value-cell">${dispatch?.disasterRelated || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Agency Present</th>
                  <td class="value-cell">${Array.isArray(dispatch?.agencyPresent) ? dispatch.agencyPresent.join(', ') : (dispatch?.agencyPresent || 'N/A')}</td>
                </tr>
                <tr>
                  <th>Type of Emergency</th>
                  <td class="value-cell">${dispatch?.typeOfEmergency || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Vehicle Involved</th>
                  <td class="value-cell">${dispatch?.vehicleInvolved || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Classification of Injury</th>
                  <td class="value-cell">${dispatch?.injuryClassification || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Actions Taken</th>
                  <td class="value-cell">
                    ${dispatch?.actionsTaken && dispatch.actionsTaken.length > 0
                      ? '<ul style="margin: 0; padding-left: 20px;">' + 
                        dispatch.actionsTaken.map((action: string) => `<li>${action}</li>`).join('') +
                        '</ul>'
                      : 'N/A'}
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Section III: Patient Information -->
            <div class="section">
              <div class="section-title">III. Patient Information</div>
              ${patientData && patientData.length > 0
                ? patientData.map((patient: any, index: number) => {
                    const gcsTotal = calculateGCSTotal(patient);
                    return `
                      <div class="patient-section ${index > 0 ? 'page-break' : ''}">
                        <div class="patient-header">Patient ${index + 1}${patient.name ? ` - ${patient.name}` : ''}</div>
                        
                        <table>
                          <tr>
                            <th>Name</th>
                            <td class="value-cell">${patient.name || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Contact Number</th>
                            <td class="value-cell">${patient.contactNumber || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Address</th>
                            <td class="value-cell">${patient.address || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Religion</th>
                            <td class="value-cell">${patient.religion || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Birthday</th>
                            <td class="value-cell">${patient.birthday ? new Date(patient.birthday).toLocaleDateString() : 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Blood Type</th>
                            <td class="value-cell">${patient.bloodType || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Civil Status</th>
                            <td class="value-cell">${patient.civilStatus || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Age</th>
                            <td class="value-cell">${patient.age ? `${patient.age} years old` : 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>PWD</th>
                            <td class="value-cell">${patient.pwd || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Age Group</th>
                            <td class="value-cell">${patient.ageGroup || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Gender</th>
                            <td class="value-cell">${patient.gender || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Name of Companion/Relative</th>
                            <td class="value-cell">${patient.companionName || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Companion Contact Number</th>
                            <td class="value-cell">${patient.companionContact || 'N/A'}</td>
                          </tr>
                        </table>
                        
                        <div class="sub-section">
                          <div class="sub-section-title">A. Glasgow Coma Scale</div>
                          <table>
                            <tr>
                              <th>Eyes Response</th>
                              <td class="value-cell">${patient.gcs?.eyes || 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Verbal Response</th>
                              <td class="value-cell">${patient.gcs?.verbal || 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Motor Response</th>
                              <td class="value-cell">${patient.gcs?.motor || 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>GCS Total Score</th>
                              <td class="value-cell" style="font-weight: bold; color: #f97316;">${gcsTotal > 0 ? gcsTotal : 'N/A'}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <div class="sub-section">
                          <div class="sub-section-title">B. Pupil Assessment</div>
                          <table>
                            <tr>
                              <th>Pupil</th>
                              <td class="value-cell">${patient.pupil || 'N/A'}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <div class="sub-section">
                          <div class="sub-section-title">C. Lung Sounds</div>
                          <table>
                            <tr>
                              <th>Lung Sounds</th>
                              <td class="value-cell">${patient.lungSounds || 'N/A'}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <div class="sub-section">
                          <div class="sub-section-title">D. Perfusion Assessment</div>
                          <table>
                            <tr>
                              <th>Skin</th>
                              <td class="value-cell">${patient.perfusion?.skin || 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Pulse</th>
                              <td class="value-cell">${patient.perfusion?.pulse || 'N/A'}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <div class="sub-section">
                          <div class="sub-section-title">E. Vital Signs</div>
                          <table>
                            <tr>
                              <th>Time Taken</th>
                              <td class="value-cell">${patient.vitalSigns?.timeTaken || 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Temperature</th>
                              <td class="value-cell">${patient.vitalSigns?.temperature ? `${patient.vitalSigns.temperature}°C` : 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Pulse Rate</th>
                              <td class="value-cell">${patient.vitalSigns?.pulseRate ? `${patient.vitalSigns.pulseRate} bpm` : 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Respiratory Rate</th>
                              <td class="value-cell">${patient.vitalSigns?.respiratoryRate ? `${patient.vitalSigns.respiratoryRate} breaths/min` : 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Blood Pressure</th>
                              <td class="value-cell">${patient.vitalSigns?.bloodPressure ? `${patient.vitalSigns.bloodPressure} mmHg` : 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>SPO2</th>
                              <td class="value-cell">
                                ${patient.vitalSigns?.spo2 
                                  ? `${patient.vitalSigns.spo2}%${patient.vitalSigns.spo2WithO2Support ? ' (with O2 support)' : ''}` 
                                  : 'N/A'}
                              </td>
                            </tr>
                            <tr>
                              <th>Random Blood Sugar</th>
                              <td class="value-cell">${patient.vitalSigns?.randomBloodSugar ? `${patient.vitalSigns.randomBloodSugar} mg/dL` : 'N/A'}</td>
                            </tr>
                            <tr>
                              <th>Pain Scale</th>
                              <td class="value-cell">${patient.vitalSigns?.painScale || 'N/A'}</td>
                            </tr>
                          </table>
                        </div>
                      </div>
                    `;
                  }).join('')
                : '<p style="color: #666; font-style: italic;">No patient information available</p>'}
            </div>
            
            <div class="footer">
              <p>AcciZard Emergency Management System</p>
              <p>Lucban, Quezon - Local Disaster Risk Reduction and Management Office</p>
            </div>
          </body>
        </html>
      `;
    };

    // Create and open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generateHTML());
      printWindow.document.close();
      // Don't auto-print, let user preview first
      // printWindow.print();
    }
  };

  // Function to determine if a report is "new" (within last 24 hours and not viewed)
  const isNewReport = (report: any) => {
    try {
      // Check if report has already been viewed
      if (viewedReports.has(report.id)) {
        return false;
      }

      // Parse the date and time from the report
      const [datePart, timePart] = [report.dateSubmitted, report.timeSubmitted];
      if (!datePart || !timePart) return false;
      
      // Parse MM/DD/YY format
      const [month, day, year] = datePart.split('/');
      const fullYear = 2000 + parseInt(year);
      
      // Parse HH:MM AM/PM format
      const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!timeMatch) return false;
      
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toUpperCase();
      
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      // Create the report timestamp
      const reportDate = new Date(fullYear, parseInt(month) - 1, parseInt(day), hours, minutes);
      const now = new Date();
      const diffInHours = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60);
      
      // Consider "new" if within last 24 hours and not viewed
      return diffInHours <= 24 && diffInHours >= 0;
    } catch (error) {
      console.error('Error checking if report is new:', error);
      return false;
    }
  };
  
  // Function to calculate response time between dispatch and arrival
  const calculateResponseTime = (dispatchTime: string, arrivalTime: string) => {
    try {
      // Parse the time strings (format: HH:MM)
      const [dispatchHours, dispatchMinutes] = dispatchTime.split(':').map(Number);
      const [arrivalHours, arrivalMinutes] = arrivalTime.split(':').map(Number);
      
      // Convert to minutes since midnight
      const dispatchTotalMinutes = dispatchHours * 60 + dispatchMinutes;
      const arrivalTotalMinutes = arrivalHours * 60 + arrivalMinutes;
      
      // Calculate difference in minutes
      let diffMinutes = arrivalTotalMinutes - dispatchTotalMinutes;
      
      // Handle case where arrival is on the next day
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60; // Add 24 hours in minutes
      }
      
      // Format the result
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      
      if (hours > 0) {
        return `${hours} hr ${minutes} min`;
      } else {
        return `${minutes} min`;
      }
    } catch (error) {
      console.error('Error calculating response time:', error);
      return 'Calculation error';
    }
  };

  // Function to calculate response time in minutes only
  const calculateResponseTimeMinutes = (dispatchTime: string, arrivalTime: string) => {
    try {
      const [dispatchHours, dispatchMinutes] = dispatchTime.split(':').map(Number);
      const [arrivalHours, arrivalMinutes] = arrivalTime.split(':').map(Number);
      
      const dispatchTotalMinutes = dispatchHours * 60 + dispatchMinutes;
      const arrivalTotalMinutes = arrivalHours * 60 + arrivalMinutes;
      
      let diffMinutes = arrivalTotalMinutes - dispatchTotalMinutes;
      
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }
      
      return diffMinutes;
    } catch (error) {
      console.error('Error calculating response time:', error);
      return 0;
    }
  };
  
  const [showDirectionsModal, setShowDirectionsModal] = useState(false);
  const [directionsReport, setDirectionsReport] = useState<any>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [newLocation, setNewLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [showPatientLocationMap, setShowPatientLocationMap] = useState(false);
  const [patientLocationData, setPatientLocationData] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; name: string; userType: string } | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageName, setPreviewImageName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Create object URLs for file previews
  const filePreviewUrls = useMemo(() => {
    return selectedFiles.map(file => URL.createObjectURL(file));
  }, [selectedFiles]);
  
  // Cleanup object URLs when files change or component unmounts
  useEffect(() => {
    return () => {
      filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [filePreviewUrls]);

  // Helper function to get current time in HH:MM AM/PM format
  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert to 12-hour format
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Helper function to get current time in HH:MM (24-hour) format for time inputs
  const getCurrentTime24Hour = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };


  // Function to automatically assign responders based on alternating teams starting from October 1, 2025
  const getAutoAssignedResponders = () => {
    const today = new Date();
    const referenceDate = new Date('2025-10-01'); // October 1, 2025 - Team Alpha starts
    
    // Calculate days since reference date
    const timeDiff = today.getTime() - referenceDate.getTime();
    const daysSinceReference = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to make Oct 1 = Day 1
    
    // Odd days = Team Alpha, Even days = Team Sulu
    const isOddDay = daysSinceReference % 2 === 1;
    const assignedTeam = isOddDay ? teamAlpha : teamSulu;
    const teamName = isOddDay ? "Team Alpha" : "Team Sulu";
    
    return {
      team: teamName,
      members: assignedTeam,
      dayOfMonth: daysSinceReference
    };
  };

  // Function to save dispatch data to database
  const saveDispatchDataToDatabase = async (firestoreId: string, dispatchData: any) => {
    try {
      // Use the Firestore document ID directly
      const docRef = doc(db, "reports", firestoreId);
      
      // Get existing data
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        
        // Merge with existing dispatchInfo if it exists
        const sanitizedDispatchData = normalizeDispatchData(dispatchData);
        const mergedDispatchInfo = {
          ...currentData.dispatchInfo,
          ...sanitizedDispatchData
        };
        
        await updateDoc(docRef, {
          dispatchInfo: mergedDispatchInfo,
          updatedAt: serverTimestamp(),
          lastModifiedBy: currentUser?.id
        });
        
        // Log activity
        const report = reports.find(r => r.firestoreId === firestoreId);
        if (report) {
          await logActivity({
            actionType: ActionType.REPORT_UPDATED,
            action: `Updated dispatch form for report "${report.type || 'Unknown'} Incident" (${firestoreId})`,
            entityType: 'report',
            entityId: firestoreId,
            entityName: `${report.type || 'Unknown'} Incident`,
            metadata: {
              section: 'dispatchInfo'
            }
          });
        }
        
        toast.success("Dispatch data saved successfully!");
      }
    } catch (error) {
      console.error("Error saving dispatch data:", error);
      toast.error("Failed to save dispatch data");
    }
  };

  // Function to load existing dispatch data from database
  const loadDispatchDataFromDatabase = async (firestoreId: string) => {
    try {
      // Use the Firestore document ID directly
      const docRef = doc(db, "reports", firestoreId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.dispatchInfo) {
          const normalized = normalizeDispatchData(data.dispatchInfo);
          setDispatchData(normalized);
          return normalized;
        }
      }
    } catch (error) {
      console.error("Error loading dispatch data:", error);
    }
    return null;
  };

  // Function to save patient data to database
  const savePatientDataToDatabase = async (firestoreId: string, patientData: any) => {
    try {
      // Use the Firestore document ID directly
      const docRef = doc(db, "reports", firestoreId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        
        // Merge with existing patientInfo if it exists
        const mergedPatientInfo = {
          ...currentData.patientInfo,
          patients: patientData.patients || patientData
        };
        
        await updateDoc(docRef, {
          patientInfo: mergedPatientInfo,
          updatedAt: serverTimestamp(),
          lastModifiedBy: currentUser?.id
        });
        
        // Log activity
        const report = reports.find(r => r.firestoreId === firestoreId);
        if (report) {
          const patientCount = patientData.patients ? patientData.patients.length : (Array.isArray(patientData) ? patientData.length : 1);
          await logActivity({
            actionType: ActionType.REPORT_UPDATED,
            action: `Updated patient information for report "${report.type || 'Unknown'} Incident" (${firestoreId}) - ${patientCount} patient(s)`,
            entityType: 'report',
            entityId: firestoreId,
            entityName: `${report.type || 'Unknown'} Incident`,
            metadata: {
              section: 'patientInfo',
              patientCount
            }
          });
        }
        
        toast.success("Patient information saved successfully!");
      }
    } catch (error) {
      console.error("Error saving patient data:", error);
      toast.error("Failed to save patient information");
    }
  };

  // Function to load existing patient data from database
  const loadPatientDataFromDatabase = async (firestoreId: string) => {
    try {
      // Use the Firestore document ID directly
      const docRef = doc(db, "reports", firestoreId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.patientInfo && data.patientInfo.patients) {
          // Normalize patient data to ensure latitude and longitude are always present
          const normalizedPatients = data.patientInfo.patients.map((patient: any) => ({
            ...patient,
            latitude: patient.latitude || "",
            longitude: patient.longitude || ""
          }));
          setPatients(normalizedPatients);
          return { ...data.patientInfo, patients: normalizedPatients };
        }
      }
    } catch (error) {
      console.error("Error loading patient data:", error);
    }
    return null;
  };

  // Team management functions
  const fetchTeamMembers = async () => {
    try {
      // Fetch Team Alpha members
      const alphaDoc = await getDocs(query(collection(db, "teamMembers"), where("team", "==", "Team Alpha")));
      if (!alphaDoc.empty) {
        const alphaData = alphaDoc.docs[0].data();
        setTeamAlpha(alphaData.members || []);
      }

      // Fetch Team Sulu members
      const suluDoc = await getDocs(query(collection(db, "teamMembers"), where("team", "==", "Team Sulu")));
      if (!suluDoc.empty) {
        const suluData = suluDoc.docs[0].data();
        setTeamSulu(suluData.members || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
      // Fallback to empty arrays if database fails
      setTeamAlpha([]);
      setTeamSulu([]);
    }
  };

  const fetchDrivers = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "admins"));
      const drivers = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data();
          const position = (data.position || "").toString().toLowerCase();
          if (!position.includes("driver")) {
            return null;
          }
          const name = data.name || data.fullName || data.username || "";
          if (!name) {
            return null;
          }
          return {
            id: docSnap.id,
            name: name as string,
            position: data.position,
          } as DriverOption;
        })
        .filter((option): option is DriverOption => option !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setDriverOptions(drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setDriverOptions([]);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "vehicles"));
      if (snapshot.empty) {
        setVehicleOptions([]);
        return;
      }

      const vehicles = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data();
          const name = (data?.name || data?.label || data?.vehicleName || "").toString().trim();
          if (!name) return null;
          return {
            id: docSnap.id,
            name,
          } as VehicleOption;
        })
        .filter((option): option is VehicleOption => option !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setVehicleOptions(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      setVehicleOptions([]);
    }
  }, []);

  const fetchAgencies = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "agencies"));
      if (snapshot.empty) {
        setAgencyOptions([]);
        return;
      }

      const fetched = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data();
          const name = (data?.name || data?.title || "").toString().trim();
          if (!name) return null;
          return {
            id: docSnap.id,
            name,
          } as AgencyOption;
        })
        .filter((option): option is AgencyOption => option !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAgencyOptions(fetched);
    } catch (error) {
      console.error("Error fetching agencies:", error);
      setAgencyOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);

  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
  }, [fetchDrivers, fetchVehicles]);

  const handleAddAgencyOption = useCallback(async () => {
    const trimmed = newAgencyName.trim();
    if (!trimmed) {
      return;
    }

    if (agencyOptions.some(option => option.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.info("Agency already exists in the list.");
      setNewAgencyName("");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "agencies"), {
        name: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setAgencyOptions(prev => [...prev, { id: docRef.id, name: trimmed }].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Agency added successfully.");
    } catch (error) {
      console.error("Error adding agency:", error);
      toast.error("Failed to save agency to database. Added locally instead.");
      setAgencyOptions(prev => [...prev, { id: `local-${Date.now()}`, name: trimmed, isLocal: true }].sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setNewAgencyName("");
    }
  }, [agencyOptions, newAgencyName]);

  const handleAddVehicleOption = useCallback(async () => {
    const trimmed = newVehicleName.trim();
    if (!trimmed) {
      return;
    }

    if (vehicleOptions.some(option => option.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.info("Vehicle already exists in the list.");
      setNewVehicleName("");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "vehicles"), {
        name: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const vehicleRecord: VehicleOption = { id: docRef.id, name: trimmed };
      setVehicleOptions(prev => [...prev, vehicleRecord].sort((a, b) => a.name.localeCompare(b.name)));
      setDispatchData(prev => ({
        ...prev,
        vehicleId: vehicleRecord.id,
        vehicleName: vehicleRecord.name
      }));
      toast.success("Vehicle added successfully.");
    } catch (error) {
      console.error("Error adding vehicle:", error);
      toast.error("Failed to save vehicle to database. Added locally instead.");
      const vehicleRecord: VehicleOption = { id: `local-${Date.now()}`, name: trimmed, isLocal: true };
      setVehicleOptions(prev => [...prev, vehicleRecord].sort((a, b) => a.name.localeCompare(b.name)));
      setDispatchData(prev => ({
        ...prev,
        vehicleId: vehicleRecord.id,
        vehicleName: vehicleRecord.name
      }));
    } finally {
      setNewVehicleName("");
    }
  }, [newVehicleName, vehicleOptions]);

  const handleDeleteVehicleOption = useCallback(async (vehicleId: string, vehicleName: string) => {
    try {
      if (!vehicleId.startsWith("local-")) {
        await deleteDoc(doc(db, "vehicles", vehicleId));
      }
      setVehicleOptions(prev => prev.filter(vehicle => vehicle.id !== vehicleId));
      setDispatchData(prev => {
        if (prev.vehicleId === vehicleId) {
          return {
            ...prev,
            vehicleId: "",
            vehicleName: ""
          };
        }
        return prev;
      });
      toast.success(`Removed vehicle "${vehicleName}"`);
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      toast.error("Failed to delete vehicle");
    }
  }, []);

  const toggleAgencySelection = (agencyName: string) => {
    setDispatchData(prev => {
      const current = Array.isArray(prev.agencyPresent)
        ? prev.agencyPresent
        : prev.agencyPresent
          ? [prev.agencyPresent as unknown as string]
          : [];

      const isSelected = current.includes(agencyName);
      const updated = isSelected
        ? current.filter(name => name !== agencyName)
        : [...current, agencyName];

      return {
        ...prev,
        agencyPresent: updated
      };
    });
  };

  const toggleMajorInjuryType = (injuryType: string) => {
    setDispatchData(prev => {
      const types = Array.isArray(prev.majorInjuryTypes) ? prev.majorInjuryTypes : [];
      const isSelected = types.includes(injuryType);
      return {
        ...prev,
        majorInjuryTypes: isSelected
          ? types.filter(type => type !== injuryType)
          : [...types, injuryType]
      };
    });
  };

  const toggleMinorInjuryType = (injuryType: string) => {
    setDispatchData(prev => {
      const types = Array.isArray(prev.minorInjuryTypes) ? prev.minorInjuryTypes : [];
      const isSelected = types.includes(injuryType);
      return {
        ...prev,
        minorInjuryTypes: isSelected
          ? types.filter(type => type !== injuryType)
          : [...types, injuryType]
      };
    });
  };

  const toggleActionSelection = (action: string) => {
    setDispatchData(prev => {
      const isSelected = prev.actionsTaken.includes(action);
      const updated = isSelected
        ? prev.actionsTaken.filter(a => a !== action)
        : [...prev.actionsTaken, action];

      return {
        ...prev,
        actionsTaken: updated,
        othersDescription: action === "Others" && !updated.includes("Others") ? "" : prev.othersDescription
      };
    });
  };

  const addTeamMember = async (teamName: string, memberName: string) => {
    try {
      const teamRef = collection(db, "teamMembers");
      const teamQuery = query(teamRef, where("team", "==", teamName));
      const teamSnapshot = await getDocs(teamQuery);
      
      if (teamSnapshot.empty) {
        // Create new team document
        await updateDoc(doc(db, "teamMembers", `${teamName.toLowerCase().replace(" ", "_")}`), {
          team: teamName,
          members: [memberName],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Update existing team document
        const teamData = teamSnapshot.docs[0].data();
        const updatedMembers = [...(teamData.members || []), memberName];
        await updateDoc(doc(db, "teamMembers", teamSnapshot.docs[0].id), {
          members: updatedMembers,
          updatedAt: serverTimestamp()
        });
      }
      
      // Refresh team data
      await fetchTeamMembers();
      toast.success(`Added ${memberName} to ${teamName}`);
    } catch (error) {
      console.error("Error adding team member:", error);
      toast.error("Failed to add team member");
    }
  };

  const removeTeamMember = async (teamName: string, memberName: string) => {
    try {
      const teamQuery = query(collection(db, "teamMembers"), where("team", "==", teamName));
      const teamSnapshot = await getDocs(teamQuery);
      
      if (!teamSnapshot.empty) {
        const teamData = teamSnapshot.docs[0].data();
        const updatedMembers = (teamData.members || []).filter((member: string) => member !== memberName);
        await updateDoc(doc(db, "teamMembers", teamSnapshot.docs[0].id), {
          members: updatedMembers,
          updatedAt: serverTimestamp()
        });
        
        // Refresh team data
        await fetchTeamMembers();
        toast.success(`Removed ${memberName} from ${teamName}`);
      }
    } catch (error) {
      console.error("Error removing team member:", error);
      toast.error("Failed to remove team member");
    }
  };

  const [dispatchData, setDispatchData] = useState<DispatchDataState>(() => createInitialDispatchState());

  useEffect(() => {
    if (!dispatchData.driverId) {
      return;
    }
    const match = driverOptions.find(option => option.id === dispatchData.driverId);
    if (match && dispatchData.driverName !== match.name) {
      setDispatchData(prev => ({
        ...prev,
        driverName: match.name
      }));
    }
  }, [dispatchData.driverId, dispatchData.driverName, driverOptions]);

  useEffect(() => {
    if (!dispatchData.vehicleId) {
      return;
    }
    const match = vehicleOptions.find(option => option.id === dispatchData.vehicleId);
    if (match && dispatchData.vehicleName !== match.name) {
      setDispatchData(prev => ({
        ...prev,
        vehicleName: match.name
      }));
    }
  }, [dispatchData.vehicleId, dispatchData.vehicleName, vehicleOptions]);

  const [patients, setPatients] = useState([
    {
      id: 1,
      name: "",
      contactNumber: "",
      address: "",
      religion: "",
      birthday: "",
      bloodType: "",
      civilStatus: "",
      age: "",
      pwd: "",
      ageGroup: "",
      gender: "",
      companionName: "",
      companionContact: "",
      latitude: "",
      longitude: "",
      gcs: {
        eyes: "",
        verbal: "",
        motor: ""
      },
      pupil: "",
      lungSounds: "",
      perfusion: {
        skin: "",
        pulse: ""
      },
      vitalSigns: {
        timeTaken: "",
        temperature: "",
        pulseRate: "",
        respiratoryRate: "",
        bloodPressure: "",
        spo2: "",
        spo2WithO2Support: false,
        randomBloodSugar: "",
        painScale: ""
      }
    }
  ]);
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0);

  // Helper functions for patient management
  const addNewPatient = () => {
    const newPatient = {
      id: Math.max(...patients.map(p => p.id), 0) + 1,
      name: "",
      contactNumber: "",
      address: "",
      latitude: "",
      longitude: "",
      religion: "",
      birthday: "",
      bloodType: "",
      civilStatus: "",
      age: "",
      pwd: "",
      ageGroup: "",
      gender: "",
      companionName: "",
      companionContact: "",
      gcs: {
        eyes: "",
        verbal: "",
        motor: ""
      },
      pupil: "",
      lungSounds: "",
      perfusion: {
        skin: "",
        pulse: ""
      },
      vitalSigns: {
        timeTaken: "",
        temperature: "",
        pulseRate: "",
        respiratoryRate: "",
        bloodPressure: "",
        spo2: "",
        spo2WithO2Support: false,
        randomBloodSugar: "",
        painScale: ""
      }
    };
    setPatients([...patients, newPatient]);
    setCurrentPatientIndex(patients.length);
  };

  const removePatient = (patientIndex: number) => {
    if (patients.length <= 1) return; // Don't allow removing the last patient
    const newPatients = patients.filter((_, index) => index !== patientIndex);
    setPatients(newPatients);
    if (currentPatientIndex >= newPatients.length) {
      setCurrentPatientIndex(newPatients.length - 1);
    }
  };

  const updateCurrentPatient = (updates: any) => {
    setPatients(prev => prev.map((patient, index) => 
      index === currentPatientIndex ? { ...patient, ...updates } : patient
    ));
  };

  const currentPatient = patients[currentPatientIndex] || patients[0];
  const currentPatientBirthdayDate = currentPatient?.birthday ? new Date(currentPatient.birthday) : null;
  const isCurrentPatientBirthdayValid =
    !!currentPatientBirthdayDate && !Number.isNaN(currentPatientBirthdayDate.getTime());
  const formattedCurrentPatientBirthday = isCurrentPatientBirthdayValid
    ? format(currentPatientBirthdayDate!, "PPP")
    : null;

  // Function to upload media files to Firebase Storage
  const handleMediaUpload = async (files?: File[]) => {
    const filesToUpload = files || selectedFiles;
    if (!filesToUpload || filesToUpload.length === 0) {
      toast.error('No files selected for upload');
      return;
    }

    if (!selectedReport?.id) {
      toast.error('No report selected for upload');
      return;
    }
    
    setUploadingMedia(true);
    const uploadedUrls: string[] = [];
    
    try {
      console.log('Starting upload process...');
      console.log('Files to upload:', filesToUpload.length);
      console.log('Report ID:', selectedReport.id);
      
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        console.log(`Uploading file ${i + 1}/${filesToUpload.length}:`, file.name, file.type, file.size);
        
        // Create unique filename with timestamp and random suffix
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileExtension = file.name.split('.').pop() || '';
        const fileName = `media_${timestamp}_${randomSuffix}.${fileExtension}`;
        
        // Create storage reference using the same structure as mobile app
        // Structure: report_images/{userId}/{reportId}/admin/{fileName}
        const storageRef = ref(storage, `report_images/${selectedReport.userId}/${selectedReport.id}/admin/${fileName}`);
        console.log('Storage path:', `report_images/${selectedReport.userId}/${selectedReport.id}/admin/${fileName}`);
        
        // Upload file
        console.log('Uploading bytes...');
        const uploadResult = await uploadBytes(storageRef, file);
        console.log('Upload bytes result:', uploadResult);
        
        // Get download URL
        console.log('Getting download URL...');
        const downloadURL = await getDownloadURL(storageRef);
        console.log('Download URL:', downloadURL);
        
        uploadedUrls.push(downloadURL);
        console.log(`File ${i + 1} uploaded successfully`);
      }
      
      // Update the preview data with new URLs (save as admin media)
      setPreviewEditData((d: any) => ({
        ...d,
        adminMedia: [...(d.adminMedia || []), ...uploadedUrls]
      }));
      
      // Clear selected files after successful upload
      setSelectedFiles([]);
      
      console.log('All files uploaded successfully:', uploadedUrls);
      toast.success(`${filesToUpload.length} file(s) uploaded successfully!`);
    } catch (error: any) {
      console.error('Error uploading media files:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to upload media files. Please try again.';
      
      // Provide more specific error messages
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'You are not authorized to upload files. Please check your permissions.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Upload was canceled.';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'An unknown error occurred during upload.';
      } else if (error.code === 'storage/invalid-format') {
        errorMessage = 'Invalid file format. Please check the file type.';
      } else if (error.code === 'storage/object-not-found') {
        errorMessage = 'Storage object not found.';
      } else if (error.code === 'storage/bucket-not-found') {
        errorMessage = 'Storage bucket not found. Please check your Firebase configuration.';
      } else if (error.code === 'storage/project-not-found') {
        errorMessage = 'Firebase project not found. Please check your configuration.';
      }
      
      toast.error(errorMessage);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Function to handle file selection
  const handleFileSelection = (files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    setSelectedFiles(prev => [...prev, ...fileArray]);
  };

  // Function to remove selected file
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => {
      const fileToRemove = prev[index];
      // Clean up object URL for the removed file to prevent memory leaks
      if (fileToRemove) {
        const objectUrl = URL.createObjectURL(fileToRemove);
        URL.revokeObjectURL(objectUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Function to clear all selected files
  const clearSelectedFiles = () => {
    // Clean up object URLs to prevent memory leaks
    selectedFiles.forEach(file => {
      const objectUrl = URL.createObjectURL(file);
      URL.revokeObjectURL(objectUrl);
    });
    setSelectedFiles([]);
  };

  // Function to upload document to Firebase Storage
  const handleDocumentUpload = async (file: File) => {
    if (!file) return;
    
    if (!selectedReport?.id) {
      toast.error('No report selected for upload');
      return;
    }
    
    setUploadingDocument(true);
    
    try {
      console.log('Uploading document:', file.name, file.type, file.size);
      
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `document_${timestamp}_${randomSuffix}.${fileExtension}`;
      
      const storageRef = ref(storage, `reports/${selectedReport.id}/documents/${fileName}`);
      console.log('Document storage path:', `reports/${selectedReport.id}/documents/${fileName}`);
      
      // Upload file
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Document download URL:', downloadURL);
      
      // Update the preview data with new URL
      setPreviewEditData((d: any) => ({
        ...d,
        attachedDocument: downloadURL
      }));
      
      toast.success('Document uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      console.error('Document upload error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to upload document. Please try again.';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'You are not authorized to upload files. Please check your permissions.';
      } else if (error.code === 'storage/bucket-not-found') {
        errorMessage = 'Storage bucket not found. Please check your Firebase configuration.';
      }
      
      toast.error(errorMessage);
    } finally {
      setUploadingDocument(false);
    }
  };

  // Function to open image preview
  const handleImagePreview = (imageUrl: string, imageName: string) => {
    console.log('Setting image preview:', imageUrl, imageName);
    setPreviewImageUrl(imageUrl);
    setPreviewImageName(imageName);
    setShowImagePreview(true);
  };

  // Function to download image
  const handleDownloadImage = async (imageUrl: string, imageName: string) => {
    try {
      const response = await ensureOk(await fetch(imageUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = imageName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully!');
    } catch (error: any) {
      console.error('Error downloading image:', error);
      toast.error(error?.status ? getHttpStatusMessage(error.status) : 'Failed to download image. Please try again.');
    }
  };

  // Function to delete image from report
  const handleDeleteImage = async (imageUrl: string, imageIndex: number) => {
    try {
      // Remove from preview data (mobile media)
      setPreviewEditData((d: any) => ({
        ...d,
        mobileMedia: d.mobileMedia.filter((_: any, index: number) => index !== imageIndex)
      }));
      
      // Close preview if this image was being previewed
      if (previewImageUrl === imageUrl) {
        setShowImagePreview(false);
      }
      
      toast.success('Mobile image removed successfully!');
    } catch (error) {
      console.error('Error deleting mobile image:', error);
      toast.error('Failed to delete mobile image. Please try again.');
    }
  };

  // Function to delete admin-added image from report
  const handleDeleteAdminImage = async (imageUrl: string, imageIndex: number) => {
    try {
      // Remove from preview data (admin media)
      setPreviewEditData((d: any) => ({
        ...d,
        adminMedia: d.adminMedia.filter((_: any, index: number) => index !== imageIndex)
      }));
      
      // Close preview if this image was being previewed
      if (previewImageUrl === imageUrl) {
        setShowImagePreview(false);
      }
      
      toast.success('Admin image removed successfully!');
    } catch (error) {
      console.error('Error deleting admin image:', error);
      toast.error('Failed to delete admin image. Please try again.');
    }
  };

  // Function to reverse geocode coordinates to get address
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('Mapbox access token not available');
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}&types=address,poi,place,locality,neighborhood`;
      const data = await ensureOk(await fetch(url)).then(r => r.json());
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        return feature.place_name || feature.text || 'Unknown Location';
      } else {
        return 'Unknown Location';
      }
    } catch (error: any) {
      console.error('Error reverse geocoding:', error);
      toast.error(error?.status ? getHttpStatusMessage(error.status) : 'Failed to reverse geocode location.');
      return 'Unknown Location';
    }
  };

  // Function to handle map click for location selection
  const handleMapClick = async (lngLat: { lng: number; lat: number }) => {
    try {
      const address = await reverseGeocode(lngLat.lat, lngLat.lng);
      setNewLocation({
        lat: lngLat.lat,
        lng: lngLat.lng,
        address: address
      });
    } catch (error) {
      console.error('Error getting address for clicked location:', error);
      toast.error('Failed to get address for selected location');
    }
  };

  // Function to handle map click for patient location selection
  const handlePatientLocationMapClick = async (lngLat: { lng: number; lat: number }) => {
    try {
      const address = await reverseGeocode(lngLat.lat, lngLat.lng);
      setPatientLocationData({
        lat: lngLat.lat,
        lng: lngLat.lng,
        address: address
      });
    } catch (error) {
      console.error('Error getting address for clicked location:', error);
      toast.error('Failed to get address for selected location');
    }
  };

  // Function to save patient location
  const handleSavePatientLocation = () => {
    if (patientLocationData) {
      updateCurrentPatient({
        address: patientLocationData.address,
        latitude: patientLocationData.lat.toString(),
        longitude: patientLocationData.lng.toString()
      });
      setShowPatientLocationMap(false);
      setPatientLocationData(null);
      toast.success('Patient location pinned successfully!');
    }
  };

  // Function to save new location
  const handleSaveLocation = async () => {
    if (newLocation && selectedReport) {
      setIsSavingLocation(true);
      try {
        // Update the database using the Firestore document ID
        await updateDoc(doc(db, "reports", selectedReport.firestoreId), {
          location: newLocation.address,
          coordinates: `${newLocation.lat}, ${newLocation.lng}`,
          updatedAt: serverTimestamp(),
          lastModifiedBy: currentUser?.id
        });

        // Log activity
        await logActivity({
          actionType: ActionType.REPORT_UPDATED,
          action: `Updated report "${selectedReport.type || 'Unknown'} Incident" (${selectedReport.firestoreId}) - Changed location`,
          entityType: 'report',
          entityId: selectedReport.firestoreId,
          entityName: `${selectedReport.type || 'Unknown'} Incident`,
          changes: {
            location: { from: selectedReport.location || '', to: newLocation.address }
          },
          metadata: {
            coordinates: `${newLocation.lat}, ${newLocation.lng}`
          }
        });

        // Update the local state
        setPreviewEditData((d: any) => ({
          ...d,
          location: newLocation.address,
          coordinates: `${newLocation.lat}, ${newLocation.lng}`
        }));

        // Update the selectedReport state to reflect the change
        setSelectedReport((prev: any) => ({
          ...prev,
          location: newLocation.address,
          coordinates: `${newLocation.lat}, ${newLocation.lng}`
        }));

        setShowLocationMap(false);
        setNewLocation(null);
        toast.success('Location updated successfully!');
      } catch (error) {
        console.error('Error updating location:', error);
        toast.error('Failed to update location. Please try again.');
      } finally {
        setIsSavingLocation(false);
      }
    }
  };

  return (
    <Layout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Total Reports</p>
                      <p className="text-xs text-brand-orange font-medium">All time</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">{totalReports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CalendarIcon className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Reports This Week</p>
                      <p className="text-xs text-brand-orange font-medium">Last 7 days</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">{reportsThisWeek}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Pending Reports</p>
                    <p className="text-xs text-brand-orange font-medium">Needs attention</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">{pendingReports}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Activity className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Avg Response Time</p>
                    <p className="text-xs text-brand-orange font-medium">
                      {averageResponseTime ? `Based on ${averageResponseTime.count} reports` : 'No data'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">
                    {averageResponseTime ? averageResponseTime.formatted : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Table */}
        <Card className="shadow-sm">
          {/* Table Toolbar */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Add New Report Button */}
              {canEditReports() ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      New
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new emergency report manually</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white opacity-50 cursor-not-allowed">
                        <Plus className="h-4 w-4 mr-2" />
                        New
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>You don't have permission to create reports. Contact your super admin for access.</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Search Bar */}
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search reports..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-9" 
                />
              </div>

          {/* Date Range Filter */}
          <DateRangePicker
            value={date}
            onChange={setDate}
            className="w-auto"
          />

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-auto">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="group">
                  <span className="flex items-center gap-2 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange">
                    <Layers className="h-4 w-4 text-gray-500 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange" />
                    <span>All Types</span>
                  </span>
                </SelectItem>
                {REPORT_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value} className="group">
                    {renderReportTypeOption(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="not-responded">Not Responded</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="false-report">False Report</SelectItem>
                  <SelectItem value="redundant">Redundant</SelectItem>
                </SelectContent>
              </Select>

              {/* Action Buttons */}
              {selectedReports.length > 0 && (
                canDeleteReports() ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleBatchDelete} variant="destructive" size="sm" className="bg-brand-red hover:bg-brand-red-700 text-white">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedReports.length})
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete {selectedReports.length} selected report(s)</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled variant="destructive" size="sm" className="bg-brand-red hover:bg-brand-red-700 text-white opacity-50 cursor-not-allowed">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({selectedReports.length})
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>You don't have permission to delete reports. Contact your super admin for access.</p>
                    </TooltipContent>
                  </Tooltip>
                )
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleExportCSV} size="sm" variant="outline" className="ml-auto">
                    <FileDown className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export reports to CSV</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={paginatedReports.length > 0 && paginatedReports.every(report => selectedReports.includes(report.firestoreId))}
                        onCheckedChange={(checked: boolean) => handleSelectAll(checked)}
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                        onClick={() => {
                          // Clear date sort when sorting by ID
                          setDateSort(null);
                          if (idSort === 'desc') {
                            setIdSort('asc');
                          } else if (idSort === 'asc') {
                            setIdSort('desc');
                          } else {
                            setIdSort('asc');
                          }
                        }}
                      >
                        Report ID
                        {idSort === 'asc' ? (
                          <ArrowUp className="h-4 w-4 text-brand-orange" />
                        ) : idSort === 'desc' ? (
                          <ArrowDown className="h-4 w-4 text-brand-orange" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                        onClick={() => {
                          // Clear ID sort when sorting by date
                          setIdSort(null);
                          if (dateSort === 'desc') {
                            setDateSort('asc');
                          } else if (dateSort === 'asc') {
                            setDateSort('desc');
                          } else {
                            setDateSort('desc');
                          }
                        }}
                      >
                        Date Submitted
                        {dateSort === 'asc' ? (
                          <ArrowUp className="h-4 w-4 text-brand-orange" />
                        ) : dateSort === 'desc' ? (
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
                  {isLoadingReports ? (
                    // Loading skeleton
                    Array.from({ length: itemsPerPage }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell><div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <FileText className="h-12 w-12 mb-2 text-gray-400" />
                          <p className="text-lg font-medium">No reports found</p>
                          <p className="text-sm">Try adjusting your filters or search terms</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedReports.map(report => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReports.includes(report.firestoreId)}
                          onCheckedChange={() => handleCheckboxChange(report.firestoreId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{report.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            "flex items-center gap-1.5 border-0 bg-transparent",
                            report.type === 'Road Crash' ? 'text-red-600' :
                            report.type === 'Fire' ? 'text-orange-600' :
                            report.type === 'Medical Emergency' ? 'text-pink-600' :
                            report.type === 'Flooding' ? 'text-blue-600' :
                            report.type === 'Volcanic Activity' ? 'text-amber-600' :
                            report.type === 'Landslide' ? 'text-yellow-800' :
                            report.type === 'Earthquake' ? 'text-red-800' :
                            report.type === 'Civil Disturbance' ? 'text-violet-600' :
                            report.type === 'Armed Conflict' ? 'text-red-800' :
                            report.type === 'Infectious Disease' ? 'text-emerald-600' :
                            report.type === 'Poor Infrastructure' ? 'text-amber-800' :
                            report.type === 'Obstructions' ? 'text-yellow-600' :
                            report.type === 'Electrical Hazard' ? 'text-yellow-500' :
                            report.type === 'Environmental Hazard' ? 'text-green-600' :
                            'text-gray-600'
                          )}>
                            {(() => {
                              const Icon = getReportTypeIcon(report.type);
                              return <Icon className="h-3.5 w-3.5" />;
                            })()}
                            {report.type}
                          </Badge>
                          {isNewReport(report) && (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-50 font-semibold animate-pulse">
                              NEW
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {report.reportedBy ? (
                          <button
                            type="button"
                            className="text-gray-900 hover:underline focus:outline-none flex items-center gap-1"
                            onClick={() => navigate("/manage-users", { state: { tab: "residents", search: report.reportedBy } })}
                            title="View Resident Account"
                          >
                            {report.reportedBy}
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.dateSubmitted}
                        <br />
                        <span className="text-xs text-gray-500">{report.timeSubmitted}</span>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={report.status} 
                          onValueChange={(newStatus) => handleStatusChange(report.firestoreId, newStatus)}
                        >
                          <SelectTrigger className={cn(
                            "w-auto border-0 bg-transparent font-medium focus:ring-1 focus:ring-brand-orange",
                            report.status === 'Pending' && 'text-orange-600',
                            report.status === 'Ongoing' && 'text-blue-600',
                            report.status === 'Not Responded' && 'text-red-600',
                            report.status === 'Responded' && 'text-green-600',
                            report.status === 'False Report' && 'text-gray-600',
                            report.status === 'Redundant' && 'text-purple-600'
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Ongoing">Ongoing</SelectItem>
                            <SelectItem value="Not Responded">Not Responded</SelectItem>
                            <SelectItem value="Responded">Responded</SelectItem>
                            <SelectItem value="False Report">False Report</SelectItem>
                            <SelectItem value="Redundant">Redundant</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    console.log("Opening report preview for:", report);
                                    setSelectedReport(report);
                                    setShowPreviewModal(true);
                                    setPreviewTab("details"); // Reset to details tab
                                    
                                    // Mark report as viewed
                                    setViewedReports(prev => new Set(prev).add(report.id));
                                    
                                    // Load existing dispatch data from database using Firestore document ID
                                    const existingDispatchData = await loadDispatchDataFromDatabase(report.firestoreId);
                                    
                                    // Load existing patient data from database using Firestore document ID
                                    await loadPatientDataFromDatabase(report.firestoreId);
                                    
                                    // Only auto-populate if no existing dispatch data AND no receivedBy/timeCallReceived
                                    if (!existingDispatchData || (!existingDispatchData.receivedBy && !existingDispatchData.timeCallReceived)) {
                                      if (currentUser) {
                                        const newDispatchData = {
                                          receivedBy: currentUser.name,
                                          timeCallReceived: getCurrentTime()
                                        };
                                        
                                        // Set the data in state
                                        setDispatchData(prev => ({
                                          ...prev,
                                          ...newDispatchData
                                        }));
                                        
                                        // Immediately save to database to prevent other users from overwriting using Firestore document ID
                                        await saveDispatchDataToDatabase(report.firestoreId, {
                                          ...existingDispatchData,
                                          ...newDispatchData
                                        });
                                      }
                                    }
                                  } catch (error) {
                                    console.error("Error opening report preview:", error);
                                    toast.error("Failed to open report preview");
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View report details</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          {canAddReportToMap() ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePinOnMap(report)}
                                >
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Pin location on map</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="opacity-50 cursor-not-allowed"
                                  >
                                    <MapPin className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>You don't have permission to add reports to map. Contact your super admin for access.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setShowPreviewModal(true);
                                  setPreviewTab("details");
                                  setTimeout(() => {
                                    handlePrintPreview();
                                  }, 100);
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Print report</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          {canDeleteReports() ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteReport(report.firestoreId)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete report</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="opacity-50 cursor-not-allowed"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>You don't have permission to delete reports. Contact your super admin for access.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="border-t border-gray-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700">
                  Showing {filteredReports.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredReports.length)} of {filteredReports.length} results
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-700">Rows per page:</Label>
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="px-2 text-gray-500">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Report Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader className="border-b border-gray-200 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#FF4F0B]" />
                Add New Report
              </DialogTitle>
              <DialogDescription>
                Please fill out the required details to create a new emergency report.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select value={formData.type} onValueChange={value => setFormData({
                    ...formData,
                    type: value
                  })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="group">
                          {renderReportTypeOption(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={value => setFormData({
                  ...formData,
                  status: value
                })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Ongoing">Ongoing</SelectItem>
                      <SelectItem value="Not Responded">Not Responded</SelectItem>
                      <SelectItem value="Responded">Responded</SelectItem>
                      <SelectItem value="False Report">False Report</SelectItem>
                      <SelectItem value="Redundant">Redundant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reported-by">Reported By</Label>
                  <div className="relative">
                    <Input 
                      id="reported-by" 
                      value={formData.reportedBy} 
                      onChange={e => {
                        const value = e.target.value;
                        setFormData({
                          ...formData,
                          reportedBy: value
                        });
                        // Update resident search to trigger filtering
                        setResidentSearch(value);
                        // Always show suggestions when typing (filtering will happen automatically)
                        setShowResidentSearch(true);
                      }} 
                      onFocus={() => {
                        // Show suggestions when focused
                        // If input is empty, show all residents; otherwise show filtered results
                        if (formData.reportedBy.length === 0) {
                          setResidentSearch("");
                          setShowResidentSearch(true);
                        } else {
                          setShowResidentSearch(true);
                        }
                      }}
                      placeholder="Search or enter reporter name" 
                    />
                    {showResidentSearch && filteredResidents.length > 0 && (
                      <div className="resident-search-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredResidents.map((resident) => (
                          <div
                            key={resident.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                reportedBy: resident.name || resident.email || ""
                              });
                              setResidentSearch("");
                              setShowResidentSearch(false);
                            }}
                          >
                            <div className="text-sm font-medium">{resident.name || "No name"}</div>
                            {resident.email && (
                              <div className="text-xs text-gray-500">{resident.email}</div>
                            )}
                            {resident.mobileNumber && (
                              <div className="text-xs text-gray-500">{resident.mobileNumber}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {showResidentSearch && filteredResidents.length === 0 && residentSearch.trim().length > 0 && (
                      <div className="resident-search-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                        <div className="text-sm text-gray-500 text-center">No residents found</div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="barangay">Barangay</Label>
                  <Select value={formData.barangay} onValueChange={value => setFormData({
                  ...formData,
                  barangay: value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select barangay" />
                    </SelectTrigger>
                    <SelectContent>
                      {barangayOptions.map(barangay => <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={e => setFormData({
                ...formData,
                description: e.target.value
              })} placeholder="Describe the incident..." />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <div className="flex gap-2">
                  <Input 
                    id="location" 
                    value={formData.location} 
                    readOnly
                    placeholder="Pin location on map to set address" 
                    className="bg-gray-50 cursor-not-allowed flex-1"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setShowAddLocationMap(true)}
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select location on map</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {addLocationData && (
                  <div className="text-xs text-gray-500 mt-1">
                    Coordinates: {addLocationData.lat}, {addLocationData.lng}
                  </div>
                )}
                <div className="text-xs text-brand-orange mt-1 cursor-pointer hover:underline" 
                     onClick={async () => {
                       try {
                         const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                           navigator.geolocation.getCurrentPosition(resolve, reject);
                         });
                         
                         const lat = position.coords.latitude;
                         const lng = position.coords.longitude;
                         
                         const address = await reverseGeocode(lat, lng);
                         setAddLocationData({ lat, lng, address });
                         setFormData(prev => ({
                           ...prev,
                           location: address,
                           latitude: lat,
                           longitude: lng
                         }));
                         toast.success('Location set to your current location');
                       } catch (error) {
                         console.error('Error getting current location:', error);
                         toast.error('Failed to get current location. Please enable location permissions.');
                       }
                     }}>
                  📍 Get Current Location
                </div>
              </div>

              <div>
                <Label>Attached Media</Label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center relative"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-brand-orange', 'bg-orange-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-brand-orange', 'bg-orange-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-brand-orange', 'bg-orange-50');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleFileSelection(files);
                    }
                  }}
                >
                  <input 
                    type="file" 
                    id="file-upload-input"
                    multiple 
                    accept="image/*,video/*" 
                    className="hidden"
                    onChange={(e) => handleFileSelection(e.target.files)}
                  />
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-3">Drag & drop files here or</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Upload images, documents, audio, or video files up to 25 MB each.
                </p>
                
                {/* Show selected files */}
                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        Selected Files ({selectedFiles.length})
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearSelectedFiles}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Clear All
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {selectedFiles.map((file, index) => {
                        const isImage = file.type.startsWith('image/');
                        const isVideo = file.type.startsWith('video/');
                        const fileUrl = filePreviewUrls[index];
                        
                        return (
                          <div key={`${file.name}-${file.size}-${index}`} className="relative border border-gray-200 rounded-lg p-2 bg-gray-50">
                            {isImage && (
                              <img 
                                src={fileUrl} 
                                alt={file.name}
                                className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  setPreviewImageUrl(fileUrl);
                                  setPreviewImageName(file.name);
                                  setShowImagePreview(true);
                                }}
                              />
                            )}
                            {isVideo && (
                              <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center">
                                <FileIcon className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                            {!isImage && !isVideo && (
                              <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center">
                                <FileIcon className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                            <div className="mt-1">
                              <p className="text-xs text-gray-600 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 bg-white hover:bg-red-100"
                              onClick={() => removeSelectedFile(index)}
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                onClick={handleAddReport}
                disabled={isAddingReport || isUploadingMedia}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isAddingReport || isUploadingMedia) ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isUploadingMedia ? "Uploading media..." : "Adding..."}
                  </div>
                ) : (
                  "Add Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Preview Report Modal */}
        <Dialog open={showPreviewModal} onOpenChange={(open) => {
          console.log("Preview modal state change:", open, "selectedReport:", selectedReport);
          setShowPreviewModal(open);
          if (!open) {
            // Reset all states when modal is closed
            setSelectedReport(null);
            setPreviewTab("details");
            setIsPreviewEditMode(false);
            setIsDispatchEditMode(false);
            setIsPatientEditMode(false);
            setPreviewEditData(null);
            setShowPreviewResidentSearch(false);
            setPreviewResidentSearch("");
            // Reset dispatch data when modal is closed
            setDispatchData(createInitialDispatchState());
            // Reset patient data when modal is closed
            setPatients([{
              id: 1,
              name: "",
              contactNumber: "",
              address: "",
              religion: "",
              birthday: "",
              bloodType: "",
              civilStatus: "",
              age: "",
              pwd: "",
              ageGroup: "",
              gender: "",
              companionName: "",
              companionContact: "",
              latitude: "",
              longitude: "",
              gcs: {
                eyes: "",
                verbal: "",
                motor: ""
              },
              pupil: "",
              lungSounds: "",
              perfusion: {
                skin: "",
                pulse: ""
              },
              vitalSigns: {
                timeTaken: "",
                temperature: "",
                pulseRate: "",
                respiratoryRate: "",
                bloodPressure: "",
                spo2: "",
                spo2WithO2Support: false,
                randomBloodSugar: "",
                painScale: ""
              }
            }]);
            setCurrentPatientIndex(0);
          }
        }}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] bg-white flex flex-col overflow-hidden">
            {selectedReport ? (
              <>
                {/* Header Row: Title, Icon, and Report ID */}
                <div className="mb-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-brand-orange" />
                    <h2 className="text-xl font-semibold text-gray-900">Report Preview</h2>
                    <span className="inline-flex items-center rounded-md border border-brand-orange/40 bg-orange-50 px-3 py-1 text-sm font-medium text-brand-orange">
                      {selectedReport.id}
                    </span>
                  </div>
                </div>
                {/* Navigation Tabs */}
                <Tabs value={previewTab} onValueChange={setPreviewTab} className="w-full flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mb-1">
                <TabsTrigger value="directions">Directions</TabsTrigger>
                <TabsTrigger value="details">Report Details</TabsTrigger>
                <TabsTrigger value="dispatch">Dispatch Form</TabsTrigger>
                <TabsTrigger value="patient">Patient Information</TabsTrigger>
              </TabsList>

              <TabsContent value="directions" className="mt-2 flex-1 min-h-0 flex flex-col">
                {/* Info Box */}
                <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-start gap-3">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    Click on the marker to reveal route/directions and additional information.
                  </p>
                </div>
                <div className="flex-1 w-full relative min-h-0" style={{ height: 'calc(90vh - 200px)' }}>
                  {selectedReport ? (
                    <div 
                      id="report-map-container"
                      className="w-full h-full rounded-lg overflow-hidden relative"
                    >
                      {/* Preview Map Toolbar (matches RiskMap style but simplified) */}
                      <div className="absolute top-3 left-3 right-3 z-10 bg-white border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-lg rounded-lg">
                        {/* Search */}
                        <div className="flex-1 relative">
                          <Popover open={isPreviewSearchOpen} onOpenChange={setIsPreviewSearchOpen}>
                            <PopoverTrigger asChild>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
                                <Input
                                  type="text"
                                  placeholder="Search for a location..."
                                  value={previewSearchQuery}
                                  onChange={(e) => {
                                    setPreviewSearchQuery(e.target.value);
                                    setIsPreviewSearchOpen(true);
                                  }}
                                  onFocus={() => {
                                    if (previewSearchSuggestions.length > 0) setIsPreviewSearchOpen(true);
                                  }}
                                  className="pl-9 pr-4 h-9 w-full border-gray-300"
                                />
                              </div>
                            </PopoverTrigger>
                            {previewSearchSuggestions.length > 0 && (
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <div className="max-h-[300px] overflow-y-auto">
                                  {previewSearchSuggestions.map((s: any, idx: number) => (
                                    <button
                                      key={idx}
                                      className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                                      onClick={() => {
                                        const [lng, lat] = s.geometry.coordinates;
                                        setPreviewMapCenter([lng, lat]);
                                        setPreviewMapZoom(15);
                                        setPreviewSearchQuery(s.place_name || s.text || 'Selected location');
                                        setIsPreviewSearchOpen(false);
                                      }}
                                    >
                                      <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">{s.text}</p>
                                          <p className="text-xs text-gray-500 truncate">{s.place_name}</p>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            )}
                          </Popover>
                        </div>

                      </div>

                      <MapboxMap 
                        center={previewMapCenter}
                        zoom={previewMapZoom}
                        showControls={true}
                        showGeocoder={false}
                        singleMarker={selectedReport.latitude && selectedReport.longitude ? 
                          {
                            id: selectedReport.id || 'report-marker',
                            type: selectedReport.type || 'Emergency',
                            title: selectedReport.location || 'Report Location',
                            description: selectedReport.description || 'Emergency report location',
                            reportId: selectedReport.id,
                            coordinates: [Number(selectedReport.longitude), Number(selectedReport.latitude)] as [number, number],
                            status: selectedReport.status,
                            locationName: selectedReport.location,
                            latitude: Number(selectedReport.latitude),
                            longitude: Number(selectedReport.longitude)
                          } : 
                          undefined}
                        disableSingleMarkerPulse={true}
                        hideStyleToggle={true}
                      />
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center flex items-center justify-center h-full">
                      <div>
                        <MapPin className="h-12 w-12 mx-auto mb-2" />
                        <p>No location data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="details" className="mt-2 flex-1 min-h-0 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                  <div className="text-lg font-semibold text-gray-800">Report Details</div>
                  <div className="flex gap-2 flex-wrap">
                    {isPreviewEditMode ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white" onClick={() => {
                            console.log('Saving changes:', previewEditData);
                            setSelectedReport(previewEditData);
                            setIsPreviewEditMode(false);
                            setSelectedFiles([]); // Clear selected files when saving
                          }}>
                            Save
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Save changes to report details</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      canEditReports() ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="border-gray-300 text-gray-800 hover:bg-gray-50" onClick={() => {
                              setIsPreviewEditMode(true);
                              setPreviewEditData({ ...selectedReport });
                              setSelectedFiles([]); // Clear any previously selected files
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit report details</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant="outline" className="border-gray-300 text-gray-800 hover:bg-gray-50 opacity-50 cursor-not-allowed" disabled>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>You don't have permission to edit reports. Contact your super admin for access.</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table className="w-full min-w-[600px]">
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Date & Time Submitted</TableCell>
                        <TableCell>
                          {selectedReport?.dateSubmitted && selectedReport?.timeSubmitted ? (
                            <div>
                              {selectedReport.dateSubmitted}
                              <br />
                              <span className="text-xs text-gray-600">{selectedReport.timeSubmitted}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Not available</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Status</TableCell>
                        <TableCell>
                          {isPreviewEditMode ? (
                            <Select value={previewEditData?.status} onValueChange={v => setPreviewEditData((d: any) => ({ ...d, status: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Ongoing">Ongoing</SelectItem>
                                <SelectItem value="Not Responded">Not Responded</SelectItem>
                                <SelectItem value="Responded">Responded</SelectItem>
                                <SelectItem value="False Report">False Report</SelectItem>
                                <SelectItem value="Redundant">Redundant</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={cn(
                              "capitalize border-0 bg-transparent",
                              selectedReport?.status === "Pending" && "text-orange-600",
                              selectedReport?.status === "Ongoing" && "text-blue-600",
                              selectedReport?.status === "Not Responded" && "text-red-600",
                              selectedReport?.status === "Responded" && "text-green-600",
                              selectedReport?.status === "False Report" && "text-gray-600",
                              selectedReport?.status === "Redundant" && "text-purple-600"
                            )}>
                              {selectedReport?.status}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Report Type</TableCell>
                      <TableCell>
                        {isPreviewEditMode ? (
                          <Select value={previewEditData?.type} onValueChange={v => setPreviewEditData((d: any) => ({ ...d, type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Road Crash">Road Crash</SelectItem>
                              <SelectItem value="Medical Emergency">Medical Emergency</SelectItem>
                              <SelectItem value="Flooding">Flooding</SelectItem>
                              <SelectItem value="Volcanic Activity">Volcanic Activity</SelectItem>
                              <SelectItem value="Landslide">Landslide</SelectItem>
                              <SelectItem value="Earthquake">Earthquake</SelectItem>
                              <SelectItem value="Civil Disturbance">Civil Disturbance</SelectItem>
                              <SelectItem value="Armed Conflict">Armed Conflict</SelectItem>
                              <SelectItem value="Infectious Disease">Infectious Disease</SelectItem>
                              <SelectItem value="Poor Infrastructure">Poor Infrastructure</SelectItem>
                              <SelectItem value="Obstructions">Obstructions</SelectItem>
                              <SelectItem value="Electrical Hazard">Electrical Hazard</SelectItem>
                              <SelectItem value="Environmental Hazard">Environmental Hazard</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={cn(
                            "flex items-center gap-1.5 border-0 bg-transparent",
                            selectedReport?.type === 'Road Crash' ? 'text-red-600' :
                            selectedReport?.type === 'Fire' ? 'text-orange-600' :
                            selectedReport?.type === 'Medical Emergency' ? 'text-pink-600' :
                            selectedReport?.type === 'Flooding' ? 'text-blue-600' :
                            selectedReport?.type === 'Volcanic Activity' ? 'text-amber-600' :
                            selectedReport?.type === 'Landslide' ? 'text-yellow-800' :
                            selectedReport?.type === 'Earthquake' ? 'text-red-800' :
                            selectedReport?.type === 'Civil Disturbance' ? 'text-violet-600' :
                            selectedReport?.type === 'Armed Conflict' ? 'text-red-800' :
                            selectedReport?.type === 'Infectious Disease' ? 'text-emerald-600' :
                            selectedReport?.type === 'Poor Infrastructure' ? 'text-amber-800' :
                            selectedReport?.type === 'Obstructions' ? 'text-yellow-600' :
                            selectedReport?.type === 'Electrical Hazard' ? 'text-yellow-500' :
                            selectedReport?.type === 'Environmental Hazard' ? 'text-green-600' :
                            'text-gray-600'
                          )}>
                            {(() => {
                              const Icon = getReportTypeIcon(selectedReport?.type || '');
                              return <Icon className="h-3.5 w-3.5" />;
                            })()}
                            {selectedReport?.type}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Reported By</TableCell>
                      <TableCell>
                        {isPreviewEditMode ? (
                          <div className="relative">
                            <Input 
                              id="preview-reported-by"
                              value={previewEditData?.reportedBy || ""} 
                              onChange={e => {
                                const value = e.target.value;
                                setPreviewEditData((d: any) => ({ ...d, reportedBy: value }));
                                // Update preview resident search to trigger filtering
                                setPreviewResidentSearch(value);
                                // Always show suggestions when typing
                                setShowPreviewResidentSearch(true);
                              }}
                              onFocus={() => {
                                // Show suggestions when focused
                                if ((previewEditData?.reportedBy || "").length === 0) {
                                  setPreviewResidentSearch("");
                                  setShowPreviewResidentSearch(true);
                                } else {
                                  setShowPreviewResidentSearch(true);
                                }
                              }}
                              placeholder="Search or enter reporter name" 
                            />
                            {showPreviewResidentSearch && previewFilteredResidents.length > 0 && (
                              <div className="preview-resident-search-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {previewFilteredResidents.map((resident) => (
                                  <div
                                    key={resident.id}
                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors"
                                    onClick={() => {
                                      setPreviewEditData((d: any) => ({
                                        ...d,
                                        reportedBy: resident.name || resident.fullName || resident.email || ""
                                      }));
                                      setPreviewResidentSearch("");
                                      setShowPreviewResidentSearch(false);
                                    }}
                                  >
                                    <div className="text-sm font-medium">{resident.name || resident.fullName || "No name"}</div>
                                    {resident.email && (
                                      <div className="text-xs text-gray-500">{resident.email}</div>
                                    )}
                                    {resident.mobileNumber && (
                                      <div className="text-xs text-gray-500">{resident.mobileNumber}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {showPreviewResidentSearch && previewFilteredResidents.length === 0 && previewResidentSearch.trim().length > 0 && (
                              <div className="preview-resident-search-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                                <div className="text-sm text-gray-500 text-center">No residents found</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          selectedReport?.reportedBy ? (
                            <button
                              type="button"
                              className="text-gray-900 hover:underline focus:outline-none flex items-center gap-1"
                              onClick={() => navigate("/manage-users", { state: { tab: "residents", search: selectedReport?.reportedBy } })}
                              title="View Resident Account"
                            >
                              {selectedReport?.reportedBy}
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">Not specified</span>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Mobile Number</TableCell>
                      <TableCell>
                        {isPreviewEditMode ? (
                          <Input value={previewEditData?.mobileNumber} onChange={e => setPreviewEditData((d: any) => ({ ...d, mobileNumber: e.target.value }))} />
                        ) : (
                          selectedReport?.mobileNumber || <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Barangay</TableCell>
                      <TableCell>
                        {isPreviewEditMode ? (
                          <Popover open={barangayComboboxOpen} onOpenChange={(open) => {
                            setBarangayComboboxOpen(open);
                            if (open) {
                              // Initialize search value with current barangay when opening
                              setBarangaySearchValue(previewEditData?.barangay || "");
                            } else {
                              setBarangaySearchValue("");
                            }
                          }}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={barangayComboboxOpen}
                                className="w-full justify-between font-normal"
                              >
                                {previewEditData?.barangay || "Select or type barangay..."}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput 
                                  placeholder="Search or type barangay..." 
                                  value={barangaySearchValue}
                                  onValueChange={(value) => {
                                    setBarangaySearchValue(value);
                                    // Update barangay value as user types
                                    setPreviewEditData((d: any) => ({ ...d, barangay: value }));
                                  }}
                                  onKeyDown={(e) => {
                                    // Allow Enter to close and accept the typed value
                                    if (e.key === "Enter" && barangaySearchValue.trim()) {
                                      setBarangayComboboxOpen(false);
                                    }
                                  }}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {barangaySearchValue.trim() ? (
                                      <div className="p-2">
                                        <div className="text-sm text-gray-600 mb-1">Press Enter to use:</div>
                                        <div className="text-sm font-medium">{barangaySearchValue}</div>
                                      </div>
                                    ) : (
                                      "Type to search or enter a custom barangay..."
                                    )}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {barangayOptions
                                      .filter((barangay) =>
                                        !barangaySearchValue || 
                                        barangay.toLowerCase().includes(barangaySearchValue.toLowerCase())
                                      )
                                      .map((barangay) => (
                                        <CommandItem
                                          key={barangay}
                                          value={barangay}
                                          onSelect={() => {
                                            setPreviewEditData((d: any) => ({ ...d, barangay }));
                                            setBarangaySearchValue("");
                                            setBarangayComboboxOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              previewEditData?.barangay === barangay ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {barangay}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          selectedReport?.barangay || <span className="text-gray-400 italic">Edit to add Barangay</span>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Description</TableCell>
                      <TableCell>
                        {isPreviewEditMode ? (
                          <Textarea value={previewEditData?.description} onChange={e => setPreviewEditData((d: any) => ({ ...d, description: e.target.value }))} />
                        ) : (
                          selectedReport?.description
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Location</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="text-gray-800">{previewEditData?.location || selectedReport?.location}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {previewEditData?.latitude && previewEditData?.longitude 
                                ? `${previewEditData.latitude}, ${previewEditData.longitude}`
                                : selectedReport?.latitude && selectedReport?.longitude 
                                ? `${selectedReport.latitude}, ${selectedReport.longitude}`
                                : '14.1139, 121.5556'}
                            </div>
                          </div>
                          {isPreviewEditMode && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowLocationMap(true)}
                                  className="flex items-center gap-1"
                                >
                                  <MapPin className="h-4 w-4" />
                                  Pin Location
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Select location on map</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Attached Media</TableCell>
                      <TableCell>
                        <div className="space-y-4">
                          {/* Mobile User Media Section */}
                          <div>
                            <div className="mb-2">
                              <h4 className="text-sm font-medium text-gray-800">Mobile User Media</h4>
                            </div>
                        <div className="flex flex-wrap gap-3 mb-2">
                              {(() => {
                                const mobileMediaArray = isPreviewEditMode ? previewEditData?.mobileMedia : selectedReport?.mobileMedia;
                                console.log('Mobile media array:', mobileMediaArray);
                                
                                if (!mobileMediaArray || mobileMediaArray.length === 0) {
                                  return (
                                    <div className="text-gray-400 text-sm italic">
                                      No mobile attachments
                                    </div>
                                  );
                                }
                                
                                return mobileMediaArray.map((media: string, index: number) => {
                            // Better image detection - check URL path and query parameters
                            const urlPath = media.split('?')[0]; // Remove query parameters
                            const fileExtension = urlPath.split('.').pop()?.toLowerCase();
                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '') || 
                                          media.includes('image') || 
                                          media.includes('photo') ||
                                          media.includes('img');
                            const fileName = urlPath.split('/').pop() || media;
                            
                            return (
                              <div 
                                key={index} 
                                className="relative group"
                              >
                                {isImage ? (
                                  <div 
                                    className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 hover:shadow-md"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('Opening image preview:', media, fileName);
                                      handleImagePreview(media, fileName);
                                    }}
                                    title={`Click to preview: ${fileName}`}
                                  >
                                    <img 
                                      src={media} 
                                      alt={fileName}
                                      className="w-full h-full object-cover"
                                      onLoad={() => console.log('Image loaded successfully:', media)}
                                      onError={(e) => {
                                        console.log('Image failed to load:', media);
                                        // Fallback to icon if image fails to load
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.innerHTML = `
                                            <div class="w-full h-full flex items-center justify-center bg-gray-100">
                                              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                              </svg>
                                            </div>
                                          `;
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    className="w-20 h-20 rounded-lg border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 hover:shadow-md flex items-center justify-center bg-gray-50"
                                    onClick={() => window.open(media, '_blank')}
                                    title={`Click to open: ${fileName}`}
                                  >
                                    <FileIcon className="h-8 w-8 text-gray-400" />
                                  </div>
                                )}
                                
                                {/* Image filename overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <div className="truncate">{fileName}</div>
                                </div>
                                
                                {/* Delete button for edit mode */}
                                {isPreviewEditMode && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(media, index);
                                    }}
                                    className="absolute -top-2 -right-2 bg-brand-red hover:bg-brand-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    title="Delete image"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                            });
                          })()}
                        </div>
                          </div>

                          {/* Admin Added Media Section */}
                          <div className="border-t border-gray-200 pt-4">
                            {isPreviewEditMode ? (
                              // Edit Mode: Show drag & drop upload field (like Add New Report form)
                              <div>
                                <Label>Admin Added Media</Label>
                                <div 
                                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center relative mt-2"
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.classList.add('border-brand-orange', 'bg-orange-50');
                                  }}
                                  onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.classList.remove('border-brand-orange', 'bg-orange-50');
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.classList.remove('border-brand-orange', 'bg-orange-50');
                                    const files = e.dataTransfer.files;
                                    if (files.length > 0) {
                                      handleFileSelection(files);
                                    }
                                  }}
                                >
                                  <input 
                                    type="file" 
                                    id="admin-media-upload-input"
                                    multiple 
                                    accept="image/*,video/*" 
                                    className="hidden"
                                    onChange={(e) => handleFileSelection(e.target.files)}
                                  />
                                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-600 mb-3">Drag & drop files here or</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById('admin-media-upload-input')?.click()}
                                  >
                                    Browse Files
                                  </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                  Upload images, documents, audio, or video files up to 25 MB each.
                                </p>
                                
                                {/* Show existing admin media */}
                                {(() => {
                                  const adminMediaArray = previewEditData?.adminMedia || [];
                                  if (adminMediaArray.length > 0) {
                                    return (
                                      <div className="mt-4">
                                        <div className="mb-2">
                                          <h4 className="text-sm font-medium text-gray-700">Existing Admin Media ({adminMediaArray.length})</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                          {adminMediaArray.map((media: string, index: number) => {
                                            const urlPath = media.split('?')[0];
                                            const fileExtension = urlPath.split('.').pop()?.toLowerCase();
                                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '') || 
                                                          media.includes('image') || 
                                                          media.includes('photo') ||
                                                          media.includes('img');
                                            const fileName = urlPath.split('/').pop() || media;
                                            
                                            return (
                                              <div 
                                                key={index} 
                                                className="relative group"
                                              >
                                                {isImage ? (
                                                  <div 
                                                    className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 hover:shadow-md"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleImagePreview(media, fileName);
                                                    }}
                                                    title={`Click to preview: ${fileName}`}
                                                  >
                                                    <img 
                                                      src={media} 
                                                      alt={fileName}
                                                      className="w-full h-full object-cover"
                                                      onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                          parent.innerHTML = `
                                                            <div class="w-full h-full flex items-center justify-center bg-gray-100">
                                                              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                              </svg>
                                                            </div>
                                                          `;
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                ) : (
                                                  <div 
                                                    className="w-20 h-20 rounded-lg border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 hover:shadow-md flex items-center justify-center bg-gray-50"
                                                    onClick={() => window.open(media, '_blank')}
                                                    title={`Click to open: ${fileName}`}
                                                  >
                                                    <FileIcon className="h-8 w-8 text-gray-400" />
                                                  </div>
                                                )}
                                                
                                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                  <div className="truncate">{fileName}</div>
                                                </div>
                                                
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteAdminImage(media, index);
                                                  }}
                                                  className="absolute -top-2 -right-2 bg-brand-red hover:bg-brand-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                  title="Delete admin image"
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                
                                {/* Show selected files */}
                                {selectedFiles.length > 0 && (
                                  <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-gray-700">
                                        Selected Files ({selectedFiles.length})
                                      </p>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSelectedFiles}
                                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        Clear All
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                      {selectedFiles.map((file, index) => {
                                        const isImage = file.type.startsWith('image/');
                                        const isVideo = file.type.startsWith('video/');
                                        const fileUrl = filePreviewUrls[index];
                                        
                                        return (
                                          <div key={`${file.name}-${file.size}-${index}`} className="relative border border-gray-200 rounded-lg p-2 bg-gray-50">
                                            {isImage && (
                                              <img 
                                                src={fileUrl} 
                                                alt={file.name}
                                                className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => {
                                                  setPreviewImageUrl(fileUrl);
                                                  setPreviewImageName(file.name);
                                                  setShowImagePreview(true);
                                                }}
                                              />
                                            )}
                                            {isVideo && (
                                              <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center">
                                                <FileIcon className="h-8 w-8 text-gray-400" />
                                              </div>
                                            )}
                                            {!isImage && !isVideo && (
                                              <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center">
                                                <FileIcon className="h-8 w-8 text-gray-400" />
                                              </div>
                                            )}
                                            <div className="mt-1">
                                              <p className="text-xs text-gray-600 truncate" title={file.name}>
                                                {file.name}
                                              </p>
                                              <p className="text-xs text-gray-400">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                              </p>
                                            </div>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="absolute top-1 right-1 h-6 w-6 bg-white hover:bg-red-100"
                                              onClick={() => removeSelectedFile(index)}
                                            >
                                              <X className="h-3 w-3 text-red-600" />
                                            </Button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex gap-2 justify-center pt-2">
                                      <Button
                                        type="button"
                                        onClick={() => handleMediaUpload()}
                                        disabled={uploadingMedia}
                                        className="bg-brand-orange hover:bg-brand-orange-400 text-white"
                                      >
                                        {uploadingMedia ? (
                                          <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Uploading...
                                          </>
                                        ) : (
                                          "Upload Files"
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // View Mode: Show read-only admin media
                              <>
                                <div className="mb-2">
                                  <h4 className="text-sm font-medium text-gray-800">Admin Added Media</h4>
                                </div>
                                <div className="flex flex-wrap gap-3 mb-2">
                                  {(() => {
                                    const adminMediaArray = selectedReport?.adminMedia;
                                    console.log('Admin media array:', adminMediaArray);
                                    
                                    if (!adminMediaArray || adminMediaArray.length === 0) {
                                      return (
                                        <div className="text-gray-400 text-sm italic">
                                          No admin attachments
                                        </div>
                                      );
                                    }
                                    
                                    return adminMediaArray.map((media: string, index: number) => {
                                      const urlPath = media.split('?')[0];
                                      const fileExtension = urlPath.split('.').pop()?.toLowerCase();
                                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '') || 
                                                    media.includes('image') || 
                                                    media.includes('photo') ||
                                                    media.includes('img');
                                      const fileName = urlPath.split('/').pop() || media;
                                      
                                      return (
                                        <div 
                                          key={index} 
                                          className="relative group"
                                        >
                                          {isImage ? (
                                            <div 
                                              className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 hover:shadow-md"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('Opening admin image preview:', media, fileName);
                                                handleImagePreview(media, fileName);
                                              }}
                                              title={`Click to preview: ${fileName} (Admin Added)`}
                                            >
                                              <img 
                                                src={media} 
                                                alt={fileName}
                                                className="w-full h-full object-cover"
                                                onLoad={() => console.log('Admin image loaded successfully:', media)}
                                                onError={(e) => {
                                                  console.log('Admin image failed to load:', media);
                                                  const target = e.target as HTMLImageElement;
                                                  target.style.display = 'none';
                                                  const parent = target.parentElement;
                                                  if (parent) {
                                                    parent.innerHTML = `
                                                      <div class="w-full h-full flex items-center justify-center bg-gray-100">
                                                        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                        </svg>
                                                      </div>
                                                    `;
                                                  }
                                                }}
                                              />
                                            </div>
                                          ) : (
                                            <div 
                                              className="w-20 h-20 rounded-lg border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 hover:shadow-md flex items-center justify-center bg-gray-50"
                                              onClick={() => window.open(media, '_blank')}
                                              title={`Click to open: ${fileName} (Admin Added)`}
                                            >
                                              <FileIcon className="h-8 w-8 text-gray-400" />
                                            </div>
                                          )}
                                          
                                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <div className="truncate">{fileName}</div>
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                  </Table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="dispatch" className="mt-2 flex-1 min-h-0 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                  <div className="text-lg font-semibold text-gray-900">Dispatch Form</div>
                  <div className="flex gap-2 flex-wrap">
                    {isDispatchEditMode ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white" onClick={async () => {
                            console.log('Saving dispatch form:', dispatchData);
                            await saveDispatchDataToDatabase(selectedReport.firestoreId, dispatchData);
                            setIsDispatchEditMode(false);
                          }}>
                            Save
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Save dispatch form data</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      canEditReports() ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => {
                              setIsDispatchEditMode(true);
                              // Automatically assign responders when entering edit mode
                              const autoAssigned = getAutoAssignedResponders();
                              setDispatchData(d => ({
                                ...d,
                                responders: [{
                                  id: `auto-${Date.now()}`,
                                  team: autoAssigned.team,
                                  drivers: [],
                                  responders: autoAssigned.members
                                }]
                              }));
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit dispatch form</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant="outline" disabled className="opacity-50 cursor-not-allowed">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>You don't have permission to edit dispatch forms. Contact your super admin for access.</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table className="w-full min-w-[600px]">
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Received By</TableCell>
                          <TableCell>
                            {dispatchData.receivedBy || (currentUser ? `${currentUser.name}` : "Not specified")}
                          </TableCell>
                        </TableRow>
                        
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Responders</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setShowTeamManagement(true)}
                                        className="border-gray-300 text-gray-800 hover:bg-gray-50"
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Manage Teams
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Add or remove team members</p>
                                    </TooltipContent>
                                  </Tooltip>
                                 
                                </div>
                                {dispatchData.responders && dispatchData.responders.length > 0 ? (
                                  <div className="space-y-1">
                                    {dispatchData.responders.map((responder: any, index: number) => (
                                      <div key={responder.id || index} className="text-sm text-gray-800">
                                        <span className="font-medium text-gray-800">{responder.team}:</span> <span className="text-gray-600">{responder.responders ? responder.responders.join(", ") : "No members"}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-gray-600 text-sm py-2">No responders assigned</div>
                                )}
                              </div>
                            ) : (
                              dispatchData.responders && dispatchData.responders.length > 0 ? (
                                <div className="space-y-1">
                                  {dispatchData.responders.map((responder: any, index: number) => (
                                    <div key={responder.id || index} className="text-sm text-gray-800">
                                      <span className="font-medium text-gray-800">{responder.team}:</span> <span className="text-gray-600">{responder.responders ? responder.responders.join(", ") : "No members"}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-800">
                                  <span className="font-medium text-gray-800">{(() => {
                                    const autoAssigned = getAutoAssignedResponders();
                                    return autoAssigned.team;
                                  })()}:</span> <span className="text-gray-600">{(() => {
                                    const autoAssigned = getAutoAssignedResponders();
                                    return autoAssigned.members.join(", ");
                                  })()}</span>
                                </div>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Driver</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              driverOptions.length > 0 ? (
                                <Select
                                  value={dispatchData.driverId || NO_DRIVER_SELECTION}
                                  onValueChange={(value) => {
                                    if (value === NO_DRIVER_SELECTION) {
                                      setDispatchData(prev => ({
                                        ...prev,
                                        driverId: "",
                                        driverName: ""
                                      }));
                                      return;
                                    }
                                    const selectedDriver = driverOptions.find(driver => driver.id === value);
                                    setDispatchData(prev => ({
                                      ...prev,
                                      driverId: value,
                                      driverName: selectedDriver?.name || ""
                                    }));
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select driver" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_DRIVER_SELECTION}>No driver assigned</SelectItem>
                                    {driverOptions.map(driver => (
                                      <SelectItem key={driver.id} value={driver.id}>
                                        {driver.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No drivers available. Add an admin with the "Driver" position in Manage Users.
                                </div>
                              )
                            ) : (
                              dispatchData.driverName || dispatchData.driverId || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Vehicle Used</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="space-y-3">
                                <Select
                                  value={dispatchData.vehicleId || NO_VEHICLE_SELECTION}
                                  onValueChange={(value) => {
                                    if (value === NO_VEHICLE_SELECTION) {
                                      setDispatchData(prev => ({
                                        ...prev,
                                        vehicleId: "",
                                        vehicleName: ""
                                      }));
                                      return;
                                    }
                                    const selectedVehicle = vehicleOptions.find(vehicle => vehicle.id === value);
                                    if (selectedVehicle && `${selectedVehicle.id}:delete` === value) {
                                      return;
                                    }
                                    setDispatchData(prev => ({
                                      ...prev,
                                      vehicleId: value,
                                      vehicleName: selectedVehicle?.name || ""
                                    }));
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={vehicleOptions.length === 0 ? "Add a vehicle to select" : "Select vehicle"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_VEHICLE_SELECTION}>No vehicle used</SelectItem>
                                    {vehicleOptions.map(vehicle => (
                                      <div key={vehicle.id} className="flex items-center justify-between pr-2 pl-1">
                                        <SelectItem value={vehicle.id} className="flex-1">
                                          {vehicle.name}
                                        </SelectItem>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteVehicleOption(vehicle.id, vehicle.name);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    ))}
                                    <div className="border-t border-gray-100 p-2">
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Add new vehicle"
                                          value={newVehicleName}
                                          onChange={e => setNewVehicleName(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              handleAddVehicleOption();
                                            }
                                          }}
                                          className="text-sm"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={handleAddVehicleOption}
                                          disabled={!newVehicleName.trim()}
                                          className="h-8 px-3"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              dispatchData.vehicleName || dispatchData.vehicleId || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Time Call Received</TableCell>
                          <TableCell>
                            {dispatchData.timeCallReceived || getCurrentTime()}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Time of Dispatch</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="flex items-center gap-2">
                              <Input 
                                type="time" 
                                value={dispatchData.timeOfDispatch} 
                                onChange={e => setDispatchData(d => ({ ...d, timeOfDispatch: e.target.value }))} 
                                  className="flex-1"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setDispatchData(d => ({ ...d, timeOfDispatch: getCurrentTime24Hour() }))}
                                      className="px-3"
                                    >
                                      <Clock className="h-4 w-4 mr-1" />
                                      Now
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Set to current time</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            ) : (
                              dispatchData.timeOfDispatch || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Time of Arrival</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="flex items-center gap-2">
                              <Input 
                                type="time" 
                                value={dispatchData.timeOfArrival} 
                                onChange={e => setDispatchData(d => ({ ...d, timeOfArrival: e.target.value }))} 
                                  className="flex-1"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setDispatchData(d => ({ ...d, timeOfArrival: getCurrentTime24Hour() }))}
                                      className="px-3"
                                    >
                                      <Clock className="h-4 w-4 mr-1" />
                                      Now
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Set to current time</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            ) : (
                              dispatchData.timeOfArrival || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Response Time</TableCell>
                          <TableCell>
                            {dispatchData.timeOfDispatch && dispatchData.timeOfArrival ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-brand-orange">
                                  {calculateResponseTime(dispatchData.timeOfDispatch, dispatchData.timeOfArrival)}
                                </span>
                                <span className="text-sm text-gray-500">
                                  ({calculateResponseTimeMinutes(dispatchData.timeOfDispatch, dispatchData.timeOfArrival)} minutes)
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500">Calculate after entering dispatch and arrival times</span>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Hospital Arrival</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="flex items-center gap-2">
                              <Input 
                                type="time" 
                                value={dispatchData.hospitalArrival} 
                                onChange={e => setDispatchData(d => ({ ...d, hospitalArrival: e.target.value }))} 
                                  className="flex-1"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setDispatchData(d => ({ ...d, hospitalArrival: getCurrentTime24Hour() }))}
                                      className="px-3"
                                    >
                                      <Clock className="h-4 w-4 mr-1" />
                                      Now
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Set to current time</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            ) : (
                              dispatchData.hospitalArrival || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Returned to OPCEN</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="flex items-center gap-2">
                              <Input 
                                type="time" 
                                value={dispatchData.returnedToOpcen} 
                                onChange={e => setDispatchData(d => ({ ...d, returnedToOpcen: e.target.value }))} 
                                  className="flex-1"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setDispatchData(d => ({ ...d, returnedToOpcen: getCurrentTime24Hour() }))}
                                      className="px-3"
                                    >
                                      <Clock className="h-4 w-4 mr-1" />
                                      Now
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Set to current time</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            ) : (
                              dispatchData.returnedToOpcen || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Disaster Related</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
                                <button
                                  type="button"
                                  className={cn(
                                    "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                    dispatchData.disasterRelated === "Yes"
                                      ? "bg-brand-orange text-white shadow-sm"
                                      : "text-gray-600 hover:bg-gray-50"
                                  )}
                                  onClick={() =>
                                    setDispatchData(d => ({
                                      ...d,
                                      disasterRelated: "Yes"
                                    }))
                                  }
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                    dispatchData.disasterRelated !== "Yes"
                                      ? "bg-brand-orange text-white shadow-sm"
                                      : "text-gray-600 hover:bg-gray-50"
                                  )}
                                  onClick={() =>
                                    setDispatchData(d => ({
                                      ...d,
                                      disasterRelated: "No"
                                    }))
                                  }
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              dispatchData.disasterRelated || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Agency Present</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <div className="space-y-3">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-between text-left font-normal",
                                        dispatchData.agencyPresent.length === 0 && "text-muted-foreground"
                                      )}
                                    >
                                          <span className="flex flex-wrap gap-1">
                                            {dispatchData.agencyPresent.length > 0
                                              ? dispatchData.agencyPresent.map((agency, index) => (
                                                  <span
                                                    key={`${agency}-${index}`}
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-brand-orange/40 bg-orange-50 text-brand-orange"
                                                  >
                                                    {agency}
                                                  </span>
                                                ))
                                              : "Select agencies"}
                                      </span>
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-0" align="start">
                                    <div className="max-h-60 overflow-y-auto">
                                      {agencyOptions.map(option => {
                                        const isSelected = dispatchData.agencyPresent.includes(option.name);
                                            return (
                                          <button
                                            key={option.id}
                                            type="button"
                                            className={cn(
                                                  "flex w-full items-center gap-2 px-3 py-2 text-sm",
                                                  isSelected ? "bg-orange-50/70 text-brand-orange" : "text-gray-700 hover:bg-orange-50"
                                            )}
                                            onClick={() => toggleAgencySelection(option.name)}
                                          >
                                            <Checkbox
                                              checked={isSelected}
                                              className="h-4 w-4"
                                            />
                                            <span className="flex-1 text-left">{option.name}</span>
                                          </button>
                                        );
                                      })}
                                      {agencyOptions.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-500">
                                          No agencies available. Add one below.
                                        </div>
                                      )}
                                    </div>
                                    <div className="border-t border-gray-100 p-2">
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Add new agency"
                                          value={newAgencyName}
                                          onChange={e => setNewAgencyName(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              handleAddAgencyOption();
                                            }
                                          }}
                                          className="text-sm"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={handleAddAgencyOption}
                                          disabled={!newAgencyName.trim()}
                                          className="h-8 px-3"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            ) : (
                              dispatchData.agencyPresent && dispatchData.agencyPresent.length > 0
                                ? dispatchData.agencyPresent.join(", ")
                                : "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Type of Emergency</TableCell>
                          <TableCell>
                            {isDispatchEditMode ? (
                              <Select value={dispatchData.typeOfEmergency} onValueChange={v => setDispatchData(d => ({ 
                                ...d, 
                                typeOfEmergency: v, 
                                vehicleInvolved: "",
                                injuryClassification: "", 
                                majorInjuryTypes: [], 
                                minorInjuryTypes: [],
                                medicalClassification: "",
                                majorMedicalSymptoms: [],
                                minorMedicalSymptoms: [],
                                chiefComplaint: "",
                                diagnosis: "",
                                natureOfIllness: "",
                                natureOfIllnessOthers: "",
                                actionsTaken: [],
                                referredTo: "",
                                transportFrom: "",
                                transportTo: "",
                                othersDescription: "",
                                vitalSigns: {
                                  temperature: "",
                                  pulseRate: "",
                                  respiratoryRate: "",
                                  bloodPressure: ""
                                },
                                responders: []
                              }))}>
                                <SelectTrigger><SelectValue placeholder="Select emergency type" /></SelectTrigger>
                                <SelectContent>
                                  {emergencyTypeOptions.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              dispatchData.typeOfEmergency || "Not specified"
                            )}
                          </TableCell>
                        </TableRow>
                        
                        {/* Road Crash Specific Fields */}
                        {dispatchData.typeOfEmergency === "Road Crash" && (
                          <>
                            <TableRow>
                              <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Vehicle Involved</TableCell>
                              <TableCell>
                                {isDispatchEditMode ? (
                                  <Select value={dispatchData.vehicleInvolved} onValueChange={v => setDispatchData(d => ({ ...d, vehicleInvolved: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select vehicle involved" /></SelectTrigger>
                                    <SelectContent>
                                      {vehicleInvolvedOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  dispatchData.vehicleInvolved || "Not specified"
                                )}
                              </TableCell>
                            </TableRow>
                            
                            <TableRow>
                              <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Classification of Injury</TableCell>
                              <TableCell>
                                {isDispatchEditMode ? (
                                  <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
                                    <button
                                      type="button"
                                      className={cn(
                                        "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                        dispatchData.injuryClassification === "Major"
                                          ? "bg-brand-orange text-white shadow-sm"
                                          : "text-gray-600 hover:bg-gray-50"
                                      )}
                                      onClick={() =>
                                        setDispatchData(d => ({
                                          ...d,
                                          injuryClassification: "Major",
                                          majorInjuryTypes: [],
                                          minorInjuryTypes: []
                                        }))
                                      }
                                    >
                                      Major
                                    </button>
                                    <button
                                      type="button"
                                      className={cn(
                                        "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                        dispatchData.injuryClassification === "Minor"
                                          ? "bg-brand-orange text-white shadow-sm"
                                          : "text-gray-600 hover:bg-gray-50"
                                      )}
                                      onClick={() =>
                                        setDispatchData(d => ({
                                          ...d,
                                          injuryClassification: "Minor",
                                          majorInjuryTypes: [],
                                          minorInjuryTypes: []
                                        }))
                                      }
                                    >
                                      Minor
                                    </button>
                                  </div>
                                ) : (
                                  dispatchData.injuryClassification || "Not specified"
                                )}
                              </TableCell>
                            </TableRow>
                            
                            {/* Major Injury Types */}
                            {dispatchData.injuryClassification === "Major" && (
                              <TableRow>
                                <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Major Injury Types</TableCell>
                                <TableCell>
                                  {isDispatchEditMode ? (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-between text-left font-normal",
                                            dispatchData.majorInjuryTypes.length === 0 && "text-muted-foreground"
                                          )}
                                        >
                                          <span className="flex flex-wrap gap-1">
                                            {dispatchData.majorInjuryTypes.length > 0
                                              ? dispatchData.majorInjuryTypes.map((injuryType, index) => (
                                                  <span
                                                    key={`${injuryType}-${index}`}
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-brand-orange/40 bg-orange-50 text-brand-orange"
                                                  >
                                                    {injuryType}
                                                  </span>
                                                ))
                                              : "Select major injury types"}
                                          </span>
                                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 p-0" align="start">
                                        <div className="max-h-60 overflow-y-auto">
                                          {majorInjuryTypeOptions.map((injuryType) => {
                                            const isSelected = dispatchData.majorInjuryTypes.includes(injuryType);
                                            return (
                                              <button
                                                key={injuryType}
                                                type="button"
                                                className={cn(
                                                  "flex w-full items-center gap-2 px-3 py-2 text-sm",
                                                  isSelected ? "bg-orange-50/70 text-brand-orange" : "text-gray-700 hover:bg-orange-50"
                                                )}
                                                onClick={() => toggleMajorInjuryType(injuryType)}
                                              >
                                                <Checkbox
                                                  checked={isSelected}
                                                  className="h-4 w-4"
                                                />
                                                <span className="flex-1 text-left">{injuryType}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    dispatchData.majorInjuryTypes.length > 0
                                      ? dispatchData.majorInjuryTypes.join(", ")
                                      : "No major injury types selected"
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                            
                            {/* Minor Injury Types */}
                            {dispatchData.injuryClassification === "Minor" && (
                              <TableRow>
                                <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Minor Injury Types</TableCell>
                                <TableCell>
                                  {isDispatchEditMode ? (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-between text-left font-normal",
                                            dispatchData.minorInjuryTypes.length === 0 && "text-muted-foreground"
                                          )}
                                        >
                                          <span className="flex flex-wrap gap-1">
                                            {dispatchData.minorInjuryTypes.length > 0
                                              ? dispatchData.minorInjuryTypes.map((injuryType, index) => (
                                                  <span
                                                    key={`${injuryType}-${index}`}
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-brand-orange/40 bg-orange-50 text-brand-orange"
                                                  >
                                                    {injuryType}
                                                  </span>
                                                ))
                                              : "Select minor injury types"}
                                          </span>
                                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 p-0" align="start">
                                        <div className="max-h-60 overflow-y-auto">
                                          {minorInjuryTypeOptions.map((injuryType) => {
                                            const isSelected = dispatchData.minorInjuryTypes.includes(injuryType);
                                            return (
                                              <button
                                                key={injuryType}
                                                type="button"
                                                className={cn(
                                                  "flex w-full items-center gap-2 px-3 py-2 text-sm",
                                                  isSelected ? "bg-orange-50/70 text-brand-orange" : "text-gray-700 hover:bg-orange-50"
                                                )}
                                                onClick={() => toggleMinorInjuryType(injuryType)}
                                              >
                                                <Checkbox
                                                  checked={isSelected}
                                                  className="h-4 w-4"
                                                />
                                                <span className="flex-1 text-left">{injuryType}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    dispatchData.minorInjuryTypes.length > 0
                                      ? dispatchData.minorInjuryTypes.join(", ")
                                      : "No minor injury types selected"
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )}
                        
                        {/* Medical Emergency Specific Fields */}
                        {dispatchData.typeOfEmergency === "Medical Emergency" && (
                          <>
                            <TableRow>
                              <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Medical Classification</TableCell>
                              <TableCell>
                                {isDispatchEditMode ? (
                                  <Select value={dispatchData.medicalClassification} onValueChange={v => setDispatchData(d => ({ ...d, medicalClassification: v, majorMedicalSymptoms: [], minorMedicalSymptoms: [] }))}>
                                    <SelectTrigger><SelectValue placeholder="Select medical classification" /></SelectTrigger>
                                    <SelectContent>
                                      {injuryClassificationOptions.map(classification => <SelectItem key={classification} value={classification}>{classification}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  dispatchData.medicalClassification || "Not specified"
                                )}
                              </TableCell>
                            </TableRow>
                            
                            {/* Major Medical Symptoms */}
                            {dispatchData.medicalClassification === "Major" && (
                              <TableRow>
                                <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Major Medical Symptoms</TableCell>
                                <TableCell>
                                  {isDispatchEditMode ? (
                                    <div className="space-y-2">
                                      {majorMedicalSymptomsOptions.map((symptom) => (
                                        <div key={symptom} className="flex items-center space-x-2">
                                          <Checkbox
                                            id={`major-medical-${symptom}`}
                                            checked={dispatchData.majorMedicalSymptoms.includes(symptom)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setDispatchData(d => ({
                                                  ...d,
                                                  majorMedicalSymptoms: [...d.majorMedicalSymptoms, symptom]
                                                }));
                                              } else {
                                                setDispatchData(d => ({
                                                  ...d,
                                                  majorMedicalSymptoms: d.majorMedicalSymptoms.filter(s => s !== symptom)
                                                }));
                                              }
                                            }}
                                          />
                                          <Label htmlFor={`major-medical-${symptom}`} className="text-sm">
                                            {symptom}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    dispatchData.majorMedicalSymptoms.length > 0
                                      ? dispatchData.majorMedicalSymptoms.join(", ")
                                      : "No major medical symptoms selected"
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                            
                            {/* Minor Medical Symptoms */}
                            {dispatchData.medicalClassification === "Minor" && (
                              <TableRow>
                                <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Minor Medical Symptoms</TableCell>
                                <TableCell>
                                  {isDispatchEditMode ? (
                                    <div className="space-y-2">
                                      {minorMedicalSymptomsOptions.map((symptom) => (
                                        <div key={symptom} className="flex items-center space-x-2">
                                          <Checkbox
                                            id={`minor-medical-${symptom}`}
                                            checked={dispatchData.minorMedicalSymptoms.includes(symptom)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setDispatchData(d => ({
                                                  ...d,
                                                  minorMedicalSymptoms: [...d.minorMedicalSymptoms, symptom]
                                                }));
                                              } else {
                                                setDispatchData(d => ({
                                                  ...d,
                                                  minorMedicalSymptoms: d.minorMedicalSymptoms.filter(s => s !== symptom)
                                                }));
                                              }
                                            }}
                                          />
                                          <Label htmlFor={`minor-medical-${symptom}`} className="text-sm">
                                            {symptom}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    dispatchData.minorMedicalSymptoms.length > 0
                                      ? dispatchData.minorMedicalSymptoms.join(", ")
                                      : "No minor medical symptoms selected"
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )}
                        
                        {/* Medical Assistance Specific Fields */}
                        {dispatchData.typeOfEmergency === "Medical Assistance" && (
                          <>
                            <TableRow>
                              <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Chief Complaint</TableCell>
                              <TableCell>
                                {isDispatchEditMode ? (
                                  <Textarea 
                                    value={dispatchData.chiefComplaint} 
                                    onChange={e => setDispatchData(d => ({ ...d, chiefComplaint: e.target.value }))} 
                                    placeholder="Enter chief complaint (Short Description)"
                                    className="min-h-[80px]"
                                  />
                                ) : (
                                  dispatchData.chiefComplaint || "Not specified"
                                )}
                              </TableCell>
                            </TableRow>
                            
                            <TableRow>
                              <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Diagnosis</TableCell>
                              <TableCell>
                                {isDispatchEditMode ? (
                                  <Textarea 
                                    value={dispatchData.diagnosis} 
                                    onChange={e => setDispatchData(d => ({ ...d, diagnosis: e.target.value }))} 
                                      placeholder="Enter diagnosis (Short Description)"
                                    className="min-h-[80px]"
                                  />
                                ) : (
                                  dispatchData.diagnosis || "Not specified"
                                )}
                              </TableCell>
                            </TableRow>
                            
                            <TableRow>
                              <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Nature of Illness</TableCell>
                              <TableCell>
                                {isDispatchEditMode ? (
                                  <div className="space-y-3">
                                    <RadioGroup 
                                      value={dispatchData.natureOfIllness} 
                                      onValueChange={v => setDispatchData(d => ({ ...d, natureOfIllness: v, natureOfIllnessOthers: "" }))}
                                    >
                                      {natureOfIllnessOptions.map((illness) => (
                                        <div key={illness} className="flex items-center space-x-2">
                                          <RadioGroupItem value={illness} id={`illness-${illness}`} />
                                          <Label htmlFor={`illness-${illness}`} className="text-sm">
                                            {illness}
                                          </Label>
                                        </div>
                                      ))}
                                    </RadioGroup>
                                    
                                    {dispatchData.natureOfIllness === "Others" && (
                                      <div className="mt-2">
                                        <Label htmlFor="nature-of-illness-others" className="text-sm font-medium">
                                          Please specify:
                                        </Label>
                                        <Input 
                                          id="nature-of-illness-others"
                                          value={dispatchData.natureOfIllnessOthers} 
                                          onChange={e => setDispatchData(d => ({ ...d, natureOfIllnessOthers: e.target.value }))} 
                                          placeholder="Enter nature of illness"
                                          className="mt-1"
                                        />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  dispatchData.natureOfIllness
                                    ? dispatchData.natureOfIllness === "Others" && dispatchData.natureOfIllnessOthers
                                      ? `${dispatchData.natureOfIllness} - ${dispatchData.natureOfIllnessOthers}`
                                      : dispatchData.natureOfIllness
                                    : "Not specified"
                                )}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                        
                        {/* Actions Taken Field - appears for any emergency type */}
                        {dispatchData.typeOfEmergency && (
                          <TableRow>
                            <TableCell className="font-medium text-gray-700 align-top w-1/3 min-w-[150px]">Actions Taken</TableCell>
                            <TableCell>
                              {isDispatchEditMode ? (
                                <div className="space-y-3">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-between text-left font-normal",
                                          dispatchData.actionsTaken.length === 0 && "text-muted-foreground"
                                        )}
                                      >
                                        <span className="flex flex-wrap gap-1">
                                          {dispatchData.actionsTaken.length > 0
                                            ? dispatchData.actionsTaken.map((action, index) => (
                                                <span
                                                  key={`${action}-${index}`}
                                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-brand-orange/40 bg-orange-50 text-brand-orange"
                                                >
                                                  {action}
                                                </span>
                                              ))
                                            : "Select actions taken"}
                                        </span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-0" align="start">
                                      <div className="max-h-60 overflow-y-auto">
                                        {actionsTakenOptions.map(action => {
                                          const isSelected = dispatchData.actionsTaken.includes(action);
                                          return (
                                            <button
                                              key={action}
                                              type="button"
                                              className={cn(
                                                "flex w-full items-center gap-2 px-3 py-2 text-sm",
                                                isSelected ? "bg-orange-50/70 text-brand-orange" : "text-gray-700 hover:bg-orange-50"
                                              )}
                                              onClick={() => toggleActionSelection(action)}
                                            >
                                              <Checkbox
                                                checked={isSelected}
                                                className="h-4 w-4"
                                              />
                                              <span className="flex-1 text-left">{action}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </PopoverContent>
                                  </Popover>

                                  {/* Additional input fields for specific actions */}
                                  {dispatchData.actionsTaken.includes("Vital Signs Taken") && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                      <Label className="text-sm font-medium text-gray-800 mb-3 block">
                                        Vital Signs Details (Optional - fill in available measurements):
                                      </Label>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label htmlFor="temperature" className="text-sm text-gray-700">
                                            Temperature (°C):
                                          </Label>
                                          <Input 
                                            id="temperature"
                                            type="number"
                                            step="0.1"
                                            value={dispatchData.vitalSigns.temperature} 
                                            onChange={e => setDispatchData(d => ({ 
                                              ...d, 
                                              vitalSigns: { ...d.vitalSigns, temperature: e.target.value }
                                            }))} 
                                            placeholder="e.g., 37.2"
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="pulse-rate" className="text-sm text-gray-700">
                                            Pulse Rate (bpm):
                                          </Label>
                                          <Input 
                                            id="pulse-rate"
                                            type="number"
                                            value={dispatchData.vitalSigns.pulseRate} 
                                            onChange={e => setDispatchData(d => ({ 
                                              ...d, 
                                              vitalSigns: { ...d.vitalSigns, pulseRate: e.target.value }
                                            }))} 
                                            placeholder="e.g., 80"
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="respiratory-rate" className="text-sm text-gray-700">
                                            Respiratory Rate (breaths/min):
                                          </Label>
                                          <Input 
                                            id="respiratory-rate"
                                            type="number"
                                            value={dispatchData.vitalSigns.respiratoryRate} 
                                            onChange={e => setDispatchData(d => ({ 
                                              ...d, 
                                              vitalSigns: { ...d.vitalSigns, respiratoryRate: e.target.value }
                                            }))} 
                                            placeholder="e.g., 16"
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="blood-pressure" className="text-sm text-gray-700">
                                            Blood Pressure (mmHg):
                                          </Label>
                                          <Input 
                                            id="blood-pressure"
                                            value={dispatchData.vitalSigns.bloodPressure} 
                                            onChange={e => setDispatchData(d => ({ 
                                              ...d, 
                                              vitalSigns: { ...d.vitalSigns, bloodPressure: e.target.value }
                                            }))} 
                                            placeholder="e.g., 120/80"
                                            className="mt-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {dispatchData.actionsTaken.includes("Referred") && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                      <Label htmlFor="referred-to" className="text-sm font-medium text-gray-800">
                                        Referred to:
                                      </Label>
                                      <Input 
                                        id="referred-to"
                                        value={dispatchData.referredTo} 
                                        onChange={e => setDispatchData(d => ({ ...d, referredTo: e.target.value }))} 
                                        placeholder="Enter who the patient was referred to (e.g., Dr. Smith, General Hospital, Specialist Clinic)"
                                        className="mt-1"
                                      />
                                    </div>
                                  )}
                                  
                                  {dispatchData.actionsTaken.includes("Transported") && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                      <Label className="text-sm font-medium text-gray-800 mb-3 block">
                                        Transport Details:
                                      </Label>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label htmlFor="transport-from" className="text-sm text-gray-700">
                                            Transport from:
                                          </Label>
                                          <Input 
                                            id="transport-from"
                                            value={dispatchData.transportFrom} 
                                            onChange={e => setDispatchData(d => ({ ...d, transportFrom: e.target.value }))} 
                                            placeholder="e.g., Scene of accident, Patient's home, Current location"
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="transport-to" className="text-sm text-gray-700">
                                            Transport to:
                                          </Label>
                                          <Input 
                                            id="transport-to"
                                            value={dispatchData.transportTo} 
                                            onChange={e => setDispatchData(d => ({ ...d, transportTo: e.target.value }))} 
                                            placeholder="e.g., General Hospital, Emergency Room, Specialist Clinic"
                                            className="mt-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {dispatchData.actionsTaken.includes("Others") && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                      <Label htmlFor="others-description" className="text-sm font-medium text-gray-800">
                                        Others - Please specify:
                                      </Label>
                                      <Input 
                                        id="others-description"
                                        value={dispatchData.othersDescription} 
                                        onChange={e => setDispatchData(d => ({ ...d, othersDescription: e.target.value }))} 
                                        placeholder="Enter other actions taken"
                                        className="mt-1"
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {dispatchData.actionsTaken.length > 0 ? (
                                    <div className="space-y-2">
                                      <div className="text-sm text-gray-800">
                                        {dispatchData.actionsTaken.join(", ")}
                                      </div>
                                      
                                      {/* Show additional details for specific actions */}
                                      {dispatchData.actionsTaken.includes("Vital Signs Taken") && (
                                        dispatchData.vitalSigns.temperature || dispatchData.vitalSigns.pulseRate || dispatchData.vitalSigns.respiratoryRate || dispatchData.vitalSigns.bloodPressure
                                      ) && (
                                        <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                                          <span className="font-medium text-gray-800 block mb-2">Vital Signs:</span>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            {dispatchData.vitalSigns.temperature && (
                                              <div><span className="font-medium">Temperature:</span> {dispatchData.vitalSigns.temperature}°C</div>
                                            )}
                                            {dispatchData.vitalSigns.pulseRate && (
                                              <div><span className="font-medium">Pulse Rate:</span> {dispatchData.vitalSigns.pulseRate} bpm</div>
                                            )}
                                            {dispatchData.vitalSigns.respiratoryRate && (
                                              <div><span className="font-medium">Respiratory Rate:</span> {dispatchData.vitalSigns.respiratoryRate} breaths/min</div>
                                            )}
                                            {dispatchData.vitalSigns.bloodPressure && (
                                              <div><span className="font-medium">Blood Pressure:</span> {dispatchData.vitalSigns.bloodPressure} mmHg</div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {dispatchData.actionsTaken.includes("Referred") && dispatchData.referredTo && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                          <span className="font-medium text-gray-800">Referred to:</span> {dispatchData.referredTo}
                                        </div>
                                      )}
                                      
                                      {dispatchData.actionsTaken.includes("Transported") && (dispatchData.transportFrom || dispatchData.transportTo) && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                          <span className="font-medium text-gray-800">Transport:</span> {dispatchData.transportFrom} to {dispatchData.transportTo}
                                        </div>
                                      )}
                                      
                                      {dispatchData.actionsTaken.includes("Others") && dispatchData.othersDescription && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                          <span className="font-medium text-gray-800">Others:</span> {dispatchData.othersDescription}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    "No actions taken specified"
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="patient" className="mt-1 flex-1 min-h-0 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                  <div className="text-lg font-semibold text-gray-900">Patient Information</div>
                  <div className="flex gap-2 flex-wrap">
                    {isPatientEditMode ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white" onClick={async () => {
                            console.log('Saving patient information:', patients);
                            await savePatientDataToDatabase(selectedReport.firestoreId, patients);
                            setIsPatientEditMode(false);
                          }}>
                            Save
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Save patient information</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      canEditReports() ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => {
                              setIsPatientEditMode(true);
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit patient information</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant="outline" disabled className="opacity-50 cursor-not-allowed">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>You don't have permission to edit patient information. Contact your super admin for access.</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    )}
                  </div>
                </div>
                
                {/* Patient Management Header */}
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Patient Management</h3>
                    {canEditReports() ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={addNewPatient} className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Patient
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add another patient to this report</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button disabled className="bg-brand-orange hover:bg-brand-orange-400 text-white opacity-50 cursor-not-allowed">
                              <Plus className="h-4 w-4 mr-2" />
                              Add New Patient
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>You don't have permission to add patients. Contact your super admin for access.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  
                  {patients.length > 1 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Select Patient:</Label>
                      <div className="flex flex-wrap gap-2">
                        {patients.map((patient, index) => (
                          <div key={patient.id} className="flex items-center gap-2">
                            <Button
                              variant={currentPatientIndex === index ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPatientIndex(index)}
                              className={`text-xs ${currentPatientIndex === index ? 'bg-brand-orange hover:bg-brand-orange-400 text-white' : 'border-brand-orange text-brand-orange hover:bg-orange-50'}`}
                            >
                              Patient {index + 1}
                              {patient.name && ` - ${patient.name}`}
                            </Button>
                            {patients.length > 1 && (
                              canEditReports() ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePatient(index)}
                                  className="text-brand-orange hover:text-brand-orange-700 hover:bg-orange-50 p-1 h-6 w-6"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled
                                        className="text-brand-orange opacity-50 cursor-not-allowed p-1 h-6 w-6"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>You don't have permission to remove patients. Contact your super admin for access.</p>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <Table className="w-full min-w-[600px]">
                      <TableBody>
                      <TableRow>
                        <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Name</TableCell>
                          <TableCell>
                            {isPatientEditMode ? (
                              <Input 
                                value={currentPatient.name} 
                                onChange={e => updateCurrentPatient({ name: e.target.value })} 
                                placeholder="Enter patient's full name"
                                className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                              />
                            ) : (
                              currentPatient.name ? (
                                <span className="text-gray-800">{currentPatient.name}</span>
                              ) : (
                                <span className="text-gray-400 italic">Not specified</span>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Contact Number</TableCell>
                          <TableCell>
                            {isPatientEditMode ? (
                              <Input 
                                value={currentPatient.contactNumber} 
                                onChange={e => updateCurrentPatient({ contactNumber: e.target.value })} 
                                placeholder="Enter contact number"
                                className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                              />
                            ) : (
                              currentPatient.contactNumber ? (
                                <span className="text-gray-800">{currentPatient.contactNumber}</span>
                              ) : (
                                <span className="text-gray-400 italic">Not specified</span>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Address</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input 
                                  value={currentPatient.address} 
                                  onChange={e => updateCurrentPatient({ address: e.target.value })} 
                                  placeholder="Enter complete address"
                                  className="flex-1 border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (currentPatient.latitude && currentPatient.longitude) {
                                          setPatientLocationData({
                                            lat: Number(currentPatient.latitude),
                                            lng: Number(currentPatient.longitude),
                                            address: currentPatient.address || ""
                                          });
                                        } else {
                                          setPatientLocationData(null);
                                        }
                                        setShowPatientLocationMap(true);
                                      }}
                                      className="border-gray-300"
                                    >
                                      <MapPin className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Pin location on map</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              {currentPatient.latitude && currentPatient.longitude && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Location pinned: {Number(currentPatient.latitude).toFixed(6)}, {Number(currentPatient.longitude).toFixed(6)}
                                </div>
                              )}
                            </div>
                          ) : (
                            currentPatient.address ? (
                              <div className="space-y-1">
                                <span className="text-gray-800">{currentPatient.address}</span>
                                {currentPatient.latitude && currentPatient.longitude && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {Number(currentPatient.latitude).toFixed(6)}, {Number(currentPatient.longitude).toFixed(6)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Religion</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Select value={currentPatient.religion} onValueChange={v => updateCurrentPatient({ religion: v })}>
                              <SelectTrigger className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                <SelectValue placeholder="Select religion" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Catholic">Catholic</SelectItem>
                                <SelectItem value="Protestant">Protestant</SelectItem>
                                <SelectItem value="Islam">Islam</SelectItem>
                                <SelectItem value="Buddhism">Buddhism</SelectItem>
                                <SelectItem value="Hinduism">Hinduism</SelectItem>
                                <SelectItem value="Judaism">Judaism</SelectItem>
                                <SelectItem value="Atheist">Atheist</SelectItem>
                                <SelectItem value="Agnostic">Agnostic</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            currentPatient.religion ? (
                              <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-50">
                                {currentPatient.religion}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Birthday</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0",
                                    !isCurrentPatientBirthdayValid && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                                  {isCurrentPatientBirthdayValid && currentPatientBirthdayDate
                                    ? format(currentPatientBirthdayDate, "PPP")
                                    : "Select date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <DatePickerCalendar
                                  mode="single"
                                  selected={isCurrentPatientBirthdayValid ? currentPatientBirthdayDate ?? undefined : undefined}
                                  onSelect={date => {
                                    updateCurrentPatient({
                                      birthday: date ? format(date, "yyyy-MM-dd") : ""
                                    });
                                  }}
                                  initialFocus
                                  captionLayout="dropdown"
                                  fromYear={1900}
                                  toYear={new Date().getFullYear()}
                                />
                              </PopoverContent>
                            </Popover>
                          ) : (
                            formattedCurrentPatientBirthday ? (
                              <span className="text-gray-800">{formattedCurrentPatientBirthday}</span>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Blood Type</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Select value={currentPatient.bloodType} onValueChange={v => updateCurrentPatient({ bloodType: v })}>
                              <SelectTrigger className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
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
                            currentPatient.bloodType ? (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-50">
                                {currentPatient.bloodType}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Civil Status</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Select value={currentPatient.civilStatus} onValueChange={v => updateCurrentPatient({ civilStatus: v })}>
                              <SelectTrigger className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                <SelectValue placeholder="Select civil status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Single">Single</SelectItem>
                                <SelectItem value="Married">Married</SelectItem>
                                <SelectItem value="Widowed">Widowed</SelectItem>
                                <SelectItem value="Divorced">Divorced</SelectItem>
                                <SelectItem value="Separated">Separated</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            currentPatient.civilStatus ? (
                              <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-50">
                                {currentPatient.civilStatus}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Age</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Input 
                              type="number" 
                              value={currentPatient.age} 
                              onChange={e => updateCurrentPatient({ age: e.target.value })} 
                              placeholder="Enter age"
                              min="0"
                              max="150"
                              className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                            />
                          ) : (
                            currentPatient.age ? (
                              <span className="text-gray-800">{currentPatient.age} years old</span>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">PWD (Person with Disability)</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
                              <button
                                type="button"
                                className={cn(
                                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                  currentPatient.pwd === "Yes"
                                    ? "bg-brand-orange text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50"
                                )}
                                onClick={() => updateCurrentPatient({ pwd: "Yes" })}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                                  currentPatient.pwd === "No"
                                    ? "bg-brand-orange text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50"
                                )}
                                onClick={() => updateCurrentPatient({ pwd: "No" })}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            currentPatient.pwd ? (
                              <span className="text-gray-800">{currentPatient.pwd}</span>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Age Group</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Select value={currentPatient.ageGroup} onValueChange={v => updateCurrentPatient({ ageGroup: v })}>
                              <SelectTrigger className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                <SelectValue placeholder="Select age group" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Infant">Infant (0-2 years)</SelectItem>
                                <SelectItem value="Child">Child (3-12 years)</SelectItem>
                                <SelectItem value="Adolescent">Adolescent (13-17 years)</SelectItem>
                                <SelectItem value="Adult">Adult (18-59 years)</SelectItem>
                                <SelectItem value="Senior Citizen">Senior Citizen (60+ years)</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            currentPatient.ageGroup ? (
                              <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-50">
                                {currentPatient.ageGroup}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Gender</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Select value={currentPatient.gender} onValueChange={v => updateCurrentPatient({ gender: v })}>
                              <SelectTrigger className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
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
                            currentPatient.gender ? (
                              <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-50">
                                {currentPatient.gender}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Name of Companion/Relative</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Input 
                              value={currentPatient.companionName} 
                              onChange={e => updateCurrentPatient({ companionName: e.target.value })} 
                              placeholder="Enter companion/relative name"
                              className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                            />
                          ) : (
                            currentPatient.companionName ? (
                              <span className="text-gray-800">{currentPatient.companionName}</span>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Companion Contact Number</TableCell>
                          <TableCell>
                          {isPatientEditMode ? (
                            <Input 
                              value={currentPatient.companionContact} 
                              onChange={e => updateCurrentPatient({ companionContact: e.target.value })} 
                              placeholder="Enter companion contact number"
                              className="border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                            />
                          ) : (
                            currentPatient.companionContact ? (
                              <span className="text-gray-800">{currentPatient.companionContact}</span>
                            ) : (
                              <span className="text-gray-400 italic">Not specified</span>
                            )
                          )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Glasgow Coma Scale (GCS)</TableCell>
                          <TableCell>
                            {(() => {
                              const eyesScore = currentPatient.gcs.eyes ? parseInt(currentPatient.gcs.eyes) : 0;
                              const verbalScore = currentPatient.gcs.verbal ? parseInt(currentPatient.gcs.verbal) : 0;
                              const motorScore = currentPatient.gcs.motor ? parseInt(currentPatient.gcs.motor) : 0;
                              const total = eyesScore + verbalScore + motorScore;
                              const eyesOptions = [
                                { value: "4", label: "Spontaneous", short: "4" },
                                { value: "3", label: "To sound", short: "3" },
                                { value: "2", label: "To Pain", short: "2" },
                                { value: "1", label: "None", short: "1" }
                              ];
                              const verbalOptions = [
                                { value: "5", label: "Oriented", short: "5" },
                                { value: "4", label: "Confused", short: "4" },
                                { value: "3", label: "Words", short: "3" },
                                { value: "2", label: "Sounds", short: "2" },
                                { value: "1", label: "None", short: "1" }
                              ];
                              const motorOptions = [
                                { value: "6", label: "Obey Commands", short: "6" },
                                { value: "5", label: "Localizing", short: "5" },
                                { value: "4", label: "Withdrawn", short: "4" },
                                { value: "3", label: "Flexion", short: "3" },
                                { value: "2", label: "Extension", short: "2" },
                                { value: "1", label: "None", short: "1" }
                              ];
                              const getSeverityColor = (score: number) => {
                                if (score === 0) return "bg-gray-100 text-gray-600 border-gray-300";
                                if (score >= 13) return "bg-green-50 text-green-700 border-green-300";
                                if (score >= 9) return "bg-yellow-50 text-yellow-700 border-yellow-300";
                                return "bg-red-50 text-red-700 border-red-300";
                              };
                              const getSeverityLabel = (score: number) => {
                                if (score === 0) return "Not assessed";
                                if (score >= 13) return "Minor";
                                if (score >= 9) return "Moderate";
                                return "Severe";
                              };
                              return (
                                <div className="space-y-3">
                                  {/* Compact Score Display */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {/* Total Score - Prominent */}
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${getSeverityColor(total)}`}>
                                      <span className="text-xs font-medium uppercase tracking-wide">GCS</span>
                                      <span className="text-2xl font-bold">
                                        {total > 0 ? total : "—"}
                                      </span>
                                      {total > 0 && (
                                        <span className="text-xs font-medium ml-1">
                                          ({getSeverityLabel(total)})
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Individual Scores */}
                                    {isPatientEditMode ? (
                                      <div className="flex items-center gap-4 flex-wrap">
                                        {/* Eyes */}
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-600">E:</span>
                                          <Select 
                                            value={currentPatient.gcs.eyes || ""} 
                                            onValueChange={v => updateCurrentPatient({ gcs: { ...currentPatient.gcs, eyes: v } })}
                                          >
                                            <SelectTrigger className="w-[180px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                              <SelectValue placeholder="Eyes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {eyesOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                  {opt.short} - {opt.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        {/* Verbal */}
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-600">V:</span>
                                          <Select 
                                            value={currentPatient.gcs.verbal || ""} 
                                            onValueChange={v => updateCurrentPatient({ gcs: { ...currentPatient.gcs, verbal: v } })}
                                          >
                                            <SelectTrigger className="w-[180px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                              <SelectValue placeholder="Verbal" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {verbalOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                  {opt.short} - {opt.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        {/* Motor */}
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-600">M:</span>
                                          <Select 
                                            value={currentPatient.gcs.motor || ""} 
                                            onValueChange={v => updateCurrentPatient({ gcs: { ...currentPatient.gcs, motor: v } })}
                                          >
                                            <SelectTrigger className="w-[180px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                              <SelectValue placeholder="Motor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {motorOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                  {opt.short} - {opt.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2">
                                        {/* Eyes Badge */}
                                        {currentPatient.gcs.eyes ? (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 w-full">
                                            <span className="text-xs font-medium text-blue-600">E:</span>
                                            <span className="text-sm font-semibold text-blue-800">
                                              {eyesOptions.find(opt => opt.value === currentPatient.gcs.eyes)?.short}
                                            </span>
                                            <span className="text-xs text-blue-700">
                                              {eyesOptions.find(opt => opt.value === currentPatient.gcs.eyes)?.label}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                            <span className="text-xs font-medium text-gray-500">E:</span>
                                            <span className="text-xs text-gray-400">—</span>
                                          </div>
                                        )}
                                        
                                        {/* Verbal Badge */}
                                        {currentPatient.gcs.verbal ? (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 border border-green-200 w-full">
                                            <span className="text-xs font-medium text-green-600">V:</span>
                                            <span className="text-sm font-semibold text-green-800">
                                              {verbalOptions.find(opt => opt.value === currentPatient.gcs.verbal)?.short}
                                            </span>
                                            <span className="text-xs text-green-700">
                                              {verbalOptions.find(opt => opt.value === currentPatient.gcs.verbal)?.label}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                            <span className="text-xs font-medium text-gray-500">V:</span>
                                            <span className="text-xs text-gray-400">—</span>
                                          </div>
                                        )}
                                        
                                        {/* Motor Badge */}
                                        {currentPatient.gcs.motor ? (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 w-full">
                                            <span className="text-xs font-medium text-purple-600">M:</span>
                                            <span className="text-sm font-semibold text-purple-800">
                                              {motorOptions.find(opt => opt.value === currentPatient.gcs.motor)?.short}
                                            </span>
                                            <span className="text-xs text-purple-700">
                                              {motorOptions.find(opt => opt.value === currentPatient.gcs.motor)?.label}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                            <span className="text-xs font-medium text-gray-500">M:</span>
                                            <span className="text-xs text-gray-400">—</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Pupil Assessment</TableCell>
                          <TableCell>
                            {isPatientEditMode ? (
                              <Select value={currentPatient.pupil || ""} onValueChange={v => updateCurrentPatient({ pupil: v })}>
                                <SelectTrigger className="w-full max-w-md border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                  <SelectValue placeholder="Select pupil assessment" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PERRLA">PERRLA</SelectItem>
                                  <SelectItem value="Constricted">Constricted</SelectItem>
                                  <SelectItem value="Dilated">Dilated</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="w-full">
                                {currentPatient.pupil ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 border border-yellow-200 w-full">
                                    <span className="text-xs font-medium text-yellow-600">Pupil:</span>
                                    <span className="text-sm font-semibold text-yellow-800">
                                      {currentPatient.pupil}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                    <span className="text-xs font-medium text-gray-500">Pupil:</span>
                                    <span className="text-xs text-gray-400">—</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Lung Sounds</TableCell>
                          <TableCell>
                            {isPatientEditMode ? (
                              <Select value={currentPatient.lungSounds || ""} onValueChange={v => updateCurrentPatient({ lungSounds: v })}>
                                <SelectTrigger className="w-full max-w-md border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                  <SelectValue placeholder="Select lung sounds" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Clear">Clear</SelectItem>
                                  <SelectItem value="Absent">Absent</SelectItem>
                                  <SelectItem value="Decreased">Decreased</SelectItem>
                                  <SelectItem value="Rales">Rales</SelectItem>
                                  <SelectItem value="Wheezes">Wheezes</SelectItem>
                                  <SelectItem value="Stridor">Stridor</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="w-full">
                                {currentPatient.lungSounds ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 border border-cyan-200 w-full">
                                    <span className="text-xs font-medium text-cyan-600">Lung:</span>
                                    <span className="text-sm font-semibold text-cyan-800">
                                      {currentPatient.lungSounds}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                    <span className="text-xs font-medium text-gray-500">Lung:</span>
                                    <span className="text-xs text-gray-400">—</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Perfusion Assessment</TableCell>
                          <TableCell>
                            {isPatientEditMode ? (
                              <div className="flex items-center gap-4 flex-wrap">
                                {/* Skin */}
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-600">Skin:</span>
                                  <Select 
                                    value={currentPatient.perfusion.skin || ""} 
                                    onValueChange={v => updateCurrentPatient({ perfusion: { ...currentPatient.perfusion, skin: v } })}
                                  >
                                    <SelectTrigger className="w-[180px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                      <SelectValue placeholder="Skin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Normal">Normal</SelectItem>
                                      <SelectItem value="Warm">Warm</SelectItem>
                                      <SelectItem value="Dry">Dry</SelectItem>
                                      <SelectItem value="Moist">Moist</SelectItem>
                                      <SelectItem value="Cool">Cool</SelectItem>
                                      <SelectItem value="Pale">Pale</SelectItem>
                                      <SelectItem value="Cyanotic">Cyanotic</SelectItem>
                                      <SelectItem value="Flushed">Flushed</SelectItem>
                                      <SelectItem value="Jaundice">Jaundice</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Pulse */}
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-600">Pulse:</span>
                                  <Select 
                                    value={currentPatient.perfusion.pulse || ""} 
                                    onValueChange={v => updateCurrentPatient({ perfusion: { ...currentPatient.perfusion, pulse: v } })}
                                  >
                                    <SelectTrigger className="w-[180px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                      <SelectValue placeholder="Pulse" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Regular">Regular</SelectItem>
                                      <SelectItem value="Strong">Strong</SelectItem>
                                      <SelectItem value="Irregular">Irregular</SelectItem>
                                      <SelectItem value="Weak">Weak</SelectItem>
                                      <SelectItem value="Absent">Absent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 w-full">
                                {/* Skin Badge */}
                                {currentPatient.perfusion.skin ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-50 border border-pink-200 w-full">
                                    <span className="text-xs font-medium text-pink-600">Skin:</span>
                                    <span className="text-sm font-semibold text-pink-800">
                                      {currentPatient.perfusion.skin}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                    <span className="text-xs font-medium text-gray-500">Skin:</span>
                                    <span className="text-xs text-gray-400">—</span>
                                  </div>
                                )}
                                
                                {/* Pulse Badge */}
                                {currentPatient.perfusion.pulse ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 w-full">
                                    <span className="text-xs font-medium text-red-600">Pulse:</span>
                                    <span className="text-sm font-semibold text-red-800">
                                      {currentPatient.perfusion.pulse}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 w-full">
                                    <span className="text-xs font-medium text-gray-500">Pulse:</span>
                                    <span className="text-xs text-gray-400">—</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-sm font-medium text-gray-800 align-top w-1/3 min-w-[150px]">Vital Signs</TableCell>
                          <TableCell>
                            {isPatientEditMode ? (
                              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                {/* Column 1 */}
                                <div className="space-y-4">
                                  {/* Time */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">Time:</span>
                                    <Input 
                                      type="time" 
                                      value={currentPatient.vitalSigns.timeTaken} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, timeTaken: e.target.value } })} 
                                      className="w-[150px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                  </div>
                                  
                                  {/* Temperature */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">Temp:</span>
                                    <Input 
                                      type="number" 
                                      step="0.1"
                                      value={currentPatient.vitalSigns.temperature} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, temperature: e.target.value } })} 
                                      placeholder="36.5"
                                      className="w-[120px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                    <span className="text-sm text-gray-500 ml-0.5">°C</span>
                                  </div>
                                  
                                  {/* Pulse Rate */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">Pulse:</span>
                                    <Input 
                                      type="number" 
                                      value={currentPatient.vitalSigns.pulseRate} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, pulseRate: e.target.value } })} 
                                      placeholder="80"
                                      className="w-[120px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                    <span className="text-sm text-gray-500 ml-0.5">bpm</span>
                                  </div>
                                  
                                  {/* Respiratory Rate */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">RR:</span>
                                    <Input 
                                      type="number" 
                                      value={currentPatient.vitalSigns.respiratoryRate} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, respiratoryRate: e.target.value } })} 
                                      placeholder="16"
                                      className="w-[120px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                    <span className="text-sm text-gray-500 ml-0.5">/min</span>
                                  </div>
                                </div>
                                
                                {/* Column 2 */}
                                <div className="space-y-4">
                                  {/* Blood Pressure */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">BP:</span>
                                    <Input 
                                      value={currentPatient.vitalSigns.bloodPressure} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, bloodPressure: e.target.value } })} 
                                      placeholder="120/80"
                                      className="w-[130px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                    <span className="text-sm text-gray-500 ml-0.5">mmHg</span>
                                  </div>
                                  
                                  {/* SPO2 */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">SPO2:</span>
                                    <Input 
                                      type="number" 
                                      value={currentPatient.vitalSigns.spo2} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, spo2: e.target.value } })} 
                                      placeholder="98"
                                      className="w-[100px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                    <span className="text-sm text-gray-500 ml-0.5">%</span>
                                    <div className="flex items-center gap-1.5 ml-2">
                                      <Checkbox
                                        id="spo2-o2-support"
                                        checked={currentPatient.vitalSigns.spo2WithO2Support}
                                        onCheckedChange={(checked) => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, spo2WithO2Support: checked as boolean } })}
                                        className="h-4 w-4"
                                      />
                                      <Label htmlFor="spo2-o2-support" className="text-sm text-gray-600 cursor-pointer">
                                        O2
                                      </Label>
                                    </div>
                                  </div>
                                  
                                  {/* Blood Sugar */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">RBS:</span>
                                    <Input 
                                      type="number" 
                                      value={currentPatient.vitalSigns.randomBloodSugar} 
                                      onChange={e => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, randomBloodSugar: e.target.value } })} 
                                      placeholder="100"
                                      className="w-[120px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0"
                                    />
                                    <span className="text-sm text-gray-500 ml-0.5">mg/dL</span>
                                  </div>
                                  
                                  {/* Pain Scale */}
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-gray-600 w-[50px]">Pain:</span>
                                    <Select value={currentPatient.vitalSigns.painScale || ""} onValueChange={v => updateCurrentPatient({ vitalSigns: { ...currentPatient.vitalSigns, painScale: v } })}>
                                      <SelectTrigger className="w-[180px] border-gray-300 focus:border-black focus-visible:border-black focus:ring-0 focus-visible:ring-0">
                                        <SelectValue placeholder="Pain scale" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 11 }, (_, i) => (
                                          <SelectItem key={i} value={i.toString()}>
                                            {i} - {i === 0 ? "No pain" : i <= 3 ? "Mild" : i <= 6 ? "Moderate" : i <= 8 ? "Severe" : "Unbearable"}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* First Row - Core Vitals */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  {/* Time */}
                                  {currentPatient.vitalSigns.timeTaken ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200">
                                      <span className="text-xs font-medium text-gray-600">Time:</span>
                                      <span className="text-sm font-semibold text-gray-800">
                                        {currentPatient.vitalSigns.timeTaken}
                                      </span>
                                    </div>
                                  ) : null}
                                  
                                  {/* Temperature */}
                                  {currentPatient.vitalSigns.temperature ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200">
                                      <span className="text-xs font-medium text-red-600">Temp:</span>
                                      <span className="text-sm font-semibold text-red-800">
                                        {currentPatient.vitalSigns.temperature}°C
                                      </span>
                                    </div>
                                  ) : null}
                                  
                                  {/* Pulse Rate */}
                                  {currentPatient.vitalSigns.pulseRate ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200">
                                      <span className="text-xs font-medium text-blue-600">Pulse:</span>
                                      <span className="text-sm font-semibold text-blue-800">
                                        {currentPatient.vitalSigns.pulseRate} bpm
                                      </span>
                                    </div>
                                  ) : null}
                                  
                                  {/* Respiratory Rate */}
                                  {currentPatient.vitalSigns.respiratoryRate ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 border border-green-200">
                                      <span className="text-xs font-medium text-green-600">RR:</span>
                                      <span className="text-sm font-semibold text-green-800">
                                        {currentPatient.vitalSigns.respiratoryRate} /min
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                                
                                {/* Second Row - BP, SPO2, Blood Sugar, Pain */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  {/* Blood Pressure */}
                                  {currentPatient.vitalSigns.bloodPressure ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200">
                                      <span className="text-xs font-medium text-purple-600">BP:</span>
                                      <span className="text-sm font-semibold text-purple-800">
                                        {currentPatient.vitalSigns.bloodPressure} mmHg
                                      </span>
                                    </div>
                                  ) : null}
                                  
                                  {/* SPO2 */}
                                  {currentPatient.vitalSigns.spo2 ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 border border-cyan-200">
                                      <span className="text-xs font-medium text-cyan-600">SPO2:</span>
                                      <span className="text-sm font-semibold text-cyan-800">
                                        {currentPatient.vitalSigns.spo2}%
                                      </span>
                                      {currentPatient.vitalSigns.spo2WithO2Support && (
                                        <span className="text-xs text-orange-700 ml-1">(O2)</span>
                                      )}
                                    </div>
                                  ) : null}
                                  
                                  {/* Blood Sugar */}
                                  {currentPatient.vitalSigns.randomBloodSugar ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 border border-yellow-200">
                                      <span className="text-xs font-medium text-yellow-600">RBS:</span>
                                      <span className="text-sm font-semibold text-yellow-800">
                                        {currentPatient.vitalSigns.randomBloodSugar} mg/dL
                                      </span>
                                    </div>
                                  ) : null}
                                  
                                  {/* Pain Scale */}
                                  {currentPatient.vitalSigns.painScale ? (
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                                      parseInt(currentPatient.vitalSigns.painScale) <= 3 ? "bg-green-50 border-green-200" :
                                      parseInt(currentPatient.vitalSigns.painScale) <= 6 ? "bg-yellow-50 border-yellow-200" :
                                      parseInt(currentPatient.vitalSigns.painScale) <= 8 ? "bg-orange-50 border-orange-200" :
                                      "bg-red-50 border-red-200"
                                    }`}>
                                      <span className={`text-xs font-medium ${
                                        parseInt(currentPatient.vitalSigns.painScale) <= 3 ? "text-green-600" :
                                        parseInt(currentPatient.vitalSigns.painScale) <= 6 ? "text-yellow-600" :
                                        parseInt(currentPatient.vitalSigns.painScale) <= 8 ? "text-orange-600" :
                                        "text-red-600"
                                      }`}>Pain:</span>
                                      <span className={`text-sm font-semibold ${
                                        parseInt(currentPatient.vitalSigns.painScale) <= 3 ? "text-green-800" :
                                        parseInt(currentPatient.vitalSigns.painScale) <= 6 ? "text-yellow-800" :
                                        parseInt(currentPatient.vitalSigns.painScale) <= 8 ? "text-orange-800" :
                                        "text-red-800"
                                      }`}>
                                        {currentPatient.vitalSigns.painScale} - {parseInt(currentPatient.vitalSigns.painScale) === 0 ? "No pain" : parseInt(currentPatient.vitalSigns.painScale) <= 3 ? "Mild" : parseInt(currentPatient.vitalSigns.painScale) <= 6 ? "Moderate" : parseInt(currentPatient.vitalSigns.painScale) <= 8 ? "Severe" : "Unbearable"}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                                
                                {/* Show message if no vital signs recorded */}
                                {!currentPatient.vitalSigns.timeTaken && 
                                 !currentPatient.vitalSigns.temperature && 
                                 !currentPatient.vitalSigns.pulseRate && 
                                 !currentPatient.vitalSigns.respiratoryRate && 
                                 !currentPatient.vitalSigns.bloodPressure && 
                                 !currentPatient.vitalSigns.spo2 && 
                                 !currentPatient.vitalSigns.randomBloodSugar && 
                                 !currentPatient.vitalSigns.painScale && (
                                  <span className="text-gray-500 text-sm">No vital signs recorded</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

            </Tabs>
              </>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-gray-500 text-lg">Loading report preview...</div>
                  <div className="text-sm text-gray-400 mt-2">selectedReport: {selectedReport ? 'exists' : 'null'}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Image Preview Modal */}
        <Dialog open={showImagePreview} onOpenChange={(open) => {
          console.log('Image preview modal state change:', open);
          setShowImagePreview(open);
        }}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] bg-white flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-brand-orange" />
                Image Preview
                {(() => {
                  const isAdminMedia = (isPreviewEditMode ? previewEditData?.adminMedia : selectedReport?.adminMedia)?.includes(previewImageUrl);
                  const isMobileMedia = (isPreviewEditMode ? previewEditData?.mobileMedia : selectedReport?.mobileMedia)?.includes(previewImageUrl);
                  
                  if (isAdminMedia) {
                    return <Badge variant="outline" className="border-gray-500 text-gray-800 text-xs">Admin Added</Badge>;
                  } else if (isMobileMedia) {
                    return <Badge variant="secondary" className="text-xs">Mobile User</Badge>;
                  }
                  return null;
                })()}
              </DialogTitle>
              <DialogDescription>
                {previewImageName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
              <div className="relative max-w-full max-h-full">
                <img 
                  src={previewImageUrl} 
                  alt={previewImageName}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-full h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                          <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <p class="text-gray-500 text-center">Failed to load image</p>
                          <p class="text-sm text-gray-400 text-center mt-1">${previewImageName}</p>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleDownloadImage(previewImageUrl, previewImageName)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              {isPreviewEditMode && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    const imageIndex = (isPreviewEditMode ? previewEditData?.attachedMedia : selectedReport?.attachedMedia)?.findIndex((url: string) => url === previewImageUrl);
                    if (imageIndex !== undefined && imageIndex >= 0) {
                      handleDeleteImage(previewImageUrl, imageIndex);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Location Map Modal */}
        <Dialog open={showLocationMap} onOpenChange={(open) => {
          setShowLocationMap(open);
          if (!open) {
            setLocationMapSearchQuery("");
            setLocationMapSearchSuggestions([]);
            setIsLocationMapSearchOpen(false);
            setNewLocation(null);
          }
        }}>
          <DialogContent
            hideOverlay
            className="sm:max-w-[720px] max-h-[85vh] bg-white flex flex-col overflow-hidden"
          >
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-orange" />
                Select New Location
              </DialogTitle>
              <DialogDescription>
                Click on the map to select a new location for this report. The address will be automatically updated.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 min-h-0 flex flex-col py-2">
              <div
                className="relative flex-1 min-h-0 border rounded-lg overflow-hidden"
                style={{ height: '420px' }}
              >
                <div className="pointer-events-none absolute top-4 left-4 right-4 z-10">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-lg pointer-events-auto">
                    <Popover open={isLocationMapSearchOpen} onOpenChange={setIsLocationMapSearchOpen}>
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
                          <Input
                            type="text"
                            placeholder="Search for a location..."
                            value={locationMapSearchQuery}
                            onChange={(e) => {
                              setLocationMapSearchQuery(e.target.value);
                              setIsLocationMapSearchOpen(true);
                            }}
                            onFocus={() => {
                              if (locationMapSearchSuggestions.length > 0) {
                                setIsLocationMapSearchOpen(true);
                              }
                            }}
                            className="pl-9 pr-4 h-10 w-full border-gray-300"
                          />
                        </div>
                      </PopoverTrigger>
                      {locationMapSearchSuggestions.length > 0 && (
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <div className="max-h-[320px] overflow-y-auto">
                            {locationMapSearchSuggestions.map((suggestion: any, index: number) => (
                              <button
                                key={index}
                                className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                                onClick={() => handleSelectLocationMapSuggestion(suggestion)}
                              >
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {suggestion.text}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {suggestion.place_name}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                </div>

                <MapboxMap 
                  onMapClick={handleMapClick}
                  showOnlyCurrentLocation={false}
                  clickedLocation={newLocation}
                  showGeocoder={false}
                  showControls={true}
                  showDirections={true}
                  showUserLocationMarker={true}
                  singleMarker={selectedReport?.latitude && selectedReport?.longitude ? 
                    {
                      id: selectedReport.id || 'report-marker',
                      type: selectedReport.type || 'Emergency',
                      title: selectedReport.location || 'Report Location',
                      description: selectedReport.description || 'Emergency report location',
                      reportId: selectedReport.id,
                      coordinates: [selectedReport.longitude, selectedReport.latitude] as [number, number],
                      status: selectedReport.status,
                      locationName: selectedReport.location,
                      latitude: selectedReport.latitude,
                      longitude: selectedReport.longitude
                    } : 
                    undefined}
                  disableSingleMarkerPulse={true}
                  center={newLocation ? 
                    [newLocation.lng, newLocation.lat] as [number, number] :
                    selectedReport?.latitude && selectedReport?.longitude ? 
                    [selectedReport.longitude, selectedReport.latitude] as [number, number] : 
                    [121.5556, 14.1139] as [number, number]} // Center on Lucban, Quezon
                  zoom={newLocation ? 15 : 14}
                />
              </div>
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowLocationMap(false);
                setNewLocation(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLocation}
                disabled={!newLocation || isSavingLocation}
                className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingLocation ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                ) : (
                  "Save Location"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Location Map Modal */}
        <Dialog open={showAddLocationMap} onOpenChange={setShowAddLocationMap}>
          <DialogContent
            hideOverlay
            className="sm:max-w-[720px] max-h-[85vh] bg-white flex flex-col overflow-hidden"
          >
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-orange" />
                Select Location
              </DialogTitle>
              <DialogDescription>
                Click on the map to select the location for this report. The address will be automatically updated.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 min-h-0 flex flex-col py-2">
              <div
                className="relative flex-1 min-h-0 border rounded-lg overflow-hidden"
                style={{ height: '420px' }}
              >
                <div className="pointer-events-none absolute top-4 left-4 right-4 z-10">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-lg pointer-events-auto">
                    <Popover open={isAddLocationSearchOpen} onOpenChange={setIsAddLocationSearchOpen}>
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
                          <Input
                            type="text"
                            placeholder="Search for a location..."
                            value={addLocationSearchQuery}
                            onChange={(e) => {
                              setAddLocationSearchQuery(e.target.value);
                              setIsAddLocationSearchOpen(true);
                            }}
                            onFocus={() => {
                              if (addLocationSearchSuggestions.length > 0) {
                                setIsAddLocationSearchOpen(true);
                              }
                            }}
                            className="pl-9 pr-4 h-10 w-full border-gray-300"
                          />
                        </div>
                      </PopoverTrigger>
                      {addLocationSearchSuggestions.length > 0 && (
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <div className="max-h-[320px] overflow-y-auto">
                            {addLocationSearchSuggestions.map((suggestion: any, index: number) => (
                              <button
                                key={index}
                                className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                                onClick={() => handleSelectAddLocationSuggestion(suggestion)}
                              >
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {suggestion.text}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {suggestion.place_name}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                </div>

                <MapboxMap 
                  onMapClick={handleAddReportMapClick}
                  showOnlyCurrentLocation={false}
                  showGeocoder={false}
                  showControls={true}
                  showDirections={true}
                  showUserLocationMarker={true}
                  clickedLocation={
                    addLocationData
                      ? {
                          lat: addLocationData.lat,
                          lng: addLocationData.lng,
                          address:
                            addLocationData.address ||
                            formData.location ||
                            "Selected location",
                        }
                      : null
                  }
                  center={addLocationMapCenter}
                  zoom={addLocationMapZoom}
                />
              </div>
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddLocationMap(false);
                setAddLocationData(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (addLocationData) {
                    setShowAddLocationMap(false);
                    toast.success('Location pinned successfully!');
                  }
                }}
                disabled={!addLocationData}
                className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Team Management Modal */}
        <Dialog open={showTeamManagement} onOpenChange={setShowTeamManagement}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Team Members</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Team Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Team</label>
                <div className="flex gap-2">
                  <Button
                    variant={selectedTeamForManagement === "Team Alpha" ? "default" : "outline"}
                    onClick={() => setSelectedTeamForManagement("Team Alpha")}
                  >
                    Team Alpha
                  </Button>
                  <Button
                    variant={selectedTeamForManagement === "Team Sulu" ? "default" : "outline"}
                    onClick={() => setSelectedTeamForManagement("Team Sulu")}
                  >
                    Team Sulu
                  </Button>
                </div>
              </div>

              {/* Add New Member */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Add New Member</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter member name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (newMemberName.trim()) {
                        addTeamMember(selectedTeamForManagement, newMemberName.trim());
                        setNewMemberName("");
                      }
                    }}
                    disabled={!newMemberName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Current Members */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Members</label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {selectedTeamForManagement === "Team Alpha" ? (
                    teamAlpha.length > 0 ? (
                      <div className="space-y-2">
                        {teamAlpha.map((member, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">{member}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeTeamMember("Team Alpha", member)}
                              className="text-brand-red hover:text-brand-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-4">No members in Team Alpha</div>
                    )
                  ) : (
                    teamSulu.length > 0 ? (
                      <div className="space-y-2">
                        {teamSulu.map((member, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">{member}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeTeamMember("Team Sulu", member)}
                              className="text-brand-red hover:text-brand-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-4">No members in Team Sulu</div>
                    )
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowTeamManagement(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Report Alert Modal */}
        <Dialog open={showNewReportAlert} onOpenChange={(open) => {
          if (!open) {
            stopAlarm();
          }
          setShowNewReportAlert(open);
        }}>
          <DialogContent className="max-w-md border-brand-red bg-red-50">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-brand-red flex items-center gap-2">
                <div className="w-3 h-3 bg-brand-red rounded-full animate-pulse"></div>
                🚨 NEW EMERGENCY REPORT
              </DialogTitle>
            </DialogHeader>
            {newReportData && (
              <div className="space-y-4 py-4">
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-800">Report ID: {newReportData.id}</h4>
                        <p className="text-sm text-gray-600">Type: {newReportData.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-800">{newReportData.dateSubmitted}</p>
                        <p className="text-sm text-gray-600">{newReportData.timeSubmitted}</p>
                      </div>
                    </div>
                    
                    {newReportData.description && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Description:</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          {newReportData.description.length > 100 
                            ? `${newReportData.description.substring(0, 100)}...` 
                            : newReportData.description}
                        </p>
                      </div>
                    )}
                    
                    {newReportData.location && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Location:</p>
                        <p className="text-sm text-gray-600">{newReportData.location}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      stopAlarm();
                      setShowNewReportAlert(false);
                      // You can add navigation to the specific report here
                    }}
                    className="flex-1 bg-brand-red hover:bg-brand-red-700 text-white"
                  >
                    View Report
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      stopAlarm();
                      setShowNewReportAlert(false);
                    }}
                    className="flex-1 border-red-300 text-brand-red hover:bg-red-100"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Patient Location Map Modal */}
        <Dialog open={showPatientLocationMap} onOpenChange={setShowPatientLocationMap}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-orange" />
                Pin Patient Location
              </DialogTitle>
              <DialogDescription>
                Click on the map to select the patient's location. The address will be automatically filled.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 relative min-h-[400px] rounded-lg overflow-hidden border border-gray-200">
                <MapboxMap
                  center={patientLocationData ? [patientLocationData.lng, patientLocationData.lat] : [121.5556, 14.1139]}
                  zoom={patientLocationData ? 15 : 11}
                  showControls={true}
                  showGeocoder={true}
                  onMapClick={handlePatientLocationMapClick}
                  singleMarker={patientLocationData ? {
                    id: 'patient-location-marker',
                    type: 'Patient Location',
                    title: 'Patient Location',
                    description: patientLocationData.address,
                    coordinates: [patientLocationData.lng, patientLocationData.lat] as [number, number],
                    latitude: patientLocationData.lat,
                    longitude: patientLocationData.lng,
                    locationName: patientLocationData.address
                  } : undefined}
                  disableSingleMarkerPulse={false}
                  hideStyleToggle={false}
                />
              </div>
              {patientLocationData && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-1">Selected Location:</div>
                  <div className="text-sm text-gray-900">{patientLocationData.address}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Coordinates: {patientLocationData.lat.toFixed(6)}, {patientLocationData.lng.toFixed(6)}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowPatientLocationMap(false);
                setPatientLocationData(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSavePatientLocation}
                disabled={!patientLocationData}
                className="bg-brand-orange hover:bg-brand-orange-400 text-white"
              >
                Save Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Report</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this report? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteReport}
                disabled={isDeletingReport !== null}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingReport ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </div>
                ) : (
                  "Delete Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Delete Confirmation Dialog */}
        <Dialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Selected Reports</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedReports.length} selected report(s)? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={confirmBatchDelete}>
                Delete {selectedReports.length} Report(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
