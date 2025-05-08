# Profile Picture Storage Setup

This document explains how to set up profile picture storage for users using Vercel Blob and Auth.js.

## Prerequisites

- A Vercel account with Vercel Blob enabled
- A PostgreSQL database
- Auth.js for user authentication

## Setup Steps

1. **Install Required Packages**

   The project already has the necessary packages installed, but if needed:

   ```bash
   npm install @vercel/blob
   ```

2. **Set Environment Variables**

   Ensure your `.env.local` file includes the Vercel Blob token:

   ```
   BLOB_READ_WRITE_TOKEN=your_blob_token_here
   ```

   You can get this value from your Vercel dashboard: Storage → Blob → Connect.

3. **Configure Next.js for Blob Domains**

   Update your `next.config.ts` file to allow Vercel Blob domains for image optimization:

   ```typescript
   images: {
     remotePatterns: [
       // ...existing patterns
       {
         protocol: 'https',
         hostname: '*.public.blob.vercel-storage.com',
       },
     ],
   },
   ```

   This allows the `next/image` component to load profile pictures from Vercel Blob.

4. **Run the Migration**

   Add the `profilePicture` field to your database:

   ```bash
   npm run db:add-profile-picture
   ```

   This will run the migration script that adds the `profilePicture` column to the `UserSettings` table.

5. **Verify Blob Connection**

   Test your Vercel Blob connection with:

   ```bash
   npm run test-blob
   ```

   You should see a success message confirming that your Blob store is properly configured.

6. **Restart Your Application**

   Restart your development server to apply the changes:

   ```bash
   npm run dev
   ```

## Implementation Status

The following components have been updated for profile picture storage:

- ✅ Database schema: Added `profilePicture` field to `UserSettings`
- ✅ API endpoint: `/api/user/profile-picture/route.ts` now uploads to Vercel Blob
- ✅ User settings API: Now accepts and stores profilePicture URLs
- ✅ Settings modal: Updated to handle profile picture uploads
- ✅ Next.js config: Configured to allow Vercel Blob domains for images

## How It Works

1. **Upload Process**:
   - When a user uploads a profile picture in the settings modal, the file is sent to the `/api/user/profile-picture` endpoint
   - The endpoint validates the file (type, size) and uploads it to Vercel Blob
   - The Blob URL is returned and stored in the user's settings

2. **Storage**:
   - Images are stored in Vercel Blob with unique names based on the user ID and timestamp
   - Images are cached for 1 year by default for optimal performance
   - Profile pictures are organized in the `profile-pictures/` folder within your Blob store

3. **Display**:
   - The profile picture URL is stored in the database and available through the user settings API
   - The settings modal and other UI components can display the image using the stored URL

## Security Considerations

- Profile pictures are stored as public files, but with unguessable URLs
- Only authenticated users can upload profile pictures
- Files are validated for type and size before upload
- All uploads are tied to the user's session ID from Auth.js

## Troubleshooting

- If uploads fail, check your Vercel Blob token and permissions
- Ensure your database migration has been applied successfully (check with `db:studio`)
- Check the server logs for any error messages during upload
- Verify that the user is properly authenticated before uploading
- Run `npm run test-blob` to verify your Blob connection is working correctly
- If images don't load in the UI, ensure your Next.js config includes the Vercel Blob domain pattern 