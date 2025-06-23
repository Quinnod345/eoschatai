'use client';

import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';

import type { Suggestion } from '@/lib/db/schema';
import { documentSchema, headingRule } from '@/lib/editor/config';
import {
  buildContentFromDocument,
  buildDocumentFromContent,
  createDecorations,
} from '@/lib/editor/functions';
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
} from '@/lib/editor/suggestions';
import { Button } from './ui/button';
import { SparklesIcon } from './icons';
import { toast } from 'sonner';

type EnhancedEditorProps = {
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
  onAIEdit?: (
    prompt: string,
    selectedText: string,
    range: { start: number; end: number },
  ) => void;
};

function PureEnhancedEditor({
  content,
  onSaveContent,
  suggestions,
  status,
  onAIEdit,
}: EnhancedEditorProps) {
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

  // Enhanced transaction handler with range tracking
  const handleEnhancedTransaction = useCallback(
    (transaction: any) => {
      if (!editorRef || !editorRef.current) return;

      const newState = editorRef.current.state.apply(transaction);
      editorRef.current.updateState(newState);

      // Track selection changes
      const selection = newState.selection;
      if (selection && !selection.empty) {
        const selectedContent = newState.doc.textBetween(
          selection.from,
          selection.to,
        );
        setSelectedText(selectedContent);
        setSelectionRange({ start: selection.from, end: selection.to });
      } else {
        setSelectedText('');
        setSelectionRange(null);
      }

      // Handle content changes
      if (transaction.docChanged && !transaction.getMeta('no-save')) {
        const updatedContent = buildContentFromDocument(newState.doc);

        // Calculate the range of changes if possible
        let changeRange: { start: number; end: number } | undefined;

        if (transaction.steps && transaction.steps.length > 0) {
          const step = transaction.steps[0];
          if (step && 'from' in step && 'to' in step) {
            changeRange = {
              start: (step as any).from,
              end: (step as any).to,
            };
          }
        }

        if (transaction.getMeta('no-debounce')) {
          onSaveContent(updatedContent, false, changeRange);
        } else {
          onSaveContent(updatedContent, true, changeRange);
        }
      }
    },
    [onSaveContent],
  );

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
        dispatchTransaction: handleEnhancedTransaction,
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

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: handleEnhancedTransaction,
      });
    }
  }, [handleEnhancedTransaction]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc,
      );

      if (status === 'streaming') {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content,
        );

        transaction.setMeta('no-save', true);
        editorRef.current.dispatch(transaction);
        return;
      }

      if (currentContent !== content) {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content,
        );

        transaction.setMeta('no-save', true);
        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  useEffect(() => {
    if (editorRef.current?.state.doc && content) {
      const projectedSuggestions = projectWithPositions(
        editorRef.current.state.doc,
        suggestions,
      ).filter(
        (suggestion) => suggestion.selectionStart && suggestion.selectionEnd,
      );

      const decorations = createDecorations(
        projectedSuggestions,
        editorRef.current,
      );

      const transaction = editorRef.current.state.tr;
      transaction.setMeta(suggestionsPluginKey, { decorations });
      editorRef.current.dispatch(transaction);
    }
  }, [suggestions, content]);

  // AI-assisted editing functions
  const handleAIEdit = useCallback(async () => {
    if (!selectedText || !selectionRange || !aiPrompt.trim()) {
      toast.error('Please select text and enter a prompt');
      return;
    }

    setIsProcessingAI(true);

    try {
      // Call the AI editing function if provided
      if (onAIEdit) {
        await onAIEdit(aiPrompt, selectedText, selectionRange);
      } else {
        // Fallback: simple text replacement (you'd want to integrate with your AI service)
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

  const insertTextAtSelection = useCallback(
    (newText: string) => {
      if (!editorRef.current || !selectionRange) return;

      const transaction = editorRef.current.state.tr.replaceWith(
        selectionRange.start,
        selectionRange.end,
        editorRef.current.state.schema.text(newText),
      );

      transaction.setMeta('ai-edit', true);
      editorRef.current.dispatch(transaction);
    },
    [selectionRange],
  );

  // Smart editing suggestions
  const getSmartSuggestions = useCallback(() => {
    if (!selectedText) return [];

    const suggestions = [];

    // Grammar and style suggestions
    if (selectedText.length > 10) {
      suggestions.push({
        label: 'Improve grammar',
        prompt: 'Fix any grammar issues in this text',
      });
      suggestions.push({
        label: 'Make more concise',
        prompt: 'Make this text more concise while preserving meaning',
      });
      suggestions.push({
        label: 'Enhance clarity',
        prompt: 'Rewrite this text to be clearer and more readable',
      });
    }

    // Content-specific suggestions
    if (
      selectedText.toLowerCase().includes('todo') ||
      selectedText.toLowerCase().includes('fix')
    ) {
      suggestions.push({
        label: 'Expand action item',
        prompt: 'Expand this into a detailed action item with steps',
      });
    }

    return suggestions;
  }, [selectedText]);

  // Enhanced toolbar for selected text
  const SelectionToolbar = () => {
    if (!selectedText || !selectionRange) return null;

    return (
      <div className="absolute z-10 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {selectedText.length} chars selected
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

        {getSmartSuggestions().map((suggestion) => (
          <Button
            key={suggestion.label}
            size="sm"
            variant="ghost"
            onClick={() => {
              setAIPrompt(suggestion.prompt);
              setShowAIPrompt(true);
            }}
            className="text-xs"
          >
            {suggestion.label}
          </Button>
        ))}
      </div>
    );
  };

  // AI prompt dialog
  const AIPromptDialog = () => {
    if (!showAIPrompt) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">AI Edit</h3>

          <div className="mb-4">
            <div className="block text-sm font-medium mb-2">Selected text:</div>
            <div className="bg-gray-100 dark:bg-zinc-700 p-2 rounded text-sm max-h-20 overflow-y-auto">
              {selectedText}
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="ai-prompt-input"
              className="block text-sm font-medium mb-2"
            >
              What would you like to do?
            </label>
            <textarea
              id="ai-prompt-input"
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              placeholder="e.g., Make this more professional, fix grammar, expand with examples..."
              className="w-full p-2 border border-zinc-200 dark:border-zinc-600 rounded resize-none"
              rows={3}
              autoFocus
            />
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
    <div className="relative">
      <div className="relative prose dark:prose-invert" ref={containerRef} />
      <SelectionToolbar />
      <AIPromptDialog />
    </div>
  );
}

function areEqual(
  prevProps: EnhancedEditorProps,
  nextProps: EnhancedEditorProps,
) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const EnhancedEditor = memo(PureEnhancedEditor, areEqual);
