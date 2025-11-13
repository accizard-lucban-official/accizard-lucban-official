import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { toast } from "@/components/ui/sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Eye, EyeOff, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionManager } from "@/lib/sessionManager";
import { logActivity, ActionType } from "@/lib/activityLogger";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("super-admin");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    
    try {
      if (userType === "admin") {
        // Admin login: check Firestore for username/password
        if (!username || !password) {
          setError("Please enter your username and password.");
          toast.error("Please enter your username and password.");
          return;
        }
        
        // Step 1: Verify credentials against Firestore (existing system)
        const q = query(collection(db, "admins"), where("username", "==", username), where("password", "==", password));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Step 2: Silent Firebase Auth - Get auth token for Storage access
          try {
            // Create Firebase Auth email from username
            const firebaseEmail = `${username}@admin.accizard.local`;
            const firebasePassword = password;
            
            console.log("🔐 Attempting silent Firebase Auth for admin...");
            
            try {
              // Try to sign in first
              await signInWithEmailAndPassword(auth, firebaseEmail, firebasePassword);
              console.log("✅ Silent Firebase Auth successful (existing account)");
            } catch (signInError: any) {
              if (signInError.code === 'auth/user-not-found') {
                // Create Firebase Auth account silently
                console.log("📝 Creating Firebase Auth account for admin...");
                await createUserWithEmailAndPassword(auth, firebaseEmail, firebasePassword);
                console.log("✅ Silent Firebase Auth successful (new account created)");
              } else if (signInError.code === 'auth/wrong-password') {
                // Password mismatch - update it by recreating (rare case)
                console.log("⚠️ Firebase Auth password mismatch, admin can still access");
              } else {
                throw signInError;
              }
            }
          } catch (authError: any) {
            // Non-blocking: If Firebase Auth fails, admin can still access Firestore
            console.warn("⚠️ Silent Firebase Auth failed (non-blocking):", authError.code, authError.message);
            console.log("ℹ️ Admin can still access Firestore, but Storage may be limited");
          }
          
          // Step 3: Complete login with new session manager
          const adminData = querySnapshot.docs[0].data();
          SessionManager.setSession({
            isLoggedIn: true,
            userType: 'admin',
            username: username,
            userId: querySnapshot.docs[0].id,
            name: adminData.name || adminData.fullName || username,
            email: adminData.email
          });
          
          // Log successful login
          await logActivity({
            actionType: ActionType.LOGIN,
            action: `Admin "${adminData.name || username}" logged in successfully`,
            entityType: 'admin',
            entityId: querySnapshot.docs[0].id,
            entityName: adminData.name || adminData.fullName || username
          });
          
          toast.success(`Welcome back, ${adminData.name || username}!`);
          navigate("/dashboard");
        } else {
          // Log failed login attempt
          await logActivity({
            actionType: ActionType.LOGIN_FAILED,
            action: `Failed login attempt for admin username: "${username}"`,
            metadata: { username, reason: 'Invalid credentials' }
          });
          
          setError("Invalid username or password.");
          toast.error("Invalid username or password.");
        }
        return;
      }
      // Super Admin login: Firebase Auth
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Please enter a valid email address.");
        toast.error("Invalid email address.");
        return;
      }
      
      console.log("Attempting Firebase Auth login with:", email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Firebase Auth successful. User email:", user.email);
      
      // Check if the user exists in the superAdmin collection
      console.log("Checking superAdmin collection...");
      const superadminQuery = query(
        collection(db, "superAdmin"), 
        where("email", "==", user.email)
      );
      const superadminSnapshot = await getDocs(superadminQuery);
      
      console.log("SuperAdmin query results:", superadminSnapshot.size, "documents found");
      if (superadminSnapshot.size > 0) {
        console.log("First document data:", superadminSnapshot.docs[0].data());
      }
      
      if (superadminSnapshot.empty) {
        // User exists in Firebase Auth but not in superAdmin collection
        // Sign them out and show error
        console.log("User not found in superAdmin collection, signing out...");
        
        // Log failed login attempt
        await logActivity({
          actionType: ActionType.LOGIN_FAILED,
          action: `Failed login attempt for super admin email: "${email}"`,
          metadata: { email, reason: 'Not authorized (not in superAdmin collection)' }
        });
        
        await auth.signOut();
        setError("Access denied. You are not authorized to access the web application.");
        toast.error("Access denied. You are not authorized to access the web application.");
        return;
      }
      
      // User is in superAdmin collection, set up session
      const superAdminData = superadminSnapshot.docs[0].data();
      SessionManager.setSession({
        isLoggedIn: true,
        userType: 'superadmin',
        username: superAdminData.username || user.email?.split('@')[0] || 'Super Admin',
        userId: user.uid,
        name: superAdminData.fullName || superAdminData.name || 'Super Admin',
        email: user.email || ''
      });
      
      // Log successful login
      await logActivity({
        actionType: ActionType.LOGIN,
        action: `Super admin "${superAdminData.fullName || superAdminData.name || 'Super Admin'}" logged in successfully`,
        entityType: 'superadmin',
        entityId: user.uid,
        entityName: superAdminData.fullName || superAdminData.name || 'Super Admin'
      });
      
      console.log("Login successful! Navigating to dashboard...");
      toast.success(`Welcome back, ${superAdminData.fullName || 'Super Admin'}!`);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      
      // Check for network connectivity
      if (!navigator.onLine) {
        setError("No internet connection. Please check your network and try again.");
        toast.error("No internet connection. Please check your network.");
      }
      // Check for Firebase network errors
      else if (err.code === 'auth/network-request-failed' || 
               err.message?.includes('network') ||
               err.message?.includes('fetch')) {
        setError("Network error. Please check your internet connection and try again.");
        toast.error("Network error. Please check your connection.");
      }
      // Check for specific Firebase auth errors
      else if (err.code === 'auth/user-not-found' || 
               err.code === 'auth/wrong-password' ||
               err.code === 'auth/invalid-email') {
        // Log failed login attempt
        await logActivity({
          actionType: ActionType.LOGIN_FAILED,
          action: `Failed login attempt for ${userType === 'admin' ? `admin username: "${username}"` : `super admin email: "${email}"`}`,
          metadata: { 
            userType,
            [userType === 'admin' ? 'username' : 'email']: userType === 'admin' ? username : email,
            reason: err.code || 'Invalid credentials'
          }
        });
        
        setError("Invalid email or password. Please check your credentials.");
        toast.error("Invalid email or password.");
      }
      // Generic error fallback
      else {
        setError("Login failed. Please try again.");
        toast.error("Login failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    navigate("/password-recovery");
  };

    return <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      {/* Floating Container */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {/* Left Side - Logo and Branding */}
          <div className="flex-1 bg-[url('/accizard-uploads/login-image.png')] bg-cover bg-center min-h-[250px] lg:min-h-auto">
            <div className="text-center">
              
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex-1 bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <Card className="w-full max-w-sm border-0 shadow-none">
          <CardHeader className="text-center pb-3 sm:pb-6">
            <div className="flex flex-col items-center justify-center mb-4">
              {userType === "super-admin" ? (
                <div className="flex flex-col items-center space-y-2">
                  <img 
                    src="/accizard-uploads/logo-ldrrmo-png.png" 
                    alt="LDRRMO Logo" 
                    className="h-12 w-12 object-contain"
                  />
                  <div className="text-center">
                    <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800 mb-0">Account Login</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Welcome back, Super Admin!</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <img 
                    src="/accizard-uploads/logo-ldrrmo-png.png" 
                    alt="LDRRMO Logo" 
                    className="h-12 w-12 object-contain"
                  />
                  <div className="text-center">
                    <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800 mb-0">Account Login</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Welcome back, Admin!</p>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="super-admin" value={userType} onValueChange={setUserType} className="w-full">
              {/* User Type Toggle */}
              <TabsList className="grid w-full grid-cols-2 mb-3 sm:mb-4 bg-gray-100 h-auto p-1">
                <TabsTrigger 
                  value="super-admin" 
                  className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium data-[state=active]:bg-brand-orange data-[state=active]:text-white text-gray-600 hover:bg-orange-100 hover:text-brand-orange transition-colors"
                >
                  Super Admin
                </TabsTrigger>
                <TabsTrigger 
                  value="admin"
                  className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium data-[state=active]:bg-brand-orange data-[state=active]:text-white text-gray-600 hover:bg-orange-100 hover:text-brand-orange transition-colors"
                >
                  Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="super-admin" className="mt-0">
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-800 font-medium text-sm sm:text-base">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="h-10 sm:h-12 border-gray-300 focus:border-gray-300 focus:ring-0 text-sm sm:text-base" />
                  </div>
                  <div className="space-y-2 relative">
                    <Label htmlFor="password" className="text-gray-800 font-medium text-sm sm:text-base">Password</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="h-10 sm:h-12 border-gray-300 focus:border-gray-300 focus:ring-0 pr-10 text-sm sm:text-base" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-700 hover:bg-transparent"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-10 sm:h-12 bg-brand-orange hover:bg-brand-orange-400 text-white font-medium rounded-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Logging in...
                      </div>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleForgotPassword}
                      className="text-sm font-medium text-brand-orange hover:text-brand-orange-400 p-0 h-auto"
                    >
                      Forgot password?
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="mt-0">
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-gray-800 font-medium text-sm sm:text-base">Username</Label>
                    <Input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required className="h-10 sm:h-12 border-gray-300 focus:border-gray-300 focus:ring-0 text-sm sm:text-base" />
                  </div>
                  <div className="space-y-2 relative">
                    <Label htmlFor="password-admin" className="text-gray-800 font-medium text-sm sm:text-base">Password</Label>
                    <div className="relative">
                      <Input id="password-admin" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="h-10 sm:h-12 border-gray-300 focus:border-gray-300 focus:ring-0 pr-10 text-sm sm:text-base" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-700 hover:bg-transparent"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-10 sm:h-12 bg-brand-orange hover:bg-brand-orange-400 text-white font-medium rounded-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Logging in...
                      </div>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  <div className="text-center">
                    <div className="h-6"></div>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Help Button with Modal */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute bottom-4 right-4 rounded-full shadow-md bg-brand-orange hover:bg-brand-orange-400 border-0"
            aria-label="Password recovery help"
          >
            <HelpCircle className="h-5 w-5 text-white" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-800">Password Recovery Help</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-brand-orange rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">1</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Super Admins</h4>
                  <p className="text-sm text-gray-600 mt-1">Can reset their password through email using the "Forgot password?" link below the login form.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-brand-orange rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">2</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Admins</h4>
                  <p className="text-sm text-gray-600 mt-1">If you forget your password, please contact your Super Admin to reset it for you.</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>;
}