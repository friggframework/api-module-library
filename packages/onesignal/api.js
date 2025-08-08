const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        
        this.app_id = get(params, 'app_id', null);
        this.rest_api_key = get(params, 'rest_api_key', null);
        this.user_auth_key = get(params, 'user_auth_key', null);
        
        this.baseUrl = 'https://onesignal.com/api/v1';
        
        this.URLs = {
            // Notifications
            notifications: '/notifications',
            notificationById: (id) => `/notifications/${id}`,
            notificationHistory: (id) => `/notifications/${id}/history`,
            
            // Apps
            apps: '/apps',
            appById: (id) => `/apps/${id}`,
            
            // Devices/Players
            players: '/players',
            playerById: (id) => `/players/${id}`,
            playersCSV: '/players/csv_export',
            playersOnSession: '/players/on_session',
            playersOnPurchase: '/players/on_purchase',
            playersOnFocus: '/players/on_focus',
            
            // Segments
            segments: '/segments',
            segmentById: (id) => `/segments/${id}`,
            
            // Outcomes
            outcomes: '/outcomes',
            outcomesByNotification: (id) => `/notifications/${id}/outcomes`,
            
            // Templates
            templates: '/templates',
            templateById: (id) => `/templates/${id}`,
            
            // Live Activities (iOS)
            liveActivities: '/live_activities',
            liveActivityById: (id) => `/live_activities/${id}`,
            
            // Webhooks
            webhooks: '/webhooks',
        };
    }

    addAuthHeaders(headers = {}) {
        if (this.rest_api_key) {
            headers.Authorization = `Basic ${this.rest_api_key}`;
        }
        return headers;
    }

    addUserAuthHeaders(headers = {}) {
        if (this.user_auth_key) {
            headers.Authorization = `Basic ${this.user_auth_key}`;
        }
        return headers;
    }

    async _request(url, options = {}) {
        options.headers = this.addAuthHeaders(options.headers);
        return super._request(url, options);
    }

    async _requestWithUserAuth(url, options = {}) {
        options.headers = this.addUserAuthHeaders(options.headers);
        return super._request(url, options);
    }

    // **************************   Notification Methods   **********************************

    async sendNotification(message, params = {}) {
        const notificationData = {
            app_id: this.app_id,
            ...message,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.notifications,
            body: notificationData
        };
        return this._post(options);
    }

    async sendPushNotification(contents, params = {}) {
        const message = {
            contents: typeof contents === 'string' ? { en: contents } : contents,
            ...params
        };
        return this.sendNotification(message);
    }

    async sendNotificationToSegments(contents, segments, params = {}) {
        const message = {
            contents: typeof contents === 'string' ? { en: contents } : contents,
            included_segments: segments,
            ...params
        };
        return this.sendNotification(message);
    }

    async sendNotificationToUsers(contents, userIds, params = {}) {
        const message = {
            contents: typeof contents === 'string' ? { en: contents } : contents,
            include_player_ids: userIds,
            ...params
        };
        return this.sendNotification(message);
    }

    async sendNotificationToTags(contents, tags, params = {}) {
        const message = {
            contents: typeof contents === 'string' ? { en: contents } : contents,
            filters: tags,
            ...params
        };
        return this.sendNotification(message);
    }

    async sendRichNotification(contents, data = {}, params = {}) {
        const message = {
            contents: typeof contents === 'string' ? { en: contents } : contents,
            data,
            ...params
        };
        return this.sendNotification(message);
    }

    async sendScheduledNotification(contents, sendAfter, params = {}) {
        const message = {
            contents: typeof contents === 'string' ? { en: contents } : contents,
            send_after: sendAfter,
            ...params
        };
        return this.sendNotification(message);
    }

    async getNotification(notificationId) {
        const options = {
            url: this.baseUrl + this.URLs.notificationById(notificationId) + `?app_id=${this.app_id}`,
        };
        return this._get(options);
    }

    async getNotifications(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.notifications,
            query: {
                app_id: this.app_id,
                ...params
            }
        };
        return this._get(options);
    }

    async getNotificationHistory(notificationId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.notificationHistory(notificationId),
            query: {
                app_id: this.app_id,
                ...params
            }
        };
        return this._get(options);
    }

    async cancelNotification(notificationId) {
        const options = {
            url: this.baseUrl + this.URLs.notificationById(notificationId) + `?app_id=${this.app_id}`,
        };
        return this._delete(options);
    }

    // **************************   Device/Player Methods   **********************************

    async getDevices(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.players,
            query: {
                app_id: this.app_id,
                ...params
            }
        };
        return this._get(options);
    }

    async getDevice(deviceId) {
        const options = {
            url: this.baseUrl + this.URLs.playerById(deviceId) + `?app_id=${this.app_id}`,
        };
        return this._get(options);
    }

    async addDevice(deviceData) {
        const options = {
            url: this.baseUrl + this.URLs.players,
            body: {
                app_id: this.app_id,
                ...deviceData
            }
        };
        return this._post(options);
    }

    async updateDevice(deviceId, deviceData) {
        const options = {
            url: this.baseUrl + this.URLs.playerById(deviceId),
            body: deviceData
        };
        return this._put(options);
    }

    async deleteDevice(deviceId) {
        const options = {
            url: this.baseUrl + this.URLs.playerById(deviceId) + `?app_id=${this.app_id}`,
        };
        return this._delete(options);
    }

    async exportDevices(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.playersCSV,
            query: {
                app_id: this.app_id,
                ...params
            }
        };
        return this._post(options);
    }

    async trackSession(deviceId, sessionData) {
        const options = {
            url: this.baseUrl + this.URLs.playersOnSession,
            body: {
                id: deviceId,
                app_id: this.app_id,
                ...sessionData
            }
        };
        return this._post(options);
    }

    async trackPurchase(deviceId, purchaseData) {
        const options = {
            url: this.baseUrl + this.URLs.playersOnPurchase,
            body: {
                id: deviceId,
                app_id: this.app_id,
                ...purchaseData
            }
        };
        return this._post(options);
    }

    async trackFocus(deviceId, focusData) {
        const options = {
            url: this.baseUrl + this.URLs.playersOnFocus,
            body: {
                id: deviceId,
                app_id: this.app_id,
                ...focusData
            }
        };
        return this._post(options);
    }

    // **************************   Segment Methods   **********************************

    async getSegments(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.segments + `?app_id=${this.app_id}`,
            query: params
        };
        return this._get(options);
    }

    async createSegment(segmentData) {
        const options = {
            url: this.baseUrl + this.URLs.segments,
            body: {
                app_id: this.app_id,
                ...segmentData
            }
        };
        return this._post(options);
    }

    async deleteSegment(segmentId) {
        const options = {
            url: this.baseUrl + this.URLs.segmentById(segmentId) + `?app_id=${this.app_id}`,
        };
        return this._delete(options);
    }

    // **************************   App Methods   **********************************

    async getApps() {
        const options = {
            url: this.baseUrl + this.URLs.apps,
        };
        return this._requestWithUserAuth(options.url, options);
    }

    async getApp(appId = null) {
        const id = appId || this.app_id;
        const options = {
            url: this.baseUrl + this.URLs.appById(id),
        };
        return this._requestWithUserAuth(options.url, options);
    }

    async createApp(appData) {
        const options = {
            url: this.baseUrl + this.URLs.apps,
            body: appData
        };
        return this._requestWithUserAuth(options.url, { ...options, method: 'POST' });
    }

    async updateApp(appId, appData) {
        const options = {
            url: this.baseUrl + this.URLs.appById(appId),
            body: appData
        };
        return this._requestWithUserAuth(options.url, { ...options, method: 'PUT' });
    }

    // **************************   Template Methods   **********************************

    async getTemplates(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.templates,
            query: {
                app_id: this.app_id,
                ...params
            }
        };
        return this._get(options);
    }

    async getTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId) + `?app_id=${this.app_id}`,
        };
        return this._get(options);
    }

    async createTemplate(templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templates,
            body: {
                app_id: this.app_id,
                ...templateData
            }
        };
        return this._post(options);
    }

    async updateTemplate(templateId, templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
            body: templateData
        };
        return this._put(options);
    }

    async deleteTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId) + `?app_id=${this.app_id}`,
        };
        return this._delete(options);
    }

    // **************************   Outcome Methods   **********************************

    async getOutcomes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.outcomes + `?app_id=${this.app_id}`,
            query: params
        };
        return this._get(options);
    }

    async getNotificationOutcomes(notificationId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.outcomesByNotification(notificationId),
            query: {
                app_id: this.app_id,
                ...params
            }
        };
        return this._get(options);
    }

    // **************************   Live Activity Methods (iOS)   **********************************

    async createLiveActivity(liveActivityData) {
        const options = {
            url: this.baseUrl + this.URLs.liveActivities,
            body: {
                app_id: this.app_id,
                ...liveActivityData
            }
        };
        return this._post(options);
    }

    async updateLiveActivity(liveActivityId, updateData) {
        const options = {
            url: this.baseUrl + this.URLs.liveActivityById(liveActivityId),
            body: updateData
        };
        return this._put(options);
    }

    async deleteLiveActivity(liveActivityId) {
        const options = {
            url: this.baseUrl + this.URLs.liveActivityById(liveActivityId) + `?app_id=${this.app_id}`,
        };
        return this._delete(options);
    }

    // **************************   Analytics Methods   **********************************

    async getNotificationAnalytics(notificationId) {
        try {
            const notification = await this.getNotification(notificationId);
            const outcomes = await this.getNotificationOutcomes(notificationId);
            
            return {
                notification: notification,
                analytics: {
                    sent: notification.successful || 0,
                    failed: notification.failed || 0,
                    delivered: notification.delivered || 0,
                    opened: notification.opened || 0,
                    converted: notification.converted || 0
                },
                outcomes: outcomes
            };
        } catch (error) {
            throw new Error(`Failed to get notification analytics: ${error.message}`);
        }
    }

    async getAppAnalytics(days = 30) {
        try {
            const app = await this.getApp();
            const notifications = await this.getNotifications({ limit: 50 });
            
            return {
                app: app,
                notifications: notifications,
                summary: {
                    total_notifications: notifications.total_count || 0,
                    active_users: app.players || 0
                }
            };
        } catch (error) {
            throw new Error(`Failed to get app analytics: ${error.message}`);
        }
    }

    // **************************   Helper Methods   **********************************

    createFilter(key, relation, value) {
        return {
            field: key,
            relation: relation,
            value: value
        };
    }

    createTagFilter(key, relation, value) {
        return this.createFilter(`tag.${key}`, relation, value);
    }

    createAudienceFilter(filters) {
        return {
            filters: filters
        };
    }

    // **************************   Error Handling   **********************************

    async handleError(error) {
        if (error.response && error.response.data) {
            const errorData = error.response.data;
            return {
                message: errorData.errors?.[0] || errorData.error || 'Unknown error',
                errors: errorData.errors || []
            };
        }
        return {
            message: error.message || 'Unknown error occurred'
        };
    }
}

module.exports = { Api };