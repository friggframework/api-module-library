# OpenAI API Module

This module provides a complete interface to OpenAI's API services including GPT models, DALL-E, Whisper, and more.

## Features

- **Chat Completions**: Access GPT-4 and GPT-3.5 models for conversational AI
- **Embeddings**: Generate text embeddings for semantic search and similarity
- **Image Generation**: Create images with DALL-E 3 and DALL-E 2
- **Audio**: Transcribe and translate audio with Whisper, generate speech
- **Fine-tuning**: Customize models with your own training data
- **Assistants API**: Build AI assistants with persistent threads
- **Content Moderation**: Check content for policy compliance
- **Streaming Support**: Real-time streaming for chat completions

## Authentication

OpenAI uses API key authentication. You'll need to:

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Generate an API key from your account settings
3. Set the following environment variables:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_ORGANIZATION_ID=your_org_id_here # Optional
```

## Usage Examples

### Chat Completions

```javascript
const {Api} = require('./api');

const api = new Api({
    apiKey: process.env.OPENAI_API_KEY
});

// Simple chat completion
const response = await api.createChatCompletion({
    model: "gpt-4",
    messages: [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, how are you?"}
    ],
    temperature: 0.7,
    max_tokens: 150
});

// Streaming chat completion
const stream = await api.createChatCompletionStream({
    model: "gpt-3.5-turbo",
    messages: [{"role": "user", "content": "Tell me a story"}],
    stream: true
});
```

### Embeddings

```javascript
const embedding = await api.createEmbedding({
    model: "text-embedding-ada-002",
    input: "The quick brown fox jumps over the lazy dog"
});
```

### Image Generation

```javascript
// Generate image from text
const image = await api.createImage({
    prompt: "A serene landscape with mountains and a lake",
    n: 1,
    size: "1024x1024"
});

// Create variations of an existing image
const variation = await api.createImageVariation({
    image: imageFile,
    n: 2,
    size: "512x512"
});
```

### Audio Transcription

```javascript
const transcription = await api.createTranscription({
    file: audioFile,
    model: "whisper-1",
    language: "en"
});
```

### Fine-tuning

```javascript
// Create fine-tuning job
const job = await api.createFineTuningJob({
    training_file: "file-abc123",
    model: "gpt-3.5-turbo"
});

// Monitor progress
const events = await api.listFineTuningEvents(job.id);
```

### Assistants API

```javascript
// Create an assistant
const assistant = await api.createAssistant({
    name: "Math Tutor",
    instructions: "You are a personal math tutor.",
    tools: [{"type": "code_interpreter"}],
    model: "gpt-4"
});

// Create a thread
const thread = await api.createThread();

// Add a message
await api.createMessage(thread.id, {
    role: "user",
    content: "I need help with calculus"
});

// Run the assistant
const run = await api.createRun(thread.id, {
    assistant_id: assistant.id
});
```

### Content Moderation

```javascript
const moderation = await api.createModeration({
    input: "Text to check for policy compliance"
});
```

## Token Management

The module includes utilities for token estimation:

```javascript
// Estimate tokens in text
const tokenCount = api.estimateTokens("Your text here");

// Get model token limit
const limit = api.getTokenLimit("gpt-4");
```

## Error Handling

The module handles common OpenAI errors:

- Rate limiting (429 errors)
- Invalid API key
- Model availability
- Token limits exceeded

## API Methods

### Chat & Completions
- `createChatCompletion(params)` - Generate chat responses
- `createChatCompletionStream(params)` - Stream chat responses

### Embeddings
- `createEmbedding(params)` - Generate text embeddings

### Images
- `createImage(params)` - Generate images from text
- `createImageEdit(params)` - Edit images with prompts
- `createImageVariation(params)` - Create image variations

### Audio
- `createTranscription(params)` - Transcribe audio to text
- `createTranslation(params)` - Translate audio to English
- `createSpeech(params)` - Generate speech from text

### Files
- `uploadFile(params)` - Upload training files
- `listFiles(params)` - List uploaded files
- `retrieveFile(fileId)` - Get file metadata
- `deleteFile(fileId)` - Delete a file
- `retrieveFileContent(fileId)` - Download file content

### Fine-tuning
- `createFineTuningJob(params)` - Start fine-tuning
- `listFineTuningJobs(params)` - List fine-tuning jobs
- `retrieveFineTuningJob(jobId)` - Get job details
- `cancelFineTuningJob(jobId)` - Cancel a job
- `listFineTuningEvents(jobId, params)` - Get job events

### Models
- `listModels()` - List available models
- `retrieveModel(modelId)` - Get model details
- `deleteModel(modelId)` - Delete fine-tuned model

### Assistants
- `createAssistant(params)` - Create an assistant
- `listAssistants(params)` - List assistants
- `retrieveAssistant(assistantId)` - Get assistant details
- `modifyAssistant(assistantId, params)` - Update assistant
- `deleteAssistant(assistantId)` - Delete assistant

### Threads & Messages
- `createThread(params)` - Create a conversation thread
- `retrieveThread(threadId)` - Get thread details
- `modifyThread(threadId, params)` - Update thread
- `deleteThread(threadId)` - Delete thread
- `createMessage(threadId, params)` - Add message to thread
- `listMessages(threadId, params)` - List thread messages
- `createRun(threadId, params)` - Run assistant on thread
- `listRuns(threadId, params)` - List thread runs

### Moderation
- `createModeration(params)` - Check content compliance

### Utilities
- `testAuth()` - Verify API key validity
- `estimateTokens(text)` - Estimate token count
- `getTokenLimit(model)` - Get model token limit

## Support

For more information, visit [OpenAI API Documentation](https://platform.openai.com/docs/api-reference).