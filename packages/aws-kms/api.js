const { OAuth2Requester } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://kms.amazonaws.com';

        this.URLs = {
            // Key operations
            keys: '/keys',
            keyById: (keyId) => `/keys/${encodeURIComponent(keyId)}`,
            
            // Encryption operations
            encrypt: '/encrypt',
            decrypt: '/decrypt',
            generateDataKey: '/generate-data-key',
            
            // Key policies
            keyPolicy: (keyId) => `/keys/${encodeURIComponent(keyId)}/policy`,
            
            // Key grants
            grants: (keyId) => `/keys/${encodeURIComponent(keyId)}/grants`,
            grantById: (keyId, grantId) => `/keys/${encodeURIComponent(keyId)}/grants/${grantId}`,
            
            // Aliases
            aliases: '/aliases',
            aliasById: (aliasName) => `/aliases/${encodeURIComponent(aliasName)}`,
        };

        this.authorizationUri = encodeURI(
            `https://aws.amazon.com/oauth/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://aws.amazon.com/oauth/token';
    }

    async getTokenFromCode(code) {
        const options = {
            url: this.tokenUri,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            form: {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                redirect_uri: this.redirect_uri,
                code: code,
            },
        };
        const response = await this._request(options);
        await this.setTokens(response);
        return response;
    }

    // Key operations
    async listKeys(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.keys,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async createKey(keyUsage = 'ENCRYPT_DECRYPT', keySpec = 'SYMMETRIC_DEFAULT') {
        const options = {
            url: this.baseUrl + this.URLs.keys,
            method: 'POST',
            json: {
                KeyUsage: keyUsage,
                KeySpec: keySpec,
            },
        };
        return this._request(options);
    }

    async getKey(keyId) {
        const options = {
            url: this.baseUrl + this.URLs.keyById(keyId),
            method: 'GET',
        };
        return this._request(options);
    }

    async deleteKey(keyId, pendingWindowInDays = 30) {
        const options = {
            url: this.baseUrl + this.URLs.keyById(keyId),
            method: 'DELETE',
            json: {
                PendingWindowInDays: pendingWindowInDays,
            },
        };
        return this._request(options);
    }

    // Encryption operations
    async encrypt(keyId, plaintext, encryptionContext = {}) {
        const options = {
            url: this.baseUrl + this.URLs.encrypt,
            method: 'POST',
            json: {
                KeyId: keyId,
                Plaintext: plaintext,
                EncryptionContext: encryptionContext,
            },
        };
        return this._request(options);
    }

    async decrypt(ciphertextBlob, encryptionContext = {}) {
        const options = {
            url: this.baseUrl + this.URLs.decrypt,
            method: 'POST',
            json: {
                CiphertextBlob: ciphertextBlob,
                EncryptionContext: encryptionContext,
            },
        };
        return this._request(options);
    }

    async generateDataKey(keyId, keySpec = 'AES_256') {
        const options = {
            url: this.baseUrl + this.URLs.generateDataKey,
            method: 'POST',
            json: {
                KeyId: keyId,
                KeySpec: keySpec,
            },
        };
        return this._request(options);
    }

    // User info for authentication
    async getUserDetails() {
        const options = {
            url: this.baseUrl + '/user-details',
            method: 'GET',
        };
        return this._request(options);
    }
}

module.exports = { Api };