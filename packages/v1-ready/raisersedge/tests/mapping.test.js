const companyMapping = require('../mappings/company');
const contactMapping = require('../mappings/contact');
const { extensions } = require('../index');

describe('ADR-057 mappings (UNVALIDATED)', () => {
    it('maps Individual constituents → Contact and Organization → Company', () => {
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.validation).toBe('UNVALIDATED');
        expect(contactMapping.objects.constituent[0].to).toBe('Contact');
        expect(contactMapping.objects.constituent[0].when).toEqual({
            type: 'Individual',
        });

        expect(companyMapping.schema).toBe('business@1');
        expect(companyMapping.validation).toBe('UNVALIDATED');
        expect(companyMapping.objects.constituent[0].to).toBe('Company');
        expect(companyMapping.objects.constituent[0].when).toEqual({
            type: 'Organization',
        });
    });

    it('exports merged business mappings via extensions.mapping', () => {
        const business = extensions.mapping.schemas.business;
        expect(business.schema).toBe('business@1');
        expect(business.validation).toBe('UNVALIDATED');
        expect(business.objects.constituent).toHaveLength(2);
    });

    it('does not invent Deal mappings for gifts', () => {
        const business = extensions.mapping.schemas.business;
        expect(business.objects.gift).toBeUndefined();
        expect(business.objects.deal).toBeUndefined();
    });
});
