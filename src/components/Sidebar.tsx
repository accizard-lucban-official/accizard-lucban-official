import { Home, FileText, Map, MessageSquare, Bell, Users, User, ChevronLeft, ClipboardList, LogOut, X, Activity, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { preloadRoute } from "@/utils/routePreloader";
import { useUserRole } from "@/hooks/useUserRole";
import { SessionManager } from "@/lib/sessionManager";
import { toast } from "@/components/ui/sonner";

interface SidebarProps {
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  manageUsersBadge?: number;
  manageReportsBadge?: number;
  chatSupportBadge?: number;
  residentChatBadge?: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}


const menuItems = [{
  title: "Dashboard",
  icon: Home,
  path: "/dashboard",
  preload: () => import("@/pages/Index")
}, {
  title: "Manage Reports",
  icon: ClipboardList,
  path: "/manage-reports",
  preload: () => import("@/components/ManageReportsPage")
}, {
  title: "Risk and Utility Map",
  icon: Map,
  path: "/risk-map",
  preload: () => import("@/components/RiskMapPage")
}, {
  title: "Chat Support",
  icon: MessageSquare,
  path: "/chat-support",
  preload: () => import("@/components/ChatSupportPage")
}, {
  title: "Announcements",
  icon: Bell,
  path: "/announcements",
  preload: () => import("@/components/AnnouncementsPage")
}, {
  title: "Manage Users",
  icon: Users,
  path: "/manage-users",
  preload: () => import("@/components/ManageUsersPage")
}];

const otherItems = [{
  title: "My Profile",
  icon: User,
  path: "/profile",
  preload: () => import("@/components/ProfilePage")
}, {
  title: "System Logs",
  icon: Activity,
  path: "/system-logs",
  preload: () => import("@/components/SystemLogsPage")
}];

export function Sidebar({ isCollapsed, onCollapse, manageUsersBadge, manageReportsBadge, chatSupportBadge, residentChatBadge, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSignOut, setShowSignOut] = useState(false);
  const [manageUsersExpanded, setManageUsersExpanded] = useState(false);
  const [chatSupportExpanded, setChatSupportExpanded] = useState(false);
  const { canManageAdmins } = useUserRole();

  const handleMenuClick = (item: typeof menuItems[0]) => {
    navigate(item.path);
    // Close mobile sidebar when navigating
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const handleSignOut = async () => {
    try {
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

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "bg-brand-orange text-white transition-all duration-300 flex flex-col h-screen fixed left-0 top-0 z-50",
        // Mobile: slide in/out
        isMobileOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full",
        // Tablet and Desktop: always visible with proper width
        "md:w-64 md:translate-x-0",
        // Desktop: collapsible behavior
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
      {/* Header */}
      <div className="p-4 border-b border-white/20 flex items-center justify-between">
        {(!isCollapsed || isMobileOpen) && <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent">
              <img alt="ACCIZARD" className="w-8 h-8" src="/accizard-uploads/accizard-logo-white-png.png" />
            </div>
            <div>
            <img alt="ACCIZARD" className="h-8" src="/accizard-uploads/accizard-logotype-png.png" />
            </div>
          </div>}
        
        {/* Mobile close button */}
        {isMobileOpen && onMobileClose && (
          <button onClick={onMobileClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
        
        {/* Desktop collapse button */}
        <button 
          onClick={() => onCollapse(!isCollapsed)} 
          className={cn(
            "p-2 hover:bg-white/20 rounded-lg transition-colors",
            isMobileOpen && "hidden lg:block"
          )}
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Menu */}
      <div className="flex-1 py-6 overflow-y-auto">
        <div className="px-3">
          {(!isCollapsed || isMobileOpen) && <div className="text-xs font-semibold text-white/90 uppercase tracking-wider mb-4 px-3">
              MENU
            </div>}
          <nav className="space-y-2">
            {menuItems.map(item => {
              // Special handling for "Chat Support" with dropdown
              if (item.title === "Chat Support") {
                return (
                  <div key={item.title}>
                    <button 
                      onClick={() => {
                        if (isCollapsed && !isMobileOpen) {
                          // If collapsed, navigate to resident support
                          navigate("/chat-support");
                          if (onMobileClose) onMobileClose();
                        } else {
                          // If expanded, toggle dropdown
                          setChatSupportExpanded(!chatSupportExpanded);
                        }
                      }}
                      onMouseEnter={() => preloadRoute(item.preload, item.title)}
                      onFocus={() => preloadRoute(item.preload, item.title)}
                      onTouchStart={() => preloadRoute(item.preload, item.title)}
                      className={cn(
                        "w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200", 
                        (isCollapsed && !isMobileOpen) ? "justify-center px-2 py-3" : "justify-between px-4 py-3", 
                        (location.pathname === '/chat-support' || location.pathname === '/admin-chat') ? "bg-white text-brand-orange" : "text-white/90 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      <div className={cn("flex items-center", (isCollapsed && !isMobileOpen) && "justify-center")}>
                        <item.icon className={cn("h-5 w-5 flex-shrink-0", (!isCollapsed || isMobileOpen) && "mr-3")} />
                        {(!isCollapsed || isMobileOpen) && <span>{item.title}</span>}
                      </div>
                      {(!isCollapsed || isMobileOpen) && (
                        <div className="flex items-center gap-2">
                          {(chatSupportBadge ?? 0) > 0 && (
                            <Badge className="bg-orange-500 hover:bg-orange-400 text-white text-xs border-0 font-semibold">
                              {chatSupportBadge}
                            </Badge>
                          )}
                          <ChevronDown className={cn("h-4 w-4 transition-transform", chatSupportExpanded && "rotate-180")} />
                        </div>
                      )}
                    </button>
                    
                    {/* Dropdown submenu */}
                    {chatSupportExpanded && (!isCollapsed || isMobileOpen) && (
                      <div className="ml-4 mt-2 space-y-1">
                        <button
                          onClick={() => {
                            navigate("/chat-support");
                            if (onMobileClose) onMobileClose();
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            location.pathname === "/chat-support"
                              ? "bg-white text-brand-orange"
                              : "text-white/90 hover:bg-white/20 hover:text-white"
                          )}
                        >
                          <span>Resident Support</span>
                          {(residentChatBadge ?? 0) > 0 && (
                            <Badge className="bg-white text-brand-orange text-[11px] font-semibold border-0">
                              {residentChatBadge}
                            </Badge>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            navigate("/admin-chat");
                            if (onMobileClose) onMobileClose();
                          }}
                          className={cn(
                            "w-full flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            location.pathname === "/admin-chat"
                              ? "bg-white text-brand-orange"
                              : "text-white/90 hover:bg-white/20 hover:text-white"
                          )}
                        >
                          Admin Chat
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              
              // Special handling for "Manage Users" with dropdown
              if (item.title === "Manage Users") {
                return (
                  <div key={item.title}>
                    <button 
                      onClick={() => {
                        if (isCollapsed && !isMobileOpen) {
                          // If collapsed, navigate directly
                          handleMenuClick(item);
                        } else {
                          // If expanded, toggle dropdown
                          setManageUsersExpanded(!manageUsersExpanded);
                        }
                      }}
                      onMouseEnter={() => preloadRoute(item.preload, item.title)}
                      onFocus={() => preloadRoute(item.preload, item.title)}
                      onTouchStart={() => preloadRoute(item.preload, item.title)}
                      className={cn(
                        "w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200", 
                        (isCollapsed && !isMobileOpen) ? "justify-center px-2 py-3" : "justify-between px-4 py-3", 
                        (isActive(item.path) || location.pathname.startsWith('/manage-users')) ? "bg-white text-brand-orange" : "text-white/90 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      <div className={cn("flex items-center", (isCollapsed && !isMobileOpen) && "justify-center")}>
                        <item.icon className={cn("h-5 w-5 flex-shrink-0", (!isCollapsed || isMobileOpen) && "mr-3")} />
                        {(!isCollapsed || isMobileOpen) && <span>{item.title}</span>}
                      </div>
                      {(!isCollapsed || isMobileOpen) && (
                        <div className="flex items-center gap-2">
                          {(manageUsersBadge ?? 0) > 0 && (
                            <Badge className="bg-orange-500 hover:bg-orange-400 text-white text-xs border-0 font-semibold">
                              {manageUsersBadge}
                            </Badge>
                          )}
                          <ChevronDown className={cn("h-4 w-4 transition-transform", manageUsersExpanded && "rotate-180")} />
                        </div>
                      )}
                    </button>
                    
                    {/* Dropdown submenu */}
                    {manageUsersExpanded && (!isCollapsed || isMobileOpen) && (
                      <div className="ml-4 mt-2 space-y-1">
                        {canManageAdmins() && (
                          <button
                            onClick={() => {
                              navigate("/manage-users", { state: { tab: "admins" } });
                              if (onMobileClose) onMobileClose();
                            }}
                            className={cn(
                              "w-full flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                              location.pathname === "/manage-users" && location.state?.tab === "admins"
                                ? "bg-white text-brand-orange"
                                : "text-white/90 hover:bg-white/20 hover:text-white"
                            )}
                          >
                            Admin Accounts
                          </button>
                        )}
                        <button
                          onClick={() => {
                            navigate("/manage-users", { state: { tab: "residents" } });
                            if (onMobileClose) onMobileClose();
                          }}
                          className={cn(
                            "w-full flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            location.pathname === "/manage-users" && location.state?.tab === "residents"
                              ? "bg-white text-brand-orange"
                              : "text-white/90 hover:bg-white/20 hover:text-white"
                          )}
                        >
                          Residents
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              
              // Regular menu items
              return (
                <button 
                  key={item.title} 
                  onClick={() => handleMenuClick(item)}
                  onMouseEnter={() => preloadRoute(item.preload, item.title)}
                  onFocus={() => preloadRoute(item.preload, item.title)}
                  onTouchStart={() => preloadRoute(item.preload, item.title)}
                                                                             className={cn(
                    "w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200", 
                    (isCollapsed && !isMobileOpen) ? "justify-center px-2 py-3" : "justify-between px-4 py-3", 
                    isActive(item.path) ? "bg-white text-brand-orange" : "text-white/90 hover:bg-white/20 hover:text-white"
                  )}
                >
                  <div className={cn("flex items-center", (isCollapsed && !isMobileOpen) && "justify-center")}>
                    <item.icon className={cn("h-5 w-5 flex-shrink-0", (!isCollapsed || isMobileOpen) && "mr-3")} />
                    {(!isCollapsed || isMobileOpen) && <span>{item.title}</span>}
                  </div>
                  {(!isCollapsed || isMobileOpen) && item.title === "Manage Reports" && (manageReportsBadge ?? 0) > 0 && (
                    <Badge className="bg-orange-500 hover:bg-orange-400 text-white text-xs border-0 font-semibold animate-pulse">
                      {manageReportsBadge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="px-3 mt-8">
          {(!isCollapsed || isMobileOpen) && <div className="text-xs font-semibold text-white/90 uppercase tracking-wider mb-4 px-3">
              OTHERS
            </div>}
          <nav className="space-y-2">
            {otherItems.map(item => <button 
                key={item.title} 
                onClick={() => {
                  navigate(item.path);
                  if (onMobileClose) onMobileClose();
                }}
                onMouseEnter={() => preloadRoute(item.preload, item.title)}
                onFocus={() => preloadRoute(item.preload, item.title)}
                onTouchStart={() => preloadRoute(item.preload, item.title)}
                className={cn("w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200", (isCollapsed && !isMobileOpen) ? "justify-center px-2 py-3" : "px-4 py-3", isActive(item.path) ? "bg-white text-brand-orange" : "text-white/90 hover:bg-white/20 hover:text-white")}>
                <item.icon className={cn("h-5 w-5 flex-shrink-0", (!isCollapsed || isMobileOpen) && "mr-3")} />
                {(!isCollapsed || isMobileOpen) && <span>{item.title}</span>}
              </button>)}
          </nav>
        </div>
      </div>

      {/* Partnership Card */}
      {(!isCollapsed || isMobileOpen) && (
        <div className="px-3 pb-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
            <div className="flex items-center justify-between">
              <img 
                src="/accizard-uploads/logo-ldrrmo-png.png" 
                alt="Lucban LDRRMO" 
                className="h-8 w-auto object-contain"
              />
              <div className="text-center flex-1 px-2">
                <div className="text-xs font-light text-muted">
                  in partnership with
                </div>
                <div className="text-xs font-bold">
                  Lucban LDRRMO
                </div>
              </div>
              <div className="w-8"></div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Button */}
      <div className="p-3 border-t border-orange-400/30">
        <AlertDialog open={showSignOut} onOpenChange={setShowSignOut}>
          <AlertDialogTrigger asChild>
            <button onClick={() => setShowSignOut(true)} className={cn("w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 text-white/90 hover:bg-red-500 hover:text-white", (isCollapsed && !isMobileOpen) ? "justify-center px-2 py-3" : "px-4 py-3")}>
              <LogOut className={cn("h-5 w-5 flex-shrink-0", (!isCollapsed || isMobileOpen) && "mr-3")} />
              {(!isCollapsed || isMobileOpen) && <span>Sign Out</span>}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Sign Out</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to sign out? Your session will end.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSignOut} className="bg-red-600 hover:bg-red-700">
                Sign Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </div>
    </>
  );
}