const { Api } = require('./api');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    requiredAuthMethods: {
        getAuthorizationRequirements: async function () {
            return {
                type: 'api_key',
                fields: [
                    {
                        key: 'apiKey',
                        label: 'API Key',
                        placeholder: 'Enter your Fathom API key',
                        type: 'password',
                        required: true,
                        helpText: 'You can find your API key in Fathom settings under API Access'
                    }
                ]
            };
        },
        
        setAuthParams: async function (api, params) {
            api.apiKey = params.apiKey;
            api.access_token = params.apiKey;
        },
        
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const teams = await api.listTeams();
            const primaryTeam = teams && teams.data && teams.data[0];
            
            return {
                identifiers: { externalId: primaryTeam ? primaryTeam.id : 'default' },
                details: { 
                    name: primaryTeam ? primaryTeam.name : 'Fathom User',
                    team: primaryTeam 
                },
            };
        },
        
        apiPropertiesToPersist: {
            credential: ['apiKey'],
            entity: [],
        },
        
        getCredentialDetails: async function (api, userId) {
            const teams = await api.listTeams();
            const primaryTeam = teams && teams.data && teams.data[0];
            
            return {
                identifiers: { externalId: primaryTeam ? primaryTeam.id : 'default' },
                details: { 
                    authenticated: true,
                    teamName: primaryTeam ? primaryTeam.name : 'Unknown'
                },
            };
        },
        
        testAuthRequest: async function (api) {
            try {
                const response = await api.listTeams();
                return response && (response.data !== undefined);
            } catch (error) {
                if (error.message && error.message.includes('401')) {
                    throw new Error('Invalid API key');
                }
                throw error;
            }
        },
    },
    env: {
        apiKey: process.env.FATHOM_API_KEY,
    }
};

module.exports = { Definition };