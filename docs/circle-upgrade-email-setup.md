# Circle Upgrade Email Setup Guide

## Overview

When an existing EOS Bot user upgrades their plan in Circle, we can automatically send them an upgrade notification email by adding a tag. This guide walks through setting up the Circle workflow to make that happen.

---

## Step 1: Create the Tag

1. Go to your Circle admin dashboard
2. Navigate to **Settings → Tags** (or Members → Tags)
3. Create a new tag called: **`send-upgrade-email`**
   - The name must be exactly `send-upgrade-email` (lowercase, with hyphens)

---

## Step 2: Create the Workflow

1. Go to **Automations → Workflows** in Circle
2. Create a new workflow
3. **Trigger**: Set it to fire when a member is tagged with `send-upgrade-email`
4. **Action**: Add a **Send Webhook** step with the following URL:

```
https://www.eosbot.ai/api/webhooks/circle?token=<CIRCLE_WEBHOOK_TOKEN>
```

> Replace `<CIRCLE_WEBHOOK_TOKEN>` with the actual token value (ask your dev team if you don't have it).

5. Set the webhook method to **POST**
6. Save and activate the workflow

---

## Step 3: Sending an Upgrade Email

Whenever you want to send the upgrade notification email to an existing user:

1. Go to the member's profile in Circle
2. Add the **`send-upgrade-email`** tag to them
3. The workflow will fire automatically and the system will:
   - Look up the member's current tier from their Circle access group
   - Find their existing EOS Bot account
   - Send them an email confirming their upgrade with a link to log in

---

## What the User Receives

The email tells them:
- Their plan has been upgraded
- Which tier they're now on (e.g., Mastery, Strengthen)
- A button to go straight to EOS AI and log in with their existing credentials
- **No password reset** — it assumes they already have an account and know their password

---

## Testing

To test the full flow:

1. Add the `send-upgrade-email` tag to a test member (e.g., quinn@upaway.dev)
2. Check that the email arrives in their inbox
3. Verify the email shows the correct tier name and the "Go to EOS AI" button works

---

## Notes

- This only works for users who **already have an EOS Bot account**. Brand-new users created through Circle automatically get a separate welcome email with a password setup link.
- You can remove and re-add the tag to resend the email if needed.
- The system determines the user's tier from their Circle access group (Mastery, Strengthen, etc.) — the tag just triggers the email, it doesn't control which tier is shown.
