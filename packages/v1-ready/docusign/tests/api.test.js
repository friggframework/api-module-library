const { Authenticator } = require('@friggframework/test');
const { Api } = require('../dist/api');
const { Definition } = require('../dist/definition');
const { documentInBase64 } = require('./fixtures/document-in-base64.json')

describe('DocuSign API tests', () => {
    const apiParams = {
        client_id: process.env.DOCUSIGN_CLIENT_ID,
        client_secret: process.env.DOCUSIGN_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        scope: process.env.DOCUSIGN_SCOPE,
        environment: process.env.DOCUSIGN_ENVIRONMENT,
    };

    const api = new Api(apiParams);

    beforeAll(async () => {
        const url = api.getAuthorizationUri();
        const response = await Authenticator.oauth2(url);
        const baseArr = response.base.split('/');
        response.entityType = baseArr[baseArr.length - 1];
        delete response.base;

        console.log('Received callback data:', response.data);
        expect(response.data.code).toBeDefined();

        const tokenData = await api.getTokenFromCode(response.data.code);
        expect(tokenData).toBeDefined();
        expect(tokenData.access_token).toBeDefined();

        // Fetch user info to get accountId and baseUri
        const userInfo = await api.getUserInfo();
        expect(userInfo).toBeDefined();
        const primaryAccount = userInfo.accounts?.find(acc => acc.is_default);
        expect(primaryAccount).toBeDefined();
        expect(primaryAccount.account_id).toBeDefined();
        expect(primaryAccount.base_uri).toBeDefined();

        api.setAccountId(primaryAccount.account_id);
    }, 120000);

    describe('User Info', () => {
        it('should return user details', async () => {
            const response = await api.getUserInfo();
            expect(response).toBeDefined();
            expect(response.sub).toBeDefined();
            expect(response.name).toBeDefined();
            expect(response.email).toBeDefined();
            expect(response.accounts).toBeDefined();
            expect(Array.isArray(response.accounts)).toBe(true);
            expect(response.accounts.length).toBeGreaterThan(0);
        });
    });

    describe('Envelopes', () => {
        let testEnvelopeId = null;

        const sampleEnvelopeDefinition = {
            emailSubject: `Frigg Test Envelope ${Date.now()}`,
            status: 'created',
            documents: [{
                documentId: '1',
                name: 'test-doc.txt',
                fileExtension: 'txt',
                documentBase64: documentInBase64
            }],
            recipients: {
                signers: [{
                    email: 'projectteam@lefthook.com',
                    name: 'Test Recipient',
                    recipientId: '1',
                    routingOrder: '1',
                }]
            }
        };

        it('should create an envelope', async () => {
            const response = await api.createEnvelope(sampleEnvelopeDefinition);
            expect(response).toBeDefined();
            expect(response.envelopeId).toBeDefined();
            expect(response.status).toBeDefined();
            testEnvelopeId = response.envelopeId;
            console.log(`Created test envelope ID: ${testEnvelopeId}`);
        }, 30000);

        it('should get envelope details', async () => {
            expect(testEnvelopeId).toBeDefined();
            const response = await api.getEnvelope(testEnvelopeId);
            expect(response).toBeDefined();
            expect(response.envelopeId).toEqual(testEnvelopeId);
            expect(response.status).toBeDefined();
            expect(response.emailSubject).toEqual(sampleEnvelopeDefinition.emailSubject);
        });

        it('should list envelopes', async () => {
            // Calculate date 30 days ago
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 30);
            const fromDateISO = fromDate.toISOString();

            const response = await api.listEnvelopes({ from_date: fromDateISO });
            expect(response).toBeDefined();
            expect(response.envelopes.length).toBeGreaterThan(0);
        });

        it('should void an envelope', async () => {
            expect(testEnvelopeId).toBeDefined();

            const reason = 'Frigg API Test Void';
            const response = await api.voidEnvelope(testEnvelopeId, reason);
            expect(response).toBeDefined();
            expect(response.envelopeId).toEqual(testEnvelopeId);
        });


        // Cleanup: Attempt to void the envelope if created (best effort)
        // This runs even if void test is skipped. Only runs if create test passed.
        afterAll(async () => {
            if (testEnvelopeId) {
                console.log(`Attempting cleanup: Voiding envelope ${testEnvelopeId}`);
                try {
                    await api.voidEnvelope(testEnvelopeId, 'Frigg API Test Cleanup');
                    console.log(`Voided envelope ${testEnvelopeId}`);
                } catch (error) {
                    console.warn(`Could not void envelope ${testEnvelopeId} during cleanup (may have been only 'created'):`, error.message || error);
                }
            }
        }, 30000);
    });
});
