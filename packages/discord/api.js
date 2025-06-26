const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://discord.com/api/v10';
        
        this.URLs = {
            authorization: '/oauth2/authorize',
            access_token: '/oauth2/token',
            revoke_token: '/oauth2/token/revoke',
            currentUser: '/users/@me',
            userGuilds: '/users/@me/guilds',
            userConnections: '/users/@me/connections',
            guild: (guildId) => `/guilds/${guildId}`,
            guildChannels: (guildId) => `/guilds/${guildId}/channels`,
            guildMembers: (guildId) => `/guilds/${guildId}/members`,
            guildRoles: (guildId) => `/guilds/${guildId}/roles`,
            channel: (channelId) => `/channels/${channelId}`,
            channelMessages: (channelId) => `/channels/${channelId}/messages`,
            message: (channelId, messageId) => `/channels/${channelId}/messages/${messageId}`,
            webhooks: (channelId) => `/channels/${channelId}/webhooks`,
            webhook: (webhookId) => `/webhooks/${webhookId}`,
        };

        this.authorizationUri = encodeURI(
            `https://discord.com/api/oauth2/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = 'https://discord.com/api/oauth2/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
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
        return super._post(options, stringify);
    }

    async _patch(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   User Methods   **********************************

    async getCurrentUser() {
        const options = {
            url: this.baseUrl + this.URLs.currentUser,
        };
        return this._get(options);
    }

    async getCurrentUserGuilds() {
        const options = {
            url: this.baseUrl + this.URLs.userGuilds,
        };
        return this._get(options);
    }

    async getCurrentUserConnections() {
        const options = {
            url: this.baseUrl + this.URLs.userConnections,
        };
        return this._get(options);
    }

    // **************************   Guild Methods   **********************************

    async getGuild(guildId) {
        const options = {
            url: this.baseUrl + this.URLs.guild(guildId),
            query: {
                with_counts: true,
            },
        };
        return this._get(options);
    }

    async getGuildChannels(guildId) {
        const options = {
            url: this.baseUrl + this.URLs.guildChannels(guildId),
        };
        return this._get(options);
    }

    async getGuildMembers(guildId, options = {}) {
        const queryParams = {
            limit: options.limit || 1000,
            after: options.after || '0',
        };
        
        const requestOptions = {
            url: this.baseUrl + this.URLs.guildMembers(guildId),
            query: queryParams,
        };
        return this._get(requestOptions);
    }

    async getGuildRoles(guildId) {
        const options = {
            url: this.baseUrl + this.URLs.guildRoles(guildId),
        };
        return this._get(options);
    }

    // **************************   Channel Methods   **********************************

    async getChannel(channelId) {
        const options = {
            url: this.baseUrl + this.URLs.channel(channelId),
        };
        return this._get(options);
    }

    async getChannelMessages(channelId, options = {}) {
        const queryParams = {
            limit: options.limit || 50,
        };
        
        if (options.before) queryParams.before = options.before;
        if (options.after) queryParams.after = options.after;
        if (options.around) queryParams.around = options.around;

        const requestOptions = {
            url: this.baseUrl + this.URLs.channelMessages(channelId),
            query: queryParams,
        };
        return this._get(requestOptions);
    }

    async createMessage(channelId, content, options = {}) {
        const body = {
            content,
            ...options,
        };

        const requestOptions = {
            url: this.baseUrl + this.URLs.channelMessages(channelId),
            body,
        };
        return this._post(requestOptions);
    }

    async getMessage(channelId, messageId) {
        const options = {
            url: this.baseUrl + this.URLs.message(channelId, messageId),
        };
        return this._get(options);
    }

    async editMessage(channelId, messageId, content, options = {}) {
        const body = {
            content,
            ...options,
        };

        const requestOptions = {
            url: this.baseUrl + this.URLs.message(channelId, messageId),
            body,
        };
        return this._patch(requestOptions);
    }

    async deleteMessage(channelId, messageId) {
        const options = {
            url: this.baseUrl + this.URLs.message(channelId, messageId),
        };
        return this._delete(options);
    }

    // **************************   Webhook Methods   **********************************

    async getChannelWebhooks(channelId) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks(channelId),
        };
        return this._get(options);
    }

    async createWebhook(channelId, name, avatar = null) {
        const body = {
            name,
        };
        
        if (avatar) {
            body.avatar = avatar;
        }

        const options = {
            url: this.baseUrl + this.URLs.webhooks(channelId),
            body,
        };
        return this._post(options);
    }

    async getWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhook(webhookId),
        };
        return this._get(options);
    }

    async modifyWebhook(webhookId, name, avatar = null) {
        const body = {
            name,
        };
        
        if (avatar) {
            body.avatar = avatar;
        }

        const options = {
            url: this.baseUrl + this.URLs.webhook(webhookId),
            body,
        };
        return this._patch(options);
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhook(webhookId),
        };
        return this._delete(options);
    }

    async executeWebhook(webhookId, webhookToken, content, options = {}) {
        const body = {
            content,
            ...options,
        };

        const requestOptions = {
            url: `${this.baseUrl}/webhooks/${webhookId}/${webhookToken}`,
            body,
        };
        return this._post(requestOptions);
    }
}

module.exports = { Api };