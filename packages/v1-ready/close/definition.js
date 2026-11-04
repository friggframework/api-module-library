require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Close CRM Definition — OAuth 2.0 primary (marketplace / multi-customer),
 * API key alternate via setAuthParams (HTTP Basic).
 *
 * Identity: prefer organization_id from the OAuth token response; otherwise
 * GET /me/ → organizations[0].id (or memberships[0].organization_id).
 *
 * Docs:
 *   https://developer.close.com/api/overview/oauth-authentication.md
 *   https://developer.close.com/api/overview/api-key-authentication.md
 *   https://developer.close.com/api/resources/users.md (GET /me/)
 */
async function resolveAccountIdentity(api) {
    if (api?.organization_id) {
        return {
            externalId: String(api.organization_id),
            name: 'Close',
        };
    }

    const me = await api.getMe();
    const org =
        (Array.isArray(me?.organizations) && me.organizations[0]) || null;
    const membershipOrgId =
        Array.isArray(me?.memberships) && me.memberships[0]
            ? me.memberships[0].organization_id
            : null;
    const externalId = org?.id || membershipOrgId || me?.id;
    if (!externalId) {
        throw new Error(
            'Close: GET /me/ returned no organization_id or user id — cannot derive a stable entity identifier. Response: ' +
                JSON.stringify(me)
        );
    }
    const name =
        org?.name ||
        [me?.first_name, me?.last_name].filter(Boolean).join(' ') ||
        me?.email ||
        'Close';
    return { externalId: String(externalId), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Close',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
            const api =
                this.api ||
                new Api({
                    client_id: Definition.env.client_id,
                    client_secret: Definition.env.client_secret,
                    redirect_uri: Definition.env.redirect_uri,
                    scope: Definition.env.scope,
                });
            return api.getAuthorizationRequirements();
        },
        getToken: async function (api, params) {
            const code = get(params, 'code');
            return api.getTokenFromCode(code);
        },
        // Alternate API-key path (HTTP Basic). Applied when api_key is present.
        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(data, 'api_key', null) ||
                get(data, 'apiKey', null);
            if (apiKey) {
                api.setApiKey(apiKey);
            }
            return api;
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            if (tokenResponse?.organization_id) {
                api.organization_id = tokenResponse.organization_id;
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async function (api, userId) {
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
                'api_key',
                'organization_id',
            ],
            entity: [],
        },
        testAuthRequest: async function (api) {
            return api.getMe();
        },
    },
    env: {
        client_id: process.env.CLOSE_CLIENT_ID,
        client_secret: process.env.CLOSE_CLIENT_SECRET,
        scope: process.env.CLOSE_SCOPE || 'all.full_access offline_access',
        redirect_uri: `${process.env.REDIRECT_URI}/close`,
        api_key: process.env.CLOSE_API_KEY,
    },
};

module.exports = { Definition };
