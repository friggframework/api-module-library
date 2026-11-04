const crypto = require('crypto');

/**
 * Verify an Etsy webhook delivery signature (Svix-style).
 *
 * Headers:
 *   webhook-id        — unique delivery id
 *   webhook-timestamp — unix seconds
 *   webhook-signature — space-separated list; entries may be `v1,<base64>`
 *
 * signed_content = webhook-id + "." + webhook-timestamp + "." + raw_body
 * secret_bytes   = base64_decode(secret without `whsec_` prefix)
 * expected       = base64(HMAC-SHA256(secret_bytes, signed_content))
 *
 * @see https://developers.etsy.com/documentation/essentials/webhooks
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage & { rawBody?: Buffer|string, body?: any }} opts.req
 * @param {string} [opts.signingSecret] - portal signing secret (`whsec_…`)
 * @param {number} [opts.maxSkewSeconds=300]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyEtsyWebhook({
    req,
    signingSecret,
    maxSkewSeconds = 300,
} = {}) {
    const secret =
        signingSecret || process.env.ETSY_WEBHOOK_SIGNING_SECRET || null;
    if (!secret) {
        // Hosts that have not persisted a portal secret yet can skip
        // verification in local/dev; production should always set the secret.
        return { valid: true, reason: 'signing_secret_not_configured' };
    }

    const headers = req?.headers || {};
    const webhookId = getHeader(headers, 'webhook-id');
    const timestamp = getHeader(headers, 'webhook-timestamp');
    const signatureHeader = getHeader(headers, 'webhook-signature');

    if (!webhookId || !timestamp || !signatureHeader) {
        return { valid: false, reason: 'missing_signature_headers' };
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
        return { valid: false, reason: 'invalid_timestamp' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > maxSkewSeconds) {
        return { valid: false, reason: 'stale_timestamp' };
    }

    const raw = extractBodyString(req);
    if (raw === null) {
        return { valid: false, reason: 'missing_body' };
    }

    let keyBuf;
    try {
        const withoutPrefix = String(secret).includes('_')
            ? String(secret).split('_').slice(1).join('_')
            : String(secret);
        keyBuf = Buffer.from(withoutPrefix, 'base64');
    } catch (e) {
        return { valid: false, reason: 'invalid_signing_secret' };
    }
    if (!keyBuf || keyBuf.length === 0) {
        return { valid: false, reason: 'invalid_signing_secret' };
    }

    const signedContent = `${webhookId}.${timestamp}.${raw}`;
    const expected = crypto
        .createHmac('sha256', keyBuf)
        .update(signedContent, 'utf8')
        .digest('base64');

    const candidates = String(signatureHeader)
        .split(/[\s,]+/)
        .map((part) => {
            const p = part.trim();
            if (!p) return null;
            // Accept `v1,<sig>` or bare base64 signatures.
            if (p.includes(',')) {
                const [, sig] = p.split(',');
                return sig || null;
            }
            if (p.startsWith('v1=')) return p.slice(3);
            return p;
        })
        .filter(Boolean);

    for (const candidate of candidates) {
        const a = Buffer.from(candidate, 'utf8');
        const b = Buffer.from(expected, 'utf8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
            return { valid: true };
        }
    }
    return { valid: false, reason: 'signature_mismatch' };
}

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function extractBodyString(req) {
    if (!req) return null;
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    if (req.body && typeof req.body === 'object') {
        return JSON.stringify(req.body);
    }
    return null;
}

module.exports = { verifyEtsyWebhook };
