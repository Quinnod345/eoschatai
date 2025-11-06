'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, CopyIcon, ExternalLinkIcon } from '@/components/icons';
import { motion } from 'framer-motion';

interface Course {
  id: string;
  name: string;
  vectors: number;
  namespace: string;
}

const COURSES: Course[] = [
  { id: '782928', name: 'EOS A - Z', vectors: 264, namespace: 'circle-course-782928' },
  { id: '813417', name: 'EOS Implementer Community', vectors: 50, namespace: 'circle-course-813417' },
  { id: '815352', name: 'Biz Dev', vectors: 39, namespace: 'circle-course-815352' },
  { id: '815357', name: 'Practice Management', vectors: 40, namespace: 'circle-course-815357' },
  { id: '815361', name: 'Client Resources', vectors: 66, namespace: 'circle-course-815361' },
  { id: '815371', name: 'Path to Mastery', vectors: 39, namespace: 'circle-course-815371' },
  { id: '815739', name: 'Events', vectors: 24, namespace: 'circle-course-815739' },
  { id: '839429', name: 'Getting Started', vectors: 54, namespace: 'circle-course-839429' },
  { id: '850665', name: 'Franchise Advisory Council', vectors: 1, namespace: 'circle-course-850665' },
  { id: '879850', name: 'QCE Contributors Training', vectors: 1, namespace: 'circle-course-879850' },
  { id: '907974', name: 'Test', vectors: 3, namespace: 'circle-course-907974' },
];

export default function CircleCoursesAdminPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    // Get the current base URL
    setBaseUrl(window.location.origin);
  }, []);

  const getActivationLink = (courseId: string, audience: 'implementer' | 'client') => {
    return `${baseUrl}/api/circle/activate-course?courseId=${courseId}&audience=${audience}`;
  };

  const copyToClipboard = async (text: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const copyAllLinks = async (audience: 'implementer' | 'client') => {
    const links = COURSES.map(
      (course) => `${course.name}: ${getActivationLink(course.id, audience)}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(links);
      setCopiedLink(`all-${audience}`);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-eos-orange to-eos-orangeLight bg-clip-text text-transparent mb-2">
            Circle Course Activation Links
          </h1>
          <p className="text-muted-foreground">
            Manage and share activation links for all Circle.so course assistants
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-2xl font-bold text-foreground mb-1">
              {COURSES.length}
            </div>
            <div className="text-sm text-muted-foreground">Total Courses</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {COURSES.reduce((sum, c) => sum + c.vectors, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Vectors</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {COURSES.length * 2}
            </div>
            <div className="text-sm text-muted-foreground">Activation Links</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              100%
            </div>
            <div className="text-sm text-muted-foreground">Search Working</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => copyAllLinks('implementer')}
              variant="outline"
              className="flex items-center gap-2"
            >
              {copiedLink === 'all-implementer' ? (
                <>
                  <span className="text-green-500">
                    <CheckIcon size={16} />
                  </span>
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon size={16} />
                  Copy All Implementer Links
                </>
              )}
            </Button>
            <Button
              onClick={() => copyAllLinks('client')}
              variant="outline"
              className="flex items-center gap-2"
            >
              {copiedLink === 'all-client' ? (
                <>
                  <span className="text-green-500">
                    <CheckIcon size={16} />
                  </span>
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon size={16} />
                  Copy All Client Links
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Course List */}
        <div className="space-y-4">
          {COURSES.map((course, index) => {
            const implementerLink = getActivationLink(course.id, 'implementer');
            const clientLink = getActivationLink(course.id, 'client');
            const implementerLinkId = `impl-${course.id}`;
            const clientLinkId = `client-${course.id}`;

            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-6 hover:border-eos-orange/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      {course.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>Course ID: {course.id}</span>
                      <span>•</span>
                      <span>{course.vectors} vectors</span>
                      <span>•</span>
                      <span className="font-mono text-xs">{course.namespace}</span>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    ✅ Synced
                  </Badge>
                </div>

                {/* Implementer Link */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-eos-orange/10 text-eos-orange border-eos-orange/20 text-xs">
                      For Implementers
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/30 rounded-lg px-4 py-2.5 font-mono text-xs text-foreground overflow-x-auto">
                      {implementerLink}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(implementerLink, implementerLinkId)}
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      {copiedLink === implementerLinkId ? (
                        <>
                          <span className="text-green-500">
                            <CheckIcon size={14} />
                          </span>
                          Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon size={14} />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(implementerLink, '_blank')}
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      <ExternalLinkIcon size={14} />
                      Test
                    </Button>
                  </div>
                </div>

                {/* Client Link */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                      For Clients
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/30 rounded-lg px-4 py-2.5 font-mono text-xs text-foreground overflow-x-auto">
                      {clientLink}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(clientLink, clientLinkId)}
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      {copiedLink === clientLinkId ? (
                        <>
                          <span className="text-green-500">
                            <CheckIcon size={14} />
                          </span>
                          Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon size={14} />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(clientLink, '_blank')}
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      <ExternalLinkIcon size={14} />
                      Test
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-blue-600 mb-2">
            💡 How It Works
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Users click the activation link for their target audience</li>
            <li>• System queries Upstash RAG for course content (~1 sec)</li>
            <li>• GPT-4.1 generates personalized instructions (~3 sec)</li>
            <li>• User-specific persona is created (~1 sec)</li>
            <li>• User can immediately start chatting with the course assistant</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

