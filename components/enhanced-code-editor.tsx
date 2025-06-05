'use client';

import { EditorView } from '@codemirror/view';
import { EditorState, Transaction, } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import type { Suggestion } from '@/lib/db/schema';
import { Button } from './ui/button';
import { SparklesIcon, CodeIcon, WarningIcon, RocketIcon } from './icons';
import { toast } from 'sonner';

type EnhancedCodeEditorProps = {
  content: string;
  onSaveContent: (
    updatedContent: string,
    debounce: boolean,
    range?: { start: number; end: number },
  ) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
  language?: 'python' | 'javascript' | 'html' | 'css' | 'json';
  onAIEdit?: (
    prompt: string,
    selectedText: string,
    range: { start: number; end: number },
  ) => void;
};

function PureEnhancedCodeEditor({
  content,
  onSaveContent,
  status,
  language = 'python',
  onAIEdit,
}: EnhancedCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Get language extension based on language prop
  const getLanguageExtension = useCallback(() => {
    switch (language) {
      case 'javascript':
        return javascript();
      case 'html':
        return html();
      case 'css':
        return css();
      case 'json':
        return json();
      case 'python':
      default:
        return python();
    }
  }, [language]);

  // Enhanced update listener with range tracking
  const createUpdateListener = useCallback(() => {
    return EditorView.updateListener.of((update) => {
      // Track selection changes
      if (update.selectionSet) {
        const selection = update.state.selection.main;
        if (!selection.empty) {
          const selectedContent = update.state.doc.sliceString(
            selection.from,
            selection.to,
          );
          setSelectedText(selectedContent);
          setSelectionRange({ start: selection.from, end: selection.to });
        } else {
          setSelectedText('');
          setSelectionRange(null);
        }
      }

      // Handle content changes
      if (update.docChanged) {
        const transaction = update.transactions.find(
          (tr) => !tr.annotation(Transaction.remote),
        );

        if (transaction) {
          const newContent = update.state.doc.toString();

          // Calculate change range
          let changeRange: { start: number; end: number } | undefined;
          if (transaction.changes && !transaction.changes.empty) {
            transaction.changes.iterChanges((fromA, toA) => {
              changeRange = { start: fromA, end: toA };
            });
          }

          onSaveContent(newContent, true, changeRange);
        }
      }
    });
  }, [onSaveContent]);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const updateListener = createUpdateListener();

      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          getLanguageExtension(),
          oneDark,
          updateListener,
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  // Update extensions when language changes
  useEffect(() => {
    if (editorRef.current) {
      const updateListener = createUpdateListener();
      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup,
          getLanguageExtension(),
          oneDark,
          updateListener,
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [language, getLanguageExtension, createUpdateListener]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === 'streaming' || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  // AI-assisted editing functions
  const handleAIEdit = useCallback(async () => {
    if (!selectedText || !selectionRange || !aiPrompt.trim()) {
      toast.error('Please select code and enter a prompt');
      return;
    }

    setIsProcessingAI(true);

    try {
      if (onAIEdit) {
        await onAIEdit(aiPrompt, selectedText, selectionRange);
      } else {
        toast.info('AI editing not implemented yet');
      }

      setShowAIPrompt(false);
      setAIPrompt('');
    } catch (error) {
      console.error('AI editing error:', error);
      toast.error('Failed to process AI edit');
    } finally {
      setIsProcessingAI(false);
    }
  }, [selectedText, selectionRange, aiPrompt, onAIEdit]);

  const insertCodeAtSelection = useCallback(
    (newCode: string) => {
      if (!editorRef.current || !selectionRange) return;

      const transaction = editorRef.current.state.update({
        changes: {
          from: selectionRange.start,
          to: selectionRange.end,
          insert: newCode,
        },
        annotations: [Transaction.userEvent.of('ai-edit')],
      });

      editorRef.current.dispatch(transaction);
    },
    [selectionRange],
  );

  // Smart code suggestions based on selected content
  const getCodeSuggestions = useCallback(() => {
    if (!selectedText) return [];

    const suggestions = [];

    // General code improvements
    if (selectedText.length > 5) {
      suggestions.push({
        label: 'Optimize code',
        prompt: 'Optimize this code for better performance and readability',
        icon: <RocketIcon size={12} />,
      });
      suggestions.push({
        label: 'Add comments',
        prompt: 'Add helpful comments to explain this code',
        icon: <CodeIcon size={12} />,
      });
      suggestions.push({
        label: 'Fix bugs',
        prompt: 'Review this code for potential bugs and fix them',
        icon: <WarningIcon size={12} />,
      });
    }

    // Language-specific suggestions
    if (language === 'python') {
      if (selectedText.includes('def ')) {
        suggestions.push({
          label: 'Add docstring',
          prompt: 'Add a proper Python docstring to this function',
          icon: <CodeIcon size={12} />,
        });
      }
      if (selectedText.includes('for ') || selectedText.includes('while ')) {
        suggestions.push({
          label: 'Optimize loop',
          prompt: 'Optimize this Python loop for better performance',
          icon: <RocketIcon size={12} />,
        });
      }
    }

    if (language === 'javascript') {
      if (selectedText.includes('function ') || selectedText.includes('=>')) {
        suggestions.push({
          label: 'Add JSDoc',
          prompt: 'Add JSDoc comments to this JavaScript function',
          icon: <CodeIcon size={12} />,
        });
      }
      if (selectedText.includes('console.log')) {
        suggestions.push({
          label: 'Replace console.log',
          prompt:
            'Replace console.log with proper logging or remove debug statements',
          icon: <WarningIcon size={12} />,
        });
      }
    }

    return suggestions;
  }, [selectedText, language]);

  // Enhanced toolbar for selected code
  const CodeSelectionToolbar = () => {
    if (!selectedText || !selectionRange) return null;

    return (
      <div className="absolute z-10 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 flex items-center gap-2 top-2 right-2">
        <span className="text-xs text-muted-foreground">
          {selectedText.split('\n').length} lines selected
        </span>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAIPrompt(true)}
          className="flex items-center gap-1"
        >
          <SparklesIcon size={12} />
          AI Edit
        </Button>

        {getCodeSuggestions()
          .slice(0, 2)
          .map((suggestion) => (
            <Button
              key={suggestion.label}
              size="sm"
              variant="ghost"
              onClick={() => {
                setAIPrompt(suggestion.prompt);
                setShowAIPrompt(true);
              }}
              className="text-xs flex items-center gap-1"
            >
              {suggestion.icon}
              {suggestion.label}
            </Button>
          ))}
      </div>
    );
  };

  // AI prompt dialog for code editing
  const CodeAIPromptDialog = () => {
    if (!showAIPrompt) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">AI Code Edit</h3>

          <div className="mb-4">
            <div className="block text-sm font-medium mb-2">Selected code:</div>
            <pre className="bg-gray-100 dark:bg-zinc-700 p-3 rounded text-sm max-h-40 overflow-y-auto font-mono">
              {selectedText}
            </pre>
          </div>

          <div className="mb-4">
            <label
              htmlFor="code-ai-prompt-input"
              className="block text-sm font-medium mb-2"
            >
              What would you like to do with this code?
            </label>
            <textarea
              id="code-ai-prompt-input"
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              placeholder="e.g., Optimize for performance, add error handling, convert to async/await..."
              className="w-full p-3 border border-zinc-200 dark:border-zinc-600 rounded resize-none"
              rows={3}
              autoFocus
            />
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Quick suggestions:</div>
            <div className="flex flex-wrap gap-2">
              {getCodeSuggestions().map((suggestion) => (
                <Button
                  key={suggestion.label}
                  size="sm"
                  variant="outline"
                  onClick={() => setAIPrompt(suggestion.prompt)}
                  className="text-xs flex items-center gap-1"
                >
                  {suggestion.icon}
                  {suggestion.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAIPrompt(false);
                setAIPrompt('');
              }}
              disabled={isProcessingAI}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAIEdit}
              disabled={!aiPrompt.trim() || isProcessingAI}
              className="flex items-center gap-1"
            >
              {isProcessingAI ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <SparklesIcon size={14} />
                  Apply AI Edit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative not-prose w-full pb-[calc(80dvh)] text-sm">
      <div ref={containerRef} />
      <CodeSelectionToolbar />
      <CodeAIPromptDialog />
    </div>
  );
}

function areEqual(
  prevProps: EnhancedCodeEditorProps,
  nextProps: EnhancedCodeEditorProps,
) {
  if (prevProps.suggestions !== nextProps.suggestions) return false;
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
    return false;
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
  if (prevProps.status === 'streaming' && nextProps.status === 'streaming')
    return false;
  if (prevProps.content !== nextProps.content) return false;
  if (prevProps.language !== nextProps.language) return false;

  return true;
}

export const EnhancedCodeEditor = memo(PureEnhancedCodeEditor, areEqual);
