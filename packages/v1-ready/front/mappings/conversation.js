/**
 * Front conversations → canonical Ticket / Conversation (ADR-057).
 *
 * Schema `support@1` is referenced ahead of the Canonical Schema registry;
 * this mapping is labeled UNVALIDATED until that package exists and Test Bench
 * can check field coverage.
 *
 * Field names come from Front's official ConversationResponse
 * (https://github.com/frontapp/front-api-specs/blob/main/core-api/core-api.json).
 *
 * @see https://github.com/friggframework/frigg/blob/next/docs/architecture-decisions/057-canonical-schema.md
 */

const conversationMapping = {
    schema: 'support@1',
    validation: 'UNVALIDATED',
    objects: {
        conversation: [
            {
                to: 'Ticket',
                identity: ['externalIds.front', 'id'],
                fields: {
                    id: 'id',
                    subject: 'subject',
                    status: 'status',
                    status_category: 'statusCategory',
                    'assignee.id': 'assigneeId',
                    'assignee.email': 'assigneeEmail',
                    'recipient.handle': 'requesterHandle',
                    'recipient.name': 'requesterName',
                    is_private: 'isPrivate',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                    ticket_ids: 'ticketIds',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                // Front's native name for the same object — dual map so
                // consumers can bind either Ticket or Conversation.
                to: 'Conversation',
                identity: ['externalIds.front', 'id'],
                fields: {
                    id: 'id',
                    subject: 'subject',
                    status: 'status',
                    status_category: 'statusCategory',
                    'assignee.id': 'assigneeId',
                    'assignee.email': 'assigneeEmail',
                    'recipient.handle': 'requesterHandle',
                    'recipient.name': 'requesterName',
                    is_private: 'isPrivate',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { conversationMapping };
