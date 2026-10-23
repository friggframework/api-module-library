/**
 * Gainsight Company → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Sources:
 *   https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Company_and_Relationship_API/Company_API_Documentation
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'Company',
                identity: ['externalIds.gainsight', 'Gsid'],
                fields: {
                    Gsid: 'id',
                    Name: 'name',
                    Industry: 'industry',
                    ARR: 'arr',
                    Employees: 'employeeCount',
                    Stage: 'stage',
                    Status: 'status',
                    RenewalDate: 'renewalDate',
                    OriginalContractDate: 'contractStartDate',
                    ParentCompany: 'parentCompanyId',
                    CSM: 'ownerId',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = companyMapping;
