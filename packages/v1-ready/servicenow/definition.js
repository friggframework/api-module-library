require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Resolve the ServiceNow instance subdomain from callback params / api.
 * OAuth authorize + token URLs are always per-instance
 * (`https://{instance}.service-now.com/...`).
 */
function pickInstance(callbackParams = {}, api) {
    const data = get(callbackParams, 'data', callbackParams) || {};
    return (
        get(data, 'instance', null) ||
        get(callbackParams, 'instance', null) ||
        api?.instance ||
        null
    );
}

/**
 * Account identity is the instance subdomain (unique per ServiceNow tenant).
 * Optionally enrich with the authorizing username when basic auth is used.
 * Table API has no official `/me` identity endpoint; we do not invent one.
 */
async function resolveAccountIdentity(api) {
    const instance = api.instance;
    if (!instance || instance === '{instance}') {
        throw new Error(
            'ServiceNow identity requires an instance on the api instance'
        );
    }
    const name = api.username
        ? `${instance} (${api.username})`
        : String(instance);
    return {
        externalId: String(instance),
        name,
        instance: String(instance),
        username: api.username || null,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ServiceNow',
    // ADR-057: point at extensions.mapping (support@1 + business@1 are UNVALIDATED).
    mappings: {
        support: 'extensions.mapping',
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        /**
         * OAuth path: exchange authorization code.
         * Basic path: when username+password are present (and no code), set them
         * via setAuthParams semantics without inventing a token endpoint call.
         */
        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            const instance = pickInstance(params, api);
            if (instance) {
                api.setInstance(instance);
            }
            if (!api.instance || api.instance === '{instance}') {
                throw new Error(
                    'ServiceNow auth requires an instance before exchanging credentials'
                );
            }

            const username =
                get(data, 'username', null) || get(params, 'username', null);
            const password =
                get(data, 'password', null) || get(params, 'password', null);

            // Basic-auth alternate: no OAuth code.
            if (!code && username && password) {
                api.username = username;
                api.password = password;
                api.isRefreshable = false;
                return { username, instance: api.instance };
            }

            if (!code) {
                throw new Error(
                    'ServiceNow OAuth callback missing authorization code (or provide username/password for basic auth)'
                );
            }
            return api.getTokenFromCode(code);
        },

        setAuthParams: async (api, params) => {
            const instance =
                get(params, 'instance', null) ||
                get(params, 'data.instance', null);
            if (instance) {
                api.setInstance(instance);
            }
            const accessToken =
                get(params, 'access_token', null) ||
                get(params, 'data.access_token', null);
            const refreshToken =
                get(params, 'refresh_token', null) ||
                get(params, 'data.refresh_token', null);
            if (accessToken) {
                api.access_token = accessToken;
                api.isRefreshable = true;
            }
            if (refreshToken) {
                api.refresh_token = refreshToken;
            }
            const username =
                get(params, 'username', null) ||
                get(params, 'data.username', null);
            const password =
                get(params, 'password', null) ||
                get(params, 'data.password', null);
            if (username) api.username = username;
            if (password) api.password = password;
            if (username && password && !accessToken) {
                api.isRefreshable = false;
            }
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const instance = pickInstance(callbackParams, api);
            if (instance) {
                api.setInstance(instance);
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    instance: identity.instance,
                    username: identity.username,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { instance: identity.instance },
            };
        },

        apiPropertiesToPersist: {
            // instance is required to rebuild baseUrl / tokenUri on restore.
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'instance',
                'username',
                'password',
            ],
            entity: ['instance'],
        },

        // Any authenticated Table API call proves credentials work.
        testAuthRequest: async (api) =>
            api.listSysUsers({ sysparm_limit: 1 }),
    },
    env: {
        client_id: process.env.SERVICENOW_CLIENT_ID,
        client_secret: process.env.SERVICENOW_CLIENT_SECRET,
        scope: process.env.SERVICENOW_SCOPE || undefined,
        // Omit when unset so schema validation does not see the string "undefined/servicenow".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/servicenow`
            : undefined,
    },
};

module.exports = { Definition };
