require('dotenv').config();
const {Api} = require('./api.js');
const {get} = require('@friggframework/core');
const {Definition} = require('@friggframework/core/module-plugin/definition');
const config = require('./defaultConfig.json');

const ClydeDefinition = class extends Definition {
    constructor(params) {
        super(params);
        this.API = Api;
        this.moduleName = config.name;
        this.requiredAuthMethods = {
            getToken: async function(api, params) {
                const clientKey = params.data.clientKey;
                const secret = params.data.secret;
                
                // Store credentials directly for basic auth
                return {
                    clientKey: params.data.clientKey,
                    secret: params.data.secret
                };
            },
            getEntityDetails: async function(api, callbackParams, tokenResponse, userId) {
                
                return {
                    identifiers: {externalId: tokenResponse.clientKey || 'default', user: userId},
                    details: {name: tokenResponse.clientKey || 'Default'}
                };
            },
            getCredentialDetails: async function(api, userId) {
                return {
                    identifiers: {externalId: api.clientKey || 'default', user: userId},
                    details: {}
                };
            },
            apiPropertiesToPersist: {
                credential: ['clientKey', 'secret'],
                entity: []
            },
            testAuthRequest: async function(api) {
                return await api.listProducts();
            }
        };
    }

    getName() {
        return config.name;
    }

    async getAuthorizationRequirements(params) {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['clientKey', 'secret'],
                    properties: {
                        clientKey: {
                            type: 'string',
                            title: 'Client Key',
                        },
                        secret: {
                            type: 'string',
                            title: 'Secret',
                        },
                    },
                },
                uiSchema: {
                    clientKey: {
                        'ui:help':
                            'To obtain your Client Key and Secret, log in and head to settings. You can find your Keys in the "Developers" section.',
                        'ui:placeholder': 'Client Key',
                    },
                    secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Your secret is obtained along with your Client Key',
                        'ui:placeholder': 'secret',
                    },
                },
            },
        };
}
};

module.exports = {Definition: ClydeDefinition};
