require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * HiBob service-user auth has no dedicated "/me" identity endpoint. Entity
 * identity is Bob's numeric `companyId` (present on People search responses and
 * every webhook v2 payload). When the company has no employees yet and no
 * company_id was supplied at auth time, we fall back to a sha256 fingerprint of
 * the service user id — stable and non-colliding across customers, but webhook
 * tenant routing then requires company_id to be set explicitly.
 */
const keyFingerprint = (serviceUserId) =>
    crypto.createHash('sha256').update(String(serviceUserId)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const companyId = await api.resolveCompanyId();
        if (companyId) {
            return {
                externalId: String(companyId),
                name: `HiBob ${companyId}`,
            };
        }
    } catch (_e) {
        // fall through to service-user fingerprint
    }

    const serviceUserId = api?.service_user_id || api?.username;
    if (!serviceUserId) {
        throw new Error(
            'HiBob: cannot derive a stable account identity — no companyId from People search and no service_user_id to fingerprint. Pass company_id at auth time or ensure the service user can search people.'
        );
    }
    return {
        externalId: keyFingerprint(serviceUserId),
        name: 'HiBob',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'HiBob',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const serviceUserId =
                get(params, 'service_user_id', null) ||
                get(params, 'serviceUserId', null) ||
                get(data, 'service_user_id', null) ||
                get(data, 'serviceUserId', null);
            const serviceUserToken =
                get(params, 'service_user_token', null) ||
                get(params, 'serviceUserToken', null) ||
                get(params, 'token', null) ||
                get(data, 'service_user_token', null) ||
                get(data, 'serviceUserToken', null) ||
                get(data, 'token', null);
            const companyId =
                get(params, 'company_id', null) ||
                get(params, 'companyId', null) ||
                get(data, 'company_id', null) ||
                get(data, 'companyId', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(data, 'base_url', null) ||
                get(data, 'baseUrl', null);

            if (serviceUserId) {
                api.service_user_id = serviceUserId;
                api.username = serviceUserId;
            }
            if (serviceUserToken) {
                api.service_user_token = serviceUserToken;
                api.password = serviceUserToken;
            }
            if (companyId !== undefined && companyId !== null && companyId !== '') {
                api.company_id = String(companyId);
            }
            if (baseUrl) {
                api.baseUrl = baseUrl;
            }
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'service_user_id',
                'service_user_token',
                'company_id',
                'baseUrl',
            ],
            entity: ['company_id'],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        service_user_id: process.env.HIBOB_SERVICE_USER_ID,
        service_user_token: process.env.HIBOB_SERVICE_USER_TOKEN,
        company_id: process.env.HIBOB_COMPANY_ID,
        base_url: process.env.HIBOB_BASE_URL,
    },
};

module.exports = { Definition };
