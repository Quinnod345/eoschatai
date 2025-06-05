# EOS Implementer Documents

This directory contains documents specifically for the EOS Implementer persona profiles. Each folder corresponds to a specific EOS Implementer profile and uploads to its dedicated Upstash namespace.

## Directory Structure

Place your documents in the appropriate profile folders:

```
eos-implementer-documents/
├── quarterly-session/      # Quarterly Session Facilitator (eos-implementer-quarterly-session)
├── focus-day/              # Focus Day Facilitator (eos-implementer-focus-day)
├── vision-day-1/           # Vision Building Day 1 Facilitation (eos-implementer-vision-day-1)
└── vision-day-2/           # Vision Building Day 2 Facilitator (eos-implementer-vision-day-2)
```

## Profile Descriptions

### quarterly-session/
- **Profile**: Quarterly Session Facilitator
- **Namespace**: `eos-implementer-quarterly-session`
- **Purpose**: Quarterly planning sessions, Rock setting, and quarterly reviews

### focus-day/
- **Profile**: Focus Day Facilitator
- **Namespace**: `eos-implementer-focus-day`
- **Purpose**: Focus Day facilitation, issue resolution, and EOS discipline reinforcement

### vision-day-1/
- **Profile**: Vision Building Day 1 Facilitation
- **Namespace**: `eos-implementer-vision-day-1`
- **Purpose**: People and Data components of the V/TO (Core Values, Accountability Chart, Scorecard)

### vision-day-2/
- **Profile**: Vision Building Day 2 Facilitator
- **Namespace**: `eos-implementer-vision-day-2`
- **Purpose**: Vision, Issues, Process, and Traction components (Core Focus, 10-Year Target, Rocks)

## Supported File Types

- **Markdown** (.md) - Recommended format
- **Text files** (.txt) - Plain text documents
- **PDF** (.pdf) - Automatically processed and text extracted
- **Word documents** (.doc, .docx) - Automatically processed and text extracted

## How to Upload

1. **Place your documents** in the appropriate profile folders
2. **Run the upload script**:
   ```bash
   pnpm run upload-eos-docs upload
   ```

The script will:
- Process all documents in each profile folder (including PDFs and Word docs)
- Extract text content from all supported file types
- Upload them to the corresponding Upstash namespace
- Make them available to the EOS Implementer persona when users select specific profiles

## Notes

- Documents are uploaded to the **system RAG database**, not user-specific databases
- Each profile has its own isolated namespace in Upstash
- When users select an EOS Implementer profile, the AI will use documents from that profile's namespace
- Only users with EOS access (@eosworldwide.com or quinn@upaway.dev) can see the EOS Implementer persona
- Documents are processed and chunked automatically for optimal AI retrieval
- PDF and Word documents are automatically converted to text for processing

## Example Usage

1. Add your Quarterly Session materials to `quarterly-session/`
2. Add your Focus Day facilitation guides to `focus-day/`
3. Add your Vision Building Day 1 materials to `vision-day-1/`
4. Add your Vision Building Day 2 materials to `vision-day-2/`
5. Run `pnpm run upload-eos-docs upload`
6. Users can now select these profiles and get specialized guidance based on your documents 