require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * JobTread is grant-key authenticated (Pave body `query.$.grantKey`). There is
 * no OAuth flow. Identity comes from `currentGrant.organization` when present.
 *
 * When the grant has no organization (or the call fails) we fall back to a
 * sha256 fingerprint of the grant key — a stable, non-reversible,
 * per-credential identifier. There is deliberately NO shared constant fallback.
 */
const keyFingerprint = (grantKey) =>
    crypto.createHash('sha256').update(String(grantKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.getCurrentGrant();
        const grant = result?.currentGrant;
        const org = grant?.organization;
        if (org?.id) {
            return {
                externalId: org.id,
                name: org.name || grant.name || 'JobTread',
            };
        }
        if (grant?.id) {
            return {
                externalId: grant.id,
                name: grant.name || grant.user?.name || 'JobTread',
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const grantKey = api?.grant_key || api?.api_key;
    if (!grantKey) {
        throw new Error(
            'JobTread: cannot derive a stable account identity — no grant organization/id and no grant key to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(grantKey), name: 'JobTread' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'JobTread',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'JobTread Authentication',
                    type: 'object',
                    required: ['grant_key'],
                    properties: {
                        grant_key: {
                            type: 'string',
                            title: 'Grant Key',
                        },
                    },
                },
                uiSchema: {
                    grant_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a grant under Settings → Integrations → API → Grants. The key is shown once. Sent in the Pave body as query.$.grantKey. Keys expire after 3 months of inactivity.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const grantKey =
                get(params, 'grant_key', null) ||
                get(params, 'api_key', null) ||
                get(params, 'access_token', null);
            api.setGrantKey(grantKey);
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
            credential: ['grant_key'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getCurrentGrant();
        },
    },
    env: {
        grant_key: process.env.JOBTREAD_GRANT_KEY,
    },
};

module.exports = { Definition };
