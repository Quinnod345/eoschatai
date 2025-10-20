// Dynamic imports to avoid SSR issues
let unified: any;
let remarkParse: any;
let remarkGfm: any;
let remarkRehype: any;
let rehypeStringify: any;

async function loadDependencies() {
  if (!unified) {
    const [
      unifiedModule,
      remarkParseModule,
      remarkGfmModule,
      remarkRehypeModule,
      rehypeStringifyModule,
    ] = await Promise.all([
      import('unified'),
      import('remark-parse'),
      import('remark-gfm'),
      import('remark-rehype'),
      import('rehype-stringify'),
    ]);

    unified = unifiedModule.unified;
    remarkParse = remarkParseModule.default;
    remarkGfm = remarkGfmModule.default;
    remarkRehype = remarkRehypeModule.default;
    rehypeStringify = rehypeStringifyModule.default;
  }
}

/**
 * Convert markdown text to HTML for rich text copying
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  await loadDependencies();

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);

  let html = String(result);

  // Add inline styles for better formatting in Google Docs
  // Style code blocks
  html = html.replace(
    /<pre>/g,
    '<pre style="background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: Monaco, Consolas, monospace; font-size: 13px;">',
  );

  // Style inline code
  html = html.replace(
    /<code>/g,
    '<code style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: Monaco, Consolas, monospace; font-size: 85%;">',
  );

  // Style tables
  html = html.replace(
    /<table>/g,
    '<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">',
  );
  html = html.replace(
    /<th>/g,
    '<th style="border: 1px solid #dfe2e5; padding: 8px; background-color: #f6f8fa; font-weight: 600;">',
  );
  html = html.replace(
    /<td>/g,
    '<td style="border: 1px solid #dfe2e5; padding: 8px;">',
  );

  // Style blockquotes
  html = html.replace(
    /<blockquote>/g,
    '<blockquote style="border-left: 4px solid #dfe2e5; margin: 16px 0; padding-left: 16px; color: #6a737d;">',
  );

  // Style links
  html = html.replace(
    /<a /g,
    '<a style="color: #0366d6; text-decoration: none;" ',
  );

  // Style headings
  html = html.replace(
    /<h1>/g,
    '<h1 style="font-size: 2em; font-weight: 600; margin: 0.67em 0;">',
  );
  html = html.replace(
    /<h2>/g,
    '<h2 style="font-size: 1.5em; font-weight: 600; margin: 0.83em 0;">',
  );
  html = html.replace(
    /<h3>/g,
    '<h3 style="font-size: 1.17em; font-weight: 600; margin: 1em 0;">',
  );

  // Style lists
  html = html.replace(
    /<ul>/g,
    '<ul style="margin: 16px 0; padding-left: 2em;">',
  );
  html = html.replace(
    /<ol>/g,
    '<ol style="margin: 16px 0; padding-left: 2em;">',
  );
  html = html.replace(/<li>/g, '<li style="margin: 4px 0;">');

  // Wrap the HTML with basic styling for better appearance in Google Docs
  const styledHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
      ${html}
    </div>
  `;

  return styledHtml;
}

/**
 * Copy rich text (HTML) to clipboard
 * This allows pasting formatted text into applications like Google Docs
 */
export async function copyRichText(markdown: string): Promise<void> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !navigator?.clipboard?.write) {
    throw new Error('Rich text copy is only available in browser');
  }

  try {
    // First, format mentions in the markdown for HTML
    const markdownWithHTMLMentions = formatMentionsForRichText(markdown);

    // Convert markdown to HTML
    const html = await markdownToHtml(markdownWithHTMLMentions);

    // Format mentions for plain text fallback
    const plainText = formatMentionsForPlainText(markdown);

    // Create a ClipboardItem with both plain text and HTML versions
    const clipboardItem = new ClipboardItem({
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });

    // Write to clipboard
    await navigator.clipboard.write([clipboardItem]);
  } catch (error) {
    // Fallback to plain text copy if rich text fails
    console.error('Rich text copy failed, falling back to plain text:', error);
    const plainText = formatMentionsForPlainText(markdown);
    await navigator.clipboard.writeText(plainText);
  }
}

/**
 * Extract and format mentions for rich text
 */
export function formatMentionsForRichText(text: string): string {
  const MENTION_REGEX = /@(\w+):([^\s]+)/g;

  return text.replace(MENTION_REGEX, (match, type, name) => {
    let icon = '📄'; // Default file icon
    let color = '#2563eb'; // Default blue color

    if (type === 'calendar') {
      icon = '📅';
      color = '#059669'; // Green
    } else if (type === 'people') {
      icon = '👥';
      color = '#7c3aed'; // Purple
    }

    // Return HTML formatted mention for rich text
    return `<span style="background-color: #eff6ff; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${icon} ${name}</span>`;
  });
}

/**
 * Format mentions for plain text (fallback)
 */
export function formatMentionsForPlainText(text: string): string {
  const MENTION_REGEX = /@(\w+):([^\s]+)/g;

  return text.replace(MENTION_REGEX, (match, type, name) => {
    let icon = '📄'; // Default file icon
    if (type === 'calendar') {
      icon = '📅';
    } else if (type === 'people') {
      icon = '👥';
    }

    return `${icon} ${name}`;
  });
}

/**
 * Process message parts and extract clean text (without formatting mentions)
 */
export function processMessageParts(parts: any[] | undefined): string {
  if (!parts) return '';

  return parts
    .filter((part) => part.type === 'text')
    .map((part) => {
      // Clean up PDF, document, and image markers
      let text = part.text;

      // Remove EMBEDDED_CONTENT markers (all upload types)
      // This regex matches [EMBEDDED_CONTENT_START]{...json...}[EMBEDDED_CONTENT_END]
      text = text.replace(
        /\[EMBEDDED_CONTENT_START\].*?\[EMBEDDED_CONTENT_END\]/gs,
        '',
      );

      // Remove PDF content sections (legacy format)
      text = text.replace(
        /===\s+PDF\s+Content\s+from\s+[^\(]+\s+\(\d+\s+pages\)\s+===\n\n[\s\S]*?(?=\n\n===|\n*$)/gi,
        '',
      );

      // Remove document content sections (legacy format)
      text = text.replace(
        /===\s+(Word Document|Spreadsheet)\s+Content\s+from\s+[^\(]+(?:\s+\(\d+\s+pages\))?\s+===\n\n[\s\S]*?(?=\n\n===|\n*$)/gi,
        '',
      );

      // Remove image analysis sections (legacy format)
      text = text.replace(
        /===\s+Image\s+Analysis\s+for\s+[^\n]+\s+===\s*\n+Description:\s+[^\n]+(?:\s*\n+Extracted\s+Text:\s+[^\n=]*)?([^\s\S]*?)(?=\n\n===|\n*$)/gi,
        '',
      );

      // Clean up whitespace
      text = text.replace(/\n{3,}/g, '\n\n').trim();

      // Return text without formatting mentions (let copyRichText handle that)
      return text;
    })
    .join('\n')
    .trim();
}
