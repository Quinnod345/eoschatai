'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check } from 'lucide-react';

interface CoursePersona {
  id: string;
  personaId: string;
  courseName: string;
  targetAudience: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  instructions?: string;
}

export function CoursePersonasAdmin() {
  const [personas, setPersonas] = useState<CoursePersona[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCoursePersonas();
  }, []);

  const fetchCoursePersonas = async () => {
    try {
      setLoading(true);
      // Fetch all course personas with their instructions
      const response = await fetch('/api/circle/admin/personas');
      if (response.ok) {
        const data = await response.json();
        setPersonas(data.personas || []);
      }
    } catch (error) {
      console.error('Error fetching course personas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (instructions: string, id: string) => {
    navigator.clipboard.writeText(instructions);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No course personas created yet.</p>
        <p className="text-sm mt-2">
          Course personas are created when users click course assistant links.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-6">
        View AI-generated instructions for all Circle.so course assistants.
        These were created by GPT-4.1-mini based on actual course content.
      </p>

      <AnimatePresence>
        {personas.map((persona) => (
          <motion.div
            key={persona.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{persona.courseName}</CardTitle>
                    <CardDescription className="mt-1">
                      Target: {persona.targetAudience} • Status: {persona.syncStatus}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant={
                        persona.syncStatus === 'complete'
                          ? 'default'
                          : persona.syncStatus === 'syncing'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {persona.syncStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Persona ID: {persona.personaId.substring(0, 8)}...</span>
                    {persona.lastSyncedAt && (
                      <span>
                        • Synced: {new Date(persona.lastSyncedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpandedId(expandedId === persona.id ? null : persona.id)
                    }
                    className="w-full"
                  >
                    {expandedId === persona.id
                      ? 'Hide Instructions'
                      : 'View AI Instructions'}
                  </Button>

                  {expandedId === persona.id && persona.instructions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-muted/50 rounded-lg p-4 mt-3"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          AI-Generated Instructions ({persona.instructions.length}{' '}
                          chars)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy(persona.instructions!, persona.id)
                          }
                          className="h-7 px-2"
                        >
                          {copiedId === persona.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-mono text-foreground max-h-96 overflow-y-auto">
                        {persona.instructions}
                      </pre>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}



