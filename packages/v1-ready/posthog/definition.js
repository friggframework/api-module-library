require('dotenv').config();
const crypto = require('crypto');
const { Api, normalizePostHogHost } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * PostHog is personal-API-key authenticated (Bearer). Identity comes from
 * GET /api/users/@me/ (uuid + email). When that call fails we fall back to a
 * sha256 fingerprint of the API key — stable, non-reversible, per-credential —
 * so two customers never collide on a shared constant (same pattern as
 * fathom/gong/otter).
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const me = await api.getCurrentUser();
        if (me?.uuid) {
            return {
                externalId: String(me.uuid),
                name:
                    [me.first_name, me.last_name].filter(Boolean).join(' ') ||
                    me.email ||
                    String(me.uuid),
                email: me.email || undefined,
                projectId: api.project_id || undefined,
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'PostHog: cannot derive a stable account identity — /api/users/@me/ failed and no API key to fingerprint.'
        );
    }
    return {
        externalId: keyFingerprint(apiKey),
        name: 'PostHog',
        projectId: api.project_id || undefined,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'PostHog',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) => {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return new Api({}).getAuthorizationRequirements();
        },

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKeyRaw =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null) ||
                get(params, 'access_token', null);
            const apiKey =
                typeof apiKeyRaw === 'string'
                    ? apiKeyRaw.replace(/^Bearer\s+/i, '').trim()
                    : '';
            if (!apiKey) throw new Error('api_key is required');

            const projectIdRaw =
                get(params, 'project_id', null) ||
                get(data, 'project_id', null) ||
                get(params, 'projectId', null);
            if (
                projectIdRaw === undefined ||
                projectIdRaw === null ||
                String(projectIdRaw).trim() === ''
            ) {
                throw new Error('project_id is required');
            }

            const hostRaw =
                get(params, 'host', null) ?? get(data, 'host', null);

            api.api_key = apiKey;
            api.api_key_name = 'Authorization';
            api.project_id = String(projectIdRaw).trim();
            // Blank host → US default, never an ambient env-derived value from
            // another credential.
            api.host = normalizePostHogHost(hostRaw);
            api.baseUrl = api.host;

            return {
                api_key: apiKey,
                project_id: api.project_id,
                host: api.host,
            };
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
                    projectId: identity.projectId,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // project_id and host are required to reach the correct project on
            // subsequent (including proxied) calls.
            credential: ['api_key', 'project_id', 'host'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.POSTHOG_API_KEY,
        project_id: process.env.POSTHOG_PROJECT_ID,
        host: process.env.POSTHOG_HOST,
    },
    // ADR-057: person → business@1 Contact (UNVALIDATED). Wired in index.js.
    mappings: {
        business: 'extensions.mapping',
    },
};

module.exports = { Definition };
