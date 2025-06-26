# WhatsApp Business API Module

A comprehensive WhatsApp Business API module for the Frigg framework, providing access to WhatsApp's Business messaging capabilities including templates, media, and customer communication.

## Features

- **Message Types**: Text, images, documents, audio, video, location, contacts
- **Templates**: Create and manage message templates for notifications
- **Interactive Messages**: Buttons, lists, quick replies
- **Media Management**: Upload, download, and manage media files
- **Business Profile**: Manage business profile information
- **Phone Numbers**: Manage WhatsApp Business phone numbers
- **Webhook Support**: Handle incoming messages and status updates
- **Analytics**: Message delivery and read receipts

## Installation

```bash
npm install @friggframework/api-module-whatsapp-business
```

## Environment Variables

```env
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_API_VERSION=v18.0
```

## Usage

```javascript
const { Api } = require('@friggframework/api-module-whatsapp-business');

const whatsappApi = new Api({
    access_token: process.env.WHATSAPP_ACCESS_TOKEN,
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    whatsapp_business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
});

// Send a text message
await whatsappApi.sendTextMessage('1234567890', 'Hello from WhatsApp!');

// Send an image with caption
await whatsappApi.sendImageMessage('1234567890', mediaId, 'Check this out!');

// Send a template message
await whatsappApi.sendTemplateMessage(
    '1234567890',
    'hello_world',
    'en_US',
    []
);

// Handle webhooks
const update = await whatsappApi.handleWebhook(webhookBody);
```

## Key Methods

### Messaging
- `sendTextMessage(to, text, options)` - Send text message
- `sendImageMessage(to, imageId, caption, options)` - Send image
- `sendDocumentMessage(to, documentId, filename, caption, options)` - Send document
- `sendTemplateMessage(to, templateName, languageCode, components)` - Send template
- `sendButtonMessage(to, bodyText, buttons)` - Send interactive buttons
- `sendListMessage(to, bodyText, buttonText, sections)` - Send list

### Media Management
- `uploadMedia(file, type, options)` - Upload media file
- `getMedia(mediaId)` - Get media information
- `downloadMedia(mediaUrl)` - Download media file
- `deleteMedia(mediaId)` - Delete media file

### Templates
- `getMessageTemplates(options)` - Get all templates
- `createMessageTemplate(name, category, language, components)` - Create template
- `deleteMessageTemplate(templateId)` - Delete template

### Business Profile
- `getBusinessProfile(fields)` - Get business profile
- `updateBusinessProfile(profileData)` - Update business profile

### Webhook Management
- `subscribeToWebhooks(callbackUrl, verifyToken, fields)` - Subscribe to webhooks
- `handleWebhook(body)` - Process incoming webhooks
- `verifyWebhook(mode, token, challenge, verifyToken)` - Verify webhook

### Status Management
- `markMessageAsRead(messageId)` - Mark message as read

## Authentication

WhatsApp Business API uses Facebook access tokens. You need:
1. A Facebook App with WhatsApp Business API access
2. A WhatsApp Business Account
3. A phone number registered with WhatsApp Business
4. Access tokens from Facebook Developer Console

## Webhook Handling

The module handles various webhook types:
- Incoming messages (text, media, interactive responses)
- Message status updates (sent, delivered, read, failed)
- Account updates

## Message Templates

WhatsApp requires pre-approved templates for certain message types. The module supports:
- Text templates with variables
- Media templates
- Interactive templates
- Location templates

## Error Handling

Comprehensive error handling with detailed Facebook API error responses including error codes, messages, and trace IDs for debugging.