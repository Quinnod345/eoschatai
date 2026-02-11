'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles } from 'lucide-react';

type PersonaOverlayPersona = {
  id: string;
  name: string;
  description?: string | null;
  instructions?: string;
  lockInstructions?: boolean;
  allowUserOverlay?: boolean;
  allowUserKnowledge?: boolean;
};

type UserDoc = {
  id: string;
  fileName: string;
  category?: string;
};

export function PersonaOverlayEditor({
  isOpen,
  onClose,
  personaId,
}: {
  isOpen: boolean;
  onClose: () => void;
  personaId: string | null;
}) {
  const [persona, setPersona] = useState<PersonaOverlayPersona | null>(null);
  const [documents, setDocuments] = useState<UserDoc[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [overlayExists, setOverlayExists] = useState(false);

  const canEditOverlay = Boolean(persona?.allowUserOverlay);
  const canEditKnowledge = Boolean(persona?.allowUserKnowledge);
  const hasCustomizationEnabled = canEditOverlay || canEditKnowledge;

  useEffect(() => {
    if (!isOpen || !personaId) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setOverlayExists(false);
        setAdditionalInstructions('');
        setSelectedDocumentIds([]);

        const personaResponse = await fetch(`/api/personas/${personaId}`);
        if (!personaResponse.ok) {
          throw new Error('Failed to load persona');
        }
        const personaPayload = await personaResponse.json();
        setPersona(personaPayload);

        if (
          personaPayload.allowUserOverlay === true ||
          personaPayload.allowUserKnowledge === true
        ) {
          const overlayResponse = await fetch(`/api/personas/${personaId}/overlay`);
          if (overlayResponse.ok) {
            const overlayPayload = await overlayResponse.json();
            setOverlayExists(true);
            setAdditionalInstructions(overlayPayload.additionalInstructions || '');
            setSelectedDocumentIds(overlayPayload.documentIds || []);
          } else if (overlayResponse.status !== 404) {
            const overlayError = await overlayResponse
              .json()
              .catch(() => ({ error: 'Failed to load overlay' }));
            throw new Error(overlayError.error || 'Failed to load overlay');
          }
        }

        if (personaPayload.allowUserKnowledge === true) {
          const docsResponse = await fetch('/api/user-documents');
          if (docsResponse.ok) {
            const docsPayload = await docsResponse.json();
            setDocuments(Array.isArray(docsPayload) ? docsPayload : []);
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load customization',
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isOpen, personaId]);

  const selectedDocCount = useMemo(
    () => selectedDocumentIds.length,
    [selectedDocumentIds],
  );

  const handleSave = async () => {
    if (!personaId) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/personas/${personaId}/overlay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          additionalInstructions,
          documentIds: selectedDocumentIds,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save customizations');
      }

      setOverlayExists(Boolean(payload?.id));
      toast.success('Persona customizations saved');
      window.dispatchEvent(new CustomEvent('personasUpdated'));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save customizations',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverlay = async () => {
    if (!personaId) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/personas/${personaId}/overlay`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to remove customizations');
      }

      setAdditionalInstructions('');
      setSelectedDocumentIds([]);
      setOverlayExists(false);
      toast.success('Customizations removed');
      window.dispatchEvent(new CustomEvent('personasUpdated'));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove customizations',
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleDocument = (documentId: string) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Customize Persona
          </DialogTitle>
          <DialogDescription>
            Add your private instructions and documents on top of this shared persona.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading customization options...
          </div>
        ) : !persona ? (
          <div className="text-sm text-muted-foreground">
            Persona details are unavailable.
          </div>
        ) : !hasCustomizationEnabled ? (
          <div className="text-sm text-muted-foreground">
            This shared persona does not allow member customization.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{persona.name}</p>
              {persona.description ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {persona.description}
                </p>
              ) : null}
            </div>

            {!persona.lockInstructions && persona.instructions ? (
              <div className="rounded-md border p-3 bg-muted/20">
                <p className="text-xs font-medium mb-1">Base Instructions</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {persona.instructions}
                </p>
              </div>
            ) : (
              <div className="rounded-md border p-3 bg-muted/20 text-xs text-muted-foreground">
                Base instructions are hidden by the persona admin.
              </div>
            )}

            {canEditOverlay ? (
              <div className="space-y-2">
                <Label htmlFor="overlay-instructions">Your Additional Instructions</Label>
                <Textarea
                  id="overlay-instructions"
                  value={additionalInstructions}
                  onChange={(event) => setAdditionalInstructions(event.target.value)}
                  rows={6}
                  placeholder="Add your personal guidance for how this persona should respond..."
                />
              </div>
            ) : null}

            {canEditKnowledge ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Your Overlay Documents</Label>
                  <Badge variant="secondary">{selectedDocCount} selected</Badge>
                </div>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Upload documents first in your personal documents area.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <ScrollArea className="h-40 p-2">
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 p-1">
                            <Checkbox
                              id={`overlay-doc-${doc.id}`}
                              checked={selectedDocumentIds.includes(doc.id)}
                              onCheckedChange={() => toggleDocument(doc.id)}
                            />
                            <Label
                              htmlFor={`overlay-doc-${doc.id}`}
                              className="text-xs cursor-pointer"
                            >
                              {doc.fileName}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-2">
              <div>
                {overlayExists ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleRemoveOverlay}
                    disabled={deleting || saving}
                  >
                    {deleting ? 'Removing...' : 'Remove My Customizations'}
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Customizations'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
