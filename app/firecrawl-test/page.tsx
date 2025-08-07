'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Link, FileText, Code } from 'lucide-react';

export default function FirecrawlTestPage() {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState('10');
  const [formats, setFormats] = useState(['markdown']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/firecrawl-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: Number.parseInt(limit),
          formats,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleFormat = (format: string) => {
    setFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format],
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Firecrawl Search Test</h1>
          <p className="text-muted-foreground">
            Test Firecrawl&apos;s search API directly
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query">Search Query</Label>
              <Input
                id="query"
                placeholder="e.g., How to implement EOS in business"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit">Result Limit</Label>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger id="limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 results</SelectItem>
                    <SelectItem value="10">10 results</SelectItem>
                    <SelectItem value="15">15 results</SelectItem>
                    <SelectItem value="20">20 results</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Output Formats</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      formats.includes('markdown') ? 'default' : 'outline'
                    }
                    onClick={() => toggleFormat('markdown')}
                  >
                    Markdown
                  </Button>
                  <Button
                    size="sm"
                    variant={formats.includes('html') ? 'default' : 'outline'}
                    onClick={() => toggleFormat('html')}
                  >
                    HTML
                  </Button>
                  <Button
                    size="sm"
                    variant={formats.includes('links') ? 'default' : 'outline'}
                    onClick={() => toggleFormat('links')}
                  >
                    Links
                  </Button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Search Results</span>
                <div className="flex gap-2 text-sm">
                  <Badge variant="secondary">
                    {results.resultsCount} results
                  </Badge>
                  <Badge variant="secondary">{results.duration}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="formatted" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="formatted">Formatted</TabsTrigger>
                  <TabsTrigger value="raw">Raw Response</TabsTrigger>
                  <TabsTrigger value="api">API Info</TabsTrigger>
                </TabsList>

                <TabsContent value="formatted" className="space-y-4">
                  {results.results.map((result: any) => (
                    <Card key={result.index}>
                      <CardHeader>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Badge>{result.index}</Badge>
                            {result.title}
                          </h3>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Link className="h-3 w-3" />
                            {result.url}
                          </a>
                          {result.description && (
                            <p className="text-sm text-muted-foreground">
                              {result.description}
                            </p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Tabs defaultValue="markdown" className="w-full">
                          <TabsList>
                            {result.content.markdown && (
                              <TabsTrigger value="markdown">
                                <FileText className="h-4 w-4 mr-1" />
                                Markdown
                              </TabsTrigger>
                            )}
                            {result.content.html && (
                              <TabsTrigger value="html">
                                <Code className="h-4 w-4 mr-1" />
                                HTML
                              </TabsTrigger>
                            )}
                            <TabsTrigger value="metadata">Metadata</TabsTrigger>
                          </TabsList>
                          {result.content.markdown && (
                            <TabsContent value="markdown">
                              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                                {result.content.markdown}
                              </pre>
                            </TabsContent>
                          )}
                          {result.content.html && (
                            <TabsContent value="html">
                              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                                {result.content.html}
                              </pre>
                            </TabsContent>
                          )}
                          <TabsContent value="metadata">
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                              {JSON.stringify(result.metadata, null, 2)}
                            </pre>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="raw">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    {JSON.stringify(results.raw, null, 2)}
                  </pre>
                </TabsContent>

                <TabsContent value="api" className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">API Request</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                      {`POST /api/firecrawl-test
Content-Type: application/json

{
  "query": "${query}",
  "limit": ${limit},
  "formats": ${JSON.stringify(formats)}
}`}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">cURL Command</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                      {`curl -X POST http://localhost:3000/api/firecrawl-test \\
  -H 'Content-Type: application/json' \\
  -d '{
    "query": "${query}",
    "limit": ${limit},
    "formats": ${JSON.stringify(formats)}
  }'`}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
