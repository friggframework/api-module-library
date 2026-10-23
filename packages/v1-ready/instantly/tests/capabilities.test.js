const fs = require('fs');
const path = require('path');
const { Api } = require('../api');

const manifest = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'instantly.capabilities.json'),
        'utf8'
    )
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('instantly.capabilities.json ↔ Api methods', () => {
    it('uses capability-manifest/v0.1 schema id', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('instantly');
        expect(manifest.package).toBe('@friggframework/api-module-instantly');
        expect(manifest.version).toBe('1.0.0');
    });

    it('every capabilities.*.method is a real Api method', () => {
        const missing = [];
        for (const [name, cap] of Object.entries(manifest.capabilities || {})) {
            if (!cap.method) {
                missing.push(`${name} (no method)`);
                continue;
            }
            if (!clientMethods.includes(cap.method)) {
                missing.push(`${name} → ${cap.method}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('every objects.*.operations.*.method is a real Api method', () => {
        const missing = [];
        for (const [objName, obj] of Object.entries(manifest.objects || {})) {
            for (const [opName, op] of Object.entries(obj.operations || {})) {
                if (!clientMethods.includes(op.method)) {
                    missing.push(`${objName}.${opName} → ${op.method}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('covers core outreach surfaces', () => {
        expect(manifest.capabilities['workspace.get'].method).toBe(
            'getWorkspace'
        );
        expect(manifest.capabilities['campaign.list'].method).toBe(
            'listCampaigns'
        );
        expect(manifest.capabilities['account.list'].method).toBe(
            'listAccounts'
        );
        expect(manifest.capabilities['lead.list'].method).toBe('listLeads');
        expect(manifest.capabilities['webhook.create'].method).toBe(
            'createWebhook'
        );
    });

    it('documents skipped destructive / peripheral surfaces', () => {
        const skipped = (manifest.skipped || []).map((s) => s.draftMethod);
        expect(skipped).toContain('deleteCampaign');
        expect(skipped).toContain('initializeGoogleOAuth');
    });
});
