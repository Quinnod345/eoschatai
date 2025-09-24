'use client';

import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
} from 'prosemirror-markdown';
import { DOMParser, type Node } from 'prosemirror-model';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { renderToString } from 'react-dom/server';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { documentSchema } from './config';
import { createSuggestionWidget, type UISuggestion } from './suggestions';

// Simple markdown renderer for editor parsing
const renderMarkdownForEditor = (content: string) => {
  // Handle empty content - ensure there's at least an empty paragraph
  if (!content || content.trim() === '') {
    return '<p><br></p>';
  }

  // Use plain HTML elements without enhanced wrappers
  return renderToString(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{children}</p>,
        h1: ({ children }) => <h1>{children}</h1>,
        h2: ({ children }) => <h2>{children}</h2>,
        h3: ({ children }) => <h3>{children}</h3>,
        h4: ({ children }) => <h4>{children}</h4>,
        h5: ({ children }) => <h5>{children}</h5>,
        h6: ({ children }) => <h6>{children}</h6>,
        ul: ({ children }) => <ul>{children}</ul>,
        ol: ({ children }) => <ol>{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        code: (props: any) => {
          const { inline, children } = props;
          return inline ? (
            <code>{children}</code>
          ) : (
            <pre>
              <code>{children}</code>
            </pre>
          );
        },
        pre: ({ children }) => <pre>{children}</pre>,
        a: ({ href, children }) => <a href={href}>{children}</a>,
        img: ({ src, alt }) => <img src={src} alt={alt} />,
        hr: () => <hr />,
        br: () => <br />,
        strong: ({ children }) => <strong>{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        del: ({ children }) => <del>{children}</del>,
        table: ({ children }) => <table>{children}</table>,
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => <th>{children}</th>,
        td: ({ children }) => <td>{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>,
  );
};

export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  const stringFromMarkdown = renderMarkdownForEditor(content);
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = stringFromMarkdown;
  return parser.parse(tempContainer);
};

// Custom serializer for tables
const createTableAwareSerializer = () => {
  return new MarkdownSerializer(
    {
      ...defaultMarkdownSerializer.nodes,
      table: (state, node) => {
        state.ensureNewLine();

        // Process header row
        const headerRow = node.child(0);
        if (headerRow) {
          state.write('| ');
          headerRow.forEach((cell, _, i) => {
            if (i > 0) state.write(' | ');
            const cellText = cell.textContent || '';
            state.write(cellText);
          });
          state.write(' |');
          state.ensureNewLine();

          // Write separator
          state.write('| ');
          headerRow.forEach((_, __, i) => {
            if (i > 0) state.write(' | ');
            state.write('---');
          });
          state.write(' |');
          state.ensureNewLine();
        }

        // Process data rows
        for (let i = 1; i < node.childCount; i++) {
          const row = node.child(i);
          state.write('| ');
          row.forEach((cell, _, j) => {
            if (j > 0) state.write(' | ');
            const cellText = cell.textContent || '';
            state.write(cellText);
          });
          state.write(' |');
          state.ensureNewLine();
        }

        state.ensureNewLine();
      },
      table_row: () => {},
      table_cell: () => {},
      table_header: () => {},
    },
    defaultMarkdownSerializer.marks,
  );
};

export const buildContentFromDocument = (document: Node) => {
  const serializer = createTableAwareSerializer();
  return serializer.serialize(document);
};

export const createDecorations = (
  suggestions: Array<UISuggestion>,
  view: EditorView,
) => {
  const decorations: Array<Decoration> = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: 'suggestion-highlight',
        },
        {
          suggestionId: suggestion.id,
          type: 'highlight',
        },
      ),
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (view) => {
          const { dom } = createSuggestionWidget(suggestion, view);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: 'widget',
        },
      ),
    );
  }

  return DecorationSet.create(view.state.doc, decorations);
};
