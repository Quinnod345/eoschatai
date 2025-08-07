import React from 'react';
import { CitationButton } from '@/components/citation-button';

interface Citation {
  number: number;
  title: string;
  url: string;
}

/**
 * Process text to replace [1], [2] etc. with clickable citation buttons
 */
export function processCitationsInText(
  text: string,
  citations: Citation[],
): (string | React.ReactElement)[] {
  if (!citations || citations.length === 0) {
    return [text];
  }

  // Create a map for quick citation lookup
  const citationMap = new Map(citations.map((c) => [c.number, c]));

  // Regular expression to match citations like [1], [2], etc.
  const citationRegex = /\[(\d+)\]/g;

  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while (true) {
    match = citationRegex.exec(text);
    if (match === null) break;
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Get citation number
    const citationNumber = Number.parseInt(match[1]);
    const citation = citationMap.get(citationNumber);

    if (citation) {
      // Add citation button
      parts.push(
        <CitationButton
          key={`citation-${keyIndex++}`}
          number={citation.number}
          title={citation.title}
          url={citation.url}
          inline={true}
        />,
      );
    } else {
      // If citation not found, keep original text
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Process markdown content to add citation buttons
 */
export function processMarkdownWithCitations(
  markdown: string,
  citations: Citation[],
): string {
  if (!citations || citations.length === 0) {
    return markdown;
  }

  // Add citation references section at the end if not already present
  if (
    !markdown.includes('## Sources & References') &&
    !markdown.includes('## 📚 Sources & References')
  ) {
    let referencesSection = '\n\n## 📚 Sources & References\n\n';

    citations.forEach((citation) => {
      referencesSection += `**[${citation.number}]** [${citation.title}](${citation.url})\n\n`;
    });

    return markdown + referencesSection;
  }

  return markdown;
}
