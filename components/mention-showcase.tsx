'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  FileText,
  BarChart,
  Target,
  Mountain,
  Users,
  Search,
  TrendingUp,
  HelpCircle,
  List,
  Clock,
  Command,
  Sparkles,
  Zap,
  Filter,
  History,
  Star,
  AtSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mention categories with examples
const mentionCategories = [
  {
    id: 'resource',
    name: 'Resources',
    icon: FileText,
    color: 'purple',
    description: 'Documents, files, and knowledge base items',
    examples: [
      {
        trigger: '@doc',
        name: 'Documents',
        description: 'Access your documents',
      },
      {
        trigger: '@scorecard',
        name: 'Scorecard',
        description: 'View EOS metrics',
      },
      {
        trigger: '@vto',
        name: 'V/TO',
        description: 'Vision/Traction Organizer',
      },
      { trigger: '@rocks', name: 'Rocks', description: 'Quarterly priorities' },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    color: 'blue',
    description: 'Events, meetings, and scheduling',
    examples: [
      { trigger: '@cal', name: 'Calendar', description: 'View your schedule' },
      {
        trigger: '@event:quarterly-review',
        name: 'Specific Event',
        description: 'Reference a specific event',
      },
      {
        trigger: '@free',
        name: 'Find Free Time',
        description: 'Search for available slots',
      },
      {
        trigger: '@meeting',
        name: 'Meetings',
        description: 'Access meeting information',
      },
    ],
  },
  {
    id: 'person',
    name: 'People',
    icon: Users,
    color: 'teal',
    description: 'Team members and contacts',
    examples: [
      {
        trigger: '@team',
        name: 'Team Members',
        description: 'Mention team members',
      },
      {
        trigger: '@user:john',
        name: 'Specific Person',
        description: 'Mention John directly',
      },
      {
        trigger: '@contact',
        name: 'Contacts',
        description: 'External contacts',
      },
    ],
  },
  {
    id: 'tool',
    name: 'AI Tools',
    icon: Zap,
    color: 'orange',
    description: 'AI capabilities and analysis',
    examples: [
      { trigger: '@search', name: 'Search', description: 'Search all content' },
      {
        trigger: '@analyze',
        name: 'Analyze',
        description: 'Get data insights',
      },
      {
        trigger: '@summarize',
        name: 'Summarize',
        description: 'Create summaries',
      },
      { trigger: '@create', name: 'Create', description: 'Generate content' },
    ],
  },
  {
    id: 'command',
    name: 'Commands',
    icon: Command,
    color: 'gray',
    description: 'Quick actions and system commands',
    examples: [
      { trigger: '@help', name: 'Help', description: 'Get help with mentions' },
      {
        trigger: '@recent',
        name: 'Recent',
        description: 'Show recent mentions',
      },
      {
        trigger: '@favorites',
        name: 'Favorites',
        description: 'Your favorite mentions',
      },
      {
        trigger: '@settings',
        name: 'Settings',
        description: 'Configure mentions',
      },
    ],
  },
  {
    id: 'template',
    name: 'Templates',
    icon: List,
    color: 'indigo',
    description: 'Message and document templates',
    examples: [
      {
        trigger: '@agenda',
        name: 'Meeting Agenda',
        description: 'Meeting template',
      },
      { trigger: '@report', name: 'Report', description: 'Report template' },
      { trigger: '@email', name: 'Email', description: 'Email template' },
    ],
  },
];

export function MentionShowcase() {
  const [selectedCategory, setSelectedCategory] = useState('resource');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentCategory = mentionCategories.find(
    (c) => c.id === selectedCategory,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5" />
            Enhanced @ Mentions System
          </CardTitle>
          <CardDescription>
            Powerful mentions with intelligent suggestions, contextual
            filtering, and dynamic content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Intelligent Suggestions</p>
                <p className="text-sm text-muted-foreground">
                  Context-aware recommendations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium">Smart Filtering</p>
                <p className="text-sm text-muted-foreground">
                  Category and type filters
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-medium">Dynamic Content</p>
                <p className="text-sm text-muted-foreground">
                  Real-time data integration
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Mention Categories</CardTitle>
          <CardDescription>
            Explore different types of mentions and their capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto">
              {mentionCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="flex flex-col gap-1 h-auto py-2"
                  >
                    <Icon
                      className={cn('h-4 w-4', `text-${category.color}-600`)}
                    />
                    <span className="text-xs">{category.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {mentionCategories.map((category) => (
              <TabsContent
                key={category.id}
                value={category.id}
                className="mt-6"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-1">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {category.examples.map((example) => (
                      <div
                        key={`${category.id}-${example.trigger}`}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <code
                            className={cn(
                              'px-2 py-1 rounded text-sm font-mono',
                              `bg-${category.color}-100 dark:bg-${category.color}-900/20`,
                              `text-${category.color}-700 dark:text-${category.color}-300`,
                            )}
                          >
                            {example.trigger}
                          </code>
                          <div>
                            <p className="font-medium text-sm">
                              {example.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {example.description}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {example.trigger.includes(':') ? 'Dynamic' : 'Static'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Advanced Features */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Features</CardTitle>
          <CardDescription>
            Powerful capabilities for power users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Mention History
              </h4>
              <p className="text-sm text-muted-foreground">
                Recently used mentions are tracked and prioritized in
                suggestions
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">@doc:project-plan</Badge>
                <Badge variant="secondary">@user:sarah</Badge>
                <Badge variant="secondary">@cal</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Star className="h-4 w-4" />
                Favorites
              </h4>
              <p className="text-sm text-muted-foreground">
                Pin frequently used mentions for quick access
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  @scorecard
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  @team:leadership
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Examples
            </Button>

            {showAdvanced && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-mono text-sm mb-2">
                    &ldquo;Schedule a meeting @cal with @user:john about the
                    @doc:q4-strategy next @free[duration:60] slot&rdquo;
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Multiple mentions work together to provide rich context
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-mono text-sm mb-2">
                    &ldquo;@analyze my @scorecard performance and @summarize key
                    insights&rdquo;
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Combine tool mentions for complex operations
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-mono text-sm mb-2">
                    &ldquo;@create @agenda for @event:quarterly-review with
                    @team:leadership&rdquo;
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chain mentions to create contextual content
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
          <CardDescription>
            Navigate mentions efficiently with keyboard shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Open mention menu</span>
              <kbd className="px-2 py-1 text-xs rounded bg-muted">@</kbd>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Navigate suggestions</span>
              <div className="flex gap-1">
                <kbd className="px-2 py-1 text-xs rounded bg-muted">↑</kbd>
                <kbd className="px-2 py-1 text-xs rounded bg-muted">↓</kbd>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Select mention</span>
              <kbd className="px-2 py-1 text-xs rounded bg-muted">Enter</kbd>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Switch categories</span>
              <kbd className="px-2 py-1 text-xs rounded bg-muted">Tab</kbd>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Close menu</span>
              <kbd className="px-2 py-1 text-xs rounded bg-muted">Esc</kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
