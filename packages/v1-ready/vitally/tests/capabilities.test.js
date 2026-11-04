const fs = require('fs');
const path = require('path');
const { Api } = require('../api');

const manifest = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'vitally.capabilities.json'),
        'utf8'
    )
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('vitally.capabilities.json ↔ Api methods', () => {
    it('uses capability-manifest/v0.1 schema id', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('vitally');
        expect(manifest.package).toBe('@friggframework/api-module-vitally');
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

    it('covers core CS READ surfaces', () => {
        expect(manifest.capabilities['account.list'].method).toBe(
            'listAccounts'
        );
        expect(manifest.capabilities['account.healthScores.get'].method).toBe(
            'getAccountHealthScores'
        );
        expect(manifest.capabilities['user.list'].method).toBe('listUsers');
        expect(manifest.capabilities['task.list'].method).toBe('listTasks');
        expect(manifest.capabilities['note.list'].method).toBe('listNotes');
        expect(manifest.capabilities['conversation.list'].method).toBe(
            'listConversations'
        );
        expect(manifest.capabilities['customField.list'].method).toBe(
            'listCustomFields'
        );
    });

    it('documents that webhook subscription APIs are skipped', () => {
        const skipped = (manifest.skipped || []).map((s) => s.draftMethod);
        expect(skipped).toContain('listWebhookSubscriptions');
        expect(skipped).toContain('createWebhookSubscription');
    });
});
