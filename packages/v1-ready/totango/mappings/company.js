/**
 * Totango Account → canonical Company (business@1).
 *
 * Accounts are the primary customer object in Totango. Search returns
 * account-id as `name` and the human label as `display_name`.
 *
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Sources:
 *   https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        account: [
            {
                to: 'Company',
                identity: ['externalIds.totango', 'name'],
                fields: {
                    name: 'id',
                    display_name: 'name',
                    last_activity_time: 'lastActivityAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = companyMapping;
