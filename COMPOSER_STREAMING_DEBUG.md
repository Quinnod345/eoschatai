# Composer Streaming Debug Guide

## What's Implemented

### Client Side (`components/chat.tsx`)
1. **onData Callback** - Processes `data-composer-*` events in real-time
2. **Polling** - Fetches document updates every 500ms during streaming
3. **Tool Watching** - useEffect watches for `updateDocument` and `createDocument` tools in messages
4. **Auto-open** - Composer auto-opens when createDocument starts

### Server Side (`app/api/chat/route.ts`)
1. **onStepFinish** - Sends composer events when tools execute:
   - `data-composer-kind` - Document type
   - `data-composer-title` - Document title
   - `data-composer-id` - Document ID
   - `data-composer-clear` - Clears content
   - `data-composer-finish` - Signals completion

2. **Incremental Saves** (`composer/text/server.ts`):
   - Saves document every 500ms during streaming
   - Allows polling to pick up intermediate content

## How to Test

1. **Open browser console** (F12)
2. **Open a composer document** (create or open existing)
3. **Ask to edit the document** (e.g., "expand this document")
4. **Watch for these logs:**

### Expected Client Logs:
```
[Chat] 🔍 onData called: { type: 'data-composer-clear', data: '', ... }
[Chat] ✅ Composer event received: clear ''
[Chat] 🔄 Starting polling for document updates: { documentId: '...', status: 'streaming', isVisible: true }
[Chat] 📥 Polling found updated content: { oldLength: 0, newLength: 150 }
[Chat] 📥 Polling found updated content: { oldLength: 150, newLength: 450 }
... (continues during streaming)
[Chat] 🔍 onData called: { type: 'data-composer-finish', data: '', ... }
[Chat] ✅ Composer event received: finish ''
[Chat] 🛑 Stopping polling for document updates
```

### Expected Server Logs:
```
[Chat API] 🔍 onStepFinish called: { toolCallsCount: 1, toolResultsCount: 0, toolNames: ['updateDocument'] }
[Chat API] 📤 Sending updateDocument clear event
[Text Handler] 💾 Saving intermediate content: { documentId: '...', contentLength: 150 }
[Text Handler] 💾 Saving intermediate content: { documentId: '...', contentLength: 450 }
... (continues during streaming)
[Chat API] 📤 Sending updateDocument finish event
```

## Troubleshooting

### If NO onData logs appear:
- Check that `useChat` is calling the onData callback
- Verify `writer.write()` is sending data events correctly
- Check SDK 5 streaming documentation

### If NO polling logs appear:
- Check `composer.status` is set to 'streaming'
- Check `composer.documentId` is not 'init'
- Check `composer.isVisible` is true

### If NO server onStepFinish logs:
- Tool may not be executing (check tool selection logs)
- `composerDocumentId` may not be passed correctly
- Check tool execution in message parts

### If NO intermediate saves happen:
- Check `session?.user?.id` is available
- Check database connection
- Verify `saveDocument` function works

## Quick Fixes

### Force composer to streaming:
Open browser console and run:
```javascript
window.__COMPOSER_STORE__.getState().setComposer(draft => ({ ...draft, status: 'streaming' }))
```

### Check composer state:
```javascript
console.log(window.__COMPOSER_STORE__.getState().composer)
```

### Manually trigger polling:
```javascript
const docId = window.__COMPOSER_STORE__.getState().composer.documentId;
fetch(`/api/document?id=${docId}`).then(r => r.json()).then(console.log);
```




