require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Extract an OAuth authorization code from Frigg callback params.
 * Reimplements the shared `codeFrom` helper that the source module imported
 * from `../_shared/oauth-code` (not included in the cleared tarball).
 */
function codeFrom(params = {}) {
    return (
        get(params, 'code', null) || get(params.data || {}, 'code', null)
    );
}

const DEFAULT_SCOPE =
    'https://www.googleapis.com/auth/analytics.readonly';

/**
 * Google Analytics Data API module definition.
 *
 * OAuth2 authorization-code. Identity comes from Google's oauth2/v2/userinfo
 * (Data API has no account "/me"). ADR-057 canonical mappings are omitted:
 * report rows and dimension/metric metadata do not fit business@1
 * Company/Contact/Deal, support@1, or billing@1 — see PR notes.
 */
const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'GoogleAnalytics',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            return api.getTokenFromCode(codeFrom(params));
        },

        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const identity = await api.getTokenIdentity();
            return {
                identifiers: {
                    externalId: identity.identifier,
                    userId,
                },
                details: {
                    name: identity.name,
                    email: identity.email,
                },
            };
        },

        getCredentialDetails: async function (api, userId) {
            const identity = await api.getTokenIdentity();
            return {
                identifiers: {
                    externalId: identity.identifier,
                    userId,
                },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async function (api) {
            return api.testAuth();
        },

        getAuthorizationRequirements: async function (api) {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return new Api({
                client_id: process.env.GOOGLE_ANALYTICS_CLIENT_ID,
                client_secret: process.env.GOOGLE_ANALYTICS_CLIENT_SECRET,
                redirect_uri:
                    process.env.GOOGLE_ANALYTICS_REDIRECT_URI ||
                    (process.env.REDIRECT_URI
                        ? `${process.env.REDIRECT_URI}/google-analytics`
                        : undefined),
                scope: process.env.GOOGLE_ANALYTICS_SCOPE || DEFAULT_SCOPE,
            }).getAuthorizationRequirements();
        },
    },
    env: {
        client_id: process.env.GOOGLE_ANALYTICS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ANALYTICS_CLIENT_SECRET,
        redirect_uri:
            process.env.GOOGLE_ANALYTICS_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/google-analytics`
                : undefined),
        scope: process.env.GOOGLE_ANALYTICS_SCOPE || DEFAULT_SCOPE,
    },
};

module.exports = { Definition, codeFrom };
