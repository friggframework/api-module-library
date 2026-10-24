require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Outreach documents that GET /api/v2 returns org-related attributes for the
 * authenticated token, but does not publish a field-level schema for that
 * response. We probe a small set of commonly observed keys and fall back to a
 * stable, non-reversible fingerprint of the access token so two customers never
 * collide. Exact field names are listed as an open question in the PR.
 */
function pickOrgIdentity(root) {
    if (!root || typeof root !== 'object') return null;
    const meta = root.meta || {};
    const attrs =
        (root.data && root.data.attributes) || root.attributes || {};

    const externalId =
        meta.orgGuid ||
        meta.org_guid ||
        meta.orgUuid ||
        meta.org_uuid ||
        meta.organizationGuid ||
        attrs.orgGuid ||
        attrs.org_guid ||
        attrs.orgUuid ||
        (meta.org && (meta.org.id || meta.org.guid)) ||
        null;

    const name =
        meta.orgName ||
        meta.org_name ||
        attrs.orgName ||
        attrs.org_name ||
        attrs.name ||
        (meta.org && meta.org.name) ||
        null;

    if (!externalId) return null;
    return {
        externalId: String(externalId),
        name: name ? String(name) : 'Outreach',
    };
}

const tokenFingerprint = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const root = await api.getApiRoot();
        const fromRoot = pickOrgIdentity(root);
        if (fromRoot) return fromRoot;
    } catch (_e) {
        // fall through
    }

    const token = api?.access_token;
    if (!token) {
        throw new Error(
            'Outreach: cannot derive a stable account identity — root API returned no org id and no access token is available to fingerprint.'
        );
    }
    return {
        externalId: tokenFingerprint(token),
        name: 'Outreach',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Outreach',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'Outreach OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
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
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'webhook_secret',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => api.getApiRoot(),
    },
    env: {
        client_id: process.env.OUTREACH_CLIENT_ID,
        client_secret: process.env.OUTREACH_CLIENT_SECRET,
        scope: process.env.OUTREACH_SCOPE || process.env.OUTREACH_SCOPES,
        // Omit when unset so schema validation does not see the string "undefined/outreach".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/outreach`
            : undefined,
    },
};

module.exports = { Definition, resolveAccountIdentity, pickOrgIdentity };
