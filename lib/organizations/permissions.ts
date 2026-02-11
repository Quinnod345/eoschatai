import 'server-only';

import { db } from '@/lib/db';
import {
  user as userTable,
  org as orgTable,
  orgMemberRole,
} from '@/lib/db/schema';
import type { Persona } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type OrgPermission =
  | 'org.view' // View organization details
  | 'org.edit' // Edit organization settings
  | 'org.delete' // Delete organization
  | 'members.view' // View member list
  | 'members.invite' // Generate/manage invite codes
  | 'members.remove' // Remove members
  | 'members.edit_role' // Change member roles
  | 'billing.view' // View billing information
  | 'billing.manage' // Manage subscription
  | 'resources.create' // Create shared resources
  | 'resources.delete' // Delete shared resources
  | 'personas.create' // Create shared personas
  | 'personas.edit' // Edit shared personas
  | 'personas.delete'; // Delete shared personas

export type OrgRole = 'owner' | 'admin' | 'member';

export type PersonaAccess = {
  canChat: boolean;
  canViewSettings: boolean;
  canEdit: boolean;
};

// Role-based permission mapping
const rolePermissions: Record<OrgRole, OrgPermission[]> = {
  owner: [
    'org.view',
    'org.edit',
    'org.delete',
    'members.view',
    'members.invite',
    'members.remove',
    'members.edit_role',
    'billing.view',
    'billing.manage',
    'resources.create',
    'resources.delete',
    'personas.create',
    'personas.edit',
    'personas.delete',
  ],
  admin: [
    'org.view',
    'org.edit',
    'members.view',
    'members.invite',
    'members.remove',
    'billing.view',
    'resources.create',
    'resources.delete',
    'personas.create',
    'personas.edit',
    'personas.delete',
  ],
  member: ['org.view', 'members.view', 'billing.view', 'resources.create'],
};

export async function canAccessPersona(
  userId: string,
  personaRecord: Pick<
    Persona,
    'id' | 'userId' | 'orgId' | 'isSystemPersona' | 'isShared' | 'visibility'
  >,
): Promise<PersonaAccess> {
  // System personas are globally chat-accessible but not editable.
  if (personaRecord.isSystemPersona) {
    return {
      canChat: true,
      canViewSettings: false,
      canEdit: false,
    };
  }

  // Persona owner always has full access.
  if (personaRecord.userId === userId) {
    return {
      canChat: true,
      canViewSettings: true,
      canEdit: true,
    };
  }

  const isOrgVisible =
    personaRecord.visibility === 'org' || personaRecord.isShared === true;
  if (!isOrgVisible || !personaRecord.orgId) {
    return {
      canChat: false,
      canViewSettings: false,
      canEdit: false,
    };
  }

  const role = await getUserOrgRole(userId, personaRecord.orgId);
  if (!role) {
    return {
      canChat: false,
      canViewSettings: false,
      canEdit: false,
    };
  }

  const canEdit = rolePermissions[role].includes('personas.edit');
  return {
    canChat: true,
    canViewSettings: canEdit,
    canEdit,
  };
}

/**
 * Get user's role in an organization
 * Uses the OrgMemberRole table for proper role management
 */
export async function getUserOrgRole(
  userId: string,
  orgId: string,
): Promise<OrgRole | null> {
  // Membership is the source of truth. Do not honor stale role rows
  // for users that no longer belong to this organization.
  const [member] = await db
    .select({ orgId: userTable.orgId })
    .from(userTable)
    .where(eq(userTable.id, userId));

  if (!member || member.orgId !== orgId) {
    return null;
  }

  // Then check if the role exists in the role table
  const [roleRecord] = await db
    .select({ role: orgMemberRole.role })
    .from(orgMemberRole)
    .where(
      and(eq(orgMemberRole.userId, userId), eq(orgMemberRole.orgId, orgId)),
    );

  if (roleRecord) {
    return roleRecord.role;
  }

  // Get the organization to check ownership
  const [organization] = await db
    .select({ ownerId: orgTable.ownerId })
    .from(orgTable)
    .where(eq(orgTable.id, orgId));

  if (!organization) {
    return null;
  }

  // Legacy check: if user is the owner from org table
  if (organization.ownerId === userId) {
    // Create the role record for consistency
    await db
      .insert(orgMemberRole)
      .values({ userId, orgId, role: 'owner' })
      .onConflictDoNothing();
    return 'owner';
  }

  // Default to member and create the role record
  await db
    .insert(orgMemberRole)
    .values({ userId, orgId, role: 'member' })
    .onConflictDoNothing();
  return 'member';
}

/**
 * Check if a user has a specific permission in an organization
 */
export async function checkOrgPermission(
  userId: string,
  orgId: string,
  permission: OrgPermission,
): Promise<boolean> {
  const role = await getUserOrgRole(userId, orgId);

  if (!role) {
    return false;
  }

  return rolePermissions[role].includes(permission);
}

/**
 * Get all permissions for a user in an organization
 */
export async function getUserOrgPermissions(
  userId: string,
  orgId: string,
): Promise<OrgPermission[]> {
  const role = await getUserOrgRole(userId, orgId);

  if (!role) {
    return [];
  }

  return rolePermissions[role];
}

/**
 * Middleware helper to check permissions in API routes
 */
export async function requireOrgPermission(
  userId: string,
  orgId: string,
  permission: OrgPermission,
): Promise<void> {
  const hasPermission = await checkOrgPermission(userId, orgId, permission);

  if (!hasPermission) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

/**
 * Check if user can perform actions on another user in the org
 */
export async function canManageUser(
  actorId: string,
  targetUserId: string,
  orgId: string,
  action: 'remove' | 'change_role',
): Promise<boolean> {
  // Get both users' roles
  const [actorRole, targetRole] = await Promise.all([
    getUserOrgRole(actorId, orgId),
    getUserOrgRole(targetUserId, orgId),
  ]);

  if (!actorRole || !targetRole) {
    return false;
  }

  // Users can leave the org themselves, except the sole owner.
  if (action === 'remove' && actorId === targetUserId) {
    if (targetRole !== 'owner') {
      return true;
    }

    const memberCount = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.orgId, orgId));

    return memberCount.length > 1;
  }

  // Only owners can manage other users
  if (actorRole !== 'owner') {
    return false;
  }

  // Owners can't be removed by anyone (including themselves if they're the last member)
  if (targetRole === 'owner' && action === 'remove') {
    // Check if there are other members
    const memberCount = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.orgId, orgId));

    return memberCount.length > 1; // Can only remove owner if there are other members
  }

  return true;
}

/**
 * Change a user's role in an organization
 */
export async function changeUserRole(
  targetUserId: string,
  orgId: string,
  newRole: OrgRole,
): Promise<boolean> {
  try {
    // Check if changing an owner - there must always be at least one owner
    if (newRole !== 'owner') {
      const [currentRole] = await db
        .select({ role: orgMemberRole.role })
        .from(orgMemberRole)
        .where(
          and(
            eq(orgMemberRole.userId, targetUserId),
            eq(orgMemberRole.orgId, orgId),
          ),
        );

      if (currentRole?.role === 'owner') {
        // Count other owners
        const ownerCount = await db
          .select({ count: orgMemberRole.id })
          .from(orgMemberRole)
          .where(
            and(
              eq(orgMemberRole.orgId, orgId),
              eq(orgMemberRole.role, 'owner'),
            ),
          );

        if (ownerCount.length <= 1) {
          throw new Error('Cannot remove the last owner');
        }
      }
    }

    // Update or insert the role
    await db
      .insert(orgMemberRole)
      .values({
        userId: targetUserId,
        orgId,
        role: newRole,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [orgMemberRole.userId, orgMemberRole.orgId],
        set: { role: newRole, updatedAt: new Date() },
      });

    return true;
  } catch (error) {
    console.error('Error changing user role:', error);
    return false;
  }
}
