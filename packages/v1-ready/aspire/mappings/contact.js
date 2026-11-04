/**
 * Aspire Contact → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://cloud-api.youraspire.com/swagger/v1/swagger.json
 *     (AspireCloud.Domain.Tenant.Contacts.ODataModel.Contact)
 *   https://guide.youraspire.com/apidocs/contacts-12
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        contact: [
            {
                to: 'Contact',
                identity: ['externalIds.aspire', 'ContactID'],
                fields: {
                    ContactID: 'id',
                    CompanyID: {
                        to: 'companyId',
                        ref: 'business.Company',
                    },
                    FirstName: 'firstName',
                    LastName: 'lastName',
                    Title: 'title',
                    Email: 'email',
                    MobilePhone: 'mobilePhone',
                    OfficePhone: 'phone',
                    Website: 'website',
                    Active: 'active',
                    CreatedDateTime: 'createdAt',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = contactMapping;
