import OrderedMap from 'orderedmap';
import {
  Schema,
  type Node as ProsemirrorNode,
  type MarkSpec,
  DOMParser,
} from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { diffEditor, DiffType } from '@/lib/editor/diff';

const diffSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
  marks: OrderedMap.from({
    ...schema.spec.marks.toObject(),
    diffMark: {
      attrs: { type: { default: '' } },
      toDOM(mark) {
        let className = '';

        switch (mark.attrs.type) {
          case DiffType.Inserted:
            className =
              'bg-green-100 text-green-700 dark:bg-green-500/70 dark:text-green-300';
            break;
          case DiffType.Deleted:
            className =
              'bg-red-100 line-through text-red-600 dark:bg-red-500/70 dark:text-red-300';
            break;
          default:
            className = '';
        }
        return ['span', { class: className }, 0];
      },
    } as MarkSpec,
  }),
});

function computeDiff(oldDoc: ProsemirrorNode, newDoc: ProsemirrorNode) {
  return diffEditor(diffSchema, oldDoc.toJSON(), newDoc.toJSON());
}

type DiffEditorProps = {
  oldContent: string;
  newContent: string;
};

export const DiffView = ({ oldContent, newContent }: DiffEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const parser = DOMParser.fromSchema(diffSchema);

      // Render markdown with proper components for tables, headings, etc.
      const markdownComponents = {
        table: ({ children }: any) => (
          <table className="border-collapse border border-gray-300">
            {children}
          </table>
        ),
        thead: ({ children }: any) => (
          <thead className="bg-gray-100">{children}</thead>
        ),
        tbody: ({ children }: any) => <tbody>{children}</tbody>,
        tr: ({ children }: any) => <tr className="border-b">{children}</tr>,
        th: ({ children }: any) => (
          <th className="border px-4 py-2 text-left font-bold">{children}</th>
        ),
        td: ({ children }: any) => (
          <td className="border px-4 py-2">{children}</td>
        ),
        h1: ({ children }: any) => (
          <h1 className="text-3xl font-bold mb-4">{children}</h1>
        ),
        h2: ({ children }: any) => (
          <h2 className="text-2xl font-bold mb-3">{children}</h2>
        ),
        h3: ({ children }: any) => (
          <h3 className="text-xl font-bold mb-2">{children}</h3>
        ),
        p: ({ children }: any) => <p className="mb-2">{children}</p>,
        ul: ({ children }: any) => (
          <ul className="list-disc pl-5 mb-2">{children}</ul>
        ),
        ol: ({ children }: any) => (
          <ol className="list-decimal pl-5 mb-2">{children}</ol>
        ),
        li: ({ children }: any) => <li className="mb-1">{children}</li>,
        blockquote: ({ children }: any) => (
          <blockquote className="border-l-4 border-gray-300 pl-4 italic">
            {children}
          </blockquote>
        ),
        code: ({ inline, children }: any) =>
          inline ? (
            <code className="bg-gray-100 px-1 rounded">{children}</code>
          ) : (
            <pre className="bg-gray-100 p-2 rounded overflow-x-auto mb-2">
              <code>{children}</code>
            </pre>
          ),
        hr: () => <hr className="my-4 border-t border-gray-300" />,
      };

      const oldHtmlContent = renderToString(
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {oldContent}
        </ReactMarkdown>,
      );
      const newHtmlContent = renderToString(
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {newContent}
        </ReactMarkdown>,
      );

      const oldContainer = document.createElement('div');
      oldContainer.innerHTML = oldHtmlContent;

      const newContainer = document.createElement('div');
      newContainer.innerHTML = newHtmlContent;

      const oldDoc = parser.parse(oldContainer);
      const newDoc = parser.parse(newContainer);

      const diffedDoc = computeDiff(oldDoc, newDoc);

      const state = EditorState.create({
        doc: diffedDoc,
        plugins: [],
      });

      viewRef.current = new EditorView(editorRef.current, {
        state,
        editable: () => false,
      });
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [oldContent, newContent]);

  return (
    <div
      className="diff-editor prose dark:prose-invert max-w-none"
      ref={editorRef}
    />
  );
};
