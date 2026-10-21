const companyMapping = require('../mappings/company');
const contactMapping = require('../mappings/contact');
const dealMapping = require('../mappings/deal');
const { extensions } = require('../index');

describe('monday business@1 mappings (UNVALIDATED)', () => {
    it('company/contact/deal mappings declare business@1 + UNVALIDATED', () => {
        for (const m of [companyMapping, contactMapping, dealMapping]) {
            expect(m.schema).toBe('business@1');
            expect(m.validation).toBe('UNVALIDATED');
            expect(Array.isArray(m.objects.item)).toBe(true);
            expect(m.objects.item.length).toBeGreaterThan(0);
        }
    });

    it('deal mapping includes Apideck-style lossReason / wonReason conditionals', () => {
        const targets = dealMapping.objects.item.flatMap((rule) =>
            Object.values(rule.fields || {})
        );
        expect(targets).toEqual(
            expect.arrayContaining(['lossReason', 'lossReasonId', 'wonReason', 'wonReasonId'])
        );
    });

    it('index merges item mapping rules without clobbering', () => {
        const itemRules = extensions.mapping.schemas.business.objects.item;
        expect(itemRules.length).toBe(
            companyMapping.objects.item.length +
                contactMapping.objects.item.length +
                dealMapping.objects.item.length
        );
        expect(extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        const tos = itemRules.map((r) => r.to);
        expect(tos).toEqual(
            expect.arrayContaining(['Company', 'Contact', 'Deal'])
        );
    });
});
