# Anthropic API Module

This module provides a complete interface to Anthropic's Claude API, featuring advanced language understanding and generation capabilities.

## Features

- **Messages API**: Modern conversation interface with Claude 3 models
- **Streaming Support**: Real-time streaming responses
- **Vision Capabilities**: Process images with Claude 3 models
- **System Prompts**: Set context and behavior for conversations
- **Long Context**: Up to 200K tokens context window
- **Safety Features**: Built-in content filtering and safety measures

## Authentication

Anthropic uses API key authentication with the x-api-key header. You'll need to:

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key from your account settings
3. Set the following environment variables:

```bash
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_VERSION=2023-06-01  # Optional, defaults to latest
```

## Usage Examples

### Basic Message

```javascript
const {Api} = require('./api');

const api = new Api({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Simple message
const response = await api.createMessage({
    model: "claude-3-opus-20240229",
    max_tokens: 1024,
    messages: [
        {
            role: "user",
            content: "What is the capital of France?"
        }
    ]
});
```

### System Prompts

```javascript
const response = await api.createMessage({
    model: "claude-3-sonnet-20240229",
    max_tokens: 2048,
    system: "You are a helpful assistant that speaks like Shakespeare.",
    messages: [
        {
            role: "user",
            content: "Tell me about artificial intelligence"
        }
    ]
});
```

### Streaming Responses

```javascript
const stream = await api.createMessageStream({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [
        {
            role: "user",
            content: "Write a short story about a robot"
        }
    ],
    stream: true
});

// Process stream chunks
for await (const chunk of stream) {
    const events = api.parseStreamChunk(chunk);
    for (const event of events) {
        if (event.type === 'content_block_delta') {
            process.stdout.write(event.delta.text);
        }
    }
}
```

### Vision Capabilities

```javascript
// Analyze an image
const response = await api.createVisionMessage({
    model: "claude-3-opus-20240229",
    max_tokens: 1024,
    messages: [
        {
            role: "user",
            content: [
                {
                    type: "text",
                    text: "What's in this image?"
                },
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: "image/jpeg",
                        data: base64ImageData
                    }
                }
            ]
        }
    ]
});
```

### Multi-turn Conversations

```javascript
const conversation = [
    {
        role: "user",
        content: "Hi, I'm learning about quantum computing"
    },
    {
        role: "assistant",
        content: "That's fascinating! Quantum computing is a revolutionary field. What aspects interest you most?"
    },
    {
        role: "user",
        content: "I'm curious about quantum entanglement"
    }
];

const response = await api.createMessage({
    model: "claude-3-sonnet-20240229",
    max_tokens: 2048,
    messages: conversation
});
```

### Temperature and Sampling

```javascript
// Creative writing with high temperature
const creative = await api.createMessage({
    model: "claude-3-opus-20240229",
    max_tokens: 2048,
    temperature: 0.9,
    messages: [
        {
            role: "user",
            content: "Write a creative story opening"
        }
    ]
});

// Deterministic output with low temperature
const factual = await api.createMessage({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    temperature: 0,
    messages: [
        {
            role: "user",
            content: "List the planets in our solar system"
        }
    ]
});
```

## Available Models

### Claude 3 Family
- **claude-3-opus-20240229**: Most capable model for complex tasks
- **claude-3-sonnet-20240229**: Balanced performance and speed
- **claude-3-haiku-20240307**: Fastest model for simple tasks

### Previous Versions
- **claude-2.1**: Extended context window (200K tokens)
- **claude-2.0**: Previous generation model
- **claude-instant-1.2**: Fast, cost-effective model

## Token Management

```javascript
// Estimate tokens in text
const tokenCount = api.estimateTokens("Your text here");

// Get model limits
const maxTokens = api.getMaxTokens("claude-3-opus-20240229");
const maxOutput = api.getMaxOutputTokens("claude-3-opus-20240229");
```

## Message Formatting

The module includes helpers for proper message formatting:

```javascript
// Automatically format messages for Claude's requirements
const response = await api.createFormattedMessage({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    messages: [
        { role: "system", content: "You are helpful" },  // Converted properly
        { role: "user", content: "Hello" },
        { role: "user", content: "How are you?" },       // Consecutive messages handled
    ]
});
```

## API Methods

### Messages
- `createMessage(params)` - Send a message to Claude
- `createMessageStream(params)` - Stream a response from Claude
- `createFormattedMessage(params)` - Create message with auto-formatting
- `createVisionMessage(params)` - Send message with image content

### Legacy Completions
- `createCompletion(params)` - Use legacy completion endpoint
- `createCompletionStream(params)` - Stream legacy completions

### Utilities
- `testAuth()` - Verify API key validity
- `estimateTokens(text)` - Estimate token count
- `getModelInfo(model)` - Get model specifications
- `getMaxTokens(model)` - Get model's max context tokens
- `getMaxOutputTokens(model)` - Get model's max output tokens
- `formatMessages(messages)` - Format messages for Claude
- `parseStreamChunk(chunk)` - Parse streaming response chunks

## Best Practices

1. **Use System Prompts**: Set clear instructions via the `system` parameter
2. **Manage Context**: Be mindful of token limits, especially with long conversations
3. **Choose the Right Model**: Use Opus for complex reasoning, Haiku for speed
4. **Handle Streaming**: For long responses, use streaming to improve UX
5. **Error Handling**: Implement proper error handling for rate limits and API errors

## Error Handling

Common error scenarios:
- `401`: Invalid API key
- `429`: Rate limit exceeded
- `400`: Invalid request (check message format)
- `500`: Server error (retry with backoff)

## Support

For more information, visit [Anthropic's Documentation](https://docs.anthropic.com/claude/reference).