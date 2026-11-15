'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    assertClassificationEnum,
    assertClassificationByteEqual,
    rejectUnauthorizedAuthorized,
    evaluateLiveSuiteAlone,
    evaluateDeployerGate,
    evaluateAuthorizedWithoutSyntheticFields,
    isStaleRecorded,
    assertNoSecrets,
    forbiddenEnvHits,
    applyRedaction,
    ENUM,
    PINNED_API_JS_SHA256,
    assertApiJsDigest,
    BOUND_MODULE_REFS,
    resolveModuleRef,
} = require('./hubspot-auth-api-receipt.cjs');
const { TRANSFORM_ID } = require('./redaction-transform.v1.cjs');
const policy = require('./hubspot-auth-api-policy.cjs');

const REPO_ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(__dirname, 'hubspot-auth-api-receipt.cjs');
const WORKFLOW_YML = path.join(REPO_ROOT, '.github/workflows/hubspot-auth-api-receipt.yml');

function cleanProviderEnv(base = process.env) {
    const env = { ...base };
    for (const key of Object.keys(env)) {
        if (policy.isForbiddenEnvKey(key)) delete env[key];
    }
    return env;
}

test('enum is synthetic|recorded|authorized', () => {
    assert.deepEqual(ENUM, ['synthetic', 'recorded', 'authorized']);
    assertClassificationEnum('synthetic');
    assertClassificationEnum('recorded');
    assertClassificationEnum('authorized');
    assert.throws(() => assertClassificationEnum('live'), /classification must be/);
});

test('CLASSIFICATION: same bytes rewritten to authorized are not auto-accepted; classification must byte-equal artifact', () => {
    assertClassificationByteEqual('synthetic', 'synthetic');
    assert.throws(() => assertClassificationByteEqual('authorized', 'synthetic'), /CLASSIFICATION/);
    assert.throws(() => assertClassificationByteEqual('synthetic\n', 'synthetic'), /CLASSIFICATION/);
    const offline = { classification: 'synthetic' };
    const rewritten = { ...offline, classification: 'authorized' };
    assert.throws(() => rejectUnauthorizedAuthorized(rewritten), /AUTHORIZED_EVIDENCE|CLASSIFICATION|authorized/);
});

test('FRESHNESS: 90-day bound is adopted; synthetic is not on the clock', () => {
    assert.equal(policy.FRESHNESS_MAX_AGE_DAYS, 90);
    assert.equal(policy.FRESHNESS_MAX_AGE_DAYS_STATUS, 'adopted');
    assert.equal(policy.isFreshnessBoundInPolicy(90), true);
    assert.equal(policy.isFreshnessBoundInPolicy(99999), false);
    assert.equal(policy.isFreshnessBoundInPolicy(undefined), false);
    // Synthetic fixtures are not on the 90-day clock, even if recordedAt is old.
    const ancient = policy.evaluateFreshnessAndPin({
        classification: 'synthetic',
        capturedAt: '2020-01-01T00:00:00-05:00',
        maxAgeDays: 90,
        providerApiVersion: '2026-03',
        contract: 'POST /oauth/2026-03/token',
        now: new Date('2026-11-09T13:00:00-05:00'),
    });
    assert.equal(ancient.ok, true);
    assert.equal(ancient.clockApplied, false);
});

test('FRESHNESS: stale-but-pinned recorded traffic fails', () => {
    const result = policy.evaluateFreshnessAndPin({
        classification: 'recorded',
        capturedAt: '2020-01-01T00:00:00-05:00',
        maxAgeDays: 90,
        providerApiVersion: '2026-03',
        contract: 'POST /oauth/2026-03/token',
        now: new Date('2026-11-09T13:00:00-05:00'),
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'stale-but-pinned');
    assert.equal(isStaleRecorded('2020-01-01T00:00:00-05:00', 90, new Date('2026-11-09T13:00:00-05:00')), true);
    assert.equal(isStaleRecorded('2026-11-08T13:00:00-05:00', 90, new Date('2026-11-09T13:00:00-05:00')), false);
});

test('FRESHNESS: fresh-but-unpinned recorded traffic fails', () => {
    const result = policy.evaluateFreshnessAndPin({
        classification: 'recorded',
        capturedAt: '2026-11-08T13:00:00-05:00',
        maxAgeDays: 90,
        providerApiVersion: '2026-03',
        contract: 'POST /oauth/unpinned-endpoint',
        now: new Date('2026-11-09T13:00:00-05:00'),
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'fresh-but-unpinned');
});

test('FRESHNESS: missing or non-90 bound fails recorded traffic', () => {
    const now = new Date('2026-11-09T13:00:00-05:00');
    const base = {
        classification: 'recorded',
        capturedAt: '2026-11-08T13:00:00-05:00',
        providerApiVersion: '2026-03',
        contract: 'POST /oauth/2026-03/token',
        now,
    };
    assert.equal(policy.evaluateFreshnessAndPin({ ...base, maxAgeDays: null }).reason, 'missing-or-non-90-bound');
    assert.equal(policy.evaluateFreshnessAndPin({ ...base, maxAgeDays: undefined }).reason, 'missing-or-non-90-bound');
    assert.equal(policy.evaluateFreshnessAndPin({ ...base, maxAgeDays: 30 }).reason, 'missing-or-non-90-bound');
    assert.equal(policy.evaluateFreshnessAndPin({ ...base, maxAgeDays: 99999 }).reason, 'missing-or-non-90-bound');
    assert.equal(isStaleRecorded('2026-11-08T13:00:00-05:00', null), true);
});

test('FRESHNESS: API-version mismatch fails even when fresh and bound is 90', () => {
    const result = policy.evaluateFreshnessAndPin({
        classification: 'recorded',
        capturedAt: '2026-11-08T13:00:00-05:00',
        maxAgeDays: 90,
        providerApiVersion: 'v1',
        contract: 'POST /oauth/2026-03/token',
        now: new Date('2026-11-09T13:00:00-05:00'),
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'api-version-mismatch');
});

test('SECRET_SHAPED: secret-shaped values are rejected; redaction binds transform id', () => {
    assert.throws(
        () => assertNoSecrets('fx', { access_token: 'super-secret-live-token-value' }),
        /SECRET_SHAPED/
    );
    assert.throws(
        () => assertNoSecrets('fx', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abc' }),
        /SECRET_SHAPED/
    );
    assert.doesNotThrow(() => assertNoSecrets('fx', { access_token: 'synthetic-access-token' }));
    assert.doesNotThrow(() => assertNoSecrets('fx', { access_token: '[REDACTED:access_token]' }));

    const raw = {
        access_token: 'real-looking-access-token-value',
        refresh_token: 'real-looking-refresh-token-value',
        client_secret: 'real-client-secret',
        token_type: 'bearer',
        expires_in: 1800,
    };
    const { redacted, replacements, transformId } = applyRedaction(raw);
    assert.equal(transformId, TRANSFORM_ID);
    assert.equal(redacted.access_token, '[REDACTED:access_token]');
    assert.equal(redacted.refresh_token, '[REDACTED:refresh_token]');
    assert.equal(redacted.client_secret, '[REDACTED:client_secret]');
    assert.equal(redacted.token_type, 'bearer');
    assert.equal(redacted.expires_in, 1800);
    assert.ok(replacements.length >= 3);
    assert.doesNotThrow(() => assertNoSecrets('redacted', redacted));
});

test('AUTHORIZED_EVIDENCE: authorized without live token evidence is unresolved', () => {
    assert.throws(
        () => rejectUnauthorizedAuthorized({ classification: 'authorized' }),
        /AUTHORIZED_EVIDENCE/
    );
    assert.equal(
        rejectUnauthorizedAuthorized({
            classification: 'authorized',
            liveCiSubject: { runUrl: 'https://example.invalid/run/1' },
            liveTokenEvidence: { presentInCiSecrets: true, valueOmitted: true },
        }),
        'resolves'
    );
    assert.equal(rejectUnauthorizedAuthorized({ classification: 'synthetic' }), 'n/a');
});

test('LIVE_SUITE_ALONE: live api.test.js alone is not an auth receipt', () => {
    assert.equal(
        evaluateLiveSuiteAlone({ onlyLiveApiTestJs: true, hasAuthReceipt: false, hasAuthorizedEvidence: false }),
        'unresolved-live-suite-alone'
    );
    assert.equal(
        evaluateLiveSuiteAlone({ onlyLiveApiTestJs: true, hasAuthReceipt: true, hasAuthorizedEvidence: false }),
        'ok'
    );
});

test('DEPLOYER_STATUS: auth receipt present + deployer missing keeps gate OPEN', () => {
    assert.equal(evaluateDeployerGate({ hasAuthReceipt: true, hasDeployer: false }), 'OPEN');
});

test('PROVIDER_ENV: closed env list; set-but-empty counts as present; GITHUB_TOKEN is not forbidden', () => {
    assert.deepEqual(policy.TOKEN_ENV_NAMES, [
        'HUBSPOT_CLIENT_ID',
        'HUBSPOT_CLIENT_SECRET',
        'HUBSPOT_SCOPE',
        'HUBSPOT_TIMELINE_EVENT_TEMPLATE_ID',
        'MATTERS_ACCESS_TOKEN',
    ]);
    assert.deepEqual(
        forbiddenEnvHits({ HUBSPOT_ACCESS_TOKEN: 'x', HUBSPOT_SCOPE: 'oauth', GITHUB_TOKEN: 'g', FOO: '1' }).sort(),
        ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_SCOPE']
    );
    assert.deepEqual(forbiddenEnvHits({ MATTERS_ACCESS_TOKEN: 'x' }), ['MATTERS_ACCESS_TOKEN']);
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_CLIENT_ID: 'x' }), ['HUBSPOT_CLIENT_ID']);
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_LIVE_API: '1' }), ['HUBSPOT_LIVE_API']);
    // Set-but-empty is present.
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_LIVE_API: '' }), ['HUBSPOT_LIVE_API']);
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_CLIENT_SECRET: '' }), ['HUBSPOT_CLIENT_SECRET']);
    assert.deepEqual(forbiddenEnvHits({ GITHUB_TOKEN: 'g', GH_TOKEN: 'g', FRONT_CLIENT_SECRET: 'x', REDIRECT_URI: 'https://example.com' }), []);
    // The CI bug: HUBSPOT_RECEIPT_COMMAND matches the HUBSPOT_ prefix.
    assert.equal(policy.isForbiddenEnvKey('HUBSPOT_RECEIPT_COMMAND'), true);
    assert.deepEqual(
        forbiddenEnvHits({ HUBSPOT_RECEIPT_COMMAND: policy.WORKFLOW_RECEIPT_COMMAND }),
        ['HUBSPOT_RECEIPT_COMMAND']
    );
    assert.deepEqual(forbiddenEnvHits({ AML_RECEIPT_COMMAND: policy.WORKFLOW_RECEIPT_COMMAND }), []);
});

test('AUTHORIZED_FIELDS: authorized missing only synthetic fixture fields still resolves when evidence holds', () => {
    assert.equal(
        evaluateAuthorizedWithoutSyntheticFields({
            classification: 'authorized',
            liveCiSubject: { runUrl: 'https://example.invalid/run/1' },
            liveTokenEvidence: { presentInCiSecrets: true },
        }),
        'resolves'
    );
    assert.equal(
        evaluateAuthorizedWithoutSyntheticFields({ classification: 'authorized' }),
        'unresolved'
    );
});

test('REQUEST_SHAPE: outbound shape matcher is not always-true; required body fields and no Authorization', () => {
    const good = {
        method: 'POST',
        url: policy.TOKEN_ENDPOINT,
        body: {
            grant_type: 'authorization_code',
            client_id: 'id',
            client_secret: 'secret',
            redirect_uri: 'https://example.com/redirect/hubspot',
            scope: 'oauth',
            code: 'c',
        },
    };
    assert.equal(policy.matchesTokenExchange(good), true);
    assert.equal(policy.matchesTokenExchange({ ...good, method: 'GET' }), false);
    assert.equal(policy.matchesTokenExchange({ ...good, url: 'https://api.hubapi.com/oauth/v1/token' }), false);
    assert.equal(
        policy.matchesTokenExchange({
            ...good,
            body: { ...good.body, grant_type: 'client_credentials' },
        }),
        false
    );
    assert.equal(
        policy.matchesTokenExchange({
            ...good,
            body: { grant_type: 'authorization_code', code: 'c' },
        }),
        false
    );
    assert.equal(
        policy.matchesTokenExchange({
            ...good,
            headers: { Authorization: 'Basic abc' },
        }),
        false
    );
    const goodRefresh = {
        method: 'POST',
        url: policy.TOKEN_ENDPOINT,
        body: {
            grant_type: 'refresh_token',
            client_id: 'id',
            client_secret: 'secret',
            redirect_uri: 'https://example.com/redirect/hubspot',
            refresh_token: 'synthetic-refresh-token',
        },
    };
    assert.equal(policy.matchesTokenRefresh(goodRefresh), true);
    assert.equal(
        policy.matchesTokenRefresh({
            ...goodRefresh,
            headers: { Authorization: 'Basic abc' },
        }),
        false
    );
    assert.equal(policy.matchesBearerAuthorization('Bearer x'), true);
    assert.equal(policy.matchesBearerAuthorization('Basic x'), false);
});

test('PROVIDER_ENV: denied host list is the two module hosts; closed token-env prefixes are pinned', () => {
    assert.deepEqual(policy.DENIED_PROVIDER_HOSTS, [
        'api.hubapi.com',
        'app.hubspot.com',
    ]);
    assert.equal(policy.isDeniedProviderHost('api.hubapi.com'), true);
    assert.equal(policy.isDeniedProviderHost('app.hubspot.com'), true);
    assert.equal(policy.isDeniedProviderHost('api.hubspot.com'), false);
    assert.equal(policy.isDeniedProviderHost('example.com'), false);
    assert.ok(policy.TOKEN_ENV_NAMES.includes('HUBSPOT_CLIENT_SECRET'));
    assert.ok(policy.TOKEN_ENV_NAMES.includes('HUBSPOT_TIMELINE_EVENT_TEMPLATE_ID'));
    assert.ok(policy.TOKEN_ENV_NAMES.includes('MATTERS_ACCESS_TOKEN'));
    assert.ok(policy.TOKEN_ENV_PREFIXES.includes('HUBSPOT_'));
    assert.ok(policy.TOKEN_ENV_PREFIXES.includes('MATTERS_'));
});

test('DENY_SPY: deny and spy must both be present and distinct; a 200 fake is not a deny', () => {
    assert.deepEqual(policy.evaluateDenyAndSpy({ denyInstalled: true, spyInstalled: true }), {
        ok: true,
        reason: null,
    });
    assert.equal(policy.evaluateDenyAndSpy({ denyInstalled: true, spyInstalled: false }).reason, 'deny-only');
    assert.equal(policy.evaluateDenyAndSpy({ denyInstalled: false, spyInstalled: true }).reason, 'spy-only');
    assert.equal(
        policy.evaluateDenyAndSpy({ denyInstalled: true, spyInstalled: true, treatsAlways200AsDeny: true }).reason,
        'always-200-is-not-a-deny'
    );
    const spy = policy.createPinnedHostSpy();
    assert.equal(spy.kind, 'spy');
    assert.equal(spy.mechanism, 'nock.emitter:no-match');
    assert.notEqual(spy.mechanism, 'nock.disableNetConnect');
});

test('PROVIDER_ENV regression: workflow must not pass the command via a HUBSPOT_* env var', () => {
    const yml = fs.readFileSync(WORKFLOW_YML, 'utf8');
    assert.equal(yml.includes('HUBSPOT_RECEIPT_COMMAND'), false);
    assert.match(yml, /AML_RECEIPT_COMMAND:/);
    assert.match(yml, /--command "\$\{AML_RECEIPT_COMMAND\}"/);
    assert.equal(yml.includes(policy.WORKFLOW_RECEIPT_COMMAND), true);
    // Upload only runs when both receipt files exist; it must not claim
    // success for a missing artifact.
    assert.match(
        yml,
        /hashFiles\('artifacts\/hubspot-auth-api-receipt\.json'\) != '' && hashFiles\('artifacts\/classification'\) != ''/
    );
});

test('PROVIDER_ENV regression: emitter invoked exactly as the workflow does (same env/args) passes the env gate; HUBSPOT_RECEIPT_COMMAND fails', () => {
    const workflowCommand = policy.WORKFLOW_RECEIPT_COMMAND;
    const workflowEnv = cleanProviderEnv();
    workflowEnv.AML_RECEIPT_COMMAND = workflowCommand;
    // First workflow step: --assert-offline-env, no HUBSPOT_* present.
    const offline = spawnSync(process.execPath, [EMITTER, '--assert-offline-env'], {
        env: workflowEnv,
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    assert.equal(offline.status, 0, offline.stderr || offline.stdout);

    // The broken invocation that used a HUBSPOT_* plumbing env var.
    const brokenEnv = { ...workflowEnv, HUBSPOT_RECEIPT_COMMAND: workflowCommand };
    const broken = spawnSync(process.execPath, [EMITTER, '--assert-offline-env'], {
        env: brokenEnv,
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    assert.notEqual(broken.status, 0);
    assert.match(`${broken.stderr}\n${broken.stdout}`, /HUBSPOT_RECEIPT_COMMAND/);

    // Write-receipt step: same env (AML_RECEIPT_COMMAND) and the same argv
    // the workflow uses.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hubspot-auth-receipt-'));
    const jestJson = path.join(tmp, 'jest-results.json');
    const out = path.join(tmp, 'hubspot-auth-api-receipt.json');
    fs.writeFileSync(
        jestJson,
        JSON.stringify({
            success: true,
            numPassedTests: 4,
            numFailedTests: 0,
            numPendingTests: 0,
            numTotalTests: 4,
            testResults: [
                {
                    name: path.join(REPO_ROOT, 'packages/v1-ready/hubspot/tests/auth-api-synthetic.test.js'),
                    assertionResults: [
                        { status: 'passed', fullName: 'exchanges via getTokenFromCode authorization_code', title: 'getTokenFromCode' },
                        { status: 'passed', fullName: 'refreshes via POST refresh_token refreshAccessToken', title: 'refreshAccessToken' },
                        { status: 'passed', fullName: 'addAuthHeaders Bearer header / signing', title: 'addAuthHeaders' },
                        { status: 'passed', fullName: 'rejects invalid_grant 401 inactive tampered expired', title: 'rejects invalid_grant' },
                    ],
                },
            ],
        })
    );
    const emitArgs = [
        EMITTER,
        '--jest-json',
        jestJson,
        '--out',
        out,
        '--command',
        workflowCommand,
        '--classification',
        'synthetic',
        '--expect-classification',
        'synthetic',
        '--module-ref-branch',
        'next',
        '--module-ref-sha',
        '9f5e5c627a0be42cd25cf28339142891e71eba07',
    ];
    const emitted = spawnSync(process.execPath, emitArgs, {
        env: workflowEnv,
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    assert.equal(emitted.status, 0, emitted.stderr || emitted.stdout);
    assert.equal(fs.existsSync(out), true);
    const classificationPath = path.join(tmp, 'classification');
    assert.equal(fs.existsSync(classificationPath), true);
    assert.equal(fs.readFileSync(classificationPath, 'utf8'), 'synthetic');
    const receipt = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(receipt.classification, 'synthetic');
    assert.equal(receipt.command || receipt.result && true, receipt.command ? workflowCommand : true);
    // command is a top-level or nested field — accept either if present
    if (receipt.command) assert.equal(receipt.command, workflowCommand);
    // Runtime api.js digest is recorded and equals the pin.
    assert.equal(receipt.artifact.apiJs.path, 'packages/v1-ready/hubspot/api.js');
    assert.equal(receipt.artifact.apiJs.sha256, 'af0b0bdc937820697a9bf158a6cc4f8a9e4fa22c96c535ee5af994720e4c3c60');
    assert.equal(receipt.artifact.apiJs.pinnedSha256, receipt.artifact.apiJs.sha256);
    // moduleRef from the closed map, distinct from sourceCommitSha.
    assert.deepEqual(
        { branch: receipt.moduleRef.branch, sha: receipt.moduleRef.sha },
        { branch: 'next', sha: '9f5e5c627a0be42cd25cf28339142891e71eba07' }
    );
    assert.equal(receipt.moduleRef.table, undefined);
    assert.equal(receipt.moduleRef.apiJsSha256, receipt.artifact.apiJs.sha256);
    assert.equal(receipt.schema, 'hubspot-auth-api-receipt.v1');
    assert.equal(receipt.deploymentNote && receipt.deploymentNote.statusIfDeployerMissing, 'OPEN');

    // Same argv without --module-ref-* fails closed.
    const noRefArgs = emitArgs.slice(0, emitArgs.indexOf('--module-ref-branch'));
    const noRef = spawnSync(process.execPath, noRefArgs, { env: workflowEnv, encoding: 'utf8', cwd: REPO_ROOT });
    assert.notEqual(noRef.status, 0);
    assert.match(`${noRef.stderr}\n${noRef.stdout}`, /UNKNOWN_MODULE_REF|moduleRef/);
    // Unlisted ref (the harness commit itself) fails closed.
    const unlistedArgs = [...noRefArgs, '--module-ref-branch', 'next', '--module-ref-sha', '4c10075740d634f969316e944a6f60abbcf4ffa1'];
    const unlisted = spawnSync(process.execPath, unlistedArgs, { env: workflowEnv, encoding: 'utf8', cwd: REPO_ROOT });
    assert.notEqual(unlisted.status, 0);
    assert.match(`${unlisted.stderr}\n${unlisted.stdout}`, /unknown moduleRef/);

    // Same argv but with the old HUBSPOT_RECEIPT_COMMAND env must still fail
    // because buildReceipt calls assertNoProviderEnv().
    const emittedBroken = spawnSync(process.execPath, emitArgs, {
        env: brokenEnv,
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    assert.notEqual(emittedBroken.status, 0);
    assert.match(`${emittedBroken.stderr}\n${emittedBroken.stdout}`, /HUBSPOT_RECEIPT_COMMAND/);
});

test('API_JS_DIGEST: api.js pin is af0b0bdc…; a mismatched runtime digest fails', () => {
    assert.equal(PINNED_API_JS_SHA256, 'af0b0bdc937820697a9bf158a6cc4f8a9e4fa22c96c535ee5af994720e4c3c60');
    assert.doesNotThrow(() => assertApiJsDigest(PINNED_API_JS_SHA256));
    assert.throws(() => assertApiJsDigest('0'.repeat(64)), (err) => err.code === 'API_JS_DIGEST');
    assert.throws(() => assertApiJsDigest(undefined), (err) => err.code === 'API_JS_DIGEST');
});

test('closed moduleRef map is exactly main@d50c6a9d and next@9f5e5c62', () => {
    assert.deepEqual(
        BOUND_MODULE_REFS.map((r) => `${r.branch}@${r.sha}`),
        [
            'main@d50c6a9d8f6f8264aaf4e6e9447991b4074ec455',
            'next@9f5e5c627a0be42cd25cf28339142891e71eba07',
        ]
    );
    const next = resolveModuleRef({ branch: 'next', sha: '9f5e5c627a0be42cd25cf28339142891e71eba07' });
    assert.equal(next.table, undefined);
    assert.equal(next.apiJsSha256, 'af0b0bdc937820697a9bf158a6cc4f8a9e4fa22c96c535ee5af994720e4c3c60');
    for (const bad of [
        {},
        { branch: 'next' },
        { sha: '9f5e5c627a0be42cd25cf28339142891e71eba07' },
        { branch: 'next', sha: '9f5e5c62' },
        { branch: 'main', sha: '9f5e5c627a0be42cd25cf28339142891e71eba07' },
        { branch: 'next', sha: '4c10075740d634f969316e944a6f60abbcf4ffa1' },
    ]) {
        assert.throws(() => resolveModuleRef(bad), (err) => err.code === 'UNKNOWN_MODULE_REF', JSON.stringify(bad));
    }
});

test('runtime api.js digest is checked against the moduleRef entry', () => {
    const mainRef = resolveModuleRef({ branch: 'main', sha: 'd50c6a9d8f6f8264aaf4e6e9447991b4074ec455' });
    // The next api.js on disk does not match the main entry, so a main claim fails.
    assert.throws(() => assertApiJsDigest(PINNED_API_JS_SHA256, mainRef.apiJsSha256), (err) => err.code === 'API_JS_DIGEST');
    const next = resolveModuleRef({ branch: 'next', sha: '9f5e5c627a0be42cd25cf28339142891e71eba07' });
    assert.doesNotThrow(() => assertApiJsDigest(PINNED_API_JS_SHA256, next.apiJsSha256));
});

test('workflow passes the next moduleRef to the emitter', () => {
    const yml = fs.readFileSync(WORKFLOW_YML, 'utf8');
    assert.match(yml, /--module-ref-branch next/);
    assert.match(yml, /--module-ref-sha 9f5e5c627a0be42cd25cf28339142891e71eba07/);
});
