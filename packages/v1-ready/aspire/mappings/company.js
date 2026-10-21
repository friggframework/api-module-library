/**
 * Aspire Company → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Sources:
 *   https://cloud-api.youraspire.com/swagger/v1/swagger.json
 *     (AspireCloud.Domain.Tenant.Companies.ODataModel.Company)
 *   https://guide.youraspire.com/apidocs/companies-12
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'Company',
                identity: ['externalIds.aspire', 'CompanyID'],
                fields: {
                    CompanyID: 'id',
                    CompanyName: 'name',
                    Active: 'active',
                    DeniedTimeEmail: 'email',
                    CreatedDateTime: 'createdAt',
                    ModifiedDateTime: 'updatedAt',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = companyMapping;
