import type { SearchResult } from '@/lib/web-search';

export interface Citation {
  number: number;
  url: string;
  title: string;
  snippet?: string;
  content?: string;
  usedInResponse?: boolean;
}

export interface CitationContext {
  citations: Citation[];
  style: 'numbered' | 'inline' | 'academic' | 'footnote';
  format: 'markdown' | 'html' | 'plain';
}

/**
 * Format citations in the response text
 */
export function formatResponseWithCitations(
  text: string,
  citations: Citation[],
  style: CitationContext['style'] = 'numbered',
): string {
  if (!citations || citations.length === 0) {
    return text;
  }

  // Create citation map for quick lookup
  const citationMap = new Map<number, Citation>();
  citations.forEach((citation) => {
    citationMap.set(citation.number, citation);
  });

  // Replace citation placeholders with formatted citations
  let formattedText = text;

  // Handle different citation patterns
  const patterns = [
    /\[CITE:(\d+)\]/g, // [CITE:1]
    /\[\[(\d+)\]\]/g, // [[1]]
    /\{cite:(\d+)\}/g, // {cite:1}
    /\[(\d+)\]/g, // [1] - most common
  ];

  for (const pattern of patterns) {
    formattedText = formattedText.replace(pattern, (match, citationNumber) => {
      const num = Number.parseInt(citationNumber, 10);
      const citation = citationMap.get(num);

      if (!citation) {
        return match; // Keep original if citation not found
      }

      return formatCitation(citation, style);
    });
  }

  return formattedText;
}

/**
 * Format a single citation based on style
 */
function formatCitation(
  citation: Citation,
  style: CitationContext['style'],
): string {
  switch (style) {
    case 'numbered':
      return `[${citation.number}]`;

    case 'inline':
      return `([${citation.title}](${citation.url}))`;

    case 'academic':
      return `[${citation.number}]`;

    case 'footnote':
      return `[^${citation.number}]`;

    default:
      return `[${citation.number}]`;
  }
}

/**
 * Generate citation references section
 */
export function generateCitationReferences(
  citations: Citation[],
  format: CitationContext['format'] = 'markdown',
): string {
  if (!citations || citations.length === 0) {
    return '';
  }

  // Sort citations by number
  const sortedCitations = [...citations].sort((a, b) => a.number - b.number);

  switch (format) {
    case 'markdown':
      return generateMarkdownReferences(sortedCitations);

    case 'html':
      return generateHtmlReferences(sortedCitations);

    case 'plain':
      return generatePlainReferences(sortedCitations);

    default:
      return generateMarkdownReferences(sortedCitations);
  }
}

/**
 * Generate markdown-formatted references
 */
function generateMarkdownReferences(citations: Citation[]): string {
  const references: string[] = ['\n## Sources\n'];

  citations.forEach((citation) => {
    const title = citation.title || 'Untitled';
    const domain = new URL(citation.url).hostname.replace('www.', '');

    references.push(
      `[${citation.number}] [${title}](${citation.url}) - *${domain}*`,
    );

    if (citation.snippet) {
      references.push(`   > ${citation.snippet.substring(0, 200)}...`);
    }

    references.push(''); // Empty line for spacing
  });

  return references.join('\n');
}

/**
 * Generate HTML-formatted references
 */
function generateHtmlReferences(citations: Citation[]): string {
  const references: string[] = [
    '<div class="citations">',
    '<h2>Sources</h2>',
    '<ol class="citation-list">',
  ];

  citations.forEach((citation) => {
    const title = citation.title || 'Untitled';
    const domain = new URL(citation.url).hostname.replace('www.', '');

    references.push(`
      <li class="citation-item">
        <a href="${citation.url}" target="_blank" rel="noopener noreferrer">
          ${title}
        </a>
        <span class="citation-domain">${domain}</span>
        ${citation.snippet ? `<blockquote>${citation.snippet.substring(0, 200)}...</blockquote>` : ''}
      </li>
    `);
  });

  references.push('</ol>', '</div>');

  return references.join('\n');
}

/**
 * Generate plain text references
 */
function generatePlainReferences(citations: Citation[]): string {
  const references: string[] = ['\nSources:', '--------'];

  citations.forEach((citation) => {
    const title = citation.title || 'Untitled';

    references.push(
      `[${citation.number}] ${title}`,
      `    URL: ${citation.url}`,
    );

    if (citation.snippet) {
      references.push(`    ${citation.snippet.substring(0, 150)}...`);
    }

    references.push(''); // Empty line for spacing
  });

  return references.join('\n');
}

/**
 * Extract citations from search results
 */
export function extractCitationsFromResults(
  results: SearchResult[],
  maxCitations = 20,
): Citation[] {
  return results.slice(0, maxCitations).map((result, index) => ({
    number: result.citationNumber || index + 1,
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    content: result.content,
    usedInResponse: false, // Will be updated when citation is used
  }));
}

/**
 * Inject citations into text based on relevance
 */
export function injectCitationsIntoText(
  text: string,
  citations: Citation[],
  maxCitationsPerParagraph = 3,
): string {
  if (!citations || citations.length === 0) {
    return text;
  }

  // Split text into sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const citedSentences: string[] = [];
  const usedCitations = new Set<number>();

  sentences.forEach((sentence, index) => {
    let citedSentence = sentence;
    const relevantCitations: Citation[] = [];

    // Find relevant citations for this sentence
    citations.forEach((citation) => {
      if (usedCitations.has(citation.number)) {
        return; // Skip if already used too much
      }

      const sentenceLower = sentence.toLowerCase();
      const titleLower = citation.title?.toLowerCase() || '';
      const snippetLower = citation.snippet?.toLowerCase() || '';

      // Check relevance
      const titleWords = titleLower.split(/\s+/).filter((w) => w.length > 3);
      const relevanceScore = titleWords.filter((word) =>
        sentenceLower.includes(word),
      ).length;

      if (
        relevanceScore > 0 ||
        (citation.snippet &&
          sentenceLower.includes(snippetLower.substring(0, 30)))
      ) {
        relevantCitations.push(citation);
      }
    });

    // Add citations to sentence (limit per paragraph)
    if (relevantCitations.length > 0) {
      const citationsToAdd = relevantCitations
        .slice(0, maxCitationsPerParagraph)
        .map((c) => {
          usedCitations.add(c.number);
          return `[${c.number}]`;
        })
        .join('');

      // Add citations at the end of the sentence, before punctuation
      if (sentence.match(/[.!?]$/)) {
        citedSentence =
          sentence.slice(0, -1) + citationsToAdd + sentence.slice(-1);
      } else {
        citedSentence = sentence + citationsToAdd;
      }
    }

    citedSentences.push(citedSentence);
  });

  return citedSentences.join(' ');
}

/**
 * Create a citation summary for the response
 */
export function createCitationSummary(citations: Citation[]): string {
  if (!citations || citations.length === 0) {
    return '';
  }

  const domains = new Set<string>();
  const citationTypes = {
    academic: 0,
    news: 0,
    documentation: 0,
    blog: 0,
    other: 0,
  };

  citations.forEach((citation) => {
    const url = new URL(citation.url);
    const domain = url.hostname.replace('www.', '');
    domains.add(domain);

    // Categorize citation type
    if (
      domain.includes('.edu') ||
      domain.includes('arxiv') ||
      domain.includes('scholar')
    ) {
      citationTypes.academic++;
    } else if (
      domain.includes('news') ||
      ['cnn', 'bbc', 'reuters', 'nytimes'].some((d) => domain.includes(d))
    ) {
      citationTypes.news++;
    } else if (
      domain.includes('docs') ||
      domain.includes('documentation') ||
      domain.includes('github')
    ) {
      citationTypes.documentation++;
    } else if (domain.includes('blog') || domain.includes('medium')) {
      citationTypes.blog++;
    } else {
      citationTypes.other++;
    }
  });

  const summary: string[] = [
    `📚 **Research Summary**`,
    `- Sources consulted: ${citations.length}`,
    `- Unique domains: ${domains.size}`,
  ];

  // Add type breakdown if diverse
  const typesUsed = Object.entries(citationTypes)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${type}: ${count}`);

  if (typesUsed.length > 1) {
    summary.push(`- Source types: ${typesUsed.join(', ')}`);
  }

  return summary.join('\n');
}

/**
 * Validate and clean citations
 */
export function validateCitations(citations: Citation[]): Citation[] {
  return citations
    .filter((citation) => {
      // Validate URL
      try {
        new URL(citation.url);
        return true;
      } catch {
        return false;
      }
    })
    .map((citation, index) => ({
      ...citation,
      number: citation.number || index + 1,
      title: citation.title || 'Untitled Source',
    }));
}
