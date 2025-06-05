import { Artifact } from '@/components/create-artifact';
import {
  CopyIcon,
  DownloadIcon,
  RedoIcon,
  UndoIcon,
  SparklesIcon,
} from '@/components/icons';
import { EnhancedEditor } from '@/components/enhanced-text-editor';
import { DiffView } from '@/components/diffview';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { toast } from 'sonner';

// Extend window interface for AI edit tracking
declare global {
  interface Window {
    __aiEditInProgress?: {
      description: string;
      originalContent: string;
      timestamp: string;
    };
  }
}

interface TextArtifactMetadata {
  suggestions: any[];
  aiMode?: boolean;
}

export const enhancedTextArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text',
  description: 'Enhanced text editing with AI assistance',
  initialize: async () => ({}),
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === 'text-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: draftArtifact.content + streamPart.content,
        isVisible: true,
        status: 'streaming',
      }));
    }

    // Handle AI edit events for change tracking integration
    if (streamPart.type === 'ai-edit-start') {
      try {
        const editData = JSON.parse(streamPart.content as string);
        // Store AI edit metadata for when the edit completes
        window.__aiEditInProgress = {
          description: editData.description,
          originalContent: editData.originalContent,
          timestamp: editData.timestamp,
        };
      } catch (error) {
        console.error('Failed to parse ai-edit-start data:', error);
      }
    }

    if (streamPart.type === 'ai-edit-complete') {
      try {
        const editData = JSON.parse(streamPart.content as string);
        const aiEditData = window.__aiEditInProgress;

        if (aiEditData) {
          // Trigger the enhanced artifact's change tracking
          const event = new CustomEvent('ai-edit-complete', {
            detail: {
              description: editData.description,
              originalContent: aiEditData.originalContent,
              newContent: '', // Will be set by the enhanced artifact
              timestamp: editData.timestamp,
            },
          });
          window.dispatchEvent(event);

          // Clean up
          window.__aiEditInProgress = undefined;
        }
      } catch (error) {
        console.error('Failed to parse ai-edit-complete data:', error);
      }
    }
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <SparklesIcon size={18} />,
      description: 'AI Enhancement Mode',
      onClick: ({ setMetadata }) => {
        setMetadata((prev: TextArtifactMetadata) => ({
          ...prev,
          aiMode: !prev.aiMode,
        }));
        toast.success('AI enhancement mode toggled');
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download as file',
      onClick: ({ content, title }) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('File downloaded');
      },
    },
  ],
  toolbar: [],
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === 'diff') {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    // AI editing handler
    const handleAIEdit = async (
      prompt: string,
      selectedText: string,
      range: { start: number; end: number },
    ) => {
      try {
        // Here you would integrate with your AI service
        // For now, we'll simulate an AI response
        toast.info('AI editing feature coming soon!');

        // Example of how you might integrate with an AI service:
        // const response = await fetch('/api/ai/edit-text', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ prompt, selectedText, context: content }),
        // });
        // const { editedText } = await response.json();
        //
        // // Apply the AI edit
        // const newContent = content.substring(0, range.start) + editedText + content.substring(range.end);
        // onSaveContent(newContent, false, range);
      } catch (error) {
        console.error('AI editing error:', error);
        toast.error('Failed to process AI edit');
      }
    };

    return (
      <>
        <div className="flex flex-row py-8 md:p-20 px-4">
          <EnhancedEditor
            content={content}
            suggestions={metadata ? metadata.suggestions : []}
            isCurrentVersion={isCurrentVersion}
            currentVersionIndex={currentVersionIndex}
            status={status}
            onSaveContent={onSaveContent}
            onAIEdit={handleAIEdit}
          />

          {metadata?.suggestions?.length > 0 ? (
            <div className="md:hidden h-dvh w-12 shrink-0" />
          ) : null}
        </div>
      </>
    );
  },
});
