require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Listrak Cross Channel uses OAuth 2.0 client_credentials (no browser
 * redirect, no refresh_token). There is no public "/me" identity endpoint;
 * the Frigg entity/credential externalId is a sha256 fingerprint of the
 * Integration client_id (stable per Cross Channel integration, unique across
 * customers, never a shared constant).
 *
 * Ported from an unfinished pre-v1 scaffold (Manager + Mongoose models) into
 * the v2 Api + Definition shape. Scaffold Microsoft Graph URLs / placeholder
 * authorizationUri were discarded; every endpoint and the token URL come from
 * Listrak's official Cross Channel docs.
 */
const clientIdFingerprint = (clientId) =>
    crypto.createHash('sha256').update(String(clientId)).digest('hex');

function resolveAccountIdentity(api) {
    const clientId = api?.client_id;
    if (!clientId) {
        throw new Error(
            'CrossChannel: cannot derive a stable account identity — client_id is required.'
        );
    }
    return {
        externalId: clientIdFingerprint(clientId),
        name: 'Cross Channel',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'CrossChannel',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'client_id', null) ||
                get(params, 'clientId', null) ||
                get(data, 'client_id', null) ||
                get(data, 'clientId', null);
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(params, 'clientSecret', null) ||
                get(data, 'client_secret', null) ||
                get(data, 'clientSecret', null);
            const baseUrl =
                get(params, 'base_url', null) || get(data, 'base_url', null);
            const tokenUri =
                get(params, 'token_uri', null) || get(data, 'token_uri', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (baseUrl) api.baseUrl = baseUrl;
            if (tokenUri) api.tokenUri = tokenUri;
            return api;
        },

        getToken: async (api, params) => {
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => {
            // Lightweight authenticated list of event configurations.
            return api.getEventConfigurations();
        },
    },
    env: {
        client_id: process.env.CROSSCHANNEL_CLIENT_ID,
        client_secret: process.env.CROSSCHANNEL_CLIENT_SECRET,
        base_url: process.env.CROSSCHANNEL_BASE_URL,
        token_uri: process.env.CROSSCHANNEL_TOKEN_URI,
    },
    encryption: {
        // client_secret is custom beyond the core OAuth token fields.
        credentialFields: ['client_secret'],
    },
};

module.exports = { Definition, clientIdFingerprint };
