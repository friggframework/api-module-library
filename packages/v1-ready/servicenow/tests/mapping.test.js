const { ticketMapping } = require('../mappings/ticket');
const { companyMapping } = require('../mappings/company');
const { extensions } = require('../index');
const { Definition } = require('../definition');

describe('ServiceNow Ticket canonical mapping (ADR-057)', () => {
    it('targets support@1 and is labeled UNVALIDATED', () => {
        expect(ticketMapping.schema).toBe('support@1');
        expect(ticketMapping.validation).toBe('UNVALIDATED');
    });

    it('maps incident fields onto Merge Ticketing Ticket names', () => {
        const mapping = ticketMapping.objects.incident[0];
        expect(mapping.to).toBe('Ticket');
        expect(mapping.fields.sys_id).toBe('remote_id');
        expect(mapping.fields.short_description).toBe('name');
        expect(mapping.fields.description).toBe('description');
        expect(mapping.fields.caller_id).toBe('contact');
        expect(mapping.fields.company).toBe('account');
        expect(mapping.fields.state.to).toBe('status');
        expect(mapping.fields.priority.to).toBe('priority');
    });

    it('maps CSM case onto Ticket as well', () => {
        const mapping = ticketMapping.objects.case[0];
        expect(mapping.to).toBe('Ticket');
        expect(mapping.fields.sys_id).toBe('remote_id');
        expect(mapping.fields.short_description).toBe('name');
    });

    it('is exposed via extensions.mapping and Definition.mappings', () => {
        expect(extensions.mapping.schemas.support).toBe(ticketMapping);
        expect(Definition.mappings.support).toBe('extensions.mapping');
        expect(
            extensions.mapping.transforms.servicenowIncidentStateToMerge(2)
        ).toBe('IN_PROGRESS');
        expect(
            extensions.mapping.transforms.servicenowIncidentStateToMerge(
                'On Hold'
            )
        ).toBe('ON_HOLD');
        expect(
            extensions.mapping.transforms.servicenowPriorityToMerge(1)
        ).toBe('URGENT');
        expect(
            extensions.mapping.transforms.servicenowRefToSingletonArray({
                value: 'abc',
            })
        ).toEqual(['abc']);
    });
});

describe('ServiceNow Company canonical mapping (ADR-057)', () => {
    it('targets business@1 and is labeled UNVALIDATED', () => {
        expect(companyMapping.schema).toBe('business@1');
        expect(companyMapping.validation).toBe('UNVALIDATED');
    });

    it('maps core_company and customer_account onto Company', () => {
        expect(companyMapping.objects.company[0].to).toBe('Company');
        expect(companyMapping.objects.company[0].fields.sys_id).toBe(
            'remote_id'
        );
        expect(companyMapping.objects.company[0].fields.name).toBe('name');
        expect(companyMapping.objects.customer_account[0].to).toBe('Company');
    });

    it('is exposed via extensions.mapping', () => {
        expect(extensions.mapping.schemas.business).toBe(companyMapping);
        expect(Definition.mappings.business).toBe('extensions.mapping');
    });
});
