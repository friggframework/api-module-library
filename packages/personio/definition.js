const { IntegrationBase, get, ModuleConstants } = require('@friggframework/core');
const { Api } = require('./api');
const { Entity } = require('./models/entity');
const { Credential } = require('./models/credential');
const AuthFields = require('./authFields');

class PersonioIntegration extends IntegrationBase {
    static Definition = {
        name: 'personio',
        version: '1.0.0',
        display: {
            label: 'Personio',
            description: 'Personio',
            imageURL: 'https://friggframework.org/assets/img/personio-icon.png',
            icon: '',
            category: 'HR',
        },
        modules: {
            api: Api,
            credential: Credential,
            entity: Entity,
        },
    };

    static AuthFields = AuthFields;

    async getAuthorizationRequirements() {
        // see parent docs. only use these three top level keys
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
        const clientId = get(params.data, 'clientId');
        const clientSecret = get(params.data, 'clientSecret');
        const companyId = get(params.data, 'companyId');
        const accessToken = get(params.data, 'accessToken');
        const subdomain = get(params.data, 'subdomain');
        this.api = new Api({
            clientId,
            clientSecret,
            companyId,
            accessToken,
            subdomain,
        });
        const userDetails = await this.api.getUserDetails();

        const byUserId = {user: this.userId};
        const credentials = await this.credentialMO.list(byUserId);

        if (credentials.length > 1) {
            throw new Error('User has multiple credentials???');
        }

        const credential = await this.credentialMO.upsert(byUserId, {
            user: this.userId,
            client_id: clientId,
            client_secret: clientSecret,
            company_id: companyId,
            access_token: accessToken,
            subdomain: subdomain,
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
            type: PersonioIntegration.Definition.name,
        };
    }

    async testAuth() {
        // TODO - this method doesn't exist in API
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

    async getApiObject() {
        let personioParams = {};

        if (this.credential) {
            personioParams = {
                clientId: this.credential.clientId,
                clientSecret: this.credential.clientSecret,
                companyId: this.credential.companyId,
                accessToken: this.credential.accessToken,
                subdomain: this.credential.subdomain,
            };
        }

        return new Api(personioParams);
    }
}

module.exports = PersonioIntegration;