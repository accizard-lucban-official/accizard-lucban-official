/**
 * Announcements Page
 * 
 * Features:
 * - Create, edit, and delete announcements
 * - Filter by type, priority, and date range
 * - Batch delete functionality
 * - Preview announcement details
 * 
 * Push Notifications:
 * - Automatically sends push notifications to ALL users when a new announcement is created
 * - Cloud Function: sendAnnouncementNotification (functions/src/index.ts)
 * - Priority-based notification titles:
 *   - High: "🚨 Important Announcement"
 *   - Medium: "📢 New Announcement"
 *   - Low: "ℹ️ Announcement"
 * - Broadcasts to all users with FCM tokens (batch processing for scalability)
 * - See CHAT_IMPLEMENTATION_GUIDE.md for full details
 */

import { useState, useEffect, useMemo, useRef, ReactNode, ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Calendar, AlertTriangle, Info, X, Eye, ChevronUp, ChevronDown, Check, Megaphone, Download, CloudLightning, Waves, Mountain, Activity, TrafficCone, UserSearch, ListFilter, Upload, FileIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Layout } from "./Layout";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { uploadAnnouncementMedia, formatFileSize, MAX_FILE_SIZE } from "@/lib/storage";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DateRangePicker } from "@/components/ui/date-range-picker";

type AnnouncementMedia = {
  url: string;
  path: string;
  fileName: string;
};

const urlPattern = /(https?:\/\/[^\s]+)/g;

const ANNOUNCEMENT_TYPES: string[] = [
  "Weather Warning",
  "Flood",
  "Landslide",
  "Earthquake",
  "Road Closure",
  "Evacuation Order",
  "Missing Person",
  "Informational"
];

const ANNOUNCEMENT_TYPE_ICONS: Record<string, LucideIcon> = {
  "Weather Warning": CloudLightning,
  "Flood": Waves,
  "Landslide": Mountain,
  "Earthquake": Activity,
  "Road Closure": TrafficCone,
  "Evacuation Order": Megaphone,
  "Missing Person": UserSearch,
  "Informational": Info
};

const renderAnnouncementTypeOption = (type: string) => {
  const Icon = ANNOUNCEMENT_TYPE_ICONS[type] ?? Info;
  return (
    <span className="flex items-center gap-2 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange">
      <Icon className="h-4 w-4 text-gray-500 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange" />
      <span>{type}</span>
    </span>
  );
};

const linkifyText = (text: string): ReactNode[] => {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  text.replace(urlPattern, (url, offset) => {
    if (lastIndex < offset) {
      nodes.push(
        <span key={`text-${lastIndex}-${offset}`}>
          {text.slice(lastIndex, offset)}
        </span>
      );
    }
    nodes.push(
      <a
        key={`link-${offset}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-orange underline break-words"
      >
        {url}
      </a>
    );
    lastIndex = offset + url.length;
    return url;
  });

  if (lastIndex < text.length) {
    nodes.push(
      <span key={`text-${lastIndex}-end`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  if (nodes.length === 0 && text) {
    nodes.push(<span key="text-only">{text}</span>);
  }

  return nodes;
};

function formatTimeNoSeconds(time: string | number | null | undefined) {
  if (!time) return '-';
  let dateObj;
  if (typeof time === 'number') {
    dateObj = new Date(time);
  } else if (/\d{1,2}:\d{2}(:\d{2})?/.test(time)) {
    const today = new Date();
    dateObj = new Date(`${today.toDateString()} ${time}`);
  } else {
    dateObj = new Date(time);
  }
  if (isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function AnnouncementsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isNewAnnouncementOpen, setIsNewAnnouncementOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({
    type: "",
    description: "",
    priority: ""
  });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [announcementRowsPerPage, setAnnouncementRowsPerPage] = useState(10);
  const ANNOUNCEMENT_ROWS_OPTIONS = [10, 20, 50, 100];
  const [newAnnouncementMedia, setNewAnnouncementMedia] = useState<File[]>([]);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [isMediaDragActive, setIsMediaDragActive] = useState(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>("desc");
  const [editDialogOpenId, setEditDialogOpenId] = useState<string | null>(null);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<Set<string>>(new Set());
  
  // Loading states
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [isDeletingAnnouncement, setIsDeletingAnnouncement] = useState<string | null>(null);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const announcementMediaPreviewUrls = useMemo(
    () => newAnnouncementMedia.map(file => URL.createObjectURL(file)),
    [newAnnouncementMedia]
  );

  useEffect(() => {
    return () => {
      announcementMediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [announcementMediaPreviewUrls]);

  const getTypeOptions = (currentType?: string) => {
    if (currentType && !ANNOUNCEMENT_TYPES.includes(currentType)) {
      return [currentType, ...ANNOUNCEMENT_TYPES];
    }
    return ANNOUNCEMENT_TYPES;
  };

  const today = new Date();

  // Fetch announcements from Firestore on mount
  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const querySnapshot = await getDocs(collection(db, "announcements"));
        const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAnnouncements(fetched);
        setIsLoadingAnnouncements(false);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        setIsLoadingAnnouncements(false);
      }
    }
    fetchAnnouncements();
  }, []);

  const filteredAnnouncements = announcements.filter(announcement => {
    const search = searchTerm.toLowerCase();
    // Search matches any field
    const matchesSearch =
      (announcement.description?.toLowerCase().includes(search) ||
      announcement.type?.toLowerCase().includes(search) ||
      announcement.priority?.toLowerCase().includes(search) ||
      announcement.createdBy?.toLowerCase().includes(search) ||
      (announcement.date && announcement.date.toLowerCase().includes(search)));
    // Type filter
    const matchesType = typeFilter === "all" || announcement.type === typeFilter;
    // Priority filter
    const matchesPriority = priorityFilter === "all" || announcement.priority === priorityFilter;
    // Date range filter (createdTime)
    let matchesDate = true;
    if (dateRange?.from && dateRange?.to) {
      const created = announcement.createdTime ? new Date(announcement.createdTime) : null;
      if (created) {
        // Set time to 0:00 for from, 23:59 for to
        const from = new Date(dateRange.from);
        from.setHours(0,0,0,0);
        const to = new Date(dateRange.to);
        to.setHours(23,59,59,999);
        matchesDate = created >= from && created <= to;
      }
    }
    return matchesSearch && matchesType && matchesPriority && matchesDate;
  });

  // Sort by createdTime, order based on sortOrder
  const sortedAnnouncements = filteredAnnouncements.sort((a, b) => {
    const aTime = a.createdTime || 0;
    const bTime = b.createdTime || 0;
    return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  const pagedAnnouncements = sortedAnnouncements.slice((announcementPage - 1) * announcementRowsPerPage, announcementPage * announcementRowsPerPage);
  const announcementTotalPages = Math.ceil(filteredAnnouncements.length / announcementRowsPerPage);
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };
  const handleAddAnnouncement = async () => {
    setIsAddingAnnouncement(true);
    setMediaUploadError(null);
    try {
      const selectedMediaCount = newAnnouncementMedia.length;
      const newAnnouncementWithDate = {
        ...newAnnouncement,
        date: new Date().toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }),
        createdTime: Date.now(),
        createdBy: 'admin', // Replace with actual user if available
        media: []
      };

      const announcementsCollection = collection(db, "announcements");
      const docRef = await addDoc(announcementsCollection, newAnnouncementWithDate);
      let uploadedMedia: AnnouncementMedia[] = [];

      if (selectedMediaCount > 0) {
        try {
          uploadedMedia = await Promise.all(
            newAnnouncementMedia.map(file => uploadAnnouncementMedia(file, docRef.id))
          );

          await updateDoc(doc(db, "announcements", docRef.id), {
            media: uploadedMedia,
            updatedAt: serverTimestamp()
          });
        } catch (mediaError) {
          console.error("Error uploading announcement media:", mediaError);
          const errorMessage = mediaError instanceof Error ? mediaError.message : "Unknown error uploading media.";
          setMediaUploadError(errorMessage);
          toast({
            title: "Media Upload Failed",
            description: "The announcement was saved, but some media failed to upload. You can try uploading again from the edit dialog.",
            variant: "destructive"
          });
        }
      }

      setAnnouncements(prev => [...prev, { ...newAnnouncementWithDate, id: docRef.id, media: uploadedMedia }]);
      resetNewAnnouncementForm();
      setIsNewAnnouncementOpen(false);

      toast({
        title: "Announcement Created",
        description: selectedMediaCount
          ? uploadedMedia.length === selectedMediaCount
            ? `The announcement has been added with ${uploadedMedia.length} media file(s).`
            : `The announcement has been added. ${uploadedMedia.length} of ${selectedMediaCount} media file(s) uploaded successfully.`
          : "The new announcement has been added successfully.",
      });
    } catch (error) {
      console.error("Error adding announcement:", error);
      toast({
        title: "Error",
        description: "Failed to add announcement. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingAnnouncement(false);
    }
  };
  const handleEditAnnouncement = (announcement: any) => {
    setEditingAnnouncement({ ...announcement });
    setEditDialogOpenId(announcement.id);
  };
  const handleSaveEdit = async () => {
    if (!editingAnnouncement) return;
    setIsEditingAnnouncement(true);
    try {
      await updateDoc(doc(db, "announcements", editingAnnouncement.id), {
        type: editingAnnouncement.type,
        description: editingAnnouncement.description,
        priority: editingAnnouncement.priority,
        date: editingAnnouncement.date
      });
      setAnnouncements(announcements.map(a => a.id === editingAnnouncement.id ? editingAnnouncement : a));
      setEditingAnnouncement(null);
      setEditDialogOpenId(null);
      toast({
        title: "Announcement Updated",
        description: "The announcement has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating announcement:", error);
      toast({
        title: "Error",
        description: "Failed to update announcement. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsEditingAnnouncement(false);
    }
  };
  const handleDeleteAnnouncement = async (id: string) => {
    setIsDeletingAnnouncement(id);
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements(announcements.filter(a => a.id !== id));
      toast({
        title: "Announcement Deleted",
        description: "The announcement has been deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast({
        title: "Error",
        description: "Failed to delete announcement. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingAnnouncement(null);
    }
  };

  // Handle priority change directly from table
  const handlePriorityChange = async (announcementId: string, newPriority: string) => {
    try {
      console.log(`Updating announcement ${announcementId} priority to ${newPriority}`);
      
      // Update in Firestore
      await updateDoc(doc(db, "announcements", announcementId), {
        priority: newPriority,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setAnnouncements(announcements.map(a => 
        a.id === announcementId ? { ...a, priority: newPriority } : a
      ));
      
      toast({
        title: "Priority Updated",
        description: `Priority updated to ${newPriority}`,
      });
    } catch (error) {
      console.error("Error updating priority:", error);
      toast({
        title: "Error",
        description: "Failed to update priority. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedAnnouncements.size === 0) return;
    
    try {
      // Delete all selected announcements from Firestore
      const deletePromises = Array.from(selectedAnnouncements).map(id => 
        deleteDoc(doc(db, "announcements", id))
      );
      await Promise.all(deletePromises);
      
      // Update local state
      setAnnouncements(announcements.filter(a => !selectedAnnouncements.has(a.id)));
      setSelectedAnnouncements(new Set());
      
      toast({
        title: "Announcements Deleted",
        description: `${selectedAnnouncements.size} announcement(s) have been deleted successfully.`,
      });
    } catch (error) {
      console.error("Error deleting announcements:", error);
      toast({
        title: "Error",
        description: "Failed to delete some announcements. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSelectAnnouncement = (id: string, checked: boolean) => {
    setSelectedAnnouncements(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAnnouncements(new Set(pagedAnnouncements.map(a => a.id)));
    } else {
      setSelectedAnnouncements(new Set());
    }
  };

  const isAllSelected = pagedAnnouncements.length > 0 && selectedAnnouncements.size === pagedAnnouncements.length;
  const isIndeterminate = selectedAnnouncements.size > 0 && selectedAnnouncements.size < pagedAnnouncements.length;

  // Clear selections when page changes or filters change
  useEffect(() => {
    setSelectedAnnouncements(new Set());
  }, [announcementPage, searchTerm, typeFilter, priorityFilter, dateRange]);

  // Helper to truncate description
  function truncateDescription(desc: string, maxLength = 20) {
    if (!desc) return '';
    return desc.length > maxLength ? desc.slice(0, maxLength) + '…' : desc;
  }

  const addAnnouncementMediaFiles = (files: FileList | File[] | null) => {
    if (!files) return;

    const incomingFiles = Array.from(files);
    if (incomingFiles.length === 0) return;

    const currentSignatures = new Set(
      newAnnouncementMedia.map(file => `${file.name}-${file.size}-${file.lastModified}`)
    );

    const oversizedFiles: File[] = [];
    const duplicateFiles: File[] = [];
    const validFiles: File[] = [];

    incomingFiles.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file);
        return;
      }

      const signature = `${file.name}-${file.size}-${file.lastModified}`;
      if (currentSignatures.has(signature)) {
        duplicateFiles.push(file);
        return;
      }

      currentSignatures.add(signature);
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      setNewAnnouncementMedia(prev => [...prev, ...validFiles]);
    }

    if (oversizedFiles.length > 0 || duplicateFiles.length > 0) {
      const messages: string[] = [];
      if (oversizedFiles.length > 0) {
        const limitInMb = Math.round((MAX_FILE_SIZE / (1024 * 1024)) * 10) / 10;
        messages.push(
          `Files exceeding ${limitInMb} MB were skipped: ${oversizedFiles
            .map(file => `"${file.name}"`)
            .join(", ")}.`
        );
      }
      if (duplicateFiles.length > 0) {
        messages.push(`${duplicateFiles.length} duplicate file${duplicateFiles.length > 1 ? "s were" : " was"} skipped.`);
      }
      setMediaUploadError(messages.join(" "));
    } else if (validFiles.length > 0) {
      setMediaUploadError(null);
    }
  };

  const handleAnnouncementMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    addAnnouncementMediaFiles(event.target.files);
    event.target.value = "";
  };

  const handleMediaDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMediaDragActive(true);
  };

  const handleMediaDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMediaDragActive(true);
  };

  const handleMediaDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    setIsMediaDragActive(false);
  };

  const handleMediaDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMediaDragActive(false);
    addAnnouncementMediaFiles(event.dataTransfer?.files ?? null);
  };

  const openMediaFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAnnouncementMedia = (index: number) => {
    setNewAnnouncementMedia(prev => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const clearAnnouncementMediaSelection = () => {
    setNewAnnouncementMedia([]);
    setMediaUploadError(null);
    setIsMediaDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetNewAnnouncementForm = () => {
    setNewAnnouncement({
      type: "",
      description: "",
      priority: ""
    });
    setNewAnnouncementMedia([]);
    setMediaUploadError(null);
  };

  const escapeCSVValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleExportAnnouncements = () => {
    if (sortedAnnouncements.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no announcements available to export.",
      });
      return;
    }

    const csvHeaders = ["Type", "Priority", "Description", "Created Date", "Created Time", "Created By", "Media URLs"];
    const csvRows = sortedAnnouncements.map(announcement => {
      const mediaUrls = Array.isArray(announcement.media)
        ? announcement.media.map((mediaItem: AnnouncementMedia) => mediaItem?.url).filter(Boolean).join(" | ")
        : "";

      return [
        escapeCSVValue(announcement.type || ""),
        escapeCSVValue(announcement.priority || ""),
        escapeCSVValue(announcement.description || ""),
        escapeCSVValue(announcement.date || ""),
        escapeCSVValue(formatTimeNoSeconds(announcement.createdTime)),
        escapeCSVValue(announcement.createdBy || ""),
        escapeCSVValue(mediaUrls)
      ].join(",");
    });

    const csvContent = [csvHeaders.join(","), ...csvRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
    link.href = url;
    link.download = `announcements-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Started",
      description: `Exported ${sortedAnnouncements.length} announcement(s) to CSV.`,
    });
  };

  return <Layout>
      <div className="">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Total Announcements</p>
                    <p className="text-xs text-brand-orange font-medium">All time</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">{announcements.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">High Priority</p>
                    <p className="text-xs text-brand-orange font-medium">Urgent alerts</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">{announcements.filter(a => a.priority === 'high').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">This Week</p>
                    <p className="text-xs text-brand-orange font-medium">Last 7 days</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">5</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          {/* Table Toolbar */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Add New Announcement Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setIsNewAnnouncementOpen(true)} size="sm" className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create a new announcement</p>
                </TooltipContent>
              </Tooltip>

              {/* Search Bar */}
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search announcements..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-9" 
                />
              </div>

              {/* Date Range Filter */}
              <div className="flex items-end gap-3">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  className="w-[260px]"
                />
                {(dateRange?.from || dateRange?.to) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRange(undefined)}
                    className="h-9"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="group">
                    <span className="flex items-center gap-2">
                      <ListFilter className="h-4 w-4 text-gray-500 transition-colors group-hover:text-brand-orange group-data-[highlighted]:text-brand-orange group-data-[state=checked]:text-brand-orange" />
                      <span>All Types</span>
                    </span>
                  </SelectItem>
                  {ANNOUNCEMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type} className="group">
                      {renderAnnouncementTypeOption(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Delete Selected Button */}
              {selectedAnnouncements.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedAnnouncements.size})
                </Button>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleExportAnnouncements}
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download filtered announcements as CSV</p>
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
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        ref={(el) => {
                          if (el) {
                            const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
                            if (input) input.indeterminate = isIndeterminate;
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Announcement Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                      <div className="flex items-center gap-1">
                        Created Date
                        {sortOrder === 'desc' ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAnnouncements ? (
                    // Loading skeleton
                    Array.from({ length: announcementRowsPerPage }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell><div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                      </TableRow>
                    ))
                  ) : pagedAnnouncements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No announcements found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedAnnouncements.map(announcement => (
                      <TableRow 
                        key={announcement.id} 
                        className={`hover:bg-gray-50 ${selectedAnnouncements.has(announcement.id) ? 'bg-blue-50' : ''}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedAnnouncements.has(announcement.id)}
                            onCheckedChange={(checked) => handleSelectAnnouncement(announcement.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>{announcement.type}</TableCell>
                        <TableCell>
                          <div className="max-w-xs">{truncateDescription(announcement.description)}</div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={announcement.priority} 
                            onValueChange={(newPriority) => handlePriorityChange(announcement.id, newPriority)}
                          >
                            <SelectTrigger className={cn(
                              "w-auto border-0 bg-transparent font-medium focus:ring-1 focus:ring-brand-orange",
                              announcement.priority === 'high' && 'text-red-600',
                              announcement.priority === 'medium' && 'text-yellow-600',
                              announcement.priority === 'low' && 'text-green-600'
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <span>{announcement.date}</span>
                          <br />
                          <span className="text-xs text-gray-500">{formatTimeNoSeconds(announcement.createdTime)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Preview (Eye) Icon with Tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setPreviewAnnouncement(announcement)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview</TooltipContent>
                            </Tooltip>
                            
                            {/* Edit Icon with Tooltip */}
                            <Dialog open={editDialogOpenId === announcement.id} onOpenChange={open => {
                              if (!open) {
                                setEditDialogOpenId(null);
                                setEditingAnnouncement(null);
                              }
                            }}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline" onClick={() => handleEditAnnouncement(announcement)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                              <DialogContent>
                                <DialogHeader className="border-b border-gray-200 pb-4">
                                  <DialogTitle className="flex items-center gap-2">
                                    <Edit className="h-5 w-5 text-[#FF4F0B]" />
                                    Edit Announcement
                                  </DialogTitle>
                                </DialogHeader>
                                {editingAnnouncement && editingAnnouncement.id === announcement.id && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Type</Label>
                                      <Select value={editingAnnouncement.type} onValueChange={value => setEditingAnnouncement({
                                        ...editingAnnouncement,
                                        type: value
                                      })}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {getTypeOptions(editingAnnouncement.type).map(type => (
                                            <SelectItem key={type} value={type} className="group">
                                              {renderAnnouncementTypeOption(type)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Priority</Label>
                                      <Select value={editingAnnouncement.priority} onValueChange={value => setEditingAnnouncement({
                                        ...editingAnnouncement,
                                        priority: value
                                      })}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Description</Label>
                                      <Textarea value={editingAnnouncement.description} onChange={e => setEditingAnnouncement({
                                        ...editingAnnouncement,
                                        description: e.target.value
                                      })} />
                                    </div>
                                  </div>
                                )}
                                <DialogFooter>
                                  <Button 
                                    onClick={handleSaveEdit}
                                    disabled={isEditingAnnouncement}
                                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isEditingAnnouncement ? (
                                      <div className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                      </div>
                                    ) : (
                                      "Save Changes"
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            {/* Delete Icon with Tooltip */}
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-red-600">
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this announcement? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteAnnouncement(announcement.id)} 
                                    disabled={isDeletingAnnouncement === announcement.id}
                                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {isDeletingAnnouncement === announcement.id ? (
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
                  Showing {filteredAnnouncements.length > 0 ? ((announcementPage - 1) * announcementRowsPerPage + 1) : 0} to {Math.min(announcementPage * announcementRowsPerPage, filteredAnnouncements.length)} of {filteredAnnouncements.length} results
                </div>
                <label className="text-sm text-gray-700 flex items-center gap-1">
                  Rows per page:
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={announcementRowsPerPage}
                    onChange={e => { setAnnouncementRowsPerPage(Number(e.target.value)); setAnnouncementPage(1); }}
                  >
                    {ANNOUNCEMENT_ROWS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAnnouncementPage(p => Math.max(1, p - 1))} disabled={announcementPage === 1}>
                  Previous
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, announcementTotalPages) }, (_, i) => {
                    let pageNum;
                    if (announcementTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (announcementPage <= 3) {
                      pageNum = i + 1;
                    } else if (announcementPage >= announcementTotalPages - 2) {
                      pageNum = announcementTotalPages - 4 + i;
                    } else {
                      pageNum = announcementPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={announcementPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAnnouncementPage(pageNum)}
                        className={announcementPage === pageNum ? "bg-brand-orange hover:bg-brand-orange-400 text-white" : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {announcementTotalPages > 5 && announcementPage < announcementTotalPages - 2 && (
                    <>
                      <span className="px-2 text-gray-500">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAnnouncementPage(announcementTotalPages)}
                      >
                        {announcementTotalPages}
                      </Button>
                    </>
                  )}
                </div>
                
                <Button variant="outline" size="sm" onClick={() => setAnnouncementPage(p => Math.min(announcementTotalPages, p + 1))} disabled={announcementPage === announcementTotalPages || announcementTotalPages === 0}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={!!previewAnnouncement} onOpenChange={open => !open && setPreviewAnnouncement(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Announcement Details</DialogTitle>
            </DialogHeader>
            {previewAnnouncement && (
              <div className="py-4">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Type</TableCell>
                      <TableCell>{previewAnnouncement.type}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Priority</TableCell>
                      <TableCell>{previewAnnouncement.priority}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Created Date</TableCell>
                      <TableCell>
                        {previewAnnouncement.date}
                        <br />
                        <span className="text-xs text-gray-500">{formatTimeNoSeconds(previewAnnouncement.createdTime)}</span>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-gray-700 align-top">Description</TableCell>
                      <TableCell className="whitespace-pre-line break-words">
                        {linkifyText(previewAnnouncement.description || "")}
                      </TableCell>
                    </TableRow>
                    {Array.isArray(previewAnnouncement.media) && previewAnnouncement.media.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-gray-700 align-top">Attachments</TableCell>
                        <TableCell className="space-y-1">
                          {previewAnnouncement.media.map((mediaItem: AnnouncementMedia, index: number) => (
                            <a
                              key={`${mediaItem.fileName || mediaItem.url}-${index}`}
                              href={mediaItem.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-orange underline break-all block"
                            >
                              {mediaItem.fileName || `Attachment ${index + 1}`}
                            </a>
                          ))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New Announcement Dialog */}
        <Dialog
          open={isNewAnnouncementOpen}
          onOpenChange={(open) => {
            setIsNewAnnouncementOpen(open);
            if (!open) {
              resetNewAnnouncementForm();
            }
          }}
        >
          <DialogContent>
            <DialogHeader className="border-b border-gray-200 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#FF4F0B]" />
                Create New Announcement
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-type">Type</Label>
                <Select value={newAnnouncement.type} onValueChange={value => setNewAnnouncement({
                  ...newAnnouncement,
                  type: value
                })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select announcement type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ANNOUNCEMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type} className="group">
                        {renderAnnouncementTypeOption(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="new-priority">Priority</Label>
                <Select value={newAnnouncement.priority} onValueChange={value => setNewAnnouncement({
                  ...newAnnouncement,
                  priority: value
                })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  value={newAnnouncement.description}
                  onChange={e => setNewAnnouncement({
                    ...newAnnouncement,
                    description: e.target.value
                  })}
                  placeholder="Enter announcement description..."
                  rows={4}
                />
                {newAnnouncement.description && (
                  <div className="mt-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-line break-words">
                    {linkifyText(newAnnouncement.description)}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="new-media">Media Attachments</Label>
                <div
                  className={cn(
                    "mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2",
                    isMediaDragActive
                      ? "border-brand-orange bg-orange-50"
                      : "border-gray-300 bg-white hover:border-brand-orange"
                  )}
                  onDragEnter={handleMediaDragEnter}
                  onDragOver={handleMediaDragOver}
                  onDragLeave={handleMediaDragLeave}
                  onDrop={handleMediaDrop}
                  onClick={(event) => {
                    event.preventDefault();
                    openMediaFileDialog();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openMediaFileDialog();
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id="new-media"
                    type="file"
                    multiple
                    onChange={handleAnnouncementMediaChange}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Drag & drop files here or</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={(event) => {
                      event.stopPropagation();
                      openMediaFileDialog();
                    }}
                  >
                    Browse Files
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Upload images, documents, audio, or video files up to 25 MB each.
                </p>
                {mediaUploadError && (
                  <p className="text-xs text-red-600 mt-2">{mediaUploadError}</p>
                )}
                {newAnnouncementMedia.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        Selected file{newAnnouncementMedia.length > 1 ? "s" : ""}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          clearAnnouncementMediaSelection();
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {newAnnouncementMedia.map((file, index) => {
                        const previewUrl = announcementMediaPreviewUrls[index];
                        const isImage = file.type.startsWith("image/");

                        return (
                          <div
                            key={`${file.name}-${file.size}-${index}`}
                            className="relative flex items-center gap-3 border border-gray-200 rounded-lg bg-white p-3"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                              {isImage ? (
                                <img
                                  src={previewUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileIcon className="h-8 w-8 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveAnnouncementMedia(index);
                              }}
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-3 w-3" />
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
              <Button variant="outline" onClick={() => setIsNewAnnouncementOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddAnnouncement}
                disabled={
                  isAddingAnnouncement ||
                  !newAnnouncement.type ||
                  !newAnnouncement.priority ||
                  !newAnnouncement.description.trim()
                }
                className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAddingAnnouncement ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                ) : (
                  "Create Announcement"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>;
}