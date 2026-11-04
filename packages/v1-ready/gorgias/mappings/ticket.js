/**
 * Canonical mapping: Gorgias Ticket → support@1 (Merge Ticketing field names).
 *
 * Labeled UNVALIDATED — field alignment is best-effort from Gorgias official
 * Ticket object docs + Merge Ticketing Ticket common model. Not runtime-tested
 * against a live support@1 schema package.
 *
 * Sources:
 * - https://developers.gorgias.com/reference/list-tickets (Ticket object)
 * - https://docs.merge.dev/ticketing/tickets/ (Merge Ticket)
 * - ADR-057: docs/architecture-decisions/057-canonical-schema.md (frigg)
 */

const supportMapping = {
    schema: 'support@1',
    label: 'UNVALIDATED',
    objects: {
        ticket: [
            {
                to: 'Ticket',
                identity: ['remote_id'],
                ops: ['read', 'create', 'update'],
                fields: {
                    // Gorgias field → Merge Ticketing / support@1 field
                    id: 'remote_id',
                    subject: 'name',
                    excerpt: 'description',
                    status: 'status',
                    priority: 'priority',
                    'assignee_user.id': 'assignees',
                    'customer.id': 'contact',
                    created_datetime: 'remote_created_at',
                    updated_datetime: 'remote_updated_at',
                    uri: 'ticket_url',
                    tags: 'tags',
                },
            },
        ],
    },
};

module.exports = { supportMapping };
