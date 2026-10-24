require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

const DEFAULT_SCOPE = 'com.intuit.quickbooks.accounting';

function pickRealmId(callbackParams = {}, tokenResponse = {}, api) {
    return (
        get(callbackParams, 'realmId', null) ||
        get(callbackParams, 'data.realmId', null) ||
        get(tokenResponse, 'realmId', null) ||
        api?.realmId ||
        null
    );
}

async function resolveCompanyName(api) {
    try {
        const info = await api.getCompanyInfo();
        const company =
            info?.CompanyInfo ||
            info?.QueryResponse?.CompanyInfo?.[0] ||
            info;
        return (
            company?.CompanyName ||
            company?.LegalName ||
            company?.Name ||
            `QuickBooks ${api.realmId}`
        );
    } catch (_e) {
        return `QuickBooks ${api.realmId}`;
    }
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'QuickBooks',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            const realmId =
                get(data, 'realmId', null) || get(params, 'realmId', null);
            if (realmId) {
                api.realmId = String(realmId);
            }
            if (!code) {
                throw new Error(
                    'QuickBooks OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const realmId = pickRealmId(callbackParams, tokenResponse, api);
            if (!realmId) {
                throw new Error(
                    'QuickBooks OAuth callback missing realmId — required as the company externalId'
                );
            }
            api.realmId = String(realmId);
            const name = await resolveCompanyName(api);
            return {
                identifiers: { externalId: String(realmId), userId },
                details: { name, realmId: String(realmId) },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const realmId = api.realmId;
            if (!realmId) {
                throw new Error(
                    'QuickBooks credential details require realmId on the api instance'
                );
            }
            return {
                identifiers: { externalId: String(realmId), userId },
                details: { realmId: String(realmId) },
            };
        },

        apiPropertiesToPersist: {
            // realmId arrives on the OAuth callback (not the token body) and is
            // required on every Accounting API path.
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'realmId',
            ],
            entity: ['realmId'],
        },

        testAuthRequest: async (api) => api.getCompanyInfo(),
    },
    env: {
        client_id: process.env.QUICKBOOKS_CLIENT_ID,
        client_secret: process.env.QUICKBOOKS_CLIENT_SECRET,
        scope: process.env.QUICKBOOKS_SCOPE || DEFAULT_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/quickbooks".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/quickbooks`
            : undefined,
        base_url: process.env.QUICKBOOKS_BASE_URL,
    },
};

module.exports = { Definition };
