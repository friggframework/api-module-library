require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Totango is personal-access-token authenticated (`app-token` header). OAuth
 * apps are also offered by Totango but are not wired in this module yet.
 *
 * Identity resolution order:
 *   1. GET /api/v1/users/whoami — when a stable id/email is present
 *   2. service_id from a Search accounts response
 *   3. sha256 fingerprint of the app token (stable, non-reversible)
 *
 * There is deliberately NO shared constant fallback: two different customers
 * must never map to the same entity/credential.
 */
const keyFingerprint = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

function identityFromWhoAmI(who) {
    if (!who || typeof who !== 'object') return null;
    const externalId =
        who.id ||
        who.user_id ||
        who.userId ||
        who.email ||
        who.user_name ||
        who.username ||
        null;
    if (!externalId) return null;
    const name =
        who.display_name ||
        who.displayName ||
        who.name ||
        who.email ||
        String(externalId);
    return { externalId: String(externalId), name: String(name) };
}

async function resolveAccountIdentity(api) {
    try {
        const who = await api.getWhoAmI();
        const fromWho = identityFromWhoAmI(who);
        if (fromWho) return fromWho;
    } catch (e) {
        // fall through
    }

    try {
        const result = await api.searchAccounts({
            terms: [
                { type: 'string', term: 'status_group', in_list: ['paying'] },
            ],
            fields: [
                {
                    type: 'string',
                    term: 'health',
                    field_display_name: 'Health rank',
                },
            ],
            count: 1,
            offset: 0,
            scope: 'all',
        });
        const serviceId =
            result?.response?.service_id ||
            result?.service_id ||
            null;
        if (serviceId) {
            return {
                externalId: String(serviceId),
                name: `Totango service ${serviceId}`,
            };
        }
    } catch (e) {
        // fall through to fingerprint
    }

    const token = api?.api_key;
    if (!token) {
        throw new Error(
            'Totango: cannot derive a stable account identity — no whoami/service_id and no app token to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(token), name: 'Totango' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Totango',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Totango Authentication',
                    type: 'object',
                    required: ['app_token'],
                    properties: {
                        app_token: {
                            type: 'string',
                            title: 'App Token',
                        },
                        base_url: {
                            type: 'string',
                            title: 'API Base URL',
                            default: 'https://api.totango.com',
                            description:
                                'US: https://api.totango.com — EU: https://api-eu1.totango.com',
                        },
                    },
                },
                uiSchema: {
                    app_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a personal access token in Totango under Profile → Edit Profile → Integration. Sent as the app-token header.',
                    },
                    base_url: {
                        'ui:help':
                            'Leave blank for US (https://api.totango.com). Use https://api-eu1.totango.com for EU.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const appToken =
                get(params, 'app_token', null) ||
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(data, 'app_token', null) ||
                get(data, 'api_key', null);
            const baseUrl =
                get(params, 'base_url', null) || get(data, 'base_url', null);
            if (appToken) {
                api.setApiKey(appToken);
            }
            if (baseUrl) {
                api.baseUrl = baseUrl;
            }
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
            credential: ['api_key', 'baseUrl'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            try {
                return await api.getWhoAmI();
            } catch (e) {
                // whoami may require system_user:read / OAuth; Search proves the token.
                return api.searchAccounts({
                    terms: [
                        {
                            type: 'string',
                            term: 'status_group',
                            in_list: ['paying'],
                        },
                    ],
                    fields: [
                        {
                            type: 'string',
                            term: 'health',
                            field_display_name: 'Health rank',
                        },
                    ],
                    count: 1,
                    offset: 0,
                    scope: 'all',
                });
            }
        },
    },
    env: {
        app_token: process.env.TOTANGO_APP_TOKEN,
        api_key: process.env.TOTANGO_APP_TOKEN,
        base_url: process.env.TOTANGO_BASE_URL,
        cdh_base_url: process.env.TOTANGO_CDH_BASE_URL,
    },
};

module.exports = { Definition };
