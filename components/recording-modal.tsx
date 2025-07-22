'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Mic,
  Square,
  Wand2,
  PlayCircle,
  Clock,
  Users,
  Trash2,
  Download,
  FileAudio,
  Calendar,
  Plus,
  Pause,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Markdown } from './markdown';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string;
  selectedRecordingId?: string;
}

type SavedRecording = {
  id: string;
  createdAt: number;
  audioUrl: string;
  transcript: string;
  speakers: number;
  segments?: any[];
  duration?: number;
  summary?: string;
  diarizationMethod?: string;
};

type RecordingMode = 'idle' | 'recording' | 'paused' | 'completed';

export default function RecordingModal({
  isOpen,
  onClose,
  chatId,
  selectedRecordingId,
}: RecordingModalProps) {
  const [activeTab, setActiveTab] = useState<
    'record' | 'details' | 'transcript'
  >('record');
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('idle');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSendingToChat, setIsSendingToChat] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [selectedRecording, setSelectedRecording] =
    useState<SavedRecording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isNewRecording, setIsNewRecording] = useState(false);
  const [summary, setSummary] = useState<string>('');

  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const router = useRouter();

  const selectRecording = useCallback((rec: SavedRecording) => {
    setSelectedRecording(rec);
    setAnalysisResult({
      id: rec.id,
      transcript: rec.transcript,
      segments:
        rec.segments ||
        rec.transcript.split('\n').map((t: string, i: number) => ({
          speaker: (i % rec.speakers) + 1,
          text: t,
        })),
      speakers: rec.speakers,
      diarizationMethod: rec.diarizationMethod,
    });
    setAudioUrl(rec.audioUrl);
    setSummary(rec.summary || '');
    setIsNewRecording(false);
    setActiveTab('details');
  }, []);

  // Load saved recordings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('voiceRecordings');
    if (stored) {
      try {
        const parsedRecordings = JSON.parse(stored);
        setRecordings(parsedRecordings);

        // Auto-select recording if selectedRecordingId is provided
        if (selectedRecordingId) {
          const recordingToSelect = parsedRecordings.find(
            (rec: SavedRecording) => rec.id === selectedRecordingId,
          );
          if (recordingToSelect) {
            selectRecording(recordingToSelect);
          }
        }
      } catch (_) {
        /* ignore */
      }
    }
  }, [selectedRecordingId, selectRecording]);

  const saveRecordingLocally = (rec: SavedRecording) => {
    const updated = [rec, ...recordings.filter((r) => r.id !== rec.id)];
    setRecordings(updated);
    localStorage.setItem('voiceRecordings', JSON.stringify(updated));
  };

  const deleteRecording = (id: string) => {
    const updated = recordings.filter((r) => r.id !== id);
    setRecordings(updated);
    localStorage.setItem('voiceRecordings', JSON.stringify(updated));
    if (selectedRecording?.id === id) {
      setSelectedRecording(null);
      setAnalysisResult(null);
      setAudioUrl(null);
      setSummary('');
      setActiveTab('record');
    }
  };

  const startNewRecording = () => {
    // Reset state for new recording
    setSelectedRecording(null);
    setAnalysisResult(null);
    setAudioUrl(null);
    setSummary('');
    setRecordingMode('idle');
    setIsNewRecording(true);
    setActiveTab('record');
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingMode('completed');
      };

      recorder.start(100); // Get data every 100ms for better pause/resume
      setMediaRecorder(recorder);
      setRecordingMode('recording');

      // Start duration tracking
      recordingStartTimeRef.current = Date.now() - pausedDurationRef.current;
      durationIntervalRef.current = setInterval(() => {
        if (recordingMode !== 'paused') {
          setRecordingDuration(
            Math.floor((Date.now() - recordingStartTimeRef.current) / 1000),
          );
        }
      }, 100);
    } catch (err: any) {
      toast.error('Failed to access microphone');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setRecordingMode('paused');
      pausedDurationRef.current = recordingDuration * 1000;
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setRecordingMode('recording');
      recordingStartTimeRef.current = Date.now() - pausedDurationRef.current;
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(
          Math.floor((Date.now() - recordingStartTimeRef.current) / 1000),
        );
      }, 100);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setMediaRecorder(null);
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    // Reset pause duration for next recording
    pausedDurationRef.current = 0;
  };

  const saveAndAnalyze = async () => {
    if (!audioUrl) return;

    setIsAnalyzing(true);
    const blob = await fetch(audioUrl).then((r) => r.blob());
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');

    try {
      const res = await fetch('/api/voice/recordings/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();

      // Generate summary
      setIsGeneratingSummary(true);
      try {
        const summaryRes = await fetch(
          '/api/voice/recordings/generate-summary',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: data.transcript,
              speakers: data.speakers,
              segments: data.segments,
            }),
          },
        );

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData.summary);
          data.summary = summaryData.summary;
        }
      } catch (err) {
        console.error('Failed to generate summary:', err);
      } finally {
        setIsGeneratingSummary(false);
      }

      setAnalysisResult(data);

      // Save recording with all data
      const newRecording = {
        id: data.id,
        createdAt: Date.now(),
        audioUrl: audioUrl,
        transcript: data.transcript,
        speakers: data.speakers,
        segments: data.segments,
        duration: recordingDuration,
        summary: data.summary || '',
        diarizationMethod: data.diarizationMethod,
      };
      saveRecordingLocally(newRecording);
      setSelectedRecording(newRecording);
      setIsNewRecording(false);
      setActiveTab('details');

      toast.success('Recording saved and analyzed');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendToChat = async () => {
    if (!analysisResult) return;
    setIsSendingToChat(true);

    try {
      // Format the message content
      let formattedTranscript = `Please analyze this ${analysisResult.speakers}-speaker meeting transcript:\n\n`;

      // Add summary if available
      if (summary) {
        formattedTranscript += `Meeting Summary:\n${summary}\n\n---\n\nFull Transcript:\n\n`;
      }

      if (analysisResult.segments && analysisResult.segments.length > 0) {
        analysisResult.segments.forEach((seg: any) => {
          formattedTranscript += `Speaker ${seg.speaker}: ${seg.text}\n\n`;
        });
      } else {
        formattedTranscript += analysisResult.transcript;
      }

      formattedTranscript += `\n\nProvide a comprehensive analysis including:
1. Key topics discussed
2. Action items mentioned
3. Decisions made
4. Important insights or concerns raised
5. Follow-up recommendations`;

      // Store the message data in sessionStorage for the chat page to pick up
      const messageData = {
        content: formattedTranscript,
        isRecording: true,
        shouldAutoSend: true, // Flag to indicate this should be sent automatically
        meetingMetadata: {
          speakers: analysisResult.speakers,
          summary: summary || null,
          duration: selectedRecording?.duration || null,
          createdAt: selectedRecording?.createdAt || Date.now(),
        },
      };
      sessionStorage.setItem(
        'pendingRecordingMessage',
        JSON.stringify(messageData),
      );

      // Close the modal
      onClose();

      // Navigate to the main chat page (not a specific chat ID)
      // This follows the same pattern as creating a new chat
      router.push('/chat');

      toast.success('Opening chat with analysis...');
    } catch (err: any) {
      console.error('Error sending to chat:', err);
      toast.error(err.message || 'Failed to create chat');
    } finally {
      setIsSendingToChat(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine which tabs to show
  const showRecordTab =
    isNewRecording || (!selectedRecording && !analysisResult);
  const showDetailsTabs = selectedRecording || analysisResult;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-7xl h-[95vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl">Voice Recordings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="w-80 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Recordings</h3>
                    <p className="text-xs text-muted-foreground">
                      {recordings.length} saved
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={startNewRecording}
                className="w-full gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                New Recording
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {recordings.length === 0 ? (
                <div className="p-6 text-center">
                  <FileAudio className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No recordings yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "New Recording" to start
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {recordings.map((rec) => (
                    <div
                      key={rec.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent',
                        selectedRecording?.id === rec.id &&
                          'bg-accent border-primary',
                      )}
                      onClick={() => selectRecording(rec)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {new Date(rec.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(rec.createdAt).toLocaleTimeString(
                              'en-US',
                              {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              },
                            )}
                            {rec.duration &&
                              ` • ${formatDuration(rec.duration)}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRecording(rec.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {rec.speakers}
                        </Badge>
                        {rec.summary && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0"
                          >
                            Summary
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b flex-shrink-0">
                <TabsList className="w-fit">
                  {showRecordTab && (
                    <TabsTrigger value="record" className="gap-2">
                      <Mic className="h-4 w-4" />
                      Record
                    </TabsTrigger>
                  )}
                  {showDetailsTabs && (
                    <>
                      <TabsTrigger value="details" className="gap-2">
                        <PlayCircle className="h-4 w-4" />
                        Details
                      </TabsTrigger>
                      <TabsTrigger value="transcript" className="gap-2">
                        <FileAudio className="h-4 w-4" />
                        Transcript
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
              </div>

              {/* Record Tab */}
              {showRecordTab && (
                <TabsContent
                  value="record"
                  className="flex-1 flex items-center justify-center p-6"
                >
                  <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                      <CardTitle>Voice Recording</CardTitle>
                      <CardDescription>
                        Record your meeting with pause/resume support
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {audioUrl && recordingMode === 'completed' && (
                        <div className="bg-muted rounded-lg p-4">
                          <audio controls src={audioUrl} className="w-full" />
                        </div>
                      )}

                      {(recordingMode === 'recording' ||
                        recordingMode === 'paused') && (
                        <div className="text-center py-6">
                          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4">
                            <div
                              className={cn(
                                'w-12 h-12 rounded-full bg-red-500',
                                recordingMode === 'recording' &&
                                  'animate-pulse',
                              )}
                            />
                          </div>
                          <div className="text-3xl font-mono font-bold text-red-600">
                            {formatDuration(recordingDuration)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {recordingMode === 'recording'
                              ? 'Recording...'
                              : 'Paused'}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-center gap-3">
                        {recordingMode === 'idle' && (
                          <Button
                            onClick={startRecording}
                            size="lg"
                            className="gap-2 px-8"
                          >
                            <Mic className="h-5 w-5" />
                            Start Recording
                          </Button>
                        )}

                        {recordingMode === 'recording' && (
                          <>
                            <Button
                              onClick={pauseRecording}
                              size="lg"
                              variant="outline"
                              className="gap-2"
                            >
                              <Pause className="h-5 w-5" />
                              Pause
                            </Button>
                            <Button
                              onClick={stopRecording}
                              size="lg"
                              variant="destructive"
                              className="gap-2"
                            >
                              <Square className="h-5 w-5" />
                              Stop
                            </Button>
                          </>
                        )}

                        {recordingMode === 'paused' && (
                          <>
                            <Button
                              onClick={resumeRecording}
                              size="lg"
                              className="gap-2"
                            >
                              <Play className="h-5 w-5" />
                              Resume
                            </Button>
                            <Button
                              onClick={stopRecording}
                              size="lg"
                              variant="destructive"
                              className="gap-2"
                            >
                              <Square className="h-5 w-5" />
                              Stop
                            </Button>
                          </>
                        )}

                        {recordingMode === 'completed' && (
                          <Button
                            onClick={saveAndAnalyze}
                            disabled={isAnalyzing || isGeneratingSummary}
                            size="lg"
                            className="gap-2 px-8"
                          >
                            {isAnalyzing || isGeneratingSummary ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Wand2 className="h-5 w-5" />
                            )}
                            Save & Analyze
                          </Button>
                        )}
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                          <Wand2 className="h-4 w-4" />
                          Recording Tips
                        </h4>
                        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                          <li>
                            • Pause and resume without creating multiple
                            recordings
                          </li>
                          <li>
                            • Each speaker should speak clearly for better
                            detection
                          </li>
                          <li>
                            • Minimize background noise for accurate
                            transcription
                          </li>
                          <li>
                            • AI will generate a meeting summary automatically
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Details Tab */}
              {showDetailsTabs && (
                <TabsContent value="details" className="flex-1 overflow-hidden">
                  {selectedRecording && (
                    <div className="h-full flex flex-col p-6">
                      {/* Fixed Header Section */}
                      <div className="flex-shrink-0 space-y-4 pb-6">
                        <div className="bg-muted rounded-lg p-4">
                          <audio
                            controls
                            src={audioUrl || undefined}
                            className="w-full"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                            <Calendar className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium">Date & Time</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  selectedRecording.createdAt,
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                            <Clock className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium">Duration</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedRecording.duration
                                  ? formatDuration(selectedRecording.duration)
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                            <Users className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium">Speakers</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedRecording.speakers} detected
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Summary Section */}
                      {summary && (
                        <div className="flex-1 min-h-0 flex flex-col pb-6">
                          <h3 className="text-xl font-semibold mb-4">
                            Meeting Summary
                          </h3>
                          <div className="flex-1 min-h-0 rounded-lg border bg-background">
                            <ScrollArea className="h-full">
                              <div className="p-6">
                                <div className="prose dark:prose-invert max-w-none prose-base">
                                  <Markdown>{summary}</Markdown>
                                </div>
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      )}

                      {/* Fixed Footer Section */}
                      <div className="flex-shrink-0 pt-4 border-t">
                        <div className="flex gap-3">
                          <Button
                            onClick={handleSendToChat}
                            className="gap-2 flex-1"
                            disabled={isSendingToChat}
                            size="lg"
                          >
                            {isSendingToChat ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Wand2 className="h-5 w-5" />
                            )}
                            Analyze with EOS AI
                          </Button>

                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                              const content = summary
                                ? `SUMMARY:\n${summary}\n\nTRANSCRIPT:\n${selectedRecording.transcript}`
                                : selectedRecording.transcript;
                              const blob = new Blob([content], {
                                type: 'text/plain',
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `recording-${new Date(selectedRecording.createdAt).toISOString()}.txt`;
                              a.click();
                            }}
                            className="gap-2"
                          >
                            <Download className="h-5 w-5" />
                            Export
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Transcript Tab */}
              {showDetailsTabs && (
                <TabsContent
                  value="transcript"
                  className="flex-1 overflow-hidden"
                >
                  {analysisResult && (
                    <div className="h-full flex flex-col p-6">
                      <div className="flex-shrink-0 mb-6">
                        <h3 className="text-xl font-semibold">
                          Full Transcript
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {analysisResult.speakers} speaker
                          {analysisResult.speakers !== 1 ? 's' : ''} •
                          Detection:{' '}
                          {analysisResult.diarizationMethod === 'assemblyai'
                            ? 'Advanced'
                            : 'Basic'}
                        </p>
                      </div>

                      <div className="flex-1 min-h-0 rounded-lg border bg-background">
                        <ScrollArea className="h-full">
                          <div className="p-6 space-y-6">
                            {analysisResult.segments.map(
                              (seg: any, idx: number) => (
                                <div
                                  key={`${seg.speaker}-${idx}`}
                                  className="flex gap-4"
                                >
                                  <div className="flex-shrink-0">
                                    <div
                                      className={cn(
                                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold',
                                        seg.speaker === 1
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                          : seg.speaker === 2
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                            : seg.speaker === 3
                                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
                                      )}
                                    >
                                      S{seg.speaker}
                                    </div>
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Speaker {seg.speaker}
                                    </p>
                                    <p className="text-base leading-relaxed">
                                      {seg.text}
                                    </p>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
