'use client';

import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { toggleMark } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import React, { memo, useEffect, useRef } from 'react';

import type { Suggestion } from '@/lib/db/schema';
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from '@/lib/editor/config';
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
import { useDocumentHistory } from '@/hooks/use-document-history';

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
  documentId?: string;
  userId?: string;
  title?: string;
  kind?: string;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
};

function PureEditor({
  content,
  onSaveContent,
  suggestions,
  status,
  documentId,
  userId,
  title = '',
  kind = 'text',
  onHistoryChange,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Initialize document history hook if we have documentId and userId
  const documentHistory =
    documentId && userId
      ? useDocumentHistory({
          documentId,
          userId,
          autoSave: true,
          autoSaveDelay: 2000,
          onHistoryChange: (state) => {
            onHistoryChange?.(state.canUndo, state.canRedo);
            // Store history state globally for action buttons
            (window as any).__documentHistoryState = {
              canUndo: state.canUndo,
              canRedo: state.canRedo,
            };
          },
        })
      : null;

  // Handle undo/redo events
  useEffect(() => {
    const handleUndo = async () => {
      if (documentHistory) {
        const version = await documentHistory.undo();
        if (version && editorRef.current) {
          const newDocument = buildDocumentFromContent(version.content || '');
          const transaction = editorRef.current.state.tr.replaceWith(
            0,
            editorRef.current.state.doc.content.size,
            newDocument.content,
          );
          transaction.setMeta('no-save', true);
          editorRef.current.dispatch(transaction);
        }
      }
    };

    const handleRedo = async () => {
      if (documentHistory) {
        const version = await documentHistory.redo();
        if (version && editorRef.current) {
          const newDocument = buildDocumentFromContent(version.content || '');
          const transaction = editorRef.current.state.tr.replaceWith(
            0,
            editorRef.current.state.doc.content.size,
            newDocument.content,
          );
          transaction.setMeta('no-save', true);
          editorRef.current.dispatch(transaction);
        }
      }
    };

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('document-undo', handleUndo);
    window.addEventListener('document-redo', handleRedo);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('document-undo', handleUndo);
      window.removeEventListener('document-redo', handleRedo);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [documentHistory]);

  // Handle formatting commands from header toolbar
  useEffect(() => {
    const handleFormatCommand = (event: CustomEvent) => {
      if (!editorRef.current) return;
      const { state, dispatch } = editorRef.current;

      switch (event.type) {
        case 'format-bold':
          toggleMark(state.schema.marks.strong)(state, dispatch);
          editorRef.current.focus();
          break;
        case 'format-italic':
          toggleMark(state.schema.marks.em)(state, dispatch);
          editorRef.current.focus();
          break;
        case 'format-bullet-list': {
          const bulletList = state.schema.nodes.bullet_list;
          if (bulletList) {
            wrapInList(bulletList)(state, dispatch);
            editorRef.current.focus();
          }
          break;
        }
        case 'format-ordered-list': {
          const orderedList = state.schema.nodes.ordered_list;
          if (orderedList) {
            wrapInList(orderedList)(state, dispatch);
            editorRef.current.focus();
          }
          break;
        }
        case 'format-heading': {
          const { $from, $to } = state.selection;
          const heading = state.schema.nodes.heading;
          if (heading && event.detail?.level) {
            dispatch(
              state.tr.setBlockType($from.pos, $to.pos, heading, {
                level: event.detail.level,
              }),
            );
            editorRef.current.focus();
          }
          break;
        }
        case 'format-paragraph': {
          const { $from: $pFrom, $to: $pTo } = state.selection;
          const paragraph = state.schema.nodes.paragraph;
          if (paragraph) {
            dispatch(state.tr.setBlockType($pFrom.pos, $pTo.pos, paragraph));
            editorRef.current.focus();
          }
          break;
        }
      }
    };

    window.addEventListener(
      'format-bold',
      handleFormatCommand as EventListener,
    );
    window.addEventListener(
      'format-italic',
      handleFormatCommand as EventListener,
    );
    window.addEventListener(
      'format-bullet-list',
      handleFormatCommand as EventListener,
    );
    window.addEventListener(
      'format-ordered-list',
      handleFormatCommand as EventListener,
    );
    window.addEventListener(
      'format-heading',
      handleFormatCommand as EventListener,
    );
    window.addEventListener(
      'format-paragraph',
      handleFormatCommand as EventListener,
    );

    return () => {
      window.removeEventListener(
        'format-bold',
        handleFormatCommand as EventListener,
      );
      window.removeEventListener(
        'format-italic',
        handleFormatCommand as EventListener,
      );
      window.removeEventListener(
        'format-bullet-list',
        handleFormatCommand as EventListener,
      );
      window.removeEventListener(
        'format-ordered-list',
        handleFormatCommand as EventListener,
      );
      window.removeEventListener(
        'format-heading',
        handleFormatCommand as EventListener,
      );
      window.removeEventListener(
        'format-paragraph',
        handleFormatCommand as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      console.log('[Editor] Initializing with content:', content);
      const state = EditorState.create({
        doc: buildDocumentFromContent(content || ''),
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
        editable: () => true, // Ensure editor is always editable
        handleKeyDown: (view, event) => {
          // Bold shortcut (Cmd/Ctrl + B)
          if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
            event.preventDefault();
            const { state, dispatch } = view;
            toggleMark(state.schema.marks.strong)(state, dispatch);
            return true;
          }
          // Italic shortcut (Cmd/Ctrl + I)
          if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
            event.preventDefault();
            const { state, dispatch } = view;
            toggleMark(state.schema.marks.em)(state, dispatch);
            return true;
          }
          // Bullet list shortcut (Cmd/Ctrl + Shift + 8)
          if (
            (event.metaKey || event.ctrlKey) &&
            event.shiftKey &&
            event.key === '8'
          ) {
            event.preventDefault();
            const { state, dispatch } = view;
            const bulletList = state.schema.nodes.bullet_list;
            if (bulletList) {
              wrapInList(bulletList)(state, dispatch);
            }
            return true;
          }
          return false;
        },
      });

      // Focus the editor after initialization
      editorRef.current.focus();
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
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent: (updatedContent: string, debounce: boolean) => {
              onSaveContent(updatedContent, debounce);
              // Also update document history if available
              if (documentHistory && !transaction.getMeta('no-save')) {
                documentHistory.updateContent(title, updatedContent, kind);
              }
            },
          });

          // Force toolbar update on selection change
          if (transaction.selectionSet) {
            forceUpdate();
          }
        },
      });
    }
  }, [onSaveContent, documentHistory, title, kind]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc,
      );

      if (status === 'streaming') {
        // During streaming, only update if the content has actually changed.
        // Avoid excessive churn while still reflecting incoming deltas.
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

  return (
    <div
      className="prose dark:prose-invert min-h-[200px] w-full max-w-none"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const Editor = memo(PureEditor, areEqual);
