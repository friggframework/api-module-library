const { Api, buildRange, quoteSheetName } = require('../api');

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

        it('URL-encodes the range into the path so quotes and emoji survive', async () => {
            const api = makeApi();
            await api.getValues('sid', buildRange('🚫 Issues List', 'B4:B41'));
            expect(last(api).url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/sid/values/' +
                    encodeURIComponent("'🚫 Issues List'!B4:B41")
            );
        });

        it('encodes a spreadsheet id containing URL-significant characters', async () => {
            const api = makeApi();
            await api.getValues('a/b?c', 'A1:A1');
            expect(last(api).url).toContain(
                '/v4/spreadsheets/a%2Fb%3Fc/values/'
            );
        });

        it('omits optional query params rather than sending undefined', async () => {
            const api = makeApi();
            await api.getValues('sid', 'A1:A1');
            expect(Object.keys(last(api).query)).toEqual(['valueRenderOption']);
        });

        it('batchGet passes every range and one render option', async () => {
            const api = makeApi();
            await api.batchGetValues('sid', ["'A'!A1:A2", "'B'!A1:A2"]);
            expect(last(api).url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/sid/values:batchGet'
            );
            expect(last(api).query.ranges).toEqual(["'A'!A1:A2", "'B'!A1:A2"]);
            expect(last(api).query.valueRenderOption).toBe('UNFORMATTED_VALUE');
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
            expect(last(api).url).toContain(
                `${encodeURIComponent("'Issues'!A:A")}:append`
            );
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
            expect(last(api).url).toContain(
                `${encodeURIComponent("'Issues'!B4:B41")}:clear`
            );
            expect(last(api).body).toEqual({});
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
