/**
 * HubSpot Binding C item 4a policy constants.
 *
 * Architect is still revising the item-4 erratum (rev1 gate REVISE:
 * P2-FRESHNESS-MAX-DAYS-UNBOUNDED, P2-TRANSPORT-REQUEST-SHAPE,
 * P3-EGRESS-HOST-LIST, P3-TOKEN-ENV-CLOSED-LIST). Values marked
 * PENDING_ARCHITECT are parameterized placeholders, not an adopted pin.
 */
'use strict';

// PENDING_ARCHITECT: concrete max-age-days placeholder. Not Sean-held
// and not adopted. The API-version pin is a MUST in addition to this
// bound (not an OR that lets a huge max-days skip the pin).
const FRESHNESS_MAX_AGE_DAYS = 90;
const FRESHNESS_MAX_AGE_DAYS_STATUS = 'pending-architect';

const TOKEN_ENDPOINT = 'https://api.hubapi.com/oauth/2026-03/token';
const TOKEN_PATH = '/oauth/2026-03/token';
const INTROSPECT_PATH = '/oauth/2026-03/token/introspect';
const ME_PATH = '/integrations/v1/me';
const CONTACTS_PATH = '/crm/v3/objects/contacts';
const AUTHORIZE_PATH = '/oauth/authorize';

/**
 * Pinned provider hosts for fail-closed network-deny (T-C4-8 / P3-EGRESS-HOST-LIST).
 * Verified from packages/v1-ready/hubspot/api.js and official HubSpot docs
 * retrieved 2026-11-09.
 */
const DENIED_PROVIDER_HOSTS = Object.freeze([
    'api.hubapi.com', // api.js baseUrl + tokenUri
    'app.hubspot.com', // api.js authorizationUri (OAuth redirect)
    'api.hubspot.com', // official 2026-03 OAuth and CRM docs also use this host
]);

/**
 * Closed env list for this 4a job (T-C4-8 / P3-TOKEN-ENV-CLOSED-LIST).
 * Prefixes catch any other name under the same vendor prefix.
 * Presence of any listed name or prefix, if non-empty, fails closed.
 * GITHUB_TOKEN / GH_TOKEN are not on this list.
 */
const TOKEN_ENV_PREFIXES = Object.freeze(['HUBSPOT_', 'MATTERS_']);
const TOKEN_ENV_NAMES = Object.freeze([
    'HUBSPOT_ACCESS_TOKEN',
    'HUBSPOT_REFRESH_TOKEN',
    'HUBSPOT_CLIENT_ID',
    'HUBSPOT_CLIENT_SECRET',
    'HUBSPOT_SCOPE',
    'HUBSPOT_LIVE_API',
    'HUBSPOT_WEBHOOK_BASE_URL',
    'MATTERS_ACCESS_TOKEN',
    'MATTERS_API_KEY',
]);

const API_VERSION_PINS = Object.freeze([
    { providerApiVersion: '2026-03', contract: 'POST /oauth/2026-03/token', modulePin: 'api.js tokenUri / URLs.access_token' },
    { providerApiVersion: '2026-03', contract: 'POST /oauth/2026-03/token/introspect', modulePin: 'api.js URLs.tokenIntrospect' },
    { providerApiVersion: 'integrations/v1', contract: 'GET /integrations/v1/me', modulePin: 'api.js URLs.userDetails' },
    { providerApiVersion: 'crm/v3', contract: 'GET /crm/v3/objects/contacts', modulePin: 'api.js URLs.contacts' },
]);

function isForbiddenEnvKey(key) {
    if (TOKEN_ENV_NAMES.includes(key)) return true;
    const upper = String(key).toUpperCase();
    return TOKEN_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

function forbiddenEnvHits(env) {
    return Object.keys(env).filter((key) => {
        if (!isForbiddenEnvKey(key)) return false;
        return String(env[key] || '').trim() !== '';
    });
}

function isDeniedProviderHost(host) {
    const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
    return DENIED_PROVIDER_HOSTS.includes(h);
}

function isFreshnessBoundInPolicy(maxAgeDays) {
    return maxAgeDays === FRESHNESS_MAX_AGE_DAYS;
}

function isStale(isoTimestamp, maxAgeDays = FRESHNESS_MAX_AGE_DAYS, now = new Date()) {
    if (maxAgeDays == null) return true; // missing bound fails (T-C4-9)
    const captured = new Date(isoTimestamp);
    if (Number.isNaN(captured.getTime())) return true;
    return now.getTime() - captured.getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
}

/**
 * Outbound auth request shape. A faked transport may only supply the
 * response when this shape matches. Wrong shape must not get a 200.
 */
function tokenBody(raw) {
    if (raw == null) return {};
    if (typeof raw === 'string') return Object.fromEntries(new URLSearchParams(raw));
    if (typeof raw === 'object') return raw;
    return {};
}

function matchesTokenExchange(req) {
    const method = String(req.method || '').toUpperCase();
    const url = String(req.url || '');
    const body = tokenBody(req.body);
    if (method !== 'POST') return false;
    if (!(url === TOKEN_ENDPOINT || url.endsWith(TOKEN_PATH))) return false;
    if (body.grant_type !== 'authorization_code') return false;
    if (!body.client_id) return false;
    if (!body.code) return false;
    return true;
}

function matchesTokenRefresh(req) {
    const method = String(req.method || '').toUpperCase();
    const url = String(req.url || '');
    const body = tokenBody(req.body);
    if (method !== 'POST') return false;
    if (!(url === TOKEN_ENDPOINT || url.endsWith(TOKEN_PATH))) return false;
    if (body.grant_type !== 'refresh_token') return false;
    if (!body.client_id) return false;
    if (!body.refresh_token) return false;
    return true;
}

function matchesBearerAuthorization(header) {
    return /^Bearer\s+\S+$/.test(String(header || ''));
}

function matchesApiAuthHeader(req) {
    const headers = req.headers || {};
    const auth = headers.Authorization || headers.authorization;
    return matchesBearerAuthorization(auth);
}

module.exports = {
    FRESHNESS_MAX_AGE_DAYS,
    FRESHNESS_MAX_AGE_DAYS_STATUS,
    TOKEN_ENDPOINT,
    TOKEN_PATH,
    INTROSPECT_PATH,
    ME_PATH,
    CONTACTS_PATH,
    AUTHORIZE_PATH,
    DENIED_PROVIDER_HOSTS,
    TOKEN_ENV_PREFIXES,
    TOKEN_ENV_NAMES,
    API_VERSION_PINS,
    isForbiddenEnvKey,
    forbiddenEnvHits,
    isDeniedProviderHost,
    isFreshnessBoundInPolicy,
    isStale,
    matchesTokenExchange,
    matchesTokenRefresh,
    matchesBearerAuthorization,
    matchesApiAuthHeader,
    tokenBody,
};
