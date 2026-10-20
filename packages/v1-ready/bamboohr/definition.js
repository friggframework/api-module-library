require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * BambooHR is API-key authenticated (HTTP Basic). There is no OAuth identity
 * endpoint on the Basic-auth path used here, so account identity is derived
 * from GET /company_information (`domain` + display/legal name).
 *
 * When company information is unavailable we fall back to a sha256 fingerprint
 * of `companyDomain:api_key` — stable, non-reversible, per-credential — so two
 * customers never collide. Mirrors the gong/fathom modules.
 */
const credentialFingerprint = (companyDomain, apiKey) =>
    crypto
        .createHash('sha256')
        .update(`${String(companyDomain || '')}:${String(apiKey || '')}`)
        .digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const info = await api.getCompanyInformation();
        const domain = info?.domain || api.companyDomain;
        if (domain) {
            return {
                externalId: String(domain),
                name:
                    info?.displayName ||
                    info?.legalName ||
                    String(domain),
            };
        }
    } catch (e) {
        // fall through to fingerprint
    }

    if (api.companyDomain) {
        return {
            externalId: String(api.companyDomain),
            name: String(api.companyDomain),
        };
    }

    const apiKey = api?.api_key || api?.username;
    if (!apiKey) {
        throw new Error(
            'BambooHR: cannot derive a stable account identity — no company domain/information and no API key to fingerprint.'
        );
    }
    return {
        externalId: credentialFingerprint(api.companyDomain, apiKey),
        name: 'BambooHR',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'BambooHR',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null) ||
                get(params, 'access_token', null) ||
                process.env.BAMBOOHR_API_KEY ||
                null;
            const companyDomain =
                get(params, 'companyDomain', null) ||
                get(params, 'company_domain', null) ||
                get(data, 'companyDomain', null) ||
                get(data, 'company_domain', null) ||
                process.env.BAMBOOHR_COMPANY_DOMAIN ||
                null;
            const apiPassword =
                get(params, 'api_password', null) ||
                get(data, 'api_password', null) ||
                get(params, 'password', null) ||
                process.env.BAMBOOHR_API_PASSWORD ||
                'x';

            if (apiKey) {
                api.setApiKey(apiKey);
            }
            if (companyDomain) {
                api.setCompanyDomain(companyDomain);
            }
            api.api_password = apiPassword;
            api.password = apiPassword;
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    companyDomain: api.companyDomain || identity.externalId,
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
            credential: ['api_key', 'api_password', 'companyDomain'],
            entity: ['companyDomain'],
        },

        testAuthRequest: async (api) => {
            return api.getCompanyInformation();
        },
    },
    // Only schema-allowlisted env keys (api-module-definition.schema.json):
    // client_id/secret/scope/redirect_uri/api_key/base_url, or UPPER_SNAKE.
    // companyDomain + api_password are collected via the auth form /
    // setAuthParams (and BAMBOOHR_* process.env fallbacks there).
    env: {
        api_key: process.env.BAMBOOHR_API_KEY,
    },
};

module.exports = { Definition };
