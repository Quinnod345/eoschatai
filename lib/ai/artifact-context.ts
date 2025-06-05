import type { UIArtifact } from '@/components/enhanced-artifact';

export interface ArtifactContext {
  hasActiveArtifact: boolean;
  artifact?: UIArtifact;
  lastUserAction?: 'create' | 'edit' | 'view';
  editIntent?: {
    type: 'modify' | 'extend' | 'improve' | 'fix';
    target?:
      | 'specific_section'
      | 'entire_content'
      | 'conclusion'
      | 'introduction';
    description?: string;
  };
}

export function buildArtifactContextPrompt(context: ArtifactContext): string {
  if (!context.hasActiveArtifact || !context.artifact) {
    return '';
  }

  const { artifact, editIntent } = context;

  let contextPrompt = `\n\n## ACTIVE ARTIFACT CONTEXT
You are currently working with an active artifact:
- Type: ${artifact.kind}
- Title: "${artifact.title}"
- Status: ${artifact.status}
- Content Length: ${artifact.content.length} characters

IMPORTANT EDITING INSTRUCTIONS:
`;

  if (editIntent) {
    switch (editIntent.type) {
      case 'modify':
        contextPrompt += `- The user wants to MODIFY the existing artifact
- DO NOT create new content in chat
- USE the artifact editing tools to make changes
- Focus on: ${editIntent.target || 'the specified section'}`;
        break;

      case 'extend':
        contextPrompt += `- The user wants to EXTEND/EXPAND the existing artifact
- DO NOT create new content in chat  
- USE the artifact editing tools to add content
- Target area: ${editIntent.target || 'the specified section'}
- Add the new content directly to the artifact`;
        break;

      case 'improve':
        contextPrompt += `- The user wants to IMPROVE the existing artifact
- DO NOT create new content in chat
- USE the artifact editing tools to enhance the content
- Focus on: ${editIntent.target || 'overall quality'}`;
        break;

      case 'fix':
        contextPrompt += `- The user wants to FIX issues in the existing artifact
- DO NOT create new content in chat
- USE the artifact editing tools to correct problems
- Target: ${editIntent.target || 'identified issues'}`;
        break;
    }
  } else {
    contextPrompt += `- The user is referring to the existing artifact
- If they want changes, EDIT the artifact directly
- DO NOT create duplicate content in chat
- USE the artifact editing tools for any modifications`;
  }

  contextPrompt += `

ARTIFACT EDITING RULES:
1. If the user asks to modify, extend, improve, or change the artifact → EDIT the artifact
2. If the user asks questions about the artifact → Answer in chat
3. If the user wants to create something new → Create a new artifact
4. When editing, preserve the existing structure and style
5. Make targeted changes rather than replacing everything

Current artifact content preview:
\`\`\`
${artifact.content.substring(0, 500)}${artifact.content.length > 500 ? '...' : ''}
\`\`\`
`;

  return contextPrompt;
}

export function detectEditIntent(
  userMessage: string,
  artifact?: UIArtifact,
): ArtifactContext['editIntent'] {
  if (!artifact) return undefined;

  const message = userMessage.toLowerCase();

  // Detect modification intent
  const modifyKeywords = [
    'change',
    'modify',
    'update',
    'edit',
    'revise',
    'alter',
  ];
  const extendKeywords = [
    'extend',
    'expand',
    'add',
    'make longer',
    'elaborate',
    'more detail',
  ];
  const improveKeywords = [
    'improve',
    'enhance',
    'better',
    'optimize',
    'refine',
    'polish',
  ];
  const fixKeywords = ['fix', 'correct', 'repair', 'debug', 'resolve', 'solve'];

  // Detect target sections
  const conclusionKeywords = [
    'conclusion',
    'ending',
    'final',
    'wrap up',
    'summary',
  ];
  const introKeywords = [
    'introduction',
    'intro',
    'beginning',
    'start',
    'opening',
  ];

  let type: 'modify' | 'extend' | 'improve' | 'fix' | undefined;
  let target:
    | 'specific_section'
    | 'entire_content'
    | 'conclusion'
    | 'introduction'
    | undefined;

  // Determine edit type
  if (extendKeywords.some((keyword) => message.includes(keyword))) {
    type = 'extend';
  } else if (modifyKeywords.some((keyword) => message.includes(keyword))) {
    type = 'modify';
  } else if (improveKeywords.some((keyword) => message.includes(keyword))) {
    type = 'improve';
  } else if (fixKeywords.some((keyword) => message.includes(keyword))) {
    type = 'fix';
  }

  // Determine target section
  if (conclusionKeywords.some((keyword) => message.includes(keyword))) {
    target = 'conclusion';
  } else if (introKeywords.some((keyword) => message.includes(keyword))) {
    target = 'introduction';
  } else if (
    message.includes('entire') ||
    message.includes('whole') ||
    message.includes('all')
  ) {
    target = 'entire_content';
  } else if (type) {
    target = 'specific_section';
  }

  if (type) {
    return {
      type,
      target,
      description: userMessage,
    };
  }

  return undefined;
}

export function shouldEditArtifact(
  userMessage: string,
  artifact?: UIArtifact,
): boolean {
  if (!artifact) return false;

  const editIntent = detectEditIntent(userMessage, artifact);
  return !!editIntent;
}

export function buildEnhancedPrompt(
  originalPrompt: string,
  artifactContext: ArtifactContext,
): string {
  const contextPrompt = buildArtifactContextPrompt(artifactContext);

  if (!contextPrompt) {
    return originalPrompt;
  }

  return `${originalPrompt}${contextPrompt}`;
}
