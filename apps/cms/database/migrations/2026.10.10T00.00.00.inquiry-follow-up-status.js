'use strict';

module.exports = {
  async up(knex) {
    if (!await knex.schema.hasTable('inquiries')) return;
    const original = await knex.schema.hasColumn('inquiries', 'status');
    const renamed = await knex.schema.hasColumn('inquiries', 'follow_up_status');
    if (original && renamed) {
      throw new Error('Inquiry migration found both status columns; reconcile them before restarting.');
    }
    if (original) {
      await knex.schema.alterTable('inquiries', table => table.renameColumn('status', 'follow_up_status'));
    }
  },
  async down() {
    throw new Error('Restore the database backup and prior CMS version together to roll back this migration.');
  }
};
