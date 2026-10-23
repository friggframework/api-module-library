const {get, OAuth2Requester} = require('@friggframework/core');

// Hosts verified against Deel developer docs (developer.deel.com):
// - Production API: https://developer.deel.com/api/stable/sandbox.md
// - Production OAuth: https://developer.deel.com/api/stable/oauth.md
// - Sandbox API + partner OAuth: https://developer.deel.com/api/stable/sandbox.md
//   and https://developer.deel.com/api/stable/partners/getting-started.md
const PRODUCTION_HOSTS = {
    baseUrl: 'https://api.letsdeel.com/rest/v1',
    authorizeUrl: 'https://app.deel.com/oauth2/authorize',
    tokenUri: 'https://app.deel.com/oauth2/tokens',
};

const SANDBOX_HOSTS = {
    baseUrl: 'https://api-staging.letsdeel.com/rest/v1',
    authorizeUrl: 'https://app-sandbox.letsdeel.com/oauth/authorize',
    tokenUri: 'https://app-sandbox.letsdeel.com/oauth/token',
};

function resolveHosts(params = {}) {
    const environment = get(
        params,
        'environment',
        process.env.DEEL_ENVIRONMENT || 'production'
    );
    return environment === 'sandbox' ? SANDBOX_HOSTS : PRODUCTION_HOSTS;
}

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.access_token = get(params, 'access_token', null);
        // consider setting backOff as refreshAuth request gets a 500 with bad token
        this.backOff = [1, 3];

        const hosts = resolveHosts(params);
        this.environment =
            hosts === SANDBOX_HOSTS ? 'sandbox' : 'production';
        this.baseUrl = hosts.baseUrl;
        this.endpoints = {
            listPeople: '/people',
            getPerson: (id) => `/people/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
            webhookEventTypes: '/webhooks/events/types',
            organizations: '/organizations'
        }
        this.URLs = {}
        this.generateUrls();
        this.state = 'STATE';
        this.authorizationUri = encodeURI(
            `${hosts.authorizeUrl}?response_type=code` +
            `&scope=${this.scope}` +
            `&client_id=${this.client_id}` +
            `&redirect_uri=${this.redirect_uri}` +
            `&state=${this.state}`
        )
        this.tokenUri = hosts.tokenUri;
    }

    generateUrls() {
        for (const key in this.endpoints) {
            if (this.endpoints[key] instanceof Function) {
                this.URLs[key] = (...params) => this.baseUrl + this.endpoints[key](...params)
            } else {
                this.URLs[key] = this.baseUrl + this.endpoints[key];
            }
        }
    }

    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);
        params.append('redirect_uri', this.redirect_uri);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // API METHODS

    async getOrganization() {
        const options = {
            url: this.URLs.organizations
        }
        return this._get(options);
    }

    async getTokenIdentity() {
        const org = await this.getOrganization();
        return {name: org.data[0].name, id: org.data[0].id};
    }

    async listPeople(query) {
        const options = {
            url: this.URLs.listPeople,
            query,
        };
        return this._get(options);
    }

    async getPerson(id) {
        const options = {
            url: this.URLs.getPerson(id)
        }
        return this._get(options);
    }

    async listWebhooks() {
        const options = {
            url: this.URLs.webhooks
        }
        return this._get(options);
    }

    async getWebhook(id) {
        const options = {
            url: this.URLs.webhookById(id)
        }
        return this._get(options);
    }

    async createWebhook(webhookDefinition) {
        const options = {
            url: this.URLs.webhooks,
            headers: {
                'Content-Type': 'application/json',
            },
            body: webhookDefinition
        }
        return this._post(options);
    }

    async updateWebhook(id, partialWebhookDefinition) {
        const options = {
            url: this.URLs.webhookById(id),
            headers: {
                'Content-Type': 'application/json',
            },
            body: partialWebhookDefinition
        }
        return this._patch(options);
    }

    async deleteWebhook(id) {
        const options = {
            url: this.URLs.webhookById(id)
        }
        return this._delete(options);
    }

    async listWebhookEventTypes() {
        const options = {
            url: this.URLs.webhookEventTypes
        }
        return this._get(options);
    }
}

module.exports = {Api, resolveHosts, PRODUCTION_HOSTS, SANDBOX_HOSTS};
