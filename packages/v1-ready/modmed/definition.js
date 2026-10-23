require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * ModMed Certified FHIR R4 — OAuth 2.0 SMART authorization_code.
 *
 * Identity resolution:
 *   1. GET the resource named by the token `fhirUser` claim (when present)
 *   2. Else first Practitioner from a search
 *   3. Else the practice `fhir_base` URL itself (stable per practice)
 *
 * There is deliberately NO shared constant fallback across practices.
 *
 * Docs: https://portal.api.modmed.com/reference/authentication-2
 */
function practitionerDisplayName(resource) {
    if (!resource || typeof resource !== 'object') return null;
    const name = Array.isArray(resource.name) ? resource.name[0] : resource.name;
    if (!name) return null;
    if (name.text) return String(name.text);
    const parts = [...(name.given || []), name.family].filter(Boolean);
    return parts.length ? parts.join(' ') : null;
}

async function resolveAccountIdentity(api) {
    try {
        const user = await api.getCurrentUser();
        if (user?.id) {
            return {
                externalId: String(user.id),
                name:
                    practitionerDisplayName(user) ||
                    user.resourceType ||
                    String(user.id),
            };
        }
    } catch (e) {
        // fall through
    }

    const fhirBase = api.fhir_base || api.baseUrl;
    if (!fhirBase) {
        throw new Error(
            'ModMed: cannot derive a stable account identity — no fhirUser/Practitioner and no fhir_base.'
        );
    }
    return {
        externalId: String(fhirBase),
        name: String(fhirBase),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ModMed',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (api) {
            const client =
                api ||
                new Api({
                    client_id: Definition.env.client_id,
                    client_secret: Definition.env.client_secret,
                    redirect_uri: Definition.env.redirect_uri,
                    scope: Definition.env.scope,
                    fhir_base: Definition.env.base_url,
                });
            return client.getAuthorizationRequirements();
        },

        getToken: async function (api, params) {
            const data = (params && params.data) || params || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            const fhirBase =
                get(data, 'fhir_base', null) ||
                get(params, 'fhir_base', null) ||
                get(data, 'tenant', null) ||
                get(params, 'tenant', null);
            if (fhirBase) {
                api.setFhirBase(fhirBase);
            }
            if (!code) {
                throw new Error('Authorization code is required');
            }
            return api.getTokenFromCode(code);
        },

        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const fhirBase =
                get(params, 'fhir_base', null) ||
                get(data, 'fhir_base', null) ||
                get(params, 'tenant', null) ||
                get(data, 'tenant', null);
            if (fhirBase) {
                api.setFhirBase(fhirBase);
            }
            if (params.access_token || params.refresh_token) {
                await api.setTokens(params);
            }
            if (params.fhirUser) {
                api.fhirUser = params.fhirUser;
            }
            return params;
        },

        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            if (tokenResponse?.fhirUser) {
                api.fhirUser = tokenResponse.fhirUser;
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    fhir_base: api.fhir_base || api.baseUrl,
                    tenant: api.tenant || api.fhir_base || api.baseUrl,
                },
            };
        },

        getCredentialDetails: async function (api, userId) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    fhir_base: api.fhir_base || api.baseUrl,
                    tenant: api.tenant || api.fhir_base || api.baseUrl,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'fhir_base',
                'tenant',
                'fhirUser',
            ],
            entity: [],
        },

        testAuthRequest: async function (api) {
            return api.getMetadata();
        },
    },
    env: {
        client_id: process.env.MODMED_CLIENT_ID,
        client_secret: process.env.MODMED_CLIENT_SECRET,
        scope:
            process.env.MODMED_SCOPE ||
            'openid fhirUser offline_access launch/patient patient/*.read user/*.read user/*.write',
        redirect_uri:
            process.env.MODMED_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/modmed`
                : undefined),
        // Practice FHIR R4 base (= OAuth aud). Schema key is base_url.
        base_url:
            process.env.MODMED_FHIR_BASE ||
            'https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4',
    },
};

module.exports = { Definition };
