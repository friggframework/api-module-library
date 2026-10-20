const { verifyHs256Jwt } = require('../../api');

/**
 * Verify Jira OAuth 2.0 dynamic webhook JWT (Authorization bearer) against the
 * app client secret.
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/webhooks/
 *   ("Webhooks authentication for OAuth 2.0 apps")
 */
function verifyJiraWebhookSignature({
    req,
    headers,
    authorization,
    clientSecret,
} = {}) {
    const hdrs = headers || (req && req.headers) || {};
    const auth =
        authorization ||
        hdrs.Authorization ||
        hdrs.authorization;
    const secret =
        clientSecret || process.env.JIRA_CLIENT_SECRET || null;

    if (!secret) {
        return { valid: false, reason: 'missing_client_secret' };
    }
    if (!auth) {
        return { valid: false, reason: 'missing_authorization' };
    }
    return verifyHs256Jwt(auth, secret);
}

module.exports = { verifyJiraWebhookSignature };
