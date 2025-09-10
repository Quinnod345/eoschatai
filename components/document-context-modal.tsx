'use client';

import * as React from 'react';
import {
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast-system';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

import {
  Trash2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  CheckCircle2,
} from 'lucide-react';
import { parseDocumentContent } from '@/lib/utils/document-parser';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { Checkbox } from '@/components/ui/checkbox';

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
  pickerModal: 'document-modal-picker-modal',
};

interface DocumentContextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Document category type
type DocumentCategory =
  | 'Scorecard'
  | 'VTO'
  | 'Rocks'
  | 'A/C'
  | 'Core Process'
  | 'Other';

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
  const [composerLoading, setComposerLoading] = React.useState(false);
  const [composerError, setComposerError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] =
    React.useState<DocumentCategory>('Scorecard');
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  // Composer docs by kind for picker tabs
  const [composerDocs, setComposerDocs] = React.useState<
    Record<string, { id: string; title: string; kind: string }[]>
  >({});
  const [uploading, setUploading] = React.useState(false);
  const [processingRag, setProcessingRag] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // New: composer context selection state
  const [composerContext, setComposerContext] = React.useState<{
    [kind: string]: boolean;
  }>({});
  const [usePrimaryDocs, setUsePrimaryDocs] = React.useState(true);
  const [showComposerPicker, setShowComposerPicker] = React.useState(false);
  const [pickerFilter, setPickerFilter] = React.useState<
    | 'all'
    | 'scorecard'
    | 'vto'
    | 'accountability'
    | 'text'
    | 'code'
    | 'image'
    | 'chart'
  >('all');

  const fetchComposerSettings = React.useCallback(async () => {
    try {
      const res = await fetch('/api/user-settings');
      if (!res.ok) return;
      const s = await res.json();
      setUsePrimaryDocs(Boolean(s?.usePrimaryDocsForContext ?? true));
      // Preselect primary if present
      const ctxMap: { [key: string]: boolean } = {};
      if (Array.isArray(s?.contextDocumentIds)) {
        for (const id of s.contextDocumentIds) ctxMap[id] = true;
      }
      setComposerContext(ctxMap);
    } catch {}
  }, []);

  const saveComposerSettings = React.useCallback(async () => {
    try {
      const ids = Object.entries(composerContext)
        .filter(([, v]) => v)
        .map(([k]) => k);
      await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextDocumentIds: ids,
          contextComposerDocumentIds: ids,
          usePrimaryDocsForContext: usePrimaryDocs,
        }),
      });
      toast.success('Context settings saved');
    } catch {
      toast.error('Failed to save context settings');
    }
  }, [composerContext, usePrimaryDocs]);

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

  // Fetch composer documents by kind for picker tabs - optimized to load on demand
  const fetchComposerDocs = React.useCallback(
    async (specificKind?: string) => {
      if (!session?.user) return;

      setComposerLoading(true);
      setComposerError(null);

      try {
        // If specific kind is provided, only fetch that kind
        if (specificKind) {
          const res = await fetch(
            `/api/documents?composerKind=${specificKind}`,
          );
          if (res.ok) {
            const data = await res.json();
            setComposerDocs((prev) => ({
              ...prev,
              [specificKind]: data.documents || [],
            }));
          }
        } else {
          // Fetch all kinds (initial load)
          const kinds = [
            'sheet',
            'vto',
            'accountability',
            'text',
            'code',
            'image',
            'chart',
          ] as const;

          const results: Record<string, any[]> = {};
          await Promise.all(
            kinds.map(async (kind) => {
              const res = await fetch(`/api/documents?composerKind=${kind}`);
              if (res.ok) {
                const data = await res.json();
                results[kind] = data.documents || [];
              } else {
                results[kind] = [];
              }
            }),
          );
          setComposerDocs(results as any);
        }
      } catch (e) {
        console.error('Failed to fetch composer docs', e);
        setComposerError(
          'Failed to load composer documents. Please try again.',
        );
      } finally {
        setComposerLoading(false);
      }
    },
    [session?.user],
  );

  // Fetch documents and context settings when the modal opens or category changes
  React.useEffect(() => {
    if (isOpen) {
      fetchUserDocuments();
      fetchComposerDocs(); // Initial load of all docs
      fetchComposerSettings();
    }
  }, [isOpen, fetchUserDocuments, fetchComposerDocs, fetchComposerSettings]);

  // Fetch composer documents when picker filter changes (on-demand loading)
  React.useEffect(() => {
    if (showComposerPicker && pickerFilter !== 'all') {
      // Map filter to document kinds
      const kindMap: Record<string, string> = {
        scorecard: 'sheet',
        vto: 'vto',
        accountability: 'accountability',
        text: 'text',
        code: 'code',
        image: 'image',
        chart: 'chart',
      };

      const kind = kindMap[pickerFilter];
      if (kind && !composerDocs[kind]) {
        fetchComposerDocs(kind);
      }
    }
  }, [showComposerPicker, pickerFilter, composerDocs, fetchComposerDocs]);

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
          max-width: 1024px;
          display: flex;
          flex-direction: column;
        }

        /* Picker modal wider */
        .${styles.pickerModal} {
          width: 100%;
          max-width: 1100px;
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
          // Show upload success for all documents
          toast.success(`${file.name} uploaded successfully`);

          // Show RAG processing feedback
          setProcessingRag(true);
          toast.info('Processing document for AI context...', {
            duration: 2000,
          });

          // Simulate completion feedback (actual processing happens server-side)
          setTimeout(() => {
            setProcessingRag(false);
            toast.success('Document is ready for AI context!', {
              duration: 3000,
            });
          }, 2500);

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
        {documents.map((doc) => {
          const isSelected = Boolean(composerContext[doc.id]);
          return (
            <div
              key={doc.id}
              className={cn(
                'document-item',
                isSelected && 'border-emerald-500/70 bg-emerald-500/5',
              )}
            >
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
              <div className="flex items-center gap-2">
                <div className="text-xs flex items-center gap-2 select-none">
                  <Checkbox
                    id={`ctx-${doc.id}`}
                    checked={isSelected}
                    onCheckedChange={() =>
                      setComposerContext((m) => ({
                        ...m,
                        [doc.id]: !isSelected,
                      }))
                    }
                  />
                  <label htmlFor={`ctx-${doc.id}`} className="cursor-pointer">
                    Use as context
                  </label>
                  {isSelected && (
                    <span aria-hidden="true">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </span>
                  )}
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
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <AnimatedModal isOpen={isOpen} onClose={onClose}>
        <div className={cn('p-6 sm:p-8', styles.wrapper, styles.enhancedModal)}>
          <AlertDialogHeader className="mb-6">
            <AlertDialogTitle
              className={cn(
                'text-xl sm:text-2xl font-semibold',
                styles.headerText,
              )}
            >
              Document Context
            </AlertDialogTitle>
            <AlertDialogDescription
              className={cn('text-sm mt-2', styles.mutedText)}
            >
              Upload your EOS documents to provide context for AI responses.
              <span className="block mt-2 text-sm font-medium text-foreground">
                Primary Accountability, V/TO, and Scorecard composers are
                automatically used as context. You can customize below.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mb-6 flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usePrimaryDocs}
                onChange={(e) => setUsePrimaryDocs(e.target.checked)}
                className="w-4 h-4"
              />
              Use primary composers automatically
            </label>
            <Button variant="outline" size="sm" onClick={saveComposerSettings}>
              Save Context Settings
            </Button>
          </div>

          {/* Upload Documents Section */}
          <div className="rounded-lg border bg-card p-4 sm:p-6 mb-6">
            <div className="mb-4">
              <div className="text-base font-semibold">Upload Documents</div>
              <div className="text-sm text-muted-foreground mt-1">
                Upload EOS documents to provide context for AI responses.
              </div>
            </div>

            {/* Document Category Selector */}
            <div className="mb-4">
              <label
                htmlFor="document-category"
                className="text-sm font-medium mb-2 block"
              >
                Document Category
              </label>
              <Select
                value={activeTab}
                onValueChange={(value) =>
                  setActiveTab(value as DocumentCategory)
                }
              >
                <SelectTrigger
                  id="document-category"
                  className="w-full sm:w-[250px]"
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scorecard">Scorecard</SelectItem>
                  <SelectItem value="VTO">VTO</SelectItem>
                  <SelectItem value="Rocks">Rocks</SelectItem>
                  <SelectItem value="A/C">Accountability Chart</SelectItem>
                  <SelectItem value="Core Process">Core Process</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={cn('mt-4', styles.fixedHeight)}>
              {/* Hidden file input for file selection */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
                accept=".pdf,.txt,.md,.doc,.docx,.xls,.xlsx"
              />

              <div className="space-y-4">
                {/* Upload Zone */}
                <button
                  type="button"
                  className="document-upload-zone text-left w-full"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={`Upload ${activeTab} documents. Click or drag and drop files here.`}
                  aria-busy={uploading}
                  aria-describedby="upload-instructions"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-3" />
                      <p className={styles.normalText}>Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8">
                      <div className="mb-3 p-4 rounded-full bg-primary/10">
                        <svg
                          className="h-6 w-6 text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <p
                        className={cn(
                          'text-base font-medium mb-1',
                          styles.normalText,
                        )}
                      >
                        Click to upload or drag and drop
                      </p>
                      <p
                        id="upload-instructions"
                        className={cn('text-sm', styles.mutedText)}
                      >
                        {activeTab === 'Other' ? 'Any type of' : activeTab}{' '}
                        documents • PDF, TXT, MD, DOC, DOCX, XLS, XLSX (up to
                        10MB)
                      </p>
                    </div>
                  )}
                </button>

                {/* Document List */}
                {renderDocumentList()}
              </div>
            </div>
          </div>

          {/* Composer Picker Section */}
          <div className="rounded-lg border bg-card p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-semibold">
                  Composer Documents
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Choose which of your composers should be used as AI context.
                </div>
              </div>
              <Button
                size="default"
                onClick={() => setShowComposerPicker(true)}
              >
                Choose Composers
              </Button>
            </div>

            {/* List of selected composers */}
            <div className="mt-4">
              {Object.entries(composerContext).filter(
                ([, selected]) => selected,
              ).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Selected composers for AI context:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(composerContext)
                      .filter(([, selected]) => selected)
                      .map(([docId]) => {
                        // Find the document in composerDocs
                        const doc = Object.values(composerDocs)
                          .flat()
                          .find((d) => d.id === docId);

                        if (!doc) return null;

                        const getIcon = () => {
                          switch (doc.kind) {
                            case 'sheet':
                              return '📊';
                            case 'vto':
                              return '🎯';
                            case 'accountability':
                              return '👥';
                            case 'text':
                              return '📝';
                            case 'code':
                              return '💻';
                            case 'image':
                              return '🎨';
                            case 'chart':
                              return '📈';
                            default:
                              return '📄';
                          }
                        };

                        const getTypeName = () => {
                          switch (doc.kind) {
                            case 'sheet':
                              return 'Scorecard';
                            case 'vto':
                              return 'V/TO';
                            case 'accountability':
                              return 'A/C';
                            case 'text':
                              return 'Document';
                            case 'code':
                              return 'Code';
                            case 'image':
                              return 'Image';
                            case 'chart':
                              return 'Chart';
                            default:
                              return doc.kind;
                          }
                        };

                        return (
                          <div
                            key={docId}
                            className="flex items-center gap-2 p-2 bg-muted/30 rounded-md"
                          >
                            <span className="text-lg">{getIcon()}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.title || 'Untitled'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getTypeName()}
                              </p>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No composers selected. Click "Choose Composers" to select
                  documents for AI context.
                </p>
              )}
            </div>
          </div>

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
      {showComposerPicker && (
        <AnimatedModal
          isOpen={showComposerPicker}
          onClose={() => setShowComposerPicker(false)}
        >
          <div className={cn('p-6 sm:p-8', styles.wrapper, styles.pickerModal)}>
            <AlertDialogHeader className="mb-6">
              <AlertDialogTitle
                className={cn('text-xl font-semibold', styles.headerText)}
              >
                Choose Composers
              </AlertDialogTitle>
              <AlertDialogDescription
                className={cn('text-sm mt-2', styles.mutedText)}
              >
                Select composers to use as context. Click to toggle.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Tabs
              value={pickerFilter}
              onValueChange={(value) => setPickerFilter(value as any)}
              className="w-full"
              aria-label="Filter composer documents by type"
            >
              <TabsList
                className="w-full grid grid-cols-4 lg:grid-cols-8 mb-6"
                aria-label="Document type filters"
              >
                <TabsTrigger
                  value="all"
                  className="text-xs"
                  aria-label="Show all document types"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="scorecard"
                  className="text-xs"
                  aria-label="Show Scorecard documents"
                >
                  Scorecard
                </TabsTrigger>
                <TabsTrigger
                  value="vto"
                  className="text-xs"
                  aria-label="Show Vision Traction Organizer documents"
                >
                  V/TO
                </TabsTrigger>
                <TabsTrigger
                  value="accountability"
                  className="text-xs"
                  aria-label="Show Accountability Chart documents"
                >
                  A/C
                </TabsTrigger>
                <TabsTrigger
                  value="text"
                  className="text-xs"
                  aria-label="Show text documents"
                >
                  Document
                </TabsTrigger>
                <TabsTrigger
                  value="code"
                  className="text-xs"
                  aria-label="Show code documents"
                >
                  Code
                </TabsTrigger>
                <TabsTrigger
                  value="image"
                  className="text-xs"
                  aria-label="Show image documents"
                >
                  Image
                </TabsTrigger>
                <TabsTrigger
                  value="chart"
                  className="text-xs"
                  aria-label="Show chart documents"
                >
                  Chart
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {composerError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {composerError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-auto pr-2">
              {composerLoading ? (
                <div className="col-span-full flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-3 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Loading composers...
                    </p>
                  </div>
                </div>
              ) : (
                (pickerFilter === 'all'
                  ? ([
                      'sheet',
                      'vto',
                      'accountability',
                      'text',
                      'code',
                      'image',
                      'chart',
                    ] as const)
                  : pickerFilter === 'scorecard'
                    ? (['sheet'] as const)
                    : pickerFilter === 'vto'
                      ? (['vto'] as const)
                      : pickerFilter === 'accountability'
                        ? (['accountability'] as const)
                        : pickerFilter === 'text'
                          ? (['text'] as const)
                          : pickerFilter === 'code'
                            ? (['code'] as const)
                            : pickerFilter === 'image'
                              ? (['image'] as const)
                              : pickerFilter === 'chart'
                                ? (['chart'] as const)
                                : []
                )
                  .flatMap((k) =>
                    (composerDocs[k] || []).map((d) => ({ ...d, k })),
                  )
                  .map((d) => {
                    const picked = Boolean(composerContext[d.id]);
                    const isEOS = ['sheet', 'vto', 'accountability'].includes(
                      d.k,
                    );

                    // Visual preview icons for different document types
                    const getPreviewIcon = () => {
                      switch (d.k) {
                        case 'sheet':
                          return '📊';
                        case 'vto':
                          return '🎯';
                        case 'accountability':
                          return '👥';
                        case 'text':
                          return '📝';
                        case 'code':
                          return '💻';
                        case 'image':
                          return '🎨';
                        case 'chart':
                          return '📈';
                        default:
                          return '📄';
                      }
                    };

                    const getTypeName = () => {
                      switch (d.k) {
                        case 'sheet':
                          return 'Scorecard';
                        case 'vto':
                          return 'V/TO';
                        case 'accountability':
                          return 'A/C';
                        case 'text':
                          return 'Document';
                        case 'code':
                          return 'Code';
                        case 'image':
                          return 'Image';
                        case 'chart':
                          return 'Chart';
                        default:
                          return d.k;
                      }
                    };

                    return (
                      <button
                        key={`${d.k}-${d.id}`}
                        type="button"
                        onClick={() =>
                          setComposerContext((m) => ({ ...m, [d.id]: !picked }))
                        }
                        className={cn(
                          'rounded-lg border p-4 text-left hover:shadow-md transition-all duration-200 group relative overflow-hidden',
                          picked
                            ? 'border-emerald-500/70 bg-emerald-500/5 shadow-sm'
                            : 'hover:bg-muted/40 hover:border-foreground/20',
                        )}
                        aria-label={`${picked ? 'Remove' : 'Select'} ${d.title || 'Untitled'} ${getTypeName()} document for AI context`}
                        aria-pressed={picked}
                      >
                        {/* Visual preview section */}
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={cn(
                              'flex items-center justify-center w-12 h-12 rounded-lg text-2xl',
                              isEOS ? 'bg-primary/10' : 'bg-secondary/10',
                            )}
                          >
                            {getPreviewIcon()}
                          </div>
                          <div className="flex-1">
                            <div
                              className={cn(
                                'text-xs font-medium uppercase tracking-wider mb-1',
                                isEOS ? 'text-primary/70' : 'text-secondary/70',
                              )}
                            >
                              {getTypeName()}
                            </div>
                            <div className="text-sm font-semibold line-clamp-2">
                              {d.title || 'Untitled'}
                            </div>
                          </div>
                        </div>

                        {/* Status indicator */}
                        <div
                          className={cn(
                            'text-xs mt-2 flex items-center gap-1',
                            picked
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground',
                          )}
                        >
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              picked
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground/30',
                            )}
                          />
                          {picked ? 'Selected as context' : 'Click to select'}
                        </div>

                        {/* Hover effect overlay */}
                        <div
                          className={cn(
                            'absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
                          )}
                        />
                      </button>
                    );
                  })
              )}
              {!composerLoading &&
                (pickerFilter === 'all'
                  ? ([
                      'sheet',
                      'vto',
                      'accountability',
                      'text',
                      'code',
                      'image',
                      'chart',
                    ] as const)
                  : pickerFilter === 'scorecard'
                    ? (['sheet'] as const)
                    : pickerFilter === 'vto'
                      ? (['vto'] as const)
                      : pickerFilter === 'accountability'
                        ? (['accountability'] as const)
                        : pickerFilter === 'text'
                          ? (['text'] as const)
                          : pickerFilter === 'code'
                            ? (['code'] as const)
                            : pickerFilter === 'image'
                              ? (['image'] as const)
                              : pickerFilter === 'chart'
                                ? (['chart'] as const)
                                : []
                ).flatMap((k) =>
                  (composerDocs[k] || []).map((d) => ({ ...d, k })),
                ).length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <p className="text-sm">
                      No{' '}
                      {pickerFilter === 'all'
                        ? 'composers'
                        : pickerFilter === 'scorecard'
                          ? 'Scorecard'
                          : pickerFilter === 'vto'
                            ? 'V/TO'
                            : pickerFilter === 'accountability'
                              ? 'Accountability Chart'
                              : pickerFilter === 'text'
                                ? 'Document'
                                : pickerFilter === 'code'
                                  ? 'Code'
                                  : pickerFilter === 'image'
                                    ? 'Image'
                                    : pickerFilter === 'chart'
                                      ? 'Chart'
                                      : pickerFilter}{' '}
                      documents found.
                    </p>
                    <p className="text-xs mt-2">
                      Create a new{' '}
                      {pickerFilter === 'all'
                        ? 'composer'
                        : pickerFilter === 'scorecard'
                          ? 'Scorecard'
                          : pickerFilter === 'vto'
                            ? 'V/TO'
                            : pickerFilter === 'accountability'
                              ? 'Accountability Chart'
                              : pickerFilter}{' '}
                      document to see it here.
                    </p>
                  </div>
                )}
            </div>
            <AlertDialogFooter className="mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setShowComposerPicker(false)}
                className="min-w-[100px]"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  saveComposerSettings();
                  setShowComposerPicker(false);
                }}
                className="min-w-[120px]"
              >
                Save Selection
              </Button>
            </AlertDialogFooter>
          </div>
        </AnimatedModal>
      )}
    </>
  );
}
