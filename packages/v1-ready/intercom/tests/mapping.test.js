const { conversationMapping } = require('../mappings/conversation');
const { ticketMapping } = require('../mappings/ticket');
const { contactMapping } = require('../mappings/contact');
const { companyMapping } = require('../mappings/company');
const { extensions, Definition } = require('../index');

describe('Intercom canonical mappings (ADR-057)', () => {
    it('conversation + ticket target support@1 and are UNVALIDATED', () => {
        expect(conversationMapping.schema).toBe('support@1');
        expect(conversationMapping.validation).toBe('UNVALIDATED');
        expect(ticketMapping.schema).toBe('support@1');
        expect(ticketMapping.validation).toBe('UNVALIDATED');
    });

    it('contact + company target business@1 and are UNVALIDATED', () => {
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.validation).toBe('UNVALIDATED');
        expect(companyMapping.schema).toBe('business@1');
        expect(companyMapping.validation).toBe('UNVALIDATED');
    });

    it('maps conversation fields onto Merge Ticketing Ticket names', () => {
        const mapping = conversationMapping.objects.conversation[0];
        expect(mapping.to).toBe('Ticket');
        expect(mapping.fields.id).toBe('remote_id');
        expect(mapping.fields.title).toBe('name');
        expect(mapping.fields.state.to).toBe('status');
        expect(mapping.fields.priority.to).toBe('priority');
    });

    it('maps ticket fields onto Merge Ticketing Ticket names', () => {
        const mapping = ticketMapping.objects.ticket[0];
        expect(mapping.to).toBe('Ticket');
        expect(mapping.fields.id).toBe('remote_id');
        expect(mapping.fields['ticket_attributes._default_title_']).toBe(
            'name'
        );
        expect(mapping.fields.ticket_state.to).toBe('status');
    });

    it('maps contact/company onto Merge CRM names', () => {
        expect(contactMapping.objects.contact[0].to).toBe('Contact');
        expect(contactMapping.objects.contact[0].fields.email).toBe('email');
        expect(companyMapping.objects.company[0].to).toBe('Company');
        expect(companyMapping.objects.company[0].fields.name).toBe('name');
        expect(companyMapping.objects.company[0].fields.website).toBe(
            'website'
        );
    });

    it('is exposed via extensions.mapping and Definition.mappings', () => {
        expect(extensions.mapping.schemas.support.schema).toBe('support@1');
        expect(extensions.mapping.schemas.support.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.business.schema).toBe('business@1');
        expect(Definition.mappings).toEqual({
            support: 'extensions.mapping',
            business: 'extensions.mapping',
        });
        expect(
            extensions.mapping.transforms.intercomConversationStateToMerge(
                'open'
            )
        ).toBe('OPEN');
        expect(
            extensions.mapping.transforms.intercomConversationStateToMerge(
                'snoozed'
            )
        ).toBe('ON_HOLD');
        expect(
            extensions.mapping.transforms.intercomTicketStateToMerge({
                category: 'resolved',
            })
        ).toBe('CLOSED');
        expect(
            extensions.mapping.transforms.intercomIdToSingletonArray(42)
        ).toEqual(['42']);
        expect(
            extensions.mapping.transforms.intercomContactsToPrimaryId({
                contacts: [{ id: 'c1' }],
            })
        ).toBe('c1');
        expect(
            extensions.mapping.transforms.intercomUnixToIso(1700000000)
        ).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it('exports the hubspot-style webhooks extension', () => {
        expect(extensions.webhooks.name).toBe('intercom-webhooks');
        expect(extensions.webhooks.useDatabase).toBe(false);
    });
});
