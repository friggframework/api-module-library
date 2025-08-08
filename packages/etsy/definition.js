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
    modelName: 'Etsy',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            
            if (!code) {
                throw new Error('Missing authorization code for Etsy OAuth');
            }
            
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userProfile = await api.getUserProfile();
            const user = await api.getUser();
            
            return {
                identifiers: {externalId: user.user_id.toString(), user: userId},
                details: {
                    name: userProfile.first_name && userProfile.last_name 
                        ? `${userProfile.first_name} ${userProfile.last_name}` 
                        : user.login_name,
                    login_name: user.login_name,
                    user_id: user.user_id,
                    email: userProfile.email || '',
                    bio: userProfile.bio || '',
                    location: userProfile.location || '',
                    image_url_75x75: userProfile.image_url_75x75 || '',
                    profile_url: `https://www.etsy.com/people/${user.login_name}`
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token', 'token_type', 'expires_in'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const user = await api.getUser();
            const userProfile = await api.getUserProfile();
            
            return {
                identifiers: {externalId: user.user_id.toString(), user: userId},
                details: {
                    name: userProfile.first_name && userProfile.last_name 
                        ? `${userProfile.first_name} ${userProfile.last_name}` 
                        : user.login_name,
                    login_name: user.login_name,
                    user_id: user.user_id
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.ping()
        },
    },
    env: {
        client_id: process.env.ETSY_CLIENT_ID,
        client_secret: process.env.ETSY_CLIENT_SECRET,
        scope: process.env.ETSY_SCOPE || 'email_r profile_r shops_r listings_r',
        redirect_uri: `${process.env.REDIRECT_URI}/etsy`,
    }
};

module.exports = {Definition};