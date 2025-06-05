# Enhanced Artifacts Integration Guide

## Quick Start

To switch from the old artifact system to the enhanced one, follow these simple steps:

### 1. Replace the Artifact Component

In your main chat or artifact container file, replace the import:

```typescript
// OLD
import { Artifact } from '@/components/artifact';

// NEW
import { EnhancedArtifact } from '@/components/enhanced-artifact';
```

Then update the component usage:

```typescript
// OLD
<Artifact
  chatId={chatId}
  input={input}
  setInput={setInput}
  // ... other props
/>

// NEW
<EnhancedArtifact
  chatId={chatId}
  input={input}
  setInput={setInput}
  // ... other props (same interface)
/>
```

### 2. Test the Enhanced Features

The enhanced artifact system is backward compatible, so your existing artifacts will work immediately with these new features:

#### ✅ **Undo/Redo**
- Use Ctrl+Z / Ctrl+Y or the toolbar buttons
- Navigate through change history
- See what changed and when

#### ✅ **AI-Assisted Editing**
- Select text in any artifact
- Click "AI Edit" button that appears
- Enter a prompt to improve the selected content

#### ✅ **Better Change Tracking**
- Click the "Changes" view mode
- See detailed history of all edits
- Distinguish between AI and user changes

#### ✅ **Enhanced Saving**
- Real-time save status indicators
- Debounced saves to reduce API calls
- Better error handling and recovery

### 3. Optional: Enable AI Integration

To fully utilize the AI editing features, you'll need to implement the AI service integration. The system is designed to work with any AI provider.

Example integration:

```typescript
// Create /api/ai/edit-text endpoint
export async function POST(request: Request) {
  const { prompt, selectedText, context } = await request.json();
  
  // Call your AI service (OpenAI, Anthropic, etc.)
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful text editor. Edit the selected text according to the user's prompt while preserving the overall context."
      },
      {
        role: "user",
        content: `Context: ${context}\n\nSelected text: ${selectedText}\n\nPrompt: ${prompt}\n\nPlease provide only the edited text as a response.`
      }
    ],
  });
  
  return Response.json({ editedText: response.choices[0].message.content });
}
```

### 4. Verify Everything Works

1. **Create a text artifact** - Should work exactly as before
2. **Make some edits** - Should see undo/redo buttons become active
3. **Select text** - Should see AI edit toolbar appear
4. **Try the changes view** - Should see edit history
5. **Test saving** - Should see save status indicators

## Key Benefits You'll Get Immediately

### 🎯 **Better User Experience**
- No more losing work when AI makes suggestions
- Clear visual feedback on what's happening
- Intuitive undo/redo functionality

### 🤖 **Smarter AI Integration**
- AI can edit specific parts instead of replacing everything
- Context-aware suggestions based on content type
- Clear distinction between AI and user edits

### 📝 **Robust Editing**
- Granular change tracking
- Better error handling
- Performance optimizations

### 🔧 **Developer Friendly**
- Full TypeScript support
- Clear interfaces and documentation
- Easy to extend and customize

## Troubleshooting

### Issue: "Enhanced artifact not found"
**Solution**: Make sure you've imported the enhanced artifact correctly:
```typescript
import { EnhancedArtifact } from '@/components/enhanced-artifact';
```

### Issue: "AI editing not working"
**Solution**: The AI editing features require backend integration. They'll show "coming soon" messages until you implement the AI endpoints.

### Issue: "Changes not saving"
**Solution**: Check that the enhanced API endpoint is accessible:
```bash
curl -X POST http://localhost:3000/api/document/enhanced?id=test
```

### Issue: "Performance issues"
**Solution**: The enhanced system includes performance optimizations, but for very large documents, consider:
- Enabling change history limits
- Using debounced saves (already implemented)
- Implementing pagination for change history

## Migration Checklist

- [ ] Replace `Artifact` import with `EnhancedArtifact`
- [ ] Update component usage (same props, just new component)
- [ ] Test basic functionality (create, edit, save)
- [ ] Test enhanced features (undo/redo, AI editing)
- [ ] Verify change tracking works
- [ ] Check save status indicators
- [ ] Test on mobile devices
- [ ] Implement AI endpoints (optional but recommended)
- [ ] Update any custom artifact types
- [ ] Run tests to ensure compatibility

## Next Steps

Once you have the enhanced artifacts working:

1. **Implement AI Integration** - Add the AI editing endpoints for full functionality
2. **Customize AI Suggestions** - Tailor the AI prompts for your specific use case
3. **Add Custom Artifact Types** - Use the enhanced system for new artifact types
4. **Monitor Performance** - Use the built-in debugging and monitoring features
5. **Gather User Feedback** - The enhanced UX should significantly improve user satisfaction

## Support

If you run into any issues:

1. Check the console for error messages
2. Verify all imports are correct
3. Ensure the enhanced API endpoints are working
4. Review the full documentation in `ENHANCED-ARTIFACTS-README.md`

The enhanced artifact system is designed to be a drop-in replacement that immediately improves the user experience while providing a foundation for advanced features like AI-assisted editing and real-time collaboration. 