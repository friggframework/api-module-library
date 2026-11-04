const path = require('path');
const index = require('..');
const { contactMapping } = require('../mappings/contact');
const { companyMapping } = require('../mappings/company');
const { accountHealthMapping } = require('../mappings/account-health');

describe('ADR-057 mappings', () => {
    it('exports extensions.mapping with business + AccountHealth schemas', () => {
        expect(index.extensions.mapping.schemas.business.schema).toBe(
            'business@1'
        );
        expect(index.extensions.mapping.schemas.business.status).toBe(
            'UNVALIDATED'
        );
        expect(index.extensions.mapping.schemas.AccountHealth.schema).toBe(
            'AccountHealth@1'
        );
        expect(index.extensions.mapping.schemas.AccountHealth.status).toBe(
            'UNVALIDATED'
        );
    });

    it('maps Vitally user → Contact and account → Company', () => {
        expect(contactMapping.objects.user[0].to).toBe('Contact');
        expect(companyMapping.objects.account[0].to).toBe('Company');
    });

    it('defines AccountHealth as sameAs-only to a Frigg-owned URI', () => {
        const frag = accountHealthMapping.objects.account[0];
        expect(frag.to).toBe('AccountHealth');
        expect(frag.sameAs).toBe(
            'https://friggframework.org/canonical/AccountHealth'
        );
        expect(frag.sameAs).not.toMatch(/schema\.org/);
    });

    it('labels mapping source files UNVALIDATED', () => {
        const indexSrc = require('fs').readFileSync(
            path.join(__dirname, '..', 'index.js'),
            'utf8'
        );
        expect(indexSrc).toMatch(/status:\s*'UNVALIDATED'/);
        expect(contactMapping.status).toBe('UNVALIDATED');
        expect(companyMapping.status).toBe('UNVALIDATED');
        expect(accountHealthMapping.status).toBe('UNVALIDATED');
    });
});
