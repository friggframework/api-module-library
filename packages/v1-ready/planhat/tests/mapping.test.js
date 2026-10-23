const { companyMapping } = require('../mappings/company');
const { contactMapping } = require('../mappings/contact');
const { accountHealthMapping } = require('../mappings/account-health');
const pkg = require('../index');

describe('Planhat ADR-057 mappings', () => {
    it('company maps to business@1 Company', () => {
        expect(companyMapping.schema).toBe('business@1');
        expect(companyMapping.validation).toBe('UNVALIDATED');
        expect(companyMapping.objects.company[0].to).toBe('Company');
        expect(companyMapping.objects.company[0].fields.name).toBe('name');
        expect(companyMapping.objects.company[0].fields._id).toBe('remote_id');
    });

    it('enduser maps to business@1 Contact', () => {
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.validation).toBe('UNVALIDATED');
        expect(contactMapping.objects.enduser[0].to).toBe('Contact');
        expect(contactMapping.objects.enduser[0].fields.email).toBe('email');
    });

    it('account-health is sameAs-only AccountHealth on accountHealth@1', () => {
        expect(accountHealthMapping.schema).toBe('accountHealth@1');
        expect(accountHealthMapping.validation).toBe('UNVALIDATED');
        const m = accountHealthMapping.objects.company[0];
        expect(m.to).toBe('AccountHealth');
        expect(m.sameAs).toBe(
            'https://friggframework.org/canonical/AccountHealth'
        );
        expect(m.fields.h).toBe('score');
        expect(m.ops).toEqual(['read']);
    });

    it('package index merges mappings under extensions.mapping', () => {
        const { schemas } = pkg.extensions.mapping;
        expect(schemas.business.objects.company).toBeDefined();
        expect(schemas.business.objects.enduser).toBeDefined();
        expect(schemas.accountHealth.objects.company).toBeDefined();
    });
});
