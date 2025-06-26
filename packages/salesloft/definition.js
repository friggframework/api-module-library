const { IntegrationBase, ModuleConstants } = require('@friggframework/core');
const _ = require('lodash');
const { Api } = require('./api.js');
const { Entity } = require('./models/entity');
const { Credential } = require('./models/credential');
const Config = require('./defaultConfig.json');

class SalesloftIntegration extends IntegrationBase {
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
            url: await this.api.authorizationUri,
            type: ModuleConstants.authType.oauth2,
        };
    }

    async processAuthorizationCallback(params) {
        const code = _.get(params.data, 'code');
        const response = await this.api.getTokenFromCode(code);

        const credentials = await this.credentialMO.list({ user: this.userId });
        const entitySearch = await this.entityMO.list({ user: this.userId });
        let entity;

        await this.testAuth();

        const teamDetails = await this.api.getTeam();

        if (entitySearch.length === 0) {
            const createObj = {
                credential: credentials[0]._id,
                user: this.userId,
                name: teamDetails.data.name,
                externalId: teamDetails.data.id,
            };
            entity = await this.entityMO.create(createObj);
        } else {
            entity = entitySearch[0];
        }

        if (credentials.length === 0) {
            throw new Error('Credential failed to create');
        }
        if (credentials.length > 1) {
            throw new Error('User has multiple credentials???');
        }

        return {
            credential_id: credentials[0].id,
            entity_id: entity.id,
            type: Config.name,
        };
    }

    async testAuth() {
        await this.api.getTeam();
    }

    async deauthorize() {
        this.api = new Api();

        const entity = await this.entityMO.getByUserId(this.userId);
        if (entity.credential) {
            await this.credentialMO.delete(entity.credential);
            entity.credential = undefined;
            await entity.save();
        }
    }

    async mark_credentials_invalid() {
        const credentials = await this.credentialMO.list({ user: this.userId });
        if (credentials.length === 1) {
            return await this.credentialMO.update(credentials[0]._id, {
                auth_is_valid: false,
            });
        }
        if (credentials.length > 1) {
            throw new Error('User has multiple credentials???');
        } else if (credentials.length === 0) {
            throw new Error(
                'How are we marking noexistant credentials invalid???'
            );
        }
    }

    async receiveNotification(notifier, delegateString, object = null) {
        if (notifier instanceof Api) {
            if (delegateString === this.api.DLGT_TOKEN_UPDATE) {
                const updatedToken = {
                    user: this.userId,
                    access_token: this.api.access_token,
                    refresh_token: this.api.refresh_token,
                    expires_at: this.api.accessTokenExpire,
                };

                Object.keys(updatedToken).forEach(
                    (k) => updatedToken[k] === null && delete updatedToken[k]
                );
                const credentials = await this.credentialMO.list({
                    user: this.userId,
                });
                let credential;
                if (credentials.length === 1) {
                    credential = credentials[0];
                } else if (credentials.length > 1) {
                    throw new Error('User has multiple credentials???');
                }
                if (!credential) {
                    credential = await this.credentialMO.create(updatedToken);
                } else {
                    credential = await this.credentialMO.update(
                        credential._id,
                        updatedToken
                    );
                }
            }
            if (delegateString === this.api.DLGT_TOKEN_DEAUTHORIZED) {
                await this.deauthorize();
            }
        }
    }
}

module.exports = SalesloftIntegration;