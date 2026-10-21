require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Dealertrack module Definition.
 *
 * Auth: OAuth 2.0 authorization-code (+ refresh_token) against
 * auth.dealertrack.com. Env: DEALERTRACK_CLIENT_ID, DEALERTRACK_CLIENT_SECRET,
 * DEALERTRACK_SCOPE, DEALERTRACK_REDIRECT_URI (preferred) or REDIRECT_URI/dealertrack.
 *
 * Identity: GET /dealer → dealer.id as entity/credential externalId.
 *
 * Canonical mapping: `extensions.mapping` → business@1 (UNVALIDATED)
 * for dealer → Company and customer → Contact. See mappings/business.js.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Dealertrack',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'Dealertrack OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        setAuthParams: async (api, params) => {
            const access =
                get(params, 'access_token', null) ||
                get(params, 'api_key', null);
            const refresh = get(params, 'refresh_token', null);
            if (access) api.access_token = access;
            if (refresh) api.refresh_token = refresh;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const dealer = await api.getDealer();
            if (!dealer?.id && dealer?.id !== 0) {
                throw new Error(
                    'Dealertrack /dealer did not return an id — cannot derive entity externalId'
                );
            }
            let locationName;
            try {
                const locations = await api.listLocations();
                const primary = Array.isArray(locations?.data)
                    ? locations.data[0]
                    : Array.isArray(locations)
                      ? locations[0]
                      : null;
                locationName = primary?.name;
            } catch (e) {
                // Location list is optional for identity; dealer id is enough.
            }
            return {
                identifiers: { externalId: String(dealer.id), userId },
                details: {
                    name: dealer.name || String(dealer.id),
                    locationName,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const dealer = await api.getDealer();
            if (!dealer?.id && dealer?.id !== 0) {
                throw new Error(
                    'Dealertrack /dealer did not return an id — cannot derive credential externalId'
                );
            }
            return {
                identifiers: { externalId: String(dealer.id), userId },
                details: { name: dealer.name || String(dealer.id) },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: ['dealerId', 'locationId'],
        },

        testAuthRequest: async (api) => api.getDealer(),
    },
    env: {
        client_id: process.env.DEALERTRACK_CLIENT_ID,
        client_secret: process.env.DEALERTRACK_CLIENT_SECRET,
        scope: process.env.DEALERTRACK_SCOPE || 'service customers repairs payments',
        redirect_uri:
            process.env.DEALERTRACK_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/dealertrack`
                : undefined),
    },
};

module.exports = { Definition };
