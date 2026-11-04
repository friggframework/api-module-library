require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Kit (ConvertKit API v4) module Definition.
 *
 * Auth: OAuth 2.0 authorization-code (App Store apps). Credentials persist
 * access_token + refresh_token. Refresh tokens are single-use per Kit docs.
 *
 * Redirect URI uses dedicated KIT_REDIRECT_URI (not REDIRECT_URI/kit).
 *
 * Identity: GET /account → account.id (stable externalId) + account.name.
 * @see https://developers.kit.com/api-reference/accounts/get-current-account
 *
 * Canonical mapping: `extensions.mapping` → business@1 Contact (UNVALIDATED).
 * Company/Deal/support/billing objects are not a natural fit for Kit's
 * email-marketing domain — see PR / ADR-057 notes.
 */
async function resolveAccountIdentity(api) {
    const res = await api.getAccount();
    const account = res?.account;
    if (account?.id == null) {
        throw new Error(
            'Kit /account did not return account.id — cannot derive a stable entity identifier.'
        );
    }
    return {
        externalId: String(account.id),
        name:
            account.name ||
            account.primary_email_address ||
            String(account.id),
        email: account.primary_email_address || res?.user?.email || null,
    };
}

/**
 * Extract OAuth authorization code from callback params (Frigg may nest under
 * `data`). Replaces the client-repo `../_shared/oauth-code` helper.
 */
function codeFrom(params) {
    const data = get(params, 'data', params) || {};
    return get(data, 'code', null) || get(params, 'code', null);
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Kit',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return new Api({
                client_id: Definition.env.client_id,
                client_secret: Definition.env.client_secret,
                redirect_uri: Definition.env.redirect_uri,
                scope: Definition.env.scope,
            }).getAuthorizationRequirements();
        },

        getToken: async (api, params) => {
            const code = codeFrom(params);
            if (!code) {
                throw new Error('Kit OAuth callback missing authorization code');
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
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
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            try {
                return await api.getAccount();
            } catch (error) {
                const status = error?.statusCode || error?.response?.status;
                if (status === 401 || status === 403) {
                    throw new Error(
                        'Kit authentication failed: token invalid or revoked. Please reconnect.'
                    );
                }
                throw error;
            }
        },
    },
    env: {
        client_id: process.env.KIT_CLIENT_ID,
        client_secret: process.env.KIT_CLIENT_SECRET,
        scope: process.env.KIT_SCOPE || 'public',
        redirect_uri: process.env.KIT_REDIRECT_URI,
    },
};

module.exports = { Definition };
