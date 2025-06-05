# Profile Document Upload System

This guide explains how to add documents to EOS Implementer profiles using the automated folder-based upload system.

## Overview

The system automatically processes documents from the `eos-implementer-documents/` folder structure and uploads them to the appropriate knowledge namespaces. Each folder maps to a specific EOS Implementer profile, allowing for specialized knowledge retrieval.

## Folder Structure and Namespace Mapping

```
eos-implementer-documents/
├── general/                # → eos-implementer
├── vision-day-1/           # → eos-implementer-vision-day-1
├── vision-day-2/           # → eos-implementer-vision-day-2
├── quarterly-planning/     # → eos-implementer-quarterly-planning
├── focus-day/              # → eos-implementer-focus-day
├── level-10/               # → eos-implementer-level-10
├── ids/                    # → eos-implementer-ids
└── annual-planning/        # → eos-implementer-annual-planning
```

### Profile Descriptions

| Folder | Profile | Namespace | Purpose |
|--------|---------|-----------|---------|
| `general/` | General EOS Implementer | `eos-implementer` | Core EOS methodology and tools |
| `vision-day-1/` | Vision Building Day 1 | `eos-implementer-vision-day-1` | People and Data components |
| `vision-day-2/` | Vision Building Day 2 | `eos-implementer-vision-day-2` | Vision, Issues, Process, Traction |
| `quarterly-planning/` | Quarterly Planning | `eos-implementer-quarterly-planning` | Quarterly sessions and Rock setting |
| `focus-day/` | Focus Day | `eos-implementer-focus-day` | Initial assessment and introduction |
| `level-10/` | Level 10 Meetings | `eos-implementer-level-10` | Meeting facilitation and IDS |
| `ids/` | Issues Solving | `eos-implementer-ids` | IDS methodology and issue resolution |
| `annual-planning/` | Annual Planning | `eos-implementer-annual-planning` | Strategic planning and annual Rocks |

## Supported File Types

- **Markdown** (`.md`) - Recommended format
- **Text files** (`.txt`) - Plain text documents
- **PDF** (`.pdf`) - *Coming soon*
- **Word** (`.doc`, `.docx`) - *Coming soon*

> **Note**: Currently, only Markdown and text files are supported. PDF and Word document support will be added in future updates.

## How to Add Documents

### Step 1: Prepare Your Documents

1. **Convert to Markdown**: For best results, convert your documents to Markdown format (`.md`)
2. **Use Clear Structure**: Include headings, lists, and proper formatting
3. **Add Metadata**: Include relevant context and examples in your documents

### Step 2: Place Documents in Folders

1. Navigate to the `eos-implementer-documents/` directory
2. Choose the appropriate profile folder based on the content
3. Add your documents to the folder

**Example:**
```bash
# Add a quarterly planning guide
eos-implementer-documents/quarterly-planning/quarterly-session-agenda.md

# Add general EOS methodology
eos-implementer-documents/general/eos-overview.md

# Add Level 10 meeting facilitation guide
eos-implementer-documents/level-10/meeting-facilitation-tips.md
```

### Step 3: Upload Documents

Run the upload command:

```bash
# Upload all documents
npm run upload-eos-docs upload

# Clear all existing documents and re-upload
npm run upload-eos-docs reset

# Clear all documents (without re-uploading)
npm run upload-eos-docs clear
```

## Upload Script Commands

| Command | Description |
|---------|-------------|
| `upload` | Process and upload all documents from folders |
| `clear` | Remove all documents from EOS Implementer namespaces |
| `reset` | Clear existing documents and upload fresh copies |

## Document Processing

### Automatic Processing
- **Chunking**: Documents are automatically split into optimal chunks for AI retrieval
- **Embedding**: Each chunk is converted to vector embeddings using OpenAI
- **Metadata**: File information, folder mapping, and upload timestamps are preserved
- **Namespace Isolation**: Each profile's documents are stored in separate namespaces

### Metadata Added
```json
{
  "fileName": "quarterly-session-agenda.md",
  "folderName": "quarterly-planning",
  "filePath": "/path/to/file",
  "uploadedAt": "2024-01-15T10:30:00Z",
  "source": "eos-implementer-documents"
}
```

## How It Works with Profiles

### Profile Selection
When a user selects an EOS Implementer profile:

1. **Profile Detection**: System identifies the selected profile ID
2. **Namespace Mapping**: Maps profile to corresponding knowledge namespace
3. **RAG Retrieval**: Searches only documents in that profile's namespace
4. **Context Integration**: Relevant documents are added to the AI's context

### Example Flow
```
User selects "Quarterly Planning" profile
    ↓
System maps to "eos-implementer-quarterly-planning" namespace
    ↓
User asks: "How should I structure a quarterly session?"
    ↓
RAG searches documents in quarterly-planning namespace
    ↓
AI responds with specific quarterly planning guidance
```

## Best Practices

### Document Organization
- **Single Focus**: Each document should focus on one specific topic or process
- **Clear Naming**: Use descriptive filenames that indicate content
- **Logical Grouping**: Place documents in the most relevant profile folder

### Content Guidelines
- **Actionable Content**: Include specific steps, processes, and methodologies
- **Examples**: Provide real-world examples and case studies
- **Templates**: Include templates, checklists, and frameworks
- **Troubleshooting**: Add common challenges and solutions

### File Naming Conventions
```
# Good examples
quarterly-session-agenda.md
rock-setting-methodology.md
ids-facilitation-guide.md
scorecard-creation-process.md

# Avoid
document1.md
notes.txt
misc-stuff.md
```

## Troubleshooting

### Common Issues

**Documents Not Found**
- Ensure files are in the correct folder
- Check file extensions are supported (`.md`, `.txt`)
- Verify files are not empty

**Upload Failures**
- Check database connection
- Verify environment variables are set
- Ensure OpenAI API key is valid

**Profile Not Working**
- Confirm namespace mapping exists in script
- Check profile ID matches expected format
- Verify user has EOS Implementer access

### Debug Information
The upload script provides detailed logging:
- Files found and processed
- Upload success/failure status
- Namespace mappings
- Error details

## Adding New Profiles

To add a new EOS Implementer profile:

### Step 1: Update Namespace Mapping
Edit `scripts/upload-eos-implementer-docs.ts`:

```typescript
const FOLDER_TO_NAMESPACE_MAP: Record<string, string> = {
  // ... existing mappings
  'new-profile': 'eos-implementer-new-profile',
};
```

### Step 2: Create Folder
```bash
mkdir eos-implementer-documents/new-profile
```

### Step 3: Add Profile Definition
Update `lib/ai/eos-implementer.ts` to include the new profile:

```typescript
'new-profile': {
  id: 'new-profile',
  name: 'New Profile Name',
  description: 'Profile description',
  instructions: 'Profile-specific instructions...',
  knowledgeNamespace: 'eos-implementer-new-profile',
},
```

### Step 4: Upload Documents
```bash
npm run upload-eos-docs upload
```

## Monitoring and Maintenance

### Regular Tasks
- **Content Updates**: Regularly update documents with new methodologies
- **Quality Review**: Periodically review and improve document quality
- **Performance Monitoring**: Monitor RAG retrieval effectiveness
- **User Feedback**: Collect feedback on profile-specific responses

### Analytics
- Track which profiles are used most frequently
- Monitor document retrieval success rates
- Analyze user satisfaction with profile-specific responses

## Security and Access

### Access Control
- Only users with `@eosworldwide.com` email or `quinn@upaway.dev` can access EOS Implementer profiles
- Documents are stored in system-wide namespaces, not user-specific storage
- All uploads require proper authentication and environment setup

### Data Privacy
- Documents are processed and stored securely
- No personal client information should be included in uploaded documents
- Focus on methodologies, processes, and general guidance

## Future Enhancements

### Planned Features
- **PDF Support**: Direct PDF document processing
- **Word Document Support**: `.doc` and `.docx` file processing
- **Batch Operations**: Bulk document management tools
- **Version Control**: Document versioning and change tracking
- **Analytics Dashboard**: Usage and effectiveness metrics

### Integration Opportunities
- **Document Templates**: Auto-generate EOS documents from uploaded content
- **Client Customization**: Profile-specific document recommendations
- **Training Materials**: Integration with EOS training programs

This system provides a powerful way to create specialized, knowledge-rich EOS Implementer profiles that can provide expert guidance based on your specific methodologies and best practices. 