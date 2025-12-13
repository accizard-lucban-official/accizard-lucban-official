import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Search, Activity, Users, Clock, Trash2, Download, CheckSquare, ArrowUpRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Layout } from "./Layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

// Helper function to format time without seconds
function formatTimeNoSeconds(time: string | number | Date | null | undefined | any) {
  if (!time) return '-';
  let dateObj: Date;
  
  // Handle Firestore Timestamp objects
  if (time?.toDate && typeof time.toDate === 'function') {
    dateObj = time.toDate();
  } else if (time instanceof Date) {
    dateObj = time;
  } else if (typeof time === 'number') {
    dateObj = new Date(time);
  } else if (typeof time === 'string') {
    if (/\d{1,2}:\d{2}:\d{2}/.test(time)) { // e.g. '14:23:45'
      const today = new Date();
      dateObj = new Date(`${today.toDateString()} ${time}`);
    } else {
      dateObj = new Date(time);
    }
  } else {
    // Try to convert if it's a Firestore Timestamp object
    try {
      if (time?.toDate && typeof time.toDate === 'function') {
        dateObj = time.toDate();
      } else {
        dateObj = new Date(time);
      }
    } catch (e) {
      return '-';
    }
  }
  
  if (isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function SystemLogsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [userFilter, setUserFilter] = useState("all");
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [superAdmins, setSuperAdmins] = useState<any[]>([]);
  const [activitySortField, setActivitySortField] = useState<'logId' | 'timestamp'>('timestamp');
  const [activitySortDirection, setActivitySortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [customIdCache, setCustomIdCache] = useState<Map<string, string>>(new Map());
  
  // Pagination state
  const [activityPage, setActivityPage] = useState(1);
  const [activityRowsPerPage, setActivityRowsPerPage] = useState(20);
  const ROWS_OPTIONS = [10, 20, 50, 100];

  // Fetch admin users for filtering
  useEffect(() => {
    async function fetchAdmins() {
      try {
        const querySnapshot = await getDocs(collection(db, "admins"));
        const admins = querySnapshot.docs.map(doc => {
          let userId = doc.data().userId;
          if (typeof userId === 'number') {
            userId = `AID-${userId}`;
          } else if (typeof userId === 'string' && !userId.startsWith('AID-')) {
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
      } catch (error) {
        console.error("Error fetching admins:", error);
      }
    }
    
    fetchAdmins();
  }, []);

  // Fetch super admins for ID number display
  useEffect(() => {
    async function fetchSuperAdmins() {
      try {
        const querySnapshot = await getDocs(collection(db, "superAdmin"));
        const superAdminsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSuperAdmins(superAdminsList);
      } catch (error) {
        console.error("Error fetching super admins:", error);
      }
    }
    
    fetchSuperAdmins();
  }, []);

  // Update search term when URL parameter changes
  useEffect(() => {
    const searchParam = searchParams.get("search");
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  // Function to fetch custom ID for an entity (memoized with useCallback)
  const fetchCustomId = useCallback(async (entityType: string, entityId: string): Promise<string | null> => {
    // Check cache first
    const cacheKey = `${entityType}:${entityId}`;
    if (customIdCache.has(cacheKey)) {
      return customIdCache.get(cacheKey) || null;
    }

    try {
      let customId: string | null = null;
      
      if (entityType === 'report') {
        const reportDoc = await getDoc(doc(db, "reports", entityId));
        if (reportDoc.exists()) {
          const data = reportDoc.data();
          customId = data.reportId || entityId;
        }
      } else if (entityType === 'announcement') {
        const announcementDoc = await getDoc(doc(db, "announcements", entityId));
        if (announcementDoc.exists()) {
          const data = announcementDoc.data();
          // Announcements use the document ID, but check if there's a custom ID field
          customId = data.announcementId || data.id || entityId;
        }
      } else if (entityType === 'admin') {
        const adminDoc = await getDoc(doc(db, "admins", entityId));
        if (adminDoc.exists()) {
          const data = adminDoc.data();
          customId = data.userId || entityId;
        }
      } else if (entityType === 'resident') {
        const residentDoc = await getDoc(doc(db, "users", entityId));
        if (residentDoc.exists()) {
          const data = residentDoc.data();
          customId = data.userId || entityId;
        }
      } else {
        // For other entity types, return the entityId as is
        customId = entityId;
      }

      // Cache the result
      if (customId) {
        setCustomIdCache(prev => new Map(prev).set(cacheKey, customId!));
      }

      return customId || entityId;
    } catch (error) {
      console.error(`Error fetching custom ID for ${entityType}:${entityId}:`, error);
      return entityId; // Fallback to original ID
    }
  }, [customIdCache]);

  // Fetch activity logs (polling every 30 seconds)
  useEffect(() => {
    const fetchActivityLogs = async () => {
      try {
        const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // Convert Firestore Timestamp to Date if needed
          let timestamp = data.timestamp;
          if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
            timestamp = timestamp.toDate();
          } else if (timestamp && !(timestamp instanceof Date) && typeof timestamp !== 'number' && typeof timestamp !== 'string') {
            // Try to convert if it's a Firestore Timestamp object
            try {
              timestamp = timestamp.toDate();
            } catch (e) {
              // If conversion fails, keep original
            }
          }
          return { 
            id: doc.id, 
            ...data,
            timestamp 
          };
        }) as any[];
        setActivityLogs(logs);

        // Pre-fetch custom IDs for logs that have entityType and entityId
        // This ensures all custom IDs are available when rendering
        const logsToFetch = logs.filter((log: any) => log.entityType && log.entityId);
        const fetchPromises = logsToFetch.map((log: any) => 
          fetchCustomId(log.entityType, log.entityId).catch(err => {
            console.warn(`Failed to fetch custom ID for ${log.entityType}:${log.entityId}:`, err);
            return null;
          })
        );
        await Promise.all(fetchPromises);
      } catch (error) {
        console.error("Error fetching activity logs:", error);
      }
    };

    // Initial fetch
    fetchActivityLogs();

    // Poll every 30 seconds
    const interval = setInterval(fetchActivityLogs, 30000);

    return () => clearInterval(interval);
  }, [fetchCustomId]);

  // Additional effect to ensure custom IDs are fetched for filtered logs
  // This runs when filtered logs change to catch any IDs that weren't fetched initially
  useEffect(() => {
    const fetchMissingCustomIds = async () => {
      // Use a Set to track which IDs we've already fetched in this batch
      const fetchedInBatch = new Set<string>();
      
      const logsNeedingIds = filteredActivityLogs.filter((log: any) => {
        if (!log.entityType || !log.entityId) return false;
        const cacheKey = `${log.entityType}:${log.entityId}`;
        // Check both cache and batch set to avoid duplicate fetches
        if (customIdCache.has(cacheKey) || fetchedInBatch.has(cacheKey)) {
          return false;
        }
        fetchedInBatch.add(cacheKey);
        return true;
      });

      if (logsNeedingIds.length > 0) {
        const fetchPromises = logsNeedingIds.map((log: any) =>
          fetchCustomId(log.entityType, log.entityId).catch(err => {
            console.warn(`Failed to fetch custom ID for ${log.entityType}:${log.entityId}:`, err);
            return null;
          })
        );
        await Promise.all(fetchPromises);
      }
    };

    // Only fetch if we have logs and the cache is not empty (to avoid fetching on initial render)
    if (filteredActivityLogs.length > 0) {
      fetchMissingCustomIds();
    }
  }, [filteredActivityLogs, fetchCustomId]);

  // Filter activity logs based on search and filters
  const filteredActivityLogs = activityLogs.filter(log => {
    const search = searchTerm.toLowerCase();
    const admin = adminUsers.find(a => a.name === log.admin || a.name === log.actor);
    const adminName = log.admin || log.actor || "";
    const isSuperAdminUser = log.userRole === 'superadmin';
    const superAdmin = isSuperAdminUser 
      ? superAdmins.find(sa => sa.fullName === adminName || sa.name === adminName)
      : null;
    const adminUserId = admin?.userId || "";
    const superAdminIdNumber = superAdmin?.idNumber || "";
    const displayUserId = isSuperAdminUser && superAdminIdNumber ? superAdminIdNumber : adminUserId;
    
    const matchesSearch = 
      log.action?.toLowerCase().includes(search) ||
      adminName.toLowerCase().includes(search) ||
      displayUserId.toLowerCase().includes(search) ||
      log.actionType?.toLowerCase().includes(search) ||
      (admin?.position || admin?.role || "").toLowerCase().includes(search);
    const matchesUser = userFilter === "all" || log.admin === userFilter || log.actor === userFilter;
    const matchesActionType = actionTypeFilter === "all" || log.actionType === actionTypeFilter;
    
    // Date range filter
    let matchesDateRange = true;
    if (dateRange?.from || dateRange?.to) {
      let logDate: Date | null = null;
      try {
        if (log.timestamp instanceof Date) {
          logDate = log.timestamp;
        } else if (log.timestamp?.toDate && typeof log.timestamp.toDate === 'function') {
          logDate = log.timestamp.toDate();
        } else if (typeof log.timestamp === 'number') {
          logDate = new Date(log.timestamp);
        } else if (typeof log.timestamp === 'string') {
          logDate = new Date(log.timestamp);
        }
        
        if (logDate && !isNaN(logDate.getTime())) {
          logDate.setHours(0, 0, 0, 0);
          
          if (dateRange.from) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            matchesDateRange = logDate >= fromDate;
          }
          
          if (matchesDateRange && dateRange.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            matchesDateRange = logDate <= toDate;
          }
        } else {
          // Invalid date, exclude from results when date filter is active
          matchesDateRange = false;
        }
      } catch (error) {
        // If date parsing fails, exclude from results when date filter is active
        matchesDateRange = false;
      }
    }
    
    return matchesSearch && matchesUser && matchesActionType && matchesDateRange;
  });
  
  // Sort activity logs
  const sortedActivityLogs = [...filteredActivityLogs].sort((a, b) => {
    // Handle Log ID sorting
    if (activitySortField === 'logId') {
      // Sort by Firestore document ID (alphabetically)
      const comparison = a.id.localeCompare(b.id);
      return activitySortDirection === 'asc' ? comparison : -comparison;
    }
    
    // Handle timestamp sorting (Created Date)
    const getTimestamp = (timestamp: any): number => {
      if (timestamp instanceof Date) {
        return timestamp.getTime();
      } else if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().getTime();
      } else if (typeof timestamp === 'number') {
        return timestamp;
      } else if (typeof timestamp === 'string') {
        return Date.parse(timestamp);
      } else {
        return 0;
      }
    };
    
    const aTime = getTimestamp(a.timestamp);
    const bTime = getTimestamp(b.timestamp);
    
    if (activitySortDirection === 'asc') {
      return aTime - bTime;
    } else {
      return bTime - aTime;
    }
  });

  // Pagination
  const pagedActivityLogs = sortedActivityLogs.slice((activityPage - 1) * activityRowsPerPage, activityPage * activityRowsPerPage);
  const activityTotalPages = Math.ceil(filteredActivityLogs.length / activityRowsPerPage);

  // Handler for sorting
  const handleActivitySort = (field: 'logId' | 'timestamp') => {
    if (activitySortField === field) {
      setActivitySortDirection(activitySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setActivitySortField(field);
      setActivitySortDirection('desc'); // Default to descending for new field
    }
  };

  // Handler for selecting/deselecting logs
  const handleSelectLog = (logId: string) => {
    setSelectedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  // Handler for selecting all logs
  const handleSelectAllLogs = () => {
    setSelectedLogs(prev => 
      prev.length === pagedActivityLogs.length 
        ? [] 
        : pagedActivityLogs.map(log => log.id)
    );
  };

  // Handler for deleting a log
  const handleDeleteLog = async (logId: string) => {
    setDeletingLogId(logId);
    try {
      await deleteDoc(doc(db, "activityLogs", logId));
      setActivityLogs(prev => prev.filter(log => log.id !== logId));
      setSelectedLogs(prev => prev.filter(id => id !== logId));
      toast({
        title: 'Success',
        description: 'Activity log deleted successfully'
      });
    } catch (error) {
      console.error("Error deleting log:", error);
      toast({
        title: 'Error',
        description: 'Failed to delete activity log. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setDeletingLogId(null);
    }
  };

  // Handler for bulk deleting logs
  const handleBulkDeleteLogs = async () => {
    if (selectedLogs.length === 0) return;
    
    setBulkDeleting(true);
    const logsToDelete = [...selectedLogs];
    let successCount = 0;
    let failCount = 0;

    try {
      // Delete all selected logs using Promise.allSettled to handle partial failures
      const results = await Promise.allSettled(
        logsToDelete.map(logId => deleteDoc(doc(db, "activityLogs", logId)))
      );

      // Count successes and failures, track which logs were successfully deleted
      const successfullyDeleted: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          successfullyDeleted.push(logsToDelete[index]);
        } else {
          failCount++;
          console.error(`Error deleting log ${logsToDelete[index]}:`, result.reason);
        }
      });

      // Update state - remove only successfully deleted logs
      setActivityLogs(prev => prev.filter(log => !successfullyDeleted.includes(log.id)));
      setSelectedLogs(prev => prev.filter(id => !successfullyDeleted.includes(id)));
      setShowBulkDeleteDialog(false);

      // Show toast
      if (failCount === 0) {
        toast({
          title: 'Success',
          description: `Successfully deleted ${successCount} log(s).`
        });
      } else {
        toast({
          title: 'Partial Success',
          description: `Deleted ${successCount} log(s). Failed to delete ${failCount} log(s).`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error("Error bulk deleting logs:", error);
      toast({
        title: 'Error',
        description: 'Failed to delete logs. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Handler for navigating to admin account
  const handleNavigateToAdmin = (adminId: string, adminName: string) => {
    if (isSuperAdmin()) {
      navigate('/manage-users', { 
        state: { 
          tab: 'admins',
          search: adminName,
          highlightAdminId: adminId
        } 
      });
    }
  };

  // Handler for exporting logs to CSV
  const handleExportLogs = () => {
    if (filteredActivityLogs.length === 0) {
      toast({
        title: 'No logs to export',
        description: 'There are no logs matching your current filters.',
        variant: 'destructive'
      });
      return;
    }

    // CSV header
    const headers = ['Log ID', 'User ID', 'User Name', 'Role', 'Created Date', 'Created Time', 'Action Type', 'Log Message'];
    
    // CSV rows
    const rows = filteredActivityLogs.map(log => {
      const admin = adminUsers.find(a => a.name === log.admin || a.name === log.actor);
      const adminName = log.admin || log.actor || "-";
      const isSuperAdminUser = log.userRole === 'superadmin';
      const superAdmin = isSuperAdminUser 
        ? superAdmins.find(sa => sa.fullName === adminName || sa.name === adminName)
        : null;
      const displayUserId = isSuperAdminUser && superAdmin?.idNumber 
        ? superAdmin.idNumber 
        : (admin?.userId || "-");
      const role = isSuperAdminUser ? "Super Admin" : (admin ? admin.position || admin.role || "-" : "-");
      
      // Convert timestamp to Date for CSV export
      let logDateObj: Date | null = null;
      if (log.timestamp instanceof Date) {
        logDateObj = log.timestamp;
      } else if (log.timestamp?.toDate && typeof log.timestamp.toDate === 'function') {
        logDateObj = log.timestamp.toDate();
      } else if (typeof log.timestamp === 'number') {
        logDateObj = new Date(log.timestamp);
      } else if (typeof log.timestamp === 'string') {
        logDateObj = new Date(log.timestamp);
      }
      
      const logDate = logDateObj ? logDateObj.toLocaleDateString() : "-";
      const logTime = logDateObj ? formatTimeNoSeconds(logDateObj) : "-";
      
      return [
        log.id || "",
        displayUserId,
        adminName,
        role,
        logDate,
        logTime,
        log.actionType || "-",
        log.action || "-"
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with date range if applicable
    let filename = 'accizard-activity-logs';
    if (dateRange?.from && dateRange?.to) {
      const fromStr = dateRange.from.toISOString().split('T')[0];
      const toStr = dateRange.to.toISOString().split('T')[0];
      filename += `-${fromStr}-to-${toStr}`;
    } else {
      filename += `-${new Date().toISOString().split('T')[0]}`;
    }
    filename += '.csv';
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: `Exported ${filteredActivityLogs.length} log(s) to CSV.`
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Activity className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Total Logs</p>
                    <p className="text-xs text-brand-orange font-medium">All time</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">{activityLogs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Today's Logs</p>
                    <p className="text-xs text-brand-orange font-medium">Last 24 hours</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">
                    {activityLogs.filter(log => {
                      let logDate: Date;
                      if (log.timestamp instanceof Date) {
                        logDate = log.timestamp;
                      } else if (log.timestamp?.toDate && typeof log.timestamp.toDate === 'function') {
                        logDate = log.timestamp.toDate();
                      } else if (typeof log.timestamp === 'number') {
                        logDate = new Date(log.timestamp);
                      } else if (typeof log.timestamp === 'string') {
                        logDate = new Date(log.timestamp);
                      } else {
                        return false;
                      }
                      const today = new Date();
                      return logDate.toDateString() === today.toDateString();
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Active Admins</p>
                    <p className="text-xs text-brand-orange font-medium">System users</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">{adminUsers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Activity Logs Table */}
        <Card>
          {/* Table Toolbar */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Bar */}
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9"
                />
              </div>

              {/* Date Range Picker */}
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
              />

              {/* User Filter */}
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {adminUsers.map(admin => (
                    <SelectItem key={admin.id} value={admin.name}>
                      {admin.name}
                    </SelectItem>
                  ))}
                  {superAdmins.map(superAdmin => {
                    const name = superAdmin.fullName || superAdmin.name;
                    return (
                      <SelectItem key={superAdmin.id} value={name}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Action Type Filter */}
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="permission">Permission</SelectItem>
                  <SelectItem value="verification">Verification</SelectItem>
                </SelectContent>
              </Select>

              {/* Export Button */}
              <Button
                onClick={handleExportLogs}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                disabled={filteredActivityLogs.length === 0}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {isSuperAdmin() && selectedLogs.length > 0 && (
            <div className="border-t border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-brand-orange/10 flex items-center justify-center">
                      <CheckSquare className="h-4 w-4 text-brand-orange" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        {selectedLogs.length} log{selectedLogs.length !== 1 ? 's' : ''} selected
                      </span>
                      <p className="text-xs text-gray-500">Batch actions available</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLogs([])}
                    className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  >
                    Clear selection
                  </Button>
                </div>
                <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={bulkDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Selected ({selectedLogs.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                          <Trash2 className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <AlertDialogTitle className="text-red-800">Delete Selected Logs</AlertDialogTitle>
                          <AlertDialogDescription className="text-red-600">
                            Are you sure you want to delete {selectedLogs.length} log{selectedLogs.length !== 1 ? 's' : ''}? This action cannot be undone.
                          </AlertDialogDescription>
                        </div>
                      </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDeleteLogs}
                        disabled={bulkDeleting}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                      >
                        {bulkDeleting ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </div>
                        ) : (
                          `Delete ${selectedLogs.length} Log${selectedLogs.length !== 1 ? 's' : ''}`
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-visible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-left">
                      {isSuperAdmin() && (
                        <Checkbox
                          checked={selectedLogs.length === pagedActivityLogs.length && pagedActivityLogs.length > 0}
                          onCheckedChange={handleSelectAllLogs}
                        />
                      )}
                    </TableHead>
                    <TableHead className="text-left">
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                        onClick={() => handleActivitySort('logId')}
                      >
                        Log ID
                        {activitySortField === 'logId' && activitySortDirection === 'asc' ? (
                          <ArrowUp className="h-4 w-4 text-brand-orange" />
                        ) : activitySortField === 'logId' && activitySortDirection === 'desc' ? (
                          <ArrowDown className="h-4 w-4 text-brand-orange" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-left">User</TableHead>
                    <TableHead className="text-left">Role</TableHead>
                    <TableHead className="text-left">
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                        onClick={() => handleActivitySort('timestamp')}
                      >
                        Created Date
                        {activitySortField === 'timestamp' && activitySortDirection === 'asc' ? (
                          <ArrowUp className="h-4 w-4 text-brand-orange" />
                        ) : activitySortField === 'timestamp' && activitySortDirection === 'desc' ? (
                          <ArrowDown className="h-4 w-4 text-brand-orange" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[200px] max-w-[200px] text-left">Log Message</TableHead>
                    {isSuperAdmin() && <TableHead className="text-left">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedActivityLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin() ? 7 : 6} className="text-center text-gray-500 py-8">
                        No activity logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedActivityLogs.map((log, index) => {
                      // Try to find the admin user by name
                      const admin = adminUsers.find(a => a.name === log.admin || a.name === log.actor);
                      const adminName = log.admin || log.actor || "-";
                      const adminId = admin?.id || "";
                      // Check if user is super admin (from log.userRole field)
                      const isSuperAdminUser = log.userRole === 'superadmin';
                      // Find super admin by name if it's a super admin
                      const superAdmin = isSuperAdminUser 
                        ? superAdmins.find(sa => sa.fullName === adminName || sa.name === adminName)
                        : null;
                      // Use idNumber for super admins, otherwise use admin userId
                      const displayUserId = isSuperAdminUser && superAdmin?.idNumber 
                        ? superAdmin.idNumber 
                        : (admin?.userId || "-");
                      const role = isSuperAdminUser ? "Super Admin" : (admin ? admin.position || admin.role || "-" : "-");
                      const logIdNumber = (activityPage - 1) * activityRowsPerPage + index + 1;
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            {isSuperAdmin() && (
                              <Checkbox
                                checked={selectedLogs.includes(log.id)}
                                onCheckedChange={() => handleSelectLog(log.id)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            LID - {logIdNumber}
                          </TableCell>
                          <TableCell className="font-medium">
                            {isSuperAdmin() && (adminId || (isSuperAdminUser && superAdmin?.id)) ? (
                              <button
                                onClick={() => handleNavigateToAdmin(
                                  isSuperAdminUser && superAdmin?.id ? superAdmin.id : adminId, 
                                  adminName
                                )}
                                className="text-gray-600 hover:text-gray-700 hover:underline transition-colors flex items-center gap-1.5 group"
                              >
                                <span>{displayUserId} - {adminName}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                              </button>
                            ) : (
                              <span className="text-gray-600">{displayUserId} - {adminName}</span>
                            )}
                          </TableCell>
                          <TableCell>{role}</TableCell>
                          <TableCell>
                            {log.timestamp ? (() => {
                              // Convert timestamp to Date if needed
                              let dateObj: Date;
                              if (log.timestamp instanceof Date) {
                                dateObj = log.timestamp;
                              } else if (log.timestamp?.toDate && typeof log.timestamp.toDate === 'function') {
                                dateObj = log.timestamp.toDate();
                              } else if (typeof log.timestamp === 'number') {
                                dateObj = new Date(log.timestamp);
                              } else if (typeof log.timestamp === 'string') {
                                dateObj = new Date(log.timestamp);
                              } else {
                                try {
                                  dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                } catch (e) {
                                  return "-";
                                }
                              }
                              
                              if (isNaN(dateObj.getTime())) return "-";
                              
                              return (
                                <>
                                  <span>{dateObj.toLocaleDateString()}</span>
                                  <br />
                                  <span className="text-xs text-gray-500">{formatTimeNoSeconds(dateObj)}</span>
                                </>
                              );
                            })() : "-"}
                          </TableCell>
                          <TableCell className="w-[200px] max-w-[200px] break-words whitespace-normal text-sm" title={log.action}>
                            {(() => {
                              // Format log message to replace Firestore IDs with custom IDs
                              let formattedMessage = log.action || '-';
                              
                              // If log has entityType and entityId, replace the ID in the message
                              if (log.entityType && log.entityId) {
                                const cacheKey = `${log.entityType}:${log.entityId}`;
                                const customId = customIdCache.get(cacheKey);
                                
                                if (customId && customId !== log.entityId) {
                                  // Replace Firestore ID with custom ID in the message
                                  // Escape special regex characters in the Firestore ID
                                  const escapedId = log.entityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                  
                                  // Pattern 1: Look for (entityId) - most common format from formatLogMessage
                                  const parenthesesPattern = new RegExp(`\\(${escapedId}\\)`, 'g');
                                  formattedMessage = formattedMessage.replace(parenthesesPattern, `(${customId})`);
                                  
                                  // Pattern 2: Look for entityId at word boundaries (for cases without parentheses)
                                  // This catches IDs that appear standalone in the message
                                  const wordBoundaryPattern = new RegExp(`\\b${escapedId}\\b`, 'g');
                                  formattedMessage = formattedMessage.replace(wordBoundaryPattern, customId);
                                  
                                  // Pattern 3: Look for entityId in quotes "entityId" or 'entityId'
                                  const quotedPattern = new RegExp(`["']${escapedId}["']`, 'g');
                                  formattedMessage = formattedMessage.replace(quotedPattern, `"${customId}"`);
                                  
                                  // Pattern 4: Look for entityId after common prefixes like "ID:", "id:", etc.
                                  const idPrefixPattern = new RegExp(`(ID|id|Id):\\s*${escapedId}\\b`, 'gi');
                                  formattedMessage = formattedMessage.replace(idPrefixPattern, (match, prefix) => {
                                    return `${prefix}: ${customId}`;
                                  });
                                  
                                  // Pattern 5: Look for entityId after "with ID", "with id", etc.
                                  const withIdPattern = new RegExp(`(with\\s+(?:ID|id|Id)\\s+)?${escapedId}\\b`, 'gi');
                                  formattedMessage = formattedMessage.replace(withIdPattern, (match, prefix) => {
                                    return prefix ? `${prefix}${customId}` : customId;
                                  });
                                  
                                  // Pattern 6: Look for entityId in any context - final catch-all
                                  // This ensures we catch any remaining instances
                                  const finalPattern = new RegExp(escapedId, 'g');
                                  if (formattedMessage.includes(log.entityId)) {
                                    formattedMessage = formattedMessage.replace(finalPattern, customId);
                                  }
                                }
                              }
                              
                              return formattedMessage;
                            })()}
                          </TableCell>
                          {isSuperAdmin() && (
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-red-600 hover:text-red-700"
                                    disabled={deletingLogId === log.id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                                        <Trash2 className="h-5 w-5 text-red-600" />
                                      </div>
                                      <div>
                                        <AlertDialogTitle className="text-red-800">Delete Activity Log</AlertDialogTitle>
                                        <AlertDialogDescription className="text-red-600">
                                          Are you sure you want to delete this activity log? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </div>
                                    </div>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteLog(log.id)}
                                      disabled={deletingLogId === log.id}
                                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {deletingLogId === log.id ? (
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
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="border-t border-gray-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700">
                  Showing {filteredActivityLogs.length > 0 ? ((activityPage - 1) * activityRowsPerPage + 1) : 0} to {Math.min(activityPage * activityRowsPerPage, filteredActivityLogs.length)} of {filteredActivityLogs.length} results
                </div>
                <label className="text-sm text-gray-700 flex items-center gap-1">
                  Rows per page:
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={activityRowsPerPage}
                    onChange={e => { setActivityRowsPerPage(Number(e.target.value)); setActivityPage(1); }}
                  >
                    {ROWS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setActivityPage(p => Math.max(1, p - 1))} disabled={activityPage === 1}>
                  Previous
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, activityTotalPages) }, (_, i) => {
                    let pageNum;
                    if (activityTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (activityPage <= 3) {
                      pageNum = i + 1;
                    } else if (activityPage >= activityTotalPages - 2) {
                      pageNum = activityTotalPages - 4 + i;
                    } else {
                      pageNum = activityPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={activityPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActivityPage(pageNum)}
                        className={activityPage === pageNum ? "bg-brand-orange hover:bg-brand-orange-400 text-white" : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {activityTotalPages > 5 && activityPage < activityTotalPages - 2 && (
                    <>
                      <span className="px-2 text-gray-500">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivityPage(activityTotalPages)}
                      >
                        {activityTotalPages}
                      </Button>
                    </>
                  )}
                </div>
                
                <Button variant="outline" size="sm" onClick={() => setActivityPage(p => Math.min(activityTotalPages, p + 1))} disabled={activityPage === activityTotalPages || activityTotalPages === 0}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
