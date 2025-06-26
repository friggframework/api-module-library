require('dotenv').config();
const {Api} = require('./api');
const {get} = require("@friggframework/core");
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: function () {
        return config.name
    },
    moduleName: config.name,
    modelName: 'AWSS3',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const buckets = await api.listBuckets();
            const firstBucket = buckets.Buckets?.[0];
            return {
                identifiers: {externalId: firstBucket?.Name || 's3-account', user: userId},
                details: {name: 'AWS S3 Account', bucketCount: buckets.Buckets?.length || 0},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const buckets = await api.listBuckets();
            return {
                identifiers: {externalId: 's3-account', user: userId},
                details: {bucketCount: buckets.Buckets?.length || 0}
            };
        },
        testAuthRequest: async function (api) {
            return api.listBuckets()
        },
    },
    env: {
        client_id: process.env.AWS_S3_CLIENT_ID,
        client_secret: process.env.AWS_S3_CLIENT_SECRET,
        scope: process.env.AWS_S3_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/aws-s3`,
    }
};

module.exports = {Definition};