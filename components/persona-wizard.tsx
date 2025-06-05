'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  LoaderIcon,
  UserIcon,
  ImageIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  SparklesIcon,
  BrainIcon,
  FileTextIcon,
  RocketIcon,
  WandIcon,
} from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropper } from '@/components/image-cropper';
import { toast } from '@/lib/toast-system';
import Image from 'next/image';
import type { Persona, UserDocument } from '@/lib/db/schema';

interface PersonaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  persona?: Persona;
  onSave: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  isActive: boolean;
}

const WIZARD_STEPS = [
  {
    id: 'basics',
    title: 'Basic Info',
    description: 'Name and description',
    icon: <UserIcon size={16} />,
  },
  {
    id: 'personality',
    title: 'Personality',
    description: 'Define behavior',
    icon: <BrainIcon size={16} />,
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    description: 'Add documents',
    icon: <FileTextIcon size={16} />,
  },
  {
    id: 'customization',
    title: 'Icon',
    description: 'Customize appearance',
    icon: <ImageIcon size={16} />,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm details',
    icon: <CheckIcon size={16} />,
  },
];

const PERSONALITY_TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional Advisor',
    description: 'Formal, analytical, and business-focused',
    instructions:
      'You are a professional business advisor with expertise in the Entrepreneurial Operating System®. Provide clear, analytical responses with actionable insights. Maintain a formal yet approachable tone, and always back your recommendations with EOS principles and best practices.',
  },
  {
    id: 'mentor',
    name: 'Friendly Mentor',
    description: 'Supportive, encouraging, and guidance-oriented',
    instructions:
      'You are a supportive mentor who helps teams implement EOS with patience and encouragement. Use a warm, friendly tone while providing practical guidance. Share experiences and insights that help teams overcome challenges and celebrate their wins.',
  },
  {
    id: 'coach',
    name: 'Performance Coach',
    description: 'Direct, motivational, and results-driven',
    instructions:
      'You are a performance coach focused on driving results through EOS implementation. Be direct and motivational in your approach, challenging teams to reach their full potential while providing clear, actionable steps to achieve their goals.',
  },
  {
    id: 'consultant',
    name: 'Strategic Consultant',
    description: 'Analytical, detailed, and process-oriented',
    instructions:
      'You are a strategic consultant specializing in EOS implementation. Provide detailed, process-oriented guidance with step-by-step instructions. Focus on the systematic approach to implementing EOS tools and maintaining accountability.',
  },
  {
    id: 'custom',
    name: 'Custom Personality',
    description: 'Create your own unique persona',
    instructions: '',
  },
];

export function PersonaWizard({
  isOpen,
  onClose,
  persona,
  onSave,
}: PersonaWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    documentIds: [] as string[],
    iconUrl: '',
  });
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isNavigatingToSettings, setIsNavigatingToSettings] = useState(false);

  // Icon upload states
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [tempIconBlob, setTempIconBlob] = useState<Blob | null>(null);
  const [tempIconUrl, setTempIconUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document upload states
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(
    new Set(),
  );
  const documentFileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!persona;

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      if (persona) {
        fetchPersonaDetails();
      } else if (!isNavigatingToSettings) {
        resetForm();
      }
      if (!isNavigatingToSettings) {
        setErrors({});
        setCurrentStep(0);
        setCompletedSteps(new Set());
      }
      setIsNavigatingToSettings(false);
    }
  }, [isOpen, persona, isNavigatingToSettings]);

  // Listen for settings modal close to reopen persona wizard
  useEffect(() => {
    const handleSettingsModalClose = () => {
      if (isNavigatingToSettings) {
        // Reopen the persona wizard after a short delay
        setTimeout(() => {
          onClose(); // This will trigger the wizard to reopen with preserved state
        }, 200);
      }
    };

    window.addEventListener('settingsModalClosed', handleSettingsModalClose);
    return () =>
      window.removeEventListener(
        'settingsModalClosed',
        handleSettingsModalClose,
      );
  }, [isNavigatingToSettings, onClose]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      instructions: '',
      documentIds: [],
      iconUrl: '',
    });
    setErrors({});
    setSelectedTemplate('');
    setTempIconBlob(null);
    if (tempIconUrl) {
      URL.revokeObjectURL(tempIconUrl);
      setTempIconUrl(null);
    }
  };

  const validateCurrentStep = () => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 0: // Basic Info
        if (!formData.name.trim()) {
          newErrors.name = 'Persona name is required';
        } else if (formData.name.length > 128) {
          newErrors.name = 'Persona name must be 128 characters or less';
        }
        if (formData.description && formData.description.length > 255) {
          newErrors.description = 'Description must be 255 characters or less';
        }
        break;
      case 1: // Personality
        if (!formData.instructions.trim()) {
          newErrors.instructions = 'Instructions are required';
        } else if (formData.instructions.length < 20) {
          newErrors.instructions =
            'Instructions should be at least 20 characters';
        }
        break;
      // Steps 2 and 3 are optional
      // Step 4 is review, no validation needed
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch('/api/user-documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const fetchPersonaDetails = async () => {
    if (!persona) return;

    try {
      const response = await fetch(`/api/personas/${persona.id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.name,
          description: data.description || '',
          instructions: data.instructions,
          documentIds: data.documentIds || [],
          iconUrl: data.iconUrl || '',
        });
      }
    } catch (error) {
      console.error('Error fetching persona details:', error);
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow clicking on completed steps or the next step
    if (completedSteps.has(stepIndex) || stepIndex === currentStep + 1) {
      if (stepIndex < currentStep || validateCurrentStep()) {
        if (stepIndex > currentStep) {
          setCompletedSteps((prev) => new Set([...prev, currentStep]));
        }
        setCurrentStep(stepIndex);
      }
    }
  };

  const handleTemplateSelect = (
    template: (typeof PERSONALITY_TEMPLATES)[0],
  ) => {
    setSelectedTemplate(template.id);
    if (template.id !== 'custom') {
      setFormData((prev) => ({
        ...prev,
        instructions: template.instructions,
      }));
    }
  };

  // Document upload handlers
  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    const validFiles = files.filter((file) => {
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type.`);
        return false;
      }
      // Max 10MB per file
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...validFiles]);
    }

    // Reset input
    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = '';
    }
  };

  const removeUploadedFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.name !== fileName));
    setProcessingFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(fileName);
      return newSet;
    });
  };

  const processUploadedDocuments = async (personaId: string) => {
    if (uploadedFiles.length === 0) return;

    setUploadingDocuments(true);
    const processedDocIds: string[] = [];

    try {
      for (const file of uploadedFiles) {
        setProcessingFiles((prev) => new Set(prev).add(file.name));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'Persona Document');

        try {
          // Upload document
          const uploadResponse = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          const uploadResult = await uploadResponse.json();
          const documentId = uploadResult.id;

          // Process document into persona namespace
          const processResponse = await fetch(
            '/api/personas/process-document',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                personaId,
                documentId,
                fileName: file.name,
                category: 'Persona Document',
              }),
            },
          );

          if (!processResponse.ok) {
            throw new Error(`Failed to process ${file.name} for persona`);
          }

          processedDocIds.push(documentId);

          toast.success(`${file.name} uploaded and processed successfully`);
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          toast.error(`Failed to process ${file.name}`);
        } finally {
          setProcessingFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(file.name);
            return newSet;
          });
        }
      }

      // Clear uploaded files after processing
      setUploadedFiles([]);

      // If editing, refresh the persona to show new documents
      if (isEditing && persona) {
        await fetchPersonaDetails();
      }

      return processedDocIds;
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/personas/${persona.id}` : '/api/personas';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const savedPersona = await response.json();

        // Process uploaded documents for new personas
        if (!isEditing && uploadedFiles.length > 0) {
          await processUploadedDocuments(savedPersona.id);
        }

        // Upload icon for new personas
        if (!isEditing && tempIconBlob) {
          await uploadPersonaIcon(savedPersona.id);
        }

        onSave();
        onClose();
        toast.success(
          `Persona ${isEditing ? 'updated' : 'created'} successfully!`,
        );
      } else {
        const error = await response.json();
        console.error('Error saving persona:', error);
        setErrors({ submit: error.message || 'Failed to save persona' });
      }
    } catch (error) {
      console.error('Error saving persona:', error);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setFormData((prev) => ({
      ...prev,
      documentIds: prev.documentIds.includes(documentId)
        ? prev.documentIds.filter((id) => id !== documentId)
        : [...prev.documentIds, documentId],
    }));
  };

  const handleNavigateToSettings = () => {
    setIsNavigatingToSettings(true);
    onClose(); // Close the persona wizard
    setTimeout(() => {
      const event = new CustomEvent('openSettingsModal');
      window.dispatchEvent(event);
    }, 100);
  };

  // Icon upload functions
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
      );
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    // Create a URL for the image to show in the cropper
    const imageUrl = URL.createObjectURL(file);
    setCropperImage(imageUrl);
    setIsCropperOpen(true);

    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropperClose = () => {
    setIsCropperOpen(false);
    if (cropperImage) {
      URL.revokeObjectURL(cropperImage);
      setCropperImage(null);
    }
  };

  const handleCroppedIconUpload = async (
    croppedAreaPixels: any,
    croppedBlob: Blob,
  ) => {
    try {
      setIsCropperOpen(false);

      // Validate the cropped blob
      if (!croppedBlob || croppedBlob.size === 0) {
        throw new Error('The cropped image is empty. Please try again.');
      }

      // For new personas, store the blob temporarily
      if (!isEditing) {
        setTempIconBlob(croppedBlob);

        // Create a temporary URL for preview
        if (tempIconUrl) {
          URL.revokeObjectURL(tempIconUrl);
        }
        const url = URL.createObjectURL(croppedBlob);
        setTempIconUrl(url);

        toast.success('Icon will be uploaded after creating the persona');
      } else {
        // For existing personas, upload immediately
        setUploadingIcon(true);

        const formData = new FormData();
        formData.append('file', croppedBlob, 'icon.jpg');

        const personaId = persona?.id;
        if (!personaId) {
          throw new Error('Persona ID is required for icon upload');
        }

        const response = await fetch(`/api/personas/${personaId}/icon`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();

          if (!data.url) {
            throw new Error('No URL returned from server');
          }

          // Update state with the new icon URL
          setFormData((prev) => ({
            ...prev,
            iconUrl: data.url,
          }));

          toast.success('Persona icon updated');

          // Trigger personas refresh
          window.dispatchEvent(new CustomEvent('personasUpdated'));
        } else {
          let errorMessage = 'Failed to upload persona icon';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `Server error: ${response.statusText || response.status}`;
          }
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Error uploading persona icon:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to upload persona icon. Please try again.',
      );
    } finally {
      setUploadingIcon(false);
      // Clean up the object URL
      if (cropperImage) {
        URL.revokeObjectURL(cropperImage);
        setCropperImage(null);
      }
    }
  };

  const uploadPersonaIcon = async (personaId: string) => {
    if (!tempIconBlob) return;

    try {
      setUploadingIcon(true);

      const formData = new FormData();
      formData.append('file', tempIconBlob, 'icon.jpg');

      const response = await fetch(`/api/personas/${personaId}/icon`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        // Clean up temporary URL
        if (tempIconUrl) {
          URL.revokeObjectURL(tempIconUrl);
          setTempIconUrl(null);
        }
        setTempIconBlob(null);

        toast.success('Persona icon uploaded successfully');

        // Trigger personas refresh
        window.dispatchEvent(new CustomEvent('personasUpdated'));
      } else {
        throw new Error('Failed to upload persona icon');
      }
    } catch (error) {
      console.error('Error uploading persona icon:', error);
      toast.error('Failed to upload persona icon');
    } finally {
      setUploadingIcon(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-4">
                Basic Information
              </h3>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium mb-1.5 block"
                  >
                    Persona Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }));
                      if (errors.name)
                        setErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    placeholder="e.g., EOS Implementation Expert"
                    className={`${errors.name ? 'border-destructive' : ''} transition-colors`}
                    maxLength={128}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formData.name.length}/128
                    </span>
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="description"
                    className="text-sm font-medium mb-1.5 block"
                  >
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }));
                      if (errors.description)
                        setErrors((prev) => ({ ...prev, description: '' }));
                    }}
                    placeholder="Brief description of this persona's expertise"
                    className={`${errors.description ? 'border-destructive' : ''} transition-colors`}
                    maxLength={255}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {errors.description && (
                      <p className="text-sm text-destructive">
                        {errors.description}
                      </p>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formData.description.length}/255
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 1: // Personality
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-4">
                Personality & Instructions
              </h3>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Choose a Template
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {PERSONALITY_TEMPLATES.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          selectedTemplate === template.id
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/50 hover:shadow-sm'
                        }`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                              selectedTemplate === template.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {template.id === 'custom' ? (
                              <WandIcon size={16} />
                            ) : (
                              <BrainIcon size={16} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium mb-0.5">
                              {template.name}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="instructions"
                    className="text-sm font-medium mb-1.5 block"
                  >
                    Custom Instructions *
                  </Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        instructions: e.target.value,
                      }));
                      if (errors.instructions)
                        setErrors((prev) => ({ ...prev, instructions: '' }));
                      if (selectedTemplate !== 'custom')
                        setSelectedTemplate('custom');
                    }}
                    placeholder="Detailed instructions for how this AI persona should behave..."
                    rows={6}
                    className={`resize-none transition-colors ${
                      errors.instructions ? 'border-destructive' : ''
                    }`}
                  />
                  {errors.instructions && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.instructions}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Be specific about the persona&apos;s role, expertise, and
                    communication style.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Knowledge Base
        return (
          <div className="space-y-4">
            <h3 className="text-base font-semibold mb-4">Knowledge Base</h3>

            {isLoadingDocuments ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <LoaderIcon size={16} className="animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Loading documents...
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Existing Documents */}
                {documents.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">
                        Available Documents
                      </Label>
                      {formData.documentIds.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {formData.documentIds.length} selected
                        </Badge>
                      )}
                    </div>

                    <div className="border rounded-lg bg-muted/20 p-1">
                      <ScrollArea className="h-32">
                        <div className="space-y-1 p-2">
                          {documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center space-x-2 p-2 rounded-md hover:bg-background/60 transition-colors"
                            >
                              <Checkbox
                                id={doc.id}
                                checked={formData.documentIds.includes(doc.id)}
                                onCheckedChange={() =>
                                  handleDocumentToggle(doc.id)
                                }
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <Label
                                htmlFor={doc.id}
                                className="flex-1 cursor-pointer text-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate font-medium">
                                    {doc.fileName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs ml-2"
                                  >
                                    {doc.category}
                                  </Badge>
                                </div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                {/* Custom Document Upload */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Upload Custom Documents
                  </Label>

                  <input
                    type="file"
                    ref={documentFileInputRef}
                    onChange={handleDocumentFileChange}
                    accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                    multiple
                    className="hidden"
                  />

                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all duration-200 group"
                    onClick={() => documentFileInputRef.current?.click()}
                  >
                    <FileTextIcon
                      size={24}
                      className="mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors"
                    />
                    <p className="text-sm font-medium text-foreground">
                      Click to upload files
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Text, CSV, or Excel (max 10MB)
                    </p>
                  </div>

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3">
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.name}
                            className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileTextIcon
                                size={14}
                                className="text-primary"
                              />
                              <span className="truncate text-xs font-medium">
                                {file.name}
                              </span>
                            </div>
                            {processingFiles.has(file.name) ? (
                              <LoaderIcon
                                size={14}
                                className="animate-spin text-primary"
                              />
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeUploadedFile(file.name)}
                                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {isEditing && (
                        <Button
                          type="button"
                          onClick={() =>
                            persona && processUploadedDocuments(persona.id)
                          }
                          disabled={uploadingDocuments || !persona}
                          className="w-full mt-2"
                          size="sm"
                        >
                          {uploadingDocuments ? (
                            <>
                              <LoaderIcon
                                size={14}
                                className="animate-spin mr-2"
                              />
                              Processing...
                            </>
                          ) : (
                            <>
                              <FileTextIcon size={14} className="mr-2" />
                              Process Documents
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Customization
        return (
          <div className="space-y-4">
            <h3 className="text-base font-semibold mb-4">Customization</h3>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Persona Icon
                </Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleIconChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="relative group">
                    <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-border flex items-center justify-center bg-muted/30 group-hover:border-primary/50 transition-colors">
                      {tempIconUrl || formData.iconUrl ? (
                        <Image
                          src={tempIconUrl || formData.iconUrl}
                          alt="Persona Icon"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <UserIcon size={32} className="text-muted-foreground" />
                      )}
                    </div>
                    {uploadingIcon && (
                      <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                        <LoaderIcon
                          size={16}
                          className="animate-spin text-primary"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingIcon}
                      size="sm"
                      className="hover:border-primary/50"
                    >
                      <ImageIcon size={14} className="mr-2" />
                      {tempIconUrl || formData.iconUrl
                        ? 'Change Icon'
                        : 'Upload Icon'}
                    </Button>
                    {!isEditing && tempIconUrl && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ Icon ready to upload
                      </p>
                    )}
                    {isEditing && formData.iconUrl && (
                      <p className="text-xs text-muted-foreground">
                        Current icon will be replaced
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Review
        return (
          <div className="space-y-4">
            <h3 className="text-base font-semibold mb-4">Review & Create</h3>

            <div className="space-y-4">
              {/* Persona Preview */}
              <div className="border rounded-lg p-4 bg-muted/10">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border flex items-center justify-center bg-background">
                    {tempIconUrl || formData.iconUrl ? (
                      <Image
                        src={tempIconUrl || formData.iconUrl}
                        alt="Persona Icon"
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    ) : (
                      <UserIcon size={24} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">
                      {formData.name}
                    </h4>
                    {formData.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formData.description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {formData.documentIds.length} documents
                      </Badge>
                      {uploadedFiles.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{uploadedFiles.length} pending
                        </Badge>
                      )}
                      {tempIconUrl && !isEditing && (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600/50"
                        >
                          Icon pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="my-3" />

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Instructions
                  </Label>
                  <div className="bg-background/50 rounded-md p-3 max-h-32 overflow-y-auto border">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {formData.instructions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pending Items Notice */}
              {!isEditing && (uploadedFiles.length > 0 || tempIconUrl) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> The following will be processed after
                    creating the persona:
                  </p>
                  <ul className="mt-1 text-xs text-blue-600 dark:text-blue-400 list-disc list-inside">
                    {uploadedFiles.length > 0 && (
                      <li>
                        {uploadedFiles.length} document
                        {uploadedFiles.length !== 1 ? 's' : ''}
                      </li>
                    )}
                    {tempIconUrl && <li>Persona icon</li>}
                  </ul>
                </div>
              )}

              {/* Error Display */}
              {errors.submit && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{errors.submit}</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) return 'completed';
    if (stepIndex === currentStep) return 'active';
    if (stepIndex < currentStep) return 'completed';
    return 'upcoming';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle className="text-lg">
            {isEditing ? 'Edit Persona' : 'Create New Persona'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditing
              ? 'Update your AI persona with custom instructions and knowledge.'
              : 'Create a specialized AI persona with custom instructions and knowledge base.'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b bg-background">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleStepClick(index)}
                    disabled={status === 'upcoming' && index > currentStep + 1}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-200 ${
                      status === 'active'
                        ? 'text-primary bg-primary/10'
                        : status === 'completed'
                          ? 'text-primary hover:bg-primary/5'
                          : 'text-muted-foreground hover:text-foreground'
                    } ${
                      status === 'upcoming' && index > currentStep + 1
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                        status === 'active'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : status === 'completed'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted'
                      }`}
                    >
                      {status === 'completed' ? (
                        <CheckIcon size={14} />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium">{step.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {step.description}
                      </div>
                    </div>
                  </button>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div
                      className={`w-8 h-px mx-2 transition-colors ${
                        completedSteps.has(index)
                          ? 'bg-primary/20'
                          : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 0 ? onClose : handlePrevious}
            size="sm"
          >
            {currentStep === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeftIcon size={14} className="mr-1" />
                Previous
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button onClick={handleNext} size="sm" className="shadow-sm">
                Next
                <ChevronRightIcon size={14} className="ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                size="sm"
                className="shadow-sm"
              >
                {isLoading ? (
                  <>
                    <LoaderIcon size={14} className="mr-2 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>{isEditing ? 'Update Persona' : 'Create Persona'}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Image Cropper Modal */}
      {isCropperOpen && cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCroppedIconUpload}
          onCancel={handleCropperClose}
          aspectRatio={1}
        />
      )}
    </Dialog>
  );
}
