'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {build} = require('./build.cjs');
const {digest} = require('./contract.cjs');
const {deliver} = require('./deliver.cjs');
const {registryFetch} = require('./fixtures.cjs');
const Plugin = require('./auto-plugin.cjs');
const sourceRoot = path.resolve(__dirname, '../..');
const packagePath = 'packages/v1-ready/hubspot';

function workspace(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-docs-build-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    fs.cpSync(path.join(sourceRoot, packagePath), path.join(root, packagePath), {recursive: true});
    return {root, directory: path.join(root, packagePath), options: {root, skipSourceCheck: true, commit: 'a'.repeat(40)}};
}

test('build resolves exact metadata, includes all 89 public methods and is deterministic', t => {
    const {directory, options} = workspace(t);
    const first = build(directory, options), second = build(directory, options);
    assert.equal(digest(first), digest(second));
    assert.equal(first.catalog.identity.package, '@friggframework/api-module-hubspot');
    assert.deepEqual(first.catalog.extensions, ['webhooks']);
    assert.equal(first.catalog.compatibility.node, null);
    assert.equal((first.files['reference.md'].content.match(/^## /gm) || []).length, 89);
    assert(first.files['README.md'].content.includes(`@${first.manifest.version}`));
    assert.match(first.files['reference.md'].content, /Known limitation/);
});

test('reference matches runtime public methods and first-call example uses the real wrapper', async () => {
    const requests = [];
    const fixture = {results: [{id: 'fixture-contact', properties: {email: 'fixture@example.test'}}]};
    class Requester {
        constructor(params) { Object.assign(this, params); }
        async _get(options) { requests.push(options); return fixture; }
    }
    const module = {exports: {}};
    vm.runInNewContext(fs.readFileSync(path.join(sourceRoot, packagePath, 'api.js'), 'utf8'), {
        module, URLSearchParams, process: {env: {}},
        require: name => {
            assert.equal(name, '@friggframework/core');
            return {OAuth2Requester: Requester, get: (object, key, fallback) => object?.[key] ?? fallback};
        },
    });
    const Api = module.exports.Api;
    const annotations = require(path.join(sourceRoot, packagePath, 'docs/reference.json'));
    const actual = Object.getOwnPropertyNames(Api.prototype).filter(x => x !== 'constructor' && !x.startsWith('_')).sort();
    assert.deepEqual(actual, Object.keys(annotations).sort());
    const firstCall = require(path.join(sourceRoot, packagePath, 'docs/first-call.cjs'));
    assert.equal(await firstCall(Api, 'fixture-token'), fixture);
    assert.equal(requests.length, 1, 'Explicit properties must avoid discovery request');
    assert.equal(requests[0].url, 'https://api.hubapi.com/crm/v3/objects/contacts');
    assert.equal(JSON.stringify(requests[0].query), JSON.stringify({limit: 1, properties: ['email']}));
    assert(!Object.hasOwn(requests[0].query, 'after'));
    await new Api({access_token: 'fixture-token'}).listContacts({limit: 1, properties: ['email'], after: 'next-cursor'});
    assert.equal(requests[1].query.after, 'next-cursor');
});

test('schema, coverage, required content and extension mismatch block generation', t => {
    const {directory, options} = workspace(t);
    const descriptorPath = path.join(directory, 'module-docs.json');
    const descriptor = JSON.parse(fs.readFileSync(descriptorPath));
    fs.writeFileSync(descriptorPath, JSON.stringify({...descriptor, version: '9.9.9'}));
    assert.throws(() => build(directory, options), /Unknown descriptor.version/);
    fs.writeFileSync(descriptorPath, JSON.stringify({...descriptor, extensions: []}));
    assert.throws(() => build(directory, options), /extensions disagree/);
    fs.writeFileSync(descriptorPath, JSON.stringify(descriptor));
    const reference = path.join(directory, 'docs/reference.json');
    const records = JSON.parse(fs.readFileSync(reference)); delete records.listContacts;
    fs.writeFileSync(reference, JSON.stringify(records));
    assert.throws(() => build(directory, options), /cover every public method/);
});

test('source verification cannot accept a fabricated commit', t => {
    const {directory, root} = workspace(t);
    assert.throws(() => build(directory, {root, commit: 'b'.repeat(40)}));
});

test('auto plugin emits only candidate identities from a successful non-canary publication', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-docs-plugin-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const before = process.cwd(); process.chdir(root);
    try {
        const callbacks = {};
        new Plugin().apply({hooks: {
            beforeShipIt: {tapPromise: (_, fn) => { callbacks.before = fn; }},
            afterShipIt: {tapPromise: (_, fn) => { callbacks.after = fn; }},
        }});
        await callbacks.before();
        const ledger = path.join(root, '.module-docs');
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ledger, 'published.json'))), []);
        fs.mkdirSync(path.join(ledger, 'candidates'));
        const candidate = {package: '@friggframework/api-module-hubspot', version: '2.0.0', digest: 'c'.repeat(64)};
        fs.writeFileSync(path.join(ledger, 'candidates/hubspot-2.0.0.json'), JSON.stringify(candidate));
        for (const args of [{context: 'canary', newVersion: '2.0.0'}, {context: 'latest', dryRun: true, newVersion: '2.0.0'}, {context: 'next'}]) {
            await callbacks.after(args);
            assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ledger, 'published.json'))), []);
        }
        await callbacks.after({context: 'next', newVersion: 'module@2.0.0'});
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ledger, 'published.json'))), [candidate]);
        await callbacks.before();
        assert(!fs.existsSync(path.join(ledger, 'candidates')), 'Next run must not replay stale candidates');
    } finally { process.chdir(before); }
});

test('delivery verifies npm, detects candidate mismatch, and retries independently of release', async t => {
    const {directory, options} = workspace(t), value = build(directory, options);
    const record = {package: value.manifest.package, version: value.manifest.version, digest: digest(value)};
    let requests = 0;
    const fetch = registryFetch(value, {dispatch: () => { requests++; return new Response(null, {status: requests === 1 ? 503 : 204}); }});
    await assert.rejects(deliver(record, {fetch, dispatch: true, token: 'test'}), /dispatch failed/);
    assert.equal((await deliver(record, {fetch, dispatch: true, token: 'test'})).digest, record.digest);
    assert.equal(requests, 2);
    await assert.rejects(deliver({...record, digest: 'd'.repeat(64)}, {fetch}), /differs from release candidate/);
});
