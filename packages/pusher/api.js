const { ApiKeyRequester, get } = require('@friggframework/core');
const crypto = require('crypto');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        
        this.app_id = get(params, 'app_id', null);
        this.key = get(params, 'key', null);
        this.secret = get(params, 'secret', null);
        this.cluster = get(params, 'cluster', 'us2');
        this.useTLS = get(params, 'useTLS', true);
        
        const protocol = this.useTLS ? 'https' : 'http';
        this.baseUrl = `${protocol}://api-${this.cluster}.pusherapp.com/apps/${this.app_id}`;
        
        this.URLs = {
            // Events
            events: '/events',
            batchEvents: '/batch_events',
            
            // Channels
            channels: '/channels',
            channelInfo: (channel) => `/channels/${encodeURIComponent(channel)}`,
            channelUsers: (channel) => `/channels/${encodeURIComponent(channel)}/users`,
            
            // Authentication
            userAuth: '/user-auth',
            
            // Webhooks
            webhooks: '/webhooks',
        };
    }

    // Generate authentication signature for Pusher API
    generateAuthSignature(method, path, query = '', body = '') {
        const timestamp = Math.floor(Date.now() / 1000);
        const bodyMd5 = crypto.createHash('md5').update(body).digest('hex');
        
        const queryString = new URLSearchParams({
            auth_key: this.key,
            auth_timestamp: timestamp,
            auth_version: '1.0',
            body_md5: bodyMd5,
            ...query
        }).toString();
        
        const stringToSign = [method, path, queryString].join('\n');
        const signature = crypto.createHmac('sha256', this.secret).update(stringToSign).digest('hex');
        
        return {
            auth_key: this.key,
            auth_timestamp: timestamp,
            auth_version: '1.0',
            auth_signature: signature,
            body_md5: bodyMd5
        };
    }

    async _request(url, options = {}) {
        const method = options.method || 'GET';
        const path = url.replace(this.baseUrl, '');
        const body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body || {});
        const query = options.query || {};
        
        const authParams = this.generateAuthSignature(method.toUpperCase(), path, query, body);
        
        // Merge auth params with existing query params
        const finalQuery = { ...query, ...authParams };
        
        return super._request(url, {
            ...options,
            query: finalQuery,
            body: body !== '{}' ? body : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    }

    // **************************   Event Methods   **********************************

    async triggerEvent(channel, event, data, params = {}) {
        const eventData = {
            name: event,
            channel: channel,
            data: typeof data === 'string' ? data : JSON.stringify(data),
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.events,
            method: 'POST',
            body: eventData
        };
        return this._request(options.url, options);
    }

    async triggerMultipleEvents(events, params = {}) {
        const eventsData = {
            batch: events.map(event => ({
                name: event.event,
                channel: event.channel,
                data: typeof event.data === 'string' ? event.data : JSON.stringify(event.data),
                socket_id: event.socket_id
            })),
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.batchEvents,
            method: 'POST',
            body: eventsData
        };
        return this._request(options.url, options);
    }

    async triggerEventToMultipleChannels(channels, event, data, params = {}) {
        const eventData = {
            name: event,
            channels: channels,
            data: typeof data === 'string' ? data : JSON.stringify(data),
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.events,
            method: 'POST',
            body: eventData
        };
        return this._request(options.url, options);
    }

    // **************************   Channel Methods   **********************************

    async getChannels(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.channels,
            query: params
        };
        return this._request(options.url, options);
    }

    async getChannelInfo(channel, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.channelInfo(channel),
            query: params
        };
        return this._request(options.url, options);
    }

    async getChannelUsers(channel) {
        const options = {
            url: this.baseUrl + this.URLs.channelUsers(channel),
        };
        return this._request(options.url, options);
    }

    // **************************   Authentication Methods   **********************************

    generateChannelAuth(channel, socketId, customData = null) {
        const stringToSign = `${socketId}:${channel}`;
        let authString = stringToSign;
        
        if (customData) {
            const customDataString = JSON.stringify(customData);
            authString += `:${customDataString}`;
        }
        
        const signature = crypto.createHmac('sha256', this.secret).update(authString).digest('hex');
        const auth = `${this.key}:${signature}`;
        
        const response = { auth };
        if (customData) {
            response.channel_data = JSON.stringify(customData);
        }
        
        return response;
    }

    generatePresenceChannelAuth(channel, socketId, userData) {
        return this.generateChannelAuth(channel, socketId, userData);
    }

    generateUserAuth(socketId, userData) {
        const userDataString = JSON.stringify(userData);
        const stringToSign = `${socketId}::user::${userDataString}`;
        const signature = crypto.createHmac('sha256', this.secret).update(stringToSign).digest('hex');
        
        return {
            auth: `${this.key}:${signature}`,
            user_data: userDataString
        };
    }

    // **************************   Webhook Methods   **********************************

    async validateWebhook(body, signature) {
        const expectedSignature = crypto.createHmac('sha256', this.secret)
            .update(body)
            .digest('hex');
        
        return signature === expectedSignature;
    }

    async handleWebhook(body, headers) {
        const signature = headers['x-pusher-signature'];
        const keyHeader = headers['x-pusher-key'];
        
        if (keyHeader !== this.key) {
            throw new Error('Invalid webhook key');
        }
        
        const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
        const isValid = await this.validateWebhook(bodyString, signature);
        
        if (!isValid) {
            throw new Error('Invalid webhook signature');
        }
        
        const webhookData = typeof body === 'string' ? JSON.parse(body) : body;
        
        return {
            type: 'webhook',
            data: {
                time_ms: webhookData.time_ms,
                events: webhookData.events
            }
        };
    }

    // **************************   Presence Methods   **********************************

    async notifyUserAdded(channel, userId, userInfo = {}) {
        return this.triggerEvent(channel, 'pusher:member_added', {
            user_id: userId,
            user_info: userInfo
        });
    }

    async notifyUserRemoved(channel, userId) {
        return this.triggerEvent(channel, 'pusher:member_removed', {
            user_id: userId
        });
    }

    // **************************   Statistics Methods   **********************************

    async getApplicationStats() {
        try {
            const channels = await this.getChannels();
            return {
                channel_count: channels.channels ? Object.keys(channels.channels).length : 0,
                channels: channels.channels || {}
            };
        } catch (error) {
            throw new Error(`Failed to get application stats: ${error.message}`);
        }
    }

    // **************************   Connection Testing   **********************************

    async testConnection() {
        try {
            const result = await this.getChannels();
            return {
                success: true,
                message: 'Connection successful',
                data: result
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                error: error
            };
        }
    }

    // **************************   Utility Methods   **********************************

    isPrivateChannel(channel) {
        return channel.startsWith('private-');
    }

    isPresenceChannel(channel) {
        return channel.startsWith('presence-');
    }

    isValidChannelName(channel) {
        // Channel name must be 1-200 characters, letters, numbers, hyphens, underscores, equals, dots
        const channelRegex = /^[a-zA-Z0-9_\-=.]+$/;
        return channel.length >= 1 && channel.length <= 200 && channelRegex.test(channel);
    }

    // **************************   Batch Operations   **********************************

    async sendBatchNotifications(notifications) {
        const events = notifications.map(notification => ({
            channel: notification.channel,
            event: notification.event || 'notification',
            data: notification.data,
            socket_id: notification.socket_id
        }));
        
        return this.triggerMultipleEvents(events);
    }
}

module.exports = { Api };