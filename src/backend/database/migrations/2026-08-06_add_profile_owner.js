'use strict';

module.exports = {
  async up(knex) {
    // On a fresh install the `profiles` table doesn't exist yet at this
    // point in the boot sequence -- Strapi creates it afterwards, already
    // including `owner_id`, since the profile content-type's schema
    // declares that relation. There's nothing to migrate for a brand new
    // database; only pre-existing installations (from before `owner_id`
    // was added to the schema) need this migration to run.
    const hasTable = await knex.schema.hasTable('profiles');
    if (!hasTable) {
      console.log('profiles table does not exist yet - skipping (fresh install)');
      return;
    }

    // Check if column already exists to support idempotent runs
    const hasColumn = await knex.schema.hasColumn('profiles', 'owner_id');
    if (hasColumn) {
      console.log('owner_id column already exists on profiles table');
      return;
    }

    return knex.schema.table('profiles', (table) => {
      // Add owner_id as a nullable foreign key (nullable for backward compat with existing profiles)
      table.integer('owner_id').nullable().unsigned();

      // Add the foreign key constraint
      table.foreign('owner_id').references('id').inTable('up_users').onDelete('SET NULL');

      // Add index for performance on lookups by owner
      table.index('owner_id');
    });
  },

  async down(knex) {
    // Drop the foreign key and column on rollback
    return knex.schema.table('profiles', (table) => {
      table.dropForeign('owner_id');
      table.dropColumn('owner_id');
    });
  },
};
