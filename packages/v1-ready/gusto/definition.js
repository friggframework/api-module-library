require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Gusto App Integrations — OAuth2 company-scoped connection.
 *
 * During authorization the admin selects one company; the resulting access
 * token is restricted to that company (strict access since v2023-05-01).
 * Identity is derived from GET /v1/token_info (resource.uuid = company UUID).
 *
 * Scopes are assigned to the application in Gusto's Developer Portal / during
 * review; they are not requested in the authorize URL.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Gusto',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params?.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const info = await api.getTokenInfo();
            const companyUuid = info?.resource?.uuid;
            if (companyUuid && info?.resource?.type === 'Company') {
                api.company_uuid = companyUuid;
            }
            let name = companyUuid || 'Gusto';
            try {
                if (companyUuid) {
                    const company = await api.getCompany(companyUuid);
                    name = company?.name || company?.trade_name || name;
                }
            } catch (e) {
                // companies:read may not be granted yet; fall back to uuid
            }
            return {
                identifiers: {
                    externalId: String(companyUuid),
                    userId,
                },
                details: { name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const info = await api.getTokenInfo();
            const companyUuid = info?.resource?.uuid;
            if (companyUuid && info?.resource?.type === 'Company') {
                api.company_uuid = companyUuid;
            }
            return {
                identifiers: {
                    externalId: String(companyUuid),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'system_access_token',
            ],
            entity: ['company_uuid'],
        },
        testAuthRequest: async (api) => api.getTokenInfo(),
    },
    env: {
        client_id: process.env.GUSTO_CLIENT_ID,
        client_secret: process.env.GUSTO_CLIENT_SECRET,
        // Documented for operators; Gusto does not accept scope on authorize.
        scope: process.env.GUSTO_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/gusto`,
        base_url: process.env.GUSTO_BASE_URL,
    },
};

module.exports = { Definition };
