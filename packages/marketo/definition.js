const { IntegrationBase, ModuleConstants } = require('@friggframework/core');
const { Api } = require('./api.js');
const { Entity } = require('./entity');
const { Credential } = require('./credential.js');
const Config = require('./defaultConfig.json');

class MarketoIntegration extends IntegrationBase {
    static Definition = {
        name: Config.name,
        version: '1.0.0',
        modules: { Api, Entity, Credential },
        display: {
            label: Config.label,
            description: Config.description,
            category: Config.categories[0],
            iconUrl: Config.logoUrl,
            detailsUrl: Config.productUrl,
        },
    };

    static Entity = Entity;
    static Credential = Credential;

    async getAuthorizationRequirements(params) {
        return {
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Authorization Credentials',
                    description: 'A simple form example.',
                    type: 'object',
                    required: ['munchkin_id', 'services'],
                    properties: {
                        munchkin_id: {
                            type: 'string',
                            title: 'Please enter your Munchkin ID.',
                        },
                        services: {
                            type: 'array',
                            title: 'Services',
                            items: {
                                type: 'object',
                                properties: {
                                    name: {
                                        type: 'string',
                                        title: 'Please enter the name of the service.',
                                    },
                                    client_id: {
                                        type: 'string',
                                        title: 'Please enter the client_id for the service.',
                                    },
                                    client_secret: {
                                        type: 'string',
                                        title: 'Please enter the client_secret for the service.',
                                    },
                                },
                                required: [
                                    'name',
                                    'client_id',
                                    'client_secret',
                                ],
                            },
                        },
                    },
                },
                uiSchema: {
                    'ui:order': ['munchkin_id', 'services'],
                    munchkin_id: {
                        'ui:help': 'The Munchkin ID for the Marketo account',
                    },
                    services: {
                        'ui:help': 'Please add 1 or more services',
                    },
                },
            },
        };
    }

    async processAuthorizationCallback(params) {
        const { munchkin_id, services } = params.data;
        const created = [];

        for (const service of services) {
            const { service_name, client_id, client_secret } = service;

            const credential = await this.credentialMO.upsert(
                {
                    user: this.userId,
                    client_id,
                },
                {
                    client_secret,
                }
            );

            const entity = await this.entityMO.upsert(
                {
                    munchkin_id,
                    externalId: client_id,
                    user: this.userId,
                },
                {
                    name: service_name,
                    credential: credential._id,
                }
            );

            created.push({ entity, credential });
        }

        // TODO how to pick one?
        const { entity, credential } = created[0];

        this.api.munchkin_id = entity.munchkin_id;
        this.api.client_id = credential.client_id;
        this.api.client_secret = credential.client_secret;

        // testAuth to confirm valid credentials
        await this.testAuth();

        return {
            type: Config.name,
            entity_id: entity._id,
            credential_id: credential._id,
        };
    }

    async testAuth() {
        await this.api.refreshAuth();

        const response = await this.api.describeLeads();

        if (this.api.checkExpired(response)) {
            throw new Error('Not authenticated to Marketo');
        }
    }

    async deauthorize() {
        // Wipe API connection
        this.api = new Api();

        // delete credentials from the database
        const entity = await this.entityMO.getByUserId(this.userId);

        if (entity.credential) {
            await this.credentialMO.delete(entity.credential);
            entity.credential = undefined;
            await entity.save();
        }
    }

    async receiveNotification(notifier, delegateString, object = null) {
        if (!(notifier instanceof Api)) return;

        if (delegateString === this.api.DLGT_TOKEN_DEAUTHORIZED) {
            await this.deauthorize();
        } else if (delegateString === this.api.DLGT_INVALID_AUTH) {
            const credentials = await this.credentialMO.list({
                user: this.userId,
            });
            if (credentials.length === 1) {
                return (this.credential = this.credentialMO.update(
                    credentials[0]._id,
                    { auth_is_valid: false }
                ));
            }
            if (credentials.length > 1) {
                throw new Error('User has multiple credentials???');
            } else if (credentials.length === 0) {
                throw new Error(
                    'How are we marking nonexistant credentials invalid???'
                );
            }
        }
    }
}

module.exports = MarketoIntegration;