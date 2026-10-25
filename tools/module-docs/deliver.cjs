'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const {fetchRelease} = require('./registry.cjs');
const {semver} = require('./contract.cjs');
const modules = require('./modules.json');

async function deliver(record, options = {}) {
    const allowed = modules.find(x => x.package === record.package);
    assert(allowed, 'Package is not enrolled'); semver(record.version);
    const fetchImpl = options.fetch || fetch;
    const release = await fetchRelease(allowed, record.version, fetchImpl);
    if (record.digest) assert.equal(release.digest, record.digest, 'Published bundle differs from release candidate');
    if (!options.dispatch) return release;
    assert(typeof options.token === 'string' && options.token.length > 0, 'Missing docs delivery App token');
    const response = await fetchImpl('https://api.github.com/repos/friggframework/frigg/dispatches', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: {Authorization: `Bearer ${options.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'},
        body: JSON.stringify({event_type: 'module-docs-published-v1', client_payload: {package: record.package, version: record.version}}),
    });
    assert.equal(response.status, 204, `Docs dispatch failed: ${response.status}`);
    return release;
}

module.exports = {deliver};
if (require.main === module) {
    (async () => {
        const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
        const records = event.inputs?.package ? [{package: event.inputs.package, version: event.inputs.version}] : JSON.parse(fs.readFileSync(process.argv[2] || '.module-docs/published.json', 'utf8'));
        const outcomes = [];
        for (const record of records) {
            try {
                const release = await deliver(record, {dispatch: true, token: process.env.MODULE_DOCS_TOKEN});
                outcomes.push({package: record.package, version: record.version, digest: release.digest, status: 'dispatched'});
            } catch (error) {
                outcomes.push({package: record.package, version: record.version, status: 'failed', error: error.message});
                process.exitCode = 1;
            }
        }
        fs.mkdirSync('.module-docs', {recursive: true});
        fs.writeFileSync('.module-docs/delivery.json', `${JSON.stringify(outcomes, null, 2)}\n`);
        for (const outcome of outcomes) console.log(`${outcome.package}@${outcome.version}: ${outcome.status}`);
        if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nModule docs delivery: ${outcomes.filter(x => x.status === 'dispatched').length} dispatched, ${outcomes.filter(x => x.status === 'failed').length} failed. Dispatch acceptance is not confirmation of import or publication. Retry using the module-docs-delivery workflow; do not rerun shipit.\n`);
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
