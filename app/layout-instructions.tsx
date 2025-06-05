// INSTRUCTIONS FOR ADDING UI SETTINGS PROVIDER
//
// To make the font size settings work app-wide, you need to add the UISettingsProvider
// to your app's root layout. Find your root layout file (usually in app/layout.tsx)
// and modify it as shown below:

// Example layout.tsx:
'use client';

import { UISettingsProvider } from '@/components/ui-settings-provider';

// Other imports...

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UISettingsProvider>
          {/* Your existing providers and components */}
          {children}
        </UISettingsProvider>
      </body>
    </html>
  );
}

// Make sure the UISettingsProvider is wrapped around your entire application
// but inside any theme providers you might have.
//
// If you're using Next.js App Router, your layout.tsx would look like this.
// For Pages Router, modify your _app.tsx instead.
