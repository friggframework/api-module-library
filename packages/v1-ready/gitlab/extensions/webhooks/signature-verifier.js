const { Api } = require('../../api');

/**
 * Verify an inbound GitLab webhook using Api.verifyWebhookSignature.
 *
 * Prefer Standard Webhooks HMAC (`webhook-signature` + signing_token / whsec_).
 * Fall back to legacy `X-Gitlab-Token` plain secret when no signature headers
 * are present.
 *
 * Docs: https://docs.gitlab.com/user/project/integrations/webhooks/
 */
function verifyGitLabWebhookSignature({
    req,
    headers,
    rawBody,
    body,
    secret,
    signingToken,
} = {}) {
    const hdrs = headers || (req && req.headers) || {};
    const payload =
        body !== undefined
            ? body
            : req && req.body !== undefined
              ? req.body
              : undefined;
    const raw =
        rawBody !== undefined
            ? rawBody
            : req && req.rawBody !== undefined
              ? req.rawBody
              : undefined;

    const api = new Api({});
    return api.verifyWebhookSignature({
        headers: hdrs,
        rawBody: raw,
        body: payload,
        secret,
        signingToken,
    });
}

module.exports = { verifyGitLabWebhookSignature };
