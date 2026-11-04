require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api, DEFAULT_SCOPE } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Resolve the helpdesk subdomain from callback params / api instance.
 * Gorgias OAuth is always per-account (`https://{subdomain}.gorgias.com`).
 */
function pickSubdomain(callbackParams = {}, api) {
    const data = get(callbackParams, 'data', callbackParams) || {};
    return (
        get(data, 'subdomain', null) ||
        get(data, 'account', null) ||
        get(data, 'domain', null) ||
        get(callbackParams, 'subdomain', null) ||
        get(callbackParams, 'account', null) ||
        api?.subdomain ||
        null
    );
}

async function resolveAccountIdentity(api) {
    const account = await api.getAccount();
    const domain = account?.domain || api.subdomain;
    if (!domain) {
        throw new Error(
            'Gorgias getAccount did not return a domain and no subdomain is set on the api instance'
        );
    }
    return {
        externalId: String(domain),
        name: String(domain),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Gorgias',
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
                    'Gorgias OAuth callback missing authorization code'
                );
            }
            if (!api.subdomain || api.subdomain === '{domain}') {
                throw new Error(
                    'Gorgias OAuth requires a helpdesk subdomain before exchanging the code'
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
                details: { name: identity.name, subdomain: identity.externalId },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { subdomain: identity.externalId },
            };
        },

        apiPropertiesToPersist: {
            // subdomain is required to rebuild baseUrl / tokenUri on restore.
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'subdomain',
            ],
            entity: ['subdomain'],
        },

        testAuthRequest: async (api) => api.getAccount(),
    },
    env: {
        client_id: process.env.GORGIAS_CLIENT_ID,
        client_secret: process.env.GORGIAS_CLIENT_SECRET,
        scope: process.env.GORGIAS_SCOPE || DEFAULT_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/gorgias".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/gorgias`
            : undefined,
    },
};

module.exports = { Definition };
