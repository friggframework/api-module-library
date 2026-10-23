/**
 * Extract the PagerDuty account subdomain from a resource html_url
 * (e.g. https://acme.pagerduty.com/users/PXXX → "acme").
 *
 * @param {string} htmlUrl
 * @returns {string|null}
 */
function subdomainFromHtmlUrl(htmlUrl) {
    if (!htmlUrl || typeof htmlUrl !== 'string') return null;
    try {
        const host = new URL(htmlUrl).hostname;
        const match = host.match(/^([^.]+)\.pagerduty\.com$/i);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

/**
 * Extract a PagerDuty account subdomain from a V3 webhook payload.
 * Payloads do not include account_id; subdomain appears in resource html_url
 * values (e.g. https://acme.pagerduty.com/incidents/...).
 *
 * @param {Object} body
 * @returns {string|null}
 */
function subdomainFromWebhookBody(body) {
    if (!body || typeof body !== 'object') return null;
    const event = body.event || {};
    const candidates = [
        event.data?.html_url,
        event.agent?.html_url,
        event.data?.service?.html_url,
    ];
    for (const url of candidates) {
        const sub = subdomainFromHtmlUrl(url);
        if (sub) return sub;
    }
    return null;
}

/**
 * Find the Frigg integration that owns a PagerDuty account subdomain.
 *
 * Host must expose `getEntitiesForModule('pagerduty')` or
 * `findEntitiesByExternalId('pagerduty', subdomain)`.
 *
 * Matching prefers entity.details.subdomain, then identifiers.externalId
 * (when externalId was set to the subdomain / account_id).
 *
 * @param {Object} ctx - Extension runtime (`this` from the webhook handler)
 * @param {string} subdomain
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationBySubdomain(ctx, subdomain) {
    if (!subdomain) return null;

    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('pagerduty')
            : typeof ctx.findEntitiesByExternalId === 'function'
              ? await ctx.findEntitiesByExternalId(
                    'pagerduty',
                    String(subdomain)
                )
              : null;

    if (!entities) {
        throw new Error(
            'pagerduty-webhooks: host does not expose entity lookup helpers'
        );
    }

    const list = Array.isArray(entities) ? entities : [entities];
    const matches = list.filter((e) => {
        if (!e) return false;
        const detailsSub = e.details?.subdomain;
        const externalId =
            e.externalId || e.identifiers?.externalId || null;
        return (
            detailsSub === String(subdomain) ||
            externalId === String(subdomain)
        );
    });

    if (matches.length === 0) return null;
    if (matches.length > 1) {
        throw new Error(
            `pagerduty-webhooks: ambiguous subdomain=${subdomain} matched ${matches.length} entities`
        );
    }

    return (
        matches[0].integrationId ||
        matches[0].integration_id ||
        matches[0].id ||
        null
    );
}

module.exports = {
    findIntegrationBySubdomain,
    subdomainFromWebhookBody,
};
