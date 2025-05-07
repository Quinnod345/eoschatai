// This is a production-compatible version of the test models
// It's used to allow importing the file in production builds without Node.js dependencies

// Export dummy models that are compatible with browser environments
export const chatModel = {
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    text: 'Production build',
  }),
};

export const reasoningModel = chatModel;
export const titleModel = chatModel;
export const artifactModel = chatModel;
