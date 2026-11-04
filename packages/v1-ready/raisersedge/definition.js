require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');
const crypto = require('crypto');

/**
 * Stable externalId per Blackbaud environment: md5(environment_id) from the
 * OAuth token response, hashed identically on connect and reload.
 *
 * Docs: https://developer.blackbaud.com/skyapi/docs/authorization
 */
function hashEnvironmentId(environmentId) {
    return crypto.createHash('md5').update(String(environmentId)).digest('hex');
}

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'RaisersEdge',
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
                    subscription_key: Definition.env.subscription_key,
                });
            return api.getAuthorizationRequirements();
        },
        getToken: async function (api, params) {
            const code = get(params, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            if (tokenResponse?.environment_id) {
                api.environment_id = tokenResponse.environment_id;
            }
            if (!api.environment_id) {
                throw new Error(
                    "Raiser's Edge NXT: token response missing environment_id — cannot derive a stable entity identifier."
                );
            }
            return {
                identifiers: {
                    externalId: hashEnvironmentId(api.environment_id),
                    userId,
                },
                details: {
                    name: "Blackbaud Raiser's Edge NXT",
                    environment_id: api.environment_id,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'environment_id',
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            if (!api.environment_id) {
                throw new Error(
                    "Raiser's Edge NXT: missing environment_id on Api — cannot derive a stable credential identifier."
                );
            }
            return {
                identifiers: {
                    externalId: hashEnvironmentId(api.environment_id),
                    userId,
                },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.listConstituents({ limit: 1 });
        },
    },
    env: {
        client_id: process.env.BLACKBAUD_CONSUMER_KEY,
        client_secret: process.env.BLACKBAUD_CONSUMER_SECRET,
        scope: process.env.BLACKBAUD_SCOPE,
        // Dedicated redirect URI — do not derive from REDIRECT_URI/raisersedge.
        redirect_uri: process.env.RAISERSEDGE_REDIRECT_URI,
        subscription_key: process.env.BLACKBAUD_SUBSCRIPTION_KEY,
    },
};

module.exports = { Definition, hashEnvironmentId };
