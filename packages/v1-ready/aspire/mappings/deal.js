/**
 * Aspire Opportunity → canonical Deal (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft). Aspire Opportunities are the sales /
 * estimate pipeline objects (won/lost dates, probability, status) — the closest
 * fit to Deal. Vendor has GET + POST but no PUT update on /Opportunities.
 *
 * Sources:
 *   https://cloud-api.youraspire.com/swagger/v1/swagger.json
 *     (AspireCloud.Domain.Tenant.Opportunities.ODataModel.Opportunity)
 *   https://guide.youraspire.com/apidocs/opportunities-3.md
 */
const dealMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        opportunity: [
            {
                to: 'Deal',
                identity: ['externalIds.aspire', 'OpportunityID'],
                fields: {
                    // Fields taken from official OData Opportunity schema only.
                    OpportunityID: 'id',
                    OpportunityName: 'name',
                    OpportunityStatusName: 'status',
                    OpportunityStatusID: 'statusId',
                    Probability: 'probability',
                    AnticipatedCloseDate: 'closeDate',
                    WonDate: 'wonDate',
                    LostDate: 'lostDate',
                    SalesRepContactID: 'ownerId',
                    SalesRepContactName: 'ownerName',
                    PropertyID: 'propertyId',
                    CreatedDateTime: 'createdAt',
                },
                ops: ['read', 'create'],
            },
        ],
    },
};

module.exports = dealMapping;
