require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * GoHighLevel Definition — OAuth 2.0 Location-scoped Marketplace tokens.
 *
 * Identity: tokenResponse.locationId (required for Sub-Account tokens).
 * Entity externalId = locationId so connect and reload resolve the same entity.
 *
 * Docs:
 *   https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token
 *   https://marketplace.gohighlevel.com/docs/Authorization/Scopes
 */
async function resolveLocationIdentity(api, tokenResponse = {}) {
    const locationId =
        tokenResponse.locationId ||
        api?.locationId ||
        null;
    if (!locationId) {
        throw new Error(
            'GoHighLevel: locationId is required for a stable entity identifier (Sub-Account / Location token).'
        );
    }

    let name = 'GoHighLevel Location';
    try {
        const res = await api.getLocation(locationId);
        const loc = res?.location || res;
        if (loc?.name) name = loc.name;
    } catch {
        // Token may lack locations.readonly; locationId alone is still stable.
    }
    return { externalId: String(locationId), name, locationId: String(locationId) };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'GoHighLevel',
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
            const code = get(params, 'code', null);
            if (!code) throw new Error('Authorization code is required');
            return api.getTokenFromCode(code);
        },
        setAuthParams: async function (api, params) {
            if (params.access_token || params.refresh_token) {
                await api.setTokens(params);
            }
            if (params.locationId) {
                api.locationId = params.locationId;
            }
            return params;
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            if (tokenResponse?.locationId) {
                api.locationId = tokenResponse.locationId;
            }
            const identity = await resolveLocationIdentity(api, tokenResponse);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    locationId: identity.locationId,
                },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const identity = await resolveLocationIdentity(api, {});
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { locationId: identity.locationId },
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'expires_in',
                'token_type',
            ],
            entity: ['locationId'],
        },
        testAuthRequest: async function (api) {
            try {
                return await api.testAuthRequest();
            } catch (error) {
                const status = error?.statusCode || error?.response?.status;
                if (status === 401 || status === 403) {
                    throw new Error(
                        'GoHighLevel authentication failed: token invalid or expired. Please reconnect.'
                    );
                }
                throw new Error(
                    `GoHighLevel authentication test failed (HTTP ${
                        status || 'unknown'
                    }).`
                );
            }
        },
    },
    env: {
        client_id: process.env.GOHIGHLEVEL_CLIENT_ID,
        client_secret: process.env.GOHIGHLEVEL_CLIENT_SECRET,
        scope: process.env.GOHIGHLEVEL_SCOPE,
        redirect_uri:
            process.env.GOHIGHLEVEL_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/gohighlevel`
                : undefined),
    },
};

module.exports = { Definition };
