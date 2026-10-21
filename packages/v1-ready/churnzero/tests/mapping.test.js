const { companyMapping } = require('../mappings/company');
const { contactMapping } = require('../mappings/contact');
const { accountHealthMapping } = require('../mappings/account-health');
const { extensions, Definition } = require('../index');
const capabilities = require('../churnzero.capabilities.json');
const { Api } = require('../api');

describe('ChurnZero canonical mappings (ADR-057)', () => {
    it('company + contact target business@1 and are UNVALIDATED', () => {
        expect(companyMapping.schema).toBe('business@1');
        expect(companyMapping.validation).toBe('UNVALIDATED');
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.validation).toBe('UNVALIDATED');
    });

    it('account-health is sameAs-only AccountHealth (ours) and UNVALIDATED', () => {
        expect(accountHealthMapping.schema).toBe('accountHealth@1');
        expect(accountHealthMapping.validation).toBe('UNVALIDATED');
        expect(accountHealthMapping.objects.AccountHealth.sameAs).toBe(
            'https://friggframework.org/canonical/AccountHealth'
        );
        expect(accountHealthMapping.objects.account[0].to).toBe(
            'AccountHealth'
        );
        expect(accountHealthMapping.objects.account[0].fields).toBeUndefined();
        expect(
            accountHealthMapping.objects.churnScoreCalculation[0].sameAs
        ).toBe('https://friggframework.org/canonical/AccountHealth');
    });

    it('maps Account/Contact onto Merge CRM-aligned names', () => {
        expect(companyMapping.objects.account[0].to).toBe('Company');
        expect(companyMapping.objects.account[0].fields.Name).toBe('name');
        expect(contactMapping.objects.contact[0].to).toBe('Contact');
        expect(contactMapping.objects.contact[0].fields.Email).toBe('email');
    });

    it('is exposed via extensions.mapping and Definition.mappings', () => {
        expect(extensions.mapping.schemas.business.schema).toBe('business@1');
        expect(extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.accountHealth.schema).toBe(
            'accountHealth@1'
        );
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
            accountHealth: 'extensions.mapping',
        });
    });
});

describe('ChurnZero capability manifest', () => {
    it('is capability-manifest/v0.1 for this package', () => {
        expect(capabilities.$schema).toBe('capability-manifest/v0.1');
        expect(capabilities.module).toBe('churnzero');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-churnzero'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth.type).toBe('basic');
    });

    it('every capability method exists on Api', () => {
        const methods = Object.getOwnPropertyNames(Api.prototype);
        for (const [name, cap] of Object.entries(capabilities.capabilities)) {
            expect(methods).toContain(cap.method);
            expect(typeof Api.prototype[cap.method]).toBe('function');
            // silence unused in some jest configs
            expect(name).toBeTruthy();
        }
    });

    it('object field entries carry tags arrays', () => {
        for (const obj of Object.values(capabilities.objects)) {
            for (const field of obj.fields) {
                expect(Array.isArray(field.tags)).toBe(true);
                expect(field.tags.length).toBeGreaterThan(0);
            }
        }
    });
});
