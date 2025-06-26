const { IntegrationBase, ModuleConstants } = require('@friggframework/core');
const _ = require('lodash');
const { Api } = require('./api');
const { Entity } = require('./models/entity');
const { Credential } = require('./models/credential');
const AuthFields = require('./authFields');
const Config = require('./defaultConfig.json');

class ActiveCampaignIntegration extends IntegrationBase {
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
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: AuthFields.jsonSchema,
                uiSchema: AuthFields.uiSchema,
            },
        };
    }

    async processAuthorizationCallback(params) {
        const apiUrl = _.get(params.data, 'apiUrl');
        const apiKey = _.get(params.data, 'apiKey');
        this.api = new Api({ apiUrl, apiKey });
        const userDetails = await this.api.getUserDetails();

        const byUserId = { user: this.userId };
        const credentials = await this.credentialMO.list(byUserId);

        if (credentials.length > 1) {
            throw new Error('User has multiple credentials???');
        }

        const credential = await this.credentialMO.upsert(byUserId, {
            user: this.userId,
            api_url: apiUrl,
            api_key: apiKey,
        });

        const byUserIdAndCredential = {
            ...byUserId,
            credential: credential.id,
        };
        const entity = await this.entityMO.upsert(byUserIdAndCredential, {
            user: this.userId,
            credential: credential.id,
            name: userDetails.user.username,
            externalId: userDetails.user.id,
        });

        return {
            entity_id: entity.id,
            credential_id: credential.id,
            type: Config.name,
        };
    }

    async testAuth() {
        await this.api.getUserDetails();
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

    async receiveNotification(notificationType, data) {
        // Handle notifications if needed
        return { success: true };
    }
}

module.exports = ActiveCampaignIntegration;