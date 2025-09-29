-- Create table for tracking organization invitations with email status
CREATE TABLE IF NOT EXISTS "OrgInvitation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "orgId" uuid NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "invitedByUserId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "inviteCode" varchar(255) NOT NULL,
  "resendId" varchar(255), -- Resend email ID for tracking
  "status" varchar(50) NOT NULL DEFAULT 'sent',
  -- Status values: sent, delivered, opened, clicked, bounced, failed, accepted
  "sentAt" timestamp NOT NULL DEFAULT now(),
  "deliveredAt" timestamp,
  "openedAt" timestamp,
  "clickedAt" timestamp,
  "acceptedAt" timestamp,
  "expiresAt" timestamp NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb -- Store additional Resend event data
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "org_invitation_org_idx" ON "OrgInvitation"("orgId");
CREATE INDEX IF NOT EXISTS "org_invitation_email_idx" ON "OrgInvitation"("email");
CREATE INDEX IF NOT EXISTS "org_invitation_code_idx" ON "OrgInvitation"("inviteCode");
CREATE INDEX IF NOT EXISTS "org_invitation_resend_id_idx" ON "OrgInvitation"("resendId");
CREATE INDEX IF NOT EXISTS "org_invitation_status_idx" ON "OrgInvitation"("status");

-- Create unique constraint to prevent duplicate active invitations
CREATE UNIQUE INDEX IF NOT EXISTS "org_invitation_active_unique" ON "OrgInvitation"("orgId", "email") 
WHERE "status" NOT IN ('accepted', 'failed', 'bounced');

