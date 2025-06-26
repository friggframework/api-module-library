const { IntegrationBase, debug, get, ModuleConstants } = require('@friggframework/core');
const { Api } = require('./api/api');
const { Entity } = require('./entity');
const { Credential } = require('./credential');
const AuthFields = require('./authFields');

class YotpoIntegration extends IntegrationBase {
    static Definition = {
        name: 'yotpo',
        version: '1.0.0',
        display: {
            label: 'Yotpo',
            description: 'Yotpo',
            imageURL: 'https://friggframework.org/assets/img/yotpo-icon.png',
            icon: '',
            category: 'Marketing',
        },
        modules: {
            api: Api,
            credential: Credential,
            entity: Entity,
        },
    };

    static AuthFields = AuthFields;

    async findOrCreateCredential(params) {
        const store_id = get(params.data, 'store_id', null);
        const secret = get(params.data, 'secret', null);

        const search = await this.Manager.Credential.find({
            user: this.userId,
            store_id,
            secret,
        });

        if (search.length === 0) {
            const createObj = {
                user: this.userId,
                store_id,
                secret,
            };
            this.credential = await this.Manager.Credential.create(createObj);
        } else if (search.length === 1) {
            this.credential = search[0];
        } else {
            debug(
                'Multiple credentials found with the same Client ID',
                store_id,
                secret
            );
        }
    }

    async findOrCreateEntity(params) {
        const store_id = get(params.data, 'store_id', null);
        const name = get(params, 'name', null);

        const search = await this.Manager.Entity.find({
            user: this.userId,
            externalId: store_id,
        });
        if (search.length === 0) {
            const createObj = {
                credential: this.credential.id,
                user: this.userId,
                name,
                externalId: store_id,
            };
            this.entity = await this.Manager.Entity.create(createObj);
        } else if (search.length === 1) {
            this.entity = search[0];
        } else {
            debug(
                'Multiple entities found with the same external ID:',
                store_id
            );
            this.throwException('');
        }
    }

    async getAuthorizationRequirements() {
        return {
            url: this.api.appDeveloperApi.authorizationUri,
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: AuthFields.jsonSchema,
                uiSchema: AuthFields.uiSchema,
            },
        };
    }

    async testAuth() {
        let validAuth = false;
        const authRequests = [
            this.api.appDeveloperApi.listOrders(),
            this.api.coreApi.listOrders(),
        ];
        if (
            this.api.loyaltyApi.API_KEY_VALUE ||
            this.credential.loyalty_api_key
        )
            authRequests.push(this.api.loyaltyApi.listActiveCampaigns());
        try {
            await Promise.all(authRequests);
            validAuth = true;
        } catch (e) {
            debug(e);
        }
        return validAuth;
    }

    async receiveNotification(notifier, delegateString, object = null) {
        if (delegateString === this.api.appDeveloperApi.DLGT_TOKEN_UPDATE) {
            const updatedToken = {
                user: this.userId.toString(),
                access_token: this.api.appDeveloperApi.access_token,
                refresh_token: this.api.appDeveloperApi.refresh_token,
                auth_is_valid: true,
                store_id: this.api.coreApi.store_id,
                secret: this.api.coreApi.secret,
                coreApiAccessToken: this.api.coreApi.API_KEY_VALUE,
                appKey: this.api.appDeveloperApi.appKey,
                loyalty_api_key: this.api.loyaltyApi.API_KEY_VALUE,
                loyalty_guid: this.api.loyaltyApi.GUID,
            };

            Object.keys(updatedToken).forEach(
                (k) => updatedToken[k] == null && delete updatedToken[k]
            );
            // TODO-new globally... multiple credentials should be allowed, this is 1:1
            if (!this.credential) {
                let credentialSearch = await this.Manager.Credential.find({
                    user: this.userId.toString(),
                });
                if (credentialSearch.length === 0) {
                    this.credential = await this.Manager.Credential.create(updatedToken);
                } else if (credentialSearch.length === 1) {
                    this.credential = await this.Manager.Credential.findOneAndUpdate(
                        {_id: credentialSearch[0]},
                        {$set: updatedToken},
                        {useFindAndModify: true, new: true}
                    );
                } else {
                    // Handling multiple credentials found with an error for the time being
                    debug(
                        'Multiple credentials found with the same client ID:'
                    );
                }
            } else {
                this.credential = await this.Manager.Credential.findOneAndUpdate(
                    {_id: this.credential},
                    {$set: updatedToken},
                    {useFindAndModify: true, new: true}
                );
            }
        }
        if (
            delegateString === this.api.appDeveloperApi.DLGT_TOKEN_DEAUTHORIZED
        ) {
            await this.deauthorize();
        }
        if (delegateString === this.api.appDeveloperApi.DLGT_INVALID_AUTH) {
            return this.markCredentialsInvalid();
        }
    }

    async processAuthorizationCallback(params) {
        const store_id = get(params.data, 'store_id', null);
        const secret = get(params.data, 'secret', null);
        const code = get(params.data, 'code', null);
        const loyalty_api_key = get(params.data, 'loyalty_api_key', null);
        const loyalty_guid = get(params.data, 'loyalty_guid', null);
        // const appKey = get(params.data, 'app_key', null);
        // vv TDOO temporary for specific implementation override. Don't do this at home.
        const appKey = get(params.data, 'store_id', null);
        this.api.coreApi.store_id = store_id;
        this.api.coreApi.apiKeySecret = secret;
        this.api.appDeveloperApi.appKey = appKey;
        if (loyalty_api_key) this.api.loyaltyApi.setApiKey(loyalty_api_key);
        if (loyalty_guid) this.api.loyaltyApi.setGuid(loyalty_guid);
        await this.api.coreApi.getToken();
        await this.api.appDeveloperApi.getTokenFromCode(code);
        const authRes = await this.testAuth();
        if (!authRes) throw new Error('Authentication failed');

        await this.findOrCreateEntity({
            store_id,
            secret,
        });
        return {
            credential_id: this.credential.id,
            entity_id: this.entity.id,
            type: YotpoIntegration.Definition.name,
        };
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
        let apiParams = {
            client_id: process.env.YOTPO_CLIENT_ID,
            client_secret: process.env.YOTPO_CLIENT_SECRET,
            redirect_uri: `${process.env.REDIRECT_URI}/yotpo`,
            delegate: this,
        };

        if (this.credential) {
            apiParams = {
                ...apiParams,
                ...this.credential.toObject(),
            };
            apiParams.API_KEY_VALUE = apiParams.coreApiAccessToken;
        }

        const api = new Api(apiParams);
        if (apiParams.loyalty_api_key) {
            api.loyaltyApi.setApiKey(apiParams.loyalty_api_key);
            api.loyaltyApi.setGuid(apiParams.loyalty_guid);
        }

        return api;
    }
}

module.exports = YotpoIntegration;