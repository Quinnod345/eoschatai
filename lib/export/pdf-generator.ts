import 'server-only';

import jsPDF from 'jspdf';

// Color constants for consistent styling
const COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#0f3460',
  text: '#333333',
  lightText: '#666666',
  border: '#cccccc',
  background: '#f5f5f5',
  white: '#ffffff',
};

// Font sizes
const FONT_SIZES = {
  title: 24,
  subtitle: 18,
  heading: 14,
  subheading: 12,
  body: 10,
  small: 8,
};

interface PDFSection {
  title: string;
  content: string | string[];
  type?: 'text' | 'list' | 'table';
}

interface PDFTableRow {
  cells: string[];
}

interface PDFTable {
  headers: string[];
  rows: PDFTableRow[];
}

/**
 * Create a new PDF document with standard settings
 */
export function createPDF(title: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Set default font
  doc.setFont('helvetica');

  return doc;
}

/**
 * Add a header to the PDF
 */
export function addHeader(
  doc: jsPDF,
  title: string,
  subtitle?: string,
): number {
  let y = 20;

  // Title
  doc.setFontSize(FONT_SIZES.title);
  doc.setTextColor(COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, y);
  y += 10;

  // Subtitle
  if (subtitle) {
    doc.setFontSize(FONT_SIZES.subtitle);
    doc.setTextColor(COLORS.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 20, y);
    y += 8;
  }

  // Divider line
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;

  return y;
}

/**
 * Add a section heading
 */
export function addSectionHeading(
  doc: jsPDF,
  title: string,
  y: number,
): number {
  // Check if we need a new page
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(FONT_SIZES.heading);
  doc.setTextColor(COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, y);

  return y + 8;
}

/**
 * Add body text with word wrapping
 */
export function addBodyText(
  doc: jsPDF,
  text: string,
  y: number,
  options?: { indent?: number; maxWidth?: number },
): number {
  const indent = options?.indent ?? 20;
  const maxWidth = options?.maxWidth ?? 170;

  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(COLORS.text);
  doc.setFont('helvetica', 'normal');

  const lines = doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, indent, y);
    y += 5;
  }

  return y + 3;
}

/**
 * Add a bullet list
 */
export function addBulletList(
  doc: jsPDF,
  items: string[],
  y: number,
  options?: { indent?: number },
): number {
  const indent = options?.indent ?? 25;

  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(COLORS.text);
  doc.setFont('helvetica', 'normal');

  for (const item of items) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    // Bullet point
    doc.setFillColor(COLORS.text);
    doc.circle(indent - 3, y - 1.5, 1, 'F');

    // Text with wrapping
    const lines = doc.splitTextToSize(item, 160);
    for (let i = 0; i < lines.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[i], indent, y);
      y += 5;
    }
    y += 2;
  }

  return y;
}

/**
 * Add a simple table
 */
export function addTable(
  doc: jsPDF,
  table: PDFTable,
  y: number,
  options?: { columnWidths?: number[] },
): number {
  const startX = 20;
  const pageWidth = 170;
  const cellPadding = 3;
  const rowHeight = 8;

  // Calculate column widths
  const numCols = table.headers.length;
  const columnWidths =
    options?.columnWidths || Array(numCols).fill(pageWidth / numCols);

  // Draw header row
  doc.setFillColor(COLORS.background);
  doc.rect(startX, y - 5, pageWidth, rowHeight, 'F');

  doc.setFontSize(FONT_SIZES.small);
  doc.setTextColor(COLORS.primary);
  doc.setFont('helvetica', 'bold');

  let x = startX + cellPadding;
  for (let i = 0; i < table.headers.length; i++) {
    doc.text(table.headers[i], x, y);
    x += columnWidths[i];
  }
  y += rowHeight;

  // Draw data rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.text);

  for (const row of table.rows) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }

    x = startX + cellPadding;
    for (let i = 0; i < row.cells.length; i++) {
      const cellText = doc.splitTextToSize(
        row.cells[i] || '',
        columnWidths[i] - cellPadding * 2,
      );
      doc.text(cellText[0] || '', x, y);
      x += columnWidths[i];
    }
    y += rowHeight;

    // Draw row border
    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.1);
    doc.line(startX, y - 3, startX + pageWidth, y - 3);
  }

  return y + 5;
}

/**
 * Add a footer with page numbers
 */
export function addFooter(doc: jsPDF, text?: string): void {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(FONT_SIZES.small);
    doc.setTextColor(COLORS.lightText);

    // Page number
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });

    // Optional footer text
    if (text) {
      doc.text(text, 20, 290);
    }

    // Generation date
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 190, 290, {
      align: 'right',
    });
  }
}

/**
 * Add a box with content (for org chart nodes, etc.)
 */
export function addBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle?: string,
): void {
  // Box background
  doc.setFillColor(COLORS.white);
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  // Title
  doc.setFontSize(FONT_SIZES.small);
  doc.setTextColor(COLORS.primary);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, width - 4);
  doc.text(titleLines[0] || '', x + width / 2, y + 5, { align: 'center' });

  // Subtitle
  if (subtitle) {
    doc.setFontSize(FONT_SIZES.small - 1);
    doc.setTextColor(COLORS.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, x + width / 2, y + 10, { align: 'center' });
  }
}

/**
 * Convert PDF to Buffer for response
 */
export function pdfToBuffer(doc: jsPDF): Buffer {
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a complete PDF from sections
 */
export function generatePDFFromSections(
  title: string,
  subtitle: string,
  sections: PDFSection[],
): Buffer {
  const doc = createPDF(title);
  let y = addHeader(doc, title, subtitle);

  for (const section of sections) {
    y = addSectionHeading(doc, section.title, y);

    if (section.type === 'list' && Array.isArray(section.content)) {
      y = addBulletList(doc, section.content, y);
    } else if (typeof section.content === 'string') {
      y = addBodyText(doc, section.content, y);
    } else if (Array.isArray(section.content)) {
      for (const item of section.content) {
        y = addBodyText(doc, item, y);
      }
    }

    y += 5; // Space between sections
  }

  addFooter(doc, 'EOS AI');
  return pdfToBuffer(doc);
}


