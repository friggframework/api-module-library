const {ModuleManager, ModuleConstants, get} = require('@friggframework/core');
const {Api} = require('./api');
const {Entity} = require('./models/entity');
const {Credential} = require('./models/credential');
const config = require('./defaultConfig.json')

class Manager extends ModuleManager {
    static Entity = Entity;
    static Credential = Credential;

    constructor(params) {
        super(params);
    }

    static getName() {
        return config.name;
    }

    static async getInstance(params) {
        let instance = new this(params);
        const managerParams = {
            client_id: process.env.UNBABEL_PROJECTS_CLIENT_ID,
            delegate: instance
        };
        if (params.entityId) {
            instance.entity = await Entity.findById(params.entityId);
            instance.credential = await Credential.findById(instance.entity.credential);
        } else if (params.credentialId) {
            instance.credential = await Credential.findById(params.credentialId);
        }
        if (instance.credential) {
            managerParams.access_token = instance.credential.access_token;
            managerParams.refresh_token = instance.credential.refresh_token;
        }
        instance.api = await new Api(managerParams);

        return instance;
    }

    // Change to whatever your api uses to return identifying information
    async testAuth() {
        let validAuth = false;
        try {
            if (await this.api.getSupportedExtensions()) validAuth = true;
        } catch (e) {
            flushDebugLog(e);
        }
        return validAuth;
    }

    getAuthorizationRequirements(params) {
        return {
            url: null,
            type: ModuleConstants.authType.oauth2,
        };
    }


    async processAuthorizationCallback(params) {
        this.api.client_id = get(params, 'client_id', this.api.client_id);
        this.api.customer_id = get(params, 'customer_id', this.api.customer_id);
        this.api.username = get(params, 'username', this.api.username);
        this.api.password = get(params, 'password', this.api.password);
        await this.api.getTokenFromUsernamePassword();
        // get entity identifying information from the api. You'll need to format this.
        const entityDetails = await this.api.getTokenIdentity();
        await this.findOrCreateEntity(entityDetails);
        return {
            credential_id: this.credential.id,
            entity_id: this.entity.id,
            type: Manager.getName(),
        };
    }

    async findOrCreateEntity(params) {
        // TODO this should be a changed to your entity needs
        const identifier = get(params, 'identifier');
        const name = get(params, 'name');

        const search = await Entity.find({
            user: this.userId,
            externalId: identifier,
        });
        if (search.length === 0) {
            // validate choices!!!
            // create entity
            const createObj = {
                credential: this.credential.id,
                user: this.userId,
                name,
                externalId: identifier,
            };
            this.entity = await Entity.create(createObj);
        } else if (search.length === 1) {
            this.entity = search[0];
        } else {
            debug(`Multiple entities found with the same external ID: ${identifier}`);
            this.throwException(`Multiple entities found with the same external ID: ${identifier}`);
        }
    }

    async receiveNotification(notifier, delegateString, object = null) {
        if (!(notifier instanceof Api)) {
            // no-op
        } else if (delegateString === this.api.DLGT_TOKEN_UPDATE) {
            await this.updateOrCreateCredential();
        } else if (delegateString === this.api.DLGT_TOKEN_DEAUTHORIZED) {
            await this.deauthorize();
        } else if (delegateString === this.api.DLGT_INVALID_AUTH) {
            await this.markCredentialsInvalid();
        }
    }

    async updateOrCreateCredential() {
        const userDetails = await this.api.getTokenIdentity();
        const updatedToken = {
            user: this.userId.toString(),
            auth_is_valid: true,
        };
        if (this.access_token) {
            updatedToken.access_token = this.access_token
        }
        if (this.refresh_token) {
            updatedToken.refresh_token = this.refresh_token
        }

        // search for a credential for this user and identifier
        // skip if we already have a credential
        if (!this.credential) {
            const credentialSearch = await Credential.find({
                identifier: userDetails.identifier
            })
            if (credentialSearch.length > 1) {
                debug(`Multiple credentials found with same identifier: ${userDetails.identifier}`);
                this.throwException(`Multiple credentials found with same identifier: ${userDetails.identifier}`);
            } else if (credentialSearch === 1 && credentialSearch[0].user !== this.userId) {
                debug(`A credential already exists with this identifier: ${userDetails.identifier}`);
                this.throwException(`A credential already exists with this identifier: ${userDetails.identifier}`);
            } else if (credentialSearch === 1) {
                // found exactly one credential with this identifier
                this.credential = credentialSearch[0];
            } else {
                // found no credential with this identifier (match none for insert)
                this.credential = {$exists: false};
            }
        }
        // update credential or create if none was found
        this.credential = await Credential.findOneAndUpdate(
            {_id: this.credential},
            {$set: updatedToken},
            {useFindAndModify: true, new: true, upsert: true}
        );
    }

    async deauthorize() {
        // wipe api connection
        this.api = new Api();

        // delete credentials from the database
        const entity = await Entity.getByUserId(this.userId);
        if (entity.credential) {
            await Credential.delete(entity.credential);
            entity.credential = undefined;
            await entity.save();
        }
    }
}

module.exports = Manager;
