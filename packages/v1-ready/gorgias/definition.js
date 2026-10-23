require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Gorgias auth is primarily OAuth2 scoped to a per-account subdomain
 * (`https://{subdomain}.gorgias.com`). Private apps may instead use HTTP Basic
 * (account email + API key) — see Api.setBasicAuth / setAuthParams.
 *
 * Entity identity is the Gorgias account domain from GET /account (or the
 * subdomain collected during authorization when the account call is unavailable).
 */
async function resolveAccountIdentity(api) {
    try {
        const account = await api.getAccount();
        if (account?.domain) {
            return {
                externalId: String(account.domain),
                name: String(account.domain),
            };
        }
    } catch (e) {
        // fall through
    }
    if (api?.subdomain) {
        return {
            externalId: String(api.subdomain),
            name: String(api.subdomain),
        };
    }
    throw new Error(
        'Gorgias: cannot derive a stable account identity — no /account domain and no subdomain.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Gorgias',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => {
            const client = api || new Api();
            // URL is a template until the user supplies a subdomain; the auth
            // UI / CLI collect subdomain then call getAuthUri / getToken.
            let url;
            try {
                url = client.subdomain
                    ? client.getAuthUri({ subdomain: client.subdomain })
                    : client._buildAuthorizeUri('{domain}');
            } catch (e) {
                url = client._buildAuthorizeUri('{domain}');
            }
            return {
                url,
                type: 'oauth2',
                data: {
                    jsonSchema: {
                        title: 'Gorgias Authentication',
                        type: 'object',
                        required: ['subdomain'],
                        properties: {
                            subdomain: {
                                type: 'string',
                                title: 'Gorgias subdomain',
                            },
                        },
                    },
                    uiSchema: {
                        subdomain: {
                            'ui:help':
                                'Your Gorgias account subdomain (the {domain} in https://{domain}.gorgias.com).',
                            'ui:placeholder': 'acme',
                        },
                    },
                },
            };
        },

        /**
         * Alternate private-app path: apply Basic Auth credentials.
         * OAuth flow uses getToken instead.
         */
        setAuthParams: async (api, params) => {
            const subdomain = get(params, 'subdomain', null);
            if (subdomain) api.setSubdomain(subdomain);

            const apiKey =
                get(params, 'api_key', null) || get(params, 'apiKey', null);
            const apiUserEmail =
                get(params, 'api_user_email', null) ||
                get(params, 'apiUserEmail', null);
            if (apiKey && apiUserEmail) {
                api.setBasicAuth({
                    api_user_email: apiUserEmail,
                    api_key: apiKey,
                    subdomain: subdomain || api.subdomain,
                });
            }
        },

        getToken: async (api, params) => {
            const data = params?.data || params || {};
            const code = get(data, 'code');
            const subdomain =
                get(data, 'subdomain', null) ||
                get(data, 'account', null) ||
                get(params, 'subdomain', null);
            if (subdomain) {
                api.setSubdomain(subdomain);
            }
            if (!api.subdomain) {
                throw new Error(
                    'Gorgias getToken requires a subdomain (account).'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
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
            credential: [
                'access_token',
                'refresh_token',
                'subdomain',
                'api_key',
                'api_user_email',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => api.getAccount(),
    },
    env: {
        client_id: process.env.GORGIAS_CLIENT_ID,
        client_secret: process.env.GORGIAS_CLIENT_SECRET,
        scope: process.env.GORGIAS_SCOPES,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/gorgias`
            : undefined,
    },
};

module.exports = { Definition };
