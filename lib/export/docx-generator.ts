import 'server-only';

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
  ShadingType,
  PageBreak,
  NumberFormat,
  Header,
  Footer,
  PageNumber,
} from 'docx';

// Color constants (in hex without #)
const COLORS = {
  primary: '1a1a2e',
  secondary: '16213e',
  accent: '0f3460',
  text: '333333',
  lightText: '666666',
  border: 'cccccc',
  background: 'f5f5f5',
};

interface DocxSection {
  title: string;
  content: string | string[];
  type?: 'text' | 'list' | 'table';
}

interface DocxTableData {
  headers: string[];
  rows: string[][];
}

/**
 * Create a title paragraph
 */
export function createTitle(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 48, // 24pt
        color: COLORS.primary,
      }),
    ],
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
  });
}

/**
 * Create a subtitle paragraph
 */
export function createSubtitle(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 28, // 14pt
        color: COLORS.lightText,
        italics: true,
      }),
    ],
    spacing: { after: 400 },
  });
}

/**
 * Create a section heading
 */
export function createHeading(text: string, level: 1 | 2 | 3 = 1): Paragraph {
  const sizes = { 1: 32, 2: 28, 3: 24 };
  const headingLevels = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  };

  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: sizes[level],
        color: COLORS.secondary,
      }),
    ],
    heading: headingLevels[level],
    spacing: { before: 300, after: 150 },
  });
}

/**
 * Create a body text paragraph
 */
export function createBodyText(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22, // 11pt
        color: COLORS.text,
      }),
    ],
    spacing: { after: 150 },
  });
}

/**
 * Create a bullet list
 */
export function createBulletList(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        children: [
          new TextRun({
            text: item,
            size: 22,
            color: COLORS.text,
          }),
        ],
        bullet: { level: 0 },
        spacing: { after: 100 },
      }),
  );
}

/**
 * Create a numbered list
 */
export function createNumberedList(items: string[]): Paragraph[] {
  return items.map(
    (item, index) =>
      new Paragraph({
        children: [
          new TextRun({
            text: item,
            size: 22,
            color: COLORS.text,
          }),
        ],
        numbering: {
          reference: 'default-numbering',
          level: 0,
        },
        spacing: { after: 100 },
      }),
  );
}

/**
 * Create a table
 */
export function createTable(data: DocxTableData): Table {
  const rows: TableRow[] = [];

  // Header row
  rows.push(
    new TableRow({
      children: data.headers.map(
        (header) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: header,
                    bold: true,
                    size: 20,
                    color: COLORS.primary,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              color: COLORS.background,
            },
            margins: {
              top: 100,
              bottom: 100,
              left: 100,
              right: 100,
            },
          }),
      ),
      tableHeader: true,
    }),
  );

  // Data rows
  for (const row of data.rows) {
    rows.push(
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell || '',
                      size: 20,
                      color: COLORS.text,
                    }),
                  ],
                }),
              ],
              margins: {
                top: 80,
                bottom: 80,
                left: 100,
                right: 100,
              },
            }),
        ),
      }),
    );
  }

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: COLORS.border,
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: COLORS.border,
      },
    },
  });
}

/**
 * Create an indented hierarchy item (for org charts)
 */
export function createHierarchyItem(
  name: string,
  role: string,
  level: number,
): Paragraph {
  const indent = level * 720; // 720 twips = 0.5 inch

  return new Paragraph({
    children: [
      new TextRun({
        text: name,
        bold: true,
        size: 22,
        color: COLORS.primary,
      }),
      new TextRun({
        text: ` - ${role}`,
        size: 22,
        color: COLORS.lightText,
      }),
    ],
    indent: { left: indent },
    spacing: { after: 100 },
  });
}

/**
 * Create a page break
 */
export function createPageBreak(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

/**
 * Create document header
 */
function createDocHeader(text: string): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 18,
            color: COLORS.lightText,
          }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
    ],
  });
}

/**
 * Create document footer with page numbers
 */
function createDocFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Generated by EOS AI - Page ',
            size: 18,
            color: COLORS.lightText,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: COLORS.lightText,
          }),
          new TextRun({
            text: ' of ',
            size: 18,
            color: COLORS.lightText,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: COLORS.lightText,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

/**
 * Generate a complete DOCX document from sections
 */
export async function generateDocxFromSections(
  title: string,
  subtitle: string,
  sections: DocxSection[],
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title and subtitle
  children.push(createTitle(title));
  if (subtitle) {
    children.push(createSubtitle(subtitle));
  }

  // Process sections
  for (const section of sections) {
    children.push(createHeading(section.title));

    if (section.type === 'list' && Array.isArray(section.content)) {
      children.push(...createBulletList(section.content));
    } else if (typeof section.content === 'string') {
      children.push(createBodyText(section.content));
    } else if (Array.isArray(section.content)) {
      for (const item of section.content) {
        children.push(createBodyText(item));
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: createDocHeader(title),
        },
        footers: {
          default: createDocFooter(),
        },
        children,
      },
    ],
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Generate DOCX with custom content
 */
export async function generateDocx(
  title: string,
  children: (Paragraph | Table)[],
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: createDocHeader(title),
        },
        footers: {
          default: createDocFooter(),
        },
        children: [createTitle(title), ...children],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}


