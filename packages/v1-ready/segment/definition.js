require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Segment Public API is bearer-token authenticated (workspace token).
 * Profile API uses a separate per-space token (HTTP Basic) — optional for
 * modules that only need Public API reads.
 *
 * Identity comes from GET / (getWorkspace) → data.workspace.id. If that call
 * fails we fall back to a sha256 fingerprint of the Public API token so two
 * customers never collide (same pattern as fathom/gong/otter).
 */
const keyFingerprint = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.getWorkspace();
        const workspace = result?.data?.workspace || result?.workspace;
        if (workspace?.id) {
            return {
                externalId: workspace.id,
                name: workspace.name || workspace.slug || workspace.id,
            };
        }
    } catch (e) {
        // fall through to token fingerprint
    }

    const token = api?.access_token || api?.public_api_token || api?.api_key;
    if (!token) {
        throw new Error(
            'Segment: cannot derive a stable account identity — getWorkspace failed and no Public API token is available to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(token), name: 'Segment' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Segment',
    // ADR-057: mappings live on extensions.mapping (see index.js).
    mappings: { business: 'extensions.mapping' },
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Segment Authentication',
                    type: 'object',
                    required: ['access_token'],
                    properties: {
                        access_token: {
                            type: 'string',
                            title: 'Public API Token',
                        },
                        profile_api_token: {
                            type: 'string',
                            title: 'Profile API Token (optional)',
                        },
                        space_id: {
                            type: 'string',
                            title: 'Unify Space ID (optional, required for Profile API)',
                        },
                    },
                },
                uiSchema: {
                    access_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Workspace Public API token from Settings → Access Management → Tokens. Sent as Authorization: Bearer. Docs: https://docs.segmentapis.com/tag/Authentication/',
                    },
                    profile_api_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Unify Profile API access token (HTTP Basic username, empty password) from Unify → Unify settings → API access. Docs: https://www.twilio.com/docs/segment/unify/profile-api',
                    },
                    space_id: {
                        'ui:help':
                            'Unify space id used in Profile API paths: /v1/spaces/{space_id}/...',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const accessToken =
                get(params, 'access_token', null) ||
                get(params, 'public_api_token', null) ||
                get(params, 'api_key', null) ||
                get(data, 'access_token', null) ||
                get(data, 'public_api_token', null);
            if (accessToken) {
                api.setPublicApiToken(accessToken);
            }

            const profileToken =
                get(params, 'profile_api_token', null) ||
                get(data, 'profile_api_token', null);
            const spaceId =
                get(params, 'space_id', null) || get(data, 'space_id', null);
            api.setProfileAuth({
                profile_api_token: profileToken,
                space_id: spaceId,
            });
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    space_id: api.space_id || undefined,
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
            credential: [
                'access_token',
                'profile_api_token',
                'space_id',
            ],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getWorkspace();
        },
    },
    env: {
        access_token: process.env.SEGMENT_PUBLIC_API_TOKEN,
        profile_api_token: process.env.SEGMENT_PROFILE_API_TOKEN,
        space_id: process.env.SEGMENT_SPACE_ID,
        public_api_base_url: process.env.SEGMENT_PUBLIC_API_BASE_URL,
        profile_api_base_url: process.env.SEGMENT_PROFILE_API_BASE_URL,
        webhook_shared_secret: process.env.SEGMENT_WEBHOOK_SHARED_SECRET,
    },
};

module.exports = { Definition };
