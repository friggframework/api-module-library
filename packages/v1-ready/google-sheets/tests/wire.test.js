/**
 * The bug class that api.test.js structurally cannot see: api.test.js
 * overrides `_get`/`_post`/`_put` directly, one layer ABOVE
 * `@friggframework/core`'s `Requester._rawRequest` — so it can only assert
 * what THIS module asked the transport to send, never what the transport
 * actually put on the wire. `_rawRequest` runs its own `encodeURI(url)` pass
 * over whatever url it is handed, unconditionally, and that is exactly where
 * an already-percent-encoded range got double-encoded (W1): every stubbed
 * test above passed while every real request 400'd.
 *
 * This suite makes no such assumption: it constructs a REAL `Api` (a real
 * `OAuth2Requester` → `Requester`) and lets `nock` intercept the actual HTTP
 * call `_rawRequest` makes — no network, no credentials, and no stub between
 * this module and the real encoding pass. If a future change reintroduces
 * double-encoding, or breaks `ranges=` repetition, this is the layer that
 * catches it; api.test.js's stubbed assertions would stay green regardless.
 */
const nock = require('nock');
const { Api } = require('../api');

function makeApi() {
    return new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/cb',
    });
}

describe('the real wire (nock against the real Requester, not a stub)', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    // node-fetch's own URL parsing percent-encodes an apostrophe to `%27`
    // regardless of anything this module or core does — that is a real,
    // single, harmless encoding (Google decodes it straight back to `'`
    // before parsing the A1 notation), NOT the bug. The bug is DOUBLE
    // encoding: a `%` in the URL this module hands to core becoming `%25`.
    // So each assertion below captures the exact URI the request actually
    // used and checks for that signature directly, rather than guessing
    // every character node-fetch's URL layer does or doesn't touch — a
    // %2520/%253A/%2527 anywhere is the double-encoding bug; their absence,
    // alongside the real (single-encoded) request succeeding against the
    // nock interceptor at all, is what's being proved.
    const capture = (methodPath) => {
        let uri = null;
        const scope = nock('https://sheets.googleapis.com')
            [methodPath.method](methodPath.path)
            .query(true)
            .reply(function (u) {
                uri = this.req.path;
                return [200, methodPath.body ?? {}];
            });
        return { scope, uri: () => uri };
    };
    const assertSingleEncoded = (uri) => {
        expect(uri).not.toMatch(/%25/); // the double-encoding signature
        expect(uri).not.toBeNull();
    };

    it('getValues: a tab name with a space and a colon-ranged A1 survives encodeURI exactly once', async () => {
        const cap = capture({ method: 'get', path: /^\/v4\/spreadsheets\/SHEET1\/values\// });
        const result = await makeApi().getValues('SHEET1', "'Issues List'!B4:B41");
        expect(result).toEqual({});
        assertSingleEncoded(cap.uri());
        expect(cap.uri()).toBe(
            "/v4/spreadsheets/SHEET1/values/%27Issues%20List%27!B4:B41?valueRenderOption=UNFORMATTED_VALUE"
        );
    });

    it('updateValues (PUT): the same range in the path is not double-encoded', async () => {
        const cap = capture({ method: 'put', path: /^\/v4\/spreadsheets\/SHEET1\/values\// });
        await makeApi().updateValues('SHEET1', "'Issues List'!A1", [[1]]);
        assertSingleEncoded(cap.uri());
        expect(cap.uri()).toBe(
            "/v4/spreadsheets/SHEET1/values/%27Issues%20List%27!A1?valueInputOption=RAW"
        );
    });

    it('clearValues (POST :clear): the range in the path is not double-encoded', async () => {
        const cap = capture({ method: 'post', path: /^\/v4\/spreadsheets\/SHEET1\/values\// });
        await makeApi().clearValues('SHEET1', "'Issues List'!A1");
        assertSingleEncoded(cap.uri());
        expect(cap.uri()).toBe("/v4/spreadsheets/SHEET1/values/%27Issues%20List%27!A1:clear");
    });

    it('batchGetValues: `ranges` is REPEATED on the real wire, not comma-joined', async () => {
        const scope = nock('https://sheets.googleapis.com')
            .get('/v4/spreadsheets/SHEET1/values:batchGet')
            .query({
                ranges: ["'Issues List'", "'Budget'"],
                valueRenderOption: 'UNFORMATTED_VALUE',
            })
            .reply(200, { valueRanges: [] });

        await makeApi().batchGetValues('SHEET1', ["'Issues List'", "'Budget'"]);
        expect(scope.isDone()).toBe(true);
    });

    it('getSheetsWithGridData: includeGridData + fields survive real encoding, scoped to one call', async () => {
        const scope = nock('https://sheets.googleapis.com')
            .get('/v4/spreadsheets/SHEET1')
            .query({
                includeGridData: 'true',
                fields: 'sheets(properties.title,data.rowData.values(userEnteredValue,effectiveValue))',
            })
            .reply(200, { sheets: [] });

        await makeApi().getSheetsWithGridData('SHEET1');
        expect(scope.isDone()).toBe(true);
    });
});
