const { verifySlackSignature } = require('./signature-verifier');
const { findIntegrationByTeamId } = require('./lookup');

/**
 * Extract a workspace team_id from a Slack Events API (or interactivity) body.
 */
function extractTeamId(body) {
    if (!body || typeof body !== 'object') return null;
    if (body.team_id) return String(body.team_id);
    if (body.team && body.team.id) return String(body.team.id);
    // Interactivity payloads sometimes nest under `team`
    if (body.payload) {
        try {
            const parsed =
                typeof body.payload === 'string'
                    ? JSON.parse(body.payload)
                    : body.payload;
            if (parsed?.team?.id) return String(parsed.team.id);
            if (parsed?.team_id) return String(parsed.team_id);
        } catch (_e) {
            // ignore
        }
    }
    return null;
}

/**
 * Receiver for POST /webhooks — DB-free.
 * Handles Events API url_verification challenges, verifies the signing secret,
 * then enqueues SLACK_WEBHOOK_RESOLVE with team_id for tenant lookup.
 *
 * @see https://docs.slack.dev/apis/events-api
 * @see https://docs.slack.dev/authentication/verifying-requests-from-slack
 */
async function onSlackWebhookReceived({ req, res }) {
    const verification = await verifySlackSignature({
        req,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[slack-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};

    // URL verification handshake — must return the challenge plaintext JSON.
    if (body.type === 'url_verification' && body.challenge) {
        res.status(200).json({ challenge: body.challenge });
        return;
    }

    const teamId = extractTeamId(body);
    if (!teamId) {
        console.warn(
            '[slack-webhooks] event missing team_id; acknowledging without enqueue'
        );
        res.status(200).json({ received: true, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'SLACK_WEBHOOK_RESOLVE',
        body: {
            teamId,
            event: body,
        },
    });

    res.status(200).json({ received: true, queued: 1, skipped: 0 });
}

/**
 * SLACK_WEBHOOK_RESOLVE — worker hop with DB. Looks up team_id → integration,
 * then re-enqueues SLACK_WEBHOOK bound to that id.
 */
async function onSlackWebhookResolve({ data }) {
    const body = data && data.body;
    const teamId = body && body.teamId;
    if (teamId === undefined || teamId === null) {
        console.warn(
            '[slack-webhooks] resolve: event missing teamId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByTeamId(this, teamId);
    if (!integrationId) {
        console.warn(
            `[slack-webhooks] resolve: no integration for teamId=${teamId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SLACK_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * SLACK_WEBHOOK — default no-op; override via binding.handlers.
 */
async function onSlackWebhook({ data }) {
    // no-op — override via binding.handlers.SLACK_WEBHOOK
}

module.exports = {
    onSlackWebhookReceived,
    onSlackWebhookResolve,
    onSlackWebhook,
    extractTeamId,
};
