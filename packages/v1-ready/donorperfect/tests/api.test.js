const {
    Api,
    AUDIT_USER_ID,
    DEFAULT_BASE_URL,
    ENDPOINT_PATH,
    parseResultXml,
    serializeParams,
    DONOR_SAVE_PARAMS,
} = require('../api');

/** Minimal offline fixtures — not from any client repo. */
const FIXTURES = {
    authOk: `<result>
  <record><field name='donor_id' value='1'/></record>
</result>`,
    authFail: `<result>
  <field name='success' value='false' reason='Invalid token'/>
</result>`,
    donorRow: `<result>
  <record>
    <field name='donor_id' value='42'/>
    <field name='first_name' value='Ada'/>
    <field name='last_name' value='Lovelace'/>
    <field name='email' value='ada@example.com'/>
    <field name='org_rec' value='N'/>
    <field name='donor_type' value='IN'/>
    <field name='nomail' value='N'/>
    <field name='middle_name' value=''/>
    <field name='suffix' value=''/>
    <field name='title' value=''/>
    <field name='salutation' value=''/>
    <field name='prof_title' value=''/>
    <field name='opt_line' value=''/>
    <field name='address' value='1 Analytical Engine Rd'/>
    <field name='address2' value=''/>
    <field name='city' value='London'/>
    <field name='state' value=''/>
    <field name='zip' value=''/>
    <field name='country' value='UK'/>
    <field name='address_type' value=''/>
    <field name='home_phone' value='(555) 010-0001'/>
    <field name='business_phone' value=''/>
    <field name='fax_phone' value=''/>
    <field name='mobile_phone' value='555-010-0002'/>
    <field name='nomail_reason' value=''/>
    <field name='narrative' value=''/>
    <field name='donor_rcpt_type' value=''/>
  </record>
</result>`,
    saveDonorCreate: `<result>
  <field name='' value='99'/>
</result>`,
    saveGiftCreate: `<result>
  <record><field name='' value='1001'/></record>
</result>`,
    giftsList: `<result>
  <record>
    <field name='gift_id' value='7'/>
    <field name='donor_id' value='42'/>
    <field name='amount' value='25.00'/>
    <field name='gift_date' value='01/15/2026'/>
    <field name='gift_type' value='CASH'/>
    <field name='reference' value='ORD-1'/>
    <field name='record_type' value='G'/>
  </record>
</result>`,
    giftsByRef: `<result>
  <record>
    <field name='gift_id' value='7'/>
    <field name='donor_id' value='42'/>
    <field name='amount' value='25'/>
  </record>
</result>`,
    codesPage: `<result>
  <record>
    <field name='code' value='CASH'/>
    <field name='description' value='Cash'/>
  </record>
</result>`,
    donorLookup: `<result>
  <record>
    <field name='donor_id' value='42'/>
    <field name='first_name' value='Ada'/>
    <field name='last_name' value='Lovelace'/>
  </record>
</result>`,
};

function makeApi(xmlResponses) {
    const queue = Array.isArray(xmlResponses) ? [...xmlResponses] : [xmlResponses];
    const api = new Api({ api_key: 'test%2fkey' });
    api._captured = [];
    api._sleep = async () => {};
    api.fetch = async (url, options) => {
        api._captured.push({ url, ...options });
        const body = queue.shift();
        if (body === undefined) {
            throw new Error('unexpected extra fetch');
        }
        return {
            status: 200,
            text: async () => body,
        };
    };
    return api;
}

describe('parseResultXml', () => {
    it('parses named record fields and success=false', () => {
        const ok = parseResultXml(FIXTURES.donorRow);
        expect(ok.success).toBe(true);
        expect(ok.records[0].email).toBe('ada@example.com');

        const fail = parseResultXml(FIXTURES.authFail);
        expect(fail.success).toBe(false);
        expect(fail.reason).toBe('Invalid token');
    });

    it('captures unnamed save-id values in recordValues', () => {
        const parsed = parseResultXml(FIXTURES.saveDonorCreate);
        expect(parsed.recordValues[0][0]).toBe('99');
    });

    it('decodes XML entities', () => {
        const parsed = parseResultXml(
            `<result><record><field name='last_name' value='O&apos;Brien&amp;Co'/></record></result>`
        );
        expect(parsed.records[0].last_name).toBe("O'Brien&Co");
    });
});

describe('serializeParams', () => {
    it('emits @name=value pairs and a Frigg audit user_id', () => {
        const s = serializeParams({ donor_id: 0, last_name: "O'Brien", amount: 10 });
        expect(s).toContain("@donor_id=0");
        expect(s).toContain("@last_name='O''Brien'");
        expect(s).toContain('@amount=10');
        expect(s).toContain(`@user_id='${AUDIT_USER_ID}'`);
        expect(AUDIT_USER_ID.length).toBeLessThanOrEqual(20);
        expect(AUDIT_USER_ID).not.toMatch(/AES|lefthook|aes/i);
    });
});

describe('DonorPerfect Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the production host', () => {
            const api = new Api({ api_key: 'k' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.api_key).toBe('k');
        });

        it('honors DONORPERFECT_BASE_URL / params.baseUrl', () => {
            const prev = process.env.DONORPERFECT_BASE_URL;
            process.env.DONORPERFECT_BASE_URL = 'https://example.test/dp';
            try {
                expect(new Api({ api_key: 'k' }).baseUrl).toBe(
                    'https://example.test/dp'
                );
            } finally {
                if (prev === undefined) delete process.env.DONORPERFECT_BASE_URL;
                else process.env.DONORPERFECT_BASE_URL = prev;
            }
            expect(
                new Api({ api_key: 'k', baseUrl: 'https://custom/dp' }).baseUrl
            ).toBe('https://custom/dp');
        });

        it('does not put the key in headers', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers).toEqual({});
            expect(Object.values(headers).join('')).not.toContain('secret');
        });

        it('exposes an apiKey authorization form', () => {
            const reqs = new Api({}).getAuthorizationRequirements();
            expect(reqs.type).toBeDefined();
            expect(reqs.data.jsonSchema.required).toContain('api_key');
            expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
        });

        it('sends the raw key in the form body without re-encoding', async () => {
            const api = makeApi(FIXTURES.authOk);
            await api.testAuthRequest();
            const { url, body, method, headers } = api._captured[0];
            expect(method).toBe('POST');
            expect(url).toBe(`${DEFAULT_BASE_URL}${ENDPOINT_PATH}`);
            expect(headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(body).toContain('apikey=test%2fkey');
            expect(body).not.toContain('apikey=test%252fkey');
            expect(body).toContain(
                'action=' + encodeURIComponent('select top 1 donor_id from dp')
            );
        });
    });

    describe('testAuthRequest', () => {
        it('parses a successful probe', async () => {
            const api = makeApi(FIXTURES.authOk);
            const result = await api.testAuthRequest();
            expect(result.success).toBe(true);
            expect(result.records[0].donor_id).toBe('1');
        });

        it('surfaces success=false without throwing at the Api layer', async () => {
            const api = makeApi(FIXTURES.authFail);
            const result = await api.testAuthRequest();
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Invalid token');
        });
    });

    describe('donors', () => {
        it('listDonors issues a SELECT and maps rows', async () => {
            const api = makeApi(FIXTURES.donorLookup);
            const result = await api.listDonors({ top: 10 });
            expect(result.success).toBe(true);
            expect(result.donors[0].donor_id).toBe(42);
            expect(api._captured[0].body).toContain(
                encodeURIComponent('select top 10')
            );
        });

        it('getDonorById returns a normalized donor', async () => {
            const api = makeApi(FIXTURES.donorRow);
            const result = await api.getDonorById(42);
            expect(result.success).toBe(true);
            expect(result.donor.donor_id).toBe('42');
            expect(result.donor.email).toBe('ada@example.com');
            expect(result.donor.middle_name).toBeNull();
            for (const name of DONOR_SAVE_PARAMS) {
                expect(result.donor).toHaveProperty(name);
            }
        });

        it('getDonorById rejects non-positive ids without fetching', async () => {
            const api = makeApi([]);
            const result = await api.getDonorById(0);
            expect(result.success).toBe(false);
            expect(api._captured).toHaveLength(0);
        });

        it('saveDonor creates with donorId 0 and returns the new id', async () => {
            const api = makeApi(FIXTURES.saveDonorCreate);
            const result = await api.saveDonor({
                donorId: 0,
                values: { first_name: 'Ada', last_name: 'Lovelace' },
            });
            expect(result).toEqual({ success: true, donorId: 99 });
            expect(api._captured[0].body).toContain(
                'action=' + encodeURIComponent('dp_savedonor')
            );
            expect(api._captured[0].body).toContain('params=');
        });

        it('saveDonor updates by re-reading then merging', async () => {
            const api = makeApi([FIXTURES.donorRow, FIXTURES.saveDonorCreate]);
            const result = await api.saveDonor({
                donorId: 42,
                values: { email: 'new@example.com' },
            });
            expect(result.success).toBe(true);
            expect(api._captured).toHaveLength(2);
            const saveBody = decodeURIComponent(
                api._captured[1].body.split('params=')[1].split('&')[0]
            );
            expect(saveBody).toContain("@donor_id=42");
            expect(saveBody).toContain("@email='new@example.com'");
            expect(saveBody).toContain("@first_name='Ada'");
        });

        it('findDonorByEmail escapes quotes', async () => {
            const api = makeApi(FIXTURES.donorLookup);
            await api.findDonorByEmail("o'reilly@example.com");
            const action = decodeURIComponent(
                api._captured[0].body.match(/action=([^&]+)/)[1]
            );
            expect(action).toContain("email='o''reilly@example.com'");
        });

        it('findDonorByPhone matches last 10 digits', async () => {
            const api = makeApi(FIXTURES.donorLookup);
            const result = await api.findDonorByPhone('(555) 010-0001', null);
            expect(result.donors[0].donor_id).toBe(42);
            const action = decodeURIComponent(
                api._captured[0].body.match(/action=([^&]+)/)[1]
            );
            expect(action).toContain("='5550100001'");
        });

        it('findDonorByPhone returns empty without fetching when no digits', async () => {
            const api = makeApi([]);
            const result = await api.findDonorByPhone('abc', null);
            expect(result).toEqual({ success: true, donors: [] });
            expect(api._captured).toHaveLength(0);
        });
    });

    describe('gifts', () => {
        it('saveGift creates and returns giftId', async () => {
            const api = makeApi(FIXTURES.saveGiftCreate);
            const result = await api.saveGift({
                values: {
                    donor_id: 42,
                    gift_date: '01/15/2026',
                    amount: 25,
                    gift_type: 'CASH',
                },
            });
            expect(result).toEqual({ success: true, giftId: 1001 });
            expect(api._captured[0].body).toContain(
                'action=' + encodeURIComponent('dp_savegift')
            );
        });

        it('saveGift rejects invalid dates without fetching', async () => {
            const api = makeApi([]);
            const result = await api.saveGift({
                values: { donor_id: 42, gift_date: '2026-01-15', amount: 1 },
            });
            expect(result.success).toBe(false);
            expect(result.reason).toBe('invalid gift date');
            expect(api._captured).toHaveLength(0);
        });

        it('listGiftsByDonorId uses dp_gifts', async () => {
            const api = makeApi(FIXTURES.giftsList);
            const result = await api.listGiftsByDonorId(42);
            expect(result.success).toBe(true);
            expect(result.gifts[0].gift_id).toBe(7);
            expect(api._captured[0].body).toContain(
                'action=' + encodeURIComponent('dp_gifts')
            );
            expect(api._captured[0].body).toContain('params=' + encodeURIComponent('42'));
        });

        it('findGiftsByReference skips blank references', async () => {
            const api = makeApi([]);
            expect(await api.findGiftsByReference('  ')).toEqual({
                success: true,
                gifts: [],
            });
            expect(api._captured).toHaveLength(0);
        });

        it('findGiftsByReference maps rows', async () => {
            const api = makeApi(FIXTURES.giftsByRef);
            const result = await api.findGiftsByReference('ORD-1');
            expect(result.gifts[0]).toEqual({
                gift_id: 7,
                donor_id: 42,
                amount: 25,
            });
        });
    });

    describe('getCodes', () => {
        it('lists codes for a field_name', async () => {
            const api = makeApi(FIXTURES.codesPage);
            const result = await api.getCodes('GIFT_TYPE');
            expect(result.success).toBe(true);
            expect(result.codes).toEqual([{ code: 'CASH', description: 'Cash' }]);
            const action = decodeURIComponent(
                api._captured[0].body.match(/action=([^&]+)/)[1]
            );
            expect(action).toContain("field_name='GIFT_TYPE'");
        });
    });

    describe('error handling', () => {
        it('throws on empty body', async () => {
            const api = makeApi('   ');
            await expect(api.testAuthRequest()).rejects.toThrow(/empty response/i);
        });

        it('throws on malformed XML', async () => {
            const api = makeApi('<html>nope</html>');
            await expect(api.testAuthRequest()).rejects.toThrow(/malformed/i);
        });

        it('throws a generic message on HTTP 400 without echoing the body', async () => {
            const api = new Api({ api_key: 'secret-key' });
            api._sleep = async () => {};
            api.fetch = async () => ({
                status: 400,
                text: async () => 'apikey=secret-key leaked',
            });
            await expect(api.testAuthRequest()).rejects.toThrow(
                /HTTP 400/
            );
            try {
                await api.testAuthRequest();
            } catch (e) {
                expect(e.message).not.toContain('secret-key');
            }
        });
    });
});
