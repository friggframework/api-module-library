const { OAuth2Requester, get } = require('@friggframework/core');

// YouTube Data API v3
// https://developers.google.com/youtube/v3
// Core resources: channels, videos, playlists, search, subscriptions

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        
        this.URLs = {
            // Channels
            channels: '/channels',
            
            // Videos
            videos: '/videos',
            
            // Playlists
            playlists: '/playlists',
            playlistItems: '/playlistItems',
            
            // Search
            search: '/search',
            
            // Subscriptions
            subscriptions: '/subscriptions',
            
            // Comments
            comments: '/comments',
            commentThreads: '/commentThreads',
        };

        this.authorizationUri = encodeURI(
            `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&response_type=code&state=${this.state}&access_type=offline`
        );
        this.tokenUri = 'https://oauth2.googleapis.com/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        const options = {
            url: this.tokenUri,
            form: {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                code: code,
                redirect_uri: this.redirect_uri,
            },
        };

        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        this.refresh_token = get(params, 'refresh_token');

        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(Date.now() + accessExpiresIn * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addAuthHeaders(options) {
        const authHeaders = {
            'Authorization': `Bearer ${this.access_token}`,
            'Accept': 'application/json',
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }

    // **************************   Channels   **********************************

    async getChannels(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.channels,
            query: { part: 'snippet,contentDetails,statistics', ...params },
        };
        return this._get(options);
    }

    async getMyChannel() {
        return this.getChannels({ mine: true });
    }

    // **************************   Videos   **********************************

    async getVideos(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.videos,
            query: { part: 'snippet,contentDetails,statistics', ...params },
        };
        return this._get(options);
    }

    async uploadVideo(body) {
        // Note: Video uploads require multipart/form-data and resumable uploads
        // This is a simplified version - full implementation would handle file uploads
        const options = {
            url: this.baseUrl + this.URLs.videos,
            query: { part: 'snippet,status' },
            body: body,
        };
        return this._post(options);
    }

    // **************************   Playlists   **********************************

    async getPlaylists(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.playlists,
            query: { part: 'snippet,contentDetails', ...params },
        };
        return this._get(options);
    }

    async createPlaylist(body) {
        const options = {
            url: this.baseUrl + this.URLs.playlists,
            query: { part: 'snippet,status' },
            body: body,
        };
        return this._post(options);
    }

    // **************************   Search   **********************************

    async search(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.search,
            query: { part: 'snippet', ...params },
        };
        return this._get(options);
    }

    // **************************   Subscriptions   **********************************

    async getSubscriptions(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            query: { part: 'snippet,contentDetails', ...params },
        };
        return this._get(options);
    }

    async subscribe(channelId) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            query: { part: 'snippet' },
            body: {
                snippet: {
                    resourceId: {
                        kind: 'youtube#channel',
                        channelId: channelId
                    }
                }
            },
        };
        return this._post(options);
    }
}

module.exports = { Api };