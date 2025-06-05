import { Artifact } from '@/components/create-artifact';
import {
  CopyIcon,
  DownloadIcon,
  RedoIcon,
  UndoIcon,
  SparklesIcon,
  PlayIcon,
} from '@/components/icons';
import { EnhancedCodeEditor } from '@/components/enhanced-code-editor';
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

interface CodeArtifactMetadata {
  language: 'python' | 'javascript' | 'typescript' | 'html' | 'css' | 'json';
  aiMode: boolean;
  suggestions: any[];
}

export const enhancedCodeArtifact = new Artifact<'code', CodeArtifactMetadata>({
  kind: 'code',
  description:
    'Enhanced code editing with AI assistance and syntax highlighting',
  initialize: async () => ({
    language: 'python' as const,
    aiMode: false,
    suggestions: [],
  }),
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === 'code-delta') {
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
      description: 'AI Code Assistant',
      onClick: ({ setMetadata }) => {
        setMetadata((prev: CodeArtifactMetadata) => ({
          ...prev,
          aiMode: !prev.aiMode,
        }));
        toast.success('AI code assistant toggled');
      },
    },
    {
      icon: <PlayIcon size={18} />,
      description: 'Run Code (Coming Soon)',
      onClick: () => {
        toast.info('Code execution feature coming soon!');
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Code copied to clipboard');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download as file',
      onClick: ({ content, title, metadata }) => {
        const language = metadata?.language || 'python';
        const extension = getFileExtension(language);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Code file downloaded');
      },
    },
  ],
  toolbar: [
    {
      label: 'Language',
      type: 'select',
      options: [
        { value: 'python', label: 'Python' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'html', label: 'HTML' },
        { value: 'css', label: 'CSS' },
        { value: 'json', label: 'JSON' },
      ],
      value: 'python',
      onChange: (value, { setMetadata }) => {
        setMetadata((prev: CodeArtifactMetadata) => ({
          ...prev,
          language: value as CodeArtifactMetadata['language'],
        }));
      },
    },
  ],
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
      return <DocumentSkeleton artifactKind="code" />;
    }

    if (mode === 'diff') {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    // AI editing handler for code
    const handleAIEdit = async (
      prompt: string,
      selectedText: string,
      range: { start: number; end: number },
    ) => {
      try {
        // Here you would integrate with your AI service for code editing
        toast.info('AI code editing feature coming soon!');

        // Example of how you might integrate with an AI service:
        // const response = await fetch('/api/ai/edit-code', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     prompt,
        //     selectedText,
        //     context: content,
        //     language: metadata?.language || 'python'
        //   }),
        // });
        // const { editedCode } = await response.json();
        //
        // // Apply the AI edit
        // const newContent = content.substring(0, range.start) + editedCode + content.substring(range.end);
        // onSaveContent(newContent, false, range);
      } catch (error) {
        console.error('AI code editing error:', error);
        toast.error('Failed to process AI code edit');
      }
    };

    return (
      <div className="flex flex-col h-full">
        <EnhancedCodeEditor
          content={content}
          suggestions={metadata ? metadata.suggestions : []}
          isCurrentVersion={isCurrentVersion}
          currentVersionIndex={currentVersionIndex}
          status={status}
          onSaveContent={onSaveContent}
          language={metadata?.language || 'python'}
          onAIEdit={handleAIEdit}
        />
      </div>
    );
  },
});

// Helper function to get file extension based on language
function getFileExtension(language: string): string {
  switch (language) {
    case 'python':
      return 'py';
    case 'javascript':
      return 'js';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    default:
      return 'txt';
  }
}
