const { OAuth2Requester } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://gmail.googleapis.com/gmail/v1';

        this.URLs = {
            // User profile
            profile: '/users/me/profile',
            
            // Messages
            messages: '/users/me/messages',
            messageById: (messageId) => `/users/me/messages/${messageId}`,
            sendMessage: '/users/me/messages/send',
            
            // Threads
            threads: '/users/me/threads',
            threadById: (threadId) => `/users/me/threads/${threadId}`,
            
            // Labels
            labels: '/users/me/labels',
            labelById: (labelId) => `/users/me/labels/${labelId}`,
            
            // Drafts
            drafts: '/users/me/drafts',
            draftById: (draftId) => `/users/me/drafts/${draftId}`,
            
            // Attachments
            attachment: (messageId, attachmentId) => `/users/me/messages/${messageId}/attachments/${attachmentId}`,
            
            // History
            history: '/users/me/history',
        };

        this.authorizationUri = encodeURI(
            `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}&access_type=offline`
        );
        this.tokenUri = 'https://oauth2.googleapis.com/token';
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

    // User profile
    async getProfile() {
        const options = {
            url: this.baseUrl + this.URLs.profile,
            method: 'GET',
        };
        return this._request(options);
    }

    // Messages
    async listMessages(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.messages,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getMessage(messageId, format = 'full') {
        const options = {
            url: this.baseUrl + this.URLs.messageById(messageId),
            method: 'GET',
            qs: { format },
        };
        return this._request(options);
    }

    async sendMessage(message) {
        const options = {
            url: this.baseUrl + this.URLs.sendMessage,
            method: 'POST',
            json: message,
        };
        return this._request(options);
    }

    async deleteMessage(messageId) {
        const options = {
            url: this.baseUrl + this.URLs.messageById(messageId),
            method: 'DELETE',
        };
        return this._request(options);
    }

    // Threads
    async listThreads(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.threads,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getThread(threadId, format = 'full') {
        const options = {
            url: this.baseUrl + this.URLs.threadById(threadId),
            method: 'GET',
            qs: { format },
        };
        return this._request(options);
    }

    // Labels
    async listLabels() {
        const options = {
            url: this.baseUrl + this.URLs.labels,
            method: 'GET',
        };
        return this._request(options);
    }

    async createLabel(label) {
        const options = {
            url: this.baseUrl + this.URLs.labels,
            method: 'POST',
            json: label,
        };
        return this._request(options);
    }

    // Drafts
    async listDrafts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.drafts,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async createDraft(draft) {
        const options = {
            url: this.baseUrl + this.URLs.drafts,
            method: 'POST',
            json: draft,
        };
        return this._request(options);
    }

    // User info for authentication
    async getUserDetails() {
        return this.getProfile();
    }
}

module.exports = { Api };