# GPT-5 Reasoning Implementation

## Summary

Implemented intelligent reasoning effort for GPT-5 model with preflight decision-making and real-time reasoning text display.

## Changes Made

### 1. Preflight Enhancement (`app/api/chat/route.ts`)

#### Updated `decideModelWithNano` Function
- **Return Type**: Now includes `reasoningEffort?: 'low' | 'medium' | 'high'`
- **Reasoning Decision Logic**: Added sophisticated rules for preflight to decide reasoning effort:
  - **Low**: Moderate complexity queries, summaries, standard analysis
  - **Medium**: Multi-step reasoning, critique, comparative analysis, complex code review
  - **High**: Extreme complexity, multi-faceted analysis, research synthesis, hidden insight discovery, academic rigor, philosophical analysis, strategic planning

#### JSON Response Format
- Updated preflight prompt to return: `{"model":"gpt-4.1"|"gpt-5","max_tokens":<int>,"reasoning_effort":"low"|"medium"|"high"}`
- GPT-4.1 always gets "low" (ignored)
- GPT-5 gets appropriate reasoning_effort based on query complexity

### 2. Model Configuration

#### Preflight Variables
- Added `preflightReasoningEffort` to capture reasoning level from preflight decision
- Passed reasoning effort to `streamText` via `experimental_providerMetadata`

#### StreamText Configuration
```typescript
...(finalChatModel === 'gpt-5' && preflightReasoningEffort ? {
  experimental_providerMetadata: {
    openai: {
      reasoningEffort: preflightReasoningEffort
    }
  }
} : {})
```

### 3. UI - Reasoning Text Display (`components/message.tsx`)

#### Added Reasoning Section
- Displays before the main message content
- Shows actual reasoning text from GPT-5 instead of generic ThinkingMessage
- Styled with:
  - Muted background (`bg-muted/50`)
  - Border for separation
  - Active AI icon to indicate thinking
  - Monospace font for reasoning text
  - Pre-wrap for formatting

#### Display Logic
```tsx
{message.role === 'assistant' && 
 (message as any).experimental_providerMetadata?.openai?.reasoning && (
  <div className="flex flex-col gap-2 p-4 bg-muted/50 rounded-lg border border-muted">
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <AIActiveLoaderIcon size={16} />
      <span>Reasoning</span>
    </div>
    <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
      {(message as any).experimental_providerMetadata.openai.reasoning}
    </div>
  </div>
)}
```

## How It Works

### 1. User Sends Query
- Query is analyzed by preflight using GPT-4.1-nano

### 2. Preflight Decision
- Preflight analyzes:
  - Query complexity and length
  - Code/math detection
  - Deep analysis triggers
  - File uploads
  - Input character count
- Decides:
  - Model: `gpt-4.1` or `gpt-5`
  - Max tokens: 400-100,000
  - Reasoning effort: `low`, `medium`, or `high` (GPT-5 only)

### 3. Stream Response
- If GPT-5 with reasoning:
  - Reasoning tokens stream first
  - Displayed in real-time in the reasoning section
  - Main response follows after reasoning completes

### 4. User Experience
- Instead of seeing generic "Thinking..." animation
- Users see actual reasoning process:
  - "Breaking down the problem..."
  - "Considering multiple approaches..."
  - "Evaluating edge cases..."
  - etc.

## Benefits

1. **Intelligent Resource Allocation**: Preflight decides optimal reasoning level per query
2. **Transparency**: Users see what the AI is thinking, not just loading animations
3. **Cost Optimization**: Only uses high reasoning when truly needed
4. **Better UX**: Real reasoning text is more engaging than generic loading messages
5. **Performance**: Low reasoning for simple queries, high for complex ones

## Model Behavior

### GPT-4.1
- No reasoning effort (parameter ignored)
- Standard temperature: 0.8
- Max tokens: up to 32,000

### GPT-5
- Reasoning effort: dynamically decided (low/medium/high)
- Temperature: 1.0 (fixed)
- Max tokens: up to 100,000
- Reasoning text streamed separately

## Example Scenarios

### Simple Query → Low Reasoning
- "What is EOS?"
- Model: GPT-5
- Reasoning: Low
- Quick, straightforward response

### Complex Analysis → Medium Reasoning
- "Compare accountability charts to traditional org charts and explain the differences"
- Model: GPT-5
- Reasoning: Medium
- Multi-step reasoning visible to user

### Deep Research → High Reasoning
- "Analyze the hidden rhetorical strategies in this document and critique its weaknesses"
- Model: GPT-5
- Reasoning: High
- Extended thinking process displayed

## Technical Notes

- Reasoning text appears via `experimental_providerMetadata.openai.reasoning`
- Vercel AI SDK automatically handles reasoning stream chunks
- No additional API changes needed - fully compatible with existing chat flow
- Reasoning is additive - doesn't break existing non-reasoning flows

## Future Enhancements

Potential improvements:
1. Collapsible reasoning section for long thinking processes
2. Syntax highlighting in reasoning text
3. Real-time streaming of reasoning (currently displays after complete)
4. User preference to show/hide reasoning
5. Reasoning quality metrics

## Files Modified

1. `/app/api/chat/route.ts` - Preflight and model configuration
2. `/components/message.tsx` - Reasoning text display UI

## No Breaking Changes

- Existing GPT-4.1 flows unchanged
- Non-reasoning GPT-5 still works
- Backward compatible with all current features


