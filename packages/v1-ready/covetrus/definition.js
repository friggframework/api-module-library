require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Covetrus Definition — OAuth 2.0 authorization code (Covetrus Connect).
 *
 * Identity: GET /practice → practice.id (stable practice identifier).
 * Optional primary location name from GET /locations when available.
 *
 * Redirect: COVETRUS_REDIRECT_URI (dedicated), else ${REDIRECT_URI}/covetrus.
 *
 * Partner program (docs gated): 
 *   https://covetrus.com/covetrus-platform/workflow-and-productivity-tools/technology-integration-hub/
 */
async function resolvePracticeIdentity(api) {
    const practice = await api.getPractice();
    if (!practice?.id && practice?.id !== 0) {
        throw new Error(
            'Covetrus: GET /practice returned no practice id — cannot derive a stable entity identifier. Response: ' +
                JSON.stringify(practice)
        );
    }

    let locationName;
    try {
        const locations = await api.listLocations();
        const primary =
            (Array.isArray(locations?.data) && locations.data[0]) ||
            (Array.isArray(locations) && locations[0]) ||
            null;
        locationName = primary?.name;
    } catch {
        // Locations may require scopes beyond the default; practice id is enough.
    }

    return {
        externalId: String(practice.id),
        name: practice.name || 'Covetrus Practice',
        phone: practice.phone,
        locationName,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Covetrus',
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
            const code =
                get(params, 'code', null) ||
                get(params?.data || {}, 'code', null);
            if (!code) {
                throw new Error('Authorization code is required');
            }
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const identity = await resolvePracticeIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    phone: identity.phone,
                    locationName: identity.locationName,
                },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const identity = await resolvePracticeIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: ['practiceId', 'locationId'],
        },
        testAuthRequest: async function (api) {
            return api.getPractice();
        },
    },
    env: {
        client_id: process.env.COVETRUS_CLIENT_ID,
        client_secret: process.env.COVETRUS_CLIENT_SECRET,
        scope: process.env.COVETRUS_SCOPE || 'clients invoices payments',
        redirect_uri:
            process.env.COVETRUS_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/covetrus`
                : undefined),
    },
};

module.exports = { Definition };
