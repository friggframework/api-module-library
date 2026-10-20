require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Terminus Account Lists is API-key authenticated (Authorization: Bearer).
 * There is no dedicated "/me" identity endpoint on the verified Account Lists
 * surface, so identity is derived from the first folder's `orgUuid` when the
 * list call succeeds. When no folder is available (empty list or API error)
 * we fall back to a sha256 fingerprint of the raw API key — stable,
 * non-reversible, per-credential. No shared constant fallback.
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.listFolders();
        const first = Array.isArray(result?.folders) ? result.folders[0] : null;
        if (first?.orgUuid) {
            return {
                externalId: first.orgUuid,
                name: first.name || first.orgUuid,
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const apiKey = api?.api_token || api?.api_key;
    if (!apiKey) {
        throw new Error(
            'Terminus: cannot derive a stable account identity — no orgUuid from folders and no API key to fingerprint.'
        );
    }
    // Prefer the raw token when present so "Bearer …" is never hashed.
    const raw = String(api.api_token || apiKey).replace(/^Bearer\s+/i, '');
    return { externalId: keyFingerprint(raw), name: 'Terminus' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Terminus',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Terminus Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'API key for the Terminus / DemandScience ABM Platform Account Lists API (issued by your CSM or Onboarding Specialist). Sent as Authorization: Bearer <key>.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'api_token', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            api.setApiKey(apiKey);
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
            // Raw token only — Authorization header value is rebuilt as Bearer.
            credential: ['api_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.TERMINUS_API_KEY,
    },
};

module.exports = { Definition };
