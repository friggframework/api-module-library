const {
    verifyPathToken,
    generatePathToken,
    normalizeMessageEvent,
    EVENTS,
} = require('../webhooks');

describe('Podium webhook path token', () => {
    it('accepts the matching token', () => {
        const token = generatePathToken();
        expect(verifyPathToken(token, token)).toBe(true);
    });

    it('rejects a different token', () => {
        expect(verifyPathToken(generatePathToken(), generatePathToken())).toBe(false);
    });

    it('rejects a token of a different length without throwing', () => {
        // crypto.timingSafeEqual throws on length mismatch, so the comparison
        // must go through fixed-width digests.
        const token = generatePathToken();
        expect(() => verifyPathToken('short', token)).not.toThrow();
        expect(verifyPathToken('short', token)).toBe(false);
    });

    it('rejects an absent token rather than passing', () => {
        const token = generatePathToken();
        for (const provided of [undefined, null, '']) {
            expect(verifyPathToken(provided, token)).toBe(false);
        }
    });

    it('throws when no token is configured, rather than accepting everything', () => {
        expect(() => verifyPathToken('anything')).toThrow(/path token is required/);
        expect(() => verifyPathToken('anything', '')).toThrow(/path token is required/);
    });

    it('generates 256 bits of entropy, distinct each time', () => {
        const a = generatePathToken();
        const b = generatePathToken();
        expect(a).toHaveLength(64);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(a).not.toEqual(b);
    });
});

describe('normalizeMessageEvent', () => {
    const inbound = {
        type: 'message.received',
        body: 'Can you come Tuesday?',
        conversationUid: 'conv-1',
        locationUid: 'loc-1',
        organizationUid: 'org-1',
        channel: { type: 'phone', identifier: '8001119232' },
        createdAt: '2026-08-13T15:04:00Z',
    };

    it('reads identity from channel and conversation, not the deprecated objects', () => {
        // Podium marks the `contact` and `sender` objects as deprecated and due
        // for removal, so nothing here may depend on them.
        const withDeprecated = {
            ...inbound,
            contact: { name: 'Jane', uid: 'contact-1' },
            sender: { userUid: 'user-1' },
        };
        const normalized = normalizeMessageEvent(withDeprecated);

        expect(normalized.identifier).toEqual('8001119232');
        expect(normalized.conversationUid).toEqual('conv-1');
        expect(JSON.stringify(normalized)).not.toContain('Jane');
        expect(JSON.stringify(normalized)).not.toContain('user-1');
    });

    it('labels inbound and outbound direction', () => {
        expect(normalizeMessageEvent(inbound).direction).toEqual('inbound');
        expect(
            normalizeMessageEvent({ ...inbound, type: EVENTS.MESSAGE_SENT }).direction
        ).toEqual('outbound');
    });

    it('leaves direction null for a failed message', () => {
        // A failure is neither side of the conversation — it must not be written
        // back to ServiceTitan as though the customer said something.
        const failed = normalizeMessageEvent({
            ...inbound,
            type: EVENTS.MESSAGE_FAILED,
            failureReason: 'landline',
        });
        expect(failed.direction).toBeNull();
        expect(failed.failureReason).toEqual('landline');
    });

    it('falls back to a nested conversation uid', () => {
        const { conversationUid, ...rest } = inbound;
        const normalized = normalizeMessageEvent({
            ...rest,
            conversation: { uid: 'conv-nested' },
        });
        expect(normalized.conversationUid).toEqual('conv-nested');
    });

    it('returns a fully null-shaped object for an empty payload', () => {
        const normalized = normalizeMessageEvent();
        expect(normalized.eventType).toBeNull();
        expect(normalized.identifier).toBeNull();
        expect(normalized.direction).toBeNull();
    });

    it('preserves an empty-string body rather than nulling it', () => {
        expect(normalizeMessageEvent({ ...inbound, body: '' }).body).toEqual('');
    });
});
