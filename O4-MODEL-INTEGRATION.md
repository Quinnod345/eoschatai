# O4 Model Integration Guide

## Current Status

The system is now configured to use the newer OpenAI models:
- **Default Chat Model**: `gpt-4.1` - The latest GPT-4 model for regular conversations
- **Nexus Mode Model**: `o4-mini` - A compact reasoning model optimized for deep research and analysis

## Model Configuration

The models are configured in:
1. **`lib/ai/providers.ts`** - Default model configuration
2. **`app/api/chat/route.ts`** - Nexus mode model override
3. **`app/(chat)/api/nexus-chat/route.ts`** - Research planning model

## Switching Models

To change the models used:

1. **Update the default chat model in `lib/ai/providers.ts`**:
   ```typescript
   'chat-model': openai('gpt-4.1'),
   ```

2. **Update the Nexus mode model in `app/api/chat/route.ts`**:
   ```typescript
   const finalChatModel = isNexusMode ? 'o4-mini' : selectedChatModel;
   ```

3. **Update the research planning model in `app/(chat)/api/nexus-chat/route.ts`**:
   ```typescript
   model: provider.languageModel('o4-mini'),
   ```

## O4 Model Capabilities

The o4-mini model excels at:
- Deep research and comprehensive analysis
- Complex multi-step reasoning
- Mathematical and scientific analysis
- Advanced code generation
- Visual reasoning tasks
- Technical writing and instruction-following

## Token Limits

The models support:
- **gpt-4.1**: Standard context window with efficient processing
- **o4-mini**: Extended context for deep research (32K tokens)
- Output limits are handled dynamically based on the task

## Dynamic Model Creation

The system now supports dynamic model creation through the `createCustomProvider` function in `lib/ai/providers.ts`. This means:
- Any OpenAI model can be used without pre-configuration
- Models like `o4-mini` are created on-demand
- The system adapts to new models as they become available

## Cost Considerations

- **gpt-4.1**: Standard GPT-4 pricing for regular conversations
- **o4-mini**: Optimized for cost-effective deep research
- Use Nexus mode strategically for complex reasoning tasks 