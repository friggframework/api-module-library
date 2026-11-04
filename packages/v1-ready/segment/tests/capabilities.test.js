const fs = require('fs');
const path = require('path');
const { Api } = require('../api');

const manifest = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'segment.capabilities.json'),
        'utf8'
    )
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('segment.capabilities.json ↔ Api methods', () => {
    it('uses capability-manifest/v0.1 schema id', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('segment');
        expect(manifest.package).toBe('@friggframework/api-module-segment');
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

    it('covers core Public API + Profile API read surfaces', () => {
        expect(manifest.capabilities['workspace.get'].method).toBe(
            'getWorkspace'
        );
        expect(manifest.capabilities['source.list'].method).toBe('listSources');
        expect(manifest.capabilities['destination.list'].method).toBe(
            'listDestinations'
        );
        expect(manifest.capabilities['warehouse.list'].method).toBe(
            'listWarehouses'
        );
        expect(manifest.capabilities['trackingPlan.list'].method).toBe(
            'listTrackingPlans'
        );
        expect(manifest.capabilities['profile.traits.get'].method).toBe(
            'getProfileTraits'
        );
        expect(manifest.capabilities['profile.events.get'].method).toBe(
            'getProfileEvents'
        );
        expect(manifest.capabilities['profile.externalIds.get'].method).toBe(
            'getProfileExternalIds'
        );
    });

    it('treats inbound Segment events as webhook deliveries (no Api method)', () => {
        for (const [, evt] of Object.entries(manifest.events || {})) {
            expect(evt.apiMethod).toBeNull();
            expect(evt.delivery).toBe('webhook');
            expect(evt.status).toBe('supported-inbound');
        }
    });
});
