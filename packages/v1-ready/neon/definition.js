require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Neon CRM Definition — HTTP Basic (Org ID + API key).
 *
 * Identity: Org ID is the stable tenant key (Basic-auth username and the
 * `organizationId` field on webhook payloads). Prefer the Org ID supplied at
 * auth time; optionally enrich the display name from
 * GET /properties/organizationProfile when available.
 *
 * Docs:
 *   https://developer.neoncrm.com/authentication/
 *   https://developer.neoncrm.com/api-v2/
 *   https://developer.neoncrm.com/webhooks/
 */
async function resolveAccountIdentity(api) {
    const orgId = api?.orgId || api?.username;
    if (!orgId) {
        throw new Error(
            'Neon: cannot derive a stable account identity — Org ID is required (Basic-auth username).'
        );
    }

    let name = 'Neon CRM';
    try {
        const profile = await api.getOrganizationProfile();
        const profileName =
            profile?.organizationName ||
            profile?.name ||
            profile?.organization?.name;
        if (profileName) name = String(profileName);
    } catch (_e) {
        // Profile is optional for identity; Org ID alone is sufficient.
    }

    return { externalId: String(orgId), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Neon',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            (api || new Api({})).getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const orgId =
                get(params, 'orgId', null) ||
                get(params, 'org_id', null) ||
                get(data, 'orgId', null) ||
                get(data, 'org_id', null);
            const apiKey =
                get(params, 'apiKey', null) ||
                get(params, 'api_key', null) ||
                get(data, 'apiKey', null) ||
                get(data, 'api_key', null);
            const environment =
                get(params, 'environment', null) ||
                get(data, 'environment', null);
            const baseUrl =
                get(params, 'baseUrl', null) ||
                get(params, 'base_url', null) ||
                get(data, 'baseUrl', null) ||
                get(data, 'base_url', null);

            if (!orgId) {
                throw new Error('Org ID is required');
            }
            if (!apiKey) {
                throw new Error('API key is required');
            }

            api.setCredentials({
                orgId,
                apiKey,
                environment: environment || undefined,
                baseUrl: baseUrl || undefined,
            });
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            if (tokenResponse?.orgId && !api.orgId) {
                api.setCredentials({ orgId: tokenResponse.orgId });
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
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
            credential: ['orgId', 'apiKey', 'environment', 'baseUrl'],
            entity: [],
        },

        testAuthRequest: async (api) => api.testAuth(),
    },
    env: {
        orgId: process.env.NEON_ORG_ID,
        apiKey: process.env.NEON_API_KEY,
        environment: process.env.NEON_ENVIRONMENT || 'production',
        base_url: process.env.NEON_BASE_URL,
    },
};

module.exports = { Definition };
