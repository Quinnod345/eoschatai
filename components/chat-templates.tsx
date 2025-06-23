import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  Users,
  Target,
  BarChart3,
  Calendar,
  Lightbulb,
} from 'lucide-react';

const templates = [
  {
    id: 'l10-prep',
    title: 'L10 Meeting Prep',
    description: 'Prepare for your Level 10 meeting',
    prompt:
      'Help me prepare for our L10 meeting. I need to review our scorecard, discuss issues, and set priorities.',
    icon: Calendar,
    category: 'Meetings',
  },
  {
    id: 'scorecard-review',
    title: 'Scorecard Analysis',
    description: 'Review quarterly metrics',
    prompt:
      "Let's review our quarterly scorecard. Help me analyze our key metrics and identify areas for improvement.",
    icon: BarChart3,
    category: 'Analytics',
  },
  {
    id: 'accountability-chart',
    title: 'Accountability Chart',
    description: 'Create or update org chart',
    prompt:
      'I need help creating an accountability chart for our organization. Walk me through the process.',
    icon: Users,
    category: 'Structure',
  },
  {
    id: 'vision-traction',
    title: 'Vision/Traction Organizer',
    description: 'Work on company vision',
    prompt:
      'Help me work on our Vision/Traction Organizer. I want to clarify our core values and 10-year target.',
    icon: Target,
    category: 'Vision',
  },
  {
    id: 'process-documentation',
    title: 'Process Documentation',
    description: 'Document core processes',
    prompt:
      'I need to document one of our core processes. Guide me through creating clear, actionable process documentation.',
    icon: FileText,
    category: 'Processes',
  },
  {
    id: 'issue-solving',
    title: 'Issue Solving',
    description: 'Solve business issues',
    prompt:
      'I have a business issue that needs solving. Help me use the EOS Issue Solving Track to work through it.',
    icon: Lightbulb,
    category: 'Problem Solving',
  },
  {
    id: 'quarterly-planning',
    title: 'Quarterly Planning',
    description: 'Plan your next quarter',
    prompt:
      'Help me plan our next quarter. I need to set rocks, review priorities, and align the team.',
    icon: Calendar,
    category: 'Meetings',
  },
  {
    id: 'core-values',
    title: 'Core Values Workshop',
    description: 'Define company core values',
    prompt:
      "I want to work on defining our company's core values. Guide me through the process of identifying what truly matters to our organization.",
    icon: Target,
    category: 'Vision',
  },
  {
    id: 'people-analyzer',
    title: 'People Analyzer',
    description: 'Evaluate team members',
    prompt:
      'Help me use the People Analyzer tool to evaluate team members. I need to assess if people Get it, Want it, and have the Capacity.',
    icon: Users,
    category: 'Structure',
  },
];

interface ChatTemplatesProps {
  onSelectTemplate: (prompt: string) => void;
  className?: string;
}

export function ChatTemplates({
  onSelectTemplate,
  className,
}: ChatTemplatesProps) {
  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2 eos-gradient-text">
          EOS Conversation Starters
        </h3>
        <p className="text-muted-foreground text-sm">
          Choose a template to get started with common EOS tasks
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates
              .filter((template) => template.category === category)
              .map((template) => {
                const Icon = template.icon;
                return (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md hover:border-eos-orange/30 transition-all duration-200 group"
                    onClick={() => onSelectTemplate(template.prompt)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm group-hover:text-eos-orange transition-colors">
                        <Icon className="h-4 w-4 text-eos-orange" />
                        {template.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
