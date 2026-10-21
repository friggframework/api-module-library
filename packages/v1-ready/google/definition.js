require('dotenv').config();
const { Api, DEFAULT_GOOGLE_SCOPE } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Build a stable, namespaced credential external id.
 *
 * Reimplements the shared helper that lived outside the source module tree
 * (`../_shared/credential-id`). Combining module + Google account `sub` +
 * Frigg user keeps credential rows unique when multiple Frigg users connect
 * the same Google account.
 */
function credentialExternalId(moduleName, externalId, userId) {
    return [moduleName, externalId, userId].filter((p) => p != null && p !== '').join(':');
}

/**
 * Resolve the connected Google account for entity/credential identity.
 * Identity comes from OpenID Connect userinfo (`sub`), not from a product API.
 */
async function resolveUserIdentity(api) {
    const info = await api.getUserInfo();
    if (info?.sub) {
        return {
            externalId: String(info.sub),
            name: info.email || info.name || String(info.sub),
        };
    }
    throw new Error(
        'Google: cannot derive a stable user identity — OpenID Connect userinfo returned no sub.'
    );
}

const codeFrom = (params) => {
    if (typeof params === 'string') return params;
    return (
        get(params || {}, 'code', null) ||
        get((params && params.data) || {}, 'code', null)
    );
};

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Google',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) => {
            return api.getAuthorizationRequirements();
        },
        getToken: async (api, params) => {
            return api.getTokenFromCode(codeFrom(params));
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveUserIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveUserIdentity(api);
            return {
                identifiers: {
                    externalId: credentialExternalId(
                        config.name,
                        identity.externalId,
                        userId
                    ),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getUserInfo();
        },
    },
    env: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        scope: process.env.GOOGLE_SCOPE || DEFAULT_GOOGLE_SCOPE,
        // Dedicated redirect URI for this module (google.md). Fall back to
        // REDIRECT_URI/google when unset so local apps that share one base
        // redirect still work. Omit entirely when neither is set so schema
        // validation does not see the string "undefined".
        redirect_uri:
            process.env.GOOGLE_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/google`
                : undefined),
    },
};

module.exports = { Definition, credentialExternalId, resolveUserIdentity };
