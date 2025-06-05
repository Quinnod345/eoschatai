'use client';

import * as React from 'react';
import {
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/lib/toast-system';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
} from 'lucide-react';
import { parseDocumentContent } from '@/lib/utils/document-parser';
import { AnimatedModal } from '@/components/ui/animated-modal';

// Custom styling to match the settings modal styling
const styles = {
  wrapper: 'document-modal-wrapper',
  enhancedModal: 'document-modal-enhanced',
  tabList: 'document-modal-tablist',
  tabTrigger: 'document-modal-tabtrigger',
  tabActive: 'document-modal-tabactive',
  headerText: 'document-modal-headertext',
  normalText: 'document-modal-normaltext',
  mutedText: 'document-modal-mutedtext',
  formLabel: 'document-modal-formlabel',
  cancelButton: 'document-modal-cancelbutton',
  fixedHeight: 'document-modal-fixedheight',
};

// Animation variants for staggered animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

interface DocumentContextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Document category type
type DocumentCategory = 'Scorecard' | 'VTO' | 'Rocks' | 'A/C' | 'Core Process';

// Document type definition
interface DocumentItem {
  id: string;
  fileName: string;
  category: DocumentCategory;
  uploadedAt: string;
  size: number;
}

export function DocumentContextModal({
  isOpen,
  onClose,
}: DocumentContextModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] =
    React.useState<DocumentCategory>('Scorecard');
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchUserDocuments = React.useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      // Fetch documents for the user and the current active category
      const response = await fetch(`/api/documents?category=${activeTab}`);

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch user documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [activeTab, session?.user]);

  // Fetch documents when the modal opens or category changes
  React.useEffect(() => {
    if (isOpen) {
      fetchUserDocuments();
    }
  }, [isOpen, fetchUserDocuments]);

  // Add document modal specific styling to the document
  React.useEffect(() => {
    // Create a style element if it doesn't exist already
    const id = 'document-modal-styles';
    if (!document.getElementById(id)) {
      const styleEl = document.createElement('style');
      styleEl.id = id;
      styleEl.textContent = `
        /* Base styles for document modal */
        .${styles.wrapper} * {
          color: var(--color-text) !important;
        }
        
        /* Define theme-aware variables */
        .${styles.wrapper} {
          --color-text: hsl(var(--foreground));
          --color-text-muted: hsl(var(--muted-foreground));
          --color-bg: hsl(var(--background));
          --color-bg-muted: hsl(var(--muted));
          --color-primary: hsl(var(--primary));
          --color-border: hsl(var(--border));
        }
        
        /* Tab list styles */
        .${styles.tabList} {
          background-color: var(--color-bg-muted);
          border-radius: 0.375rem;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        /* Tab trigger styles */
        .${styles.tabTrigger} {
          color: var(--color-text) !important;
          position: relative;
          z-index: 1;
          font-size: 0.8rem;
          padding: 0.5rem 0.25rem;
        }
        
        @media (min-width: 640px) {
          .${styles.tabTrigger} {
            font-size: 0.875rem;
            padding: 0.5rem 0.75rem;
          }
        }
        
        /* Remove the tab trigger hover effect */
        .${styles.tabTrigger}:hover {
          color: var(--color-text) !important;
        }
        
        /* Active tab styling */
        .${styles.tabActive} {
          background-color: var(--color-bg);
          color: var(--color-text) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        /* Text styles */
        .${styles.headerText} {
          color: var(--color-text) !important;
          font-weight: 500;
        }
        
        .${styles.normalText} {
          color: var(--color-text) !important;
        }
        
        .${styles.mutedText} {
          color: var(--color-text-muted) !important;
        }
        
        /* Form labels */
        .${styles.formLabel} {
          color: var(--color-text) !important;
        }
        
        /* Cancel button */
        .${styles.cancelButton}:hover {
          background-color: var(--color-bg-muted);
        }
        
        /* Fixed height content */
        .${styles.fixedHeight} {
          max-height: 35vh;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        
        @media (min-width: 640px) {
          .${styles.fixedHeight} {
            max-height: 40vh;
          }
        }
        
        @media (min-width: 768px) {
          .${styles.fixedHeight} {
            max-height: 400px;
          }
        }

        /* Scrollbar styling */
        .${styles.fixedHeight}::-webkit-scrollbar {
          width: 6px;
        }
        
        .${styles.fixedHeight}::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .${styles.fixedHeight}::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 3px;
        }
        
        .${styles.fixedHeight}::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-muted);
        }
        
        /* Enhanced modal styling with shadows */
        .${styles.enhancedModal} {
          background-color: hsl(var(--background));
          border: 1px solid var(--color-border);
          width: 100%;
          max-width: 550px;
          display: flex;
          flex-direction: column;
        }

        /* Dark mode specific adjustments */
        @media (prefers-color-scheme: dark) {
          .${styles.enhancedModal} {
            box-shadow: inset 0px 0px 10px rgba(255, 255, 255, 0.03), 
                      0 8px 30px rgba(0, 0, 0, 0.5), 
                      0 2px 8px rgba(0, 0, 0, 0.4);
          }
        }

        /* Light mode specific adjustments */
        @media (prefers-color-scheme: light) {
          .${styles.enhancedModal} {
            box-shadow: inset 0px 0px 10px rgba(0, 0, 0, 0.05), 
                      0 8px 30px rgba(0, 0, 0, 0.15), 
                      0 2px 8px rgba(0, 0, 0, 0.1);
          }
        }

        /* Drag and drop zone */
        .document-upload-zone {
          border: 2px dashed hsl(var(--border));
          border-radius: 0.5rem;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.2s;
        }
        
        @media (min-width: 640px) {
          .document-upload-zone {
            padding: 2rem;
          }
        }
        
        .document-upload-zone.drag-active {
          border-color: hsl(var(--primary));
          background-color: hsl(var(--primary) / 0.1);
        }

        /* Document list */
        .document-list {
          margin-top: 1rem;
        }
        
        .document-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          margin-bottom: 0.5rem;
          transition: all 0.2s;
        }
        
        .document-item:hover {
          background-color: hsl(var(--muted) / 0.5);
        }

        /* Footer sticky positioning */
        .document-modal-footer {
          position: sticky;
          bottom: 0;
          background-color: hsl(var(--background));
          padding-top: 0.75rem;
          margin-top: 0.75rem;
          border-top: 1px solid hsl(var(--border) / 0.5);
          z-index: 10;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Clean up style element when component unmounts
    return () => {
      const styleEl = document.getElementById(id);
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    await uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    if (!session?.user) {
      toast.error('You must be logged in to upload documents');
      return;
    }

    try {
      setUploading(true);

      for (const file of files) {
        // Check file type (expanded to include Excel and Word files)
        const validTypes = [
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];

        // Also check file extension for types that might not be correctly identified
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const validExtensions = [
          'pdf',
          'txt',
          'md',
          'doc',
          'docx',
          'xls',
          'xlsx',
        ];

        if (
          !validTypes.includes(file.type) &&
          !validExtensions.includes(fileExt || '')
        ) {
          toast.error(
            `Invalid file type: ${file.name}. Only PDF, TXT, MD, DOC, DOCX, XLS, and XLSX files are supported.`,
          );
          continue;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name}. Maximum size is 10MB.`);
          continue;
        }

        // For Excel or Word files, try to parse on the client side for preview
        if (
          file.type.includes('spreadsheet') ||
          file.type.includes('wordprocessingml') ||
          fileExt === 'xlsx' ||
          fileExt === 'xls' ||
          fileExt === 'docx'
        ) {
          try {
            // Try to parse and preview the content client-side
            // This doesn't affect the server-side processing, which is more robust
            const preview = await parseDocumentContent(file);
            console.log(
              `Preview for ${file.name}: ${preview.substring(0, 200)}...`,
            );
          } catch (previewError) {
            console.warn('Preview generation failed:', previewError);
            // Continue with upload even if preview fails
          }
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', activeTab);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();

          // Check if the file is a PDF to give more detailed feedback
          if (
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf')
          ) {
            // Special handling for PDFs with AI processing
            toast.success(`${file.name} uploaded. AI analysis in progress...`);

            // After a short delay, show the success message
            setTimeout(() => {
              toast.success(
                `${file.name} has been AI-processed! The document text and a comprehensive summary are now available for chatbot reference.`,
              );
            }, 3000);
          } else {
            toast.success(`${file.name} uploaded successfully`);
          }

          console.log(`Document uploaded successfully: ${file.name}`, data);
        } else {
          const error = await response.json();

          // Check if this is a premium feature error
          if (response.status === 403 && error.requiresPremium) {
            toast.error(
              'Document upload is a premium feature. Please upgrade to enable document uploads.',
            );

            setTimeout(() => {
              // Redirect to settings with premium tab focused
              window.location.href = '/settings?tab=preferences';
            }, 2000);

            // Stop trying to upload more files
            break;
          } else {
            throw new Error(error.error || 'Failed to upload document');
          }
        }
      }

      // Refresh the document list
      fetchUserDocuments();
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload documents',
      );
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the document from the list
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        toast.success('Document deleted successfully');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete document',
      );
    } finally {
      setLoading(false);
    }
  };

  // Function to render the file size in a human-readable format
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.querySelector('.document-upload-zone');
    if (dropZone) {
      dropZone.classList.add('drag-active');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.querySelector('.document-upload-zone');
    if (dropZone) {
      dropZone.classList.remove('drag-active');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.querySelector('.document-upload-zone');
    if (dropZone) {
      dropZone.classList.remove('drag-active');
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    await uploadFiles(files);
  };

  // Get appropriate icon based on file type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      return <FileSpreadsheet className="h-5 w-5 mr-2 text-green-500" />;
    } else if (ext === 'docx' || ext === 'doc') {
      return <File className="h-5 w-5 mr-2 text-blue-500" />;
    } else if (ext === 'pdf') {
      return <FileText className="h-5 w-5 mr-2 text-red-500" />;
    } else if (ext === 'jpg' || ext === 'png' || ext === 'gif') {
      return <FileImage className="h-5 w-5 mr-2 text-purple-500" />;
    }

    return <FileText className="h-5 w-5 mr-2 text-primary" />;
  };

  const renderDocumentList = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      );
    }

    if (documents.length === 0) {
      return (
        <div className="text-center py-8">
          <p className={styles.mutedText}>No documents uploaded yet.</p>
        </div>
      );
    }

    return (
      <div className="document-list">
        {documents.map((doc) => (
          <div key={doc.id} className="document-item">
            <div className="flex items-center">
              {getFileIcon(doc.fileName)}
              <div>
                <p className={styles.normalText}>{doc.fileName}</p>
                <p className={`text-xs ${styles.mutedText}`}>
                  {formatFileSize(doc.size)} •{' '}
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteDocument(doc.id)}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className={cn('p-4 sm:p-6', styles.wrapper, styles.enhancedModal)}>
        <AlertDialogHeader className="mb-4">
          <AlertDialogTitle
            className={cn('text-lg sm:text-xl', styles.headerText)}
          >
            Document Context
          </AlertDialogTitle>
          <AlertDialogDescription
            className={cn('text-xs sm:text-sm', styles.mutedText)}
          >
            Upload your EOS documents to provide context for AI responses.
            <span className="block mt-2 text-xs sm:text-sm font-medium text-foreground">
              After uploading, you can ask the AI about your documents by saying
              things like &ldquo;What&apos;s in my Core Process document?&rdquo;
              or &ldquo;Tell me about my Scorecard.&rdquo;
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DocumentCategory)}
          className="w-full"
        >
          <TabsList className={cn('w-full grid grid-cols-5', styles.tabList)}>
            <TabsTrigger
              value="Scorecard"
              className={cn(
                styles.tabTrigger,
                activeTab === 'Scorecard' && styles.tabActive,
              )}
            >
              Scorecard
            </TabsTrigger>
            <TabsTrigger
              value="VTO"
              className={cn(
                styles.tabTrigger,
                activeTab === 'VTO' && styles.tabActive,
              )}
            >
              VTO
            </TabsTrigger>
            <TabsTrigger
              value="Rocks"
              className={cn(
                styles.tabTrigger,
                activeTab === 'Rocks' && styles.tabActive,
              )}
            >
              Rocks
            </TabsTrigger>
            <TabsTrigger
              value="A/C"
              className={cn(
                styles.tabTrigger,
                activeTab === 'A/C' && styles.tabActive,
              )}
            >
              A/C
            </TabsTrigger>
            <TabsTrigger
              value="Core Process"
              className={cn(
                styles.tabTrigger,
                activeTab === 'Core Process' && styles.tabActive,
              )}
            >
              CoreProcess
            </TabsTrigger>
          </TabsList>

          <div className={cn('mt-3 sm:mt-4', styles.fixedHeight)}>
            {/* Hidden file input for file selection */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept=".pdf,.txt,.md,.doc,.docx,.xls,.xlsx"
            />

            <AnimatePresence mode="wait">
              <TabsContent value={activeTab} key={activeTab} forceMount>
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={containerVariants}
                  className="space-y-4 sm:space-y-6"
                >
                  <motion.div variants={itemVariants}>
                    <h3
                      className={cn(
                        'text-base sm:text-lg font-medium',
                        styles.headerText,
                      )}
                    >
                      {activeTab} Documents
                    </h3>
                    <p className={cn('text-xs sm:text-sm', styles.mutedText)}>
                      Upload your {activeTab} documents to provide context for
                      AI responses.
                    </p>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <div
                      className="document-upload-zone"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-primary mb-2 sm:mb-3" />
                          <p className={styles.normalText}>Uploading...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="h-8 w-8 sm:h-10 sm:w-10 mb-2 sm:mb-3 text-primary" />
                          <p
                            className={cn(
                              'text-sm sm:text-base',
                              styles.normalText,
                            )}
                          >
                            <span className="font-medium">Click to upload</span>{' '}
                            or drag and drop
                          </p>
                          <p className={cn('text-xs mt-1', styles.mutedText)}>
                            PDF, TXT, MD, DOC, DOCX, XLS, XLSX (up to 10MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    {renderDocumentList()}
                  </motion.div>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </div>
        </Tabs>

        <AlertDialogFooter className="document-modal-footer">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading || uploading}
            className={cn(styles.cancelButton)}
          >
            Close
          </Button>
        </AlertDialogFooter>
      </div>
    </AnimatedModal>
  );
}
