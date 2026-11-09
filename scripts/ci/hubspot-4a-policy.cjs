/**
 * HubSpot Binding C item 4a policy constants.
 *
 * Built to erratum rev2 (sha256
 * 53d5f7b9bc07fe94e0a3d100467635916481b47ca928fddfc9a12e6ebd361085).
 *
 * Freshness: recorded traffic must satisfy age <= FRESHNESS_MAX_AGE_DAYS
 * (90, Architect-pinned, adopted) AND the provider API-version pin.
 * Synthetic fixtures are not on the 90-day clock; they still require the
 * API-version pin.
 *
 * Token / refresh / Bearer request shapes follow this module on `next`
 * (POST /oauth/2026-03/token, not the main@d50c6a9d /oauth/v1/token table
 * in the erratum). 42matters account.json access_token query shape is a
 * separate PR.
 */
'use strict';

const FRESHNESS_MAX_AGE_DAYS = 90;
const FRESHNESS_MAX_AGE_DAYS_STATUS = 'adopted';

const TOKEN_ENDPOINT = 'https://api.hubapi.com/oauth/2026-03/token';
const TOKEN_PATH = '/oauth/2026-03/token';
const INTROSPECT_PATH = '/oauth/2026-03/token/introspect';
const ME_PATH = '/integrations/v1/me';
const CONTACTS_PATH = '/crm/v3/objects/contacts';
const AUTHORIZE_PATH = '/oauth/authorize';

/**
 * Pinned provider hosts for fail-closed deny + spy (T-C4-8 / T-C4-12).
 * Exact hostnames from packages/v1-ready/hubspot/api.js (baseUrl, authorize
 * URI, tokenUri). Regional peers and api.hubspot.com are not in this
 * module's source and are not on the list.
 */
const DENIED_PROVIDER_HOSTS = Object.freeze([
    'api.hubapi.com',
    'app.hubspot.com',
]);

/**
 * Closed env list for this 4a job (T-C4-8 / P3-TOKEN-ENV-CLOSED-LIST).
 * "Present" includes a set-but-empty value. A prefix entry matches any
 * env key that begins with that prefix. GITHUB_TOKEN / GH_TOKEN are not
 * on this list. REDIRECT_URI is not a provider token and is not listed.
 *
 * Do not use a HUBSPOT_* name for CI plumbing (e.g. the receipt command).
 * Use AML_RECEIPT_COMMAND or a CLI --command argument instead.
 */
const TOKEN_ENV_PREFIXES = Object.freeze(['HUBSPOT_', 'MATTERS_']);
const TOKEN_ENV_NAMES = Object.freeze([
    'HUBSPOT_CLIENT_ID',
    'HUBSPOT_CLIENT_SECRET',
    'HUBSPOT_SCOPE',
    'HUBSPOT_TIMELINE_EVENT_TEMPLATE_ID',
    'MATTERS_ACCESS_TOKEN',
]);

const API_VERSION_PINS = Object.freeze([
    { providerApiVersion: '2026-03', contract: 'POST /oauth/2026-03/token', modulePin: 'api.js tokenUri / URLs.access_token' },
    { providerApiVersion: '2026-03', contract: 'POST /oauth/2026-03/token/introspect', modulePin: 'api.js URLs.tokenIntrospect' },
    { providerApiVersion: 'integrations/v1', contract: 'GET /integrations/v1/me', modulePin: 'api.js URLs.userDetails' },
    { providerApiVersion: 'crm/v3', contract: 'GET /crm/v3/objects/contacts', modulePin: 'api.js URLs.contacts' },
]);

const WORKFLOW_RECEIPT_COMMAND =
    'npx jest --config jest.receipt.config.js --ci --watchman=false --forceExit --json --outputFile=artifacts/jest-results.json';

function isForbiddenEnvKey(key) {
    if (TOKEN_ENV_NAMES.includes(key)) return true;
    const upper = String(key).toUpperCase();
    return TOKEN_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

function forbiddenEnvHits(env) {
    // Presence of the key is enough, including set-but-empty (rev2).
    return Object.keys(env).filter((key) => isForbiddenEnvKey(key));
}

function isDeniedProviderHost(host) {
    const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/:\d+$/, '');
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

function pinMatches(providerApiVersion, contract, pins = API_VERSION_PINS) {
    if (!providerApiVersion) return false;
    return pins.some((p) => {
        const versionOk = p.providerApiVersion === providerApiVersion;
        if (!contract) return versionOk;
        if (p.contract === contract) return versionOk;
        const pathPart = String(contract).replace(/^(GET|POST)\s+/, '');
        return versionOk && (p.contract.endsWith(pathPart) || String(p.contract).includes(pathPart));
    });
}

/**
 * T-C4-9 recorded-freshness evaluator.
 * Recorded traffic is accepted only when age <= 90 AND the API-version pin
 * matches. Synthetic fixtures skip the 90-day clock but still require the pin.
 *
 * Named failure reasons:
 *   stale-but-pinned
 *   fresh-but-unpinned
 *   missing-or-non-90-bound
 *   api-version-mismatch
 */
function evaluateFreshnessAndPin({
    classification,
    capturedAt,
    maxAgeDays,
    providerApiVersion,
    contract,
    pins = API_VERSION_PINS,
    now = new Date(),
} = {}) {
    const pinned = pinMatches(providerApiVersion, contract, pins);
    const versionPresent = Boolean(providerApiVersion);
    const pinListHasContract = !contract || pins.some((p) => {
        const pathPart = String(contract).replace(/^(GET|POST)\s+/, '');
        return p.contract === contract || p.contract.endsWith(pathPart) || String(p.contract).includes(pathPart);
    });

    if (classification === 'synthetic') {
        if (!versionPresent || (pinListHasContract && !pinned) || !pinned) {
            return { ok: false, reason: 'api-version-mismatch', clockApplied: false };
        }
        return { ok: true, reason: null, clockApplied: false };
    }

    const boundOk = isFreshnessBoundInPolicy(maxAgeDays);
    if (!boundOk) {
        return { ok: false, reason: 'missing-or-non-90-bound', clockApplied: true };
    }
    const stale = isStale(capturedAt, maxAgeDays, now);
    if (stale && pinned) {
        return { ok: false, reason: 'stale-but-pinned', clockApplied: true };
    }
    if (stale) {
        return { ok: false, reason: 'stale-but-pinned', clockApplied: true };
    }
    if (pinListHasContract && versionPresent && !pinned) {
        return { ok: false, reason: 'api-version-mismatch', clockApplied: true };
    }
    if (!pinned) {
        return { ok: false, reason: 'fresh-but-unpinned', clockApplied: true };
    }
    return { ok: true, reason: null, clockApplied: true };
}

/**
 * Outbound auth request shape. A faked transport may only supply the
 * response when this shape matches. Wrong shape must not get a 200.
 * Token exchange and refresh must not send an Authorization header
 * (HubSpot does not use getTokenFromCodeBasicAuthHeader).
 */
function tokenBody(raw) {
    if (raw == null) return {};
    if (typeof raw === 'string') return Object.fromEntries(new URLSearchParams(raw));
    if (typeof raw === 'object') return raw;
    return {};
}

function requestAuthorization(req) {
    const headers = (req && req.headers) || {};
    return headers.Authorization || headers.authorization || '';
}

function matchesTokenExchange(req) {
    const method = String(req.method || '').toUpperCase();
    const url = String(req.url || '');
    const body = tokenBody(req.body);
    if (method !== 'POST') return false;
    if (!(url === TOKEN_ENDPOINT || url.endsWith(TOKEN_PATH))) return false;
    if (requestAuthorization(req)) return false;
    if (body.grant_type !== 'authorization_code') return false;
    if (!body.client_id || !body.client_secret || !body.redirect_uri || !body.scope || !body.code) {
        return false;
    }
    return true;
}

function matchesTokenRefresh(req) {
    const method = String(req.method || '').toUpperCase();
    const url = String(req.url || '');
    const body = tokenBody(req.body);
    if (method !== 'POST') return false;
    if (!(url === TOKEN_ENDPOINT || url.endsWith(TOKEN_PATH))) return false;
    if (requestAuthorization(req)) return false;
    if (body.grant_type !== 'refresh_token') return false;
    if (!body.client_id || !body.client_secret || !body.redirect_uri || !body.refresh_token) {
        return false;
    }
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

/**
 * T-C4-12: deny and spy are distinct required mechanisms over the same
 * pinned host list. A 200 fake is not a deny. A silent deny is not a spy.
 */
function evaluateDenyAndSpy({ denyInstalled, spyInstalled, treatsAlways200AsDeny } = {}) {
    if (treatsAlways200AsDeny) {
        return { ok: false, reason: 'always-200-is-not-a-deny' };
    }
    if (!denyInstalled && !spyInstalled) {
        return { ok: false, reason: 'missing-deny-and-spy' };
    }
    if (!denyInstalled) {
        return { ok: false, reason: 'spy-only' };
    }
    if (!spyInstalled) {
        return { ok: false, reason: 'deny-only' };
    }
    return { ok: true, reason: null };
}

function parseRequestHostPath(req) {
    if (!req) return { method: 'GET', host: '', path: '/' };
    const method = String(req.method || (req.options && req.options.method) || 'GET').toUpperCase();
    let host = '';
    let pathName = '';
    if (typeof req.getHeader === 'function') {
        const h = req.getHeader('host');
        if (h) host = String(h);
    }
    host = host
        || req.host
        || req.hostname
        || (req.options && (req.options.hostname || req.options.host))
        || '';
    pathName = req.path
        || (req.options && (req.options.path || req.options.pathname))
        || '';
    const href = req.href || req.url;
    if ((!host || !pathName) && href) {
        try {
            const u = new URL(String(href));
            host = host || u.hostname;
            pathName = pathName || `${u.pathname}${u.search}`;
        } catch (_err) {
            // ignore unparseable href
        }
    }
    host = String(host).toLowerCase();
    if (host.includes(':') && !host.startsWith('[')) {
        const parts = host.split(':');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) host = parts[0];
    }
    if (!pathName) pathName = '/';
    return { method, host, path: pathName };
}

/**
 * Spy: records unmatched attempts to pinned hosts (method + host + path).
 * Distinct from deny (nock.disableNetConnect). Installed via nock.emitter
 * 'no match', which fires for requests that would otherwise go live.
 */
function createPinnedHostSpy(hosts = DENIED_PROVIDER_HOSTS) {
    const records = [];
    let onNoMatch = null;
    function install() {
        const nock = require('nock');
        onNoMatch = (req) => {
            const parsed = parseRequestHostPath(req);
            if (hosts.some((h) => h === parsed.host) || isDeniedProviderHost(parsed.host)) {
                records.push({
                    method: parsed.method,
                    host: parsed.host,
                    path: parsed.path,
                });
            }
        };
        nock.emitter.on('no match', onNoMatch);
        return this;
    }
    function uninstall() {
        if (!onNoMatch) return;
        const nock = require('nock');
        nock.emitter.removeListener('no match', onNoMatch);
        onNoMatch = null;
    }
    return {
        records,
        install,
        uninstall,
        mechanism: 'nock.emitter:no-match',
        kind: 'spy',
    };
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
    WORKFLOW_RECEIPT_COMMAND,
    isForbiddenEnvKey,
    forbiddenEnvHits,
    isDeniedProviderHost,
    isFreshnessBoundInPolicy,
    isStale,
    pinMatches,
    evaluateFreshnessAndPin,
    matchesTokenExchange,
    matchesTokenRefresh,
    matchesBearerAuthorization,
    matchesApiAuthHeader,
    tokenBody,
    requestAuthorization,
    evaluateDenyAndSpy,
    parseRequestHostPath,
    createPinnedHostSpy,
};
