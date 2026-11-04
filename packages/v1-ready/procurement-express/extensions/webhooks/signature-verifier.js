/**
 * Verify a ProcurementExpress webhook delivery.
 *
 * Official docs do not document an HMAC signature header. Webhook
 * subscriptions may configure HTTP Basic Auth (`basic_auth_uname` /
 * `basic_auth_pword` on create/update webhook). When credentials are set in
 * the environment, require a matching Authorization: Basic header.
 *
 * Docs: https://docs.procurementexpress.com/ (Webhooks)
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage & { headers?: object }} opts.req
 * @param {string} [opts.username]
 * @param {string} [opts.password]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyProcurementExpressWebhook({
    req,
    username,
    password,
} = {}) {
    const user =
        username || process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_USER;
    const pass =
        password || process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_PASSWORD;

    if (!user && !pass) {
        // Hosts that have not configured Basic Auth can skip verification
        // in local/dev; production should set the webhook credentials.
        return { valid: true, reason: 'basic_auth_not_configured' };
    }

    const headers = req?.headers || {};
    const auth =
        headers.authorization ||
        headers.Authorization ||
        headers.AUTHORIZATION;

    if (!auth || typeof auth !== 'string') {
        return { valid: false, reason: 'missing_authorization_header' };
    }

    const match = /^Basic\s+(.+)$/i.exec(auth.trim());
    if (!match) {
        return { valid: false, reason: 'not_basic_auth' };
    }

    let decoded;
    try {
        decoded = Buffer.from(match[1], 'base64').toString('utf8');
    } catch (e) {
        return { valid: false, reason: 'invalid_basic_auth_encoding' };
    }

    const sep = decoded.indexOf(':');
    const gotUser = sep === -1 ? decoded : decoded.slice(0, sep);
    const gotPass = sep === -1 ? '' : decoded.slice(sep + 1);

    if (gotUser !== String(user || '') || gotPass !== String(pass || '')) {
        return { valid: false, reason: 'basic_auth_mismatch' };
    }
    return { valid: true };
}

module.exports = { verifyProcurementExpressWebhook };
