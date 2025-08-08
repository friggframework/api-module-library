# Telegram Bot API Module

A comprehensive Telegram Bot API module for the Frigg framework, providing full access to Telegram's Bot API for messaging, file handling, inline queries, and webhook management.

## Features

- **Bot Management**: Get bot info, set commands, manage bot settings
- **Messaging**: Send text, photos, documents, videos, audio, locations, contacts
- **File Handling**: Upload and download files, handle media groups
- **Interactive Elements**: Inline keyboards, callback queries, inline mode
- **Chat Management**: Get chat info, administrators, member count
- **Message Editing**: Edit text, captions, media, reply markup
- **Webhook Support**: Set up webhooks, handle incoming updates
- **Error Handling**: Comprehensive error handling and validation

## Installation

```bash
npm install @friggframework/api-module-telegram
```

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

## Usage

```javascript
const { Api } = require('@friggframework/api-module-telegram');

const telegramApi = new Api({
    bot_token: process.env.TELEGRAM_BOT_TOKEN
});

// Send a simple text message
await telegramApi.sendMessage(chatId, 'Hello, World!');

// Send a photo with caption
await telegramApi.sendPhoto(chatId, photoUrl, {
    caption: 'Check out this image!'
});

// Set up webhook
await telegramApi.setWebhook('https://your-domain.com/webhook');

// Handle webhook data
const update = telegramApi.handleWebhook(webhookBody);
```

## Key Methods

### Bot Management
- `getMe()` - Get bot information
- `setMyCommands(commands)` - Set bot commands
- `getMyCommands()` - Get current bot commands

### Messaging
- `sendMessage(chatId, text, options)` - Send text message
- `sendPhoto(chatId, photo, options)` - Send photo
- `sendDocument(chatId, document, options)` - Send document
- `sendVideo(chatId, video, options)` - Send video
- `sendLocation(chatId, latitude, longitude, options)` - Send location

### Webhook Management
- `setWebhook(url, options)` - Set webhook URL
- `getWebhookInfo()` - Get webhook information
- `deleteWebhook()` - Delete webhook
- `handleWebhook(body)` - Process webhook updates

### Message Management
- `editMessageText(text, options)` - Edit message text
- `deleteMessage(chatId, messageId)` - Delete message
- `forwardMessage(chatId, fromChatId, messageId)` - Forward message

## Authentication

Telegram Bot API uses bot tokens for authentication. Get your bot token by creating a bot with [@BotFather](https://t.me/botfather) on Telegram.

## Webhook Handling

The module includes comprehensive webhook handling for all Telegram update types:
- Messages (text, media, location, contact, etc.)
- Edited messages
- Channel posts
- Inline queries
- Callback queries
- And more...

## Error Handling

All methods include proper error handling and will throw descriptive errors for invalid requests or authentication issues.