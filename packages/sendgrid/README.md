# SendGrid API Module

A comprehensive SendGrid API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
SENDGRID_API_KEY=your_sendgrid_api_key
```

### Getting SendGrid API Key

1. Sign up for a SendGrid account at [https://sendgrid.com/](https://sendgrid.com/)
2. Navigate to Settings > API Keys in your SendGrid dashboard
3. Click "Create API Key"
4. Choose the appropriate permissions (Full Access for all features, or Restricted Access for specific features)
5. Copy the generated API key

### Authentication

This module uses API Key authentication via the `Authorization: Bearer {api_key}` header.

## Usage

```javascript
const { Api } = require('@friggframework/api-module-sendgrid');

// Initialize with API key
const sendGridApi = new Api({
    api_key: process.env.SENDGRID_API_KEY
});

// Send a simple email
const result = await sendGridApi.sendSimpleEmail(
    'recipient@example.com',
    'sender@example.com',
    'Hello from SendGrid!',
    'This is a test email sent via SendGrid API.',
    'text/plain'
);

// Send email with template
const templateResult = await sendGridApi.sendEmailWithTemplate(
    'recipient@example.com',
    'sender@example.com',
    'template-id-here',
    {
        first_name: 'John',
        last_name: 'Doe'
    }
);
```

## Available Methods

### Mail Send Methods
- `sendMail(mailData)` - Send email with full SendGrid mail object
- `sendSimpleEmail(to, from, subject, content, contentType)` - Send simple text/HTML email
- `sendEmailWithTemplate(to, from, templateId, dynamicTemplateData)` - Send email using template

### User Profile Methods
- `getCurrentUser()` - Get current user profile
- `updateUserProfile(profileData)` - Update user profile
- `getUserAccount()` - Get account information

### Templates Methods
- `getTemplates(params)` - List email templates
- `getTemplate(templateId)` - Get specific template
- `createTemplate(templateData)` - Create new template
- `updateTemplate(templateId, templateData)` - Update template
- `deleteTemplate(templateId)` - Delete template
- `getTemplateVersions(templateId)` - Get template versions
- `createTemplateVersion(templateId, versionData)` - Create template version

### Contacts Methods
- `getContacts(params)` - List contacts with pagination
- `addContacts(contacts)` - Add or update contacts
- `searchContacts(query)` - Search contacts
- `getContactById(contactId)` - Get specific contact
- `deleteContacts(contactIds)` - Delete contacts

### Lists Methods
- `getLists()` - Get marketing lists
- `createList(name, contactCount)` - Create new list
- `getList(listId)` - Get specific list
- `updateList(listId, name)` - Update list
- `deleteList(listId)` - Delete list
- `addContactsToList(listId, contactIds)` - Add contacts to list
- `removeContactsFromList(listId, contactIds)` - Remove contacts from list

### Campaigns Methods
- `getCampaigns(params)` - List campaigns
- `createCampaign(campaignData)` - Create new campaign
- `getCampaign(campaignId)` - Get specific campaign
- `updateCampaign(campaignId, campaignData)` - Update campaign
- `deleteCampaign(campaignId)` - Delete campaign
- `scheduleCampaign(campaignId, sendAt)` - Schedule campaign

### Suppressions Methods
- `getGlobalSuppressions()` - Get globally suppressed emails
- `addGlobalSuppression(email)` - Add email to global suppressions
- `removeGlobalSuppression(email)` - Remove email from global suppressions
- `getBounces(params)` - Get bounced emails
- `deleteBounces(emails)` - Delete bounce records

### Stats Methods
- `getGlobalStats(params)` - Get global email statistics
- `getCategoryStats(params)` - Get category-specific statistics

### Sender Identity Methods
- `getSenderIdentities()` - Get verified sender identities
- `createSenderIdentity(senderData)` - Create new sender identity
- `getSenderIdentity(senderId)` - Get specific sender identity
- `updateSenderIdentity(senderId, senderData)` - Update sender identity
- `deleteSenderIdentity(senderId)` - Delete sender identity

## Email Sending Examples

### Simple Text Email
```javascript
await sendGridApi.sendSimpleEmail(
    'user@example.com',
    'noreply@yoursite.com',
    'Welcome!',
    'Welcome to our service!',
    'text/plain'
);
```

### HTML Email
```javascript
await sendGridApi.sendSimpleEmail(
    'user@example.com',
    'noreply@yoursite.com',
    'Welcome!',
    '<h1>Welcome!</h1><p>Welcome to our service!</p>',
    'text/html'
);
```

### Template Email with Personalization
```javascript
await sendGridApi.sendEmailWithTemplate(
    'user@example.com',
    'noreply@yoursite.com',
    'welcome-template-id',
    {
        username: 'john_doe',
        verification_url: 'https://yoursite.com/verify/token'
    }
);
```

### Advanced Email with Attachments
```javascript
const mailData = {
    personalizations: [
        {
            to: [{ email: 'user@example.com', name: 'John Doe' }],
            subject: 'Document Attached'
        }
    ],
    from: { email: 'noreply@yoursite.com', name: 'Your Service' },
    content: [
        {
            type: 'text/html',
            value: '<p>Please find the attached document.</p>'
        }
    ],
    attachments: [
        {
            content: 'base64-encoded-content',
            filename: 'document.pdf',
            type: 'application/pdf'
        }
    ]
};

await sendGridApi.sendMail(mailData);
```

## Error Handling

SendGrid returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const result = await sendGridApi.sendSimpleEmail(to, from, subject, content);
    console.log('Email sent successfully');
} catch (error) {
    console.error('SendGrid error:', error.message);
}
```

## Rate Limiting

SendGrid enforces rate limits based on your plan. The module does not implement automatic retry logic - you should handle rate limiting in your application.

## Webhooks

SendGrid can send webhooks for email events (delivered, opened, clicked, etc.). Configure webhook endpoints in your SendGrid dashboard.

## Documentation

For detailed SendGrid API documentation, visit: https://docs.sendgrid.com/api-reference