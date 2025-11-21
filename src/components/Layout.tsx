import { useState, useEffect, useRef } from "react";
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
  const [user, setUser] = useState({
    name: "",
    role: "",
    avatarUrl: ""
  });
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
    const combined = new Set<string>([
      ...unreadSessionIdsRef.current,
      ...unopenedSessionIdsRef.current
    ]);
    setResidentChatBadge(combined.size);
  };

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

  // Fetch and count unseen reports
  useEffect(() => {
    try {
      const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
        // Store snapshot for recalculation when localStorage changes
        reportsSnapshotRef.current = snapshot;
        calculateUnseenReportsCount(snapshot);
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching unseen reports:", error);
    }
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

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleSignOut = async () => {
    try {
      // Log activity before clearing session
      const currentUser = SessionManager.getCurrentUser();
      if (currentUser) {
        await logActivity({
          userId: currentUser.userId || currentUser.username || "unknown",
          username: currentUser.username || currentUser.name || "Unknown User",
          actionType: ActionType.USER_LOGGED_OUT,
          details: {
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
    </div>
  );
}
