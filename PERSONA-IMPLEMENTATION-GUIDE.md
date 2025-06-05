# EOS Persona Implementation Guide

## Overview

The EOS Chat AI now supports custom personas that allow users to create specialized AI assistants with custom instructions, expertise areas, and communication styles. This guide explains how the persona functionality has been implemented and how it works.

## Architecture

### Database Schema

The persona functionality is built on the following database tables:

1. **`Persona`** - Stores persona definitions
   - `id` - Unique identifier
   - `userId` - Owner of the persona
   - `name` - Display name (max 128 chars)
   - `description` - Optional description (max 255 chars)
   - `instructions` - Custom instructions for the AI
   - `isDefault` - Whether this is a default persona
   - `createdAt` / `updatedAt` - Timestamps

2. **`PersonaDocument`** - Links personas to user documents
   - `personaId` - Reference to persona
   - `documentId` - Reference to user document

3. **`Chat`** - Extended to include persona reference
   - `personaId` - Optional reference to selected persona

### System Prompt Integration

The persona instructions are integrated into the AI system prompt through the following process:

1. **Request Processing**: When a chat message is sent, the `selectedPersonaId` is included in the request body
2. **Persona Retrieval**: The `systemPrompt` function fetches the persona from the database if a `selectedPersonaId` is provided
3. **Prompt Construction**: The persona's custom instructions are injected into the system prompt as a dedicated section
4. **AI Response**: The AI responds according to both the base EOS knowledge and the custom persona instructions

## Implementation Details

### Frontend Components

#### PersonaModal (`components/persona-modal.tsx`)
- Form for creating and editing personas
- Validates persona name and instructions
- Allows associating documents with personas
- Handles form submission and error states

#### PersonasDropdown (`components/personas-dropdown.tsx`)
- Displays available personas in a dropdown
- Shows "Default EOS AI" option when no persona is selected
- Allows switching between personas
- Provides options to create and edit personas

#### Chat Integration (`components/chat.tsx`)
- Manages selected persona state
- Handles persona changes for new and existing chats
- Stores persona preference in localStorage for new chats
- Updates chat records when persona is changed

### Backend API Routes

#### `/api/personas`
- `GET` - Fetch all personas for the current user
- `POST` - Create a new persona

#### `/api/personas/[id]`
- `GET` - Fetch specific persona details
- `PUT` - Update persona
- `DELETE` - Delete persona

#### `/api/chat/[id]`
- `PATCH` - Update chat persona (for existing chats)

### System Prompt Integration (`lib/ai/prompts.ts`)

The `systemPrompt` function has been enhanced to:

1. Accept a `selectedPersonaId` parameter
2. Fetch persona data from the database when provided
3. Inject persona instructions into the system prompt
4. Handle errors gracefully if persona is not found

```typescript
// Persona context is injected early in the system prompt
const personaContext = `
## PERSONA INSTRUCTIONS
You are now acting as "${personaData.name}". ${personaData.description}

**CUSTOM PERSONA INSTRUCTIONS:**
${personaData.instructions}

**IMPORTANT:** These persona instructions should guide your behavior, expertise, 
communication style, and responses. Integrate these instructions with the base 
EOS knowledge while maintaining the persona's unique characteristics and focus areas.
`;
```

## User Experience Flow

### Creating a Persona

1. User clicks the persona dropdown in the chat header
2. Selects "Create New Persona"
3. Fills out the persona form:
   - Name (required)
   - Description (optional)
   - Instructions (required, min 20 chars)
   - Associated documents (optional)
4. Submits the form
5. Persona is created and becomes available for selection

### Using a Persona

1. User selects a persona from the dropdown
2. For new chats: Persona is applied immediately and stored for future new chats
3. For existing chats: Chat record is updated with the new persona
4. All subsequent messages in that chat use the selected persona's instructions
5. The AI responds according to the persona's custom instructions

### Switching Personas

1. User can switch personas at any time using the dropdown
2. The change applies immediately to the current chat
3. Previous messages remain unchanged, but new responses use the new persona
4. The persona preference is saved for future new chats

## Technical Features

### Error Handling
- Graceful fallback if persona is not found
- Validation of persona data before saving
- User-friendly error messages in the UI

### Performance
- Personas are fetched only when needed
- Database queries are optimized with proper indexing
- Caching of persona data in the frontend

### Security
- Personas are user-scoped (users can only access their own personas)
- Proper authentication checks on all API routes
- Input validation and sanitization

### Logging
- Comprehensive logging for debugging persona-related operations
- Console logs track persona selection, retrieval, and application

## Configuration

### Environment Variables
No additional environment variables are required for persona functionality.

### Database Migrations
The persona tables are created through Drizzle migrations. Ensure migrations are run:

```bash
npm run db:migrate
```

## Testing

### Manual Testing
1. Create a new persona with specific instructions
2. Start a new chat and select the persona
3. Send messages and verify the AI responds according to the persona instructions
4. Switch personas and verify the behavior changes
5. Test with existing chats to ensure persona updates work

### Automated Testing
Basic tests are included in `tests/prompts/persona.ts` to verify:
- System prompt generation with personas
- Graceful handling of missing personas
- Default behavior when no persona is selected

## Troubleshooting

### Common Issues

1. **Persona not applying**: Check browser console for errors, verify persona exists in database
2. **Database errors**: Ensure migrations are run and database connection is working
3. **UI not updating**: Check for JavaScript errors, verify event listeners are working

### Debug Logging

Enable debug logging by checking the browser console for messages prefixed with:
- `PERSONA_CLIENT:` - Frontend persona operations
- `PERSONA_SYSTEM_PROMPT:` - System prompt generation
- `PERSONA_API:` - Backend API operations

## Future Enhancements

Potential improvements to the persona system:

1. **Persona Templates**: Pre-built personas for common EOS roles
2. **Persona Sharing**: Allow sharing personas between team members
3. **Advanced Document Integration**: More sophisticated document-persona relationships
4. **Persona Analytics**: Track which personas are most effective
5. **Voice and Tone Settings**: More granular control over communication style

## Conclusion

The persona functionality provides a powerful way for users to customize their EOS AI experience. By allowing custom instructions and specialized knowledge areas, users can create AI assistants tailored to their specific needs and roles within their organization.

The implementation is designed to be robust, user-friendly, and extensible, providing a solid foundation for future enhancements to the persona system. 