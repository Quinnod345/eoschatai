# PDF Generation for EOS AI Bot Meeting Questions

This guide explains how to render your `EOS_AI_Bot_Meeting_Questions.md` file into a professional PDF with Mermaid diagrams.

## Prerequisites

Make sure you have Node.js and pnpm installed on your system.

## Installation

1. **Install the required dependencies:**
   ```bash
   pnpm install
   ```

   This will install the new dependencies:
   - `puppeteer` - For PDF generation
   - `markdown-it` - For markdown parsing
   - `@types/markdown-it` - TypeScript types

## Usage

### Generate PDF

To render your markdown file as a PDF:

```bash
pnpm run render-pdf
```

This will:
1. Read `EOS_AI_Bot_Meeting_Questions.md` from the root directory
2. Convert markdown to HTML with proper styling
3. Render all Mermaid diagrams as SVG graphics
4. Generate a professional PDF with:
   - **A4 format** with proper margins
   - **Professional typography** with clean fonts
   - **Syntax highlighting** for code blocks
   - **Rendered Mermaid diagrams** (flowcharts, ER diagrams, sequence diagrams)
   - **Page breaks** before major sections
   - **Headers and footers** with page numbers
   - **Print-optimized styling**

### Output Files

The script generates two files:
- `EOS_AI_Bot_Meeting_Questions.pdf` - The final PDF document
- `EOS_AI_Bot_Meeting_Questions.html` - Debug HTML file (for troubleshooting)

## Features

### Professional Styling
- Clean, modern typography using system fonts
- Consistent heading hierarchy with color coding
- Professional color scheme suitable for business documents
- Proper spacing and margins for readability

### Mermaid Diagram Support
The script fully supports all Mermaid diagram types in your document:
- **Flowcharts** - Data flow and process diagrams
- **Entity Relationship Diagrams** - Database schema visualizations
- **Sequence Diagrams** - RAG query processing flows
- **Graph Diagrams** - Knowledge namespace hierarchies

### PDF Optimization
- A4 page format with 2cm margins
- Page breaks before major sections to avoid orphaned headings
- No-break zones around diagrams to prevent splitting
- Professional headers and footers with document title and page numbers

## Troubleshooting

### If PDF generation fails:
1. **Check dependencies**: Ensure all packages are installed with `pnpm install`
2. **Browser issues**: Puppeteer downloads Chromium automatically, but on some systems you may need to install additional dependencies
3. **Memory issues**: Large documents with many diagrams may require more memory
4. **Mermaid rendering**: If diagrams don't appear, check the HTML output file for errors

### On Linux systems:
You may need to install additional dependencies for Puppeteer:
```bash
# Ubuntu/Debian
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### On macOS with Apple Silicon:
Puppeteer should work out of the box, but if you encounter issues:
```bash
# Install Rosetta 2 if needed
softwareupdate --install-rosetta
```

## Customization

To modify the PDF styling, edit the `CSS_STYLES` constant in `scripts/render-markdown-pdf.ts`:

- **Colors**: Modify the color scheme by changing CSS color values
- **Fonts**: Update the `font-family` properties
- **Layout**: Adjust margins, spacing, and page breaks
- **Mermaid themes**: Change the Mermaid configuration in the script

## Alternative Methods

If you prefer other tools:

### Using Pandoc (requires separate installation):
```bash
# Install pandoc with Mermaid support
brew install pandoc  # macOS
# or
sudo apt-get install pandoc  # Linux

# Convert (basic, without Mermaid)
pandoc EOS_AI_Bot_Meeting_Questions.md -o output.pdf
```

### Using online tools:
- GitLab/GitHub markdown renderers with PDF export
- Notion (import markdown, export PDF)
- Typora (markdown editor with PDF export)

## Script Details

The `render-markdown-pdf.ts` script:
1. **Parses markdown** using markdown-it with full HTML support
2. **Processes Mermaid** by converting code blocks to renderable div elements
3. **Applies professional CSS** with print-optimized styles
4. **Launches headless Chrome** via Puppeteer
5. **Waits for Mermaid rendering** to complete before PDF generation
6. **Generates PDF** with proper page formatting and metadata

The script is robust and handles edge cases like:
- Large diagrams that need page breaks
- Complex nested markdown structures
- Multiple diagram types on the same page
- Font loading and rendering timing 