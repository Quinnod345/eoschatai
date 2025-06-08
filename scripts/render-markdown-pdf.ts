#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import MarkdownIt from 'markdown-it';

const MERMAID_CDN =
  'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';

// Initialize markdown parser
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

/**
 * Custom CSS for professional PDF styling
 */
const CSS_STYLES = `
<style>
  @page {
    size: A4;
    margin: 2cm;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: none;
    margin: 0;
    padding: 20px;
    background: white;
  }
  
  h1 {
    color: #1a365d;
    font-size: 2.5em;
    margin-top: 0;
    margin-bottom: 0.5em;
    border-bottom: 3px solid #3182ce;
    padding-bottom: 0.3em;
  }
  
  h2 {
    color: #2d3748;
    font-size: 1.8em;
    margin-top: 2em;
    margin-bottom: 0.8em;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.2em;
  }
  
  h3 {
    color: #4a5568;
    font-size: 1.3em;
    margin-top: 1.5em;
    margin-bottom: 0.6em;
  }
  
  h4 {
    color: #718096;
    font-size: 1.1em;
    margin-top: 1.2em;
    margin-bottom: 0.5em;
  }
  
  p {
    margin-bottom: 1em;
    text-align: justify;
  }
  
  ul, ol {
    margin-bottom: 1em;
    padding-left: 2em;
  }
  
  li {
    margin-bottom: 0.5em;
  }
  
  code {
    background-color: #f7fafc;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
    font-size: 0.9em;
    color: #e53e3e;
  }
  
  pre {
    background-color: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
    margin: 1em 0;
  }
  
  pre code {
    background: none;
    color: #2d3748;
    padding: 0;
  }
  
  blockquote {
    border-left: 4px solid #3182ce;
    padding-left: 1em;
    margin: 1em 0;
    font-style: italic;
    background-color: #f8f9fa;
    padding: 1em;
    border-radius: 0 6px 6px 0;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  
  th, td {
    border: 1px solid #e2e8f0;
    padding: 0.75em;
    text-align: left;
  }
  
  th {
    background-color: #edf2f7;
    font-weight: 600;
    color: #2d3748;
  }
  
  .mermaid {
    text-align: center;
    margin: 2em 0;
    page-break-inside: avoid;
  }
  
  .mermaid svg {
    max-width: 100%;
    height: auto;
  }
  
  hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 2em 0;
  }
  
  .page-break {
    page-break-before: always;
  }
  
  .no-break {
    page-break-inside: avoid;
  }
  
  strong {
    color: #2d3748;
    font-weight: 600;
  }
  
  em {
    color: #4a5568;
  }
  
  /* Print-specific styles */
  @media print {
    body {
      font-size: 11pt;
    }
    
    h1 {
      font-size: 18pt;
    }
    
    h2 {
      font-size: 14pt;
    }
    
    h3 {
      font-size: 12pt;
    }
    
    .mermaid {
      page-break-inside: avoid;
    }
  }
</style>`;

/**
 * Extract and preserve Mermaid diagrams before markdown processing
 */
function extractMermaidDiagrams(content: string): {
  content: string;
  diagrams: string[];
} {
  const diagrams: string[] = [];
  const placeholders: string[] = [];

  // Extract all mermaid diagrams and replace with placeholders
  const processedContent = content.replace(
    /```mermaid\n([\s\S]*?)\n```/g,
    (match, diagramContent) => {
      const diagramId = `MERMAID_DIAGRAM_${diagrams.length}`;
      diagrams.push(diagramContent.trim());
      placeholders.push(diagramId);
      return `\n\n${diagramId}\n\n`;
    },
  );

  return { content: processedContent, diagrams };
}

/**
 * Restore Mermaid diagrams after HTML processing
 */
function restoreMermaidDiagrams(
  htmlContent: string,
  diagrams: string[],
): string {
  let processedHtml = htmlContent;

  diagrams.forEach((diagram, index) => {
    const placeholder = `MERMAID_DIAGRAM_${index}`;
    const mermaidDiv = `<div class="mermaid no-break">\n${diagram}\n</div>`;

    // Replace placeholder (which might be wrapped in <p> tags)
    processedHtml = processedHtml.replace(
      new RegExp(`<p>\\s*${placeholder}\\s*</p>`, 'g'),
      mermaidDiv,
    );
    processedHtml = processedHtml.replace(
      new RegExp(placeholder, 'g'),
      mermaidDiv,
    );
  });

  return processedHtml;
}

/**
 * Add page breaks for better PDF formatting
 */
function addPageBreaks(content: string): string {
  // Add page break before major sections
  return content.replace(/<h2>/g, '<div class="page-break"></div><h2>');
}

/**
 * Generate HTML from markdown content
 */
async function generateHTML(markdownPath: string): Promise<string> {
  try {
    // Read the markdown file
    const markdownContent = fs.readFileSync(markdownPath, 'utf-8');

    // Extract Mermaid diagrams before markdown processing
    const { content: processedContent, diagrams } =
      extractMermaidDiagrams(markdownContent);

    // Convert markdown to HTML
    let htmlContent = md.render(processedContent);

    // Restore Mermaid diagrams after HTML processing
    htmlContent = restoreMermaidDiagrams(htmlContent, diagrams);

    // Add page breaks
    htmlContent = addPageBreaks(htmlContent);

    // Create complete HTML document
    const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EOS AI Bot Meeting Questions</title>
    ${CSS_STYLES}
    <script src="${MERMAID_CDN}"></script>
</head>
<body>
    ${htmlContent}
    
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            logLevel: 'error',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'cardinal',
                padding: 20
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 10,
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
                mirrorActors: true,
                bottomMarginAdj: 1,
                useMaxWidth: true,
                wrap: true
            },
            er: {
                diagramPadding: 20,
                layoutDirection: 'TB',
                minEntityWidth: 100,
                minEntityHeight: 75,
                entityPadding: 15,
                stroke: 'gray',
                fill: 'honeydew',
                fontSize: 12,
                useMaxWidth: true
            },
            graph: {
                useMaxWidth: true,
                htmlLabels: true
            }
        });
    </script>
</body>
</html>`;

    return fullHTML;
  } catch (error) {
    console.error('Error generating HTML:', error);
    throw error;
  }
}

/**
 * Generate PDF from HTML content
 */
async function generatePDF(html: string, outputPath: string): Promise<void> {
  let browser: Browser | undefined;

  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    console.log('📄 Setting page content...');
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('⏳ Waiting for Mermaid diagrams to render...');
    // Wait for Mermaid diagrams to render
    await page.waitForFunction(
      () => {
        const mermaidElements = document.querySelectorAll('.mermaid');
        return Array.from(mermaidElements).every(
          (el) =>
            el.querySelector('svg') !== null ||
            el.textContent?.trim().length === 0,
        );
      },
      { timeout: 20000 },
    );

    console.log('📊 Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm',
      },
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; margin: 0 auto; color: #666;">
          EOS AI Bot - Technical Architecture & Meeting Questions
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; margin: 0 auto; color: #666;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
    });

    console.log('✅ PDF generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const markdownPath = path.join(
      process.cwd(),
      'EOS_AI_Bot_Meeting_Questions.md',
    );
    const outputPath = path.join(
      process.cwd(),
      'EOS_AI_Bot_Meeting_Questions.pdf',
    );

    // Check if markdown file exists
    if (!fs.existsSync(markdownPath)) {
      console.error('❌ Markdown file not found:', markdownPath);
      process.exit(1);
    }

    console.log('📖 Reading markdown file:', markdownPath);

    // Generate HTML
    const html = await generateHTML(markdownPath);

    // Generate PDF
    await generatePDF(html, outputPath);

    console.log('🎉 Success! PDF saved to:', outputPath);

    // Optional: Save HTML for debugging
    const htmlPath = path.join(
      process.cwd(),
      'EOS_AI_Bot_Meeting_Questions.html',
    );
    fs.writeFileSync(htmlPath, html);
    console.log('🔧 Debug HTML saved to:', htmlPath);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

export { generateHTML, generatePDF, main };

// Execute main function when script is run directly
main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
