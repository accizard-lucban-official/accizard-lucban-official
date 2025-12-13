import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, ClipboardList, BarChart3, MessageSquare, Bell, Users, User, LucideIcon, Menu, Activity, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { SessionManager } from "@/lib/sessionManager";
import { toast } from "@/components/ui/sonner";
import { logActivity, ActionType } from "@/lib/activityLogger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LayoutProps {
  children: React.ReactNode;
}

interface PageConfig {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
}

// Map of routes to their corresponding page titles and icons
const pageConfig: Record<string, PageConfig> = {
  "/": {
    title: "Dashboard",
    icon: Home,
    subtitle: "Overview of your system"
  },
  "/manage-reports": {
    title: "Manage Reports",
    icon: ClipboardList,
    subtitle: "View and manage accident reports"
  },
  "/risk-map": {
    title: "Risk and Utility Map",
    icon: BarChart3,
    subtitle: "Analyze risk areas and utilities"
  },
  "/chat-support": {
    title: "Chat Support",
    icon: MessageSquare,
    subtitle: "Communicate with users"
  },
  "/admin-chat": {
    title: "Chat Support",
    icon: MessageSquare,
    subtitle: "Coordinate with the admin team"
  },
  "/announcements": {
    title: "Announcements",
    icon: Bell,
    subtitle: "Manage system announcements"
  },
  "/manage-users": {
    title: "Manage Users",
    icon: Users,
    subtitle: "View and manage system users"
  },
  "/profile": {
    title: "My Profile",
    icon: User,
    subtitle: "Manage your account settings"
  },
  "/system-logs": {
    title: "System Logs",
    icon: Activity,
    subtitle: "View system activity and logs"
  },
  "/dashboard": {
    title: "Dashboard",
    icon: Home,
    subtitle: "Overview of your system"
  }
};

export function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unseenReportsCount, setUnseenReportsCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [residentChatBadge, setResidentChatBadge] = useState(0);
  const [adminChatUnreadCount, setAdminChatUnreadCount] = useState(0);
  const [user, setUser] = useState({
    name: "",
    role: "",
    avatarUrl: ""
  });
  // Alarm system state
  const [showNewReportAlert, setShowNewReportAlert] = useState(false);
  const [newReportData, setNewReportData] = useState<any[]>([]);
  const previousReportCountRef = useRef<number>(0);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeAudioRefs = useRef<HTMLAudioElement[]>([]);
  const activeAudioContextRefs = useRef<AudioContext[]>([]);
  const isInitialLoadRef = useRef<boolean>(true);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isBroadcastingRef = useRef<boolean>(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = pageConfig[location.pathname] || {
    title: "404",
    subtitle: "Page not found"
  };
  const { userRole, loading: roleLoading } = useUserRole();
  const unreadSessionIdsRef = useRef<Set<string>>(new Set());
  const unopenedSessionIdsRef = useRef<Set<string>>(new Set());

  const toMillis = (value: any): number | null => {
    if (!value) return null;
    if (typeof value.toDate === "function") {
      try {
        return value.toDate().getTime();
      } catch {
        return null;
      }
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const updateResidentChatBadge = () => {
    // Count unique sessions with unread messages (not total unread messages)
    // Each session ID in unreadSessionIdsRef represents a session with at least one unread message
    const sessionsWithUnread = new Set<string>([
      ...unreadSessionIdsRef.current
    ]);
    setResidentChatBadge(sessionsWithUnread.size);
  };

  // Alarm sound functions
  const playWebAudioAlarm = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      activeAudioContextRefs.current.push(audioContext);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.4);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.6);
      
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1.0);
      
      oscillator.addEventListener('ended', () => {
        activeAudioContextRefs.current = activeAudioContextRefs.current.filter(ctx => ctx !== audioContext);
      });
    } catch (error) {
      console.log("Web Audio API also failed:", error);
      try {
        const fallbackAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        fallbackAudio.volume = 0.3;
        activeAudioRefs.current.push(fallbackAudio);
        fallbackAudio.play().catch(() => console.log("Final fallback audio also failed"));
        fallbackAudio.addEventListener('ended', () => {
          activeAudioRefs.current = activeAudioRefs.current.filter(a => a !== fallbackAudio);
        });
      } catch (finalError) {
        console.log("All audio playback methods failed:", finalError);
      }
    }
  }, []);

  const playSingleAlarm = useCallback(() => {
    try {
      activeAudioRefs.current.forEach(audio => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
      });
      activeAudioRefs.current = [];
      
      activeAudioContextRefs.current.forEach(ctx => {
        try {
          ctx.close().catch(() => {});
        } catch (e) {}
      });
      activeAudioContextRefs.current = [];
      
      const audio = new Audio('/accizard-uploads/accizard_alarm.wav');
      audio.volume = 0.8;
      activeAudioRefs.current.push(audio);
      
      audio.addEventListener('ended', () => {
        activeAudioRefs.current = activeAudioRefs.current.filter(a => a !== audio);
      });
      
      const fallbackTimeout = setTimeout(() => {
        console.log("MP3 loading too slow, falling back to Web Audio API");
        playWebAudioAlarm();
      }, 1500);
      
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(fallbackTimeout);
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
      
      audio.load();
    } catch (error) {
      console.log("Error initializing MP3 alarm, using fallback:", error);
      playWebAudioAlarm();
    }
  }, [playWebAudioAlarm]);

  const playAlarmSound = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    
    playSingleAlarm();
    
    const interval = setInterval(() => {
      playSingleAlarm();
    }, 3000);
    
    alarmIntervalRef.current = interval;
  }, [playSingleAlarm]);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    
    activeAudioRefs.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    });
    activeAudioRefs.current = [];
    
    activeAudioContextRefs.current.forEach(ctx => {
      try {
        ctx.close().catch(() => {});
      } catch (e) {}
    });
    activeAudioContextRefs.current = [];
    
    console.log("Alarm stopped");
  }, []);

  // Fetch user data
  useEffect(() => {
    if (userRole && !roleLoading) {
      setUser({
        name: userRole.name || "",
        role: userRole.position || "",
        avatarUrl: userRole.profilePicture || "/accizard-uploads/login-signup-cover.png"
      });
    }
  }, [userRole, roleLoading]);


  // Function to calculate unseen reports count
  const calculateUnseenReportsCount = (snapshot: any) => {
    // Get viewed reports from localStorage
    const viewedReportsData = localStorage.getItem("viewedReports");
    const viewedReports = viewedReportsData ? new Set(JSON.parse(viewedReportsData)) : new Set();
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const unseenCount = snapshot.docs.filter((doc: any) => {
      const data = doc.data();
      const reportId = data.reportId || doc.id;
      
      // Check if report has been viewed
      if (viewedReports.has(reportId)) {
        return false;
      }
      
      // Check if report is within last 24 hours
      try {
        const timestamp = data.timestamp;
        let reportDate;
        
        if (timestamp && typeof timestamp.toDate === "function") {
          reportDate = timestamp.toDate();
        } else if (timestamp instanceof Date) {
          reportDate = timestamp;
        } else if (typeof timestamp === "number") {
          reportDate = new Date(timestamp);
        } else if (typeof timestamp === "string") {
          reportDate = new Date(timestamp);
        }
        
        if (reportDate && !isNaN(reportDate.getTime())) {
          return reportDate >= oneDayAgo && reportDate <= now;
        }
      } catch (error) {
        console.error("Error parsing timestamp:", error);
      }
      
      return false;
    }).length;
    
    setUnseenReportsCount(unseenCount);
  };

  // Store snapshot ref to recalculate when localStorage changes
  const reportsSnapshotRef = useRef<any>(null);

  // Fetch and count unseen reports + detect new reports for alarm
  useEffect(() => {
    try {
      const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
        // Store snapshot for recalculation when localStorage changes
        reportsSnapshotRef.current = snapshot;
        calculateUnseenReportsCount(snapshot);
        
        // Process reports for alarm system
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data();
          const reportType = data.reportType || data.type || data.category || 'Others';
          
          let dateSubmitted = "";
          let timeSubmitted = "";
          if (data.timestamp) {
            try {
              const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
              const mm = String(timestamp.getMonth() + 1).padStart(2, '0');
              const dd = String(timestamp.getDate()).padStart(2, '0');
              const yy = String(timestamp.getFullYear()).slice(-2);
              dateSubmitted = `${mm}/${dd}/${yy}`;
              
              let hours = timestamp.getHours();
              const minutes = String(timestamp.getMinutes()).padStart(2, '0');
              const ampm = hours >= 12 ? 'PM' : 'AM';
              hours = hours % 12;
              hours = hours ? hours : 12;
              timeSubmitted = `${hours}:${minutes} ${ampm}`;
            } catch (error) {
              console.log("Error parsing timestamp:", error);
            }
          }
          
          return {
            id: data.reportId || doc.id,
            firestoreId: doc.id,
            type: reportType,
            dateSubmitted,
            timeSubmitted,
            ...data
          };
        });
        
        const previousCount = previousReportCountRef.current;
        const isInitialLoad = isInitialLoadRef.current;
        const viewedReportsData = localStorage.getItem("viewedReports");
        const currentViewedReports = viewedReportsData ? new Set(JSON.parse(viewedReportsData)) : new Set();
        const unviewedReports = fetched.filter(report => !currentViewedReports.has(report.id));
        
        if (isInitialLoad) {
          isInitialLoadRef.current = false;
          if (unviewedReports.length > 0) {
            console.log('Active tab: Showing alarm modal with', unviewedReports.length, 'unviewed reports');
            setNewReportData(unviewedReports);
            setShowNewReportAlert(true);
            playAlarmSound();
            
            if (broadcastChannelRef.current) {
              console.log('Broadcasting NEW_REPORTS to other tabs:', unviewedReports.length, 'reports');
              isBroadcastingRef.current = true;
              broadcastChannelRef.current.postMessage({
                type: 'NEW_REPORTS',
                reports: unviewedReports
              });
              setTimeout(() => {
                isBroadcastingRef.current = false;
              }, 100);
            }
          }
        } else if (fetched.length > previousCount) {
          const newReportCount = fetched.length - previousCount;
          if (newReportCount > 0 && unviewedReports.length > 0) {
            console.log('Active tab: Showing alarm modal with', unviewedReports.length, 'new unviewed reports');
            setNewReportData(unviewedReports);
            setShowNewReportAlert(true);
            playAlarmSound();
            
            if (broadcastChannelRef.current) {
              console.log('Broadcasting NEW_REPORTS to other tabs:', unviewedReports.length, 'reports');
              isBroadcastingRef.current = true;
              broadcastChannelRef.current.postMessage({
                type: 'NEW_REPORTS',
                reports: unviewedReports
              });
              setTimeout(() => {
                isBroadcastingRef.current = false;
              }, 100);
            }
          }
        } else if (unviewedReports.length > 0 && newReportData.length === 0) {
          setNewReportData(unviewedReports);
        }
        
        previousReportCountRef.current = fetched.length;
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching unseen reports:", error);
    }
  }, [playAlarmSound]);

  // Set up BroadcastChannel for cross-tab communication
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannelRef.current = new BroadcastChannel('alarm-notifications');
      
      broadcastChannelRef.current.onmessage = (event) => {
        console.log('BroadcastChannel message received:', event.data);
        
        if (isBroadcastingRef.current) {
          isBroadcastingRef.current = false;
          return;
        }
        
        if (event.data.type === 'NEW_REPORTS') {
          const { reports } = event.data;
          if (reports && reports.length > 0) {
            console.log('Showing alarm modal in this tab with', reports.length, 'reports (from another tab)');
            setNewReportData(reports);
            setShowNewReportAlert(true);
            playAlarmSound();
          }
        } else if (event.data.type === 'DISMISS_ALARM') {
          console.log('Dismissing alarm in this tab (from another tab)');
          stopAlarm();
          setShowNewReportAlert(false);
        }
      };
    }

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [playAlarmSound, stopAlarm]);

  // Cleanup alarm on unmount
  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      activeAudioRefs.current.forEach(audio => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
      });
      activeAudioRefs.current = [];
      activeAudioContextRefs.current.forEach(ctx => {
        try {
          ctx.close().catch(() => {});
        } catch (e) {}
      });
      activeAudioContextRefs.current = [];
    };
  }, []);

  // Listen for localStorage changes to update badge count when reports are viewed
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only recalculate if viewedReports changed
      if (e.key === "viewedReports" && reportsSnapshotRef.current) {
        calculateUnseenReportsCount(reportsSnapshotRef.current);
      }
    };

    // Listen for storage events (fires when localStorage changes in other tabs/windows)
    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom event that we can trigger from same window
    const handleCustomStorageChange = () => {
      if (reportsSnapshotRef.current) {
        calculateUnseenReportsCount(reportsSnapshotRef.current);
      }
    };
    window.addEventListener("viewedReportsUpdated", handleCustomStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("viewedReportsUpdated", handleCustomStorageChange);
    };
  }, []);

  // Fetch and count unread chat messages
  useEffect(() => {
    try {
      const messagesRef = collection(db, "chat_messages");
      const q = query(messagesRef, where("isRead", "==", false));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let totalUnread = 0;
        const unreadSessions = new Set<string>();
        
        snapshot.docs.forEach(msgDoc => {
          const data = msgDoc.data();
          const identifiers = Array.from(
            new Set(
              [data.userId, data.userID].filter(Boolean)
            )
          );
          const residentSenderId = data.userId || data.userID;
          // Only count messages from users (not admin messages)
          if (identifiers.length > 0 && residentSenderId && data.senderId === residentSenderId) {
            totalUnread++;
            identifiers.forEach((identifier) => unreadSessions.add(identifier));
          }
        });
        
        setUnreadChatCount(totalUnread);
        unreadSessionIdsRef.current = unreadSessions;
        updateResidentChatBadge();
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching unread chat messages:", error);
    }
  }, []);

  useEffect(() => {
    try {
      const chatsRef = collection(db, "chats");
      const unsubscribe = onSnapshot(chatsRef, (snapshot) => {
        const unopenedSessions = new Set<string>();

        snapshot.docs.forEach((chatDoc) => {
          const data = chatDoc.data();

          // Skip admin/internal chats if flagged
          if (data.chatType === "admin" || data.isAdminChat) {
            return;
          }

          const identifiers = Array.from(
            new Set(
              [data.userId, chatDoc.id].filter(Boolean)
            )
          );

          if (identifiers.length === 0) {
            return;
          }

          const lastAccessMillis = toMillis(data.lastAccessTime);
          const lastMessageMillis =
            toMillis(data.lastMessageTime) ??
            toMillis(data.updatedAt) ??
            toMillis(data.createdAt);

          const isUnopened = lastAccessMillis === null;
          const hasNewerMessage =
            lastAccessMillis !== null &&
            lastMessageMillis !== null &&
            lastMessageMillis > lastAccessMillis;

          if (isUnopened || hasNewerMessage) {
            identifiers.forEach((identifier) => unopenedSessions.add(identifier));
          }
        });

        unopenedSessionIdsRef.current = unopenedSessions;
        updateResidentChatBadge();
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error tracking chat sessions:", error);
    }
  }, []);

  // Track unread admin chat messages
  useEffect(() => {
    try {
      const currentUser = auth.currentUser;
      const sessionUser = SessionManager.getCurrentUser();
      const currentAdminId = currentUser?.uid || sessionUser?.userId || sessionUser?.username || "admin";
      
      const adminChatRef = collection(db, "admin_chat_messages");
      const unsubscribe = onSnapshot(adminChatRef, (snapshot) => {
        let unreadCount = 0;
        
        snapshot.docs.forEach((msgDoc) => {
          const data = msgDoc.data();
          // Count messages that are not from current user and are unread
          if (data.senderId !== currentAdminId && !data.isRead) {
            unreadCount++;
          }
        });
        
        setAdminChatUnreadCount(unreadCount);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error tracking admin chat unread messages:", error);
    }
  }, []);

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleSignOut = async () => {
    try {
      // Log activity before clearing session
      const currentUser = SessionManager.getCurrentUser();
      if (currentUser) {
        await logActivity({
          actionType: ActionType.LOGOUT,
          action: 'User logged out',
          metadata: {
            logoutMethod: "manual"
          }
        });
      }
      
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

  return (
    <div className="flex w-full h-screen bg-brand-orange overflow-hidden">
      <Sidebar 
        isCollapsed={isCollapsed} 
        onCollapse={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        manageReportsBadge={unseenReportsCount}
        chatSupportBadge={unreadChatCount}
        residentChatBadge={residentChatBadge}
        adminChatUnreadCount={adminChatUnreadCount}
      />
      
      {/* Mobile hamburger button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      
      <div className={`flex-1 h-full flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <main className="flex-1 h-full flex flex-col overflow-hidden pl-2 pr-2 pt-2 pb-2">
          <div className="bg-white rounded-3xl shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-2 z-30 bg-white rounded-3xl rounded-b-none shadow-sm">
              <h1 className="text-2xl font-bold text-gray-900">{currentPage.title}</h1>
              
              {/* Profile */}
              <div className="flex items-center gap-4">
                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors">
                    <div className="text-sm text-right hidden sm:block">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.role}</div>
                    </div>
                    <Avatar className="h-9 w-9 border-2 border-gray-200">
                      <img src={user.avatarUrl} alt={user.name} onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                      }} />
                    </Avatar>
                    <ChevronDown className="h-4 w-4 text-gray-500 hidden sm:block" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleProfileClick}>My Profile</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={handleSignOut}>Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* New Report Alert Modal */}
      <Dialog open={showNewReportAlert} onOpenChange={(open) => {
        if (!open) {
          stopAlarm();
          if (broadcastChannelRef.current) {
            broadcastChannelRef.current.postMessage({
              type: 'DISMISS_ALARM'
            });
          }
        }
        setShowNewReportAlert(open);
      }}>
        <DialogContent className="max-w-2xl border-brand-red bg-red-50 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-brand-red flex items-center gap-2">
              <div className="w-3 h-3 bg-brand-red rounded-full animate-pulse"></div>
              🚨 NEW EMERGENCY REPORTS ({newReportData.length})
            </DialogTitle>
          </DialogHeader>
          {newReportData && newReportData.length > 0 && (
            <div className="space-y-4 py-4">
              <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {newReportData.map((report, index) => (
                    <div
                      key={report.id || index}
                      onClick={() => {
                        stopAlarm();
                        setShowNewReportAlert(false);
                        if (broadcastChannelRef.current) {
                          broadcastChannelRef.current.postMessage({
                            type: 'DISMISS_ALARM'
                          });
                        }
                        navigate('/manage-reports');
                        // Mark report as viewed
                        const viewedReportsData = localStorage.getItem("viewedReports");
                        const viewedReports = viewedReportsData ? new Set(JSON.parse(viewedReportsData)) : new Set();
                        viewedReports.add(report.id);
                        localStorage.setItem("viewedReports", JSON.stringify(Array.from(viewedReports)));
                        window.dispatchEvent(new Event("viewedReportsUpdated"));
                        setNewReportData(prev => prev.filter(r => r.id !== report.id));
                      }}
                      className="p-4 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-800">RID: {report.id}</span>
                            <span className="text-sm text-gray-600">Type: {report.type || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-800">
                            {report.dateSubmitted || 'N/A'}
                            {report.timeSubmitted && ` ${report.timeSubmitted}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    stopAlarm();
                    if (broadcastChannelRef.current) {
                      broadcastChannelRef.current.postMessage({
                        type: 'DISMISS_ALARM'
                      });
                    }
                    setShowNewReportAlert(false);
                  }}
                  className="flex-1 border-red-300 text-brand-red hover:bg-red-100"
                >
                  Dismiss All
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => {
                    // Mark all reports as viewed
                    const viewedReportsData = localStorage.getItem("viewedReports");
                    const viewedReports = viewedReportsData ? new Set(JSON.parse(viewedReportsData)) : new Set();
                    
                    // Add all new reports to viewedReports
                    newReportData.forEach(report => {
                      if (report.id) {
                        viewedReports.add(report.id);
                      }
                    });
                    
                    // Save to localStorage
                    localStorage.setItem("viewedReports", JSON.stringify(Array.from(viewedReports)));
                    
                    // Dispatch event to update other components
                    window.dispatchEvent(new Event("viewedReportsUpdated"));
                    
                    // Stop alarm and close modal
                    stopAlarm();
                    if (broadcastChannelRef.current) {
                      broadcastChannelRef.current.postMessage({
                        type: 'DISMISS_ALARM'
                      });
                    }
                    setShowNewReportAlert(false);
                    setNewReportData([]);
                  }}
                  className="flex-1 bg-brand-red text-white hover:bg-red-700"
                >
                  Mark All as Read
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
