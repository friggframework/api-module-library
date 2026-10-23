/**
 * Admin script `hubspot.reconcile-subscriptions`: create the HubSpot webhook subscriptions the deployed integrations
 * need, and with `prune` remove the ones none needs. `defineApp` (@friggframework/core) adds it to the app's admin
 * scripts when an integration binds this module.
 *
 * Inputs: `{ prune, dryRun }`, or the CLI form `{ args: ['--prune', '--dry-run'] }`. Add-only unless pruning.
 *
 * Subscriptions belong to the HubSpot developer app, so they are shared app-wide: use one developer app per stage.
 * Two stages sharing a developer app would see, and with `--prune` remove, each other's subscriptions.
 *
 * Core is required when the script runs, not when the module loads, so the module still loads with a core that has
 * no defineIntegration.
 */
const NAME = 'hubspot.reconcile-subscriptions';
const EXTENSION = 'hubspot-webhooks';

class ReconcileHubSpotSubscriptions {
    static Definition = {
        name: NAME,
        version: '1.0.0',
        description: 'Create the HubSpot webhook subscriptions installed integrations need; with prune, remove the ones none needs. One HubSpot developer app per stage.',
        source: 'BUILTIN',
        inputSchema: {
            type: 'object',
            properties: {
                prune: { type: 'boolean', default: false },
                dryRun: { type: 'boolean', default: false },
                args: { type: 'array', items: { type: 'string', enum: ['--prune', '--dry-run'] } },
            },
        },
        config: { timeout: 300000, requireIntegrationInstance: false },
        display: { category: 'maintenance', icon: null },
    };

    constructor(params = {}) {
        this.params = params;
    }

    async execute(input = {}) {
        // eslint-disable-next-line global-require
        const { createReconcileSubscriptionsScript } = require('@friggframework/core');
        if (typeof createReconcileSubscriptionsScript !== 'function') {
            throw new Error(`${NAME} needs @friggframework/core with defineIntegration (ADR-054)`);
        }
        const Script = createReconcileSubscriptionsScript({ name: NAME, extension: EXTENSION });
        return new Script(this.params).execute(input);
    }
}

module.exports = { ReconcileHubSpotSubscriptions };
