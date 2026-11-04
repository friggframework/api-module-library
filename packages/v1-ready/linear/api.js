const {get, OAuth2Requester} = require('@friggframework/core');
const {LinearClient} = require('@linear/sdk');

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

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.webhookSecret = (params && params.webhookSecret) || null;
        this.actor = get(params, 'actor', 'application');
        this.access_token = get(params, 'access_token', null);
        this.authorizationUri = encodeURI(
            `https://linear.app/oauth/authorize?response_type=code` +
            `&scope=${this.scope}` +
            `&client_id=${this.client_id}` +
            `&redirect_uri=${this.redirect_uri}` +
            `&state=${this.state}` +
            `&actor=${this.actor}`
        );
        this.tokenUri = 'https://api.linear.app/oauth/token';
    }

    getClient() {
        if (!this.client) {
            this.client = new LinearClient({accessToken: this.access_token});
        }
        return this.client;
    }


    async getTokenIdentity() {
        const user = await this.getUser();
        const org = await this.getOrganization();
        return {identifier: org.id, name: user.name};
    }

    async getUser() {
        return this.getClient().viewer;
    }

    async getOrganization() {
        return this.getClient().organization;
    }

    async getUsers() {
        return (await this.getClient().users()).nodes;
    }

    async getUserIssues(user) {
        return user.assignedIssues();
    }

    async getProjects() {
        return (await this.getClient().projects()).nodes;
    }


    /**
     * Verify a Linear webhook delivery (Linear-Signature).
     * Docs: https://linear.app/developers/webhooks
     *
     * Hex HMAC-SHA256 of the raw body keyed with the webhook's signing secret, plus the body's
     * `webhookTimestamp` (ms) must be within 60 seconds of now. Pass `rawBody`.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, now } = {}) {
        try {
            const secret = this.webhookSecret || process.env.LINEAR_WEBHOOK_SECRET;
            if (!secret) return false;
            const signature = whHeader(headers, 'linear-signature');
            if (!signature) return false;
            const payload = whPayload(rawBody, body);
            const expected = whHmac(secret, [payload], 'hex');
            if (!whSafeEqual(expected, String(signature).trim().toLowerCase())) {
                return false;
            }
            let parsed = body;
            if (rawBody !== undefined && rawBody !== null) {
                parsed = JSON.parse(payload.toString('utf8'));
            } else if (typeof body === 'string') {
                parsed = JSON.parse(body);
            }
            const ts = Number(parsed && parsed.webhookTimestamp);
            if (!Number.isFinite(ts)) return false;
            return Math.abs(whNowMs(now) - ts) <= 60 * 1000;
        } catch (e) {
            return false;
        }
    }
}

module.exports = {Api};
