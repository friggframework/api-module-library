const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Google Workspace client for Drive API v3 + Calendar API v3 (OAuth 2.0).
 *
 * Ported from a pre-v1 Manager-based module into the v2 Api + Definition shape.
 * Client-specific helpers (e.g. appProperties shortcuts) were stripped.
 *
 * Auth: Bearer access token from Google's authorization-code OAuth flow with
 *   access_type=offline and prompt=consent (refresh token).
 * Authorize: https://accounts.google.com/o/oauth2/v2/auth
 * Token: https://oauth2.googleapis.com/token
 * API base: https://www.googleapis.com  (paths /drive/v3/… and /calendar/v3/…)
 *
 * Identity uses Google OAuth2 userinfo (not part of Drive/Calendar discovery):
 *   GET https://www.googleapis.com/oauth2/v2/userinfo
 *
 * Official sources:
 *   https://developers.google.com/workspace/drive/api/reference/rest/v3
 *   https://developers.google.com/workspace/calendar/api/v3/reference
 *   https://www.googleapis.com/discovery/v1/apis/drive/v3/rest
 *   https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest
 *   https://developers.google.com/identity/protocols/oauth2
 *   https://developers.google.com/workspace/drive/api/guides/push
 *   https://developers.google.com/workspace/calendar/api/guides/push
 *
 * Sibling modules `google-drive` and `google-calendar` already exist in this
 * library; this package is the combined Workspace surface (Drive + Calendar)
 * in the v2 shape. Prefer this module for integrations that need both.
 *
 * The curated machine-readable contract lives in ./google-workspace.openapi.yaml
 * — this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 * getUserDetails is identity-only and intentionally outside that OpenAPI subset.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://www.googleapis.com';
        this.userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        const defaultScope = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ].join(' ');

        this.scope =
            this.scope || process.env.GOOGLE_WORKSPACE_SCOPE || defaultScope;

        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope,
            access_type: 'offline',
            include_granted_scopes: 'true',
            prompt: 'consent',
        });
        if (this.state) authParams.set('state', this.state);

        this.authorizationUri = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
        this.tokenUri = 'https://oauth2.googleapis.com/token';

        this.URLs = {
            // Drive
            about: '/drive/v3/about',
            drives: '/drive/v3/drives',
            files: '/drive/v3/files',
            fileById: (fileId) =>
                `/drive/v3/files/${encodeURIComponent(fileId)}`,
            fileExport: (fileId) =>
                `/drive/v3/files/${encodeURIComponent(fileId)}/export`,
            fileWatch: (fileId) =>
                `/drive/v3/files/${encodeURIComponent(fileId)}/watch`,
            changesStartPageToken: '/drive/v3/changes/startPageToken',
            changesWatch: '/drive/v3/changes/watch',
            driveChannelsStop: '/drive/v3/channels/stop',
            // Calendar
            calendarList: '/calendar/v3/users/me/calendarList',
            calendarById: (calendarId) =>
                `/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
            events: (calendarId) =>
                `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            eventById: (calendarId, eventId) =>
                `/calendar/v3/calendars/${encodeURIComponent(
                    calendarId
                )}/events/${encodeURIComponent(eventId)}`,
            eventsWatch: (calendarId) =>
                `/calendar/v3/calendars/${encodeURIComponent(
                    calendarId
                )}/events/watch`,
            calendarChannelsStop: '/calendar/v3/channels/stop',
        };
    }

    /** Authorize URL (offline + consent). Alias of getAuthorizationUri. */
    getAuthUri() {
        return this.authorizationUri;
    }

    getAuthorizationUri() {
        return this.authorizationUri;
    }

    setState(state) {
        this.state = state;
        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope,
            access_type: 'offline',
            include_granted_scopes: 'true',
            prompt: 'consent',
            state: state || '',
        });
        this.authorizationUri = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
    }

    /**
     * Build a query string. Supports scalar params and array params serialized
     * as repeated keys. Booleans become "true"/"false".
     */
    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else if (typeof value === 'boolean') {
                usp.append(key, value ? 'true' : 'false');
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        const url = options.url ? String(options.url) : '';
        if (url && !url.includes('oauth2.googleapis.com')) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    // ---- Identity (OAuth2 userinfo; not Drive/Calendar discovery) -----------

    /**
     * Get the authenticated Google user.
     * GET https://www.googleapis.com/oauth2/v2/userinfo
     * Requires userinfo.email / userinfo.profile (or openid) scopes.
     */
    async getUserDetails() {
        return this._get({
            url: this.userInfoUrl,
        });
    }

    // ---- Drive: about / drives ---------------------------------------------

    /**
     * Gets information about the user, the user's Drive, and system capabilities.
     * GET /drive/v3/about
     * Discovery id: drive.about.get
     */
    async getAbout(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.about + this._buildQuery(params),
        });
    }

    /**
     * Lists the user's shared drives.
     * GET /drive/v3/drives
     * Discovery id: drive.drives.list
     */
    async listDrives(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.drives + this._buildQuery(params),
        });
    }

    // ---- Drive: files ------------------------------------------------------

    /**
     * Lists the user's files.
     * GET /drive/v3/files
     * Discovery id: drive.files.list
     */
    async listFiles(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.files + this._buildQuery(params),
        });
    }

    /**
     * Gets a file's metadata or content by ID.
     * GET /drive/v3/files/{fileId}
     * Discovery id: drive.files.get
     * Pass query.alt=media for content; use returnFullRes for the raw response.
     */
    async getFile(fileId, params = {}, { returnFullRes = false } = {}) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.fileById(fileId) +
                this._buildQuery(params),
        };
        if (returnFullRes) options.returnFullRes = true;
        return this._get(options);
    }

    /**
     * Creates a file metadata resource (no media upload).
     * POST /drive/v3/files
     * Discovery id: drive.files.create
     * For content upload use the /upload/drive/v3/files resumable/media endpoints
     * (out of scope for this curated subset).
     */
    async createFile(data = {}, params = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.files + this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Updates a file's metadata (patch semantics).
     * PATCH /drive/v3/files/{fileId}
     * Discovery id: drive.files.update
     */
    async updateFile(fileId, data = {}, params = {}) {
        return this._patch({
            url:
                this.baseUrl +
                this.URLs.fileById(fileId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Exports a Google Workspace document to the requested MIME type.
     * GET /drive/v3/files/{fileId}/export
     * Discovery id: drive.files.export
     * Required query: mimeType
     */
    async exportFile(fileId, params = {}, { returnFullRes = true } = {}) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.fileExport(fileId) +
                this._buildQuery(params),
            returnFullRes,
        };
        return this._get(options);
    }

    // ---- Drive: changes / watch / channels ---------------------------------

    /**
     * Gets the starting pageToken for listing future changes.
     * GET /drive/v3/changes/startPageToken
     * Discovery id: drive.changes.getStartPageToken
     */
    async getChangesStartPageToken(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.changesStartPageToken +
                this._buildQuery(params),
        });
    }

    /**
     * Subscribes to changes for a file.
     * POST /drive/v3/files/{fileId}/watch
     * Discovery id: drive.files.watch
     * Body: Channel { id, type: "web_hook", address, token?, expiration? }
     */
    async watchFile(fileId, data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.fileWatch(fileId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Subscribes to changes for a user.
     * POST /drive/v3/changes/watch
     * Discovery id: drive.changes.watch
     * Required query: pageToken (from getChangesStartPageToken)
     * Body: Channel
     */
    async watchChanges(data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.changesWatch +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Stops watching resources through this Drive channel.
     * POST /drive/v3/channels/stop
     * Discovery id: drive.channels.stop
     * Body: { id, resourceId }
     */
    async stopDriveChannel(data) {
        return this._post({
            url: this.baseUrl + this.URLs.driveChannelsStop,
            body: data,
        });
    }

    // ---- Calendar: calendars -----------------------------------------------

    /**
     * Returns the calendars on the user's calendar list.
     * GET /calendar/v3/users/me/calendarList
     * Discovery id: calendar.calendarList.list
     */
    async listCalendars(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.calendarList +
                this._buildQuery(params),
        });
    }

    /**
     * Returns metadata for a calendar.
     * GET /calendar/v3/calendars/{calendarId}
     * Discovery id: calendar.calendars.get
     */
    async getCalendar(calendarId) {
        return this._get({
            url: this.baseUrl + this.URLs.calendarById(calendarId),
        });
    }

    // ---- Calendar: events --------------------------------------------------

    /**
     * Returns events on the specified calendar.
     * GET /calendar/v3/calendars/{calendarId}/events
     * Discovery id: calendar.events.list
     */
    async listEvents(calendarId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.events(calendarId) +
                this._buildQuery(params),
        });
    }

    /**
     * Returns an event based on its Google Calendar ID.
     * GET /calendar/v3/calendars/{calendarId}/events/{eventId}
     * Discovery id: calendar.events.get
     */
    async getEvent(calendarId, eventId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.eventById(calendarId, eventId) +
                this._buildQuery(params),
        });
    }

    /**
     * Creates an event.
     * POST /calendar/v3/calendars/{calendarId}/events
     * Discovery id: calendar.events.insert
     */
    async createEvent(calendarId, data = {}, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.events(calendarId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Updates an event (patch semantics).
     * PATCH /calendar/v3/calendars/{calendarId}/events/{eventId}
     * Discovery id: calendar.events.patch
     */
    async updateEvent(calendarId, eventId, data = {}, params = {}) {
        return this._patch({
            url:
                this.baseUrl +
                this.URLs.eventById(calendarId, eventId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Watch for changes to Calendar events.
     * POST /calendar/v3/calendars/{calendarId}/events/watch
     * Discovery id: calendar.events.watch
     * Body: Channel
     */
    async watchCalendarEvents(calendarId, data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.eventsWatch(calendarId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Stop watching resources through this Calendar channel.
     * POST /calendar/v3/channels/stop
     * Discovery id: calendar.channels.stop
     * Body: { id, resourceId }
     */
    async stopCalendarChannel(data) {
        return this._post({
            url: this.baseUrl + this.URLs.calendarChannelsStop,
            body: data,
        });
    }
}

module.exports = { Api };
