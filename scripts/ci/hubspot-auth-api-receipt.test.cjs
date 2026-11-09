'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    assertClassificationEnum,
    assertPacketByteEqual,
    rejectUnauthorizedAuthorized,
    evaluate42mattersLiveApiAlone,
    evaluateGqr,
    evaluate4bMissingOnly4aFields,
    isStaleRecorded,
    assertNoSecrets,
    forbiddenEnvHits,
    applyRedaction,
    ENUM,
} = require('./hubspot-auth-api-receipt.cjs');
const { TRANSFORM_ID } = require('./redaction-transform.v1.cjs');
const policy = require('./hubspot-4a-policy.cjs');

test('enum is synthetic|recorded|authorized', () => {
    assert.deepEqual(ENUM, ['synthetic', 'recorded', 'authorized']);
    assertClassificationEnum('synthetic');
    assertClassificationEnum('recorded');
    assertClassificationEnum('authorized');
    assert.throws(() => assertClassificationEnum('live'), /classification must be/);
});

test('T-C4-2: same bytes rewritten to authorized are not auto-accepted; packet must byte-equal artifact', () => {
    assertPacketByteEqual('synthetic', 'synthetic');
    assert.throws(() => assertPacketByteEqual('authorized', 'synthetic'), /T-C4-2/);
    assert.throws(() => assertPacketByteEqual('synthetic\n', 'synthetic'), /T-C4-2/);
    const fourA = { classification: 'synthetic' };
    const rewritten = { ...fourA, classification: 'authorized' };
    assert.throws(() => rejectUnauthorizedAuthorized(rewritten), /T-C4-5|T-C4-2|authorized/);
});

test('T-C4-9: stale, missing, or out-of-policy max-age bound fails', () => {
    assert.equal(isStaleRecorded('2020-01-01T00:00:00-05:00', 90, new Date('2026-11-09T13:00:00-05:00')), true);
    assert.equal(isStaleRecorded('2026-11-08T13:00:00-05:00', 90, new Date('2026-11-09T13:00:00-05:00')), false);
    // Missing bound is fail-closed, not a vacuous pass.
    assert.equal(isStaleRecorded('2026-11-08T13:00:00-05:00', null), true);
    assert.equal(policy.isFreshnessBoundInPolicy(90), true);
    assert.equal(policy.isFreshnessBoundInPolicy(99999), false);
    assert.equal(policy.isFreshnessBoundInPolicy(undefined), false);
    assert.equal(policy.FRESHNESS_MAX_AGE_DAYS, 90);
    assert.equal(policy.FRESHNESS_MAX_AGE_DAYS_STATUS, 'pending-architect');
});

test('T-C4-4: secret-shaped values are rejected; redaction binds transform id', () => {
    assert.throws(
        () => assertNoSecrets('fx', { access_token: 'super-secret-live-token-value' }),
        /T-C4-4/
    );
    assert.throws(
        () => assertNoSecrets('fx', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abc' }),
        /T-C4-4/
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

test('T-C4-5: authorized without Sean-held evidence is unresolved', () => {
    assert.throws(
        () => rejectUnauthorizedAuthorized({ classification: 'authorized' }),
        /T-C4-5/
    );
    assert.equal(
        rejectUnauthorizedAuthorized({
            classification: 'authorized',
            liveCiSubject: { runUrl: 'https://example.invalid/run/1' },
            seanHeldTokenEvidence: { placedBy: 'Sean', presentInCiSecrets: true, valueOmitted: true },
        }),
        'resolves'
    );
    assert.equal(rejectUnauthorizedAuthorized({ classification: 'synthetic' }), 'n/a');
});

test('T-C4-6: 42matters live api.test.js alone is not item 4', () => {
    assert.equal(
        evaluate42mattersLiveApiAlone({ onlyLiveApiTestJs: true, has4a: false, has4b: false }),
        'unresolved-not-item-4'
    );
    assert.equal(
        evaluate42mattersLiveApiAlone({ onlyLiveApiTestJs: true, has4a: true, has4b: false }),
        'ok'
    );
});

test('T-C4-7: 4a present + deployer missing keeps G-QR OPEN', () => {
    assert.equal(evaluateGqr({ has4a: true, hasDeployer: false }), 'OPEN');
});

test('T-C4-8: HUBSPOT_* and MATTERS_ACCESS_TOKEN are forbidden; GITHUB_TOKEN and unrelated secrets are not', () => {
    assert.deepEqual(
        forbiddenEnvHits({ HUBSPOT_ACCESS_TOKEN: 'x', HUBSPOT_SCOPE: 'oauth', GITHUB_TOKEN: 'g', FOO: '1' }).sort(),
        ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_SCOPE']
    );
    assert.deepEqual(forbiddenEnvHits({ MATTERS_ACCESS_TOKEN: 'x' }), ['MATTERS_ACCESS_TOKEN']);
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_CLIENT_ID: 'x' }), ['HUBSPOT_CLIENT_ID']);
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_LIVE_API: '1' }), ['HUBSPOT_LIVE_API']);
    assert.deepEqual(forbiddenEnvHits({ HUBSPOT_LIVE_API: '' }), []);
    assert.deepEqual(forbiddenEnvHits({ GITHUB_TOKEN: 'g', GH_TOKEN: 'g', FRONT_CLIENT_SECRET: 'x' }), []);
});

test('T-C4-10: 4b missing only 4a fixture fields still resolves when §3+§5 hold', () => {
    assert.equal(
        evaluate4bMissingOnly4aFields({
            classification: 'authorized',
            liveCiSubject: { runUrl: 'https://example.invalid/run/1' },
            seanHeldTokenEvidence: { placedBy: 'Sean' },
        }),
        'resolves'
    );
    assert.equal(
        evaluate4bMissingOnly4aFields({ classification: 'authorized' }),
        'unresolved'
    );
});

test('T-C4-1 extension: outbound shape matcher is not always-true', () => {
    const good = {
        method: 'POST',
        url: policy.TOKEN_ENDPOINT,
        body: { grant_type: 'authorization_code', client_id: 'id', code: 'c' },
    };
    assert.equal(policy.matchesTokenExchange(good), true);
    assert.equal(policy.matchesTokenExchange({ ...good, method: 'GET' }), false);
    assert.equal(policy.matchesTokenExchange({ ...good, url: 'https://api.hubapi.com/oauth/v1/token' }), false);
    assert.equal(
        policy.matchesTokenExchange({
            ...good,
            body: { grant_type: 'client_credentials', client_id: 'id', code: 'c' },
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
    assert.equal(policy.matchesBearerAuthorization('Bearer x'), true);
    assert.equal(policy.matchesBearerAuthorization('Basic x'), false);
});

test('T-C4-8: denied host list and closed token-env list are pinned', () => {
    assert.deepEqual(policy.DENIED_PROVIDER_HOSTS, [
        'api.hubapi.com',
        'app.hubspot.com',
        'api.hubspot.com',
    ]);
    assert.equal(policy.isDeniedProviderHost('api.hubapi.com'), true);
    assert.equal(policy.isDeniedProviderHost('example.com'), false);
    assert.ok(policy.TOKEN_ENV_NAMES.includes('HUBSPOT_ACCESS_TOKEN'));
    assert.ok(policy.TOKEN_ENV_NAMES.includes('HUBSPOT_CLIENT_SECRET'));
    assert.ok(policy.TOKEN_ENV_NAMES.includes('MATTERS_ACCESS_TOKEN'));
    assert.ok(policy.TOKEN_ENV_PREFIXES.includes('HUBSPOT_'));
    assert.ok(policy.TOKEN_ENV_PREFIXES.includes('MATTERS_'));
});
