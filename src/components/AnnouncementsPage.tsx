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

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Calendar, AlertTriangle, Info, X, Eye, ChevronUp, ChevronDown, Check, CalendarIcon } from "lucide-react";
import { Layout } from "./Layout";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addYears } from "date-fns";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
  
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
  const [announcementTypes, setAnnouncementTypes] = useState<string[]>([]);
  const [newTypeInput, setNewTypeInput] = useState("");
  const [previewAnnouncement, setPreviewAnnouncement] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>("desc");
  const [editDialogOpenId, setEditDialogOpenId] = useState<string | null>(null);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<Set<string>>(new Set());
  
  // Loading states
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [isDeletingAnnouncement, setIsDeletingAnnouncement] = useState<string | null>(null);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);

  const today = new Date();
  // For dual calendar date range picker
  const [fromMonth, setFromMonth] = useState((dateRange?.from || today).getMonth());
  const [fromYear, setFromYear] = useState((dateRange?.from || today).getFullYear());
  const [toMonth, setToMonth] = useState((dateRange?.to || today).getMonth());
  const [toYear, setToYear] = useState((dateRange?.to || today).getFullYear());
  // For month/year dropdowns in date range picker
  const currentMonth = (dateRange?.from || today).getMonth();
  const currentYear = (dateRange?.from || today).getFullYear();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = Array.from({ length: 21 }, (_, i) => today.getFullYear() - 10 + i);

  // Fetch announcement types from Firestore on mount
  useEffect(() => {
    async function fetchTypes() {
      try {
        const querySnapshot = await getDocs(collection(db, "announcementTypes"));
        const types = querySnapshot.docs
          .map(doc => doc.data().name)
          .filter(name => name); // Filter out undefined/null values
        
        setAnnouncementTypes(types);
      } catch (error) {
        console.error("Error fetching announcement types:", error);
        toast({
          title: "Error Loading Types",
          description: "Failed to load announcement types from database.",
          variant: "destructive",
        });
      }
    }
    fetchTypes();
  }, []);

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
    try {
      const newAnnouncementWithDate = {
        ...newAnnouncement,
        date: new Date().toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }),
        createdTime: Date.now(),
        createdBy: 'admin' // Replace with actual user if available
      };
      const docRef = await addDoc(collection(db, "announcements"), newAnnouncementWithDate);
      setAnnouncements(prev => [...prev, { ...newAnnouncementWithDate, id: docRef.id }]);
      setNewAnnouncement({
        type: "",
        description: "",
        priority: ""
      });
      setIsNewAnnouncementOpen(false);
      toast({
        title: "Announcement Created",
        description: "The new announcement has been added successfully.",
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal w-auto",
                      !dateRange && "text-gray-800"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM dd, y")
                      )
                    ) : (
                      <span>Date Range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {announcementTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
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
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedAnnouncements.size})
                </Button>
              )}
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
                                          {announcementTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
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
                                      <Trash2 className="h-4 w-4" />
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
                      <TableCell className="whitespace-pre-line break-words">{previewAnnouncement.description}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New Announcement Dialog */}
        <Dialog open={isNewAnnouncementOpen} onOpenChange={setIsNewAnnouncementOpen}>
          <DialogContent>
            <DialogHeader className="border-b border-gray-200 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-[#FF4F0B]" />
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
                    {announcementTypes.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-gray-500">No types available. Add one below.</div>
                    ) : (
                      announcementTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))
                    )}
                    <div className="flex gap-2 p-2 border-t border-gray-100 mt-2">
                      <Input
                        value={newTypeInput}
                        onChange={e => setNewTypeInput(e.target.value)}
                        placeholder="Add new type"
                        className="flex-1"
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && newTypeInput.trim()) {
                            if (!announcementTypes.includes(newTypeInput.trim())) {
                              try {
                                const docRef = await addDoc(collection(db, "announcementTypes"), { name: newTypeInput.trim() });
                                setAnnouncementTypes([...announcementTypes, newTypeInput.trim()]);
                                setNewAnnouncement({ ...newAnnouncement, type: newTypeInput.trim() });
                              } catch (error) {
                                console.error("Error adding type:", error);
                              }
                            }
                            setNewTypeInput("");
                          }
                        }}
                      />
                      <Button type="button" onClick={async () => {
                        if (newTypeInput.trim() && !announcementTypes.includes(newTypeInput.trim())) {
                          try {
                            const docRef = await addDoc(collection(db, "announcementTypes"), { name: newTypeInput.trim() });
                            setAnnouncementTypes([...announcementTypes, newTypeInput.trim()]);
                            setNewAnnouncement({ ...newAnnouncement, type: newTypeInput.trim() });
                          } catch (error) {
                            console.error("Error adding type:", error);
                          }
                        }
                        setNewTypeInput("");
                      }} disabled={!newTypeInput.trim()} className="bg-brand-orange hover:bg-brand-orange-400 text-white">
                        Add
                      </Button>
                    </div>
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
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewAnnouncementOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddAnnouncement}
                disabled={!newAnnouncement.type || !newAnnouncement.priority || !newAnnouncement.description.trim()}
                className="bg-brand-orange hover:bg-brand-orange-400 text-white"
              >
                Create Announcement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>;
}