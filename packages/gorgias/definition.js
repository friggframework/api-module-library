const { IntegrationBase, ModuleConstants, debug } = require('@friggframework/core');
const _ = require('lodash');
const { Api } = require('./api');
const { Entity } = require('./models/entity');
const { Credential } = require('./models/credential');
const Config = require('./defaultConfig.json');

class GorgiasIntegration extends IntegrationBase {
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
            url: this.api.getAuthUri(),
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['subdomain'],
                    properties: {
                        subdomain: {
                            type: 'string',
                            title: 'Subdomain',
                        },
                    },
                },
                uiSchema: {
                    subdomain: {
                        'ui:help': 'The Subdomain for your Application login.',
                        'ui:placeholder': '{{subdomain}}.gorgias.com',
                    },
                },
            },
        };
    }

    async processAuthorizationCallback(params) {
        const code = _.get(params.data, 'code');
        this.api.setSubdomain(_.get(params.data, 'subdomain'));

        await this.getAccessToken(code);

        await this.testAuth();

        await this.findOrCreateEntity({
            subdomain: this.api.subdomain,
        });

        return {
            entity_id: this.entity.id,
            credential_id: this.credential.id,
            type: Config.name,
        };
    }

    async testAuth() {
        let validAuth = false;
        try {
            if (await this.api.getAccountDetails()) validAuth = true;
        } catch (e) {
            debug(e);
        }
        return validAuth;
    }

    async deauthorize() {
        // wipe api connection
        this.api = new Api();

        // delete credentials from the database
        const entity = await this.entityMO.getByUserId(this.userId);
        if (entity.credential) {
            await this.credentialMO.delete(entity.credential);
            entity.credential = undefined;
            await entity.save();
        }
        this.credential = undefined;
    }

    async getAccessToken(code) {
        return this.api.getTokenFromCodeBasicAuthHeader(code);
    }

    async findOrCreateEntity(params) {
        const domainName = _.get(params, 'subdomain');

        const search = await this.entityMO.list({
            user: this.userId,
            externalId: domainName,
        });
        if (search.length === 0) {
            const createObj = {
                credential: this.credential.id,
                user: this.userId,
                name: domainName,
                externalId: domainName,
            };
            this.entity = await this.entityMO.create(createObj);
        } else if (search.length === 1) {
            this.entity = search[0];
        } else {
            debug(
                'Multiple entities found with the same subdomain:',
                domainName
            );
            throw new Error(
                `Multiple entities found with the same subdomain: ${domainName}`
            );
        }
    }

    async receiveNotification(notifier, delegateString, object = null) {
        if (notifier instanceof Api) {
            if (delegateString === this.api.DLGT_TOKEN_UPDATE) {
                debug(`should update the token: ${object}`);
                const updatedToken = {
                    user: this.userId,
                    accessToken: this.api.access_token,
                    refreshToken: this.api.refresh_token,
                    accessTokenExpire: this.api.accessTokenExpire,
                    subdomain: this.api.subdomain,
                    apiKey: this.api.apiKey,
                    apiUserEmail: this.api.apiUserEmail,
                    auth_is_valid: true,
                };

                if (!this.credential) {
                    let credentialSearch = await this.credentialMO.list({
                        subdomain: this.api.subdomain,
                    });
                    if (credentialSearch.length === 0) {
                        this.credential = await this.credentialMO.create(
                            updatedToken
                        );
                    } else if (credentialSearch.length === 1) {
                        if (
                            credentialSearch[0].user.toString() === this.userId
                        ) {
                            this.credential = await this.credentialMO.update(
                                credentialSearch[0],
                                updatedToken
                            );
                        } else {
                            debug(
                                `Somebody else already created a credential with the same domain: ${this.api.subdomain}`
                            );
                        }
                    } else {
                        // Handling multiple credentials found with an error for the time being
                        let message = `Multiple credentials found with the same account: ${this.api.subdomain}`;
                        debug(message);
                        throw new Error(message);
                    }
                } else {
                    this.credential = await this.credentialMO.update(
                        this.credential,
                        updatedToken
                    );
                }
            }
            if (delegateString === this.api.DLGT_TOKEN_DEAUTHORIZED) {
                await this.deauthorize();
            }
            if (delegateString === this.api.DLGT_INVALID_AUTH) {
                await this.markCredentialsInvalid();
            }
        }
    }
}

module.exports = GorgiasIntegration;