const { Api, buildRange, quoteSheetName, toFormulaGrid } = require('../api');

function makeApi() {
    const api = new Api({ access_token: 'test-token' });
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    return api;
}

const last = (api) => api.sent[api.sent.length - 1];

describe('A1 range building', () => {
    it('quotes a sheet name so spaces and emoji survive', () => {
        expect(buildRange('🚫 Issues List', 'B4:B41')).toBe(
            "'🚫 Issues List'!B4:B41"
        );
    });

    it('escapes an apostrophe by doubling it, per the A1 grammar', () => {
        // Not escaping here produces a range that terminates early and either
        // 400s or, worse, addresses a different sheet.
        expect(quoteSheetName("Bob's Goals")).toBe("'Bob''s Goals'");
        expect(buildRange("Bob's Goals", 'A1:A2')).toBe("'Bob''s Goals'!A1:A2");
    });

    it('addresses the whole tab when no range is given', () => {
        expect(buildRange('Weekly Meetings')).toBe("'Weekly Meetings'");
    });

    it('quotes a plain name too, rather than guessing when quoting is optional', () => {
        expect(buildRange('Sheet1', 'A1:B2')).toBe("'Sheet1'!A1:B2");
    });
});

describe('Google Sheets Api', () => {
    describe('auth', () => {
        it('points at the Sheets API host, not www.googleapis.com', () => {
            expect(makeApi().baseUrl).toBe('https://sheets.googleapis.com');
        });

        it('requests offline access and forces consent, or no refresh token is issued', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://example.com/cb',
                scope: 'https://www.googleapis.com/auth/spreadsheets',
            });
            api.setState('st8');
            const uri = api.getAuthorizationUri();
            expect(uri).toContain('access_type=offline');
            expect(uri).toContain('prompt=consent');
            expect(uri).toContain('state=st8');
            expect(uri).toContain('client_id=cid');
        });

        it('reads identity from the userinfo endpoint — Sheets has no "who am I"', async () => {
            const api = makeApi();
            await api.getUserDetails();
            expect(last(api).url).toBe(
                'https://www.googleapis.com/oauth2/v2/userinfo'
            );
        });

        it('getTokenIdentity keys on the stable account id, not the email', async () => {
            const api = makeApi();
            api.getUserDetails = async () => ({
                id: '11822',
                email: 'a@b.com',
            });
            // An email can be changed by the account owner; the id cannot.
            expect(await api.getTokenIdentity()).toEqual({
                identifier: '11822',
                name: 'a@b.com',
            });
        });
    });

    describe('reading values', () => {
        it('defaults to UNFORMATTED_VALUE, not the API default', async () => {
            const api = makeApi();
            await api.getValues('sid', "'Issues'!B4:B41");
            // FORMATTED_VALUE (Google's default) returns locale-formatted
            // STRINGS, so a round trip silently changes types.
            expect(last(api).query.valueRenderOption).toBe('UNFORMATTED_VALUE');
        });

        it('can be asked for formulas instead of results', async () => {
            const api = makeApi();
            await api.getValues('sid', 'A1:A2', {
                valueRenderOption: 'FORMULA',
            });
            expect(last(api).query.valueRenderOption).toBe('FORMULA');
        });

        it('puts the RAW range in the path, unencoded — core\'s Requester encodeURI()s the whole url once', async () => {
            // NOT encodeURIComponent(range) here: core's Requester already
            // runs `encodeURI(url)` over the whole request exactly once. A
            // range this module pre-encoded got double-encoded on the real
            // wire (`%20` -> `%2520`, `:` -> `%253A`) — see wire.test.js for
            // the assertion against the REAL Requester that catches that; a
            // stubbed `_get` like this one can only prove what this module
            // itself sent, not what actually left the process.
            const api = makeApi();
            await api.getValues('sid', buildRange('🚫 Issues List', 'B4:B41'));
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid/values/'🚫 Issues List'!B4:B41"
            );
        });

        it('encodes a spreadsheet id containing URL-significant characters', async () => {
            const api = makeApi();
            await api.getValues('a/b?c', 'A1:A1');
            expect(last(api).url).toContain(
                '/v4/spreadsheets/a%2Fb%3Fc/values/'
            );
        });

        it('escapes a `#` in a tab title so the request is not truncated at it', async () => {
            // encodeURI (the one pass core's Requester runs over the whole
            // url) treats `#` as a fragment start and leaves it literal —
            // unescaped, "Kids #2" truncates the request at "Kids ".
            const api = makeApi();
            await api.getValues('sid', buildRange('Kids #2', 'A1'));
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid/values/'Kids %232'!A1"
            );
        });

        it('escapes a `?` in a tab title so it is not read as a query start', async () => {
            const api = makeApi();
            await api.getValues('sid', buildRange('Why?', 'A1'));
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid/values/'Why%3F'!A1"
            );
        });

        it('omits optional query params rather than sending undefined', async () => {
            const api = makeApi();
            await api.getValues('sid', 'A1:A1');
            expect(Object.keys(last(api).query)).toEqual(['valueRenderOption']);
        });

        it('batchGet repeats the `ranges` key per range, rather than comma-joining an array', async () => {
            // Google's API requires `ranges=A&ranges=B` (a repeated key); a
            // single comma-joined `ranges=A,B` reads as ONE unmatched range.
            // core's Requester query serializer has no array support (it
            // stringifies an array into exactly that comma-joined shape), so
            // this module builds the query string itself rather than
            // handing an array to `options.query` — asserted here on the
            // actual url this module hands to `_get`, not on a `query`
            // object the transport never sees.
            const api = makeApi();
            await api.batchGetValues('sid', ["'A'!A1:A2", "'B'!A1:A2"]);
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid/values:batchGet?ranges='A'!A1:A2&ranges='B'!A1:A2&valueRenderOption=UNFORMATTED_VALUE"
            );
        });

        it('batchGet appends dateTimeRenderOption only when given', async () => {
            const api = makeApi();
            await api.batchGetValues('sid', ["'A'!A1"], {
                dateTimeRenderOption: 'FORMATTED_STRING',
            });
            expect(last(api).url).toContain(
                '&dateTimeRenderOption=FORMATTED_STRING'
            );
        });

        it('batchGet escapes `#`/`?` in a range so they are not read structurally', async () => {
            const api = makeApi();
            await api.batchGetValues('sid', [buildRange('Kids #2', 'A1')]);
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid/values:batchGet?ranges='Kids %232'!A1&valueRenderOption=UNFORMATTED_VALUE"
            );
        });
    });

    describe('getSpreadsheet', () => {
        it('sends includeGridData/fields as an ordinary query when no ranges are given', async () => {
            const api = makeApi();
            await api.getSpreadsheet('sid', { fields: 'sheets.properties' });
            expect(last(api).url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/sid'
            );
            expect(last(api).query.fields).toBe('sheets.properties');
        });

        it('repeats the `ranges` key per range, rather than comma-joining an array — the same bug batchGetValues has already fixed', async () => {
            const api = makeApi();
            await api.getSpreadsheet('sid', {
                ranges: ["'A'!A1:A2", "'B'!A1:A2"],
            });
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid?ranges='A'!A1:A2&ranges='B'!A1:A2"
            );
        });

        it('accepts a single range (not just an array)', async () => {
            const api = makeApi();
            await api.getSpreadsheet('sid', { ranges: "'A'!A1:A2" });
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid?ranges='A'!A1:A2"
            );
        });

        it('escapes `#`/`?` in a ranges entry the same way values/batchGetValues do', async () => {
            const api = makeApi();
            await api.getSpreadsheet('sid', { ranges: [buildRange('Why?', 'A1')] });
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid?ranges='Why%3F'!A1"
            );
        });

        it('combines ranges with includeGridData and fields on the one manually-built query string', async () => {
            const api = makeApi();
            await api.getSpreadsheet('sid', {
                ranges: ["'A'!A1"],
                includeGridData: true,
                fields: 'sheets.data',
            });
            expect(last(api).url).toBe(
                "https://sheets.googleapis.com/v4/spreadsheets/sid?ranges='A'!A1&includeGridData=true&fields=sheets.data"
            );
        });
    });

    describe('createSpreadsheet', () => {
        it('POSTs the caller-supplied body to the bare spreadsheets endpoint', async () => {
            const api = makeApi();
            const body = { properties: { title: 'New Household Workbook' } };
            await api.createSpreadsheet(body);
            expect(last(api).method).toBe('POST');
            expect(last(api).url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets'
            );
            expect(last(api).body).toBe(body);
        });
    });

    describe('writing values', () => {
        it('always sends valueInputOption — the API 400s without it', async () => {
            const api = makeApi();
            await api.updateValues('sid', 'A1:A2', [['x'], ['y']]);
            expect(last(api).method).toBe('PUT');
            expect(last(api).query.valueInputOption).toBe('RAW');
        });

        it('defaults to RAW so user content is not reinterpreted', async () => {
            const api = makeApi();
            await api.updateValues('sid', 'A1:A1', [['=SUM(A1:A2)']]);
            // USER_ENTERED would turn this into a live formula. A sync writing
            // back what someone typed must not do that silently.
            expect(last(api).query.valueInputOption).toBe('RAW');
            expect(last(api).body.values).toEqual([['=SUM(A1:A2)']]);
        });

        it('honours USER_ENTERED when the caller actually wants parsing', async () => {
            const api = makeApi();
            await api.updateValues('sid', 'A1:A1', [['1/2']], {
                valueInputOption: 'USER_ENTERED',
            });
            expect(last(api).query.valueInputOption).toBe('USER_ENTERED');
        });

        it('repeats the range in the body, which the API requires', async () => {
            const api = makeApi();
            await api.updateValues('sid', "'Issues'!B4:B5", [['a'], ['b']]);
            expect(last(api).body.range).toBe("'Issues'!B4:B5");
        });

        it('append defaults to INSERT_ROWS, because OVERWRITE destroys data', async () => {
            const api = makeApi();
            await api.appendValues('sid', "'Issues'!A:A", [['new']]);
            // Google's own default is OVERWRITE, which writes over whatever
            // follows the table — on a sheet with a second block below the
            // first, that is silent data loss.
            expect(last(api).query.insertDataOption).toBe('INSERT_ROWS');
            expect(last(api).url).toContain("'Issues'!A:A:append");
        });

        it('batchUpdateValues sends one input option for the whole batch', async () => {
            const api = makeApi();
            await api.batchUpdateValues('sid', [
                { range: "'A'!A1", values: [['1']] },
                { range: "'B'!A1", values: [['2']] },
            ]);
            expect(last(api).method).toBe('POST');
            expect(last(api).url).toContain('/values:batchUpdate');
            expect(last(api).body.valueInputOption).toBe('RAW');
            expect(last(api).body.data).toHaveLength(2);
        });

        it('clear posts an empty body to the :clear endpoint', async () => {
            const api = makeApi();
            await api.clearValues('sid', "'Issues'!B4:B41");
            expect(last(api).method).toBe('POST');
            expect(last(api).url).toContain("'Issues'!B4:B41:clear");
            expect(last(api).body).toEqual({});
        });
    });

    describe('reading values and formulas together (one call)', () => {
        it('getSheetsWithGridData asks for includeGridData scoped to title + the two cell fields', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api.sent.push({ method: 'GET', ...options });
                return { sheets: [] };
            };
            await api.getSheetsWithGridData('sid');
            expect(last(api).url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/sid'
            );
            expect(last(api).query.includeGridData).toBe(true);
            expect(last(api).query.fields).toBe(
                'sheets(properties.title,data.rowData.values(userEnteredValue,effectiveValue))'
            );
        });

        it('pairs a formula cell\'s VALUE (effectiveValue) with its exact FORMULA text', async () => {
            const api = makeApi();
            api._get = async () => ({
                sheets: [
                    {
                        properties: { title: 'Budget' },
                        data: [
                            {
                                rowData: [
                                    {
                                        values: [
                                            { effectiveValue: { stringValue: 'Groceries' } },
                                            {
                                                userEnteredValue: { formulaValue: '=D5/12' },
                                                effectiveValue: { numberValue: 10 },
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });
            const [sheet] = await api.getSheetsWithGridData('sid');
            expect(sheet).toEqual({
                title: 'Budget',
                grid: [['Groceries', 10]],
                formulas: [[null, '=D5/12']],
            });
        });

        it('an empty sheet reads as empty grids, not a throw', async () => {
            const api = makeApi();
            api._get = async () => ({
                sheets: [{ properties: { title: 'Blank' }, data: [{}] }],
            });
            const [sheet] = await api.getSheetsWithGridData('sid');
            expect(sheet).toEqual({ title: 'Blank', grid: [], formulas: [] });
        });

        it('an error cell has no scalar to carry — reads as null, not a guess', async () => {
            const api = makeApi();
            api._get = async () => ({
                sheets: [
                    {
                        properties: { title: 'X' },
                        data: [{ rowData: [{ values: [{ effectiveValue: { errorValue: { type: 'DIV_BY_ZERO' } } } ] }] }],
                    },
                ],
            });
            const [sheet] = await api.getSheetsWithGridData('sid');
            expect(sheet.grid).toEqual([[null]]);
        });
    });

    describe('toFormulaGrid — cleaning up FORMULA render mode', () => {
        it('keeps a real formula (a string starting with =)', () => {
            expect(toFormulaGrid([['=SUM(A1:A2)']])).toEqual([['=SUM(A1:A2)']]);
        });

        it('turns a non-formula cell\'s echoed VALUE into null — the impossible-to-tell-apart case', () => {
            // This is exactly what Google actually returns for an ordinary
            // cell in FORMULA render mode: its own value, unmarked. A raw
            // pass-through reads this as "the formula is Groceries", which a
            // downstream cell policy would misread as "this cell holds a
            // formula" for perfectly ordinary data.
            expect(toFormulaGrid([['Groceries', 42, true, null]])).toEqual([
                [null, null, null, null],
            ]);
        });

        it('mixed row: only the real formula survives', () => {
            expect(toFormulaGrid([['Groceries', '=A1*2', 42]])).toEqual([
                [null, '=A1*2', null],
            ]);
        });
    });

    describe('structure', () => {
        it('listSheets asks only for properties, not every cell', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api.sent.push({ method: 'GET', ...options });
                return {
                    sheets: [
                        { properties: { sheetId: 0, title: '🚫 Issues List' } },
                        {
                            properties: {
                                sheetId: 1,
                                title: 'Quarterly Goals',
                            },
                        },
                    ],
                };
            };
            const sheets = await api.listSheets('sid');
            // includeGridData on a large workbook is megabytes per call.
            expect(last(api).query.fields).toBe('sheets.properties');
            expect(last(api).query.includeGridData).toBeUndefined();
            expect(sheets.map((s) => s.title)).toEqual([
                '🚫 Issues List',
                'Quarterly Goals',
            ]);
        });

        it('listSheets returns [] for a spreadsheet with no sheets key', async () => {
            const api = makeApi();
            api._get = async () => ({});
            expect(await api.listSheets('sid')).toEqual([]);
        });

        it('addSheet and deleteSheet go through batchUpdate', async () => {
            const api = makeApi();
            await api.addSheet('sid', { title: 'New' });
            expect(last(api).url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/sid:batchUpdate'
            );
            expect(last(api).body.requests).toEqual([
                { addSheet: { properties: { title: 'New' } } },
            ]);
            await api.deleteSheet('sid', 7);
            expect(last(api).body.requests).toEqual([
                { deleteSheet: { sheetId: 7 } },
            ]);
        });
    });
});

describe('package index.js — public exports', () => {
    it('re-exports every named helper api.js exports, toFormulaGrid included', () => {
        // This module's own index.js hand-lists its re-exports rather than
        // spreading api.js's exports through, so adding a new named export to
        // api.js (as this file just did for toFormulaGrid) is silent unless
        // something asserts the two stay in step — consumers outside this
        // package (frigg/'s family-workbook integration) got
        // "toFormulaGrid is not a function" from exactly this gap.
        const apiExports = require('../api');
        const pkgExports = require('../index');
        for (const name of Object.keys(apiExports)) {
            expect(pkgExports[name]).toBe(apiExports[name]);
        }
    });
});
