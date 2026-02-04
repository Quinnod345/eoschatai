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
import { MediaErrorBoundary } from './error-boundary';
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
  Edit2,
  X,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast-system';
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
import { Badge } from '@/components/ui/badge';
import { Gate } from '@/components/gate';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import { useAccountStore } from '@/lib/stores/account-store';
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
  meetingType?: string | null;
  tags?: string[];
  title?: string;
  hasError?: boolean;
  errorMessage?: string;
};

type RecordingMode = 'idle' | 'recording' | 'paused' | 'completed';

function RecordingModalInner({
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
  const [playbackRef, setPlaybackRef] = useState<HTMLAudioElement | null>(null);

  // New feature states
  const [meetingType, setMeetingType] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);

  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const router = useRouter();
  const entitlements = useAccountStore((state) => state.entitlements);
  const usageCounters = useAccountStore((state) => state.usageCounters);

  const selectRecording = useCallback((rec: SavedRecording) => {
    setSelectedRecording(rec);
    setAnalysisResult({
      id: rec.id,
      transcript: rec.transcript,
      segments:
        rec.segments ||
        (rec.transcript
          ? rec.transcript.split('\n').map((t: string, i: number) => ({
              speaker: (i % rec.speakers) + 1,
              text: t,
            }))
          : []),
      speakers: rec.speakers,
      diarizationMethod: rec.diarizationMethod,
    });
    setAudioUrl(rec.audioUrl);
    setSummary(rec.summary || '');
    setMeetingType(rec.meetingType || '');
    setTags(Array.isArray(rec.tags) ? rec.tags : []);
    setEditedTitle(rec.title || '');
    setIsNewRecording(false);
    setActiveTab('details');
  }, []);

  // Fetch recordings from database
  const fetchRecordings = useCallback(async () => {
    setIsLoadingRecordings(true);
    try {
      const res = await fetch('/api/voice/recordings');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const transformed: SavedRecording[] = (data.recordings || []).map(
        (item: any) => {
          const hasError = item.transcript?.content?.startsWith('ERROR:');
          return {
            id: item.recording.id,
            createdAt: new Date(item.recording.createdAt).getTime(),
            audioUrl: item.recording.audioUrl,
            transcript: hasError
              ? ''
              : item.transcript?.fullTranscript ||
                item.transcript?.content ||
                '',
            speakers: item.transcript?.speakerCount || 1,
            segments: hasError ? [] : item.transcript?.segments || [],
            duration: item.recording.duration || 0,
            summary: item.transcript?.summary || '',
            diarizationMethod:
              item.transcript?.speakerCount > 1 ? 'assemblyai' : 'basic',
            meetingType: item.recording.meetingType,
            tags: Array.isArray(item.recording.tags) ? item.recording.tags : [],
            title: item.recording.title,
            hasError,
            errorMessage: hasError
              ? item.transcript.content.replace('ERROR:', '')
              : undefined,
          };
        },
      );

      setRecordings(transformed);

      if (selectedRecordingId) {
        const rec = transformed.find((r) => r.id === selectedRecordingId);
        if (rec) selectRecording(rec);
      }
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setIsLoadingRecordings(false);
    }
  }, [selectedRecordingId, selectRecording]);

  useEffect(() => {
    if (isOpen) fetchRecordings();
  }, [isOpen, fetchRecordings]);

  const saveRecordingLocally = (rec: SavedRecording) => {
    const updated = [rec, ...recordings.filter((r) => r.id !== rec.id)];
    setRecordings(updated);
  };

  const deleteRecording = async (id: string) => {
    try {
      const res = await fetch(`/api/voice/recordings/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');

      const updated = recordings.filter((r) => r.id !== id);
      setRecordings(updated);

      if (selectedRecording?.id === id) {
        setSelectedRecording(null);
        setAnalysisResult(null);
        setAudioUrl(null);
        setSummary('');
        setActiveTab('record');
      }

      toast.success('Recording deleted');
    } catch (error) {
      toast.error('Failed to delete recording');
    }
  };

  // Update recording metadata
  const updateRecording = async (updates: {
    title?: string;
    meetingType?: string;
    tags?: string[];
  }) => {
    if (!selectedRecording) return;

    try {
      const res = await fetch(`/api/voice/recordings/${selectedRecording.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update');

      setSelectedRecording((prev) => (prev ? { ...prev, ...updates } : prev));
      await fetchRecordings();
      toast.success('Updated');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  // Tag management
  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const newTags = [...tags, trimmed];
      setTags(newTags);
      updateRecording({ tags: newTags });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    updateRecording({ tags: newTags });
  };

  // Title editing
  const saveTitle = () => {
    if (editedTitle.trim()) {
      updateRecording({ title: editedTitle.trim() });
      setIsEditingTitle(false);
    }
  };

  // Download audio
  const downloadAudio = () => {
    if (!selectedRecording) return;
    const link = document.createElement('a');
    link.href = selectedRecording.audioUrl;
    const filename = `${meetingType || 'recording'}-${new Date(selectedRecording.createdAt).toISOString().split('T')[0]}.webm`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startNewRecording = () => {
    // Reset state for new recording
    setSelectedRecording(null);
    setAnalysisResult(null);
    setAudioUrl(null);
    setSummary('');
    setMeetingType('');
    setTags([]);
    setTagInput('');
    setEditedTitle('');
    setIsEditingTitle(false);
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

    try {
      // Upload to database with metadata
      const uploadForm = new FormData();
      uploadForm.append('audio', blob, 'recording.webm');
      uploadForm.append(
        'title',
        meetingType ? `${meetingType} Meeting` : 'New Recording',
      );
      uploadForm.append('duration', recordingDuration.toString());
      if (meetingType) uploadForm.append('meetingType', meetingType);
      if (tags.length > 0) uploadForm.append('tags', JSON.stringify(tags));

      const uploadRes = await fetch('/api/voice/recordings', {
        method: 'POST',
        body: uploadForm,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      toast.success('Recording saved! Processing transcript...');

      // Refresh and close
      await fetchRecordings();
      setIsAnalyzing(false);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save recording');
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

  const scheduleFollowUp = async () => {
    try {
      const base = new Date();
      // Choose next business day at 10:00 local
      const day = base.getDay();
      const addDays = day === 5 ? 3 : day === 6 ? 2 : 1; // Fri->Mon, Sat->Mon, else +1
      const start = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + addDays,
        10,
        0,
        0,
      );
      const end = new Date(start.getTime() + 30 * 60000); // 30 minutes

      const summaryText = summary
        ? `Follow-up: ${summary.substring(0, 60)}`
        : 'Follow-up Meeting';
      const descriptionText = analysisResult?.transcript
        ? 'Scheduled from voice meeting analysis.'
        : undefined;

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summaryText,
          description: descriptionText,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create event');
      }
      const data = await res.json();
      toast.success('Follow-up scheduled');
      if (data?.htmlLink) {
        try {
          window.open(data.htmlLink, '_blank');
        } catch (_) {
          /* noop */
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to schedule follow-up');
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
      <DialogContent size="full" className="h-[calc(100vh-2rem)] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl">Voice Recordings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="w-80 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Recordings</h3>
                    <p className="text-xs text-muted-foreground">
                      {recordings.length} saved
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => fetchRecordings()}
                  disabled={isLoadingRecordings}
                  className="h-8 w-8"
                  title="Refresh"
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4',
                      isLoadingRecordings && 'animate-spin',
                    )}
                  />
                </Button>
              </div>

              {/* Usage Meter */}
              {entitlements?.features.recordings.enabled && usageCounters && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Minutes used</span>
                    <span className="font-medium">
                      {usageCounters.asr_minutes_month} /{' '}
                      {entitlements.features.recordings.minutes_month}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        usageCounters.asr_minutes_month /
                          entitlements.features.recordings.minutes_month >
                          0.9
                          ? 'bg-red-500'
                          : usageCounters.asr_minutes_month /
                                entitlements.features.recordings.minutes_month >
                              0.7
                            ? 'bg-yellow-500'
                            : 'bg-primary',
                      )}
                      style={{
                        width: `${Math.min(100, (usageCounters.asr_minutes_month / entitlements.features.recordings.minutes_month) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <Gate
                feature="recordings"
                mode="soft"
                usageKey="asr_minutes_month"
                limit={entitlements?.features.recordings.minutes_month ?? null}
                placement="recording-modal:recordings"
                fallback={
                  <UpgradePrompt
                    feature="recordings"
                    placement="recording-modal:recordings"
                    onAutoRetry={() => {
                      startNewRecording();
                    }}
                    cta="Upgrade for Recordings"
                    className="w-full"
                  />
                }
              >
                <Button
                  onClick={startNewRecording}
                  className="w-full gap-2"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  New Recording
                </Button>
              </Gate>
            </div>

            <ScrollArea className="flex-1">
              {recordings.length === 0 ? (
                <div className="p-6 text-center">
                  <FileAudio className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No recordings yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &quot;New Recording&quot; to start
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {recordings.map((rec) => (
                    <div
                      key={rec.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent',
                        selectedRecording?.id === rec.id &&
                          'bg-accent border-primary',
                      )}
                      onClick={() => selectRecording(rec)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectRecording(rec);
                        }
                      }}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {rec.speakers}
                        </Badge>
                        {rec.meetingType && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0"
                          >
                            {rec.meetingType}
                          </Badge>
                        )}
                        {rec.hasError ? (
                          <Badge
                            variant="destructive"
                            className="text-xs px-2 py-0"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        ) : rec.transcript ? (
                          <Badge className="text-xs px-2 py-0 bg-green-600">
                            Transcribed
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs px-2 py-0 animate-pulse"
                          >
                            Processing
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
                      {/* Meeting Type & Tags - Show when idle or completed */}
                      {(recordingMode === 'idle' ||
                        recordingMode === 'completed') && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium mb-2">
                              Meeting Type
                            </div>
                            <Select
                              value={meetingType}
                              onValueChange={setMeetingType}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="L10">L10 Meeting</SelectItem>
                                <SelectItem value="Quarterly">
                                  Quarterly Planning
                                </SelectItem>
                                <SelectItem value="Annual">
                                  Annual Planning
                                </SelectItem>
                                <SelectItem value="StateOfCompany">
                                  State of the Company
                                </SelectItem>
                                <SelectItem value="General">
                                  General Meeting
                                </SelectItem>
                                <SelectItem value="OneOnOne">
                                  One-on-One
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-2">Tags</div>
                            <div className="flex gap-2">
                              <Input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addTag();
                                  }
                                }}
                                placeholder="Add tag..."
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={addTag}
                                disabled={!tagInput.trim()}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {tag}
                                    <button
                                      type="button"
                                      onClick={() => removeTag(tag)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

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
                        {/* Title Editing */}
                        <div className="flex items-center gap-2">
                          {isEditingTitle ? (
                            <>
                              <Input
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveTitle();
                                  if (e.key === 'Escape')
                                    setIsEditingTitle(false);
                                }}
                                className="flex-1"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={saveTitle}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setIsEditingTitle(false)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <h2 className="text-lg font-semibold flex-1">
                                {selectedRecording.title ||
                                  'Untitled Recording'}
                              </h2>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditedTitle(selectedRecording.title || '');
                                  setIsEditingTitle(true);
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Meeting Type & Tags Editing */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium mb-2">
                              Meeting Type
                            </div>
                            <Select
                              value={meetingType}
                              onValueChange={(value) => {
                                setMeetingType(value);
                                updateRecording({ meetingType: value });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="L10">L10 Meeting</SelectItem>
                                <SelectItem value="Quarterly">
                                  Quarterly Planning
                                </SelectItem>
                                <SelectItem value="Annual">
                                  Annual Planning
                                </SelectItem>
                                <SelectItem value="StateOfCompany">
                                  State of the Company
                                </SelectItem>
                                <SelectItem value="General">
                                  General Meeting
                                </SelectItem>
                                <SelectItem value="OneOnOne">
                                  One-on-One
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-2">Tags</div>
                            <div className="flex gap-2">
                              <Input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addTag();
                                  }
                                }}
                                placeholder="Add tag..."
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={addTag}
                                disabled={!tagInput.trim()}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {tag}
                                    <button
                                      type="button"
                                      onClick={() => removeTag(tag)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Error State with Retry */}
                        {selectedRecording.hasError && (
                          <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/20 p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                                  Transcription Failed
                                </h4>
                                <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                                  {selectedRecording.errorMessage ||
                                    'An error occurred during transcription'}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        '/api/voice/recordings/transcribe',
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            recordingId: selectedRecording.id,
                                          }),
                                        },
                                      );
                                      if (!res.ok)
                                        throw new Error('Retry failed');
                                      toast.success(
                                        'Retrying transcription...',
                                      );
                                      setTimeout(() => fetchRecordings(), 3000);
                                    } catch {
                                      toast.error('Failed to retry');
                                    }
                                  }}
                                  className="gap-2"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Retry Transcription
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Processing State */}
                        {!selectedRecording.transcript &&
                          !selectedRecording.hasError && (
                            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
                              <div className="flex items-center gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <div>
                                  <h4 className="font-semibold mb-1">
                                    Processing Transcription
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    This usually takes 1-2 minutes. Refresh to
                                    check progress.
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => fetchRecordings()}
                                  className="ml-auto gap-2"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Refresh
                                </Button>
                              </div>
                            </div>
                          )}

                        <div className="bg-muted rounded-lg p-4">
                          <audio
                            controls
                            src={audioUrl || undefined}
                            className="w-full"
                            ref={(el) => setPlaybackRef(el)}
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
                        <div className="flex gap-2">
                          <Button
                            onClick={handleSendToChat}
                            className="gap-2 flex-1"
                            disabled={
                              isSendingToChat || !selectedRecording.transcript
                            }
                            size="lg"
                          >
                            {isSendingToChat ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Wand2 className="h-5 w-5" />
                            )}
                            Analyze
                          </Button>

                          <Button
                            variant="outline"
                            size="lg"
                            onClick={downloadAudio}
                            className="gap-2"
                          >
                            <Download className="h-5 w-5" />
                            Audio
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
                            disabled={!selectedRecording.transcript}
                          >
                            <Download className="h-5 w-5" />
                            Text
                          </Button>

                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={scheduleFollowUp}
                            className="gap-2"
                          >
                            <Calendar className="h-5 w-5" />
                            Follow-up
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
                                      <button
                                        type="button"
                                        className="underline hover:no-underline"
                                        onClick={() => {
                                          try {
                                            if (
                                              playbackRef &&
                                              typeof seg.start === 'number'
                                            ) {
                                              playbackRef.currentTime =
                                                Math.max(0, seg.start);
                                              playbackRef
                                                .play()
                                                .catch(() => {});
                                            }
                                          } catch (_) {}
                                        }}
                                        title="Jump to segment"
                                      >
                                        Speaker {seg.speaker} •{' '}
                                        {Math.max(
                                          0,
                                          Math.floor(seg.start || 0),
                                        )}
                                        s
                                      </button>
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

/**
 * RecordingModal wrapped with error boundary for graceful media error handling
 */
export default function RecordingModal(props: RecordingModalProps) {
  // Only wrap with error boundary when the modal is open
  if (!props.isOpen) {
    return null;
  }
  
  return (
    <MediaErrorBoundary context="Recording" onClose={props.onClose}>
      <RecordingModalInner {...props} />
    </MediaErrorBoundary>
  );
}
