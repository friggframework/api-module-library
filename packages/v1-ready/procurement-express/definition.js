require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * ProcurementExpress Definition — credential auth via authentication_token
 * (+ app_company_id). There is no OAuth redirect flow for the token-header
 * path documented for API access; tokens are issued from the PE account.
 *
 * Identity: GET /currentuser → prefer employer_id / selected company id,
 * else the user id.
 *
 * Docs: https://docs.procurementexpress.com/
 */
async function resolveAccountIdentity(api) {
    const user = await api.getCurrentUser();
    if (!user || user.id === undefined || user.id === null) {
        throw new Error(
            'ProcurementExpress: GET /currentuser returned no user id — cannot derive a stable entity identifier. Response: ' +
                JSON.stringify(user)
        );
    }

    const companies = Array.isArray(user.companies) ? user.companies : [];
    const companyId =
        api.companyId ||
        user.employer_id ||
        (companies[0] && companies[0].id) ||
        null;
    const company =
        companies.find((c) => String(c.id) === String(companyId)) ||
        companies[0] ||
        null;

    // Prefer company-scoped identity when available (multi-company users).
    const externalId = companyId
        ? `company:${companyId}`
        : `user:${user.id}`;
    const name =
        (company && company.name) ||
        user.name ||
        user.email ||
        'ProcurementExpress';

    return {
        externalId: String(externalId),
        name,
        userId: user.id,
        email: user.email,
        companyId,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ProcurementExpress',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'ProcurementExpress Authentication',
                    type: 'object',
                    required: ['authenticationToken'],
                    properties: {
                        authenticationToken: {
                            type: 'string',
                            title: 'Authentication Token',
                        },
                        companyId: {
                            type: 'string',
                            title: 'Company ID',
                            description:
                                'Active employer / company id sent as the app_company_id header.',
                        },
                    },
                },
                uiSchema: {
                    authenticationToken: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Token from your ProcurementExpress account. Sent as the authentication_token header on every request.',
                    },
                    companyId: {
                        'ui:help':
                            'Optional but recommended for multi-company accounts. Sent as app_company_id.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const authenticationToken =
                get(params, 'authenticationToken', null) ||
                get(params, 'authentication_token', null) ||
                get(params, 'access_token', null) ||
                get(data, 'authenticationToken', null) ||
                get(data, 'authentication_token', null) ||
                get(data, 'access_token', null);
            const companyId =
                get(params, 'companyId', null) ||
                get(params, 'company_id', null) ||
                get(params, 'employer_id', null) ||
                get(data, 'companyId', null) ||
                get(data, 'company_id', null) ||
                get(data, 'employer_id', null);
            api.setAuth({ authenticationToken, companyId });
            return api;
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            if (callbackParams?.companyId) {
                api.setCompany(callbackParams.companyId);
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
                    companyId: identity.companyId,
                },
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
            credential: ['authenticationToken', 'companyId'],
            entity: ['companyId'],
        },
        testAuthRequest: async (api) => {
            return api.getCurrentUser();
        },
    },
    env: {
        authenticationToken:
            process.env.PROCUREMENT_EXPRESS_AUTHENTICATION_TOKEN,
        companyId: process.env.PROCUREMENT_EXPRESS_COMPANY_ID,
        base_url:
            process.env.PROCUREMENT_EXPRESS_BASE_URL ||
            'https://app.procurementexpress.com/api/v1',
    },
};

module.exports = { Definition };
