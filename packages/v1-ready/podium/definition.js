require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Podium',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const org = await api.getOrganizationDetails();
            return {
                identifiers: {
                    externalId: org.organizationUid || `podium-user-${userId}`,
                    userId,
                },
                details: {
                    name: org.name,
                    // Cached so the integration's config screen can offer a
                    // location picker without a second round trip. Every message
                    // send must name a location.
                    locations: org.locations,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['location_uid', 'organization_uid'],
        },
        getCredentialDetails: async function (api, userId) {
            const org = await api.getOrganizationDetails();
            return {
                identifiers: {
                    externalId: org.organizationUid || `podium-user-${userId}`,
                    userId,
                },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.listLocations();
        },
    },
    env: {
        client_id: process.env.PODIUM_CLIENT_ID,
        client_secret: process.env.PODIUM_CLIENT_SECRET,
        // Scope names are not published; take them from the app's own
        // configuration in the Podium developer portal. Space-separated.
        scope: process.env.PODIUM_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/podium`,
        // Overridable so a corrected path or host can ship as config.
        baseUrl: process.env.PODIUM_BASE_URL,
        tokenUri: process.env.PODIUM_TOKEN_URI,
        authorizationUri: process.env.PODIUM_AUTHORIZATION_URI,
    },
};

module.exports = { Definition };
