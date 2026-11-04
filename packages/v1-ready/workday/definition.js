require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Workday entity identity is the tenant alias (stable across credentials for a
 * given customer tenant). Worker-level identity (`/workers/me`) is used only to
 * enrich the display name when available.
 */
async function resolveAccountIdentity(api) {
    const tenant =
        api?.tenant_alias ||
        api?.tenant ||
        process.env.WORKDAY_TENANT_ALIAS ||
        null;
    if (!tenant) {
        throw new Error(
            'Workday: tenant_alias is required to derive a stable account identity for entity routing.'
        );
    }

    let name = `Workday ${tenant}`;
    try {
        const me = await api.getCurrentWorker();
        if (me?.descriptor) {
            name = `${me.descriptor} (${tenant})`;
        }
    } catch (e) {
        // Keep tenant-based identity; display name stays generic.
    }

    return { externalId: String(tenant), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Workday',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const pick = (...keys) => {
                for (const k of keys) {
                    const v =
                        get(params, k, null) ??
                        get(data, k, null);
                    if (v !== undefined && v !== null && v !== '') return v;
                }
                return null;
            };

            const clientId = pick('client_id', 'clientId');
            const clientSecret = pick('client_secret', 'clientSecret');
            const refreshToken = pick('refresh_token', 'refreshToken');
            const accessToken = pick('access_token', 'accessToken');
            const tenantAlias = pick('tenant_alias', 'tenantAlias', 'tenant');
            const tenantHostname = pick(
                'tenant_hostname',
                'tenantHostname'
            );
            const authMode = pick('auth_mode', 'authMode');
            const scope = pick('scope');
            const redirectUri = pick('redirect_uri', 'redirectUri');

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (refreshToken) api.refresh_token = refreshToken;
            if (accessToken) api.access_token = accessToken;
            if (tenantAlias) api.tenant_alias = String(tenantAlias);
            if (tenantHostname) api.tenant_hostname = String(tenantHostname);
            if (authMode) api.auth_mode = String(authMode).toLowerCase();
            if (scope) api.scope = scope;
            if (redirectUri) api.redirect_uri = redirectUri;

            api._configureEndpoints({});
            return api;
        },

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) ||
                get(params?.data, 'code', null);
            if (code) {
                return api.getTokenFromCode(code);
            }
            return api.getToken();
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
                'client_id',
                'client_secret',
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'tenant_alias',
                'tenant_hostname',
                'auth_mode',
                'scope',
            ],
            entity: ['tenant_alias'],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        client_id: process.env.WORKDAY_CLIENT_ID,
        client_secret: process.env.WORKDAY_CLIENT_SECRET,
        refresh_token: process.env.WORKDAY_REFRESH_TOKEN,
        tenant_alias: process.env.WORKDAY_TENANT_ALIAS,
        tenant_hostname: process.env.WORKDAY_TENANT_HOSTNAME,
        auth_mode: process.env.WORKDAY_AUTH_MODE,
        scope: process.env.WORKDAY_SCOPE,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/workday`
            : undefined,
    },
    encryption: {
        credentialFields: [
            'client_secret',
            'access_token',
            'refresh_token',
        ],
    },
};

module.exports = { Definition };
