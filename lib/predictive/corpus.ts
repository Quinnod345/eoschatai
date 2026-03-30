export interface CorpusPhrase {
  text: string;
  score: number;
}

export const AUTOCOMPLETE_CORPUS: CorpusPhrase[] = [
  // ═══════════════════════════════════════════════════════════════
  // "What is" / explainer questions
  // ═══════════════════════════════════════════════════════════════
  { text: 'What is EOS and how does it work?', score: 98 },
  { text: 'What is EOS Traction?', score: 95 },
  { text: 'What is the Entrepreneurial Operating System?', score: 93 },
  { text: 'What is a Level 10 meeting?', score: 92 },
  { text: 'What is a Level 10 meeting and how do I run one?', score: 91 },
  { text: 'What is a rock in EOS?', score: 90 },
  { text: 'What is a SMART rock?', score: 88 },
  { text: 'What is the difference between rocks and goals?', score: 87 },
  { text: 'What is the V/TO and why does it matter?', score: 85 },
  { text: 'What is the Vision/Traction Organizer?', score: 84 },
  { text: 'What is the IDS process?', score: 84 },
  { text: 'What is IDS and how does it solve issues?', score: 83 },
  { text: 'What is a scorecard in EOS?', score: 83 },
  { text: 'What is the EOS scorecard used for?', score: 82 },
  { text: 'What is the People Analyzer?', score: 80 },
  { text: 'What is the People Analyzer used for?', score: 79 },
  { text: 'What is the accountability chart?', score: 79 },
  { text: 'What is the accountability chart in EOS?', score: 78 },
  { text: 'What is the EOS Process?', score: 77 },
  { text: 'What is the EOS model?', score: 76 },
  { text: 'What is a quarterly conversation?', score: 72 },
  { text: 'What is a quarterly conversation in EOS?', score: 71 },
  { text: 'What is GWC in EOS?', score: 70 },
  { text: 'What is GWC and how do I use it?', score: 69 },
  { text: 'What is delegate and elevate?', score: 68 },
  { text: 'What is delegate and elevate in EOS?', score: 67 },
  { text: 'What is the EOS Six Key Components?', score: 66 },
  { text: 'What is the Integrator role in EOS?', score: 65 },
  { text: 'What is the Visionary role in EOS?', score: 64 },
  { text: 'What is the difference between Visionary and Integrator?', score: 63 },
  { text: 'What is core focus in the V/TO?', score: 62 },
  { text: 'What is a 10-year target?', score: 61 },
  { text: 'What is a 3-year picture in EOS?', score: 60 },
  { text: 'What is the 1-year plan in EOS?', score: 59 },
  { text: 'What is the EOS implementer role?', score: 58 },
  { text: 'What is the issue solving track?', score: 57 },
  { text: 'What is the meeting pulse in EOS?', score: 56 },
  { text: 'What is a healthy leadership team in EOS?', score: 55 },
  { text: 'What is the right structure for our organization?', score: 54 },
  { text: 'What are core values in EOS?', score: 53 },
  { text: 'What are the six key components of EOS?', score: 52 },
  { text: 'What are measurables in EOS?', score: 51 },
  { text: 'What are the roles of a leadership team in EOS?', score: 50 },

  // ═══════════════════════════════════════════════════════════════
  // "How do I" / "How does" / how-to questions
  // ═══════════════════════════════════════════════════════════════
  { text: 'How do I set better rocks for my team?', score: 88 },
  { text: 'How do I run a Level 10 meeting?', score: 87 },
  { text: 'How do I run a great Level 10 meeting?', score: 86 },
  { text: 'How do I use the IDS process to solve issues?', score: 85 },
  { text: 'How do I create a scorecard?', score: 82 },
  { text: 'How do I create a scorecard for my team?', score: 81 },
  { text: 'How do I build an accountability chart?', score: 80 },
  { text: 'How do I implement EOS in my company?', score: 79 },
  { text: 'How do I get started with EOS?', score: 78 },
  { text: 'How do I track rock progress?', score: 77 },
  { text: 'How do I track rock progress each week?', score: 76 },
  { text: 'How do I use the People Analyzer?', score: 75 },
  { text: 'How do I run a quarterly planning session?', score: 74 },
  { text: 'How do I delegate and elevate effectively?', score: 72 },
  { text: 'How do I identify the right people for the right seats?', score: 71 },
  { text: 'How do I improve our meeting pulse?', score: 70 },
  { text: 'How do I set a 10-year target?', score: 69 },
  { text: 'How do I define our core focus?', score: 68 },
  { text: 'How do I write a good rock?', score: 67 },
  { text: 'How do I evaluate someone using GWC?', score: 66 },
  { text: 'How do I hold my team accountable?', score: 65 },
  { text: 'How do I prepare for a quarterly conversation?', score: 64 },
  { text: 'How do I prioritize issues for IDS?', score: 63 },
  { text: 'How do I document our core processes?', score: 62 },
  { text: 'How do I simplify our processes?', score: 61 },
  { text: 'How do I coach someone who is not meeting expectations?', score: 60 },
  { text: 'How do I create an annual plan in EOS?', score: 59 },
  { text: 'How does the EOS model work?', score: 86 },
  { text: 'How does the V/TO help with long-term planning?', score: 73 },
  { text: 'How does EOS help with accountability?', score: 70 },
  { text: 'How does IDS work in practice?', score: 69 },
  { text: 'How does the scorecard improve performance?', score: 68 },
  { text: 'How does EOS handle conflict resolution?', score: 55 },

  // ═══════════════════════════════════════════════════════════════
  // Level 10 meetings — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'What are my Level 10 meeting headlines today?', score: 100 },
  { text: 'Show my Level 10 meeting agenda', score: 95 },
  { text: 'Summarize the issues list from our last Level 10', score: 90 },
  { text: 'Help me prepare for our Level 10 meeting', score: 88 },
  { text: 'What issues should we IDS this week?', score: 85 },
  { text: 'Review our Level 10 meeting to-dos', score: 82 },
  { text: 'What cascading messages came from leadership?', score: 78 },
  { text: 'Create a Level 10 meeting agenda from scratch', score: 76 },
  { text: 'What are the best practices for Level 10 meetings?', score: 74 },
  { text: 'Show me the segue checklist for our Level 10', score: 72 },
  { text: 'How long should each section of the Level 10 be?', score: 70 },
  { text: 'What should we report during headlines?', score: 68 },
  { text: 'Help me facilitate the IDS portion of our Level 10', score: 66 },
  { text: 'Rate our last Level 10 meeting', score: 64 },
  { text: 'What to-dos are overdue from our Level 10?', score: 62 },
  { text: 'Draft an email summary of our Level 10 meeting', score: 60 },

  // ═══════════════════════════════════════════════════════════════
  // Scorecards — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Show my EOS Scorecard metrics for this week', score: 95 },
  { text: 'What measurables are off track this week?', score: 90 },
  { text: 'Analyze scorecard trends over the last quarter', score: 82 },
  { text: 'Help me set better scorecard measurables', score: 78 },
  { text: 'Which scorecard items need my attention?', score: 76 },
  { text: 'Create a new scorecard for my department', score: 74 },
  { text: 'What should I measure on my scorecard?', score: 72 },
  { text: 'Show scorecard performance over the last 13 weeks', score: 70 },
  { text: 'Help me define leading indicators for my scorecard', score: 68 },
  { text: 'What is the difference between leading and lagging indicators?', score: 66 },
  { text: 'Compare my scorecard to last quarter', score: 64 },
  { text: 'Which measurables have been off track the most?', score: 62 },
  { text: 'Help me adjust my scorecard targets', score: 60 },
  { text: 'Show team scorecard results for this quarter', score: 58 },

  // ═══════════════════════════════════════════════════════════════
  // Rocks — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Show my rocks for this quarter', score: 93 },
  { text: 'Create a rock for increasing weekly qualified leads', score: 88 },
  { text: 'Which rocks are on track this quarter?', score: 85 },
  { text: 'Help me write a SMART rock', score: 83 },
  { text: 'What rocks need attention this week?', score: 80 },
  { text: 'Break down this rock into milestones', score: 77 },
  { text: 'Update my rock progress for this week', score: 75 },
  { text: 'Create a rock for improving customer retention', score: 73 },
  { text: 'Create a rock for launching a new product feature', score: 71 },
  { text: 'Create a rock for reducing employee turnover', score: 69 },
  { text: 'Create a rock for improving our onboarding process', score: 67 },
  { text: 'How many rocks should each person have?', score: 65 },
  { text: 'Show all company rocks for this quarter', score: 63 },
  { text: 'Show department rocks and their status', score: 61 },
  { text: 'Help me write a rock that is measurable and specific', score: 59 },
  { text: 'What makes a good rock in EOS?', score: 57 },
  { text: 'Review rock completion rate for the last four quarters', score: 55 },
  { text: 'Draft a rock review for our quarterly meeting', score: 53 },

  // ═══════════════════════════════════════════════════════════════
  // Quarterly planning — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Help me prepare for our EOS quarterly planning session', score: 90 },
  { text: 'Outline next steps for the EOS implementation roadmap', score: 80 },
  { text: 'What should we focus on next quarter?', score: 78 },
  { text: 'Review our quarterly goals and progress', score: 76 },
  { text: 'Create an agenda for our quarterly planning session', score: 74 },
  { text: 'What did we accomplish last quarter?', score: 72 },
  { text: 'Draft quarterly rocks based on our annual goals', score: 70 },
  { text: 'Help me set the right priorities for next quarter', score: 68 },
  { text: 'What lessons learned should we carry into next quarter?', score: 66 },
  { text: 'Review our one-year plan progress', score: 64 },
  { text: 'How do I align team rocks with company rocks?', score: 62 },
  { text: 'Prepare a quarterly state of the company update', score: 60 },

  // ═══════════════════════════════════════════════════════════════
  // Annual planning
  // ═══════════════════════════════════════════════════════════════
  { text: 'Help me prepare for our annual planning session', score: 78 },
  { text: 'Review our three year picture and update it', score: 72 },
  { text: 'What should our annual revenue target be?', score: 68 },
  { text: 'Draft our 1-year plan goals', score: 66 },
  { text: 'Analyze last year performance against our goals', score: 64 },
  { text: 'What are the biggest opportunities for next year?', score: 62 },
  { text: 'What are the biggest threats we face next year?', score: 60 },
  { text: 'Help me update our marketing strategy', score: 58 },
  { text: 'Create a SWOT analysis for our annual planning', score: 56 },

  // ═══════════════════════════════════════════════════════════════
  // VTO — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Review our V/TO core values', score: 75 },
  { text: 'Help me update our V/TO core focus', score: 73 },
  { text: 'What is our 10-year target?', score: 70 },
  { text: 'Review our three year picture', score: 68 },
  { text: 'Analyze our marketing strategy from the V/TO', score: 66 },
  { text: 'Does our team live our core values?', score: 64 },
  { text: 'Help me define our core values', score: 63 },
  { text: 'Help me write a compelling 10-year target', score: 62 },
  { text: 'What should be in our three year picture?', score: 61 },
  { text: 'Review our proven process', score: 60 },
  { text: 'Help me define our guarantee', score: 59 },
  { text: 'What is our unique value proposition?', score: 58 },
  { text: 'Show the complete V/TO for our company', score: 57 },
  { text: 'How often should we update the V/TO?', score: 56 },
  { text: 'Help me share the V/TO with the whole company', score: 55 },
  { text: 'What is our niche and target market?', score: 54 },

  // ═══════════════════════════════════════════════════════════════
  // Accountability chart — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Analyze accountability gaps from the People Analyzer', score: 75 },
  { text: 'Show the accountability chart for my team', score: 72 },
  { text: 'Help me review GWC for a team member', score: 68 },
  { text: 'Who owns this process in the accountability chart?', score: 65 },
  { text: 'Help me run a People Analyzer session', score: 63 },
  { text: 'Build an accountability chart for our organization', score: 62 },
  { text: 'Are we structured the right way?', score: 61 },
  { text: 'Who should sit in the Integrator seat?', score: 60 },
  { text: 'Who should sit in the Visionary seat?', score: 59 },
  { text: 'Do we have the right people in the right seats?', score: 58 },
  { text: 'Help me evaluate a team member with GWC', score: 57 },
  { text: 'What roles are missing from our accountability chart?', score: 56 },
  { text: 'Help me restructure our accountability chart', score: 55 },
  { text: 'Show reporting relationships in the accountability chart', score: 54 },
  { text: 'Help me have a difficult conversation about seat fit', score: 52 },

  // ═══════════════════════════════════════════════════════════════
  // IDS — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Draft a follow-up for the IDS topics we resolved', score: 80 },
  { text: 'Help me identify the root cause of this issue', score: 76 },
  { text: 'What are the top priority issues to solve?', score: 74 },
  { text: 'Walk me through the IDS process for this issue', score: 70 },
  { text: 'Add this to our issues list', score: 68 },
  { text: 'Show all open issues for our team', score: 66 },
  { text: 'Help me prioritize the issues list', score: 64 },
  { text: 'What issues have been on the list the longest?', score: 62 },
  { text: 'Identify the real issue behind this problem', score: 60 },
  { text: 'Discuss this issue and propose a solution', score: 58 },
  { text: 'Solve this issue and assign a to-do', score: 56 },
  { text: 'Move this issue to the long-term issues list', score: 54 },
  { text: 'Show issues we resolved this quarter', score: 52 },
  { text: 'Help me stay tangent-free during IDS', score: 50 },

  // ═══════════════════════════════════════════════════════════════
  // Process — actions & queries
  // ═══════════════════════════════════════════════════════════════
  { text: 'Help me document our core processes', score: 65 },
  { text: 'What processes need to be simplified?', score: 62 },
  { text: 'Create a process checklist for onboarding', score: 60 },
  { text: 'List our core processes and who owns each', score: 58 },
  { text: 'Help me simplify our sales process', score: 56 },
  { text: 'Help me simplify our hiring process', score: 54 },
  { text: 'Help me simplify our customer onboarding process', score: 52 },
  { text: 'Document our HR process from hire to retire', score: 50 },
  { text: 'Create a process for handling customer complaints', score: 48 },
  { text: 'What does followed by all mean for processes?', score: 46 },
  { text: 'How do I know if our processes are being followed?', score: 44 },
  { text: 'Help me create a training guide for a process', score: 42 },

  // ═══════════════════════════════════════════════════════════════
  // People — hiring, culture, team
  // ═══════════════════════════════════════════════════════════════
  { text: 'Help me write a job description aligned with our accountability chart', score: 60 },
  { text: 'How do I find the right person for this seat?', score: 58 },
  { text: 'Help me prepare for a quarterly conversation with a direct report', score: 56 },
  { text: 'How do I fire someone the EOS way?', score: 54 },
  { text: 'Help me give constructive feedback to a team member', score: 52 },
  { text: 'What does right people right seats mean?', score: 50 },
  { text: 'How do I build a strong leadership team?', score: 48 },
  { text: 'How do I improve team health?', score: 46 },
  { text: 'What are the five leadership abilities in EOS?', score: 44 },
  { text: 'Help me run a better quarterly conversation', score: 42 },
  { text: 'How do I handle someone who does not share our core values?', score: 40 },
  { text: 'Create an interview guide based on our core values', score: 38 },

  // ═══════════════════════════════════════════════════════════════
  // Traction / execution
  // ═══════════════════════════════════════════════════════════════
  { text: 'How do I get more traction in my business?', score: 62 },
  { text: 'What does traction mean in EOS?', score: 60 },
  { text: 'Help me improve our execution cadence', score: 58 },
  { text: 'What is the 90-day world in EOS?', score: 56 },
  { text: 'How do I keep my team focused on quarterly priorities?', score: 54 },
  { text: 'Show our traction metrics over the last year', score: 52 },
  { text: 'Help me create a weekly to-do list from our rocks', score: 50 },
  { text: 'Are we on track to hit our annual goals?', score: 48 },
  { text: 'What is the difference between rocks and to-dos?', score: 46 },

  // ═══════════════════════════════════════════════════════════════
  // Data / analytics
  // ═══════════════════════════════════════════════════════════════
  { text: 'Show me a dashboard of our EOS metrics', score: 65 },
  { text: 'What are our key performance indicators?', score: 62 },
  { text: 'Show revenue trends for the last four quarters', score: 58 },
  { text: 'Compare this quarter scorecard to last quarter', score: 56 },
  { text: 'What patterns do you see in our scorecard data?', score: 54 },
  { text: 'Which metrics improved the most this quarter?', score: 52 },
  { text: 'Which metrics declined the most this quarter?', score: 50 },
  { text: 'Create a chart of rock completion rates over time', score: 48 },
  { text: 'Show meeting rating trends for our Level 10', score: 46 },

  // ═══════════════════════════════════════════════════════════════
  // Communication / emails / writing
  // ═══════════════════════════════════════════════════════════════
  { text: 'Draft a meeting summary email', score: 65 },
  { text: 'Draft an email to my team about our quarterly goals', score: 62 },
  { text: 'Draft a state of the company message', score: 60 },
  { text: 'Help me write a weekly update for my team', score: 58 },
  { text: 'Draft cascading messages from our leadership meeting', score: 56 },
  { text: 'Write an announcement about our new rocks', score: 54 },
  { text: 'Draft a recap of our annual planning session', score: 52 },
  { text: 'Help me communicate a difficult decision to the team', score: 50 },
  { text: 'Write a note to celebrate a rock completion', score: 48 },
  { text: 'Draft an onboarding email for a new team member', score: 46 },

  // ═══════════════════════════════════════════════════════════════
  // Calendar / scheduling
  // ═══════════════════════════════════════════════════════════════
  { text: 'Find available time for a leadership meeting next week', score: 68 },
  { text: 'Schedule our next quarterly planning session', score: 64 },
  { text: 'When is our next Level 10 meeting?', score: 62 },
  { text: 'Block time for rock work this week', score: 58 },
  { text: 'Find time for a quarterly conversation with my direct report', score: 56 },
  { text: 'Schedule a People Analyzer session for next week', score: 54 },

  // ═══════════════════════════════════════════════════════════════
  // General actions & productivity
  // ═══════════════════════════════════════════════════════════════
  { text: 'Create action items from our last meeting', score: 63 },
  { text: 'Help me delegate and elevate my tasks', score: 60 },
  { text: 'Summarize the key decisions from today', score: 58 },
  { text: 'Help me run a better meeting', score: 55 },
  { text: 'What should I prepare for tomorrow?', score: 53 },
  { text: 'Create a quarterly conversation template', score: 48 },
  { text: 'Help me give better feedback to my team', score: 45 },
  { text: 'Compare our performance to last quarter', score: 43 },
  { text: 'What are my most important to-dos this week?', score: 42 },
  { text: 'Help me prioritize my tasks for today', score: 40 },
  { text: 'What is on my plate right now?', score: 38 },
  { text: 'Help me say no to things that are not priorities', score: 36 },

  // ═══════════════════════════════════════════════════════════════
  // EOS implementation / rollout
  // ═══════════════════════════════════════════════════════════════
  { text: 'How do I roll out EOS to the whole company?', score: 65 },
  { text: 'What is the EOS implementation timeline?', score: 63 },
  { text: 'How long does it take to fully implement EOS?', score: 61 },
  { text: 'What should we do in our first EOS session?', score: 59 },
  { text: 'How do I get buy-in from my leadership team for EOS?', score: 57 },
  { text: 'What are the most common EOS implementation mistakes?', score: 55 },
  { text: 'How do I find an EOS implementer?', score: 53 },
  { text: 'Should we self-implement EOS or hire an implementer?', score: 51 },
  { text: 'What books should I read to learn EOS?', score: 49 },
  { text: 'What is the EOS Focus Day?', score: 47 },
  { text: 'What is a Vision Building Day?', score: 45 },
  { text: 'Help me plan our EOS rollout to department heads', score: 43 },

  // ═══════════════════════════════════════════════════════════════
  // "Explain" / "Tell me about" patterns
  // ═══════════════════════════════════════════════════════════════
  { text: 'Explain the six key components of EOS', score: 70 },
  { text: 'Explain how rocks work in EOS', score: 68 },
  { text: 'Explain the IDS process step by step', score: 66 },
  { text: 'Explain the difference between Visionary and Integrator', score: 64 },
  { text: 'Explain the V/TO to someone new to EOS', score: 62 },
  { text: 'Explain the Level 10 meeting format', score: 60 },
  { text: 'Explain delegate and elevate to my team', score: 58 },
  { text: 'Explain core values and why they matter', score: 56 },
  { text: 'Tell me about the EOS accountability chart', score: 54 },
  { text: 'Tell me about the EOS scorecard', score: 52 },
  { text: 'Tell me about the quarterly planning process', score: 50 },

  // ═══════════════════════════════════════════════════════════════
  // "Can you" / "Could you" patterns
  // ═══════════════════════════════════════════════════════════════
  { text: 'Can you help me prepare for my Level 10 meeting?', score: 72 },
  { text: 'Can you review my rocks and give feedback?', score: 70 },
  { text: 'Can you summarize our last meeting?', score: 68 },
  { text: 'Can you create a scorecard template for me?', score: 66 },
  { text: 'Can you help me write better rocks?', score: 64 },
  { text: 'Can you explain the IDS process?', score: 62 },
  { text: 'Can you help me with our accountability chart?', score: 60 },
  { text: 'Can you draft an email about our quarterly goals?', score: 58 },
  { text: 'Could you analyze our scorecard trends?', score: 56 },
  { text: 'Could you help me prioritize our issues list?', score: 54 },

  // ═══════════════════════════════════════════════════════════════
  // "Show me" / "List" / "Give me" patterns
  // ═══════════════════════════════════════════════════════════════
  { text: 'Show me all my rocks and their status', score: 75 },
  { text: 'Show me the issues list for our team', score: 72 },
  { text: 'Show me our V/TO', score: 70 },
  { text: 'Show me our accountability chart', score: 68 },
  { text: 'Show me overdue to-dos from the Level 10', score: 66 },
  { text: 'Show me scorecard data for the last 13 weeks', score: 64 },
  { text: 'List all open issues sorted by priority', score: 62 },
  { text: 'List our core values', score: 60 },
  { text: 'List our core processes', score: 58 },
  { text: 'Give me a summary of this quarter progress', score: 56 },
  { text: 'Give me a template for a quarterly conversation', score: 54 },
  { text: 'Give me tips for running a better Level 10 meeting', score: 52 },

  // ═══════════════════════════════════════════════════════════════
  // "Help me" extended patterns
  // ═══════════════════════════════════════════════════════════════
  { text: 'Help me write a rock for improving team communication', score: 65 },
  { text: 'Help me solve a people issue on my team', score: 63 },
  { text: 'Help me set up a scorecard for the first time', score: 61 },
  { text: 'Help me structure our first Level 10 meeting', score: 59 },
  { text: 'Help me build a V/TO from scratch', score: 57 },
  { text: 'Help me create an issues list for our next Level 10', score: 55 },
  { text: 'Help me define the five major roles on our team', score: 53 },
  { text: 'Help me figure out if someone is in the right seat', score: 51 },
  { text: 'Help me improve our rock completion rate', score: 49 },
  { text: 'Help me get my team more engaged in the EOS process', score: 47 },
  { text: 'Help me onboard a new leadership team member to EOS', score: 45 },
  { text: 'Help me create a 90-day onboarding plan', score: 43 },
];
