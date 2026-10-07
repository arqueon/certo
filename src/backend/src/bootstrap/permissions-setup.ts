/**
 * Permission setup for Strapi v5
 * Creates and enables permissions for authenticated users
 */

// Permissions to enable for authenticated users
const AUTHENTICATED_PERMISSIONS = [
  // Profile permissions
  'api::profile.profile.find',
  'api::profile.profile.findOne',
  'api::profile.profile.create',
  'api::profile.profile.update',
  'api::profile.profile.delete',
  'api::profile.profile.me',
  'api::profile.profile.myIssuedCredentials',
  'api::profile.profile.myReceivedCredentials',
  'api::profile.profile.findIssuedCredentials',
  'api::profile.profile.findReceivedCredentials',
  'api::profile.profile.exportMyData',
  'api::profile.profile.importMyData',
  'api::profile.profile.dashboardStats',
  'api::profile.profile.rotateSigningKey',

  // Achievement permissions
  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.create',
  'api::achievement.achievement.update',
  'api::achievement.achievement.delete',
  'api::achievement.achievement.credentials',
  
  // Credential permissions
  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.create',
  'api::credential.credential.update',
  'api::credential.credential.delete',
  'api::credential.credential.issue',
  'api::credential.credential.verify',
  'api::credential.credential.validate',
  'api::credential.credential.revoke',
  'api::credential.credential.import',
  'api::credential.credential.export',
  'api::credential.credential.certificate',
  'api::credential.credential.renew',
  'api::credential.credential.expirationCheck',

  // CLR (Comprehensive Learner Record) permissions
  'api::clr.clr.create',

  // Scheduled issuance permissions
  'api::scheduled-issuance.scheduled-issuance.create',
  'api::scheduled-issuance.scheduled-issuance.find',
  'api::scheduled-issuance.scheduled-issuance.cancel',
  'api::scheduled-issuance.scheduled-issuance.runCheck',

  // Evidence permissions
  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',
  'api::evidence.evidence.create',
  'api::evidence.evidence.update',
  'api::evidence.evidence.delete',
  
  // Endorsement permissions
  'api::endorsement.endorsement.find',
  'api::endorsement.endorsement.findOne',
  'api::endorsement.endorsement.create',
  'api::endorsement.endorsement.update',
  'api::endorsement.endorsement.delete',
  'api::endorsement.endorsement.verify',

  // Webhook subscription management
  'api::webhook-subscription.webhook-subscription.find',
  'api::webhook-subscription.webhook-subscription.findOne',
  'api::webhook-subscription.webhook-subscription.create',
  'api::webhook-subscription.webhook-subscription.update',
  'api::webhook-subscription.webhook-subscription.delete',
];

// Holder-only set for Authenticated. Used when AUTHENTICATED_ROLE_MODE=holder:
// deployments where Authenticated is what any person gets on login (e.g. an
// institutional SSO) and issuing happens through a separate service role.
// Most issuer-side actions don't check profile ownership, so leaving the
// default list on Authenticated lets any logged-in person issue, revoke or
// rotate keys.
const HOLDER_PERMISSIONS = [
  'api::profile.profile.me',
  'api::profile.profile.myReceivedCredentials',
  'api::profile.profile.findReceivedCredentials',
  'api::profile.profile.exportMyData',
  'api::profile.profile.dashboardStats',

  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.credentials',

  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.verify',
  'api::credential.credential.certificate',
  'api::credential.credential.export',

  'api::endorsement.endorsement.find',
  'api::endorsement.endorsement.findOne',
  'api::endorsement.endorsement.verify',

  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',

  'plugin::users-permissions.user.me',
  'plugin::users-permissions.auth.changePassword',
];

export type AuthenticatedRoleMode = 'issuer' | 'holder';

export function authenticatedRoleMode(value: string | undefined): AuthenticatedRoleMode {
  return value?.trim().toLowerCase() === 'holder' ? 'holder' : 'issuer';
}

export function authenticatedPermissions(mode: AuthenticatedRoleMode): string[] {
  return mode === 'holder' ? HOLDER_PERMISSIONS : AUTHENTICATED_PERMISSIONS;
}

/** Actions linked to a role that are not in its allowed list. */
export function permissionsToPrune(linked: string[], allowed: string[]): string[] {
  const keep = new Set(allowed);
  return linked.filter((action) => !keep.has(action));
}

// Permissions to enable for the issuer role
const ISSUER_PERMISSIONS = [
  // Webhook subscription management
  'api::webhook-subscription.webhook-subscription.find',
  'api::webhook-subscription.webhook-subscription.findOne',
  'api::webhook-subscription.webhook-subscription.create',
  'api::webhook-subscription.webhook-subscription.update',
  'api::webhook-subscription.webhook-subscription.delete',

  // Credential permissions
  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.create',
  'api::credential.credential.update',
  'api::credential.credential.delete',
  'api::credential.credential.issue',
  'api::credential.credential.validate',
  'api::credential.credential.verify',
  'api::credential.credential.import',
  'api::credential.credential.export',
  'api::credential.credential.revoke',
  'api::credential.credential.renew',
  'api::profile.profile.find',
  'api::profile.profile.findOne',
  'api::profile.profile.me',
  'api::profile.profile.myIssuedCredentials',
  'api::profile.profile.myReceivedCredentials',
  'api::profile.profile.exportMyData',
  'api::profile.profile.importMyData',
  'api::profile.profile.dashboardStats',

  // Achievement permissions
  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.create',
  'api::achievement.achievement.update',
  'api::achievement.achievement.delete',
];

// Permissions to enable for the reviewer role: read/verify everything,
// no create/update/delete.
const REVIEWER_PERMISSIONS = [
  'api::profile.profile.find',
  'api::profile.profile.findOne',

  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',

  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.verify',
  'api::credential.credential.validate',

  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',
];

// Permissions to enable for the viewer role: read-only, narrower than
// reviewer (no evidence, no verify beyond what's already public).
const VIEWER_PERMISSIONS = [
  'api::profile.profile.find',
  'api::profile.profile.findOne',

  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',

  'api::credential.credential.find',
  'api::credential.credential.findOne',
];

// Permissions to enable for public users
const PUBLIC_PERMISSIONS = [
  // Profile - read only
  'api::profile.profile.find',
  'api::profile.profile.findOne',
  'api::profile.profile.findIssuedCredentials',
  'api::profile.profile.findReceivedCredentials',
  
  // Achievement - read only
  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.credentials',
  
  // Credential - read and verify
  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.verify',
  'api::credential.credential.validate',
  'api::credential.credential.certificate',
  
  // Evidence - read only
  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',
  
  // Endorsement - read and verify
  'api::endorsement.endorsement.find',
  'api::endorsement.endorsement.findOne',
  'api::endorsement.endorsement.verify',
];

/**
 * Setup permissions for a specific role
 */
async function setupRolePermissions(strapi: any, roleType: string, permissions: string[]): Promise<void> {
  strapi.log.info(`[Permissions] Setting up ${roleType} permissions...`);
  
  // Get the role
  const role = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });

  if (!role) {
    strapi.log.error(`[Permissions] ${roleType} role not found`);
    return;
  }

  let created = 0;

  for (const action of permissions) {
    try {
      // Each role owns its own permission row (role is manyToOne). Looking
      // the row up by action alone used to return another role's row and
      // re-link it here, which took the permission away from that role.
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: role.id } });
      if (existing) continue;

      await strapi
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: role.id } });
      created++;
    } catch (error) {
      strapi.log.warn(`[Permissions] Could not set ${action}: ${error instanceof Error ? error.message : error}`);
    }
  }

  strapi.log.info(`[Permissions] ${roleType}: created ${created} permissions`);
}

/**
 * Unlink from a role every permission outside its allowed list, so the role
 * converges to that list on each start instead of only ever growing.
 */
async function pruneRolePermissions(strapi: any, roleType: string, allowed: string[]): Promise<void> {
  const role = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });
  if (!role) return;

  const knex = strapi.db.connection;
  const linked: Array<{ id: number; action: string }> = await knex('up_permissions_role_lnk as l')
    .join('up_permissions as p', 'p.id', 'l.permission_id')
    .where('l.role_id', role.id)
    .select('p.id as id', 'p.action as action');

  const extra = new Set(permissionsToPrune(linked.map((row) => row.action), allowed));
  if (extra.size === 0) return;

  await knex('up_permissions_role_lnk')
    .where('role_id', role.id)
    .whereIn('permission_id', linked.filter((row) => extra.has(row.action)).map((row) => row.id))
    .del();
  strapi.log.info(`[Permissions] ${roleType}: unlinked ${extra.size} permissions outside its list: ${[...extra].join(', ')}`);
}

/**
 * Main permission setup function
 */
export async function setupPermissions(strapi: any): Promise<void> {
  strapi.log.info('[Permissions] Starting permission setup...');
  
  try {
    // Setup authenticated permissions. In holder mode the role is also pruned
    // to the holder list, so permissions removed by an operator stay removed.
    const mode = authenticatedRoleMode(process.env.AUTHENTICATED_ROLE_MODE);
    strapi.log.info(`[Permissions] Authenticated role mode: ${mode}`);
    await setupRolePermissions(strapi, 'authenticated', authenticatedPermissions(mode));
    if (mode === 'holder') {
      await pruneRolePermissions(strapi, 'authenticated', HOLDER_PERMISSIONS);
      // The issuing rights Authenticated no longer has go to the service role
      // the backend integrations log in with, if one is configured.
      const serviceRole = process.env.ISSUER_SERVICE_ROLE_TYPE?.trim();
      if (serviceRole) {
        await setupRolePermissions(strapi, serviceRole, AUTHENTICATED_PERMISSIONS);
      }
    }

    // Setup public permissions
    await setupRolePermissions(strapi, 'public', PUBLIC_PERMISSIONS);

    // Setup issuer permissions (no-ops with a log message if no 'issuer' role exists yet)
    await setupRolePermissions(strapi, 'issuer', ISSUER_PERMISSIONS);

    // Reviewer/viewer: same no-op-until-the-role-exists caveat as issuer -
    // these lists are inert until an admin creates matching roles in the
    // admin panel (Settings > Users & Permissions > Roles). See
    // docs/known-issues-and-dev-notes.md and docs/security.md.
    await setupRolePermissions(strapi, 'reviewer', REVIEWER_PERMISSIONS);
    await setupRolePermissions(strapi, 'viewer', VIEWER_PERMISSIONS);

    strapi.log.info('[Permissions] Permission setup complete');
  } catch (error) {
    strapi.log.error(`[Permissions] Error setting up permissions: ${error instanceof Error ? error.message : error}`);
  }
}

export default setupPermissions;
