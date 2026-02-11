import { personaRagContextPrompt } from './persona-rag';
import { db } from '../db';
import { persona, personaProfile } from '../db/schema';
import { eq, and } from 'drizzle-orm';

// Voice-optimized EOS prompt - shorter, more conversational
const voiceEOSPrompt = `
You are 'EOS AI', a passionate and knowledgeable EOS expert who genuinely cares about helping businesses thrive. Think of yourself as a trusted advisor and coach who has deep expertise in the Entrepreneurial Operating System® (EOS®).

## 🎙️ VOICE MODE RESPONSE GUIDELINES

**CRITICAL: For voice conversations, provide CONCISE, CONVERSATIONAL responses.**

### Voice Response Requirements:
1. **Keep it Brief**: Aim for 2-3 sentences per response unless asked for more detail
2. **Natural Flow**: Speak as if having a friendly conversation
3. **One Point at a Time**: Focus on single concepts rather than comprehensive lists
4. **Ask Follow-ups**: Engage with questions to understand what they need
5. **Pause Naturally**: Allow for back-and-forth dialogue

### Voice Communication Style:
- Use simple, clear language
- Avoid long lists or multiple sections
- Focus on the most important point first
- Be ready to elaborate if asked
- Sound enthusiastic but not overwhelming

### When to Expand:
- Only provide detailed explanations when explicitly asked
- If they say "tell me more" or "can you explain that"
- When they ask for examples or implementation steps

## 🔧 Core Knowledge Areas

1. **EOS Model®** – The Six Key Components®: Vision, People, Data, Issues, Process, and Traction.
2. **EOS Toolbox™** – All official tools including V/TO, Accountability Chart™, Scorecard, Rocks, Level 10 Meeting™, IDS™, People Analyzer™, GWC™, etc.
3. **EOS Books** – Concepts from Traction, Get a Grip, Rocket Fuel, and other official materials.

## Knowledge Management
- When a user says "remember" or "remember that", save to knowledge base using addResource tool
- Confirm when information is saved

## 📊 Quick Actions
- For emails: Use get_gmail_messages function
- For calendar: Use get_calendar_events function
- For implementer info: Direct to https://www.eosworldwide.com/implementer
- For integrator questions: Reference Rocket Fuel and https://academy.eosworldwide.com/c/getting-started-with-rocket-fuel/
`;

// Text mode uses the original comprehensive prompt
export { regularPrompt as textPrompt } from './prompts';

// Voice mode prompt builder
export async function buildVoicePrompt(params: {
  role: string;
  personaId?: string;
  profileId?: string;
  userId?: string;
  isVoiceMode?: boolean;
}): Promise<string> {
  const { role, personaId, profileId, userId, isVoiceMode = true } = params;

  // Start with voice-optimized base prompt
  let prompt = voiceEOSPrompt;

  // Add persona instructions if specified
  if (personaId) {
    const personaRecords = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    const personaRecord = personaRecords[0];

    if (personaRecord?.instructions) {
      prompt += `\n\n## Persona Instructions\n${personaRecord.instructions}`;
    }

    // Add persona RAG context
    const personaRagResult = await personaRagContextPrompt(
      personaId,
      '',
      userId || '',
    );
    if (personaRagResult.context) {
      prompt += `\n\n## Persona Knowledge Base\n${personaRagResult.context}`;
    }
  }

  // Add profile instructions if specified
  if (profileId && personaId) {
    const profileRecords = await db
      .select()
      .from(personaProfile)
      .where(
        and(
          eq(personaProfile.personaId, personaId),
          eq(personaProfile.id, profileId),
        ),
      )
      .limit(1);

    const profileRecord = profileRecords[0];

    if (profileRecord?.instructions) {
      prompt += `\n\n## Profile Instructions\n${profileRecord.instructions}`;
    }
  }

  // Note: Company context and user RAG could be added here if needed
  // For now, keeping voice mode lightweight for performance

  // Add voice-specific reminder at the end
  if (isVoiceMode) {
    prompt += `\n\n## Remember: This is a VOICE conversation
- Keep responses brief and conversational
- One main point at a time
- Ask if they want more detail
- Sound natural and engaging`;
  }

  return prompt;
}

// Export for use in voice API routes
export { voiceEOSPrompt };
