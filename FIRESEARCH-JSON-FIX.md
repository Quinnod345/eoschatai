# Firesearch JSON Format Error Fix

## Error
```
400 'messages' must contain the word 'json' in some form, to use 'response_format' of type 'json_object'.
```

## Cause
When using OpenAI's `response_format: { type: 'json_object' }`, the API requires that the word "json" appears somewhere in the prompt to ensure the model understands it should output JSON.

## Fix Applied
Updated all prompts in `lib/firesearch/service.ts` that use JSON response format:

1. **generateResearchPlan**: Changed "Output format:" to "Return your response in JSON format:"
2. **analyzeResults**: Changed "Output format:" to "Return your analysis in JSON format:"
3. **synthesizeResults**: Changed "Output format:" to "Return your response in JSON format:"
4. **generateFollowUpQuestions**: Changed "Output format:" to "Return your response in JSON format:"

## Testing
The Deep Research mode should now work properly. Try:

1. Start a new chat
2. Enable "Deep Research" mode
3. Ask a question like "What is a put option in trading?"

The research should now proceed without the JSON format error.

## Technical Details
- OpenAI requires the word "json" in prompts when using `response_format: { type: 'json_object' }`
- This is a safety mechanism to ensure the model understands the expected output format
- The model used (`gpt-4-turbo-preview`) supports JSON mode correctly



