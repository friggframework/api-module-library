require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Clockwork Recruiting Definition — OAuth 2.0 Authorization Code.
 *
 * OAuth lives on the central (firm-less) account host. Resource calls are
 * per-firm at `https://{firm}.clockworkrecruiting.com/api/v3`. The firm
 * subdomain is taken from the OAuth `state` / callback (`firm_subdomain`) or
 * decoded from the access-token JWT (`firm_hostname`) in Api.setTokens.
 *
 * Identity externalId = firm_subdomain (stable per connected firm).
 *
 * Docs (public):
 *   https://www.clockworkrecruiting.com
 *   https://api.clockworkrecruiting.com/v3.0 (developer docs via Clockwork support)
 *   https://support.clockworkrecruiting.com/category/1275-api-integrations
 */

function resolveFirmIdentity(api, callbackParams = {}) {
    const firmSubdomain =
        get(callbackParams, 'firm_subdomain', null) ||
        api?.firm_subdomain ||
        null;
    if (!firmSubdomain) {
        throw new Error(
            'Clockwork Recruiting: firm_subdomain is required for a stable entity identifier (pass it on the OAuth callback/state or decode it from the access token).'
        );
    }
    return {
        externalId: String(firmSubdomain),
        name: String(firmSubdomain),
        firm_subdomain: String(firmSubdomain),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ClockworkRecruiting',
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
            const firmSubdomain = get(params, 'firm_subdomain', null);
            if (firmSubdomain) api.setFirmSubdomain(firmSubdomain);
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const firmSubdomain =
                get(callbackParams, 'firm_subdomain', null) ||
                api.firm_subdomain;
            if (firmSubdomain) api.setFirmSubdomain(firmSubdomain);
            await api.testConnection();
            const identity = resolveFirmIdentity(api, callbackParams);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    firm_subdomain: identity.firm_subdomain,
                },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const identity = resolveFirmIdentity(api, {});
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { firm_subdomain: identity.firm_subdomain },
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: ['firm_subdomain'],
        },
        testAuthRequest: async function (api) {
            return api.testConnection();
        },
    },
    env: {
        client_id: process.env.CLOCKWORK_OAUTH_CLIENT_ID,
        client_secret: process.env.CLOCKWORK_OAUTH_CLIENT_SECRET,
        scope: 'read write',
        redirect_uri:
            process.env.CLOCKWORK_RECRUITING_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/clockwork-recruiting`
                : undefined),
        stage: process.env.CLOCKWORK_STAGE || 'prod',
    },
};

module.exports = { Definition };
