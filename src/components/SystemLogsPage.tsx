import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Search, Activity, Users, Clock, Trash2, Download } from "lucide-react";
import { Layout } from "./Layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

// Helper function to format time without seconds
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

export function SystemLogsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [userFilter, setUserFilter] = useState("all");
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [activityLogs, setActivityLogs] = useState([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [activitySortDirection, setActivitySortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
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

  // Update search term when URL parameter changes
  useEffect(() => {
    const searchParam = searchParams.get("search");
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  // Real-time listener for activity logs
  useEffect(() => {
    const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivityLogs(logs);
    });
    return () => unsubscribe();
  }, []);

  // Filter activity logs based on search and filters
  const filteredActivityLogs = activityLogs.filter(log => {
    const search = searchTerm.toLowerCase();
    const admin = adminUsers.find(a => a.name === log.admin || a.name === log.actor);
    const adminName = log.admin || log.actor || "";
    const adminUserId = admin?.userId || "";
    
    const matchesSearch = 
      log.action?.toLowerCase().includes(search) ||
      adminName.toLowerCase().includes(search) ||
      adminUserId.toLowerCase().includes(search) ||
      log.actionType?.toLowerCase().includes(search) ||
      (admin?.position || admin?.role || "").toLowerCase().includes(search);
    const matchesUser = userFilter === "all" || log.admin === userFilter || log.actor === userFilter;
    const matchesActionType = actionTypeFilter === "all" || log.actionType === actionTypeFilter;
    
    // Date range filter
    let matchesDateRange = true;
    if (dateRange?.from || dateRange?.to) {
      const logDate = typeof log.timestamp === 'number' ? new Date(log.timestamp) : new Date(log.timestamp);
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
    }
    
    return matchesSearch && matchesUser && matchesActionType && matchesDateRange;
  });
  
  // Sort activity logs
  const sortedActivityLogs = [...filteredActivityLogs].sort((a, b) => {
    const aTime = typeof a.timestamp === 'number' ? a.timestamp : Date.parse(a.timestamp);
    const bTime = typeof b.timestamp === 'number' ? b.timestamp : Date.parse(b.timestamp);
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
  const handleActivitySort = () => {
    setActivitySortDirection(activitySortDirection === 'asc' ? 'desc' : 'asc');
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
      const adminUserId = admin?.userId || "-";
      const role = admin ? admin.position || admin.role || "-" : "-";
      const logDate = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-";
      const logTime = log.timestamp ? formatTimeNoSeconds(log.timestamp) : "-";
      
      return [
        log.id || "",
        adminUserId,
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
                      const logDate = typeof log.timestamp === 'number' ? new Date(log.timestamp) : new Date(log.timestamp);
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
                date={dateRange}
                onDateChange={setDateRange}
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
                variant="outline"
                className="flex items-center gap-2"
                disabled={filteredActivityLogs.length === 0}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {isSuperAdmin() && selectedLogs.length > 0 && (
            <div className="border-b border-gray-200 px-6 py-3 bg-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 font-medium">
                    {selectedLogs.length} log{selectedLogs.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLogs([])}
                    className="text-xs"
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      {isSuperAdmin() && (
                        <Checkbox
                          checked={selectedLogs.length === pagedActivityLogs.length && pagedActivityLogs.length > 0}
                          onCheckedChange={handleSelectAllLogs}
                        />
                      )}
                    </TableHead>
                    <TableHead>Log ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="cursor-pointer hover:bg-gray-50" onClick={handleActivitySort}>
                      <div className="flex items-center gap-1">
                        Created Date
                        {activitySortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </TableHead>
                    <TableHead>Log Message</TableHead>
                    {isSuperAdmin() && <TableHead>Actions</TableHead>}
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
                      const adminUserId = admin?.userId || "-";
                      // Check if user is super admin (from log.userRole field)
                      const isSuperAdminUser = log.userRole === 'superadmin';
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
                            {isSuperAdmin() && adminId ? (
                              <button
                                onClick={() => handleNavigateToAdmin(adminId, adminName)}
                                className="text-brand-orange hover:text-brand-orange-400 hover:underline transition-colors"
                              >
                                {adminUserId} - {adminName}
                              </button>
                            ) : (
                              <span>{adminUserId} - {adminName}</span>
                            )}
                          </TableCell>
                          <TableCell>{role}</TableCell>
                          <TableCell>
                            {log.timestamp ? (
                              <>
                                <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                                <br />
                                <span className="text-xs text-gray-500">{formatTimeNoSeconds(log.timestamp)}</span>
                              </>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={log.action}>{log.action || '-'}</TableCell>
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
