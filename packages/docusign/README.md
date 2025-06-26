# DocuSign API Module

A comprehensive DocuSign eSignature REST API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
DOCUSIGN_CLIENT_ID=your_docusign_integration_key
DOCUSIGN_CLIENT_SECRET=your_docusign_secret_key
DOCUSIGN_SCOPE=signature impersonation
DOCUSIGN_SANDBOX=true
REDIRECT_URI=your_redirect_uri_base
```

### Getting DocuSign API Credentials

1. Go to [DocuSign Developer Center](https://developers.docusign.com/)
2. Sign in or create a developer account
3. Create a new app in your developer account
4. Get your Integration Key (Client ID) and Secret Key (Client Secret)
5. Set up your redirect URI (e.g., `https://yourdomain.com/docusign`)

### Sandbox vs Production

- Set `DOCUSIGN_SANDBOX=true` for testing with DocuSign's sandbox environment
- Set `DOCUSIGN_SANDBOX=false` for production usage

### OAuth2 Scopes

Required scopes for DocuSign API:
- `signature` - Create and send envelopes for signature
- `impersonation` - Act on behalf of the user

## Usage

```javascript
const { Api } = require('@friggframework/api-module-docusign');

// Initialize with credentials
const docusignApi = new Api({
    client_id: process.env.DOCUSIGN_CLIENT_ID,
    client_secret: process.env.DOCUSIGN_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/docusign',
    scope: 'signature impersonation',
    sandbox: process.env.DOCUSIGN_SANDBOX === 'true'
});

// Get authorization URL
const authUrl = docusignApi.getAuthUri();

// Exchange code for tokens
const tokens = await docusignApi.getTokenFromCode(authorizationCode);

// Get user info and set account
const userInfo = await docusignApi.getUserInfo();

// Create and send an envelope
const envelope = await docusignApi.createSimpleEnvelope(
    'Please sign this document',
    [{ email: 'signer@example.com', name: 'John Doe' }],
    [{ name: 'Contract.pdf', base64Content: 'base64-encoded-pdf', extension: 'pdf' }]
);

await docusignApi.sendEnvelope(envelope.envelopeId);
```

## Available Methods

### Authentication & User Info
- `getUserInfo()` - Get user profile and account information
- `setAccountId(accountId)` - Set specific account to use

### Envelopes Methods
- `getEnvelopes(params)` - List envelopes with filters
- `createEnvelope(envelopeData)` - Create new envelope
- `getEnvelope(envelopeId)` - Get specific envelope
- `updateEnvelope(envelopeId, envelopeData)` - Update envelope
- `deleteEnvelope(envelopeId)` - Delete envelope
- `sendEnvelope(envelopeId)` - Send envelope for signature
- `voidEnvelope(envelopeId, voidedReason)` - Void an envelope
- `createSimpleEnvelope(subject, recipients, documents)` - Helper for simple envelopes

### Envelope Documents Methods
- `getEnvelopeDocuments(envelopeId)` - List envelope documents
- `getEnvelopeDocument(envelopeId, documentId)` - Get specific document

### Envelope Recipients Methods
- `getEnvelopeRecipients(envelopeId)` - Get envelope recipients
- `updateEnvelopeRecipients(envelopeId, recipientsData)` - Update recipients
- `createRecipientView(envelopeId, recipientViewData)` - Create signing URL
- `getSigningUrl(envelopeId, email, name, returnUrl)` - Helper for signing URLs

### Templates Methods
- `getTemplates(params)` - List templates
- `getTemplate(templateId)` - Get specific template
- `createTemplate(templateData)` - Create new template
- `updateTemplate(templateId, templateData)` - Update template
- `createEnvelopeFromTemplate(templateId, envelopeData)` - Create envelope from template

### Users Methods
- `getUsers(params)` - List account users
- `getUser(userId)` - Get specific user
- `createUser(userData)` - Create new user
- `updateUser(userId, userData)` - Update user

### Connect (Webhooks) Methods
- `getConnectConfigurations()` - List webhook configurations
- `createConnectConfiguration(connectData)` - Create webhook
- `getConnectConfiguration(connectId)` - Get webhook details
- `updateConnectConfiguration(connectId, connectData)` - Update webhook
- `deleteConnectConfiguration(connectId)` - Delete webhook

## Usage Examples

### Creating and Sending an Envelope
```javascript
// Create envelope with document and signer
const envelopeData = {
    emailSubject: 'Please sign this contract',
    status: 'created',
    recipients: {
        signers: [
            {
                email: 'signer@example.com',
                name: 'John Doe',
                recipientId: '1',
                routingOrder: '1',
                tabs: {
                    signHereTabs: [
                        {
                            documentId: '1',
                            pageNumber: '1',
                            xPosition: '100',
                            yPosition: '100'
                        }
                    ]
                }
            }
        ]
    },
    documents: [
        {
            documentId: '1',
            name: 'Contract.pdf',
            documentBase64: 'base64-encoded-pdf-content',
            fileExtension: 'pdf'
        }
    ]
};

const envelope = await docusignApi.createEnvelope(envelopeData);

// Send the envelope
await docusignApi.sendEnvelope(envelope.envelopeId);
```

### Creating a Signing URL
```javascript
const signingUrl = await docusignApi.getSigningUrl(
    envelopeId,
    'signer@example.com',
    'John Doe',
    'https://yoursite.com/signing-complete'
);

console.log('Signing URL:', signingUrl.url);
```

### Working with Templates
```javascript
// Get templates
const templates = await docusignApi.getTemplates();

// Create envelope from template
const templateEnvelope = await docusignApi.createEnvelopeFromTemplate(
    'template-id',
    {
        emailSubject: 'Contract from template',
        status: 'sent',
        templateRoles: [
            {
                email: 'signer@example.com',
                name: 'John Doe',
                roleName: 'Signer'
            }
        ]
    }
);
```

### Setting up Webhooks
```javascript
const webhookData = {
    name: 'Envelope Status Updates',
    urlToPublishTo: 'https://yoursite.com/webhooks/docusign',
    enableConnect: 'true',
    includeDocuments: 'true',
    envelopeEvents: ['sent', 'delivered', 'completed', 'declined', 'voided'],
    recipientEvents: ['sent', 'delivered', 'completed', 'declined', 'authenticationfailed', 'autoresponded']
};

const webhook = await docusignApi.createConnectConfiguration(webhookData);
```

### Monitoring Envelope Status
```javascript
const envelopes = await docusignApi.getEnvelopes({
    from_date: '2023-01-01',
    status: 'completed'
});

envelopes.envelopes.forEach(envelope => {
    console.log(`Envelope ${envelope.envelopeId}: ${envelope.status}`);
});
```

### Voiding an Envelope
```javascript
await docusignApi.voidEnvelope(
    envelopeId,
    'Contract terms have changed'
);
```

## Authentication Flow

DocuSign uses OAuth2 Authorization Code Grant:

1. Redirect users to DocuSign's authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access and refresh tokens
4. Get user info to determine account ID and base URI
5. Use tokens and account info for API requests

## Error Handling

DocuSign returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const envelope = await docusignApi.createEnvelope(envelopeData);
    console.log('Envelope created:', envelope.envelopeId);
} catch (error) {
    console.error('DocuSign error:', error.message);
    if (error.errorCode) {
        console.error('Error code:', error.errorCode);
    }
}
```

## Testing

Use DocuSign's sandbox environment for testing:
- All signatures and documents are simulated
- Use demo.docusign.net for sandbox
- Test with different envelope statuses and scenarios

## Webhooks

DocuSign can send webhooks for various envelope and recipient events:
- `sent` - Envelope sent for signature
- `delivered` - Envelope delivered to recipient
- `completed` - All required signatures obtained
- `declined` - Recipient declined to sign
- `voided` - Envelope voided by sender

## Document Formats

DocuSign supports various document formats:
- PDF (recommended)
- Microsoft Word (.doc, .docx)
- Microsoft Excel (.xls, .xlsx)
- Microsoft PowerPoint (.ppt, .pptx)
- Text files (.txt)
- Images (.jpg, .png, .gif)

## Documentation

For detailed DocuSign API documentation, visit: https://developers.docusign.com/docs/