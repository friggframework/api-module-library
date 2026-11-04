const { contactMapping } = require('../mappings/contact');
const pkg = require('../index');

describe('ADR-057 mappings', () => {
    it('maps Instantly lead → business@1 Contact as UNVALIDATED', () => {
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.status).toBe('UNVALIDATED');
        expect(contactMapping.objects.lead[0].to).toBe('Contact');
        expect(contactMapping.objects.lead[0].fields.email).toBe('email');
        expect(contactMapping.objects.lead[0].fields.first_name).toBe(
            'firstName'
        );
    });

    it('exposes mappings via extensions.mapping on the package export', () => {
        expect(pkg.extensions.mapping.schemas.business.status).toBe(
            'UNVALIDATED'
        );
        expect(
            pkg.extensions.mapping.schemas.business.objects.lead[0].to
        ).toBe('Contact');
    });

    it('does not invent Company or Deal mappings', () => {
        const objects = pkg.extensions.mapping.schemas.business.objects;
        expect(objects.campaign).toBeUndefined();
        expect(objects.account).toBeUndefined();
        expect(objects.company).toBeUndefined();
    });
});
