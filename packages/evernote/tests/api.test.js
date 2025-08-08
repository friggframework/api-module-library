const { Api } = require('../api');

describe('Evernote API', () => {
    let api;
    
    beforeEach(() => {
        api = new Api({
            client_id: 'test_client_id',
            client_secret: 'test_client_secret',
            access_token: 'test_access_token',
            noteStoreUrl: 'https://sandbox.evernote.com/shard/s1/notestore',
            sandbox: true
        });
    });

    describe('Constructor', () => {
        test('should initialize with sandbox environment', () => {
            expect(api.isSandbox).toBe(true);
            expect(api.baseUrl).toBe('https://sandbox.evernote.com');
            expect(api.authorizationUri).toBe('https://sandbox.evernote.com/OAuth.action');
        });

        test('should initialize with production environment', () => {
            const prodApi = new Api({
                client_id: 'test_client_id',
                client_secret: 'test_client_secret',
                sandbox: false
            });
            
            expect(prodApi.isSandbox).toBe(false);
            expect(prodApi.baseUrl).toBe('https://www.evernote.com');
            expect(prodApi.authorizationUri).toBe('https://www.evernote.com/OAuth.action');
        });

        test('should set API URLs correctly', () => {
            expect(api.apiUrl).toBe('https://sandbox.evernote.com/shard/s1/notestore');
            expect(api.userStoreUrl).toBe('https://sandbox.evernote.com/edam/user');
        });
    });

    describe('Authentication', () => {
        test('should generate correct auth URI', () => {
            const authUri = api.getAuthUri('test_request_token');
            
            expect(authUri).toContain('https://sandbox.evernote.com/OAuth.action');
            expect(authUri).toContain('oauth_token=test_request_token');
        });

        test('should add correct auth headers', () => {
            const options = { headers: {} };
            api.addAuthHeaders(options);
            
            expect(options.headers.Authorization).toBe('Bearer test_access_token');
            expect(options.headers['Content-Type']).toBe('application/json');
        });
    });

    describe('URL Construction', () => {
        test('should construct user store URLs correctly', () => {
            expect(api.URLs.getUser).toBe('/edam/user/getUser');
            expect(api.URLs.getNoteStoreUrl).toBe('/edam/user/getNoteStoreUrl');
            expect(api.URLs.getPremiumInfo).toBe('/edam/user/getPremiumInfo');
        });

        test('should construct note store URLs correctly', () => {
            expect(api.URLs.listNotebooks).toBe('/listNotebooks');
            expect(api.URLs.createNote).toBe('/createNote');
            expect(api.URLs.findNotes).toBe('/findNotes');
            expect(api.URLs.listTags).toBe('/listTags');
        });
    });

    describe('ENML Helpers', () => {
        test('should wrap text in ENML correctly', () => {
            const text = 'Hello World';
            const enml = api.textToENML(text);
            
            expect(enml).toContain('<en-note>');
            expect(enml).toContain('</en-note>');
            expect(enml).toContain('Hello World');
        });

        test('should escape HTML entities in text', () => {
            const text = 'Hello <script>alert("test")</script> & World';
            const enml = api.textToENML(text);
            
            expect(enml).toContain('&lt;script&gt;');
            expect(enml).toContain('&amp;');
            expect(enml).not.toContain('<script>');
        });

        test('should convert newlines to br tags', () => {
            const text = 'Line 1\nLine 2\nLine 3';
            const enml = api.textToENML(text);
            
            expect(enml).toContain('Line 1<br/>Line 2<br/>Line 3');
        });

        test('should convert HTML to ENML', () => {
            const html = '<p>Hello <b>World</b></p>';
            const enml = api.htmlToENML(html);
            
            expect(enml).toContain('<en-note>');
            expect(enml).toContain('<p>Hello <b>World</b></p>');
            expect(enml).toContain('</en-note>');
        });

        test('should remove style attributes from HTML', () => {
            const html = '<p style="color: red;">Hello World</p>';
            const enml = api.htmlToENML(html);
            
            expect(enml).not.toContain('style=');
            expect(enml).toContain('<p>Hello World</p>');
        });

        test('should extract text from ENML', () => {
            const enml = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>Hello <b>World</b> &amp; <i>Universe</i></en-note>';
            const text = api.enmlToText(enml);
            
            expect(text).toBe('Hello World & Universe');
        });
    });

    describe('ENML Constants', () => {
        test('should have correct ENML header and footer', () => {
            expect(api.enmlHeader).toContain('<?xml version="1.0"');
            expect(api.enmlHeader).toContain('<!DOCTYPE en-note');
            expect(api.enmlHeader).toContain('<en-note>');
            expect(api.enmlFooter).toBe('</en-note>');
        });
    });

    describe('Environment Detection', () => {
        test('should default to production when sandbox not specified', () => {
            const defaultApi = new Api({
                client_id: 'test',
                client_secret: 'test'
            });
            
            expect(defaultApi.isSandbox).toBe(false);
            expect(defaultApi.baseUrl).toBe('https://www.evernote.com');
        });
    });
});