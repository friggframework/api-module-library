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
const crypto = require('crypto');

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes the vendor signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function whNowMs(now) {
    if (now instanceof Date) return now.getTime();
    return typeof now === 'number' ? now : Date.now();
}

function whHmac(key, parts, encoding) {
    const h = crypto.createHmac('sha256', key);
    for (const p of parts) h.update(p);
    return h.digest(encoding);
}

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);
        this.webhookSecret = (params && params.webhookSecret) || null;

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

    /**
     * Delete a webhook.
     * DELETE /webhooks/{id}  (204 on success, 404 if unknown)
     * Docs: https://developers.fathom.ai/api-reference/webhooks/delete-a-webhook
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhooks + '/' + id,
        });
    }

    /**
     * Verify a Fathom webhook delivery (Standard Webhooks style).
     * Docs: https://developers.fathom.ai/webhooks
     *
     * Headers webhook-id, webhook-timestamp (seconds), webhook-signature (space-separated `v1,<base64>`).
     * Signed content is `${id}.${timestamp}.${raw body}`; HMAC-SHA256 keyed with the base64-decoded part
     * of the `whsec_` secret; base64 digest; 5 minute tolerance. Pass `rawBody`.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, now } = {}) {
        try {
            const secret = this.webhookSecret || process.env.FATHOM_WEBHOOK_SECRET;
            if (!secret) return false;
            const id = whHeader(headers, 'webhook-id');
            const timestamp = whHeader(headers, 'webhook-timestamp');
            const header = whHeader(headers, 'webhook-signature');
            if (!id || !timestamp || !header) return false;
            const ts = Number(timestamp);
            if (!Number.isFinite(ts)) return false;
            if (Math.abs(whNowMs(now) / 1000 - ts) > 300) return false;
            const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
            const expected = whHmac(
                key,
                [`${id}.${timestamp}.`, whPayload(rawBody, body)],
                'base64'
            );
            let ok = false;
            for (const entry of String(header).split(' ')) {
                const i = entry.indexOf(',');
                if (i < 0 || entry.slice(0, i) !== 'v1') continue;
                if (whSafeEqual(expected, entry.slice(i + 1))) ok = true;
            }
            return ok;
        } catch (e) {
            return false;
        }
    }
}

module.exports = { Api };
