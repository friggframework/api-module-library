const companyMapping = require('../mappings/company');
const contactMapping = require('../mappings/contact');
const accountHealthMapping = require('../mappings/account-health');
const { extensions } = require('../index');

describe('Gainsight ADR-057 mappings', () => {
    it('company maps to business@1 Company and is UNVALIDATED', () => {
        expect(companyMapping.schema).toBe('business@1');
        expect(companyMapping.validation).toBe('UNVALIDATED');
        expect(companyMapping.objects.company[0].to).toBe('Company');
    });

    it('contact maps Person to business@1 Contact and is UNVALIDATED', () => {
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.validation).toBe('UNVALIDATED');
        expect(contactMapping.objects.person[0].to).toBe('Contact');
    });

    it('account-health is sameAs-only onto our AccountHealth model', () => {
        expect(accountHealthMapping.schema).toBe('AccountHealth@1');
        expect(accountHealthMapping.validation).toBe('UNVALIDATED');
        const entry = accountHealthMapping.objects.scorecardObject[0];
        expect(entry.to).toBe('AccountHealth');
        expect(entry.sameAs).toBe(
            'https://friggframework.org/canonical/AccountHealth'
        );
        expect(entry.fields).toEqual({});
    });

    it('exposes mappings via extensions.mapping', () => {
        expect(extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.AccountHealth.sameAs ||
            extensions.mapping.schemas.AccountHealth.objects.scorecardObject[0]
                .sameAs).toBe(
            'https://friggframework.org/canonical/AccountHealth'
        );
    });
});
