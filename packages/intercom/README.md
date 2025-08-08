# Intercom API Module

A comprehensive Intercom API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
INTERCOM_CLIENT_ID=your_intercom_client_id
INTERCOM_CLIENT_SECRET=your_intercom_client_secret
INTERCOM_SCOPE=read_contacts write_contacts read_conversations write_conversations
REDIRECT_URI=your_redirect_uri_base
```

### Getting Intercom API Credentials

1. Go to the [Intercom Developer Hub](https://developers.intercom.com/)
2. Sign in with your Intercom account
3. Create a new app in your workspace
4. Get your Client ID and Client Secret from the app settings
5. Set up your redirect URI (e.g., `https://yourdomain.com/intercom`)

### OAuth2 Scopes

Available scopes for Intercom API:
- `read_contacts` - Read contact information
- `write_contacts` - Create and update contacts
- `read_conversations` - Read conversations
- `write_conversations` - Create and reply to conversations
- `read_companies` - Read company information
- `write_companies` - Create and update companies
- `read_events` - Read events
- `write_events` - Create events
- `read_articles` - Read help center articles
- `write_articles` - Create and update articles

## Usage

```javascript
const { Api } = require('@friggframework/api-module-intercom');

// Initialize with credentials
const intercomApi = new Api({
    client_id: process.env.INTERCOM_CLIENT_ID,
    client_secret: process.env.INTERCOM_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/intercom',
    scope: 'read_contacts write_contacts read_conversations write_conversations'
});

// Get authorization URL
const authUrl = intercomApi.getAuthUri();

// Exchange code for tokens
const tokens = await intercomApi.getTokenFromCode(authorizationCode);

// Get current user info
const me = await intercomApi.getMe();

// Find a contact by email
const contacts = await intercomApi.findContactByEmail('user@example.com');
```

## Available Methods

### Identity Methods
- `getMe()` - Get current authenticated user/app information

### Contacts Methods
- `getContacts(params)` - List contacts with pagination
- `createContact(contactData)` - Create new contact
- `getContact(contactId)` - Get specific contact
- `updateContact(contactId, contactData)` - Update contact
- `deleteContact(contactId)` - Delete contact
- `searchContacts(searchQuery)` - Search contacts with filters
- `mergeContacts(leadingContactId, mergeData)` - Merge contacts
- `findContactByEmail(email)` - Helper to find contact by email

### Companies Methods
- `getCompanies(params)` - List companies
- `createCompany(companyData)` - Create new company
- `getCompany(companyId)` - Get specific company
- `updateCompany(companyId, companyData)` - Update company
- `deleteCompany(companyId)` - Delete company
- `searchCompanies(searchQuery)` - Search companies

### Conversations Methods
- `getConversations(params)` - List conversations
- `getConversation(conversationId)` - Get specific conversation
- `searchConversations(searchQuery)` - Search conversations
- `replyToConversation(conversationId, replyData)` - Reply to conversation
- `assignConversation(conversationId, assigneeData)` - Assign conversation
- `closeConversation(conversationId, closeData)` - Close conversation
- `openConversation(conversationId, openData)` - Reopen conversation
- `snoozeConversation(conversationId, snoozeUntil)` - Snooze conversation

### Messages Methods
- `sendMessage(messageData)` - Send message to contact
- `sendMessageToContact(contactId, messageBody, messageType)` - Helper to send message

### Events Methods
- `createEvent(eventData)` - Track custom event
- `getEvents(params)` - List events

### Data Attributes Methods
- `getDataAttributes(params)` - List custom data attributes
- `createDataAttribute(attributeData)` - Create custom attribute
- `getDataAttribute(attributeId)` - Get specific attribute
- `updateDataAttribute(attributeId, attributeData)` - Update attribute

### Tags Methods
- `getTags()` - List all tags
- `createTag(tagData)` - Create new tag
- `getTag(tagId)` - Get specific tag
- `deleteTag(tagId)` - Delete tag

### Notes Methods
- `createNote(noteData)` - Add note to contact/conversation
- `getNote(noteId)` - Get specific note

### Teams Methods
- `getTeams()` - List teams
- `getTeam(teamId)` - Get specific team

### Admins Methods
- `getAdmins()` - List admins/teammates
- `getAdmin(adminId)` - Get specific admin

### Articles Methods
- `getArticles(params)` - List help center articles
- `createArticle(articleData)` - Create new article
- `getArticle(articleId)` - Get specific article
- `updateArticle(articleId, articleData)` - Update article
- `deleteArticle(articleId)` - Delete article

### Collections Methods
- `getCollections(params)` - List article collections
- `createCollection(collectionData)` - Create new collection
- `getCollection(collectionId)` - Get specific collection
- `updateCollection(collectionId, collectionData)` - Update collection
- `deleteCollection(collectionId)` - Delete collection

### Webhooks Methods
- `getWebhooks()` - List webhook subscriptions
- `createWebhook(webhookData)` - Create webhook subscription
- `getWebhook(subscriptionId)` - Get webhook details
- `deleteWebhook(subscriptionId)` - Delete webhook

## Usage Examples

### Creating a Contact
```javascript
const contactData = {
    role: 'user',
    email: 'user@example.com',
    name: 'John Doe',
    custom_attributes: {
        plan: 'premium',
        signup_date: new Date().toISOString()
    }
};

const contact = await intercomApi.createContact(contactData);
console.log('Contact created:', contact.id);
```

### Searching for Contacts
```javascript
const searchQuery = {
    query: {
        operator: 'AND',
        operands: [
            {
                field: 'email',
                operator: '=',
                value: 'user@example.com'
            },
            {
                field: 'role',
                operator: '=',
                value: 'user'
            }
        ]
    }
};

const results = await intercomApi.searchContacts(searchQuery);
```

### Sending a Message
```javascript
const messageData = {
    message_type: 'inbound',
    body: 'Hello! I need help with my account.',
    from: {
        type: 'contact',
        id: 'contact-id'
    }
};

const message = await intercomApi.sendMessage(messageData);
```

### Replying to a Conversation
```javascript
const replyData = {
    message_type: 'comment',
    type: 'admin',
    admin_id: 'admin-id',
    body: 'Thanks for reaching out! How can I help you today?'
};

await intercomApi.replyToConversation(conversationId, replyData);
```

### Creating a Custom Event
```javascript
const eventData = {
    event_name: 'trial_started',
    created_at: Math.floor(Date.now() / 1000),
    user_id: 'user-123',
    metadata: {
        plan_type: 'premium',
        trial_length: 14
    }
};

await intercomApi.createEvent(eventData);
```

### Setting up Webhooks
```javascript
const webhookData = {
    service_type: 'web',
    url: 'https://yoursite.com/webhooks/intercom',
    topics: [
        'contact.created',
        'conversation.user.created',
        'conversation.admin.replied'
    ]
};

const webhook = await intercomApi.createWebhook(webhookData);
```

### Managing Companies
```javascript
// Create a company
const companyData = {
    company_id: 'company-123',
    name: 'Acme Corp',
    monthly_spend: 9000,
    plan: 'enterprise',
    size: 100
};

const company = await intercomApi.createCompany(companyData);

// Associate contact with company
const contactUpdate = {
    companies: [
        {
            company_id: 'company-123'
        }
    ]
};

await intercomApi.updateContact(contactId, contactUpdate);
```

## Authentication Flow

Intercom uses OAuth2:

1. Redirect users to Intercom's authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access tokens
4. Use tokens for API requests

## Error Handling

Intercom returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const contact = await intercomApi.createContact(contactData);
    console.log('Contact created successfully');
} catch (error) {
    console.error('Intercom error:', error.message);
    if (error.errors) {
        error.errors.forEach(err => {
            console.error('Error detail:', err.message);
        });
    }
}
```

## Rate Limiting

Intercom enforces rate limits on API requests. The module does not implement automatic retry logic - you should handle rate limiting in your application.

## Webhooks

Intercom can send webhooks for various events:
- `contact.created` - New contact created
- `contact.signed_up` - Contact signed up
- `conversation.user.created` - User started conversation
- `conversation.admin.replied` - Admin replied to conversation
- `conversation.admin.assigned` - Conversation assigned
- `event.created` - Custom event tracked

## Documentation

For detailed Intercom API documentation, visit: https://developers.intercom.com/