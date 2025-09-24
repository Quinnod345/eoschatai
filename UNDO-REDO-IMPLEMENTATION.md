# Document Undo/Redo Implementation

## Overview

I've implemented a complete undo/redo history system with database persistence for document composers. This allows users to undo and redo changes to their documents with full history tracking.

## Features

1. **Database Persistence**: All document versions are stored in the database
2. **Per-User History**: Each user has their own undo/redo stack for each document
3. **Keyboard Shortcuts**: Cmd+Z (Mac) / Ctrl+Z (Windows) for undo, Cmd+Shift+Z or Cmd+Y for redo
4. **UI Controls**: Undo/Redo buttons in the document toolbar
5. **Auto-Save**: Changes are automatically saved after 2 seconds of inactivity
6. **Edit Sessions**: Groups related edits together for better history management

## Database Schema

### New Tables

1. **DocumentHistory**: Tracks all document operations
   - `id`: UUID primary key
   - `documentId`: References the document
   - `userId`: References the user who made the change
   - `operation`: Type of operation (create, update, delete, restore)
   - `timestamp`: When the operation occurred
   - `metadata`: Additional operation details

2. **DocumentVersion**: Stores actual content versions
   - `id`: UUID primary key
   - `documentId`: References the document
   - `historyId`: References the history entry
   - `versionNumber`: Sequential version number
   - `title`: Document title at this version
   - `content`: Document content at this version
   - `kind`: Document type
   - `createdAt`: When this version was created

3. **DocumentEditSession**: Groups related edits
   - `id`: UUID primary key
   - `documentId`: References the document
   - `userId`: References the user
   - `startedAt`: When the session started
   - `endedAt`: When the session ended
   - `isActive`: Whether the session is currently active
   - `editCount`: Number of edits in this session

4. **DocumentUndoStack**: Manages undo/redo stacks per user per document
   - `id`: UUID primary key
   - `documentId`: References the document
   - `userId`: References the user
   - `currentVersionId`: Current version being viewed
   - `undoStack`: Array of version IDs that can be undone
   - `redoStack`: Array of version IDs that can be redone
   - `maxStackSize`: Maximum number of undo operations (default: 50)

## Implementation Details

### Frontend Components

1. **useDocumentHistory Hook** (`/hooks/use-document-history.ts`)
   - Manages document history state
   - Handles auto-save functionality
   - Provides undo/redo operations
   - Tracks edit sessions

2. **Text Editor Integration** (`/components/text-editor.tsx`)
   - Integrates the document history hook
   - Handles keyboard shortcuts
   - Updates editor content on undo/redo
   - Listens for custom undo/redo events

3. **Composer Actions** (`/composer/text/client.tsx`)
   - Added Undo/Redo action buttons
   - Buttons are enabled/disabled based on history state
   - Dispatches custom events for undo/redo operations

### Backend API

1. **Document History API** (`/lib/db/document-history.ts`)
   - `createDocumentVersion`: Creates a new version with history tracking
   - `undoDocumentChange`: Reverts to previous version
   - `redoDocumentChange`: Advances to next version
   - `getDocumentHistory`: Retrieves document history
   - `getUndoRedoState`: Gets current undo/redo availability

2. **API Routes**
   - `POST /api/documents/[id]/history`: Create new version
   - `GET /api/documents/[id]/history/state`: Get undo/redo state
   - `POST /api/documents/[id]/history/undo`: Perform undo
   - `POST /api/documents/[id]/history/redo`: Perform redo
   - `GET /api/documents/history/version/[id]`: Get specific version

## Usage

1. **Automatic History Tracking**: As users edit documents, versions are automatically saved after 2 seconds of inactivity

2. **Undo Changes**:
   - Click the Undo button in the toolbar
   - Press Cmd+Z (Mac) or Ctrl+Z (Windows)

3. **Redo Changes**:
   - Click the Redo button in the toolbar
   - Press Cmd+Shift+Z or Cmd+Y (Mac) / Ctrl+Y (Windows)

4. **View History**: The system tracks up to 50 versions per user per document

## Migration

Run the database migration to create the necessary tables:

```bash
pnpm db:migrate
```

The migration will create all required tables and indexes.

## Future Enhancements

1. **History Viewer**: UI to browse and restore any previous version
2. **Collaborative History**: Track who made which changes in shared documents
3. **Branching**: Create branches from specific versions
4. **Conflict Resolution**: Handle conflicts when multiple users edit simultaneously
5. **History Export**: Export document history for audit purposes


