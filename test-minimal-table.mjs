import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import fs from 'fs';

// Create the exact same table structure as in the composer
const tableRows = [];

// Header row
const headerCells = [
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: 'Name', bold: true })],
      }),
    ],
    width: { size: 3600, type: WidthType.DXA },
  }),
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: 'Age', bold: true })],
      }),
    ],
    width: { size: 3600, type: WidthType.DXA },
  }),
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: 'City', bold: true })],
      }),
    ],
    width: { size: 3600, type: WidthType.DXA },
  }),
];
tableRows.push(new TableRow({ children: headerCells }));

// Data row
const dataCells = [
  new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: 'John' })] })],
    width: { size: 3600, type: WidthType.DXA },
  }),
  new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: '30' })] })],
    width: { size: 3600, type: WidthType.DXA },
  }),
  new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: 'NYC' })] })],
    width: { size: 3600, type: WidthType.DXA },
  }),
];
tableRows.push(new TableRow({ children: dataCells }));

// Create table
const table = new Table({
  rows: tableRows,
  width: {
    size: 10800,
    type: WidthType.DXA,
  },
});

// Create document
const doc = new Document({
  sections: [
    {
      properties: {},
      children: [new Paragraph({ text: 'Table Test' }), table],
    },
  ],
});

// Save
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('test-minimal-table.docx', buffer);
console.log('Created test-minimal-table.docx');
