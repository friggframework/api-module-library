const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'gs-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/google-sheets',
        access_token: 'tok',
        refresh_token: 'ref',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { spreadsheetId: 'ss1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    return api;
}

describe('Google Sheets Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to sheets.googleapis.com/v4', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://sheets.googleapis.com/v4');
            expect(api.userInfoUrl).toBe(
                'https://www.googleapis.com/oauth2/v2/userinfo'
            );
            expect(api.tokenUri).toBe('https://oauth2.googleapis.com/token');
        });

        it('builds a Google authorize URL with offline consent', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/google-sheets',
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://accounts.google.com/o/oauth2/v2/auth?'
            );
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('access_type=offline');
            expect(uri).toContain('prompt=consent');
            expect(uri).toContain('state=xyz');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fgoogle-sheets'
            );
        });

        it('adds Bearer Authorization header', async () => {
            const api = new Api({
                access_token: 'tok-1',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-1');
        });
    });

    describe('identity', () => {
        it('getUserDetails hits OAuth2 userinfo', async () => {
            const api = makeApi();
            await api.getUserDetails();
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/oauth2/v2/userinfo'
            );
        });
    });

    describe('spreadsheets', () => {
        it('createSpreadsheet POSTs to /spreadsheets', async () => {
            const api = makeApi();
            const body = { properties: { title: 'Pipeline' } };
            await api.createSpreadsheet(body);
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('getSpreadsheet hits GET /spreadsheets/{id}', async () => {
            const api = makeApi();
            await api.getSpreadsheet('ss1', { includeGridData: false });
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1?includeGridData=false'
            );
        });

        it('batchUpdateSpreadsheet POSTs :batchUpdate', async () => {
            const api = makeApi();
            const body = { requests: [{ addSheet: { properties: { title: 'T' } } }] };
            await api.batchUpdateSpreadsheet('ss1', body);
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1:batchUpdate'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('values', () => {
        it('getValues encodes the A1 range in the path', async () => {
            const api = makeApi();
            await api.getValues('ss1', 'Sheet1!A1:B2', {
                majorDimension: 'ROWS',
            });
            // encodeURIComponent leaves `!` unescaped; `:` becomes %3A.
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/values/Sheet1!A1%3AB2?majorDimension=ROWS'
            );
        });

        it('updateValues PUTs with valueInputOption query', async () => {
            const api = makeApi();
            const data = { values: [['a', 'b']] };
            await api.updateValues('ss1', 'A1:B1', data, {
                valueInputOption: 'USER_ENTERED',
            });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/values/A1%3AB1?valueInputOption=USER_ENTERED'
            );
            expect(api._captured[0].body).toEqual(data);
        });

        it('appendValues POSTs :append', async () => {
            const api = makeApi();
            await api.appendValues(
                'ss1',
                'Sheet1!A1',
                { values: [[1, 2]] },
                { valueInputOption: 'RAW' }
            );
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/values/Sheet1!A1:append?valueInputOption=RAW'
            );
        });

        it('clearValues POSTs :clear', async () => {
            const api = makeApi();
            await api.clearValues('ss1', 'A1:Z');
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/values/A1%3AZ:clear'
            );
        });

        it('batchGetValues repeats ranges query keys', async () => {
            const api = makeApi();
            await api.batchGetValues('ss1', {
                ranges: ['Sheet1!A1:B2', 'Sheet1!C1:D2'],
            });
            const { url } = api._captured[0];
            expect(url).toContain(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/values:batchGet?'
            );
            // URLSearchParams percent-encodes `!` as %21 in query values.
            expect(url).toContain('ranges=Sheet1%21A1%3AB2');
            expect(url).toContain('ranges=Sheet1%21C1%3AD2');
        });

        it('batchUpdateValues POSTs values:batchUpdate', async () => {
            const api = makeApi();
            const body = {
                valueInputOption: 'USER_ENTERED',
                data: [{ range: 'A1', values: [['x']] }],
            };
            await api.batchUpdateValues('ss1', body);
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/values:batchUpdate'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('sheets', () => {
        it('copySheetTo POSTs sheets/{id}:copyTo', async () => {
            const api = makeApi();
            await api.copySheetTo('ss1', 0, {
                destinationSpreadsheetId: 'ss2',
            });
            expect(api._captured[0].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/ss1/sheets/0:copyTo'
            );
            expect(api._captured[0].body).toEqual({
                destinationSpreadsheetId: 'ss2',
            });
        });
    });
});
