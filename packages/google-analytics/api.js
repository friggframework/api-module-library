const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://analyticsreporting.googleapis.com/v4';

        this.URLs = {
            // Reports
            reports: '/reports:batchGet',
            
            // Real-time
            realtime: '/realtime/reports:batchGet',
            
            // Management API
            accounts: '/management/accounts',
            accountById: (accountId) => `/management/accounts/${accountId}`,
            properties: (accountId) => `/management/accounts/${accountId}/webproperties`,
            propertyById: (accountId, propertyId) => `/management/accounts/${accountId}/webproperties/${propertyId}`,
            profiles: (accountId, propertyId) => `/management/accounts/${accountId}/webproperties/${propertyId}/profiles`,
            profileById: (accountId, propertyId, profileId) => `/management/accounts/${accountId}/webproperties/${propertyId}/profiles/${profileId}`,
            
            // Custom dimensions
            customDimensions: (accountId, propertyId) => `/management/accounts/${accountId}/webproperties/${propertyId}/customDimensions`,
            customMetrics: (accountId, propertyId) => `/management/accounts/${accountId}/webproperties/${propertyId}/customMetrics`,
            
            // Goals
            goals: (accountId, propertyId, profileId) => `/management/accounts/${accountId}/webproperties/${propertyId}/profiles/${profileId}/goals`,
        };

        this.authorizationUri = encodeURI(
            `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}&access_type=offline`
        );
        this.tokenUri = 'https://oauth2.googleapis.com/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);

        if (newRefreshToken) {
            this.refresh_token = newRefreshToken;
        }

        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(Date.now() + accessExpiresIn * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Reports   **********************************

    async batchGetReports(reportRequests) {
        const options = {
            url: this.baseUrl + this.URLs.reports,
            body: {
                reportRequests: reportRequests
            },
        };
        return this._post(options);
    }

    async getReport(viewId, startDate, endDate, metrics, dimensions = []) {
        const reportRequest = {
            viewId: viewId,
            dateRanges: [{
                startDate: startDate,
                endDate: endDate
            }],
            metrics: metrics.map(metric => ({ expression: metric })),
            dimensions: dimensions.map(dimension => ({ name: dimension }))
        };
        
        return this.batchGetReports([reportRequest]);
    }

    // **************************   Real-time   **********************************

    async getRealtimeReports(reportRequests) {
        const options = {
            url: this.baseUrl + this.URLs.realtime,
            body: {
                reportRequests: reportRequests
            },
        };
        return this._post(options);
    }

    // **************************   Management API   **********************************

    async listAccounts() {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.accounts,
        };
        return this._get(options);
    }

    async getAccount(accountId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.accountById(accountId),
        };
        return this._get(options);
    }

    async listProperties(accountId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.properties(accountId),
        };
        return this._get(options);
    }

    async getProperty(accountId, propertyId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.propertyById(accountId, propertyId),
        };
        return this._get(options);
    }

    async listProfiles(accountId, propertyId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.profiles(accountId, propertyId),
        };
        return this._get(options);
    }

    async getProfile(accountId, propertyId, profileId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.profileById(accountId, propertyId, profileId),
        };
        return this._get(options);
    }

    // **************************   Custom Dimensions & Metrics   **********************************

    async listCustomDimensions(accountId, propertyId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.customDimensions(accountId, propertyId),
        };
        return this._get(options);
    }

    async createCustomDimension(accountId, propertyId, body) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.customDimensions(accountId, propertyId),
            body: body,
        };
        return this._post(options);
    }

    async listCustomMetrics(accountId, propertyId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.customMetrics(accountId, propertyId),
        };
        return this._get(options);
    }

    async createCustomMetric(accountId, propertyId, body) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.customMetrics(accountId, propertyId),
            body: body,
        };
        return this._post(options);
    }

    // **************************   Goals   **********************************

    async listGoals(accountId, propertyId, profileId) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.goals(accountId, propertyId, profileId),
        };
        return this._get(options);
    }

    async createGoal(accountId, propertyId, profileId, body) {
        const options = {
            url: 'https://www.googleapis.com/analytics/v3' + this.URLs.goals(accountId, propertyId, profileId),
            body: body,
        };
        return this._post(options);
    }
}

module.exports = { Api };