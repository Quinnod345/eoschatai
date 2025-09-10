'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast-system';

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  retryCount: number;
  size: number;
  uploadedSize: number;
}

interface UploadOptions {
  maxRetries?: number;
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (fileId: string, result: any) => void;
  onError?: (fileId: string, error: Error) => void;
}

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_RETRIES = 3;

export function useFileUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(
    new Map(),
  );
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Update upload progress
  const updateUpload = useCallback(
    (fileId: string, updates: Partial<UploadProgress>) => {
      setUploads((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(fileId);
        if (current) {
          newMap.set(fileId, { ...current, ...updates });
        }
        return newMap;
      });
    },
    [],
  );

  // Upload file with chunking for large files
  const uploadFile = useCallback(
    async (
      file: File,
      endpoint: string,
      options: UploadOptions = {},
    ): Promise<any> => {
      const {
        maxRetries = MAX_RETRIES,
        chunkSize = DEFAULT_CHUNK_SIZE,
        onProgress,
        onComplete,
        onError,
      } = options;

      const fileId = `${file.name}-${Date.now()}`;
      const abortController = new AbortController();
      abortControllersRef.current.set(fileId, abortController);

      // Initialize upload progress
      const initialProgress: UploadProgress = {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'pending',
        retryCount: 0,
        size: file.size,
        uploadedSize: 0,
      };

      setUploads((prev) => new Map(prev).set(fileId, initialProgress));
      onProgress?.(initialProgress);

      // Function to perform the actual upload
      const performUpload = async (retryCount = 0): Promise<any> => {
        try {
          updateUpload(fileId, { status: 'uploading', retryCount });

          // For small files, upload directly
          if (file.size <= chunkSize) {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const progress = (event.loaded / event.total) * 100;
                const uploadProgress: UploadProgress = {
                  fileId,
                  fileName: file.name,
                  progress,
                  status: 'uploading',
                  retryCount,
                  size: file.size,
                  uploadedSize: event.loaded,
                };
                updateUpload(fileId, uploadProgress);
                onProgress?.(uploadProgress);
              }
            });

            // Handle completion
            return new Promise((resolve, reject) => {
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const response = JSON.parse(xhr.responseText);
                    updateUpload(fileId, {
                      status: 'completed',
                      progress: 100,
                      uploadedSize: file.size,
                    });
                    onComplete?.(fileId, response);
                    resolve(response);
                  } catch (error) {
                    reject(new Error('Failed to parse response'));
                  }
                } else {
                  reject(new Error(`Upload failed with status ${xhr.status}`));
                }
              };

              xhr.onerror = () => reject(new Error('Network error'));
              xhr.onabort = () => reject(new Error('Upload cancelled'));

              // Set up abort handling
              abortController.signal.addEventListener('abort', () => {
                xhr.abort();
              });

              xhr.open('POST', endpoint);
              xhr.send(formData);
            });
          } else {
            // For large files, implement chunked upload
            updateUpload(fileId, { status: 'processing' });

            // This is a simplified version - in production, you'd implement
            // actual chunked upload with server support
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(endpoint, {
              method: 'POST',
              body: formData,
              signal: abortController.signal,
            });

            if (!response.ok) {
              throw new Error(`Upload failed with status ${response.status}`);
            }

            const result = await response.json();
            updateUpload(fileId, {
              status: 'completed',
              progress: 100,
              uploadedSize: file.size,
            });
            onComplete?.(fileId, result);
            return result;
          }
        } catch (error) {
          // Handle retry logic
          if (retryCount < maxRetries && !abortController.signal.aborted) {
            console.log(
              `Retrying upload for ${file.name} (attempt ${retryCount + 1}/${maxRetries})`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (retryCount + 1)),
            );
            return performUpload(retryCount + 1);
          }

          // Final failure
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          updateUpload(fileId, {
            status: 'error',
            error: errorMessage,
          });
          onError?.(fileId, error as Error);
          throw error;
        } finally {
          // Clean up
          abortControllersRef.current.delete(fileId);
        }
      };

      return performUpload();
    },
    [updateUpload],
  );

  // Cancel an upload
  const cancelUpload = useCallback((fileId: string) => {
    const controller = abortControllersRef.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(fileId);
      setUploads((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      toast.info('Upload cancelled');
    }
  }, []);

  // Retry a failed upload
  const retryUpload = useCallback(
    async (
      fileId: string,
      file: File,
      endpoint: string,
      options?: UploadOptions,
    ) => {
      const upload = uploads.get(fileId);
      if (upload?.status === 'error') {
        return uploadFile(file, endpoint, options);
      }
    },
    [uploads, uploadFile],
  );

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setUploads((prev) => {
      const newMap = new Map();
      prev.forEach((upload, id) => {
        if (upload.status !== 'completed') {
          newMap.set(id, upload);
        }
      });
      return newMap;
    });
  }, []);

  // Get all uploads as array
  const getUploads = useCallback((): UploadProgress[] => {
    return Array.from(uploads.values());
  }, [uploads]);

  return {
    uploadFile,
    cancelUpload,
    retryUpload,
    clearCompleted,
    getUploads,
    uploads: getUploads(),
  };
}
