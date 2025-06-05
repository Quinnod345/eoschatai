# Persona Icon Storage Setup

This document explains how persona icon storage has been implemented using Vercel Blob, similar to the profile picture functionality.

## Overview

The persona icon feature allows users to upload custom icons for their AI personas, which are stored in Vercel Blob and displayed throughout the application interface.

## Implementation Details

### Database Schema Changes

Added `iconUrl` field to the `Persona` table:

```sql
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
```

### API Endpoint

**`/api/personas/[id]/icon`** - POST endpoint for uploading persona icons

- Validates file type (JPEG, PNG, GIF, WebP)
- Validates file size (max 5MB)
- Uploads to Vercel Blob under `persona-icons/` folder
- Updates persona record with the blob URL
- Returns the uploaded image URL

### Frontend Components

#### PersonaModal Updates
- Added icon upload UI with image preview
- Integrated with ImageCropper component for circular cropping
- Shows upload progress and error handling
- Requires persona to be saved before icon upload

#### PersonasDropdown Updates
- Displays persona icons in the dropdown menu
- Shows icons in the trigger button for selected persona
- Fallback to first letter of persona name if no icon
- Smooth animations and hover effects

### File Storage Structure

Icons are stored in Vercel Blob with the following naming convention:
```
persona-icons/{personaId}-{timestamp}.{extension}
```

### Image Processing

- **Aspect Ratio**: 1:1 (square)
- **Cropping**: Circular crop applied
- **Validation**: File type and size validation
- **Caching**: 1 year cache control for optimal performance

## Usage Instructions

### For Users

1. **Create or Edit a Persona**
   - Open the persona modal from the personas dropdown
   - Fill in the required fields (name, instructions)
   - Save the persona first

2. **Upload an Icon**
   - Click the "Upload Icon" or "Change Icon" button
   - Select an image file from your device
   - Use the cropper to adjust the image
   - Click "Crop & Save" to upload

3. **View Icons**
   - Icons appear in the personas dropdown
   - Selected persona icon shows in the chat header
   - Icons are displayed throughout the interface

### For Developers

#### Adding Icon Support to New Components

```tsx
import Image from 'next/image';
import { UserIcon } from '@/components/icons';

// Display persona with icon fallback
{persona.iconUrl ? (
  <Image
    src={persona.iconUrl}
    alt={`${persona.name} icon`}
    width={40}
    height={40}
    className="object-cover rounded-full"
  />
) : (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center">
    <span className="text-white text-sm font-bold">
      {persona.name.charAt(0).toUpperCase()}
    </span>
  </div>
)}
```

#### API Usage

```typescript
// Upload persona icon
const formData = new FormData();
formData.append('file', iconFile);

const response = await fetch(`/api/personas/${personaId}/icon`, {
  method: 'POST',
  body: formData,
});

const { url } = await response.json();
```

## Security Considerations

- **Authentication**: Only authenticated users can upload icons
- **Authorization**: Users can only upload icons for their own personas
- **File Validation**: Strict file type and size validation
- **Public URLs**: Icons are stored with public access but unguessable URLs
- **Rate Limiting**: Inherent rate limiting through file size restrictions

## Error Handling

- **File Type Validation**: Clear error messages for unsupported formats
- **File Size Validation**: Helpful guidance on size limits
- **Network Errors**: Graceful handling of upload failures
- **Image Loading**: Fallback to text initials if image fails to load

## Performance Optimizations

- **Caching**: 1-year cache control headers
- **Image Optimization**: Next.js Image component with optimization
- **Lazy Loading**: Images loaded only when needed
- **Compression**: Automatic compression during upload

## Troubleshooting

### Common Issues

1. **Upload Fails**
   - Check file size (must be under 5MB)
   - Verify file type (JPEG, PNG, GIF, WebP only)
   - Ensure persona is saved before uploading

2. **Icon Not Displaying**
   - Check browser console for image loading errors
   - Verify Vercel Blob configuration
   - Ensure Next.js image domains are configured

3. **Cropper Not Working**
   - Verify ImageCropper component is properly imported
   - Check for JavaScript errors in console
   - Ensure file is properly selected

### Configuration Check

Verify your `next.config.ts` includes Vercel Blob domains:

```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.public.blob.vercel-storage.com',
    },
  ],
},
```

## Future Enhancements

Potential improvements for the persona icon feature:

- **Bulk Upload**: Upload multiple icons at once
- **Icon Library**: Pre-made icon sets for quick selection
- **Advanced Editing**: More sophisticated image editing tools
- **Icon Themes**: Consistent styling across persona icons
- **Analytics**: Track icon usage and popularity

## Related Documentation

- [Profile Picture Setup](./PROFILE-PICTURE-SETUP.md)
- [Persona Implementation Guide](./PERSONA-IMPLEMENTATION-GUIDE.md)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob) 