const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://sns.amazonaws.com';

        this.URLs = {
            // Topic operations
            topics: '/topics',
            topicById: (topicArn) => `/topics/${encodeURIComponent(topicArn)}`,
            
            // Subscription operations
            subscriptions: '/subscriptions',
            subscriptionById: (subscriptionArn) => `/subscriptions/${encodeURIComponent(subscriptionArn)}`,
            
            // Message operations
            publish: '/publish',
            
            // Platform applications
            platformApplications: '/platform-applications',
            platformApplicationById: (applicationArn) => `/platform-applications/${encodeURIComponent(applicationArn)}`,
            
            // Endpoints
            endpoints: '/endpoints',
            endpointById: (endpointArn) => `/endpoints/${encodeURIComponent(endpointArn)}`,
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

    // Topic operations
    async listTopics(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.topics,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async createTopic(name, attributes = {}) {
        const options = {
            url: this.baseUrl + this.URLs.topics,
            method: 'POST',
            json: {
                Name: name,
                Attributes: attributes,
            },
        };
        return this._request(options);
    }

    async getTopic(topicArn) {
        const options = {
            url: this.baseUrl + this.URLs.topicById(topicArn),
            method: 'GET',
        };
        return this._request(options);
    }

    async deleteTopic(topicArn) {
        const options = {
            url: this.baseUrl + this.URLs.topicById(topicArn),
            method: 'DELETE',
        };
        return this._request(options);
    }

    // Subscription operations
    async listSubscriptions(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async subscribe(topicArn, protocol, endpoint) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            method: 'POST',
            json: {
                TopicArn: topicArn,
                Protocol: protocol,
                Endpoint: endpoint,
            },
        };
        return this._request(options);
    }

    async unsubscribe(subscriptionArn) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionArn),
            method: 'DELETE',
        };
        return this._request(options);
    }

    // Message operations
    async publishMessage(topicArn, message, subject = null, messageAttributes = {}) {
        const options = {
            url: this.baseUrl + this.URLs.publish,
            method: 'POST',
            json: {
                TopicArn: topicArn,
                Message: message,
                Subject: subject,
                MessageAttributes: messageAttributes,
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