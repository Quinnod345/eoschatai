'use client';

import { useState, useEffect } from 'react';
import { safeCreateURL } from '@/lib/client-utils/url-utils';

export default function CalendarDebug() {
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Use useEffect to indicate we're now on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const testEndpoint = async (endpoint: string) => {
    setLoading(true);
    setError(null);
    try {
      // Use window.fetch directly to ensure client-side execution
      const response = await window.fetch(endpoint);

      // Log response status and headers
      console.log('Response status:', response.status);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      if (response.status === 401) {
        setError('Authentication required. Please login first.');
        setResults({ status: response.status, unauthorized: true });
        return;
      }

      // Try to parse as JSON, fall back to text
      let data: Record<string, any>;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        // If it's not JSON, get the text
        const text = await response.text();
        data = {
          contentType,
          textContent:
            text.substring(0, 1000) + (text.length > 1000 ? '...' : ''),
          isHTML:
            contentType?.includes('text/html') ||
            text.trim().startsWith('<!DOCTYPE') ||
            text.trim().startsWith('<html'),
          length: text.length,
        };
      }

      setResults({
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      });
    } catch (err) {
      console.error('Error testing endpoint:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const runCalendarTest = () => testEndpoint('/api/test-calendar');
  const runStatusDebug = () => testEndpoint('/api/calendar/status/debug');
  const runStatusTest = () => testEndpoint('/api/calendar/status');
  const runEventsTest = () => testEndpoint('/api/calendar/events');

  const testWithBaseUrl = () => {
    try {
      // Generate a URL using safeCreateURL
      const url = safeCreateURL('/api/calendar/status').toString();
      console.log('Generated URL:', url);
      testEndpoint(url);
    } catch (err) {
      console.error('Error creating URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to create URL');
    }
  };

  // If we're not on the client yet, return a minimal UI to prevent hydration mismatch
  if (!isClient) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Calendar API Debugging</h1>
        <div className="p-4 border border-gray-300 rounded mb-4">
          Loading debug interface...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Calendar API Debugging</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={runCalendarTest}
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={loading}
          type="button"
        >
          Test Calendar Connection
        </button>

        <button
          onClick={runStatusDebug}
          className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
          disabled={loading}
          type="button"
        >
          Debug Status Endpoint
        </button>

        <button
          onClick={runStatusTest}
          className="p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          disabled={loading}
          type="button"
        >
          Test Status Endpoint
        </button>

        <button
          onClick={runEventsTest}
          className="p-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          disabled={loading}
          type="button"
        >
          Test Events Endpoint
        </button>

        <button
          onClick={testWithBaseUrl}
          className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
          disabled={loading}
          title="Test with safeCreateURL function"
          type="button"
        >
          Test URL Creation
        </button>
      </div>

      {loading && (
        <div className="p-4 border border-gray-300 rounded mb-4">
          Loading...
        </div>
      )}

      {error && (
        <div className="p-4 border border-red-500 bg-red-50 rounded mb-4">
          <h2 className="text-lg font-semibold text-red-700">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {results && (
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="text-lg font-semibold mb-2">
            Response (Status: {results.status})
          </h2>

          {results.data?.isHTML ? (
            <div>
              <p className="mb-2">
                Received HTML response ({results.data.length} bytes)
              </p>
              <div className="bg-gray-100 p-2 rounded overflow-auto max-h-96">
                <pre className="text-sm whitespace-pre-wrap">
                  {results.data.textContent}
                </pre>
              </div>
            </div>
          ) : (
            <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-96 text-sm">
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <h2 className="font-semibold">Debugging Environment</h2>
        <ul className="list-disc pl-5 mt-2">
          <li>Location: {window.location.href}</li>
          <li>User Agent: {window.navigator.userAgent}</li>
        </ul>
      </div>
    </div>
  );
}
