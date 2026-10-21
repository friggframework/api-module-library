require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable organization identity for entity/credential linkage.
 *
 * Prefers the configured Organization-ID. Falls back to the first id from
 * OrgMapper LinkedOrgs. Display name is best-effort from GET /v1/organizations/{id}.
 */
async function resolveOrganizationIdentity(api) {
    let organizationId = api.organizationId ? String(api.organizationId) : null;

    if (!organizationId) {
        const linked = await api.listLinkedOrganizations();
        const orgs = linked?.organizations;
        if (Array.isArray(orgs) && orgs.length > 0) {
            organizationId = String(orgs[0]);
            api.setOrganizationId(organizationId);
        }
    }

    if (!organizationId) {
        throw new Error(
            'Dentrix Ascend: cannot derive a stable organization identity — set organization_id / DENTRIX_ASCEND_ORGANIZATION_ID or ensure LinkedOrgs returns at least one organization.'
        );
    }

    let name = `Ascend Organization ${organizationId}`;
    try {
        const res = await api.getOrganization(organizationId);
        const org = res?.data || res;
        if (org?.name) name = org.name;
    } catch {
        // Name is display-only; identity is the organization id.
    }

    return { externalId: organizationId, name, organizationId };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'DentrixAscend',
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
            const api =
                this.api ||
                new Api({
                    client_id: Definition.env.client_id,
                    client_secret: Definition.env.client_secret,
                    organization_id:
                        Definition.env.DENTRIX_ASCEND_ORGANIZATION_ID,
                    baseUrl: Definition.env.base_url,
                    api_host: Definition.env.DENTRIX_ASCEND_API_HOST,
                });
            return api.getAuthorizationRequirements();
        },

        /**
         * Client-credentials: mint a token from client_id/secret.
         * No authorization code is exchanged.
         */
        getToken: async function (api, params = {}) {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'client_id', null) ||
                get(data, 'client_id', null) ||
                api.client_id;
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(data, 'client_secret', null) ||
                api.client_secret;
            const organizationId =
                get(params, 'organization_id', null) ||
                get(params, 'organizationId', null) ||
                get(data, 'organization_id', null) ||
                get(data, 'organizationId', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (organizationId) api.setOrganizationId(organizationId);

            const tokenRes = await api.getTokenFromClientCredentials();
            if (!tokenRes?.access_token) {
                throw new Error(
                    'Dentrix Ascend: client_credentials token request failed'
                );
            }
            return tokenRes;
        },

        setAuthParams: async function (api, params = {}) {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'client_id', null) || get(data, 'client_id', null);
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(data, 'client_secret', null);
            const organizationId =
                get(params, 'organization_id', null) ||
                get(params, 'organizationId', null) ||
                get(data, 'organization_id', null) ||
                get(data, 'organizationId', null);
            const accessToken =
                get(params, 'access_token', null) ||
                get(data, 'access_token', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (organizationId) api.setOrganizationId(organizationId);
            if (accessToken) {
                await api.setTokens({
                    access_token: accessToken,
                    expires_in: get(params, 'expires_in', null),
                    token_type: get(params, 'token_type', 'Bearer'),
                });
            }
            return api;
        },

        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const identity = await resolveOrganizationIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    organizationId: identity.organizationId,
                },
            };
        },

        getCredentialDetails: async function (api, userId) {
            const identity = await resolveOrganizationIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { organizationId: identity.organizationId },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'expires_in',
                'token_type',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: ['organizationId'],
        },

        testAuthRequest: async function (api) {
            return api.testAuthRequest();
        },
    },
    env: {
        client_id: process.env.DENTRIX_ASCEND_CLIENT_ID,
        client_secret: process.env.DENTRIX_ASCEND_CLIENT_SECRET,
        // Official Public API client-credentials flow does not document scopes.
        // Kept for forward-compat if HS1 adds scoped grants later.
        scope: process.env.DENTRIX_ASCEND_SCOPE,
        base_url: process.env.DENTRIX_ASCEND_BASE_URL,
        // Custom env keys must be UPPER_SNAKE per api-module-definition.schema.json
        // patternProperties (snake_case customs are rejected by additionalProperties).
        DENTRIX_ASCEND_ORGANIZATION_ID:
            process.env.DENTRIX_ASCEND_ORGANIZATION_ID,
        DENTRIX_ASCEND_API_HOST: process.env.DENTRIX_ASCEND_API_HOST,
    },
};

module.exports = { Definition };
