# Firebase Storage Setup for Media Uploads

This document provides a comprehensive guide to the Firebase Storage implementation for media uploads in the AcciZard application.

## Overview

The Firebase Storage setup includes:
- **Storage Configuration**: Firebase Storage initialization and configuration
- **Storage Utilities**: Core functions for file operations
- **React Hook**: Custom hook for file uploads with progress tracking
- **UI Component**: Reusable file upload component with drag-and-drop functionality

## Files Structure

```
src/
├── lib/
│   ├── firebase.ts          # Firebase configuration with storage
│   └── storage.ts           # Storage utilities and functions
├── hooks/
│   └── useFileUpload.ts     # React hook for file uploads
├── components/
│   └── ui/
│       └── file-upload.tsx  # Reusable file upload component
└── components/
    └── FileUploadExample.tsx # Example usage component
```

## Configuration

### 1. Firebase Configuration (`src/lib/firebase.ts`)

Firebase Storage is already configured and exported:

```typescript
import { getStorage } from 'firebase/storage';

const storage = getStorage(app);
export { auth, db, storage };
```

### 2. Storage Bucket

The storage bucket is configured as: `accizard-lucban-official-65ba3.firebasestorage.app`
  
## Storage Utilities (`src/lib/storage.ts`)

### File Type Validation

```typescript
// Supported file types
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### File Categories

```typescript
export type FileCategory = 'profile' | 'validId' | 'document' | 'announcement' | 'report' | 'general';
```

### Core Functions

#### Upload Single File
```typescript
const result = await uploadFile(file, category, userId, customPath, onProgress);
// Returns: { url: string; path: string; fileName: string }
```

#### Upload Multiple Files
```typescript
const results = await uploadMultipleFiles(files, category, userId, customPath, onProgress);
// Returns: Array<{ url: string; path: string; fileName: string }>
```

#### Specialized Upload Functions
```typescript
// Profile picture upload
const result = await uploadProfilePicture(file, userId, onProgress);

// Valid ID image upload
const result = await uploadValidIdImage(file, userId, onProgress);

// Document upload
const result = await uploadDocument(file, userId, documentType, onProgress);

// Announcement media upload
const result = await uploadAnnouncementMedia(file, announcementId, onProgress);

// Report media upload
const result = await uploadReportMedia(file, reportId, onProgress);
```

#### File Management
```typescript
// Delete file
await deleteFile(filePath);

// Delete multiple files
await deleteMultipleFiles(filePaths);

// Get download URL
const url = await getFileDownloadURL(filePath);

// List files in directory
const files = await listFiles(directoryPath);
```

#### Image Compression
```typescript
const compressedFile = await compressImage(file, maxWidth, maxHeight, quality);
```

## React Hook (`src/hooks/useFileUpload.ts`)

### Usage

```typescript
import { useFileUpload } from '@/hooks/useFileUpload';

const MyComponent = () => {
  const {
    uploadState,
    uploadSingleFile,
    uploadMultipleFiles,
    uploadProfilePicture,
    uploadValidIdImage,
    uploadDocument,
    uploadAnnouncementMedia,
    uploadReportMedia,
    validateAndUpload,
    resetUploadState,
    clearError
  } = useFileUpload();

  // Upload a single file
  const handleUpload = async (file: File) => {
    const result = await uploadSingleFile(file, 'profile', 'user123');
    if (result) {
      console.log('Upload successful:', result.url);
    }
  };

  // Check upload state
  if (uploadState.isUploading) {
    console.log(`Upload progress: ${uploadState.progress}%`);
  }

  return (
    <div>
      {/* Your upload UI */}
    </div>
  );
};
```

### Upload State

```typescript
interface UploadState {
  isUploading: boolean;
  progress: number;
  uploadedFiles: Array<{ url: string; path: string; fileName: string }>;
  error: string | null;
}
```

## File Upload Component (`src/components/ui/file-upload.tsx`)

### Basic Usage

```typescript
import { FileUpload } from '@/components/ui/file-upload';

const MyComponent = () => {
  const handleUploadComplete = (files) => {
    console.log('Uploaded files:', files);
  };

  const handleUploadError = (error) => {
    console.error('Upload error:', error);
  };

  return (
    <FileUpload
      category="profile"
      userId="user123"
      multiple={false}
      maxFiles={1}
      acceptedTypes={ALLOWED_IMAGE_TYPES}
      onUploadComplete={handleUploadComplete}
      onUploadError={handleUploadError}
      uploadButtonText="Upload Profile Picture"
      dragDropText="Drag and drop your profile picture here"
      showPreview={true}
    />
  );
};
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `category` | `FileCategory` | - | File category for organization |
| `userId` | `string` | - | User ID for file organization |
| `customPath` | `string` | - | Custom storage path |
| `multiple` | `boolean` | `false` | Allow multiple file selection |
| `maxFiles` | `number` | `5` | Maximum number of files |
| `acceptedTypes` | `string[]` | - | Allowed file types |
| `onUploadComplete` | `function` | - | Callback when upload completes |
| `onUploadError` | `function` | - | Callback when upload fails |
| `className` | `string` | `''` | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable the upload component |
| `showPreview` | `boolean` | `true` | Show image previews |
| `uploadButtonText` | `string` | `'Upload Files'` | Upload button text |
| `dragDropText` | `string` | `'Drag and drop files here'` | Drag and drop text |

## File Organization Structure

Files are organized in Firebase Storage with the following structure:

```
storage/
├── profile-pictures-web/
│   └── {userId}/
│       └── profile_{timestamp}_{random}.{ext}
├── validIds/
│   └── {userId}/
│       └── id_{timestamp}_{random}.{ext}
├── documents/
│   └── {userId}/
│       └── {documentType}_{timestamp}_{random}.{ext}
├── announcements/
│   └── {announcementId}/
│       └── media_{timestamp}_{random}.{ext}
├── report_images/
│   └── {userId}/
│       └── {reportId}/
│           ├── images/           ← Mobile app images
│           │   └── image_{timestamp}_{random}.{ext}
│           └── admin/            ← Web app admin images
│               └── media_{timestamp}_{random}.{ext}
└── general/
    └── {userId}/
        └── {filename}_{timestamp}_{random}.{ext}
```

## Security Rules

Make sure to configure Firebase Storage security rules. Here's a basic example:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload files
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    // Or more specific rules
    match /profile-pictures-web/{userId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /validIds/{userId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /report_images/{userId}/{reportId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Error Handling

The storage utilities include comprehensive error handling:

```typescript
try {
  const result = await uploadFile(file, 'profile', userId);
  console.log('Upload successful:', result);
} catch (error) {
  console.error('Upload failed:', error.message);
  // Handle error appropriately
}
```

## Performance Considerations

1. **Image Compression**: Images are automatically compressed before upload
2. **File Size Limits**: 10MB maximum file size
3. **Progress Tracking**: Real-time upload progress
4. **Batch Operations**: Support for multiple file uploads

## Best Practices

1. **File Validation**: Always validate files before upload
2. **Error Handling**: Implement proper error handling
3. **User Feedback**: Show upload progress and status
4. **File Cleanup**: Clean up unused files to save storage costs
5. **Security**: Implement appropriate security rules
6. **File Naming**: Use unique file names to prevent conflicts

## Example Implementations

### Profile Picture Upload
```typescript
const ProfilePictureUpload = () => {
  const { uploadProfilePicture } = useFileUpload();

  const handleFileSelect = async (file: File) => {
    const result = await uploadProfilePicture(file, 'user123');
    if (result) {
      // Update user profile with new image URL
      updateUserProfile({ profilePicture: result.url });
    }
  };

  return (
    <FileUpload
      category="profile"
      userId="user123"
      multiple={false}
      maxFiles={1}
      acceptedTypes={ALLOWED_IMAGE_TYPES} 
      onUploadComplete={handleFileSelect}
      uploadButtonText="Upload Profile Picture"
    />
  );
};
```

### Document Upload
```typescript
const DocumentUpload = () => {
  const { uploadDocument } = useFileUpload();

  const handleDocumentUpload = async (file: File) => {
    const result = await uploadDocument(file, 'user123', 'contract');
    if (result) {
      // Save document reference to database
      saveDocumentReference({
        userId: 'user123',
        documentType: 'contract',
        fileUrl: result.url,
        filePath: result.path
      });
    }
  };

  return (
    <FileUpload
      category="document"
      userId="user123"
      multiple={true}
      maxFiles={5}
      acceptedTypes={ALLOWED_DOCUMENT_TYPES}
      onUploadComplete={handleDocumentUpload}
      uploadButtonText="Upload Documents"
    />
  );
};
```

## Troubleshooting

### Common Issues

1. **Upload Fails**: Check Firebase Storage rules and authentication
2. **File Too Large**: Ensure file size is under 10MB
3. **Invalid File Type**: Check accepted file types
4. **Network Issues**: Implement retry logic for failed uploads

### Debug Tips

1. Check browser console for error messages
2. Verify Firebase configuration
3. Test with smaller files first
4. Check network connectivity
5. Verify storage rules

## Additional Resources

- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)
- [Firebase Storage Security Rules](https://firebase.google.com/docs/storage/security)
- [React File Upload Best Practices](https://reactjs.org/docs/forms.html#the-file-input-tag) 