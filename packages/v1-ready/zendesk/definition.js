require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api, DEFAULT_SCOPE } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Resolve the Zendesk subdomain from callback params / api instance.
 * OAuth authorize + token URLs are always per-account
 * (`https://{subdomain}.zendesk.com/...`).
 */
function pickSubdomain(callbackParams = {}, api) {
    const data = get(callbackParams, 'data', callbackParams) || {};
    return (
        get(data, 'subdomain', null) ||
        get(callbackParams, 'subdomain', null) ||
        api?.subdomain ||
        null
    );
}

async function resolveAccountIdentity(api) {
    const me = await api.getCurrentUser();
    const user = me?.user || me;
    const subdomain = api.subdomain;
    if (!subdomain || subdomain === '{subdomain}') {
        throw new Error(
            'Zendesk identity requires a subdomain on the api instance'
        );
    }
    if (!user?.id) {
        throw new Error(
            'Zendesk getCurrentUser did not return a user.id — cannot derive a stable account identity'
        );
    }
    // Account-scoped external id: subdomain is unique per Zendesk instance.
    // Include the authorizing user id so two agents on the same subdomain can
    // still be distinguished if the host stores per-user credentials.
    return {
        externalId: `${subdomain}:${user.id}`,
        name: user.name || subdomain,
        subdomain: String(subdomain),
        userId: user.id,
        email: user.email || null,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Zendesk',
    // ADR-057: point at extensions.mapping (support@1 Ticket mapping is UNVALIDATED).
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            const subdomain = pickSubdomain(params, api);
            if (subdomain) {
                api.setSubdomain(subdomain);
            }
            if (!code) {
                throw new Error(
                    'Zendesk OAuth callback missing authorization code'
                );
            }
            if (!api.subdomain || api.subdomain === '{subdomain}') {
                throw new Error(
                    'Zendesk OAuth requires a subdomain before exchanging the code'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const subdomain = pickSubdomain(callbackParams, api);
            if (subdomain) {
                api.setSubdomain(subdomain);
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    subdomain: identity.subdomain,
                    email: identity.email,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { subdomain: identity.subdomain },
            };
        },

        apiPropertiesToPersist: {
            // subdomain is required to rebuild baseUrl / tokenUri on restore.
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'subdomain',
            ],
            entity: ['subdomain'],
        },

        testAuthRequest: async (api) => api.getCurrentUser(),
    },
    env: {
        client_id: process.env.ZENDESK_CLIENT_ID,
        client_secret: process.env.ZENDESK_CLIENT_SECRET,
        scope: process.env.ZENDESK_SCOPE || DEFAULT_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/zendesk".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/zendesk`
            : undefined,
    },
};

module.exports = { Definition };
