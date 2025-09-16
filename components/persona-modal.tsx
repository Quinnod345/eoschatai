'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserIcon, ImageIcon } from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropper } from '@/components/image-cropper';
import { toast } from '@/lib/toast-system';
import Image from 'next/image';
import type { Persona, UserDocument } from '@/lib/db/schema';
import { ComposerPickerModal } from '@/components/composer-picker-modal';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona?: Persona;
  onSave: () => void;
}

export function PersonaModal({
  isOpen,
  onClose,
  persona,
  onSave,
}: PersonaModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    documentIds: [] as string[],
    iconUrl: '',
  });
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Icon upload states
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Composer context selection state (persona RAG extras via user settings)
  const [usePrimaryDocsForPersona, setUsePrimaryDocsForPersona] =
    useState(true);
  const [composerContext, setComposerContext] = useState<{
    [key: string]: boolean;
  }>({});
  const [composerDocs, setComposerDocs] = useState<
    Record<string, { id: string; title: string; kind: string }[]>
  >({});
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [showComposerPicker, setShowComposerPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState<
    | 'all'
    | 'scorecard'
    | 'vto'
    | 'accountability'
    | 'text'
    | 'code'
    | 'image'
    | 'chart'
  >('all');

  const isEditing = !!persona;

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      fetchComposerDocs();
      fetchComposerSettings();
      if (persona) {
        fetchPersonaDetails();
      } else {
        resetForm();
      }
      setErrors({});
    }
  }, [isOpen, persona]);

  // Fetch composer documents by kind for picker tabs - initial and on-demand
  const fetchComposerDocs = async (specificKind?: string) => {
    setComposerLoading(true);
    setComposerError(null);
    try {
      if (specificKind) {
        const res = await fetch(`/api/documents?composerKind=${specificKind}`);
        if (res.ok) {
          const data = await res.json();
          setComposerDocs((prev) => ({
            ...prev,
            [specificKind]: data.documents || [],
          }));
        }
      } else {
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
      setComposerError('Failed to load composer documents. Please try again.');
    } finally {
      setComposerLoading(false);
    }
  };

  // Fetch global toggle only; composer selections are per-persona
  const fetchComposerSettings = async () => {
    try {
      const res = await fetch('/api/user-settings');
      if (!res.ok) return;
      const s = await res.json();
      setUsePrimaryDocsForPersona(Boolean(s?.usePrimaryDocsForPersona ?? true));
    } catch {}
  };

  // Save per-persona composer selection and global toggle
  const saveComposerSettings = async () => {
    try {
      // Save global toggle
      try {
        await fetch('/api/user-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usePrimaryDocsForPersona: usePrimaryDocsForPersona,
          }),
        });
      } catch {}

      // Save per-persona composer docs if editing
      if (isEditing && persona?.id) {
        const ids = Object.entries(composerContext)
          .filter(([, v]) => v)
          .map(([k]) => k);
        const res = await fetch(`/api/personas/${persona.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            instructions: formData.instructions,
            documentIds: formData.documentIds,
            composerDocumentIds: ids,
          }),
        });
        if (!res.ok) throw new Error('Failed to save composer selection');
      }
      toast.success('Composer selection saved');
    } catch {
      toast.error('Failed to save composer selection');
    }
  };

  // Fetch composer documents when picker filter changes (on-demand)
  useEffect(() => {
    if (showComposerPicker && pickerFilter !== 'all') {
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
  }, [showComposerPicker, pickerFilter, composerDocs]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      instructions: '',
      documentIds: [],
      iconUrl: '',
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Persona name is required';
    } else if (formData.name.length > 128) {
      newErrors.name = 'Persona name must be 128 characters or less';
    }

    if (!formData.instructions.trim()) {
      newErrors.instructions = 'Instructions are required';
    } else if (formData.instructions.length < 20) {
      newErrors.instructions = 'Instructions should be at least 20 characters';
    }

    if (formData.description && formData.description.length > 255) {
      newErrors.description = 'Description must be 255 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch('/api/user-documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const fetchPersonaDetails = async () => {
    if (!persona) return;

    try {
      const response = await fetch(`/api/personas/${persona.id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.name,
          description: data.description || '',
          instructions: data.instructions,
          documentIds: data.documentIds || [],
          iconUrl: data.iconUrl || '',
        });
        // Load per-persona composer selections
        const ctxMap: { [key: string]: boolean } = {};
        if (Array.isArray(data?.composerDocumentIds)) {
          for (const id of data.composerDocumentIds) ctxMap[id] = true;
        }
        setComposerContext(ctxMap);
      }
    } catch (error) {
      console.error('Error fetching persona details:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/personas/${persona.id}` : '/api/personas';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          composerDocumentIds: Object.entries(composerContext)
            .filter(([, v]) => v)
            .map(([k]) => k),
        }),
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        const error = await response.json();
        console.error('Error saving persona:', error);
        setErrors({ submit: error.message || 'Failed to save persona' });
      }
    } catch (error) {
      console.error('Error saving persona:', error);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setFormData((prev) => ({
      ...prev,
      documentIds: prev.documentIds.includes(documentId)
        ? prev.documentIds.filter((id) => id !== documentId)
        : [...prev.documentIds, documentId],
    }));
  };

  // Icon upload functions
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
      );
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    // Create a URL for the image to show in the cropper
    const imageUrl = URL.createObjectURL(file);
    setCropperImage(imageUrl);
    setIsCropperOpen(true);

    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropperClose = () => {
    setIsCropperOpen(false);
    if (cropperImage) {
      URL.revokeObjectURL(cropperImage);
      setCropperImage(null);
    }
  };

  const handleCroppedIconUpload = async (
    croppedAreaPixels: any,
    croppedBlob: Blob,
  ) => {
    if (!persona?.id && !isEditing) {
      toast.error('Please save the persona first before uploading an icon.');
      handleCropperClose();
      return;
    }

    try {
      setUploadingIcon(true);
      setIsCropperOpen(false);

      // Validate the cropped blob
      if (!croppedBlob || croppedBlob.size === 0) {
        throw new Error('The cropped image is empty. Please try again.');
      }

      const formData = new FormData();
      formData.append('file', croppedBlob, 'icon.jpg');

      // Log upload size for debugging
      console.log(`Uploading persona icon: ${croppedBlob.size} bytes`);

      const personaId = persona?.id;
      if (!personaId) {
        throw new Error('Persona ID is required for icon upload');
      }

      const response = await fetch(`/api/personas/${personaId}/icon`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        if (!data.url) {
          throw new Error('No URL returned from server');
        }

        // Update state with the new icon URL
        setFormData((prev) => ({
          ...prev,
          iconUrl: data.url,
        }));

        toast.success('Persona icon updated');

        // Trigger personas refresh
        window.dispatchEvent(new CustomEvent('personasUpdated'));
      } else {
        let errorMessage = 'Failed to upload persona icon';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If the response isn't JSON, use status text
          errorMessage = `Server error: ${response.statusText || response.status}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error uploading persona icon:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to upload persona icon. Please try again.',
      );
    } finally {
      setUploadingIcon(false);
      // Clean up the object URL
      if (cropperImage) {
        URL.revokeObjectURL(cropperImage);
        setCropperImage(null);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-background/95 backdrop-blur-md border-2 border-border/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-full flex flex-col"
        >
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-eos-orange to-eos-orangeLight bg-clip-text text-transparent">
              {isEditing ? 'Edit EOS Persona' : 'Create New EOS Persona'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isEditing
                ? 'Update your AI persona with custom instructions and knowledge.'
                : 'Create a specialized AI persona with custom instructions and knowledge base.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col min-h-0"
          >
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-4">
                {/* Persona Name */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Label
                    htmlFor="name"
                    className="text-sm font-semibold text-foreground"
                  >
                    Persona Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }));
                      if (errors.name)
                        setErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    placeholder="e.g., EOS Implementation Expert"
                    className={`transition-all duration-200 ${
                      errors.name
                        ? 'border-destructive focus:border-destructive ring-destructive/20'
                        : 'focus:border-eos-orange focus:ring-eos-orange/20'
                    }`}
                    maxLength={128}
                  />
                  <div className="flex justify-between items-center">
                    {errors.name && (
                      <motion.p
                        className="text-sm text-destructive"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {errors.name}
                      </motion.p>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formData.name.length}/128
                    </span>
                  </div>
                </motion.div>

                {/* Persona Icon */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <Label className="text-sm font-semibold text-foreground">
                    Persona Icon
                  </Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleIconChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="relative">
                      <div
                        className="h-16 w-16 rounded-full overflow-hidden border-2 border-border transition-all duration-200 hover:shadow-md flex items-center justify-center bg-muted/20 dark:border-muted"
                        style={{
                          objectFit: 'cover',
                          borderRadius: '50%',
                        }}
                      >
                        {formData.iconUrl ? (
                          <Image
                            src={formData.iconUrl}
                            alt="Persona Icon"
                            fill
                            className="object-cover rounded-full"
                            onError={(e) => {
                              // If image fails to load, fall back to placeholder
                              e.currentTarget.src =
                                'https://via.placeholder.com/150?text=Icon';
                            }}
                          />
                        ) : (
                          <UserIcon size={32} />
                        )}
                      </div>
                      {uploadingIcon && (
                        <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-eos-orange/30 border-t-eos-orange rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingIcon || !isEditing}
                        className="flex items-center gap-2 hover:bg-accent/50 transition-colors duration-200"
                      >
                        <ImageIcon size={16} />
                        {formData.iconUrl ? 'Change Icon' : 'Upload Icon'}
                      </Button>
                      {!isEditing && (
                        <p className="text-xs text-muted-foreground">
                          Save the persona first to upload an icon
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Description */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Label
                    htmlFor="description"
                    className="text-sm font-semibold text-foreground"
                  >
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }));
                      if (errors.description)
                        setErrors((prev) => ({ ...prev, description: '' }));
                    }}
                    placeholder="Brief description of this persona's expertise"
                    className={`transition-all duration-200 ${
                      errors.description
                        ? 'border-destructive focus:border-destructive ring-destructive/20'
                        : 'focus:border-eos-orange focus:ring-eos-orange/20'
                    }`}
                    maxLength={255}
                  />
                  <div className="flex justify-between items-center">
                    {errors.description && (
                      <motion.p
                        className="text-sm text-destructive"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {errors.description}
                      </motion.p>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formData.description.length}/255
                    </span>
                  </div>
                </motion.div>

                {/* Instructions */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Label
                    htmlFor="instructions"
                    className="text-sm font-semibold text-foreground"
                  >
                    Instructions *
                  </Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        instructions: e.target.value,
                      }));
                      if (errors.instructions)
                        setErrors((prev) => ({ ...prev, instructions: '' }));
                    }}
                    placeholder="Detailed instructions for how this AI persona should behave, what expertise it has, and how it should respond to users..."
                    rows={6}
                    className={`transition-all duration-200 resize-none ${
                      errors.instructions
                        ? 'border-destructive focus:border-destructive ring-destructive/20'
                        : 'focus:border-eos-orange focus:ring-eos-orange/20'
                    }`}
                  />
                  {errors.instructions && (
                    <motion.p
                      className="text-sm text-destructive"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {errors.instructions}
                    </motion.p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Be specific about the persona&apos;s role, expertise,
                    communication style, and any special knowledge or focus
                    areas.
                  </p>
                </motion.div>

                <Separator className="bg-border/50" />

                {/* Associated Documents */}
                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div>
                    <Label className="text-sm font-semibold text-foreground">
                      Associated Documents
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select documents that this persona should have access to
                      for context and knowledge.
                    </p>
                  </div>

                  {isLoadingDocuments ? (
                    <div className="flex items-center gap-3 py-8 justify-center">
                      <div className="w-5 h-5 border-2 border-eos-orange/30 border-t-eos-orange rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Loading documents...
                      </span>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8 px-4 border-2 border-dashed border-border/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        No documents available. Upload documents in your account
                        settings to associate them with personas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto border border-border/50 rounded-lg p-3">
                      <AnimatePresence>
                        {documents.map((doc, index) => (
                          <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200 group"
                          >
                            <Checkbox
                              id={doc.id}
                              checked={formData.documentIds.includes(doc.id)}
                              onCheckedChange={() =>
                                handleDocumentToggle(doc.id)
                              }
                              className="data-[state=checked]:bg-eos-orange data-[state=checked]:border-eos-orange"
                            />
                            <Label
                              htmlFor={doc.id}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground group-hover:text-eos-orange transition-colors">
                                  {doc.fileName}
                                </span>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                  {doc.category}
                                </span>
                              </div>
                            </Label>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {formData.documentIds.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-sm text-eos-orange bg-eos-orange/10 border border-eos-orange/20 rounded-lg p-3"
                    >
                      {formData.documentIds.length} document
                      {formData.documentIds.length !== 1 ? 's' : ''} selected
                    </motion.div>
                  )}
                </motion.div>

                {/* Composer Documents (Persona RAG extras) */}
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <Label className="text-sm font-semibold text-foreground">
                          Composer Documents
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Choose which of your composers should be used as
                          persona RAG context.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowComposerPicker(true)}
                      >
                        Choose Composers
                      </Button>
                    </div>

                    <div className="mb-3 p-3 bg-muted/30 rounded-md flex items-center justify-between">
                      <label className="text-xs flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={usePrimaryDocsForPersona}
                          onChange={(e) =>
                            setUsePrimaryDocsForPersona(e.target.checked)
                          }
                          className="w-4 h-4"
                        />
                        Use primary composers automatically for this persona
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveComposerSettings}
                      >
                        Save Composer Context
                      </Button>
                    </div>

                    <div className="mt-2">
                      {Object.entries(composerContext).filter(([, v]) => v)
                        .length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Selected composers:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(composerContext)
                              .filter(([, v]) => v)
                              .map(([docId]) => {
                                const doc = Object.values(composerDocs)
                                  .flat()
                                  .find((d) => d.id === docId);
                                if (!doc) return null;
                                const icon =
                                  doc.kind === 'sheet'
                                    ? '📊'
                                    : doc.kind === 'vto'
                                      ? '🎯'
                                      : doc.kind === 'accountability'
                                        ? '👥'
                                        : doc.kind === 'text'
                                          ? '📝'
                                          : doc.kind === 'code'
                                            ? '💻'
                                            : doc.kind === 'image'
                                              ? '🎨'
                                              : doc.kind === 'chart'
                                                ? '📈'
                                                : '📄';
                                const typeName =
                                  doc.kind === 'sheet'
                                    ? 'Scorecard'
                                    : doc.kind === 'vto'
                                      ? 'V/TO'
                                      : doc.kind === 'accountability'
                                        ? 'A/C'
                                        : doc.kind === 'text'
                                          ? 'Document'
                                          : doc.kind === 'code'
                                            ? 'Code'
                                            : doc.kind === 'image'
                                              ? 'Image'
                                              : doc.kind === 'chart'
                                                ? 'Chart'
                                                : doc.kind;
                                return (
                                  <div
                                    key={docId}
                                    className="flex items-center gap-2 p-2 bg-muted/30 rounded-md"
                                  >
                                    <span className="text-lg">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {doc.title || 'Untitled'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {typeName}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                              .filter(Boolean)}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No composers selected. Click "Choose Composers" to
                          select documents for persona context.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            </ScrollArea>

            {/* Error Display */}
            {errors.submit && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
              >
                <p className="text-sm text-destructive">{errors.submit}</p>
              </motion.div>
            )}

            <DialogFooter className="pt-6 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="hover:bg-accent/50 transition-colors duration-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !formData.name.trim() ||
                  !formData.instructions.trim()
                }
                className="bg-gradient-to-r from-eos-orange to-eos-orangeLight hover:from-eos-orange/90 hover:to-eos-orangeLight/90 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </motion.div>
                ) : (
                  <span>{isEditing ? 'Update Persona' : 'Create Persona'}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </motion.div>
      </DialogContent>

      {/* Image Cropper Modal */}
      {isCropperOpen && cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCroppedIconUpload}
          onCancel={handleCropperClose}
          aspectRatio={1} // Square aspect ratio for icons
        />
      )}

      {/* Composer Picker Modal */}
      <ComposerPickerModal
        isOpen={showComposerPicker}
        onClose={() => setShowComposerPicker(false)}
        composerDocs={composerDocs}
        composerContext={composerContext}
        setComposerContext={setComposerContext}
        composerLoading={composerLoading}
        composerError={composerError}
        pickerFilter={pickerFilter}
        setPickerFilter={setPickerFilter}
        onSave={saveComposerSettings}
      />
    </Dialog>
  );
}
