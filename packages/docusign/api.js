const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.sandbox = get(params, 'sandbox', false);
        this.account_id = get(params, 'account_id', null);
        
        // Base URLs differ for sandbox vs production
        this.authBaseUrl = this.sandbox 
            ? 'https://account-d.docusign.com'
            : 'https://account.docusign.com';
            
        this.baseUrl = null; // Will be set after getting user info and account base URI
        
        this.URLs = {
            authorization: '/oauth/auth',
            access_token: '/oauth/token',
            userInfo: '/oauth/userinfo',
            
            // Envelopes
            envelopes: '/envelopes',
            envelopeById: (envelopeId) => `/envelopes/${envelopeId}`,
            envelopeDocuments: (envelopeId) => `/envelopes/${envelopeId}/documents`,
            envelopeDocumentById: (envelopeId, documentId) => `/envelopes/${envelopeId}/documents/${documentId}`,
            envelopeRecipients: (envelopeId) => `/envelopes/${envelopeId}/recipients`,
            envelopeViews: (envelopeId) => `/envelopes/${envelopeId}/views/recipient`,
            
            // Templates
            templates: '/templates',
            templateById: (templateId) => `/templates/${templateId}`,
            
            // Users
            users: '/users',
            userById: (userId) => `/users/${userId}`,
            
            // Groups
            groups: '/groups',
            groupById: (groupId) => `/groups/${groupId}`,
            
            // Folders
            folders: '/folders',
            folderById: (folderId) => `/folders/${folderId}`,
            
            // Brand
            brands: '/brands',
            brandById: (brandId) => `/brands/${brandId}`,
            
            // Connect (webhooks)
            connect: '/connect',
            connectConfigurations: '/connect/configurations',
            connectConfigurationById: (connectId) => `/connect/configurations/${connectId}`,
        };

        this.authorizationUri = encodeURI(
            `${this.authBaseUrl}/oauth/auth?response_type=code&scope=${this.scope}&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}`
        );
        this.tokenUri = this.authBaseUrl + '/oauth/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getUserInfo() {
        const options = {
            url: this.authBaseUrl + this.URLs.userInfo,
        };
        return this._get(options);
    }

    async setAccountId(accountId) {
        this.account_id = accountId;
        await this.setBaseUrl();
    }

    async setBaseUrl() {
        if (!this.account_id) {
            const userInfo = await this.getUserInfo();
            const accounts = userInfo.accounts || [];
            const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0];
            
            if (defaultAccount) {
                this.account_id = defaultAccount.account_id;
                this.baseUrl = defaultAccount.base_uri + '/restapi/v2.1/accounts/' + this.account_id;
            }
        } else {
            // Use sandbox or production base URL with account ID
            const base = this.sandbox 
                ? 'https://demo.docusign.net'
                : 'https://na1.docusign.net'; // This might vary by region
            this.baseUrl = base + '/restapi/v2.1/accounts/' + this.account_id;
        }
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _post(options, stringify = true) {
        this.addJsonHeaders(options);
        await this.ensureBaseUrl();
        return super._post(options, stringify);
    }

    async _patch(options, stringify = true) {
        this.addJsonHeaders(options);
        await this.ensureBaseUrl();
        return super._patch(options, stringify);
    }

    async _put(options, stringify = true) {
        this.addJsonHeaders(options);
        await this.ensureBaseUrl();
        return super._put(options, stringify);
    }

    async _get(options) {
        await this.ensureBaseUrl();
        return super._get(options);
    }

    async _delete(options) {
        await this.ensureBaseUrl();
        return super._delete(options);
    }

    async ensureBaseUrl() {
        if (!this.baseUrl && this.access_token) {
            await this.setBaseUrl();
        }
    }

    // **************************   Envelopes Methods   **********************************

    async getEnvelopes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.envelopes,
            query: params,
        };
        return this._get(options);
    }

    async createEnvelope(envelopeData) {
        const options = {
            url: this.baseUrl + this.URLs.envelopes,
            body: envelopeData,
        };
        return this._post(options);
    }

    async getEnvelope(envelopeId) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeById(envelopeId),
        };
        return this._get(options);
    }

    async updateEnvelope(envelopeId, envelopeData) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeById(envelopeId),
            body: envelopeData,
        };
        return this._put(options);
    }

    async deleteEnvelope(envelopeId) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeById(envelopeId),
        };
        return this._delete(options);
    }

    async sendEnvelope(envelopeId) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeById(envelopeId),
            body: { status: 'sent' },
        };
        return this._put(options);
    }

    async voidEnvelope(envelopeId, voidedReason) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeById(envelopeId),
            body: { 
                status: 'voided',
                voidedReason: voidedReason 
            },
        };
        return this._put(options);
    }

    // **************************   Envelope Documents Methods   **********************************

    async getEnvelopeDocuments(envelopeId) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeDocuments(envelopeId),
        };
        return this._get(options);
    }

    async getEnvelopeDocument(envelopeId, documentId) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeDocumentById(envelopeId, documentId),
        };
        return this._get(options);
    }

    // **************************   Envelope Recipients Methods   **********************************

    async getEnvelopeRecipients(envelopeId) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeRecipients(envelopeId),
        };
        return this._get(options);
    }

    async updateEnvelopeRecipients(envelopeId, recipientsData) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeRecipients(envelopeId),
            body: recipientsData,
        };
        return this._put(options);
    }

    async createRecipientView(envelopeId, recipientViewData) {
        const options = {
            url: this.baseUrl + this.URLs.envelopeViews(envelopeId),
            body: recipientViewData,
        };
        return this._post(options);
    }

    // **************************   Templates Methods   **********************************

    async getTemplates(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.templates,
            query: params,
        };
        return this._get(options);
    }

    async getTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
        };
        return this._get(options);
    }

    async createTemplate(templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templates,
            body: templateData,
        };
        return this._post(options);
    }

    async updateTemplate(templateId, templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
            body: templateData,
        };
        return this._put(options);
    }

    async createEnvelopeFromTemplate(templateId, envelopeData) {
        const templateEnvelopeData = {
            ...envelopeData,
            templateId: templateId,
        };

        return this.createEnvelope(templateEnvelopeData);
    }

    // **************************   Users Methods   **********************************

    async getUsers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.users,
            query: params,
        };
        return this._get(options);
    }

    async getUser(userId) {
        const options = {
            url: this.baseUrl + this.URLs.userById(userId),
        };
        return this._get(options);
    }

    async createUser(userData) {
        const options = {
            url: this.baseUrl + this.URLs.users,
            body: userData,
        };
        return this._post(options);
    }

    async updateUser(userId, userData) {
        const options = {
            url: this.baseUrl + this.URLs.userById(userId),
            body: userData,
        };
        return this._put(options);
    }

    // **************************   Connect (Webhooks) Methods   **********************************

    async getConnectConfigurations() {
        const options = {
            url: this.baseUrl + this.URLs.connectConfigurations,
        };
        return this._get(options);
    }

    async createConnectConfiguration(connectData) {
        const options = {
            url: this.baseUrl + this.URLs.connectConfigurations,
            body: connectData,
        };
        return this._post(options);
    }

    async getConnectConfiguration(connectId) {
        const options = {
            url: this.baseUrl + this.URLs.connectConfigurationById(connectId),
        };
        return this._get(options);
    }

    async updateConnectConfiguration(connectId, connectData) {
        const options = {
            url: this.baseUrl + this.URLs.connectConfigurationById(connectId),
            body: connectData,
        };
        return this._put(options);
    }

    async deleteConnectConfiguration(connectId) {
        const options = {
            url: this.baseUrl + this.URLs.connectConfigurationById(connectId),
        };
        return this._delete(options);
    }

    // **************************   Helper Methods   **********************************

    async createSimpleEnvelope(emailSubject, recipients, documents) {
        const envelopeData = {
            emailSubject: emailSubject,
            status: 'created',
            recipients: {
                signers: recipients.map((recipient, index) => ({
                    email: recipient.email,
                    name: recipient.name,
                    recipientId: (index + 1).toString(),
                    routingOrder: (index + 1).toString(),
                }))
            },
            documents: documents.map((doc, index) => ({
                documentId: (index + 1).toString(),
                name: doc.name,
                documentBase64: doc.base64Content,
                fileExtension: doc.extension || 'pdf',
            }))
        };

        return this.createEnvelope(envelopeData);
    }

    async getSigningUrl(envelopeId, recipientEmail, recipientName, returnUrl) {
        const recipientViewData = {
            authenticationMethod: 'none',
            email: recipientEmail,
            userName: recipientName,
            returnUrl: returnUrl,
            clientUserId: recipientEmail, // Using email as client user ID
        };

        return this.createRecipientView(envelopeId, recipientViewData);
    }
}

module.exports = { Api };