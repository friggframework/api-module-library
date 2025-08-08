require('dotenv').config();
const {Api} = require('./api.js');
const {get} = require('@friggframework/core');
const {Definition} = require('@friggframework/core/module-plugin/definition');
const config = require('./defaultConfig.json');

const FastspringIqDefinition = class extends Definition {
    constructor(params) {
        super(params);
        this.API = Api;
        this.moduleName = config.name;
        this.requiredAuthMethods = {
            getToken: async function(api, params) {
                
                
                // Store credentials directly for basic auth
                return {
                    
                };
            },
            getEntityDetails: async function(api, callbackParams, tokenResponse, userId) {
                
                const userDetails = await api.getUserDetails();
                return {
                    identifiers: {externalId: userDetails.id, user: userId},
                    details: {name: userDetails.name || userDetails.email}
                };
            },
            getCredentialDetails: async function(api, userId) {
                return {
                    identifiers: {externalId: api.undefined || 'default', user: userId},
                    details: {}
                };
            },
            apiPropertiesToPersist: {
                credential: [],
                entity: []
            },
            testAuthRequest: async function(api) {
                return await api.getOrganizationDetails();
            }
        };
    }

    getName() {
        return config.name;
    }

    async getAuthorizationRequirements(params) {
        return {
            url: this.api.getAuthorizationUri(),
            type: 'oauth2',
        };
}
};

module.exports = {Definition: FastspringIqDefinition};
