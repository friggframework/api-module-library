const { IntegrationBase, get, ModuleConstants } = require('@friggframework/core');
const { Api } = require('./api.js');
const { Entity } = require('./models/entity');
const { Credential } = require('./models/credential.js');

class FrontIntegration extends IntegrationBase {
    static Definition = {
        name: 'front',
        version: '1.0.0',
        display: {
            label: 'FrontApp',
            description: 'Front',
            imageURL: 'https://friggframework.org/assets/img/front-icon.jpeg',
            icon: '',
            category: 'Email',
        },
        modules: {
            api: Api,
            credential: Credential,
            entity: Entity,
        },
    };

    async testAuth() {
        await this.api.listContacts();
    }

    async getAuthorizationRequirements() {
        return {
            url: await this.api.authorizationUri,
            type: ModuleConstants.authType.oauth2,
        };
    }

    async processAuthorizationCallback(params) {
        const code = get(params.data, 'code');
        const response = await this.api.getTokenFromCode(code);

        let credentials = await this.credentialMO.list({user: this.userId});

        if (credentials.length === 0) {
            throw new Error('Credential failed to create');
        }
        if (credentials.length > 1) {
            throw new Error('User has multiple credentials???');
        }

        let entity = await this.entityMO.getByUserId(this.userId);

        return {
            credential_id: credentials[0]._id,
            entity_id: entity._id,
            type: FrontIntegration.Definition.name,
        };
    }

    async getEntityOptions() {
        // No entity options to get. Probably won't even hit this
        return [];
    }

    async findOrCreateEntity(data) {
        // Creating entity in send with credential creation... Just do a find
        return this.entityMO.getByUserId(data.userId);
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
    }

    async receiveNotification(notifier, delegateString, object = null) {
        if (notifier instanceof Api) {
            if (delegateString === this.api.DLGT_TOKEN_UPDATE) {
                // todo update the database
                const userDetails = await this.api.getTokenIdentity();
                const updatedToken = {
                    user: this.userId.toString(),
                    access_token: this.api.access_token,
                    refresh_token: this.api.refresh_token,
                    auth_is_valid: true,
                };

                Object.keys(updatedToken).forEach(
                    (k) => updatedToken[k] == null && delete updatedToken[k]
                );

                let entity = await this.entityMO.getByUserId(this.userId);
                if (!entity) {
                    entity = await this.entityMO.create({
                        user: this.userId,
                        externalId: userDetails.id,
                        name: userDetails.name,
                    });
                }

                let {credential} = entity;
                if (!credential) {
                    credential = await this.credentialMO.create(updatedToken);
                } else {
                    credential = await this.credentialMO.update(
                        credential,
                        updatedToken
                    );
                }
                await this.entityMO.update(entity.id, {credential});
            }
            if (delegateString === this.api.DLGT_TOKEN_DEAUTHORIZED) {
                await this.deauthorize();
            }
            if (delegateString === this.api.DLGT_INVALID_AUTH) {
                return this.markCredentialsInvalid();
            }
        }
    }

    async mark_credentials_invalid() {
        let credentials = await this.credentialMO.list({user: this.userId});
        if (credentials.length === 1) {
            return await this.credentialMO.update(credentials[0]._id, {
                auth_is_valid: false,
            });
        } else if (credentials.length > 1) {
            throw new Error('User has multiple credentials???');
        } else if (credentials.length === 0) {
            throw new Error(
                'How are we marking nonexistant credentials invalid???'
            );
        }
    }

    async listAllContacts(next = null) {
        const results = await this.api.listContacts(next);
        if (results._pagination) {
            if (results._pagination.next) {
                const next_page = await this.listAllContacts(
                    results._pagination.next
                );
                results._results = results._results.concat(next_page);
            }
        }
        return results._results;
    }

    async getApiObject() {
        const frontParams = {delegate: this};
        
        if (this.credential) {
            frontParams.access_token = this.credential.access_token;
            frontParams.refresh_token = this.credential.refresh_token;
        }
        
        return new Api(frontParams);
    }
}

module.exports = FrontIntegration;