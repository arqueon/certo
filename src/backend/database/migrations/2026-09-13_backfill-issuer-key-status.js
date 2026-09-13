'use strict';

// Before this migration, an issuer profile could only ever have one
// issuer-key row (oneToOne relation), implicitly "the" active one. Now
// that the relation is manyToOne and rows carry a status ('active' /
// 'retired'), any pre-existing row needs to be backfilled to 'active' --
// Strapi's schema sync adds the new column but does not backfill existing
// rows with the attribute's declared default.
module.exports = {
  async up(knex) {
    const hasTable = await knex.schema.hasTable('issuer_keys');
    if (!hasTable) {
      console.log('issuer_keys table does not exist yet - skipping (fresh install)');
      return;
    }

    const hasColumn = await knex.schema.hasColumn('issuer_keys', 'status');
    if (!hasColumn) {
      console.log('status column does not exist on issuer_keys yet - skipping (schema not synced yet)');
      return;
    }

    const updated = await knex('issuer_keys').whereNull('status').update({ status: 'active' });
    console.log(`backfilled status='active' on ${updated} pre-existing issuer_keys row(s)`);
  },

  async down(knex) {
    // Not reversible in a meaningful way (we don't know which rows this
    // migration touched vs. rows that were created as 'active' normally
    // afterwards) -- intentionally a no-op.
  },
};
