const fs = require('fs');
const path = require('path');
const { Api } = require('../api');

const manifest = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'github.capabilities.json'),
        'utf8'
    )
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('github.capabilities.json ↔ Api methods', () => {
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

    it('maps lefthook-bots draft issue capabilities to implemented methods', () => {
        expect(manifest.capabilities['issue.get'].method).toBe('getIssue');
        expect(manifest.capabilities['issue.list'].method).toBe(
            'listRepositoryIssues'
        );
        expect(manifest.capabilities['issue.create'].method).toBe('createIssue');
        expect(manifest.capabilities['issue.update'].method).toBe('updateIssue');
        expect(manifest.capabilities['repo.list'].method).toBe(
            'listReposForAuthenticatedUser'
        );
    });

    it('lists draft-only capabilities as skipped with reasons', () => {
        const skippedMethods = (manifest.skipped || []).map((s) => s.draftMethod);
        expect(skippedMethods).toEqual(
            expect.arrayContaining([
                'createIssueComment',
                'listInstallationRepos',
            ])
        );
        for (const entry of manifest.skipped) {
            expect(entry.reason).toBeTruthy();
            expect(clientMethods).not.toContain(entry.draftMethod);
        }
    });

    it('treats draft webhook events as inbound (no Api method)', () => {
        for (const [name, evt] of Object.entries(manifest.events || {})) {
            expect(evt.apiMethod).toBeNull();
            expect(evt.delivery).toBe('webhook');
            expect(evt.status).toBe('supported-inbound');
        }
    });
});
