'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast-system';
import { useRouter } from 'next/navigation';
import { generateUUID } from '@/lib/utils';
import {
  UndoIcon,
  RedoIcon,
  PencilEditIcon,
  PlusIcon,
  SparklesIcon,
} from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

type Version = {
  id: string;
  base64: string;
  prompt?: string;
  createdAt: number;
};

type ImageEntry = {
  id: string;
  title?: string;
  prompt?: string;
  versions: Version[];
  currentVersionIndex: number;
  createdAt: number;
};

type Gallery = {
  images: ImageEntry[];
  activeIndex: number;
};

function isGalleryJson(maybe: string | null | undefined): boolean {
  if (!maybe) return false;
  const s = String(maybe).trim();
  if (!s.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed?.images);
  } catch {
    return false;
  }
}

function migrateBase64ToGallery(base64: string, title: string): Gallery {
  const firstVersion: Version = {
    id: generateUUID(),
    base64,
    prompt: title || 'Generated image',
    createdAt: Date.now(),
  };
  const firstImage: ImageEntry = {
    id: generateUUID(),
    title,
    prompt: title,
    versions: [firstVersion],
    currentVersionIndex: 0,
    createdAt: Date.now(),
  };
  return { images: [firstImage], activeIndex: 0 };
}

// Match ComposerContent<M> signature to satisfy the Composer system
//
import type { Suggestion } from '@/lib/db/schema';
type ImageMetadata = { documentId?: string } | null;

// Accept the full ComposerContent shape; unused props are ignored safely
export function ImageComposerView({
  title,
  content,
  mode, // 'edit' | 'diff' | 'changes' — we ignore non-edit render modes here
  status,
  suggestions, // unused but part of signature
  isInline,
  isCurrentVersion,
  currentVersionIndex, // unused here
  onSaveContent,
  getDocumentContentById, // unused
  isLoading, // unused
  metadata,
  setMetadata, // unused here
}: {
  title: string;
  content: string;
  mode: 'edit' | 'diff' | 'changes';
  status: 'streaming' | 'idle';
  suggestions: Array<Suggestion>;
  isInline: boolean;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: ImageMetadata;
  setMetadata: (next: any) => void;
}) {
  const router = useRouter();

  // Parse gallery or migrate from single base64
  const initialGallery: Gallery = useMemo(() => {
    if (isGalleryJson(content)) return JSON.parse(content) as Gallery;
    const base64 = (content || '').trim();
    if (!base64) {
      return { images: [], activeIndex: 0 };
    }
    return migrateBase64ToGallery(base64, title || 'Image');
  }, [content, title]);

  const [gallery, setGallery] = useState<Gallery>(initialGallery);
  const activeImage = gallery.images[gallery.activeIndex];
  const activeVersion = activeImage?.versions[activeImage.currentVersionIndex];

  // If the incoming content changes (new version persisted), reconcile
  useEffect(() => {
    if (isGalleryJson(content)) {
      try {
        const next = JSON.parse(content) as Gallery;
        setGallery(next);
      } catch {}
    } else if ((content || '').trim()) {
      // If a plain base64 arrives (e.g., first creation), migrate and save once
      const migrated = migrateBase64ToGallery(String(content).trim(), title);
      setGallery(migrated);
      // Persist migration only if we are on current version to avoid clobbering history views
      if (isCurrentVersion) {
        onSaveContent(JSON.stringify(migrated), false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const canUndo = Boolean(activeImage && activeImage.currentVersionIndex > 0);
  const canRedo = Boolean(
    activeImage &&
      activeImage.currentVersionIndex < (activeImage?.versions.length || 0) - 1,
  );

  const handleSelectImage = useCallback(
    (index: number) => {
      setGallery((g) => ({ ...g, activeIndex: index }));
      // Persist selected image for continuity (debounced to reduce versions)
      try {
        const next = { ...gallery, activeIndex: index };
        onSaveContent(JSON.stringify(next), true);
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSaveContent, gallery],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo || !activeImage) return;
    setGallery((g) => {
      const next = { ...g };
      const img = next.images[next.activeIndex];
      img.currentVersionIndex = Math.max(0, img.currentVersionIndex - 1);
      return next;
    });
    try {
      const next = { ...gallery };
      next.images[next.activeIndex].currentVersionIndex = Math.max(
        0,
        (activeImage?.currentVersionIndex || 0) - 1,
      );
      onSaveContent(JSON.stringify(next), true);
    } catch {}
  }, [canUndo, activeImage, gallery, onSaveContent]);

  const handleRedo = useCallback(() => {
    if (!canRedo || !activeImage) return;
    setGallery((g) => {
      const next = { ...g };
      const img = next.images[next.activeIndex];
      img.currentVersionIndex = Math.min(
        img.versions.length - 1,
        img.currentVersionIndex + 1,
      );
      return next;
    });
    try {
      const next = { ...gallery };
      const img = next.images[next.activeIndex];
      img.currentVersionIndex = Math.min(
        img.versions.length - 1,
        (activeImage?.currentVersionIndex || 0) + 1,
      );
      onSaveContent(JSON.stringify(next), true);
    } catch {}
  }, [canRedo, activeImage, gallery, onSaveContent]);

  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingLoading, setIsEditingLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const documentId: string | undefined = (metadata as ImageMetadata)
    ?.documentId;

  const handleApplyEdit = useCallback(async () => {
    if (!documentId) {
      toast.error('Missing document id');
      return;
    }
    const prompt = (editPrompt || '').trim();
    if (!prompt) {
      toast.error('Please describe the edit');
      return;
    }

    setIsEditingLoading(true);

    try {
      const res = await fetch('/api/composer/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'update',
          id: documentId,
          kind: 'image',
          description: prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to edit image');

      const nextBase64: string = String(data?.content || '').trim();
      if (!nextBase64) throw new Error('No image content returned');

      // Push new version into the active image
      const next = { ...gallery };
      const img = next.images[next.activeIndex];
      const newVersion: Version = {
        id: generateUUID(),
        base64: nextBase64,
        prompt,
        createdAt: Date.now(),
      };
      img.versions = [...img.versions, newVersion];
      img.currentVersionIndex = img.versions.length - 1;

      setGallery(next);
      onSaveContent(JSON.stringify(next), false);
      toast.success('Image updated');
      setIsEditing(false);
      setEditPrompt('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to edit image');
    } finally {
      setIsEditingLoading(false);
    }
  }, [documentId, editPrompt, gallery, onSaveContent]);

  const handleCreateNewImage = useCallback(async () => {
    const prompt = (newPrompt || '').trim();
    if (!prompt) {
      toast.error('Please enter what you would like to create');
      return;
    }

    setIsCreatingLoading(true);
    setCreationProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setCreationProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    const newId = generateUUID();
    try {
      const res = await fetch('/api/composer/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          id: newId,
          title: prompt,
          kind: 'image',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create image');

      setCreationProgress(100);
      toast.success('New image created');

      // Open as a brand new composer in the UI
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('documentId', newId);
        url.searchParams.set('documentTitle', prompt);
        url.searchParams.set('composerKind', 'image');
        router.replace(url.toString());
        setIsCreatingNew(false);
        setNewPrompt('');
        setCreationProgress(0);
      }, 500);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create image');
    } finally {
      clearInterval(progressInterval);
      setIsCreatingLoading(false);
    }
  }, [newPrompt, router]);

  return (
    <div className={isInline ? 'p-2' : 'px-4 py-3'}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo || status === 'streaming'}
            title="Undo edit"
          >
            <UndoIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo || status === 'streaming'}
            title="Redo edit"
          >
            <RedoIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing((v) => !v)}
            disabled={!activeImage || status === 'streaming'}
            title="Edit selected image"
          >
            <PencilEditIcon />
            <span className="ml-1">Edit</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsCreatingNew(true)}
            title="Create a brand new image composer"
          >
            <PlusIcon />
            <span className="ml-1">New Image</span>
          </Button>
        </div>
      </div>

      {/* Edit prompt */}
      {isEditing && (
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Describe the changes to apply to this image"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyEdit();
            }}
          />
          <Button
            size="sm"
            onClick={handleApplyEdit}
            disabled={isEditingLoading}
          >
            {isEditingLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply'
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Create new image dialog */}
      <AnimatePresence>
        {isCreatingNew && (
          <Dialog open={isCreatingNew} onOpenChange={setIsCreatingNew}>
            <DialogContent size="default">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="h-5 w-5 text-primary">
                    <SparklesIcon size={20} />
                  </span>
                  Create New Image
                </DialogTitle>
                <DialogDescription>
                  Describe what you'd like to create. Be specific about style,
                  colors, and composition.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Input
                    placeholder="A serene landscape with mountains at sunset..."
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreatingLoading)
                        handleCreateNewImage();
                    }}
                    disabled={isCreatingLoading}
                    className="h-12"
                  />

                  {/* Creation progress */}
                  {isCreatingLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Creating your image...</span>
                        <span>{Math.round(creationProgress)}%</span>
                      </div>

                      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-primary rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${creationProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>

                      <div className="flex items-center justify-center py-8">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-full border-4 border-secondary" />
                          <motion.div
                            className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary border-t-transparent"
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Number.POSITIVE_INFINITY,
                              ease: 'linear',
                            }}
                          />
                          <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary">
                            <SparklesIcon size={32} />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewPrompt('');
                    }}
                    disabled={isCreatingLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateNewImage}
                    disabled={isCreatingLoading || !newPrompt.trim()}
                  >
                    {isCreatingLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Image'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Main image area */}
      <div className="w-full flex items-center justify-center">
        {status === 'streaming' || (isEditingLoading && activeImage) ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-secondary" />
                <motion.div
                  className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'linear',
                  }}
                />
                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary">
                  <SparklesIcon size={24} />
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {isEditingLoading ? 'Applying edits...' : 'Generating image...'}
              </div>
            </div>
          </motion.div>
        ) : activeVersion ? (
          <motion.div
            key={activeVersion.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={activeImage?.title || title || 'image'}
              src={`data:image/png;base64,${activeVersion.base64}`}
              className={
                isInline
                  ? 'max-h-[240px] object-contain'
                  : 'max-h-[70vh] object-contain'
              }
            />
          </motion.div>
        ) : (
          <motion.div
            className="text-center py-16 space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-lg bg-muted/50 flex items-center justify-center">
                <span className="h-10 w-10 text-muted-foreground/50">
                  <SparklesIcon size={40} />
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">No image yet</div>
              <div className="text-xs text-muted-foreground">
                Click "New Image" to create one
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Carousel */}
      {gallery.images.length > 0 && (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
          {gallery.images.map((img, index) => {
            const latest =
              img.versions[img.currentVersionIndex] ||
              img.versions[img.versions.length - 1];
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => handleSelectImage(index)}
                className={`relative rounded-md border ${
                  index === gallery.activeIndex
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-zinc-200 dark:border-zinc-800'
                } overflow-hidden shrink-0`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={img.title || 'thumb'}
                  src={`data:image/png;base64,${latest?.base64}`}
                  className="h-20 w-28 object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
