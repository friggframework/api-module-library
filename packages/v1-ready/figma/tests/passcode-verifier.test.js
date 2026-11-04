const {
    verifyFigmaPasscode,
} = require('../extensions/webhooks/passcode-verifier');

describe('verifyFigmaPasscode', () => {
    it('accepts a matching passcode', () => {
        expect(
            verifyFigmaPasscode({
                body: { event_type: 'PING', passcode: 'secret' },
                expectedPasscode: 'secret',
            })
        ).toEqual({ valid: true });
    });

    it('rejects mismatches and missing values', () => {
        expect(
            verifyFigmaPasscode({
                body: { passcode: 'nope' },
                expectedPasscode: 'secret',
            }).valid
        ).toBe(false);
        expect(
            verifyFigmaPasscode({
                body: {},
                expectedPasscode: 'secret',
            }).valid
        ).toBe(false);
        expect(
            verifyFigmaPasscode({
                body: { passcode: 'secret' },
                expectedPasscode: '',
            }).valid
        ).toBe(false);
    });
});
