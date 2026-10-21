const { ticketMapping } = require('../mappings/ticket');
const { extensions } = require('../index');
const { Definition } = require('../definition');

describe('Zendesk Ticket canonical mapping (ADR-057)', () => {
    it('targets support@1 and is labeled UNVALIDATED', () => {
        expect(ticketMapping.schema).toBe('support@1');
        expect(ticketMapping.validation).toBe('UNVALIDATED');
    });

    it('maps Zendesk ticket fields onto Merge Ticketing Ticket names', () => {
        const mapping = ticketMapping.objects.ticket[0];
        expect(mapping.to).toBe('Ticket');
        expect(mapping.fields.subject).toBe('name');
        expect(mapping.fields.description).toBe('description');
        expect(mapping.fields.id).toBe('remote_id');
        expect(mapping.fields.url).toBe('ticket_url');
        expect(mapping.fields.created_at).toBe('remote_created_at');
        expect(mapping.fields.updated_at).toBe('remote_updated_at');
        expect(mapping.fields.requester_id).toBe('contact');
        expect(mapping.fields.organization_id).toBe('account');
        expect(mapping.fields.status.to).toBe('status');
        expect(mapping.fields.priority.to).toBe('priority');
        expect(mapping.fields.type).toBe('ticket_type');
    });

    it('is exposed via extensions.mapping and Definition.mappings', () => {
        expect(extensions.mapping.schemas.support).toBe(ticketMapping);
        expect(Definition.mappings).toEqual({
            support: 'extensions.mapping',
        });
        expect(typeof extensions.mapping.transforms.zendeskStatusToMerge).toBe(
            'function'
        );
        expect(
            extensions.mapping.transforms.zendeskStatusToMerge('open')
        ).toBe('OPEN');
        expect(
            extensions.mapping.transforms.zendeskStatusToMerge('hold')
        ).toBe('ON_HOLD');
        expect(
            extensions.mapping.transforms.zendeskPriorityToMerge('urgent')
        ).toBe('URGENT');
        expect(
            extensions.mapping.transforms.zendeskIdToSingletonArray(42)
        ).toEqual(['42']);
    });
});
