#!/usr/bin/env node
/**
 * Emit a HubSpot auth/API test receipt for packages/v1-ready/hubspot.
 *
 * Classification may be `synthetic` or `recorded` only. This script refuses
 * `authorized` / live (CLASSIFICATION, AUTHORIZED_EVIDENCE). It does not read
 * secrets or contact the live HubSpot API.
 *
 * Usage:
 *   node scripts/ci/hubspot-auth-api-receipt.cjs --assert-offline-env
 *   node scripts/ci/hubspot-auth-api-receipt.cjs \
 *     --jest-json artifacts/jest-results.json \
 *     --out artifacts/hubspot-auth-api-receipt.json \
 *     --command '...' \
 *     --classification synthetic \
 *     --expect-classification synthetic
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
    TRANSFORM_ID,
    ALLOWED,
    JWT_RE,
    BEARER_RE,
    applyRedaction,
} = require('./redaction-transform.v1.cjs');
const policy = require('./hubspot-auth-api-policy.cjs');
const {
    FRESHNESS_MAX_AGE_DAYS,
    FRESHNESS_MAX_AGE_DAYS_STATUS,
    DENIED_PROVIDER_HOSTS,
    TOKEN_ENV_NAMES,
    TOKEN_ENV_PREFIXES,
    API_VERSION_PINS,
    isFreshnessBoundInPolicy,
    isStale,
    isDeniedProviderHost,
} = policy;

const REPO_ROOT = path.resolve(__dirname, '../..');
const MODULE_DIR = 'packages/v1-ready/hubspot';
const PACKAGE_JSON = path.join(REPO_ROOT, MODULE_DIR, 'package.json');
const API_JS = path.join(MODULE_DIR, 'api.js');
const PROVENANCE_REL = path.join(MODULE_DIR, 'tests/fixtures/provenance.json');
const GENERATOR_REL = path.join(MODULE_DIR, 'tests/fixtures/GENERATOR.md');
const TRANSFORM_REL = 'scripts/ci/redaction-transform.v1.cjs';

const SCHEMA = 'hubspot-auth-api-receipt.v1';
const ENUM = Object.freeze(['synthetic', 'recorded', 'authorized']);
const ALLOWED_CLASSIFICATIONS = new Set(['synthetic', 'recorded']);

// The hubspot api.js loaded at runtime must hash to this pin; a mismatch fails.
const PINNED_API_JS_SHA256 = 'af0b0bdc937820697a9bf158a6cc4f8a9e4fa22c96c535ee5af994720e4c3c60';

// Closed moduleRef map (identity of the module code under test). Exact branch
// + full sha only. Not the harness commit.
const BOUND_MODULE_REFS = Object.freeze([
    Object.freeze({
        branch: 'main',
        sha: 'd50c6a9d8f6f8264aaf4e6e9447991b4074ec455',
        apiJsSha256: 'f7e3046dcf0870b82faaf219bd37873b245622b695e4e358e1ea20035bf7f3d3',
    }),
    Object.freeze({
        branch: 'next',
        sha: '9f5e5c627a0be42cd25cf28339142891e71eba07',
        apiJsSha256: PINNED_API_JS_SHA256,
    }),
]);

function resolveModuleRef({ branch, sha } = {}) {
    const fail = (msg) => {
        const err = new Error(msg);
        err.code = 'UNKNOWN_MODULE_REF';
        return err;
    };
    if (!branch || !sha) throw fail('moduleRef.branch and moduleRef.sha are required');
    if (!/^[0-9a-f]{40}$/.test(String(sha))) throw fail(`moduleRef.sha must be a full 40-character commit: ${sha}`);
    const hit = BOUND_MODULE_REFS.find((r) => r.branch === branch && r.sha === sha);
    if (!hit) throw fail(`unknown moduleRef ${branch}@${sha}; not in the closed module ref map (fail closed)`);
    return { ...hit };
}

function assertApiJsDigest(digest, expected = PINNED_API_JS_SHA256) {
    if (digest !== expected) {
        const err = new Error(`runtime api.js sha256 ${digest} != moduleRef pin ${expected}`);
        err.code = 'API_JS_DIGEST';
        throw err;
    }
    return digest;
}

const ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// PROVIDER_ENV: any HUBSPOT_*, MATTERS_ACCESS_TOKEN, or peer token/secret env.
// GITHUB_TOKEN / GH_TOKEN / ACTIONS_* are not provider secrets.
// Do not treat unrelated provider secrets on a shared machine (e.g. FRONT_CLIENT_SECRET)
// or GITHUB_TOKEN as HubSpot/Matters tokens.
const FORBIDDEN_ENV = /^(HUBSPOT_.*|MATTERS_ACCESS_TOKEN)$/i;

function sha256File(absPath) {
    return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function sha256Text(text) {
    return crypto.createHash('sha256').update(Buffer.from(String(text), 'utf8')).digest('hex');
}

function git(args) {
    try {
        return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    } catch (_err) {
        return null;
    }
}

function parseArgs(argv) {
    const args = {
        jestJson: null,
        out: null,
        command: null,
        classification: 'synthetic',
        expectClassification: null,
        moduleRefBranch: null,
        moduleRefSha: null,
        assertOfflineEnv: false,
    };
    for (let i = 2; i < argv.length; i += 1) {
        const key = argv[i];
        if (key === '--assert-offline-env') {
            args.assertOfflineEnv = true;
            continue;
        }
        const val = argv[i + 1];
        if (key === '--jest-json') args.jestJson = val;
        else if (key === '--out') args.out = val;
        else if (key === '--command') args.command = val;
        else if (key === '--classification') args.classification = val;
        else if (key === '--expect-classification') args.expectClassification = val;
        else if (key === '--module-ref-branch') args.moduleRefBranch = val;
        else if (key === '--module-ref-sha') args.moduleRefSha = val;
        else continue;
        i += 1;
    }
    return args;
}

function forbiddenEnvHits(env) {
    return policy.forbiddenEnvHits(env);
}

function assertNoProviderEnv(env = process.env) {
    const hits = forbiddenEnvHits(env);
    if (hits.length) {
        const err = new Error(
            `PROVIDER_ENV: fail-closed: provider token/secret env present: ${hits.join(', ')}`
        );
        err.code = 'PROVIDER_ENV';
        throw err;
    }
    return true;
}

function assertClassificationEnum(value) {
    if (!ENUM.includes(value)) {
        const err = new Error(
            `classification must be one of ${ENUM.join('|')}, got ${JSON.stringify(value)}`
        );
        err.code = 'CLASSIFICATION';
        throw err;
    }
    return true;
}

function assertClassificationByteEqual(receiptClassification, artifactClassification) {
    const a = Buffer.from(String(artifactClassification), 'utf8');
    const b = Buffer.from(String(receiptClassification), 'utf8');
    if (!a.equals(b)) {
        const err = new Error(
            `CLASSIFICATION: receipt classification is not byte-equal to the CI artifact classification`
        );
        err.code = 'CLASSIFICATION';
        throw err;
    }
    return true;
}

function rejectUnauthorizedAuthorized(receipt) {
    if (receipt.classification !== 'authorized') return 'n/a';
    if (!receipt.liveCiSubject || !receipt.liveTokenEvidence) {
        const err = new Error(
            'AUTHORIZED_EVIDENCE: classification "authorized" without live token evidence / live CI subject'
        );
        err.code = 'AUTHORIZED_EVIDENCE';
        throw err;
    }
    return 'resolves';
}

function evaluateLiveSuiteAlone({ onlyLiveApiTestJs, hasAuthReceipt, hasAuthorizedEvidence }) {
    if (onlyLiveApiTestJs && !hasAuthReceipt && !hasAuthorizedEvidence) return 'unresolved-live-suite-alone';
    return 'ok';
}

function evaluateDeployerGate({ hasAuthReceipt, hasDeployer }) {
    if (hasAuthReceipt && !hasDeployer) return 'OPEN';
    if (hasAuthReceipt && hasDeployer) return 'not-decided-here';
    return 'OPEN';
}

function evaluateAuthorizedWithoutSyntheticFields({ classification, liveCiSubject, liveTokenEvidence }) {
    // AUTHORIZED_FIELDS: authorized runs do not require synthetic fixture fields
    if (classification === 'authorized' && liveCiSubject && liveTokenEvidence) {
        return 'resolves';
    }
    return 'unresolved';
}

function isStaleRecorded(capturedAt, maxAgeDays, now = new Date()) {
    return isStale(capturedAt, maxAgeDays, now);
}

function readModuleContracts() {
    const apiSrc = fs.readFileSync(path.join(REPO_ROOT, API_JS), 'utf8');
    return {
        tokenUri: /this\.tokenUri\s*=\s*'([^']+)'/.exec(apiSrc)?.[1] || null,
        accessTokenPath: /access_token:\s*'([^']+)'/.exec(apiSrc)?.[1] || null,
        introspectPath: /tokenIntrospect:\s*'([^']+)'/.exec(apiSrc)?.[1] || null,
        userDetailsPath: /userDetails:\s*'([^']+)'/.exec(apiSrc)?.[1] || null,
        contactsPath: /contacts:\s*'([^']+)'/.exec(apiSrc)?.[1] || null,
        source: API_JS,
    };
}

function validateFreshnessAndOrigin(provenance, classification) {
    const errors = [];
    if (!ISO_OFFSET.test(provenance.recordedAt || '')) {
        errors.push('PROVENANCE: recordedAt must be ISO-8601 with time and offset (date-only is not enough)');
    }
    if (classification === 'synthetic') {
        const gen = provenance.generator;
        if (!gen || !gen.tool || !gen.artifact) {
            errors.push('PROVENANCE: synthetic provenance missing generator (tool/command/artifact)');
        }
        if (gen && gen.artifact && !fs.existsSync(path.join(REPO_ROOT, gen.artifact))) {
            errors.push(`PROVENANCE: generator artifact missing: ${gen.artifact}`);
        }
    }
    if (classification === 'recorded') {
        for (const f of provenance.fixtures || []) {
            const c = f.capture || {};
            const required = [
                'capturedBy',
                'capturedAt',
                'providerApiVersion',
                'endpoint',
                'accountClassification',
                'tool',
                'command',
                'rawCaptureSha256',
                'redactionTransformId',
                'postRedactionSha256',
            ];
            // also accept namespaced fields
            const have = {
                capturedBy: c.capturedBy || c.who,
                capturedAt: c.capturedAt || c.when,
                providerApiVersion: c.providerApiVersion,
                endpoint: c.endpoint || f.endpoint,
                accountClassification: c.accountClassification,
                tool: c.tool || c.captureTool,
                command: c.command || c.captureCommand,
                rawCaptureSha256: c.rawCaptureSha256,
                redactionTransformId: (c.redactionTransform && c.redactionTransform.id) || c.redactionTransformId,
                postRedactionSha256: c.postRedactionSha256,
            };
            const missing = required.filter((k) => !have[k]);
            if (missing.length) {
                errors.push(`PROVENANCE: recorded fixture ${f.path} missing capture chain: ${missing.join(', ')}`);
            }
            if (have.capturedAt && !ISO_OFFSET.test(have.capturedAt)) {
                errors.push(`PROVENANCE: recorded fixture ${f.path} capturedAt must include time and offset`);
            }
            const maxAge = (provenance.freshness && provenance.freshness.maxAgeDays) || c.maxAgeDays;
            if (have.capturedAt && isStaleRecorded(have.capturedAt, maxAge)) {
                errors.push(`FRESHNESS: recorded fixture ${f.path} is stale (past max age ${maxAge} days)`);
            }
        }
        if (!(provenance.freshness && (provenance.freshness.maxAgeDays || provenance.freshness.rule))) {
            errors.push('PROVENANCE: recorded provenance missing freshness rule');
        }
    }

    const freshness = provenance.freshness || {};
    // Synthetic fixtures are not on the 90-day clock.
    // Recorded traffic must satisfy the adopted 90-day bound AND the pin
    // (pin checks follow). A missing or non-90 bound fails recorded receipts.
    if (classification === 'recorded') {
        if (!isFreshnessBoundInPolicy(freshness.maxAgeDays)) {
            errors.push(
                `FRESHNESS: freshness.maxAgeDays must equal the adopted policy constant ${FRESHNESS_MAX_AGE_DAYS}; got ${JSON.stringify(freshness.maxAgeDays)}`
            );
        }
        if (freshness.recordedAt || provenance.recordedAt) {
            const ts = freshness.recordedAt || provenance.recordedAt;
            if (isStale(ts, freshness.maxAgeDays)) {
                errors.push(`FRESHNESS: provenance recordedAt ${ts} is stale under maxAgeDays=${freshness.maxAgeDays}`);
            }
        }
        for (const fixture of provenance.fixtures || []) {
            const retrieved = fixture.capture && fixture.capture.sourceDocRetrievedAt;
            if (retrieved && isStale(retrieved, freshness.maxAgeDays)) {
                errors.push(`FRESHNESS: fixture ${fixture.path} sourceDocRetrievedAt is stale`);
            }
        }
    }

    const contracts = readModuleContracts();
    const pins = (provenance.freshness && provenance.freshness.pins) || [];
    for (const fixture of provenance.fixtures || []) {
        const contract = (fixture.capture && fixture.capture.providerContract) || fixture.endpoint || '';
        const version = fixture.capture && fixture.capture.providerApiVersion;
        if (!contract || !version) {
            errors.push(`PROVENANCE: fixture ${fixture.path} missing provider contract or API version`);
            continue;
        }
        const pin = pins.find((p) => p.contract === contract || contract.endsWith(p.contract.replace(/^(GET|POST) /, '')));
        if (!pin) {
            errors.push(`FRESHNESS: fixture ${fixture.path} contract ${contract} is not in the freshness pin list`);
            continue;
        }
        if (pin.providerApiVersion !== version) {
            errors.push(`FRESHNESS: fixture ${fixture.path} API version ${version} mismatches pin ${pin.providerApiVersion}`);
        }
        // module surface check
        const pathPart = contract.replace(/^(GET|POST)\s+https?:\/\/api\.hubapi\.com/, '').replace(/^(GET|POST)\s+/, '');
        const moduleText = [
            contracts.tokenUri,
            contracts.accessTokenPath,
            contracts.introspectPath,
            contracts.userDetailsPath,
            contracts.contactsPath,
        ].filter(Boolean).join('\n');
        if (pathPart && !moduleText.includes(pathPart) && !moduleText.includes(pathPart.replace(/^https:\/\/api\.hubapi\.com/, ''))) {
            errors.push(`FRESHNESS: fixture ${fixture.path} contract ${pathPart} does not match api.js pins`);
        }
    }

    if (errors.length) {
        const err = new Error(errors.join('; '));
        err.code = errors.some((e) => e.startsWith('FRESHNESS')) ? 'FRESHNESS' : 'PROVENANCE';
        err.details = errors;
        throw err;
    }
    return { ok: true, contracts };
}

function secretShapedHits(value, key, pathParts, acc) {
    if (Array.isArray(value)) {
        value.forEach((v, i) => secretShapedHits(v, key, pathParts.concat(String(i)), acc));
        return acc;
    }
    if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            secretShapedHits(v, k, pathParts.concat(k), acc);
        }
        return acc;
    }
    if (typeof value !== 'string') return acc;
    if (ALLOWED.test(value) || value.startsWith('[REDACTED:')) return acc;
    // Field names alone are not secrets; flag values that look like material.
    const lowered = (key || '').toLowerCase();
    // Exact key names only. Do not treat authorizationUri / tokenUri as secrets.
    const secretKeys = new Set(['access_token','refresh_token','client_secret','api_key','apikey','authorization','password','token']);
    if (secretKeys.has(lowered) && value.length > 0) {
        acc.push({ path: pathParts.join('.'), reason: `secret-keyed value for ${key}` });
        return acc;
    }
    if (JWT_RE.test(value)) acc.push({ path: pathParts.join('.'), reason: 'jwt-shaped' });
    if (BEARER_RE.test(value)) acc.push({ path: pathParts.join('.'), reason: 'authorization-bearer' });
    return acc;
}

function assertNoSecrets(label, objOrText) {
    let hits;
    if (typeof objOrText === 'string') {
        hits = [];
        if (JWT_RE.test(objOrText) || /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(objOrText)) {
            // allow if only in allowlisted placeholders; scan leftover after stripping allowed
            const cleaned = objOrText.replace(/synthetic-[A-Za-z0-9_-]+/g, '').replace(/\[REDACTED:[a-z0-9_]+\]/g, '');
            if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(cleaned)) {
                hits.push({ path: label, reason: 'jwt-shaped text' });
            }
        }
        // Only flag a live-looking Authorization Bearer value, not documentation
        // of the header form or synthetic / redacted placeholders.
        const authLive = /Authorization:\s*Bearer\s+(?!synthetic-|test-|\[REDACTED)(\S+)/i;
        if (authLive.test(objOrText)) {
            hits.push({ path: label, reason: 'authorization header' });
        }
    } else {
        hits = secretShapedHits(objOrText, null, [], []);
    }
    if (hits.length) {
        const err = new Error(`SECRET_SHAPED: secret-shaped material in ${label}: ${hits.map((h) => h.reason).join('; ')}`);
        err.code = 'SECRET_SHAPED';
        err.hits = hits;
        throw err;
    }
    return true;
}

function listFiles(relDir, predicate) {
    const abs = path.join(REPO_ROOT, relDir);
    const out = [];
    function walk(dir, rel) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            const nextAbs = path.join(dir, entry.name);
            const nextRel = path.join(rel, entry.name);
            if (entry.isDirectory()) walk(nextAbs, nextRel);
            else if (!predicate || predicate(nextRel)) out.push(nextRel.split(path.sep).join('/'));
        }
    }
    walk(abs, relDir);
    return out.sort();
}

function digestMap(files) {
    return files.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel))).map((rel) => ({
        path: rel,
        byteSha256: sha256File(path.join(REPO_ROOT, rel)),
        gitBlobSha: git(['hash-object', rel]),
    }));
}

function collectResult(jestJsonPath) {
    const raw = JSON.parse(fs.readFileSync(jestJsonPath, 'utf8'));
    const skipped = [];
    const failed = [];
    const passed = [];
    for (const suite of raw.testResults || []) {
        for (const t of suite.assertionResults || []) {
            const item = {
                title: t.fullName || t.title,
                status: t.status,
                ancestorTitles: t.ancestorTitles || [],
                file: path.relative(REPO_ROOT, suite.name || '').split(path.sep).join('/'),
            };
            if (t.status === 'passed') passed.push(item);
            else if (t.status === 'pending' || t.status === 'skipped' || t.status === 'disabled') skipped.push(item);
            else if (t.status === 'failed') failed.push(item);
        }
    }
    const counts = {
        passed: raw.numPassedTests ?? passed.length,
        failed: raw.numFailedTests ?? failed.length,
        skipped: raw.numPendingTests ?? skipped.length,
        todo: raw.numTodoTests ?? 0,
        total: raw.numTotalTests ?? passed.length + failed.length + skipped.length,
    };
    const status = counts.failed === 0 && raw.success !== false ? 'pass' : 'fail';
    return { status, counts, skipped, failed, passed };
}

function exercisedAuthPaths(result) {
    const titles = result.passed.map((t) => t.title).join('\n');
    return {
        tokenExchange: /getToken|getTokenFromCode|authorization_code/.test(titles),
        refresh: /refreshAccessToken|refresh_token|refresh via/.test(titles),
        headerSigning: /addAuthHeaders|Bearer header|header \/ signing/.test(titles),
        testAuthRequest: /testAuthRequest/.test(titles),
        listContacts: /listContacts/.test(titles),
        negative: /rejects|inactive|401|invalid_grant|tampered|expired/.test(titles),
    };
}

function buildReceipt(opts) {
    assertNoProviderEnv();
    const classification = opts.classification;
    assertClassificationEnum(classification);
    if (!ALLOWED_CLASSIFICATIONS.has(classification)) {
        const err = new Error(
            'This job will not emit authorized/live receipts (CLASSIFICATION, AUTHORIZED_EVIDENCE).'
        );
        err.code = 'CLASSIFICATION';
        throw err;
    }
    if (opts.expectClassification != null) {
        assertClassificationByteEqual(opts.expectClassification, classification);
    }

    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const provenance = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, PROVENANCE_REL), 'utf8'));
    if (provenance.classification && provenance.classification !== classification) {
        const err = new Error('provenance.classification does not match receipt classification');
        err.code = 'CLASSIFICATION';
        throw err;
    }
    validateFreshnessAndOrigin(provenance, classification);

    // Hash the exact file Node resolves for the module's Api at runtime.
    const apiJsResolved = require.resolve(path.join(REPO_ROOT, MODULE_DIR, 'api'));
    const moduleRef = resolveModuleRef({ branch: opts.moduleRefBranch, sha: opts.moduleRefSha });
    const apiJsSha256 = assertApiJsDigest(sha256File(apiJsResolved), moduleRef.apiJsSha256);

    const generatorDigest = sha256File(path.join(REPO_ROOT, GENERATOR_REL));
    const transformDigest = sha256File(path.join(REPO_ROOT, TRANSFORM_REL));

    const fixtureEntries = (provenance.fixtures || []).map((f) => {
        const abs = path.join(REPO_ROOT, f.path);
        if (!fs.existsSync(abs)) throw new Error(`fixture missing: ${f.path}`);
        const body = JSON.parse(fs.readFileSync(abs, 'utf8'));
        assertNoSecrets(f.path, body);
        return {
            ...f,
            byteSha256: sha256File(abs),
        };
    });

    const result = collectResult(opts.jestJson);
    const exercised = exercisedAuthPaths(result);
    if (result.status === 'pass') {
        const missing = [];
        if (!exercised.tokenExchange) missing.push('token exchange');
        if (!exercised.refresh) missing.push('refresh');
        if (!exercised.headerSigning) missing.push('header/signing');
        if (!exercised.negative) missing.push('mutation/negative');
        if (missing.length) {
            const err = new Error(`AUTH_COVERAGE: green requires real auth paths + a failing negative; missing: ${missing.join(', ')}`);
            err.code = 'AUTH_COVERAGE';
            throw err;
        }
    }

    const testFiles = listFiles(path.join(MODULE_DIR, 'tests'), (rel) => /\.(js|json|md)$/.test(rel));
    const harnessFiles = [
        path.join(MODULE_DIR, 'jest.config.js'),
        path.join(MODULE_DIR, 'jest.receipt.config.js'),
        path.join(MODULE_DIR, 'jest-setup.js'),
        path.join(MODULE_DIR, 'jest-teardown.js'),
        'scripts/ci/hubspot-auth-api-receipt.cjs',
        'scripts/ci/redaction-transform.v1.cjs',
        'scripts/ci/hubspot-auth-api-policy.cjs',
        '.github/workflows/hubspot-auth-api-receipt.yml',
    ];
    const configFiles = [
        path.join(MODULE_DIR, 'package.json'),
        path.join(MODULE_DIR, 'jest.config.js'),
        path.join(MODULE_DIR, 'jest.receipt.config.js'),
        path.join(MODULE_DIR, 'defaultConfig.json'),
        path.join(MODULE_DIR, 'definition.js'),
    ];

    const sourceCommitSha = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
    const lockfileRel = 'package-lock.json';

    const receipt = {
        schema: SCHEMA,
        classification,
        classificationSha256: sha256Text(classification),
        moduleRef,
        policy: {
            freshnessMaxAgeDays: FRESHNESS_MAX_AGE_DAYS,
            freshnessMaxAgeDaysStatus: FRESHNESS_MAX_AGE_DAYS_STATUS,
            apiVersionPins: API_VERSION_PINS,
            deniedProviderHosts: DENIED_PROVIDER_HOSTS,
            tokenEnvNames: TOKEN_ENV_NAMES,
            tokenEnvPrefixes: TOKEN_ENV_PREFIXES,
        },
        recordedDate: provenance.recordedDate,
        recordedAt: provenance.recordedAt,
        timeZone: provenance.timeZone || 'America/New_York',
        source: {
            repo: 'friggframework/api-module-library',
            sourceCommitSha,
            ref: process.env.GITHUB_REF || git(['rev-parse', '--abbrev-ref', 'HEAD']),
        },
        artifact: {
            moduleId: 'hubspot',
            packageName: pkg.name,
            packageVersion: pkg.version,
            packageDir: MODULE_DIR,
            packageTreeSha: git(['rev-parse', `HEAD:${MODULE_DIR}`]),
            apiJs: {
                path: path.relative(REPO_ROOT, apiJsResolved),
                sha256: apiJsSha256,
                pinnedSha256: PINNED_API_JS_SHA256,
            },
            lockfile: {
                path: lockfileRel,
                byteSha256: sha256File(path.join(REPO_ROOT, lockfileRel)),
                gitBlobSha: git(['hash-object', lockfileRel]),
            },
        },
        authMode: {
            type: 'oauth2',
            flow: 'authorization_code',
            authorizationEndpoint: 'https://app.hubspot.com/oauth/authorize',
            tokenUri: 'https://api.hubapi.com/oauth/2026-03/token',
            verifiedIn: [
                'packages/v1-ready/hubspot/definition.js — requiredAuthMethods.getToken reads params.code and calls api.getTokenFromCode(code)',
                'packages/v1-ready/hubspot/api.js — tokenUri https://api.hubapi.com/oauth/2026-03/token; refresh via OAuth2Requester.refreshAccessToken',
                'packages/v1-ready/hubspot/definition.js — requiredAuthMethods.testAuthRequest calls api.getUserDetails()',
                '@friggframework/core OAuth2Requester.addAuthHeaders constructs a Bearer token header',
            ],
        },
        digests: {
            tests: digestMap(testFiles),
            harness: digestMap(harnessFiles),
            lock: digestMap([lockfileRel]),
            config: digestMap(configFiles),
        },
        fixtures: {
            origin: 'synthetic',
            provenancePath: PROVENANCE_REL,
            provenanceByteSha256: sha256File(path.join(REPO_ROOT, PROVENANCE_REL)),
            recordedAt: provenance.recordedAt,
            classification: provenance.classification,
            generator: {
                ...provenance.generator,
                digest: generatorDigest,
            },
            freshness: provenance.freshness,
            redactionTransform: {
                id: TRANSFORM_ID,
                path: TRANSFORM_REL,
                digest: transformDigest,
            },
            entries: fixtureEntries,
        },
        command: opts.command,
        result: {
            status: result.status,
            counts: result.counts,
            exercisedAuthPaths: exercised,
            skipped: result.skipped.map((t) => ({ title: t.title, file: t.file })),
            failed: result.failed.map((t) => ({ title: t.title, file: t.file })),
        },
        ciArtifact: ciArtifactRef(opts.out),
        reviewer: {
            note: 'This job only emits the summary and does not claim human review.',
        },
        exclusions: [
            {
                id: 'live-api-interactive-suite',
                path: path.join(MODULE_DIR, 'tests/api.test.js'),
                reason: 'Interactive OAuth suite (Authenticator.oauth2). Not part of the receipt command (jest.receipt.config.js). Always skipped in this job. Not an authorized live path.',
            },
            {
                id: 'live-auther-suite',
                path: path.join(MODULE_DIR, 'tests/auther.test.js'),
                reason: "describe.skip('HubSpot Module Live Tests') and the mocked testAutherDefinition suite (needs MongoMemoryServer). Excluded from the receipt command.",
            },
            {
                id: 'webhook-signature',
                path: path.join(MODULE_DIR, 'tests/extensions/webhooks.test.js'),
                reason: 'Webhook signature verification is not an auth path (token exchange / refresh / request header). Excluded from the receipt command.',
            },
            {
                id: 'basic-auth-token-exchange',
                reason: 'OAuth2Requester.getTokenFromCodeBasicAuthHeader is not used by the HubSpot module (exchange is form-encoded client_id/client_secret in the body). Not exercised.',
            },
            {
                id: 'authorized-live-out-of-scope',
                reason: 'An authorized live run is out of scope for this offline receipt. This receipt must never be relabelled authorized or live (CLASSIFICATION, AUTHORIZED_EVIDENCE).',
            },
            {
                id: 'uncovered-api-surface',
                reason: 'Synthetic tests cover getToken, refreshAccessToken, addAuthHeaders, testAuthRequest/getUserDetails, and listContacts. Other Api methods are not claimed.',
            },
            {
                id: 'hapikey-query-auth',
                path: path.join(MODULE_DIR, 'api.js'),
                reason: 'HubSpot hapikey / this.api_key query-auth at api.js L450–L451 and L521–L522 is a supported auth path not exercised in this receipt.',
            },
        ],
        noSecrets: true,
        deploymentNote: {
            note: 'Offline synthetic tests alone do not cover deployment.',
            statusIfDeployerMissing: 'OPEN',
        },
    };

    rejectUnauthorizedAuthorized(receipt);
    assertNoSecrets('receipt', receipt);
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    assertNoSecrets('receipt-text', serialized);
    return { receipt, serialized };
}

function ciArtifactRef(outPath) {
    const repo = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
    const rel = path.relative(REPO_ROOT, path.resolve(outPath)).split(path.sep).join('/');
    if (repo && runId) {
        return {
            kind: 'github-actions',
            artifactName: 'hubspot-auth-api-receipt',
            path: rel,
            classificationPath: path.posix.join(path.posix.dirname(rel), 'classification'),
            runUrl: `${server}/${repo}/actions/runs/${runId}`,
            runId,
            sha: process.env.GITHUB_SHA || null,
        };
    }
    return {
        kind: 'local',
        path: rel,
        classificationPath: path.posix.join(path.posix.dirname(rel), 'classification'),
        note: 'Local receipt run. GitHub Actions artifact "hubspot-auth-api-receipt" plus the run URL is the CI artifact reference once the job runs on GitHub.',
    };
}

function writeStepSummary(receipt) {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) return;
    const counts = receipt.result.counts;
    const md = [
        '## HubSpot auth/API test receipt',
        '',
        `- classification: \`${receipt.classification}\` (sha256 ${receipt.classificationSha256})`,
        `- result: **${receipt.result.status}** (passed ${counts.passed}, failed ${counts.failed}, skipped ${counts.skipped}, total ${counts.total})`,
        `- auth mode: ${receipt.authMode.type} ${receipt.authMode.flow}`,
        `- exercised: exchange=${receipt.result.exercisedAuthPaths.tokenExchange} refresh=${receipt.result.exercisedAuthPaths.refresh} header=${receipt.result.exercisedAuthPaths.headerSigning} negative=${receipt.result.exercisedAuthPaths.negative}`,
        `- source commit: \`${receipt.source.sourceCommitSha}\``,
        '',
        'This receipt is synthetic only. It is not a live or authorized run. Offline tests alone do not cover deployment.',
        '',
        '```json',
        JSON.stringify(receipt, null, 2),
        '```',
        '',
    ].join('\n');
    fs.appendFileSync(summaryFile, md);
}

function main() {
    const args = parseArgs(process.argv);
    if (args.assertOfflineEnv) {
        assertNoProviderEnv();
        console.log('PROVIDER_ENV: no provider token env present');
        return;
    }
    if (!args.jestJson || !args.out) {
        console.error('Usage: hubspot-auth-api-receipt.cjs --jest-json <file> --out <file> [--command <cmd>] [--classification synthetic|recorded] [--expect-classification <value>]');
        process.exit(2);
    }
    if (!fs.existsSync(args.jestJson)) {
        console.error(`jest json not found: ${args.jestJson}`);
        process.exit(2);
    }
    const command = args.command || process.env.AML_RECEIPT_COMMAND || '(unspecified)';
    const { receipt, serialized } = buildReceipt({
        jestJson: args.jestJson,
        out: args.out,
        command,
        classification: args.classification,
        expectClassification: args.expectClassification,
        moduleRefBranch: args.moduleRefBranch,
        moduleRefSha: args.moduleRefSha,
    });
    const outAbs = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, serialized);
    const classAbs = path.join(path.dirname(outAbs), 'classification');
    // Exact classification string bytes, no trailing newline, for classification byte-equality.
    fs.writeFileSync(classAbs, Buffer.from(receipt.classification, 'utf8'));
    writeStepSummary(receipt);
    console.log(`wrote ${path.relative(REPO_ROOT, outAbs) || outAbs}`);
    console.log(`wrote classification bytes (${receipt.classification}) sha256=${receipt.classificationSha256}`);
    console.log(JSON.stringify({
        schema: receipt.schema,
        classification: receipt.classification,
        result: receipt.result.status,
        counts: receipt.result.counts,
        exercisedAuthPaths: receipt.result.exercisedAuthPaths,
        sourceCommitSha: receipt.source.sourceCommitSha,
    }, null, 2));
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
    }
}

module.exports = {
    ENUM,
    PINNED_API_JS_SHA256,
    assertApiJsDigest,
    BOUND_MODULE_REFS,
    resolveModuleRef,
    ALLOWED_CLASSIFICATIONS,
    FRESHNESS_MAX_AGE_DAYS,
    DENIED_PROVIDER_HOSTS,
    TOKEN_ENV_NAMES,
    forbiddenEnvHits,
    assertNoProviderEnv,
    assertClassificationEnum,
    assertClassificationByteEqual,
    rejectUnauthorizedAuthorized,
    evaluateLiveSuiteAlone,
    evaluateDeployerGate,
    evaluateAuthorizedWithoutSyntheticFields,
    isStaleRecorded,
    validateFreshnessAndOrigin,
    assertNoSecrets,
    buildReceipt,
    applyRedaction,
};
