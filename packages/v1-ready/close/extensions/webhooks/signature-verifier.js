const crypto = require('crypto');

/**
 * Verify a Close webhook delivery signature.
 *
 * Headers:
 *   close-sig-timestamp — unix timestamp string
 *   close-sig-hash      — hex HMAC-SHA256
 *
 * Signature = HMAC-SHA256(key=bytearray.fromhex(signature_key),
 *                         data=timestamp + raw_body)
 *
 * @see https://developer.close.com/api/resources/webhooks.md
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage & { rawBody?: Buffer|string, body?: any }} opts.req
 * @param {string} [opts.signatureKey] - hex signature_key from createWebhook
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyCloseWebhook({ req, signatureKey }) {
    const key = signatureKey || process.env.CLOSE_WEBHOOK_SIGNATURE_KEY;
    if (!key) {
        // Hosts that have not persisted a per-subscription key yet can skip
        // verification in local/dev; production should always set the key.
        return { valid: true, reason: 'signature_key_not_configured' };
    }

    const headers = req?.headers || {};
    const hash =
        headers['close-sig-hash'] ||
        headers['Close-Sig-Hash'] ||
        headers['CLOSE-SIG-HASH'];
    const timestamp =
        headers['close-sig-timestamp'] ||
        headers['Close-Sig-Timestamp'] ||
        headers['CLOSE-SIG-TIMESTAMP'];

    if (!hash || !timestamp) {
        return { valid: false, reason: 'missing_signature_headers' };
    }

    let raw;
    if (req.rawBody !== undefined && req.rawBody !== null) {
        raw =
            typeof req.rawBody === 'string'
                ? req.rawBody
                : Buffer.from(req.rawBody).toString('utf8');
    } else if (typeof req.body === 'string') {
        raw = req.body;
    } else if (req.body && typeof req.body === 'object') {
        raw = JSON.stringify(req.body);
    } else {
        return { valid: false, reason: 'missing_body' };
    }

    const data = String(timestamp) + raw;
    let keyBuf;
    try {
        keyBuf = Buffer.from(String(key), 'hex');
    } catch (e) {
        return { valid: false, reason: 'invalid_signature_key_hex' };
    }
    if (keyBuf.length === 0) {
        return { valid: false, reason: 'invalid_signature_key_hex' };
    }

    const expected = crypto
        .createHmac('sha256', keyBuf)
        .update(data, 'utf8')
        .digest('hex');

    const a = Buffer.from(String(hash), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
        return { valid: false, reason: 'signature_mismatch' };
    }
    const ok = crypto.timingSafeEqual(a, b);
    return ok ? { valid: true } : { valid: false, reason: 'signature_mismatch' };
}

module.exports = { verifyCloseWebhook };
