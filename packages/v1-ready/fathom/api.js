const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Fathom (fathom.video) API client.
 *
 * Auth: API key sent in the `X-Api-Key` request header.
 *   curl https://api.fathom.ai/external/v1/meetings -H "X-Api-Key: YOUR_API_KEY"
 *
 * Base URL: https://api.fathom.ai/external/v1
 * Rate limit: 60 requests/minute across all of an account's API keys.
 *
 * Docs: https://developers.fathom.ai/
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'X-Api-Key';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        this.baseUrl = 'https://api.fathom.ai/external/v1';

        this.URLs = {
            meetings: '/meetings',
            teamMembers: '/team_members',
            transcript: (recordingId) =>
                `/recordings/${recordingId}/transcript`,
            summary: (recordingId) => `/recordings/${recordingId}/summary`,
            webhooks: '/webhooks',
        };
    }

    // ---- Query helpers -----------------------------------------------------

    /**
     * Build a query string that supports both scalar params and array params
     * (Fathom array filters use the `key[]` repeated-key convention). The core
     * Requester's built-in query builder can't emit repeated keys, so we build
     * the string here and append it to the URL directly.
     */
    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(`${key}[]`, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Meetings ----------------------------------------------------------

    /**
     * List meetings/recordings.
     * GET /meetings
     *
     * Supported params (all optional):
     *   cursor, created_after, created_before, meeting_type,
     *   include_transcript, include_summary, include_action_items,
     *   include_highlights, include_crm_matches,
     *   calendar_invitees_domains_type,
     *   recorded_by[] (array of emails), teams[] (array),
     *   calendar_invitees_domains[] (array of domains)
     *
     * Response: { limit, next_cursor, items: [ Meeting ] }
     * Each Meeting includes recording_id, title, meeting_title, share_url,
     * url, scheduled_start_time, recording_start_time/end_time,
     * calendar_invitees[{ name, email, email_domain, is_external }],
     * recorded_by{ name, email, email_domain, team }.
     */
    async listMeetings(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.meetings + this._buildQuery(params),
        });
    }

    /**
     * Convenience: page through every meeting, following `next_cursor`.
     * Returns a flat array of meeting items.
     */
    async listAllMeetings(params = {}, { maxPages = 50 } = {}) {
        const all = [];
        let cursor = params.cursor;
        let pages = 0;
        do {
            const page = await this.listMeetings({ ...params, cursor });
            if (Array.isArray(page.items)) all.push(...page.items);
            cursor = page.next_cursor;
            pages += 1;
        } while (cursor && pages < maxPages);
        return all;
    }

    // ---- Recording content -------------------------------------------------

    /**
     * Get a recording's transcript.
     * GET /recordings/{recording_id}/transcript
     *
     * With no destination_url the transcript is returned directly:
     *   { transcript: [ { speaker: { display_name,
     *     matched_calendar_invitee_email }, text, timestamp } ] }
     * With destination_url it is POSTed there asynchronously and the
     * endpoint returns { destination_url }.
     */
    async getTranscript(recordingId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.transcript(recordingId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a recording's summary.
     * GET /recordings/{recording_id}/summary
     *
     * Direct response: { summary: { template_name, markdown_formatted } }
     * Async (destination_url): { destination_url }
     */
    async getSummary(recordingId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.summary(recordingId) +
                this._buildQuery(params),
        });
    }

    // ---- Team members ------------------------------------------------------

    /**
     * List team members.
     * GET /team_members
     * Optional params: cursor, team (filter by team name).
     * Response: { limit, next_cursor, items: [ { name, email, created_at } ] }.
     */
    async listTeamMembers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.teamMembers + this._buildQuery(params),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Create a webhook.
     * POST /webhooks
     *
     * body: {
     *   destination_url,               // required
     *   triggered_for: [ 'my_recordings' | 'shared_external_recordings'
     *                    | 'my_shared_with_team_recordings'
     *                    | 'shared_team_recordings' ],   // required
     *   include_transcript?, include_summary?,
     *   include_action_items?, include_crm_matches?      // >=1 must be true
     * }
     *
     * Response: { id, url, secret, created_at, triggered_for, include_* }
     * The returned `secret` (whsec_...) verifies delivery signatures
     * (webhook-id / webhook-timestamp / webhook-signature headers, HMAC-SHA256).
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }
}

module.exports = { Api };
