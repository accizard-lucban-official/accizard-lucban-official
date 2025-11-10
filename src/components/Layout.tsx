import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation } from "react-router-dom";
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
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where, limit, getDocs } from "firebase/firestore";
import { useUserRole } from "@/hooks/useUserRole";

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState({
    name: "",
    role: "",
    avatarUrl: ""
  });
  const location = useLocation();
  const currentPage = pageConfig[location.pathname] || {
    title: "404",
    subtitle: "Page not found"
  };
  const { userRole, loading: roleLoading } = useUserRole();

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

  // Fetch notifications
  useEffect(() => {
    async function fetchNotifications() {
      try {
        // Fetch latest 3 reports
        const reportsSnap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(3)));
        const reports = reportsSnap.docs.map(doc => ({
          type: "report",
          id: doc.id,
          ...doc.data()
        }));
        // Fetch latest 3 users
        const usersSnap = await getDocs(query(collection(db, "users"), orderBy("createdDate", "desc"), limit(3)));
        const users = usersSnap.docs.map(doc => ({
          type: "user",
          id: doc.id,
          ...doc.data()
        }));
        // Fetch latest 3 chat notifications
        let chats: any[] = [];
        try {
          const chatsSnap = await getDocs(query(collection(db, "chats"), orderBy("createdAt", "desc"), limit(3)));
          chats = chatsSnap.docs.map(doc => ({
            type: "chat",
            id: doc.id,
            ...doc.data()
          }));
        } catch {}
        setNotifications([
          ...reports,
          ...users,
          ...chats
        ].sort((a, b) => {
          const aDate = a.createdAt || a.createdDate || 0;
          const bDate = b.createdAt || b.createdDate || 0;
          return bDate > aDate ? 1 : bDate < aDate ? -1 : 0;
        }));
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    }
    fetchNotifications();
  }, []);

  // Fetch and count unseen reports
  useEffect(() => {
    try {
      const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
        // Get viewed reports from localStorage
        const viewedReportsData = localStorage.getItem("viewedReports");
        const viewedReports = viewedReportsData ? new Set(JSON.parse(viewedReportsData)) : new Set();
        
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const unseenCount = snapshot.docs.filter(doc => {
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
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching unseen reports:", error);
    }
  }, []);

  // Fetch and count unread chat messages
  useEffect(() => {
    try {
      const messagesRef = collection(db, "chat_messages");
      const q = query(messagesRef, where("isRead", "==", false));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let totalUnread = 0;
        
        snapshot.docs.forEach(msgDoc => {
          const data = msgDoc.data();
          const userId = data.userId;
          // Only count messages from users (not admin messages)
          if (userId && data.senderId === userId) {
            totalUnread++;
          }
        });
        
        setUnreadChatCount(totalUnread);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching unread chat messages:", error);
    }
  }, []);

  return (
    <div className="flex w-full h-screen bg-brand-orange overflow-hidden">
      <Sidebar 
        isCollapsed={isCollapsed} 
        onCollapse={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        manageReportsBadge={unseenReportsCount}
        chatSupportBadge={unreadChatCount}
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
              
              {/* Profile and Notifications */}
              <div className="flex items-center gap-4">
                {/* Notifications Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none transition-colors">
                      <Bell className="h-5 w-5 text-gray-600" />
                      {notifications.length > 0 && (
                        <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-w-xs">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
                    ) : (
                      notifications.slice(0, 9).map((notif, i) => (
                        <DropdownMenuItem key={notif.type + notif.id + i} className="flex flex-col items-start gap-1 py-2">
                          {notif.type === "report" && (
                            <>
                              <span className="font-medium text-orange-600">New Report Submitted</span>
                              <span className="text-xs text-gray-700 truncate w-full">{notif.title || notif.description || notif.type}</span>
                              <span className="text-xs text-gray-400">{notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ""}</span>
                            </>
                          )}
                          {notif.type === "user" && (
                            <>
                              <span className="font-medium text-blue-600">New User Registered</span>
                              <span className="text-xs text-gray-700 truncate w-full">{notif.fullName || notif.name || notif.username}</span>
                              <span className="text-xs text-gray-400">{notif.createdDate ? notif.createdDate : ""}</span>
                            </>
                          )}
                          {notif.type === "chat" && (
                            <>
                              <span className="font-medium text-green-600">New Chat Message</span>
                              <span className="text-xs text-gray-700 truncate w-full">{notif.message || notif.lastMessage || notif.type}</span>
                              <span className="text-xs text-gray-400">{notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ""}</span>
                            </>
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

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
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Switch Account</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">Sign out</DropdownMenuItem>
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
