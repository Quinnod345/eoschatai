# System Persona Restrictions & Document Management

## Overview

This document outlines the restrictions placed on system personas and the document management system for the EOSAI application.

## System Persona Restrictions

### What are System Personas?

System personas are pre-built AI personalities created and maintained by the system administrators. They are marked with `isSystemPersona: true` in the database and are available to all users.

### User Restrictions

Users **CANNOT**:

1. **Edit System Personas**
   - No access to edit persona name, description, or instructions
   - Edit buttons are hidden in the UI for system personas
   - API endpoints reject edit requests for system personas

2. **Delete System Personas**
   - System personas cannot be deleted by users
   - API endpoints prevent deletion of system personas

3. **Create Profiles for System Personas**
   - Users cannot add new profiles to system personas
   - "Create New Profile" button is hidden for system personas
   - API endpoints reject profile creation for system personas

4. **Edit Existing Profiles of System Personas**
   - Users cannot modify profiles that belong to system personas
   - Edit buttons are hidden for system persona profiles
   - API endpoints prevent profile editing for system personas
   - **Profiles are only available for the EOS Implementer persona**

5. **Upload Documents to System Personas**
   - Users cannot associate their documents with system personas
   - Document upload is restricted to user-created personas only

### What Users CAN Do

Users **CAN**:

1. **Use System Personas**
   - Select and chat with system personas
   - Switch between different system persona profiles
   - Access all functionality of system personas

2. **Create Their Own Personas**
   - Create custom personas with their own instructions
   - Edit and delete their own personas
   - Upload documents to their own personas

## Profile System Restrictions

### Profile Availability
- **Profiles are ONLY available for the EOS Implementer system persona**
- Other system personas do not have profiles
- User-created personas can have profiles (which users can edit)

### Profile Editing Restrictions
- **EOS Implementer profiles cannot be edited by users**
- No edit buttons are shown for EOS Implementer profiles
- No "Create New Profile" option for EOS Implementer
- Profiles are managed exclusively by system administrators
- Users can only select from existing EOS Implementer profiles

## Document Management System

### Knowledge Base Structure

The system uses a hierarchical knowledge base structure:

```
knowledge-base/
├── eos-implementer/                    # General EOS methodology
├── eos-implementer-vision-day-1/       # Vision Building Day 1
├── eos-implementer-vision-day-2/       # Vision Building Day 2
├── eos-implementer-quarterly-planning/ # Quarterly planning
├── eos-implementer-level-10/           # Level 10 meetings
├── eos-implementer-ids/                # Issues Solving (IDS)
└── eos-implementer-annual-planning/    # Annual planning
```

### Namespace Mapping

Each directory maps to a specific knowledge namespace:

| Directory | Namespace | Purpose |
|-----------|-----------|---------|
| `eos-implementer` | `eos-implementer` | General EOS methodology and implementation |
| `eos-implementer-vision-day-1` | `eos-implementer-vision-day-1` | Vision Building Day 1 - People and Data |
| `eos-implementer-vision-day-2` | `eos-implementer-vision-day-2` | Vision Building Day 2 - Vision, Issues, Process, Traction |
| `eos-implementer-quarterly-planning` | `eos-implementer-quarterly-planning` | Quarterly planning sessions and Rock setting |
| `eos-implementer-level-10` | `eos-implementer-level-10` | Level 10 meeting facilitation |
| `eos-implementer-ids` | `eos-implementer-ids` | Issues Solving (IDS) methodology |
| `eos-implementer-annual-planning` | `eos-implementer-annual-planning` | Annual planning and strategic sessions |

### Document Processing

#### Hardcoded Documents

System persona documents are:
- **Hardcoded**: Stored in the `knowledge-base/` directory
- **Static**: Not dynamically uploaded by users
- **Curated**: Professionally written and maintained
- **Chunked**: Automatically processed and embedded
- **Namespaced**: Stored in specific RAG namespaces

#### Upload Process

1. **Add Documents**: Place markdown files in appropriate `knowledge-base/` subdirectories
2. **Run Script**: Execute `npm run upload-knowledge` to process documents
3. **Chunking**: Documents are automatically split into semantic chunks
4. **Embedding**: Each chunk is converted to vector embeddings
5. **Storage**: Embeddings are stored in the system RAG database with namespace

#### Document Format

Documents should be:
- **Markdown format** (`.md` files)
- **Well-structured** with clear headings
- **Actionable** EOS guidance and best practices
- **Comprehensive** but focused on specific topics
- **Professional** quality content

### RAG Integration

#### System RAG vs User RAG

- **System RAG**: Contains curated system persona documents
- **User RAG**: Contains user-uploaded documents
- **Namespace Isolation**: Each persona/profile has its own namespace
- **Priority**: System documents take precedence for system personas

#### Search and Retrieval

1. **Query Processing**: User questions are converted to embeddings
2. **Namespace Search**: Only relevant namespace is searched
3. **Relevance Filtering**: Only high-relevance chunks are returned
4. **Context Building**: Relevant chunks are added to AI prompt

## Implementation Details

### Database Schema

```sql
-- System personas have isSystemPersona = true
CREATE TABLE "Persona" (
  "id" uuid PRIMARY KEY,
  "userId" uuid REFERENCES "User"("id"), -- NULL for system personas
  "name" varchar(128) NOT NULL,
  "description" text,
  "instructions" text NOT NULL,
  "isSystemPersona" boolean DEFAULT false, -- TRUE for system personas
  "knowledgeNamespace" varchar(128), -- RAG namespace
  -- ... other fields
);

-- System embeddings for system persona documents
CREATE TABLE "SystemEmbeddings" (
  "id" uuid PRIMARY KEY,
  "namespace" varchar(128) NOT NULL, -- Knowledge namespace
  "title" text NOT NULL,
  "chunk" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "metadata" json,
  -- ... other fields
);
```

### API Restrictions

#### Persona Editing (`/api/personas/[id]`)
```typescript
// Only allow editing user personas
if (persona.isSystemPersona) {
  return NextResponse.json(
    { error: 'Cannot edit system personas' },
    { status: 403 }
  );
}
```

#### Profile Creation (`/api/personas/[id]/profiles`)
```typescript
// Don't allow creating profiles for system personas
if (personaData.isSystemPersona) {
  return NextResponse.json(
    { error: 'Cannot create profiles for system personas' },
    { status: 403 }
  );
}
```

#### Profile Editing (`/api/profiles/[id]`)
```typescript
// Only allow editing profiles of user personas
const profileData = await db
  .select({ profile: personaProfile, persona: persona })
  .from(personaProfile)
  .innerJoin(persona, eq(personaProfile.personaId, persona.id))
  .where(
    and(
      eq(personaProfile.id, profileId),
      eq(persona.userId, session.user.id),
      eq(persona.isSystemPersona, false) // Only user personas
    )
  );
```

### Frontend Restrictions

#### Personas Dropdown
```typescript
// Hide edit button for system personas
{!persona.isSystemPersona && (
  <Button onClick={(e) => handleEditPersona(persona, e)}>
    <PencilEditIcon size={16} />
  </Button>
)}
```

#### Profiles Dropdown
```typescript
// Hide edit and create buttons for system personas
const isSystemPersona = persona?.isSystemPersona || false;

{!isSystemPersona && (
  <Button onClick={(e) => handleEditProfile(profile, e)}>
    <PencilEditIcon size={16} />
  </Button>
)}

{!isSystemPersona && (
  <DropdownMenuItem onClick={handleCreateProfile}>
    Create New Profile
  </DropdownMenuItem>
)}
```

## Usage Instructions

### For Administrators

1. **Adding System Documents**:
   ```bash
   # 1. Add markdown files to knowledge-base/[namespace]/
   # 2. Run the upload script
   npm run upload-knowledge
   ```

2. **Creating System Personas**:
   ```bash
   # Run the system persona setup script
   npm run tsx scripts/setup-system-eos-persona.ts
   ```

3. **Updating System Content**:
   - Edit files in `knowledge-base/` directories
   - Re-run `npm run upload-knowledge`
   - Documents are automatically re-chunked and updated

### For Users

1. **Using System Personas**:
   - Select from available system personas
   - Choose specific profiles for specialized guidance
   - Cannot edit or modify system personas

2. **Creating Custom Personas**:
   - Use "Create New Persona" button
   - Add custom instructions and documents
   - Full editing capabilities for own personas

## Security Considerations

1. **Data Isolation**: User documents are isolated in user-specific namespaces
2. **Permission Checks**: All API endpoints verify ownership and permissions
3. **Frontend Restrictions**: UI elements are conditionally rendered based on permissions
4. **System Integrity**: System personas cannot be modified to maintain consistency

## Troubleshooting

### Common Issues

1. **System Persona Not Editable**: This is by design - system personas are read-only
2. **Cannot Create Profile**: Check if the persona is a system persona
3. **Documents Not Loading**: Verify namespace mapping and run upload script
4. **Permission Denied**: Ensure user owns the persona/profile being edited
5. **"Failed to fetch persona" error**: Fixed in latest update - API now supports system personas
6. **Profiles dropdown not showing for EOS Implementer**: Check browser console for detailed logs

### Recent Fixes

1. **API Endpoint Fix**: `/api/personas/[id]` now supports fetching system personas
2. **Default Chat Behavior**: New chats now default to "Default EOS AI" instead of auto-selecting EOS Implementer
3. **Enhanced Logging**: Added detailed console logging for debugging profile dropdown visibility

### Debug Commands

```bash
# Check system personas
npm run tsx scripts/check-system-personas.ts

# Verify knowledge upload
npm run upload-knowledge

# Test RAG functionality
npm run tsx scripts/test-system-rag.ts
```

## Future Enhancements

1. **Admin Interface**: Web-based interface for managing system content
2. **Version Control**: Track changes to system documents
3. **Analytics**: Monitor usage of system personas and profiles
4. **Bulk Operations**: Tools for managing multiple documents at once
5. **Content Validation**: Automated checks for document quality and format 