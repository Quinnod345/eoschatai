'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, BookOpen, Loader2 } from 'lucide-react';

type OrgKnowledgeDocument = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  processingError: string | null;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}

function statusBadgeVariant(status: OrgKnowledgeDocument['processingStatus']) {
  if (status === 'ready') {
    return 'default' as const;
  }
  if (status === 'failed') {
    return 'destructive' as const;
  }
  return 'secondary' as const;
}

export function OrgKnowledgeManager({
  orgId,
  canDelete,
}: {
  orgId: string;
  canDelete: boolean;
}) {
  const [documents, setDocuments] = useState<OrgKnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizations/${orgId}/knowledge`);
      if (!response.ok) {
        throw new Error('Failed to fetch organization knowledge');
      }
      const data = await response.json();
      setDocuments((data.documents || []) as OrgKnowledgeDocument[]);
    } catch (error) {
      toast.error('Failed to load organization knowledge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [orgId]);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'Org Document');

      const response = await fetch(`/api/organizations/${orgId}/knowledge`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to upload document');
      }

      if (payload?.duplicate) {
        toast.message('That document is already in your org knowledge base');
      } else {
        toast.success('Document uploaded to organization knowledge');
      }

      await fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      setDeletingId(documentId);
      const response = await fetch(
        `/api/organizations/${orgId}/knowledge?documentId=${documentId}`,
        {
          method: 'DELETE',
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete document');
      }
      toast.success('Document removed from organization knowledge');
      await fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Organization Knowledge Base
        </CardTitle>
        <CardDescription>
          Shared context for your whole organization. Uploaded files are available
          to members during chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Max file size: 20MB
          </span>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No organization knowledge uploaded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-md border p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.fileSize)} •{' '}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {doc.processingStatus === 'failed' && doc.processingError ? (
                    <p className="text-xs text-destructive mt-1">
                      {doc.processingError}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusBadgeVariant(doc.processingStatus)}>
                    {doc.processingStatus}
                  </Badge>
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
