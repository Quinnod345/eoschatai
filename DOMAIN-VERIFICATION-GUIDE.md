# Domain Verification Guide for app.eosbot.ai

This guide will help you verify ownership of your domain (https://app.eosbot.ai) in Google Search Console, which is required for Google's app verification process.

## Prerequisites

1. Access to your domain's DNS settings (through your domain registrar like GoDaddy, Namecheap, etc.)
2. A Google account (the same one used for your Google Cloud project)

## Step 1: Access Google Search Console

1. Go to [Google Search Console](https://search.console.google.com/)
2. Sign in with the Google account associated with your Google Cloud project

## Step 2: Add Your Property

1. Click the "Add property" button in the top left of the dashboard
2. Select "URL prefix" as your property type
3. Enter your website URL: `https://app.eosbot.ai/`
4. Click "Continue"

## Step 3: Choose Verification Method

Google offers several verification methods. The recommended methods are:

### Option 1: HTML File Upload (Easiest if you have direct file access to your website)

1. Download the HTML verification file provided by Google
2. Upload this file to the root directory of your website (public folder in your Next.js app)
3. Verify that the file is accessible by visiting `https://app.eosbot.ai/[filename].html`
4. Click "Verify" in Google Search Console

### Option 2: HTML Tag (Good for Next.js sites)

1. Select the HTML tag verification method
2. Copy the meta tag provided by Google
3. Add this meta tag to the `<head>` section of your app/layout.tsx file, like:
   ```tsx
   <head>
     {/* Existing head content */}
     <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
   </head>
   ```
4. Deploy your website with this change
5. Click "Verify" in Google Search Console

### Option 3: DNS Record (Most reliable long-term)

1. Select the DNS verification method
2. You'll receive a TXT record with a name and value
3. Log in to your domain registrar (e.g., GoDaddy, Namecheap)
4. Navigate to the DNS management section
5. Add a new TXT record:
   - Name/Host: usually @ or the subdomain name (follow Google's instructions)
   - Value/Answer: paste the verification value provided by Google
   - TTL: set to automatic or 3600 seconds (1 hour)
6. Save the changes
7. Wait for DNS propagation (can take up to 24-48 hours, but often happens in minutes)
8. Click "Verify" in Google Search Console

## Step 4: Confirm Verification

Once verified, you should see your property dashboard in Google Search Console. This means Google recognizes you as the owner of the domain.

## Step 5: Document the Verification for Google Cloud

When responding to Google about your app verification:

1. Take a screenshot of your verified property in Google Search Console
2. Mention the verification method you used
3. Provide any other requested details about your domain ownership

## Troubleshooting

- **Verification Failed**: Ensure you've properly implemented the verification method and wait a few hours before trying again
- **DNS Issues**: Use tools like [DNSChecker](https://dnschecker.org/) to verify your DNS records have propagated
- **File Access Issues**: Confirm your verification file is accessible without authentication

## Additional Notes

- Verification typically remains valid unless you remove the verification method
- You can add multiple verification methods for redundancy
- Once verified, you can add user permissions in Google Search Console to allow team members to access the property

If you encounter any issues with domain verification, refer to [Google's official documentation](https://support.google.com/webmasters/answer/9008080) or contact your domain registrar for assistance. 