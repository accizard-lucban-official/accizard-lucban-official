import { Avatar } from "@/components/ui/avatar";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";
import { SessionManager } from "@/lib/sessionManager";
import { toast } from "@/components/ui/sonner";
import { logActivity, ActionType } from "@/lib/activityLogger";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({
  title,
  subtitle
}: PageHeaderProps) {
  // User info state
  const [user, setUser] = useState({
    name: "",
    role: "",
    avatarUrl: ""
  });
  const { userRole, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole && !roleLoading) {
      setUser({
        name: userRole.name || "",
        role: userRole.position || "",
        avatarUrl: userRole.profilePicture || "/accizard-uploads/login-signup-cover.png"
      });
    }
  }, [userRole, roleLoading]);

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
    <div className="px-8 py-4 bg-brand-orange">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center space-x-3 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors">
              <div className="text-sm text-right">
                <div className="font-medium text-white">{user.name}</div>
                <div className="text-sm text-white/80">{user.role}</div>
              </div>
              <Avatar className="h-8 w-8">
                <img src={user.avatarUrl} alt={user.name} onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                }} />
              </Avatar>
              <ChevronDown className="h-4 w-4 text-white" />
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
    </div>
  );
}