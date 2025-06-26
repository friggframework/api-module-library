# Mailchimp API Module

A comprehensive Mailchimp Marketing API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
MAILCHIMP_CLIENT_ID=your_mailchimp_client_id
MAILCHIMP_CLIENT_SECRET=your_mailchimp_client_secret
REDIRECT_URI=your_redirect_uri_base
```

### Getting Mailchimp API Credentials

1. Go to the [Mailchimp Developer Portal](https://mailchimp.com/developer/)
2. Sign in and navigate to "Your Apps"
3. Create a new app or select an existing one
4. Get your Client ID and Client Secret from the app settings
5. Add your redirect URI (e.g., `https://yourdomain.com/mailchimp`)

### OAuth2 Flow

Mailchimp uses OAuth2 with a unique server prefix that's returned during authentication. The module automatically handles this and sets the appropriate API endpoint.

## Usage

```javascript
const { Api } = require('@friggframework/api-module-mailchimp');

// Initialize with credentials
const mailchimpApi = new Api({
    client_id: process.env.MAILCHIMP_CLIENT_ID,
    client_secret: process.env.MAILCHIMP_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/mailchimp'
});

// Get authorization URL
const authUrl = mailchimpApi.getAuthUri();

// Exchange code for tokens
const tokens = await mailchimpApi.getTokenFromCode(authorizationCode);

// Use the API
const account = await mailchimpApi.getAccount();
const lists = await mailchimpApi.getLists();
```

## Available Methods

### Account Methods
- `getAccount()` - Get account information
- `ping()` - Test API connectivity

### Lists Methods
- `getLists(params)` - Get all lists with optional filtering
- `getList(listId)` - Get specific list
- `createList(listData)` - Create new list
- `updateList(listId, listData)` - Update list
- `deleteList(listId)` - Delete list

### List Members Methods
- `getListMembers(listId, params)` - Get list members
- `getListMember(listId, memberIdOrEmail)` - Get specific member
- `addListMember(listId, memberData)` - Add new member
- `updateListMember(listId, memberIdOrEmail, memberData)` - Update member
- `addOrUpdateListMember(listId, memberIdOrEmail, memberData)` - Add or update member
- `deleteListMember(listId, memberIdOrEmail)` - Remove member
- `batchSubscribeMembers(listId, members, updateExisting)` - Batch add/update members

### Campaigns Methods
- `getCampaigns(params)` - Get all campaigns
- `getCampaign(campaignId)` - Get specific campaign
- `createCampaign(campaignData)` - Create new campaign
- `updateCampaign(campaignId, campaignData)` - Update campaign
- `deleteCampaign(campaignId)` - Delete campaign
- `getCampaignContent(campaignId)` - Get campaign content
- `setCampaignContent(campaignId, content)` - Set campaign content
- `sendCampaign(campaignId)` - Send campaign immediately
- `scheduleCampaign(campaignId, scheduleTime, timezoneOffset)` - Schedule campaign
- `sendTestCampaign(campaignId, testEmails, sendType)` - Send test campaign

### Templates Methods
- `getTemplates(params)` - Get email templates
- `getTemplate(templateId)` - Get specific template
- `createTemplate(templateData)` - Create new template
- `updateTemplate(templateId, templateData)` - Update template
- `deleteTemplate(templateId)` - Delete template

### Automations Methods
- `getAutomations(params)` - Get automation workflows
- `getAutomation(automationId)` - Get specific automation
- `getAutomationEmails(automationId)` - Get automation emails
- `getAutomationEmail(automationId, emailId)` - Get specific automation email

### Reports Methods
- `getReports(params)` - Get campaign reports
- `getCampaignReport(campaignId)` - Get specific campaign report
- `getCampaignEmailActivity(campaignId, params)` - Get email activity for campaign

### Interest Categories Methods
- `getListInterestCategories(listId)` - Get interest categories for list
- `getListInterests(listId, categoryId)` - Get interests in category

### File Manager Methods
- `getFiles(params)` - Get uploaded files
- `getFile(fileId)` - Get specific file
- `uploadFile(fileData)` - Upload new file
- `deleteFile(fileId)` - Delete file

## Usage Examples

### Creating a List
```javascript
const listData = {
    name: "My Newsletter",
    contact: {
        company: "Your Company",
        address1: "123 Main St",
        city: "Anytown",
        state: "ST",
        zip: "12345",
        country: "US"
    },
    permission_reminder: "You're receiving this email because you signed up for our newsletter.",
    campaign_defaults: {
        from_name: "Your Name",
        from_email: "you@yourcompany.com",
        subject: "Newsletter",
        language: "en"
    }
};

const newList = await mailchimpApi.createList(listData);
```

### Adding a Member to a List
```javascript
const memberData = {
    email_address: "subscriber@example.com",
    status: "subscribed",
    merge_fields: {
        FNAME: "John",
        LNAME: "Doe"
    }
};

const member = await mailchimpApi.addListMember(listId, memberData);
```

### Creating and Sending a Campaign
```javascript
// Create campaign
const campaignData = {
    type: "regular",
    recipients: {
        list_id: "your-list-id"
    },
    settings: {
        subject_line: "Your Newsletter Subject",
        from_name: "Your Name",
        reply_to: "reply@yourcompany.com"
    }
};

const campaign = await mailchimpApi.createCampaign(campaignData);

// Set content
const content = {
    html: "<h1>Hello World!</h1><p>This is your newsletter content.</p>"
};

await mailchimpApi.setCampaignContent(campaign.id, content);

// Send campaign
await mailchimpApi.sendCampaign(campaign.id);
```

### Batch Adding Members
```javascript
const members = [
    {
        email_address: "user1@example.com",
        status: "subscribed",
        merge_fields: { FNAME: "User", LNAME: "One" }
    },
    {
        email_address: "user2@example.com",
        status: "subscribed",
        merge_fields: { FNAME: "User", LNAME: "Two" }
    }
];

const result = await mailchimpApi.batchSubscribeMembers(listId, members, true);
```

## Authentication Flow

1. Redirect users to the authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access tokens and server prefix
4. The module automatically sets the correct API endpoint based on the server prefix

## Error Handling

Mailchimp returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const campaign = await mailchimpApi.createCampaign(campaignData);
    console.log('Campaign created:', campaign.id);
} catch (error) {
    console.error('Mailchimp error:', error.message);
}
```

## Rate Limiting

Mailchimp enforces rate limits on API requests. The module does not implement automatic retry logic - you should handle rate limiting in your application.

## Webhooks

Mailchimp can send webhooks for various list events (subscribes, unsubscribes, profile updates, etc.). Configure webhook URLs in your Mailchimp account settings.

## Documentation

For detailed Mailchimp API documentation, visit: https://mailchimp.com/developer/marketing/