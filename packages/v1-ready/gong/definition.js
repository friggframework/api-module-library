require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

// Gong issues a static Access Key + Secret (Basic auth, no OAuth), so there is
// no external account id returned at auth time. We derive a stable,
// non-reversible identifier from the access key so the same credentials always
// map to the same entity/credential.
const keyFingerprint = (accessKey) =>
    crypto.createHash('sha256').update(String(accessKey)).digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Gong',
    requiredAuthMethods: {
        setAuthParams: async function (api, params) {},
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.access_key || api.username),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_key', 'access_key_secret'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.access_key || api.username),
                    userId,
                },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        access_key: process.env.GONG_ACCESS_KEY,
        access_key_secret: process.env.GONG_ACCESS_KEY_SECRET,
        base_url: process.env.GONG_BASE_URL,
    },
};

module.exports = { Definition };
