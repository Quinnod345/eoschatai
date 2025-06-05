# EOS Implementer Document Upload Guide

## Overview

This guide explains how to upload documents specifically for the **EOS Implementer persona profiles**. The EOS Implementer persona has specialized profiles for different EOS activities, and each profile has its own dedicated knowledge namespace in the Upstash RAG database.

## EOS Implementer Profiles

The EOS Implementer persona includes these specialized profiles:

1. **General EOS Implementer** - Core EOS methodology and tools
2. **Vision Building Day 1** - People and Data components (Core Values, Accountability Chart, Scorecard)
3. **Vision Building Day 2** - Vision, Issues, Process, Traction components (Core Focus, 10-Year Target, Rocks)
4. **Quarterly Planning** - Quarterly planning sessions and Rock setting
5. **Level 10 Meeting Facilitation** - Level 10 meeting agenda and IDS process
6. **Issues Solving (IDS)** - Identify, Discuss, Solve methodology
7. **Annual Planning** - Annual planning and strategic sessions

## Document Upload System

### Prerequisites
- Access to the codebase
- Node.js and pnpm installed
- Documents organized by EOS Implementer profile

### Setup

1. **Create the folder structure** (already exists):
   ```
   eos-implementer-documents/
   ├── general/                # General EOS methodology
   ├── vision-day-1/           # Vision Building Day 1 - People and Data
   ├── vision-day-2/           # Vision Building Day 2 - Vision, Issues, Process, Traction
   ├── quarterly-planning/     # Quarterly planning sessions
   ├── level-10/               # Level 10 meeting facilitation
   ├── ids/                    # Issues Solving (IDS) methodology
   └── annual-planning/        # Annual planning and strategic sessions
   ```

2. **Place your documents** in the appropriate profile folders based on their content

3. **Install dependencies** (if not already done):
   ```bash
   pnpm install
   ```

### Running the Upload Script

```bash
# Upload all EOS Implementer documents
pnpm run upload-eos-docs
```

The script will:
- Scan all profile folders
- Process supported file types (PDF, TXT, MD, DOC, DOCX)
- Upload documents to their respective Upstash namespaces
- Make them available to the EOS Implementer persona profiles

### Namespace Mapping

| Folder | Profile | Upstash Namespace | Purpose |
|--------|---------|-------------------|---------|
| `general/` | General EOS Implementer | `eos-implementer` | Core EOS methodology and tools |
| `vision-day-1/` | Vision Building Day 1 | `eos-implementer-vision-day-1` | People and Data components |
| `vision-day-2/` | Vision Building Day 2 | `eos-implementer-vision-day-2` | Vision, Issues, Process, Traction |
| `quarterly-planning/` | Quarterly Planning | `eos-implementer-quarterly-planning` | Quarterly planning and Rock setting |
| `level-10/` | Level 10 Meeting Facilitation | `eos-implementer-level-10` | Level 10 meetings and IDS |
| `ids/` | Issues Solving (IDS) | `eos-implementer-ids` | IDS methodology and facilitation |
| `annual-planning/` | Annual Planning | `eos-implementer-annual-planning` | Annual planning and strategy |

## How It Works

### Document Processing
1. **File Reading**: Documents are read from their respective profile folders
2. **Content Extraction**: Text content is extracted (PDFs require text-based content)
3. **Chunking**: Documents are automatically split into semantic chunks
4. **Embedding**: Each chunk is converted to vector embeddings using OpenAI
5. **Storage**: Embeddings are stored in Upstash with the profile's namespace

### AI Integration
- When users select an EOS Implementer profile, the AI searches only that profile's namespace
- Documents provide specialized knowledge for each EOS activity
- The AI can reference specific methodologies, templates, and best practices from your documents

## EOS Implementer Access Control

### Who Can See the EOS Implementer Persona
- Users with `@eosworldwide.com` email addresses
- Quinn (`quinn@upaway.dev`)

This is controlled by the `hasEOSAccess()` function and API filtering.

### Profile Selection
- Only authorized users can see the EOS Implementer persona
- Users can select from available profiles to get specialized guidance
- Each profile uses its own knowledge namespace for relevant document retrieval

## Document Organization Best Practices

### general/
Place documents about:
- Core EOS concepts and methodology
- General implementation guidance
- EOS tools overview
- Common challenges and solutions

### vision-day-1/
Place documents about:
- Core Values exercises and examples
- Accountability Chart templates and guidance
- Scorecard development and examples
- People component facilitation

### vision-day-2/
Place documents about:
- Core Focus exercises and examples
- 10-Year Target setting
- Marketing Strategy development
- 3-Year Picture and 1-Year Plan templates
- Rocks setting methodology

### quarterly-planning/
Place documents about:
- Quarterly planning agendas
- Rock review processes
- Quarterly scorecard analysis
- Issue identification for quarterly sessions

### level-10/
Place documents about:
- Level 10 meeting agendas and timing
- IDS facilitation techniques
- Meeting discipline and best practices
- Scorecard review in meetings

### ids/
Place documents about:
- Identify, Discuss, Solve methodology
- Issue identification techniques
- Discussion facilitation methods
- Solution implementation strategies

### annual-planning/
Place documents about:
- Annual planning session agendas
- Strategic planning methodologies
- Annual Rock setting
- Budget integration with EOS planning

## Supported File Types

- **PDF** (.pdf) - Requires text-based content (not scanned images)
- **Text** (.txt) - Plain text files
- **Markdown** (.md) - Formatted text with structure
- **Word** (.doc, .docx) - Microsoft Word documents

## Example Workflow

1. **Organize your EOS materials** by the type of session or activity
2. **Place Vision Building Day 1 materials** in `vision-day-1/`
3. **Add Level 10 meeting guides** to `level-10/`
4. **Include IDS facilitation documents** in `ids/`
5. **Run the upload script**: `pnpm run upload-eos-docs`
6. **Test with users** who have EOS access to ensure documents are being retrieved correctly

## Troubleshooting

### Upload Script Errors
- Check that folder names match exactly (case-sensitive)
- Ensure documents are text-based (not scanned images)
- Verify file permissions and network connectivity

### Document Not Retrieved
- Confirm the document was uploaded to the correct profile folder
- Check that the content is relevant to the profile's purpose
- Ensure the document has sufficient text content (minimum 50 characters)

### Access Issues
- Verify user email domain (@eosworldwide.com or quinn@upaway.dev)
- Check that the EOS Implementer persona is visible in the dropdown
- Confirm the specific profile is selectable

## Technical Details

### System RAG vs User RAG
- **EOS Implementer documents** go to the **system RAG database**
- **User-uploaded documents** go to individual **user RAG databases**
- **Namespace isolation** ensures profile-specific document retrieval

### Vector Search
- Documents are chunked and embedded using OpenAI embeddings
- When a user asks a question with an EOS Implementer profile selected, the AI searches only that profile's namespace
- Relevant chunks are retrieved and used to enhance the AI's response

## Support

For issues or questions:
- Check the upload script console output for detailed error messages
- Review the `eos-implementer-documents/README.md` for folder structure
- Verify that documents contain meaningful text content
- Contact technical support with specific error details and file information 