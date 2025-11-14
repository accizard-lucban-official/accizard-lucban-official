import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Trash2, MessageSquare, Clock, User, Paperclip, Image as ImageIcon, FileText, Send, Check, CheckCheck, Loader2, X, Download, File, ChevronUp, ChevronDown, Video, Music, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Layout } from "./Layout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, getDoc, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import { formatFileSize, isImageFile, isVideoFile, isAudioFile } from "@/lib/storage";
import { SessionManager } from "@/lib/sessionManager";

interface ChatMessage {
  id: string;
  message?: string;  // Web app field
  content?: string;  // Mobile app field
  senderId: string;
  senderName: string;
  timestamp: any;
  userId?: string;   // Web app field (camelCase)
  userID?: string;   // Mobile app field (PascalCase)
  userName?: string;
  isRead?: boolean;
  imageUrl?: string; // For image attachments
  videoUrl?: string; // For video attachments
  audioUrl?: string; // For audio attachments
  fileUrl?: string; // For file attachments
  fileName?: string; // Original file name
  fileSize?: number; // File size in bytes
  fileType?: string; // MIME type
  profilePictureUrl?: string; // For user profile pictures
}

interface AttachmentPreview {
  file: File;
  url: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  id: string;
}

interface ChatSession {
  id: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastActivity: Date;
  unreadCount: number;
  status: "active" | "waiting" | "resolved";
}

export function ChatSupportPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [chatSessions, setChatSessions] = useState<any[]>([]); // users with active chats
  const [loadingChatSessions, setLoadingChatSessions] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [chatToDelete, setChatToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const messageRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userLastSeen, setUserLastSeen] = useState<Record<string, Date>>({});
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const { uploadSingleFile, uploadState } = useFileUpload();

  const getSessionIdentifiers = (session: any) =>
    Array.from(
      new Set(
        [session?.userId, session?.id, session?.firebaseUid, session?.userID].filter(Boolean)
      )
    );

  const getUnreadCountForSession = (session: any) => {
    const identifiers = getSessionIdentifiers(session);
    for (const identifier of identifiers) {
      const count = unreadCounts[identifier];
      if (count && count > 0) {
        return count;
      }
    }
    return 0;
  };

  const totalUnreadSessions = useMemo(() => {
    const ids = new Set<string>();
    chatSessions.forEach((session) => {
      const count = getUnreadCountForSession(session);
      if (count > 0) {
        getSessionIdentifiers(session).forEach((id) => ids.add(id));
      }
    });
    return ids.size;
  }, [chatSessions, unreadCounts]);

  const handleMobileBack = () => {
    setShowChatOnMobile(false);
  };

  // Fetch all users for search
  useEffect(() => {
    async function fetchUsers() {
      setLoadingUsers(true);
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersData = querySnapshot.docs.map(userDoc => {
          const data = userDoc.data();
          // Handle different field names for profile picture
          const profilePicture = data.profilePicture || data.profilePictureUrl || data.profile_picture || data.avatar || "";
          
          return {
            id: userDoc.id,
            ...data,
            profilePicture: profilePicture  // Ensure profilePicture is set
          };
        });
        console.log("📊 Fetched users for search:", usersData.length);
        console.log("🖼️ Users with profile pictures:", usersData.filter(u => u.profilePicture).length);
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    const updateView = () => {
      setIsMobileView(window.innerWidth < 1024);
    };
    updateView();
    window.addEventListener("resize", updateView);
    return () => window.removeEventListener("resize", updateView);
  }, []);

  useEffect(() => {
    if (!isMobileView) {
      setShowChatOnMobile(false);
    }
  }, [isMobileView]);

  useEffect(() => {
    if (!selectedSession) {
      setShowChatOnMobile(false);
    }
  }, [selectedSession]);

  // Real-time listener for chat sessions (from chats collection)
  useEffect(() => {
    setLoadingChatSessions(true);
    try {
      const chatsRef = collection(db, "chats");
      const unsubscribe = onSnapshot(chatsRef, async (snapshot) => {
        const sessionsData = await Promise.all(snapshot.docs.map(async chatDoc => {
          const data = chatDoc.data();
          
          console.log("📋 Loading chat session:", chatDoc.id, data);
          
          // Fetch user data from users collection if profile picture or phone number is missing
          let profilePicture = data.profilePicture || data.profilePictureUrl || data.profile_picture || "";
          let phoneNumber = data.userPhoneNumber || data.mobileNumber || data.phoneNumber || "";
          let shouldUpdateChat = false;
          
          // Check if we need to fetch user data
          if ((!profilePicture || !phoneNumber) && data.userId) {
            try {
              console.log("🔍 Fetching missing user data for:", data.userId);
              
              let userData = null;
              
              // Try querying by firebaseUid
              let userQuery = query(
                collection(db, "users"),
                where("firebaseUid", "==", data.userId)
              );
              let userSnapshot = await getDocs(userQuery);
              
              if (userSnapshot.empty) {
                // Try getting user document by ID
                console.log("🔍 Trying to find user by document ID:", data.userId);
                try {
                  const userDocRef = doc(db, "users", data.userId);
                  const userDocSnap = await getDoc(userDocRef);
                  if (userDocSnap.exists()) {
                    userData = userDocSnap.data();
                  }
                } catch (error) {
                  console.error("Error finding user by ID:", error);
                }
              } else {
                userData = userSnapshot.docs[0].data();
              }
              
              // Extract user data if found
              if (userData) {
                console.log("✅ User data found:", userData);
                
                // Get profile picture if missing
                if (!profilePicture) {
                  profilePicture = userData.profilePicture || userData.profilePictureUrl || userData.profile_picture || userData.avatar || "";
                  if (profilePicture) {
                    shouldUpdateChat = true;
                    console.log("🖼️ Found profile picture:", profilePicture);
                  }
                }
                
                // Get phone number if missing
                if (!phoneNumber) {
                  phoneNumber = userData.mobileNumber || userData.phoneNumber || userData.phone || "";
                  if (phoneNumber) {
                    shouldUpdateChat = true;
                    console.log("📱 Found phone number:", phoneNumber);
                  }
                }
                
                // Update chat document with fetched data
                if (shouldUpdateChat) {
                  const chatRef = doc(db, "chats", chatDoc.id);
                  const updateData: any = {};
                  
                  if (profilePicture) {
                    updateData.profilePicture = profilePicture;
                    updateData.profilePictureUrl = profilePicture;
                  }
                  if (phoneNumber) {
                    updateData.userPhoneNumber = phoneNumber;
                    updateData.mobileNumber = phoneNumber;
                  }
                  
                  await updateDoc(chatRef, updateData);
                  console.log("✅ Updated chat document with user data");
                }
              }
            } catch (error) {
              console.error("❌ Error fetching user data:", error);
            }
          }
          
          return {
            id: chatDoc.id,
            userId: data.userId || chatDoc.id,
            userName: data.userName || "Unknown User",
            userEmail: data.userEmail || "",
            fullName: data.userName || "Unknown User",
            userPhoneNumber: phoneNumber,
            mobileNumber: phoneNumber,
            lastMessage: data.lastMessage || "",
            lastMessageTime: data.lastMessageTime,
            lastAccessTime: data.lastAccessTime,
            createdAt: data.createdAt,
            profilePicture: profilePicture,
            profilePictureUrl: profilePicture,
            ...data
          };
        }));
        
        console.log("✅ All chat sessions loaded with profile pictures:", sessionsData);
        
        // Sort by most recent activity (most recent at top)
        sessionsData.sort((a, b) => {
          // Helper function to get timestamp from various fields
          const getTimestamp = (session: any): number => {
            // Priority order: lastMessageTime > updatedAt > lastAccessTime > createdAt > now
            
            // 1. Try lastMessageTime first (most recent message) - highest priority
            if (session.lastMessageTime?.toDate) {
              return session.lastMessageTime.toDate().getTime();
            } else if (session.lastMessageTime instanceof Date) {
              return session.lastMessageTime.getTime();
            } else if (typeof session.lastMessageTime === 'number') {
              return session.lastMessageTime;
            }
            
            // 2. Try updatedAt (when chat metadata was last updated)
            if (session.updatedAt?.toDate) {
              return session.updatedAt.toDate().getTime();
            } else if (session.updatedAt instanceof Date) {
              return session.updatedAt.getTime();
            } else if (typeof session.updatedAt === 'number') {
              return session.updatedAt;
            }
            
            // 3. Fall back to lastAccessTime (when chat was last opened/accessed)
            if (session.lastAccessTime?.toDate) {
              return session.lastAccessTime.toDate().getTime();
            } else if (session.lastAccessTime instanceof Date) {
              return session.lastAccessTime.getTime();
            } else if (typeof session.lastAccessTime === 'number') {
              return session.lastAccessTime;
            }
            
            // 4. Fall back to createdAt (when chat was created)
            if (session.createdAt?.toDate) {
              return session.createdAt.toDate().getTime();
            } else if (session.createdAt instanceof Date) {
              return session.createdAt.getTime();
            } else if (typeof session.createdAt === 'number') {
              return session.createdAt;
            }
            
            // 5. If no timestamp exists, use current time so new chats appear at top
            return Date.now();
          };
          
          const timeA = getTimestamp(a);
          const timeB = getTimestamp(b);
          
          return timeB - timeA; // Sort descending (most recent first)
        });
        
        console.log("📊 Sorted chat sessions:", sessionsData.map(s => ({
          id: s.id,
          name: s.userName,
          lastMessageTime: s.lastMessageTime,
          lastAccessTime: s.lastAccessTime,
          createdAt: s.createdAt
        })));
        
        setChatSessions(sessionsData);
        setLoadingChatSessions(false);
      }, (error) => {
        console.error("Error loading chat sessions:", error);
        setLoadingChatSessions(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up chat sessions listener:", error);
      setLoadingChatSessions(false);
    }
  }, []);

  // Real-time listener for unread message counts
  useEffect(() => {
    try {
      const messagesRef = collection(db, "chat_messages");
      const q = query(messagesRef, where("isRead", "==", false));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const counts: Record<string, number> = {};
        
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
            identifiers.forEach((identifier) => {
              counts[identifier] = (counts[identifier] || 0) + 1;
            });
          }
        });
        
        setUnreadCounts(counts);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up unread counts listener:", error);
    }
  }, []);

  // Real-time listener for user online status
  useEffect(() => {
    try {
      const usersRef = collection(db, "users");
      
      const unsubscribe = onSnapshot(usersRef, (snapshot) => {
        const online = new Set<string>();
        const lastSeen: Record<string, Date> = {};
        
        snapshot.docs.forEach(userDoc => {
          const data = userDoc.data();
          const userId = data.firebaseUid || userDoc.id;
          const isOnline = data.isOnline || false;
          const lastSeenTimestamp = data.lastSeen;
          
          if (isOnline) {
            // Check if online status is recent (within last 2 minutes)
            if (lastSeenTimestamp) {
              const lastSeenDate = lastSeenTimestamp?.toDate?.() || new Date(lastSeenTimestamp);
              const now = new Date();
              const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
              
              if (diffMinutes < 2) {
                online.add(userId);
              } else if (lastSeenDate) {
                lastSeen[userId] = lastSeenDate;
              }
            } else {
              online.add(userId);
            }
          } else if (lastSeenTimestamp) {
            const lastSeenDate = lastSeenTimestamp?.toDate?.() || new Date(lastSeenTimestamp);
            lastSeen[userId] = lastSeenDate;
          }
        });
        
        setOnlineUsers(online);
        setUserLastSeen(lastSeen);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up online status listener:", error);
    }
  }, []);

  // Mark messages as read
  const markMessagesAsRead = async (messagesToMark: ChatMessage[]) => {
    try {
      // Check both Firebase Auth and SessionManager for authentication
      const currentUser = auth.currentUser;
      const sessionUser = SessionManager.getCurrentUser();
      const isAuthenticated = currentUser || SessionManager.isAuthenticated();
      
      if (!isAuthenticated) return;

      const sessionUserIds = Array.from(
        new Set(
          [selectedSession?.userId, selectedSession?.id, selectedSession?.firebaseUid, selectedSession?.userID].filter(Boolean)
        )
      );

      if (sessionUserIds.length === 0) return;

      // Filter messages that are from the user (not admin) and not already read
      const unreadMessages = messagesToMark.filter(
        msg => sessionUserIds.includes(msg.senderId) && !msg.isRead
      );

      if (unreadMessages.length === 0) return;

      // Use batch write for better performance
      const batch = writeBatch(db);
      
      unreadMessages.forEach(msg => {
        const msgRef = doc(db, "chat_messages", msg.id);
        batch.update(msgRef, { isRead: true });
      });

      await batch.commit();
      console.log(`✅ Marked ${unreadMessages.length} messages as read`);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Real-time listener for messages when a session is selected
  useEffect(() => {
    const primaryUserId = selectedSession?.userId || selectedSession?.id || selectedSession?.firebaseUid;
    if (!primaryUserId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);

    try {
      const messagesRef = collection(db, "chat_messages");
      const idsToCheck = Array.from(new Set([
        selectedSession?.userId,
        selectedSession?.id,
        selectedSession?.firebaseUid
      ].filter(Boolean)));

      if (idsToCheck.length === 0) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      const querySignatures = new Set<string>();
      const queries: Array<{ query: any, key: string }> = [];

      idsToCheck.forEach((id) => {
        const lowerKey = `userId:${id}`;
        if (!querySignatures.has(lowerKey)) {
          querySignatures.add(lowerKey);
          // Remove orderBy to avoid composite index requirement - we sort client-side anyway
          queries.push({
            query: query(messagesRef, where("userId", "==", id)),
            key: lowerKey
          });
        }

        const upperKey = `userID:${id}`;
        if (!querySignatures.has(upperKey)) {
          querySignatures.add(upperKey);
          // Remove orderBy to avoid composite index requirement - we sort client-side anyway
          queries.push({
            query: query(messagesRef, where("userID", "==", id)),
            key: upperKey
          });
        }
      });

      // Store messages from each query separately, then merge
      const queryStores = new Map<string, Map<string, ChatMessage>>();
      let isMounted = true;

      const getTimestampValue = (msg: ChatMessage): number => {
        if (!msg.timestamp) return 0;

        if (msg.timestamp?.toDate && typeof msg.timestamp.toDate === "function") {
          return msg.timestamp.toDate().getTime();
        } else if (msg.timestamp instanceof Date) {
          return msg.timestamp.getTime();
        } else if (typeof msg.timestamp === "number") {
          return msg.timestamp;
        } else if (typeof msg.timestamp === "string") {
          return new Date(msg.timestamp).getTime();
        }
        return 0;
      };

      const mergeAndUpdateMessages = async () => {
        // Merge all messages from all query stores
        const mergedStore = new Map<string, ChatMessage>();
        queryStores.forEach((store) => {
          store.forEach((msg, docId) => {
            mergedStore.set(docId, msg);
          });
        });

        const mergedMessages = Array.from(mergedStore.values()).sort((a, b) => getTimestampValue(a) - getTimestampValue(b));

        if (!isMounted) return;

        console.log("💬 Aggregated messages:", mergedMessages.map(m => ({
          id: m.id,
          sender: m.senderName,
          timestamp: m.timestamp,
          message: m.message?.substring(0, 30)
        })));

        setMessages(mergedMessages);
        setLoadingMessages(false);

        if (mergedMessages.length > 0) {
          const latestMessage = mergedMessages[mergedMessages.length - 1];
          const chatRef = doc(db, "chats", primaryUserId);

          let previewText = latestMessage.message || latestMessage.content || "Message";
          if (latestMessage.imageUrl && !latestMessage.message && !latestMessage.content) {
            previewText = "📷 Photo";
          } else if (latestMessage.videoUrl && !latestMessage.message && !latestMessage.content) {
            previewText = "🎥 Video";
          } else if (latestMessage.audioUrl && !latestMessage.message && !latestMessage.content) {
            previewText = "🎵 Audio";
          } else if (latestMessage.fileUrl && !latestMessage.message && !latestMessage.content) {
            previewText = `📎 ${latestMessage.fileName || "File"}`;
          }

          try {
            await updateDoc(chatRef, {
              lastMessage: previewText,
              lastMessageTime: latestMessage.timestamp || serverTimestamp(),
              lastMessageSenderName: latestMessage.senderName || "Unknown",
              lastAccessTime: serverTimestamp()
            });
            console.log("✅ Updated chat metadata with latest message from:", latestMessage.senderName);
          } catch (error) {
            console.error("❌ Error updating chat metadata:", error);
          }
        }

        markMessagesAsRead(mergedMessages);

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      };

      const handleSnapshot = async (snapshot, queryKey: string) => {
        console.log(`📥 Snapshot received for query ${queryKey}:`, snapshot.docs.length, "documents");
        
        // Process ALL documents from snapshot (like AdminChatPage) - more reliable than docChanges()
        const queryStore = new Map<string, ChatMessage>();
        snapshot.docs.forEach((docSnap) => {
          const docId = docSnap.id;
          const data = docSnap.data();
          console.log(`📨 Processing message ${docId}:`, {
            userId: data.userId,
            userID: data.userID,
            senderId: data.senderId,
            senderName: data.senderName,
            message: data.message?.substring(0, 30) || data.content?.substring(0, 30),
            timestamp: data.timestamp
          });
          queryStore.set(docId, { id: docId, ...data } as ChatMessage);
        });
        
        // Update the store for this query
        queryStores.set(queryKey, queryStore);
        
        console.log(`💾 Query stores after update:`, Array.from(queryStores.keys()));
        console.log(`📊 Total messages across all queries:`, Array.from(queryStores.values()).reduce((sum, store) => sum + store.size, 0));
        
        // Merge and update messages from all queries
        await mergeAndUpdateMessages();
      };

      console.log(`🔍 Setting up ${queries.length} message listeners for userId: ${primaryUserId}`);
      queries.forEach(({ query: q, key: queryKey }) => {
        console.log(`📡 Creating listener for query: ${queryKey}`);
      });

      const unsubscribers = queries.map(({ query: q, key: queryKey }) => {
        return onSnapshot(q, 
          (snapshot) => {
            console.log(`✅ Snapshot callback fired for ${queryKey}`);
            handleSnapshot(snapshot, queryKey);
          }, 
          (error) => {
            console.error(`❌ Error in listener for ${queryKey}:`, error);
            console.error("Error details:", error.code, error.message);
            setLoadingMessages(false);
          }
        );
      });

      return () => {
        isMounted = false;
        unsubscribers.forEach((unsub) => unsub());
      };
    } catch (error) {
      console.error("❌ Error setting up messages listener:", error);
      setLoadingMessages(false);
    }
  }, [selectedSession?.userId, selectedSession?.id, selectedSession?.firebaseUid]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter users for search results (include all matching users)
  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    return (
        (user.userId && user.userId.toLowerCase().includes(term)) ||
        (user.fullName && user.fullName.toLowerCase().includes(term)) ||
        (user.mobileNumber && user.mobileNumber.toLowerCase().includes(term)) ||
        (user.barangay && user.barangay.toLowerCase().includes(term)) ||
        (user.cityTown && user.cityTown.toLowerCase().includes(term)) ||
        (user.province && user.province.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term))
    );
  });

  // Handler to start a chat with a user (creates a new chat session)
  const handleStartChat = async (user: any) => {
    setStartingChat(user.id);
    try {
      console.log("🚀 Starting chat with user:", user);
      
      // Check if chat already exists in current sessions
      const existingChat = chatSessions.find(cs => cs.userId === user.firebaseUid || cs.id === user.id);
      if (existingChat) {
        console.log("✅ Existing chat found:", existingChat);
        setSelectedSession(existingChat);
        setStartingChat(null);
        return;
      }

      // Determine the userId to use (must be consistent with existing messages)
      const userId = user.firebaseUid || user.id;
      
      // Check if there are existing messages for this user
      // Query both userId and userID fields to catch all messages
      const messagesRef = collection(db, "chat_messages");
      
      // Try userId field first
      let messagesQuery = query(messagesRef, where("userId", "==", userId));
      let messagesSnapshot = await getDocs(messagesQuery);
      
      // Also check userID field (mobile app might use this)
      const messagesQuery2 = query(messagesRef, where("userID", "==", userId));
      const messagesSnapshot2 = await getDocs(messagesQuery2);
      
      // Merge results and deduplicate
      const allMessages = new Map();
      messagesSnapshot.docs.forEach(doc => allMessages.set(doc.id, doc));
      messagesSnapshot2.docs.forEach(doc => allMessages.set(doc.id, doc));
      
      // Sort by timestamp client-side to get the latest message
      const sortedMessages = Array.from(allMessages.values()).sort((a, b) => {
        const getTimestamp = (doc: any) => {
          const ts = doc.data().timestamp;
          if (ts?.toDate) return ts.toDate().getTime();
          if (ts instanceof Date) return ts.getTime();
          if (typeof ts === 'number') return ts;
          return 0;
        };
        return getTimestamp(b) - getTimestamp(a); // Descending order
      });
      
      console.log(`📨 Found ${allMessages.size} existing messages for user ${userId}`);
      
      // Prepare chat metadata with all user information
      // Handle different field names for profile picture
      const profilePictureUrl = user.profilePicture || user.profilePictureUrl || user.profile_picture || user.avatar || "";
      const phoneNumber = user.mobileNumber || user.phoneNumber || user.phone || "";
      
      let chatData: any = {
        userId: userId,
        userName: user.fullName || user.name || "Unknown User",
        userEmail: user.email || "",
        userPhoneNumber: phoneNumber,
        mobileNumber: phoneNumber,
        profilePicture: profilePictureUrl,
        profilePictureUrl: profilePictureUrl,
        lastAccessTime: serverTimestamp(), // Always update access time to bring chat to top
        updatedAt: serverTimestamp() // Track when chat metadata was last updated
      };
      
      // If messages exist, populate with last message info
      if (sortedMessages.length > 0) {
        const lastMessage = sortedMessages[0].data();
        chatData.lastMessage = lastMessage.message || lastMessage.content || "";
        chatData.lastMessageTime = lastMessage.timestamp || serverTimestamp();
        chatData.lastMessageSenderName = lastMessage.senderName || "";
        // Set createdAt if it doesn't exist (for older restored chats)
        // Use merge: true so we don't overwrite existing createdAt
        console.log("📬 Restoring chat with last message:", chatData.lastMessage);
      } else {
        // For brand new chats without any messages
        chatData.createdAt = serverTimestamp();
        chatData.lastMessage = "No messages yet";
        chatData.lastMessageTime = serverTimestamp(); // Set this so new chats appear at top
      }

      // Create/restore chat session in chats collection
      const chatRef = doc(db, "chats", userId);
      await setDoc(chatRef, chatData, { merge: true });

      const newSession = {
        id: userId,
        userId: userId,
        userName: user.fullName || user.name || "Unknown User",
        fullName: user.fullName || user.name || "Unknown User",
        userEmail: user.email || "",
        userPhoneNumber: phoneNumber,
        mobileNumber: phoneNumber,
        profilePicture: profilePictureUrl,
        profilePictureUrl: profilePictureUrl,
        firebaseUid: user.firebaseUid || userId,
        ...chatData,
        ...user
      };
      
      console.log("✅ Session created/restored:", newSession);
      console.log("📱 Phone number stored:", phoneNumber);
      console.log("🖼️ Profile picture stored:", profilePictureUrl);
      
      // Update local chatSessions state immediately so the session appears in the list
      setChatSessions(prev => {
        const exists = prev.find(cs => cs.id === userId || cs.userId === userId);
        if (exists) {
          return prev.map(cs => cs.id === userId || cs.userId === userId ? newSession : cs);
        }
        return [newSession, ...prev];
      });
      
      setSelectedSession(newSession);
      setSearchTerm("");
      if (isMobileView) {
        setShowChatOnMobile(true);
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error("Failed to start chat session");
    } finally {
      setStartingChat(null);
    }
  };

  // Handler to select a chat session
  const handleSelectSession = (session: any) => {
    setSelectedSession(session);
    if (isMobileView) {
      setShowChatOnMobile(true);
    }
  };

  const activeSessions = users.filter(user => user.status === "active");
  const totalUnreadCount = users.reduce((sum, user) => sum + user.unreadCount, 0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPreviews: AttachmentPreview[] = [];
      
      // Process all selected files
      Array.from(files).forEach(file => {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        const isImage = isImageFile(file);
        const isVideo = isVideoFile(file);
        const isAudio = isAudioFile(file);
        
        newPreviews.push({
          file,
          url: previewUrl,
          isImage,
          isVideo,
          isAudio,
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
      });
      
      // Add new previews to existing ones
      setAttachmentPreviews(prev => [...prev, ...newPreviews]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachmentPreviews(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment) {
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter(a => a.id !== id);
    });
  };

  const clearAllAttachments = () => {
    attachmentPreviews.forEach(attachment => {
      URL.revokeObjectURL(attachment.url);
    });
    setAttachmentPreviews([]);
  };

  // Handle message input change
  const handleMessageChange = (value: string) => {
    setMessage(value);
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && attachmentPreviews.length === 0) || !selectedSession || sendingMessage) {
      return;
    }

    // Check authentication - support both Firebase Auth and SessionManager
    const currentUser = auth.currentUser;
    const sessionUser = SessionManager.getCurrentUser();
    const isAuthenticated = currentUser || SessionManager.isAuthenticated();
    
    if (!isAuthenticated) {
      toast.error("You must be logged in to send messages");
      return;
    }

    setSendingMessage(true);
    setUploadingFile(true);
    
    try {
      // All admin messages show as "AcciZard Lucban" for consistent branding
      const adminName = "AcciZard Lucban";
      // Use a consistent admin identifier: Firebase Auth UID if available, otherwise use "admin-{userId}" format
      // This ensures admin messages are always identified correctly and don't conflict with user IDs
      const adminId = currentUser?.uid || (sessionUser ? `admin-${sessionUser.userId || sessionUser.username}` : "admin");

      // Upload all attachments
      const uploadedFiles: Array<{url: string, fileName: string, fileSize: number, fileType: string, isImage: boolean, isVideo: boolean, isAudio: boolean}> = [];
      
      if (attachmentPreviews.length > 0) {
        try {
          for (const attachment of attachmentPreviews) {
          const uploadResult = await uploadSingleFile(
            attachment.file,
            'general',
            selectedSession.userId,
            `chat_attachments/${selectedSession.userId}/${Date.now()}_${attachment.file.name}`
          );
            
            if (uploadResult) {
              uploadedFiles.push({
                url: uploadResult.url,
                fileName: attachment.file.name,
                fileSize: attachment.file.size,
                fileType: attachment.file.type,
                isImage: attachment.isImage,
                isVideo: attachment.isVideo,
                isAudio: attachment.isAudio
              });
            }
          }
        } catch (error) {
          console.error("Error uploading files:", error);
          toast.error("Failed to upload attachments");
          setSendingMessage(false);
          setUploadingFile(false);
          return;
        }
      }

      // Send message with text (if any)
      if (message.trim() || uploadedFiles.length === 0) {
        const messageData: any = {
        userId: selectedSession.userId,
        senderId: adminId,
        senderName: adminName,
          message: message.trim() || "Message",
        timestamp: serverTimestamp(),
        isRead: false
        };

        await addDoc(collection(db, "chat_messages"), messageData);
      }

      // Send each attachment as a separate message
      for (const file of uploadedFiles) {
        let attachmentType = 'file';
        if (file.isImage) attachmentType = 'photo';
        else if (file.isVideo) attachmentType = 'video';
        else if (file.isAudio) attachmentType = 'audio';
        
        const messageData: any = {
          userId: selectedSession.userId,
          senderId: adminId,
          senderName: adminName,
          message: message.trim() || `Sent a ${attachmentType}`,
          timestamp: serverTimestamp(),
          isRead: false,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType
        };

        if (file.isImage) {
          messageData.imageUrl = file.url;
        } else if (file.isVideo) {
          messageData.videoUrl = file.url;
        } else if (file.isAudio) {
          messageData.audioUrl = file.url;
        } else {
          messageData.fileUrl = file.url;
        }

        await addDoc(collection(db, "chat_messages"), messageData);
      }

      // Update or create chat metadata in chats collection
      const chatRef = doc(db, "chats", selectedSession.userId);
      let lastMessagePreview = message.trim();
      
      if (!lastMessagePreview && uploadedFiles.length > 0) {
        const imageCount = uploadedFiles.filter(f => f.isImage).length;
        const videoCount = uploadedFiles.filter(f => f.isVideo).length;
        const audioCount = uploadedFiles.filter(f => f.isAudio).length;
        const fileCount = uploadedFiles.filter(f => !f.isImage && !f.isVideo && !f.isAudio).length;
        
        const parts: string[] = [];
        if (imageCount > 0) parts.push(`📷 ${imageCount} photo${imageCount > 1 ? 's' : ''}`);
        if (videoCount > 0) parts.push(`🎥 ${videoCount} video${videoCount > 1 ? 's' : ''}`);
        if (audioCount > 0) parts.push(`🎵 ${audioCount} audio${audioCount > 1 ? 's' : ''}`);
        if (fileCount > 0) parts.push(`📎 ${fileCount} file${fileCount > 1 ? 's' : ''}`);
        
        lastMessagePreview = parts.join(', ');
      }
      
      await setDoc(chatRef, {
        userId: selectedSession.userId,
        userName: selectedSession.fullName || selectedSession.userName || "Unknown User",
        userEmail: selectedSession.userEmail || selectedSession.email || "",
        lastMessage: lastMessagePreview || "Message",
        lastMessageTime: serverTimestamp(),
        lastMessageSenderName: adminName,
        lastAccessTime: serverTimestamp()
      }, { merge: true });

      setMessage("");
      clearAllAttachments();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
      setUploadingFile(false);
    }
  };

  // Get matching message IDs for search navigation
  const searchMatchingMessages = messageSearchQuery.trim() 
    ? messages.filter(msg => {
        const messageText = msg.message || (msg as any).text || (msg as any).content || (msg as any).body || '';
        const fileName = msg.fileName || '';
        const senderName = msg.senderName || '';
        
        return messageText.toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
               fileName.toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
               senderName.toLowerCase().includes(messageSearchQuery.toLowerCase());
      })
    : [];

  // Reset search index when search query changes or messages update
  useEffect(() => {
    if (messageSearchQuery.trim() && searchMatchingMessages.length > 0) {
      setCurrentSearchIndex(0);
      // Scroll to first match
      setTimeout(() => {
        scrollToMessage(searchMatchingMessages[0].id);
      }, 100);
    }
  }, [messageSearchQuery, messages.length]);

  // Navigate to next search result
  const goToNextSearchResult = () => {
    if (searchMatchingMessages.length === 0) return;
    
    const nextIndex = (currentSearchIndex + 1) % searchMatchingMessages.length;
    setCurrentSearchIndex(nextIndex);
    scrollToMessage(searchMatchingMessages[nextIndex].id);
  };

  // Navigate to previous search result
  const goToPreviousSearchResult = () => {
    if (searchMatchingMessages.length === 0) return;
    
    const prevIndex = currentSearchIndex === 0 
      ? searchMatchingMessages.length - 1 
      : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    scrollToMessage(searchMatchingMessages[prevIndex].id);
  };

  // Scroll to specific message
  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Helper to highlight search query in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? `<mark class="bg-yellow-200 text-gray-900">${part}</mark>`
        : part
    ).join('');
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Active now";
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    if (diffMins < 1440) return `Active ${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `Active ${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  // Helper to go to ManageUsersPage.tsx > Residents tab with search
  const goToResidentProfile = (user) => {
    const searchValue = `${user.fullName || user.name || ''}`.trim();
    navigate("/manage-users", { state: { tab: "residents", search: searchValue } });
  };

  // Handler to delete chat session and all related data
  const handleDeleteChat = async () => {
    if (!chatToDelete) return;
    setDeletingChat(true);
    try {
      const targetUserId = chatToDelete.userId || chatToDelete.id;

      const messagesRef = collection(db, "chat_messages");
      const messagesQuery = query(messagesRef, where("userId", "==", targetUserId));
      const messagesSnapshot = await getDocs(messagesQuery);

      const storage = getStorage();

      await Promise.all(
        messagesSnapshot.docs.map(async msgDoc => {
          const data = msgDoc.data();
          const attachmentUrls = [data.imageUrl, data.videoUrl, data.audioUrl, data.fileUrl].filter(Boolean);

          await Promise.all(
            attachmentUrls.map(async (url: string) => {
              try {
                const fileRef = ref(storage, url);
                await deleteObject(fileRef);
              } catch (error) {
                console.error("Error deleting attachment from storage:", error);
              }
            })
          );
        })
      );

      if (!messagesSnapshot.empty) {
        const batch = writeBatch(db);
        messagesSnapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }

      await deleteDoc(doc(db, "chats", chatToDelete.id));

      console.log(`✅ Permanently deleted chat session and messages: ${chatToDelete.id}`);

      setChatSessions(prev => prev.filter(cs => cs.id !== chatToDelete.id));
      if (selectedSession?.id === chatToDelete.id) {
        setSelectedSession(null);
      }

      toast.success("Chat session permanently deleted");
    } catch (error) {
      console.error("Error deleting chat session:", error);
      toast.error("Failed to delete chat session");
    } finally {
      setShowDeleteDialog(false);
      setChatToDelete(null);
      setDeletingChat(false);
    }
  };

  return (
    <Layout>
      <div className="-m-6 -mb-6 flex flex-col h-[calc(100%+3rem)] overflow-hidden">
        <div className={`grid grid-cols-1 gap-0 ${isMobileView ? "" : "lg:grid-cols-[360px_minmax(0,1fr)]"} flex-1 overflow-hidden`}>
          {/* Chat Sessions List */}
          {(!isMobileView || !showChatOnMobile) && (
            <Card className="border border-gray-200 shadow-none flex flex-col overflow-hidden">
              <CardHeader className="border-b bg-white flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle>Chat Sessions</CardTitle>
                    {totalUnreadSessions > 0 && (
                      <>
                        <Badge className="bg-brand-orange hover:bg-brand-orange-400 text-white text-xs px-2 py-0 h-5">
                          {totalUnreadSessions}
                        </Badge>
                        <div className="h-2 w-2 bg-brand-orange rounded-full"></div>
                      </>
                    )}
                  </div>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 w-full border-gray-200"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-y-auto min-h-0" style={{ overscrollBehavior: 'contain' }}>
                {/* Conditional rendering: Show search results OR chat sessions, not both */}
                {searchTerm ? (
                  // Search Results (shown when searching)
                  <div className="space-y-0">
                    {loadingUsers ? (
                      <div className="p-8 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                        <p className="text-sm text-gray-500">Loading users...</p>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No users found.</div>
                    ) : (
                      filteredUsers.map(user => {
                        // Check if this user already has an active chat session
                        const existingChatSession = chatSessions.find(cs => 
                          cs.userId === user.firebaseUid || cs.userId === user.id || cs.id === user.id
                        );
                        
                        return (
                        <div
                          key={user.id}
                            className={`p-4 border-b flex items-center justify-between ${
                              existingChatSession ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
                            }`}
                            onClick={() => {
                              if (existingChatSession) {
                                handleSelectSession(existingChatSession);
                                setSearchTerm(''); // Clear search to show chat list
                              }
                            }}
                        >
                          <div className="flex items-center gap-2">
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">{user.fullName || user.name || user.userId}</span>
                                  {existingChatSession && (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                                      Active Chat
                                    </Badge>
                                  )}
                              </div>
                                <p className="text-xs text-gray-500 mt-1">{user.mobileNumber || 'No phone number'}</p>
                            </div>
                          </div>
                            {!existingChatSession && (
                          <Button 
                            size="sm" 
                            className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-50" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartChat(user);
                                }}
                            disabled={startingChat === user.id}
                          >
                            {startingChat === user.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Starting...
                              </>
                            ) : (
                              'Start Chat'
                            )}
                          </Button>
                            )}
                        </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  // Chat Sessions (shown when not searching)
                  <div className="space-y-0">
                    {loadingChatSessions ? (
                      <div className="p-8 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                        <p className="text-sm text-gray-500">Loading chat sessions...</p>
                      </div>
                    ) : chatSessions.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No active chat sessions.</div>
                    ) : (
                      chatSessions.map(user => {
                        const unreadCount = getUnreadCountForSession(user);
                        const hasUnread = unreadCount > 0;
                        return (
                        <div
                          key={user.id}
                          className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedSession?.id === user.id
                              ? 'bg-orange-50 border-l-4 border-l-brand-orange'
                              : hasUnread
                                ? 'bg-orange-50/40'
                                : ''
                          }`}
                          onClick={() => handleSelectSession(user)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center min-w-0 gap-2">
                              <button
                                type="button"
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  goToResidentProfile(user); 
                                }}
                                className="focus:outline-none relative"
                                title="View Resident Profile"
                              >
                                {user.profilePicture ? (
                                  <img 
                                    src={user.profilePicture} 
                                    alt="Profile" 
                                    className="h-8 w-8 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (fallback) {
                                        fallback.style.display = 'flex';
                                      }
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className={`h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center ${user.profilePicture ? 'hidden' : ''}`}
                                >
                                  <User className="h-4 w-4 text-gray-400" />
                                </div>
                                {/* Online status indicator */}
                                {onlineUsers.has(user.userId) && (
                                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className={`font-medium text-sm truncate ${hasUnread ? 'text-gray-900' : ''}`}>
                                    {user.fullName || user.userName || user.name || user.userId}
                                  </span>
                                  {/* Unread count badge */}
                                  {hasUnread && (
                                    <Badge className="bg-brand-orange hover:bg-brand-orange-400 text-white text-xs px-2 py-0 h-5">
                                      {unreadCount}
                                    </Badge>
                                  )}
                                </div>
                                {user.lastMessage && (
                                  <p className="text-xs text-gray-600 mt-1 truncate font-medium">
                                    {user.lastMessageSenderName ? `${user.lastMessageSenderName}: ` : ''}{user.lastMessage}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-gray-400 truncate">{user.userPhoneNumber || user.mobileNumber || user.phoneNumber || 'No phone number'}</p>
                                  {onlineUsers.has(user.userId) ? (
                                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                      Online
                                    </span>
                                  ) : userLastSeen[user.userId] && (
                                    <span className="text-xs text-gray-400">
                                      {formatLastSeen(userLastSeen[user.userId])}
                                    </span>
                                  )}
                                </div>
                                {user.lastMessageTime && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    {formatTime(
                                      user.lastMessageTime?.toDate?.() || 
                                      (user.lastMessageTime instanceof Date ? user.lastMessageTime : new Date(user.lastMessageTime))
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="border-gray-300 hover:bg-red-50 hover:border-red-300" 
                              onClick={e => { 
                                e.stopPropagation(); 
                                setChatToDelete(user);
                                setShowDeleteDialog(true);
                              }} 
                              title="Delete Chat Session"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chat Window */}
          {(!isMobileView || showChatOnMobile) && (
            <Card className="flex flex-col border border-gray-200 shadow-none overflow-hidden">
              {selectedSession ? (
                <>
                  <CardHeader className="border-b bg-white flex-shrink-0">
                    {/* User Info Section */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {isMobileView && showChatOnMobile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleMobileBack}
                            className="h-9 w-9 text-gray-600 hover:text-brand-orange hover:bg-orange-50"
                          >
                            <ArrowLeft className="h-5 w-5" />
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => goToResidentProfile(selectedSession)}
                          className="focus:outline-none relative"
                          title="View Resident Profile"
                        >
                          {selectedSession.profilePicture ? (
                            <img 
                              src={selectedSession.profilePicture} 
                              alt={selectedSession.fullName || selectedSession.name || selectedSession.userId} 
                              className="h-10 w-10 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div 
                            className={`h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center ${selectedSession.profilePicture ? 'hidden' : ''}`}
                          >
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                          {onlineUsers.has(selectedSession.userId) && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{selectedSession.fullName || selectedSession.name || selectedSession.userId}</CardTitle>
                            {onlineUsers.has(selectedSession.userId) && (
                              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Online
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500">{selectedSession.userPhoneNumber || selectedSession.mobileNumber || selectedSession.phoneNumber || 'No phone number'}</p>
                            {!onlineUsers.has(selectedSession.userId) && userLastSeen[selectedSession.userId] && (
                              <span className="text-xs text-gray-400">
                                • {formatLastSeen(userLastSeen[selectedSession.userId])}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Message Search */}
                      <div className="flex items-center gap-2">
                        <div className="relative w-64">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Search messages..."
                            value={messageSearchQuery}
                            onChange={(e) => {
                              setMessageSearchQuery(e.target.value);
                              setShowSearchResults(e.target.value.trim().length > 0);
                            }}
                            className="pl-10 w-full border-gray-200"
                          />
                          {messageSearchQuery && (
                            <button
                              onClick={() => {
                                setMessageSearchQuery("");
                                setShowSearchResults(false);
                                setCurrentSearchIndex(0);
                              }}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {showSearchResults && searchMatchingMessages.length > 0 && (
                          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                            <span className="text-xs text-gray-600 px-2">
                              {currentSearchIndex + 1} / {searchMatchingMessages.length}
                            </span>
                            <button
                              onClick={goToPreviousSearchResult}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Previous result"
                            >
                              <ChevronUp className="h-4 w-4 text-gray-600" />
                            </button>
                            <button
                              onClick={goToNextSearchResult}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Next result"
                            >
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Search results count */}
                    {showSearchResults && (
                      <div className="pt-3 border-t">
                        <p className="text-sm text-gray-600">
                          {searchMatchingMessages.length === 0 ? (
                            "No messages found"
                          ) : (
                            `Found ${searchMatchingMessages.length} message${searchMatchingMessages.length !== 1 ? 's' : ''}`
                          )}
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0 relative">
                    {/* Support Banner as Faded Background */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none opacity-5 z-0">
                      <img src="/accizard-uploads/accizard-logo-svg.svg" alt="Accizard Logo" className="w-32 h-32" />
                      <img src="/accizard-uploads/accizard-logotype-svg.svg" alt="Accizard Logotype" className="w-64 h-auto" />
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-4 min-h-0 relative z-0" style={{ overscrollBehavior: 'contain' }}>
                      {loadingMessages ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                          <p className="text-sm text-gray-500">Loading messages...</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">No messages yet. Start the conversation!</div>
                      ) : (
                        messages.map((msg) => {
                          // Check if message is from admin by comparing senderId with user IDs
                          // User messages: senderId matches userId/id/firebaseUid of selected session
                          // Admin messages: senderId is different (admin's uid) or starts with "admin-"
                          const userIds = [
                            selectedSession?.userId,
                            selectedSession?.id,
                            selectedSession?.firebaseUid
                          ].filter(Boolean);
                          
                          // Message is from admin if:
                          // 1. senderId doesn't match any user ID, OR
                          // 2. senderId starts with "admin-", OR
                          // 3. senderName is "AcciZard Lucban" (admin branding)
                          const isAdmin = !userIds.includes(msg.senderId) || 
                                         (typeof msg.senderId === 'string' && msg.senderId.startsWith('admin-')) ||
                                         msg.senderName === "AcciZard Lucban";
                          
                          // Check if this message matches the search query
                          const isSearchMatch = searchMatchingMessages.some(m => m.id === msg.id);
                          
                          // Handle different timestamp formats
                          let messageTime: Date;
                          if (msg.timestamp?.toDate && typeof msg.timestamp.toDate === 'function') {
                            // Firestore Timestamp
                            messageTime = msg.timestamp.toDate();
                          } else if (msg.timestamp instanceof Date) {
                            // Already a Date object
                            messageTime = msg.timestamp;
                          } else if (typeof msg.timestamp === 'number') {
                            // Unix timestamp (milliseconds)
                            messageTime = new Date(msg.timestamp);
                          } else if (typeof msg.timestamp === 'string') {
                            // ISO string
                            messageTime = new Date(msg.timestamp);
                          } else {
                            // Fallback: use a very old date to indicate missing timestamp
                            messageTime = new Date(0);
                          }
                          
                          return (
                            <div
                              key={msg.id}
                              ref={(el) => {
                                messageRefs.current[msg.id] = el;
                              }}
                              className={`flex gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                            >
                              {/* User profile picture (for all non-admin messages) */}
                              {!isAdmin && (
                                <div className="flex-shrink-0">
                                  {selectedSession.profilePicture ? (
                                    <img 
                                      src={selectedSession.profilePicture} 
                                      alt={msg.senderName || 'User'} 
                                      className="h-8 w-8 rounded-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) {
                                          fallback.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div 
                                    className={`h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center ${selectedSession.profilePicture ? 'hidden' : ''}`}
                                  >
                                    <User className="h-4 w-4 text-gray-400" />
                                  </div>
                                </div>
                              )}
                              
                              <div className={`flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'} max-w-[70%]`}>
                                {/* Image attachment - just the image, no background */}
                                {msg.imageUrl && (
                                  <div className="relative group">
                                    <img 
                                      src={msg.imageUrl} 
                                      alt="Attachment" 
                                      className="max-w-full rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                      style={{ maxHeight: '300px', objectFit: 'contain' }}
                                      onClick={() => setImagePreviewUrl(msg.imageUrl || null)}
                                    />
                                    {/* Timestamp overlay on hover */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                      {messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {/* Read receipt for admin messages */}
                                      {isAdmin && (
                                        <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                          {msg.isRead ? (
                                            <CheckCheck className="h-3 w-3 inline" />
                                          ) : (
                                            <Check className="h-3 w-3 inline" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Video attachment - just the video player */}
                                {msg.videoUrl && (
                                  <div className="relative group">
                                    <video 
                                      controls 
                                      className="max-w-full rounded-lg"
                                      style={{ maxHeight: '300px' }}
                                    >
                                      <source src={msg.videoUrl} type={msg.fileType || 'video/mp4'} />
                                      Your browser does not support the video tag.
                                    </video>
                                    {/* Timestamp overlay on hover */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
                                      {messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {/* Read receipt for admin messages */}
                                      {isAdmin && (
                                        <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                          {msg.isRead ? (
                                            <CheckCheck className="h-3 w-3 inline" />
                                          ) : (
                                            <Check className="h-3 w-3 inline" />
                                          )}
                                      </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Audio attachment - just the audio player */}
                                {msg.audioUrl && (
                                  <div className="relative group">
                                    <audio 
                                      controls 
                                      className="max-w-full rounded-lg"
                                    >
                                      <source src={msg.audioUrl} type={msg.fileType || 'audio/mpeg'} />
                                      Your browser does not support the audio tag.
                                    </audio>
                                    {/* Timestamp overlay on hover */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
                                      {messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {/* Read receipt for admin messages */}
                                      {isAdmin && (
                                        <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                          {msg.isRead ? (
                                            <CheckCheck className="h-3 w-3 inline" />
                                          ) : (
                                            <Check className="h-3 w-3 inline" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* File attachment - just the file card, no background bubble */}
                                    {msg.fileUrl && (
                                  <div className="relative group">
                                      <a 
                                        href={msg.fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                                      >
                                      <File className="h-5 w-5 text-gray-600" />
                                        <div className="flex-1 min-w-0">
                                        {messageSearchQuery.trim() ? (
                                          <p 
                                            className="text-sm font-medium truncate text-gray-900"
                                            dangerouslySetInnerHTML={{ 
                                              __html: highlightText(msg.fileName || 'File', messageSearchQuery)
                                            }}
                                          />
                                        ) : (
                                          <p className="text-sm font-medium truncate text-gray-900">
                                            {msg.fileName || 'File'}
                                          </p>
                                        )}
                                          {msg.fileSize && (
                                          <p className="text-xs text-gray-500">
                                              {formatFileSize(msg.fileSize)}
                                            </p>
                                          )}
                                        </div>
                                      <Download className="h-4 w-4 text-gray-600" />
                                    </a>
                                    {/* Timestamp overlay on hover */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
                                      {messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {/* Read receipt for admin messages */}
                                      {isAdmin && (
                                        <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                          {msg.isRead ? (
                                            <CheckCheck className="h-3 w-3 inline" />
                                          ) : (
                                            <Check className="h-3 w-3 inline" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Text message bubble (only if there's actual text and no file attachment) */}
                                {!msg.fileUrl && (msg.message || (msg as any).text || (msg as any).content || (msg as any).body) && (
                                  <div className="relative group">
                                    <div
                                      className={`rounded-lg px-4 py-2 ${
                                        isAdmin
                                          ? 'bg-brand-orange text-white rounded-br-none'
                                          : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                                      }`}
                                    >
                                      {/* Show sender name for non-admin messages (residents) */}
                                      {!isAdmin && (
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-semibold text-gray-600">
                                            {msg.senderName || (msg as any).sender || (msg as any).from || 'Unknown'}
                                          </span>
                                        </div>
                                      )}
                                      {/* Text message */}
                                      {messageSearchQuery.trim() ? (
                                        <p 
                                          className="text-sm whitespace-pre-wrap break-words"
                                          dangerouslySetInnerHTML={{ 
                                            __html: highlightText(
                                              msg.message || (msg as any).text || (msg as any).content || (msg as any).body || '', 
                                              messageSearchQuery
                                            )
                                          }}
                                        />
                                      ) : (
                                        <p className="text-sm whitespace-pre-wrap break-words">
                                          {msg.message || (msg as any).text || (msg as any).content || (msg as any).body || ''}
                                        </p>
                                      )}
                                    </div>
                                    {/* Timestamp on hover */}
                                    <div className={`absolute ${isAdmin ? 'right-0' : 'left-0'} -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap`}>
                                      {messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {/* Read receipt indicator (only for admin messages) */}
                                      {isAdmin && (
                                        <span title={msg.isRead ? 'Read' : 'Delivered'}>
                                          {msg.isRead ? (
                                            <CheckCheck className="h-3 w-3 inline" />
                                          ) : (
                                            <Check className="h-3 w-3 inline" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </CardContent>
                  <div className="border-t p-4 bg-white flex-shrink-0">
                    {/* Attachment Previews */}
                    {attachmentPreviews.length > 0 && (
                      <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
                        {attachmentPreviews.map((attachment) => (
                          <div key={attachment.id} className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              {attachment.isImage ? (
                                <img 
                                  src={attachment.url} 
                                  alt="Preview" 
                                  className="w-12 h-12 object-cover rounded"
                                />
                              ) : attachment.isVideo ? (
                                <div className="w-12 h-12 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                                  <Video className="h-6 w-6 text-purple-600" />
                                </div>
                              ) : attachment.isAudio ? (
                                <div className="w-12 h-12 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
                                  <Music className="h-6 w-6 text-orange-600" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                  <File className="h-6 w-6 text-gray-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {attachment.file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(attachment.file.size)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                onClick={() => removeAttachment(attachment.id)}
                                disabled={uploadingFile}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {uploadingFile && (
                          <div className="flex items-center gap-2 text-brand-orange p-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm font-medium">Uploading {attachmentPreviews.length} file{attachmentPreviews.length > 1 ? 's' : ''}...</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Input
                          placeholder="Type your message..."
                          value={message}
                          onChange={(e) => handleMessageChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !uploadingFile) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={uploadingFile}
                          className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx"
                          multiple
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-gray-500 hover:text-brand-orange hover:bg-orange-50 transition-colors"
                              disabled={uploadingFile}
                            >
                              <Paperclip className="h-5 w-5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="end" side="top">
                            <div className="space-y-1">
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Attach Files
                              </div>
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-10 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                onClick={() => {
                                  if (fileInputRef.current) {
                                    fileInputRef.current.accept = "image/*";
                                    fileInputRef.current.click();
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="bg-blue-100 p-1.5 rounded">
                                    <ImageIcon className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium text-sm">Photos</span>
                                    <span className="text-xs text-gray-500">JPEG, PNG, GIF, WEBP</span>
                                  </div>
                                </div>
                              </Button>
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-10 hover:bg-green-50 hover:text-green-700 transition-colors"
                                onClick={() => {
                                  if (fileInputRef.current) {
                                    fileInputRef.current.accept = "application/pdf,.doc,.docx";
                                    fileInputRef.current.click();
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="bg-green-100 p-1.5 rounded">
                                    <FileText className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium text-sm">Documents</span>
                                    <span className="text-xs text-gray-500">PDF, DOC, DOCX</span>
                                  </div>
                                </div>
                              </Button>
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-10 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                                onClick={() => {
                                  if (fileInputRef.current) {
                                    fileInputRef.current.accept = "video/*";
                                    fileInputRef.current.click();
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="bg-purple-100 p-1.5 rounded">
                                    <Video className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium text-sm">Videos</span>
                                    <span className="text-xs text-gray-500">MP4, AVI, MOV, WMV</span>
                                  </div>
                                </div>
                              </Button>
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-10 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                                onClick={() => {
                                  if (fileInputRef.current) {
                                    fileInputRef.current.accept = "audio/*";
                                    fileInputRef.current.click();
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="bg-orange-100 p-1.5 rounded">
                                    <Music className="h-4 w-4 text-orange-600" />
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium text-sm">Audio</span>
                                    <span className="text-xs text-gray-500">MP3, WAV, OGG, M4A</span>
                                  </div>
                                </div>
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || uploadingFile || (!message.trim() && attachmentPreviews.length === 0)}
                        className="bg-brand-orange hover:bg-brand-orange-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingMessage || uploadingFile ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-brand-orange" />
                    <p className="text-lg font-medium">Select a chat session</p>
                    <p className="text-sm">Choose a conversation from the list to start chatting</p>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Delete Chat Session Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Chat Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the chat session with {chatToDelete?.fullName || chatToDelete?.userName || chatToDelete?.userId}? 
              <br /><br />
              <strong>This will permanently:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove this chat from the admin chat list</li>
                <li>Delete all associated messages from Firestore</li>
                <li>Delete any files, photos, videos, or audio stored in Firebase Storage</li>
                <li>Prevent recovery of the conversation history</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingChat}
            >
              {deletingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Modal */}
      <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => !open && setImagePreviewUrl(null)}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-none overflow-hidden" hideOverlay={false}>
          <div className="relative w-full h-[90vh] flex items-center justify-center p-4">
            {imagePreviewUrl && (
              <img 
                src={imagePreviewUrl} 
                alt="Image Preview" 
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}