/**
 * Microsoft Graph change-notification authenticity checks.
 *
 * Graph does not HMAC-sign notification bodies. Authenticity is the
 * `clientState` value you set when creating the subscription; each notification
 * item echoes it and your receiver must reject mismatches.
 *
 * Subscription validation handshake:
 *   POST {notificationUrl}?validationToken={opaqueToken}
 * Respond with HTTP 200 and the raw token as `text/plain` within ~10s.
 *
 * @see https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 */

function getHeader(headers, name) {
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

/**
 * Extract the Graph validationToken from query string (Express req.query or URL).
 * @param {import('express').Request|Object} req
 * @returns {string|undefined}
 */
function extractValidationToken(req) {
    if (!req || typeof req !== 'object') return undefined;
    if (req.query && req.query.validationToken) {
        return String(req.query.validationToken);
    }
    const url = req.url || req.originalUrl;
    if (typeof url === 'string' && url.includes('validationToken=')) {
        try {
            const parsed = new URL(url, 'http://localhost');
            const token = parsed.searchParams.get('validationToken');
            return token || undefined;
        } catch (_e) {
            return undefined;
        }
    }
    return undefined;
}

/**
 * Verify clientState on one notification item (or a batch).
 * @param {Object} args
 * @param {string|Object|Object[]} args.notification - item, batch, or raw clientState
 * @param {string} args.expectedClientState
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyGraphClientState({ notification, expectedClientState }) {
    if (!expectedClientState || typeof expectedClientState !== 'string') {
        return { valid: false, reason: 'missing expected clientState' };
    }

    const items = normalizeNotificationItems(notification);
    if (items.length === 0) {
        return { valid: false, reason: 'no notification items' };
    }

    for (let i = 0; i < items.length; i += 1) {
        const state = items[i] && items[i].clientState;
        if (state === undefined || state === null) {
            return {
                valid: false,
                reason: `notification[${i}] missing clientState`,
            };
        }
        if (String(state) !== String(expectedClientState)) {
            return {
                valid: false,
                reason: `notification[${i}] clientState mismatch`,
            };
        }
    }
    return { valid: true };
}

function normalizeNotificationItems(notification) {
    if (notification === undefined || notification === null) return [];
    if (typeof notification === 'string') {
        return [{ clientState: notification }];
    }
    if (Array.isArray(notification)) {
        return notification;
    }
    if (Array.isArray(notification.value)) {
        return notification.value;
    }
    if (notification.clientState !== undefined) {
        return [notification];
    }
    return [];
}

/**
 * Pull tenant id for routing from a Graph notification item.
 * Graph change notifications include `tenantId` on each item.
 */
function extractTenantId(item) {
    if (!item || typeof item !== 'object') return undefined;
    return item.tenantId || item.tenant_id || undefined;
}

module.exports = {
    getHeader,
    extractValidationToken,
    verifyGraphClientState,
    normalizeNotificationItems,
    extractTenantId,
};
