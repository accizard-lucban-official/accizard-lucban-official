import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Send, Loader2, User, Check, CheckCheck, Paperclip, X, Image as ImageIcon, FileText, Video, Music, File, Download, Trash2 } from "lucide-react";
import { Layout } from "./Layout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, writeBatch, getDocs } from "firebase/firestore";
import { toast } from "@/components/ui/sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import { formatFileSize, isImageFile, isVideoFile, isAudioFile } from "@/lib/storage";
import { useUserRole } from "@/hooks/useUserRole";
import { getStorage, ref, deleteObject, listAll } from "firebase/storage";

interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  timestamp: any;
  isRead?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  profilePictureUrl?: string;
}

interface AttachmentPreview {
  file: File;
  url: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  id: string;
}

export function AdminChatPage() {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { uploadSingleFile } = useFileUpload();
  const { userRole } = useUserRole();
  const isSuperAdmin = userRole?.userType === "superadmin";
  
  const currentUser = auth.currentUser;

  // Note: All web app users can access admin chat (they are all administrators)
  // No access control needed as only authenticated users can reach this route

  // Real-time listener for admin group chat messages
  useEffect(() => {
    setLoadingMessages(true);
    
    try {
      const messagesRef = collection(db, "admin_chat_messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log("📨 Admin chat - Raw snapshot data:", snapshot.docs.length, "messages");
        
        const messagesData = snapshot.docs.map(msgDoc => ({
          id: msgDoc.id,
          ...msgDoc.data()
        })) as ChatMessage[];
        
        // CLIENT-SIDE SORTING: Ensure messages are properly sorted by timestamp
        messagesData.sort((a, b) => {
          const getTimestamp = (msg: ChatMessage): number => {
            if (!msg.timestamp) return 0;
            
            if (msg.timestamp?.toDate && typeof msg.timestamp.toDate === 'function') {
              return msg.timestamp.toDate().getTime();
            } else if (msg.timestamp instanceof Date) {
              return msg.timestamp.getTime();
            } else if (typeof msg.timestamp === 'number') {
              return msg.timestamp;
            } else if (typeof msg.timestamp === 'string') {
              return new Date(msg.timestamp).getTime();
            }
            return 0;
          };
          
          const timeA = getTimestamp(a);
          const timeB = getTimestamp(b);
          
          return timeA - timeB; // Sort ascending (oldest first)
        });
        
        console.log("💬 Admin chat - Sorted messages:", messagesData.length);
        setMessages(messagesData);
        setLoadingMessages(false);
        
        // Mark messages as read
        markMessagesAsRead(messagesData);
        
        // Scroll to bottom after messages load
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }, (error) => {
        console.error("Error loading admin chat messages:", error);
        setLoadingMessages(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("❌ Error setting up admin chat listener:", error);
      setLoadingMessages(false);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read (from other admins)
  const markMessagesAsRead = async (messagesToMark: ChatMessage[]) => {
    try {
      if (!currentUser) return;

      // Filter messages that are from other admins and not already read
      const unreadMessages = messagesToMark.filter(
        msg => msg.senderId !== currentUser.uid && !msg.isRead
      );

      if (unreadMessages.length === 0) return;

      // Use batch write for better performance
      const batch = writeBatch(db);
      
      unreadMessages.forEach(msg => {
        const msgRef = doc(db, "admin_chat_messages", msg.id);
        batch.update(msgRef, { isRead: true });
      });

      await batch.commit();
      console.log(`✅ Marked ${unreadMessages.length} admin messages as read`);
    } catch (error) {
      console.error("Error marking admin messages as read:", error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPreviews: AttachmentPreview[] = [];
      
      Array.from(files).forEach(file => {
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
      
      setAttachmentPreviews(prev => [...prev, ...newPreviews]);
      
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

  const handleSendMessage = async () => {
    if ((!message.trim() && attachmentPreviews.length === 0) || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setUploadingFile(true);
    
    try {
      if (!currentUser) {
        toast.error("You must be logged in to send messages");
        return;
      }

      const adminName =
        (userRole?.name && userRole.name.trim().length > 0 ? userRole.name : null) ||
        currentUser.displayName ||
        currentUser.email ||
        "Admin";
      const adminId = currentUser.uid;
      const senderRole =
        userRole?.position ||
        (userRole?.userType === "superadmin"
          ? "Super Admin"
          : userRole?.userType === "admin"
            ? "Admin"
            : "Administrator");

      // Upload all attachments
      const uploadedFiles: Array<{url: string, fileName: string, fileSize: number, fileType: string, isImage: boolean, isVideo: boolean, isAudio: boolean}> = [];
      
      if (attachmentPreviews.length > 0) {
        try {
          for (const attachment of attachmentPreviews) {
            const uploadResult = await uploadSingleFile(
              attachment.file,
              'general',
              'admin_chat',
              `admin_chat/${Date.now()}_${attachment.file.name}`
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
          senderId: adminId,
          senderName: adminName,
          senderRole,
          message: message.trim() || "Message",
          timestamp: serverTimestamp(),
          isRead: false,
          profilePictureUrl: userRole?.profilePicture || currentUser.photoURL || ""
        };

        await addDoc(collection(db, "admin_chat_messages"), messageData);
      }

      // Send each attachment as a separate message
      for (const file of uploadedFiles) {
        let attachmentType = 'file';
        if (file.isImage) attachmentType = 'photo';
        else if (file.isVideo) attachmentType = 'video';
        else if (file.isAudio) attachmentType = 'audio';
        
        const messageData: any = {
          senderId: adminId,
          senderName: adminName,
          senderRole,
          message: message.trim() || `Sent a ${attachmentType}`,
          timestamp: serverTimestamp(),
          isRead: false,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType,
          profilePictureUrl: userRole?.profilePicture || currentUser.photoURL || ""
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

        await addDoc(collection(db, "admin_chat_messages"), messageData);
      }

      setMessage("");
      clearAllAttachments();
      toast.success("Message sent");
    } catch (error) {
      console.error("Error sending admin message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
      setUploadingFile(false);
    }
  };

  const handleClearAdminChat = async () => {
    if (!isSuperAdmin) {
      toast.error("Only super admins can clear the admin chat.");
      return;
    }
    if (clearingChat) return;

    setClearingChat(true);
    try {
      const messagesRef = collection(db, "admin_chat_messages");
      const snapshot = await getDocs(messagesRef);
      const storage = getStorage();

      const attachmentUrls = new Set<string>();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as Partial<ChatMessage>;
        [data.imageUrl, data.videoUrl, data.audioUrl, data.fileUrl].forEach((url) => {
          if (typeof url === "string" && url.trim().length > 0) {
            attachmentUrls.add(url);
          }
        });
      });

      await Promise.all(
        Array.from(attachmentUrls).map(async (url) => {
          try {
            const fileRef = ref(storage, url);
            await deleteObject(fileRef);
          } catch (error) {
            console.error("Error deleting admin chat attachment:", error);
          }
        })
      );

      try {
        const folderRef = ref(storage, "admin_chat");
        const listResult = await listAll(folderRef);
        await Promise.all(
          listResult.items.map(async (itemRef) => {
            try {
              await deleteObject(itemRef);
            } catch (error) {
              console.error("Error deleting file from admin_chat folder:", error);
            }
          })
        );
      } catch (error) {
        console.warn("Admin chat storage cleanup skipped:", error);
      }

      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }

      toast.success("Admin group chat cleared.");
    } catch (error) {
      console.error("Error clearing admin chat:", error);
      toast.error("Failed to clear admin chat.");
    } finally {
      setClearingChat(false);
      setShowClearDialog(false);
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "";
    
    let date: Date;
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return "";
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout>
      <div className="-m-6 -mb-6 flex flex-col flex-1 min-h-0 min-h-[calc(100vh-8rem)]">
        <Card className="flex-1 min-h-0 flex flex-col border border-gray-200 shadow-none overflow-hidden">

          <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0">
            <div className="flex flex-col items-center justify-center gap-6 w-full px-6 pt-6 pb-4 border-b border-gray-100 bg-white flex-shrink-0">
              <img src="/accizard-uploads/accizard-logo-svg.svg" alt="AcciZard Logo" className="w-32 h-32 mx-auto" />
              <img src="/accizard-uploads/accizard-logotype-svg.svg" alt="AcciZard Logotype" className="w-64 h-auto mx-auto" />
              <div className="text-center mt-2">
                <div className="text-gray-500 text-sm font-medium mb-2">Administrator Communication Channel</div>
                <div className="text-gray-500 text-sm">For internal coordination and updates</div>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 pb-28 space-y-4 overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {loadingMessages ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                  <p className="text-sm text-gray-500">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-4">No messages yet. Start the conversation!</div>
              ) : (
                messages.map((msg) => {
                  const isCurrentUser = msg.senderId === currentUser?.uid;
                  const messageTime = formatTime(msg.timestamp);
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Admin profile picture (only for other admins' messages without attachments) */}
                      {!isCurrentUser && !msg.imageUrl && !msg.videoUrl && !msg.audioUrl && !msg.fileUrl && (
                        <div className="flex-shrink-0">
                          {msg.profilePictureUrl ? (
                            <img
                              src={msg.profilePictureUrl}
                              alt={msg.senderName || "Admin"}
                              className="h-8 w-8 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                              <User className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className={`flex flex-col gap-1 ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        {/* Image attachment */}
                        {msg.imageUrl && (
                          <div className="relative group">
                            <img 
                              src={msg.imageUrl} 
                              alt="Attachment" 
                              className="max-w-full rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                              style={{ maxHeight: '300px', objectFit: 'contain' }}
                              onClick={() => window.open(msg.imageUrl, '_blank')}
                            />
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                              {messageTime}
                              {isCurrentUser && (
                                <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                  {msg.isRead ? <CheckCheck className="h-3 w-3 inline" /> : <Check className="h-3 w-3 inline" />}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Video attachment */}
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
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
                              {messageTime}
                              {isCurrentUser && (
                                <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                  {msg.isRead ? <CheckCheck className="h-3 w-3 inline" /> : <Check className="h-3 w-3 inline" />}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Audio attachment */}
                        {msg.audioUrl && (
                          <div className="relative group">
                            <audio 
                              controls 
                              className="max-w-full rounded-lg"
                            >
                              <source src={msg.audioUrl} type={msg.fileType || 'audio/mpeg'} />
                              Your browser does not support the audio tag.
                            </audio>
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
                              {messageTime}
                              {isCurrentUser && (
                                <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                  {msg.isRead ? <CheckCheck className="h-3 w-3 inline" /> : <Check className="h-3 w-3 inline" />}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* File attachment */}
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
                                <p className="text-sm font-medium truncate text-gray-900">{msg.fileName || 'File'}</p>
                                {msg.fileSize && <p className="text-xs text-gray-500">{formatFileSize(msg.fileSize)}</p>}
                              </div>
                              <Download className="h-4 w-4 text-gray-600" />
                            </a>
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
                              {messageTime}
                              {isCurrentUser && (
                                <span className="ml-1" title={msg.isRead ? 'Read' : 'Delivered'}>
                                  {msg.isRead ? <CheckCheck className="h-3 w-3 inline" /> : <Check className="h-3 w-3 inline" />}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Text message bubble */}
                        {!msg.fileUrl && msg.message && (
                          <div
                            className={`rounded-lg px-4 py-2 ${
                              isCurrentUser
                                ? 'bg-brand-orange text-white rounded-br-none'
                                : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold ${isCurrentUser ? 'text-orange-100' : 'text-gray-600'}`}>
                                {msg.senderName}
                              </span>
                              {msg.senderRole && (
                                <span className={`text-xs ${isCurrentUser ? 'text-orange-200' : 'text-gray-500'}`}>
                                  ({msg.senderRole})
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                            
                            <div className={`flex items-center gap-1 mt-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-xs ${isCurrentUser ? 'text-orange-100' : 'text-gray-500'}`}>
                                {messageTime}
                              </span>
                              {isCurrentUser && (
                                <span className="text-xs" title={msg.isRead ? 'Read' : 'Delivered'}>
                                  {msg.isRead ? (
                                    <CheckCheck className="h-3 w-3 text-orange-100" />
                                  ) : (
                                    <Check className="h-3 w-3 text-orange-200" />
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

          <div className="border-t p-4 bg-white rounded-b-lg sticky bottom-0 z-10">
            {/* Attachment Previews */}
            {attachmentPreviews.length > 0 && (
              <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
                {attachmentPreviews.map((attachment) => (
                  <div key={attachment.id} className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      {attachment.isImage ? (
                        <img src={attachment.url} alt="Preview" className="w-12 h-12 object-cover rounded" />
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
                        <p className="text-sm font-medium text-gray-900 truncate">{attachment.file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(attachment.file.size)}</p>
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
                  onChange={(e) => setMessage(e.target.value)}
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
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <AlertDialog open={showClearDialog} onOpenChange={(open) => !clearingChat && setShowClearDialog(open)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-10 w-10"
                        disabled={clearingChat}
                      >
                        {clearingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear Admin Group Chat</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete every admin chat message and remove all related media
                          files stored in Firebase Storage. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={clearingChat}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(event) => {
                            event.preventDefault();
                            handleClearAdminChat();
                          }}
                          className="bg-red-600 hover:bg-red-500"
                          disabled={clearingChat}
                        >
                          {clearingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clear Chat"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
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
          </div>
        </Card>
      </div>
    </Layout>
  );
}

