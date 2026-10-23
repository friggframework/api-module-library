/**
 * Resolve a BambooHR company domain (or numeric companyId) to a Frigg
 * integration mapping.
 *
 * Ambiguous resolution must throw rather than risk cross-tenant routing —
 * same rule as HubSpot's portal lookup / Xero's tenant lookup.
 *
 * @param {object} deps
 * @param {Function} deps.findIntegrationsByExternalEntityId
 * @param {string} companyKey - companyDomain subdomain or companyId string.
 * @returns {Promise<object>} A single integration mapping.
 */
async function resolveIntegrationForCompany(
    { findIntegrationsByExternalEntityId },
    companyKey
) {
    if (!companyKey) {
        throw new Error('BambooHR webhook: missing companyDomain/companyId');
    }
    const matches = await findIntegrationsByExternalEntityId(String(companyKey));
    const list = Array.isArray(matches) ? matches : [];
    if (list.length === 0) {
        throw new Error(
            `BambooHR webhook: no integration mapping for company ${companyKey}`
        );
    }
    if (list.length > 1) {
        throw new Error(
            `BambooHR webhook: ambiguous integration mapping for company ${companyKey} (${list.length} matches)`
        );
    }
    return list[0];
}

/**
 * Pull a company resolve key from a BambooHR webhook body.
 * Prefer `companyDomain` (includeCompanyDomain / form payloads), then
 * event-style `data.companyId`.
 *
 * @param {object} body
 * @returns {string|null}
 */
function extractCompanyKey(body) {
    if (!body || typeof body !== 'object') return null;
    if (body.companyDomain) return String(body.companyDomain);
    if (body.data && body.data.companyId) return String(body.data.companyId);
    if (body.companyId) return String(body.companyId);
    return null;
}

module.exports = {
    resolveIntegrationForCompany,
    extractCompanyKey,
};
