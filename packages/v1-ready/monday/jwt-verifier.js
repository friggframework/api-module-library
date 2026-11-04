const crypto = require('crypto');

function decodeSegment(segment) {
    try {
        return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

function signatureMatches(signingInput, signature, secret) {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(signingInput)
        .digest();
    const provided = Buffer.from(signature, 'base64url');
    return (
        provided.length === expected.length &&
        crypto.timingSafeEqual(provided, expected)
    );
}

/** monday sends the JWT bare; a Bearer prefix is tolerated, nothing else. */
function tokenFromAuthorization(header) {
    if (typeof header !== 'string') return null;
    return header.replace(/^Bearer\s+/i, '').trim() || null;
}

/**
 * Verify an HS256 JWT against the named secrets, failing closed.
 *
 * Only HS256 is accepted (an `alg: none` token must never verify), a token
 * with no numeric `exp` is rejected, and a secret that is unset is skipped
 * rather than matched against an empty key.
 *
 * @param {string|null} token
 * @param {Array<{name: string, value: string|undefined}>} secrets
 * @returns {{ok: true, claims: Object, secretName: string} | {ok: false, reason: string}}
 */
function verifyHs256Jwt(token, secrets, { now = Date.now() } = {}) {
    if (!token) return { ok: false, reason: 'missing' };

    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, reason: 'malformed' };

    const header = decodeSegment(parts[0]);
    const claims = decodeSegment(parts[1]);
    if (!header || !claims || typeof claims !== 'object') {
        return { ok: false, reason: 'malformed' };
    }
    if (header.alg !== 'HS256') return { ok: false, reason: 'alg' };

    const usable = secrets.filter((secret) => secret.value);
    if (usable.length === 0) return { ok: false, reason: 'no_secret' };

    const signingInput = `${parts[0]}.${parts[1]}`;
    const matched = usable.find((secret) =>
        signatureMatches(signingInput, parts[2], secret.value),
    );
    if (!matched) return { ok: false, reason: 'signature' };

    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) {
        return { ok: false, reason: 'expired' };
    }

    if (typeof claims.nbf === 'number' && claims.nbf * 1000 > now) {
        return { ok: false, reason: 'not_yet_valid' };
    }

    return { ok: true, claims, secretName: matched.name };
}

module.exports = { verifyHs256Jwt, tokenFromAuthorization };


