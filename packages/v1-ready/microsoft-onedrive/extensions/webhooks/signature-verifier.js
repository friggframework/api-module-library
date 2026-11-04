/**
 * Microsoft Graph change-notification validation helpers.
 *
 * Graph does not HMAC-sign webhook bodies the way HubSpot/Square do. Security
 * relies on:
 *   1. HTTPS endpoint + validationToken handshake on subscribe
 *   2. Matching the opaque `clientState` set on createSubscription
 *
 * Docs: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 */

/**
 * Extract Graph's subscription validation token from query string.
 * @param {import('express').Request|Object} req
 * @returns {string|null}
 */
function extractValidationToken(req) {
    const q = (req && req.query) || {};
    const token = q.validationToken || q.validationtoken;
    if (token === undefined || token === null || token === '') return null;
    return String(token);
}

/**
 * Verify that every notification in the payload carries the expected clientState.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.expectedClientState
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyGraphClientState({ req, expectedClientState }) {
    if (!expectedClientState) {
        return {
            valid: false,
            reason: 'missing MICROSOFT_ONEDRIVE_WEBHOOK_CLIENT_STATE',
        };
    }

    const body = req && req.body;
    const notifications = Array.isArray(body?.value) ? body.value : null;
    if (!notifications) {
        return { valid: false, reason: 'missing value[] notifications array' };
    }
    if (notifications.length === 0) {
        // Empty batch — nothing to verify; allow through.
        return { valid: true };
    }

    for (let i = 0; i < notifications.length; i++) {
        const state = notifications[i] && notifications[i].clientState;
        if (state !== expectedClientState) {
            return {
                valid: false,
                reason: `clientState mismatch at notification[${i}]`,
            };
        }
    }
    return { valid: true };
}

module.exports = {
    extractValidationToken,
    verifyGraphClientState,
};
