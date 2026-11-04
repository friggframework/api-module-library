/**
 * Google Drive / Calendar push-notification verification helpers.
 *
 * Google does not HMAC-sign webhook bodies. Security relies on:
 *   1. HTTPS endpoint with a valid SSL certificate
 *   2. Matching the opaque channel `token` you set on watch → echoed as
 *      `X-Goog-Channel-Token` on every notification
 *
 * Docs:
 *   https://developers.google.com/workspace/drive/api/guides/push
 *   https://developers.google.com/workspace/calendar/api/guides/push
 */

/**
 * Normalize Express / Node header maps (lower-case keys).
 * @param {Object} headers
 * @param {string} name
 * @returns {string|undefined}
 */
function getHeader(headers, name) {
    if (!headers) return undefined;
    const want = String(name).toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
        if (String(k).toLowerCase() === want) {
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/**
 * Extract Google push-notification headers from a request.
 * @param {import('express').Request|Object} req
 * @returns {Object}
 */
function extractGooglePushHeaders(req) {
    const headers = (req && req.headers) || {};
    return {
        channelId: getHeader(headers, 'x-goog-channel-id'),
        channelToken: getHeader(headers, 'x-goog-channel-token'),
        channelExpiration: getHeader(headers, 'x-goog-channel-expiration'),
        resourceId: getHeader(headers, 'x-goog-resource-id'),
        resourceUri: getHeader(headers, 'x-goog-resource-uri'),
        resourceState: getHeader(headers, 'x-goog-resource-state'),
        messageNumber: getHeader(headers, 'x-goog-message-number'),
        changed: getHeader(headers, 'x-goog-changed'),
    };
}

/**
 * Verify that the notification carries the expected channel token.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} [args.expectedChannelToken]
 * @returns {{ valid: boolean, reason?: string, headers: Object }}
 */
function verifyGoogleChannelToken({ req, expectedChannelToken }) {
    const headers = extractGooglePushHeaders(req);

    if (!headers.channelId || !headers.resourceId || !headers.resourceState) {
        return {
            valid: false,
            reason: 'missing required X-Goog-* headers',
            headers,
        };
    }

    if (!expectedChannelToken) {
        // Token is optional on watch; if the host did not configure one, accept
        // notifications that also omit the header (still require core headers).
        return { valid: true, headers };
    }

    if (headers.channelToken !== expectedChannelToken) {
        return {
            valid: false,
            reason: 'X-Goog-Channel-Token mismatch',
            headers,
        };
    }

    return { valid: true, headers };
}

module.exports = {
    getHeader,
    extractGooglePushHeaders,
    verifyGoogleChannelToken,
};
