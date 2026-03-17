'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  MessageSquare,
  FileCode,
  FileText,
  Users,
  Calendar,
  Search,
  Bookmark,
  AtSign,
  Globe,
  Target,
  Upload,
  Keyboard,
  Zap,
  Link,
  Settings,
  Smartphone,
  Mic,
  FileAudio,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FEATURES,
  FEATURE_CATEGORIES,
  getNewFeatures,
  getFeaturesByCategory,
  type Feature,
} from '@/lib/features/config';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastSeenVersion?: string;
  onMarkAsSeen: (version: string) => void;
}

export function WhatsNewModal({
  isOpen,
  onClose,
  lastSeenVersion,
  onMarkAsSeen,
}: WhatsNewModalProps) {
  const [activeTab, setActiveTab] = useState<'whats-new' | 'all-features'>(
    'whats-new',
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    null,
  );
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const newFeatures = getNewFeatures(lastSeenVersion);
  const allFeatures = FEATURES;

  // Initialize selected feature when modal opens
  useEffect(() => {
    if (isOpen) {
      setMobileView('list');
      if (activeTab === 'whats-new' && newFeatures.length > 0) {
        setSelectedFeatureId(newFeatures[0].id);
      } else if (activeTab === 'all-features' && allFeatures.length > 0) {
        setSelectedFeatureId(allFeatures[0].id);
      }
    }
  }, [isOpen, activeTab, newFeatures, allFeatures]);

  const handleClose = () => {
    const latestVersion = new Date().toISOString();
    onMarkAsSeen(latestVersion);
    onClose();
  };

  const features = activeTab === 'whats-new' ? newFeatures : allFeatures;
  const selectedFeature =
    features.find((f) => f.id === selectedFeatureId) || features[0];
  const currentIndex = features.findIndex((f) => f.id === selectedFeatureId);

  const handleNext = () => {
    if (features.length <= 1) return;
    const nextIndex = (currentIndex + 1) % features.length;
    setSelectedFeatureId(features[nextIndex].id);
    setMobileView('detail');
  };

  const handlePrevious = () => {
    if (features.length <= 1) return;
    const prevIndex =
      currentIndex === 0 ? features.length - 1 : currentIndex - 1;
    setSelectedFeatureId(features[prevIndex].id);
    setMobileView('detail');
  };

  const getIcon = (iconName: string) => {
    const iconMap = {
      MessageSquare,
      FileCode,
      FileText,
      Users,
      Calendar,
      Search,
      Bookmark,
      AtSign,
      Globe,
      Target,
      Upload,
      Keyboard,
      Zap,
      Link,
      Settings,
      Sparkles,
      Smartphone,
      Mic,
      FileAudio,
      PlayCircle,
    };

    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    return IconComponent ? (
      <IconComponent className="size-5" />
    ) : (
      <Sparkles className="size-5" />
    );
  };

  const getCategoryColor = (categoryId: string) => {
    const category = FEATURE_CATEGORIES.find((c) => c.id === categoryId);
    return category?.color || 'bg-gray-500';
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        size="2xl"
        className="h-[90vh] w-[calc(100%-1rem)] max-w-5xl overflow-hidden p-0 sm:w-full"
        hideCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>What&apos;s New - Features and Updates</DialogTitle>
        </VisuallyHidden>

        <div className="flex h-full flex-col md:flex-row">
          <div
            className={[
              'flex h-full flex-col border-border bg-background md:w-80 md:flex-shrink-0 md:border-r',
              mobileView === 'detail' ? 'hidden md:flex' : 'flex',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-6 text-primary" />
                  <h2 className="text-xl font-semibold">Features</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="size-8 p-0"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  const newTab = value as 'whats-new' | 'all-features';
                  setActiveTab(newTab);
                  setMobileView('list');
                  // Reset selection when changing tabs
                  const tabFeatures =
                    newTab === 'whats-new' ? newFeatures : allFeatures;
                  if (tabFeatures.length > 0) {
                    setSelectedFeatureId(tabFeatures[0].id);
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="whats-new" className="text-xs">
                    What&apos;s New
                    {newFeatures.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 text-xs">
                        {newFeatures.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="all-features" className="text-xs">
                    All Features
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Feature List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent">
              {activeTab === 'whats-new' ? (
                // What's New Tab
                newFeatures.length > 0 ? (
                  <div className="space-y-2">
                    {newFeatures.map((feature) => (
                      <FeatureCard
                        key={feature.id}
                        feature={feature}
                        isSelected={selectedFeatureId === feature.id}
                        onClick={() => {
                          setSelectedFeatureId(feature.id);
                          setMobileView('detail');
                        }}
                        getCategoryColor={getCategoryColor}
                        getIcon={getIcon}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="size-12 mx-auto mb-4 opacity-50" />
                    <p>You&apos;re all caught up!</p>
                    <p className="text-sm">
                      No new features since your last visit.
                    </p>
                  </div>
                )
              ) : (
                // All Features Tab - Grouped by Category
                <div className="space-y-6">
                  {FEATURE_CATEGORIES.map((category) => {
                    const categoryFeatures = getFeaturesByCategory(category.id);
                    if (categoryFeatures.length === 0) return null;

                    return (
                      <div key={category.id}>
                        <div className="flex items-center gap-2 mb-3 px-2">
                          <div
                            className={`size-3 rounded-full ${category.color}`}
                          />
                          <h3 className="font-medium text-sm">
                            {category.title}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {categoryFeatures.map((feature) => (
                            <FeatureCard
                              key={feature.id}
                              feature={feature}
                              isSelected={selectedFeatureId === feature.id}
                              onClick={() => {
                                setSelectedFeatureId(feature.id);
                                setMobileView('detail');
                              }}
                              getCategoryColor={getCategoryColor}
                              getIcon={getIcon}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className={[
              'flex min-h-0 flex-1 flex-col bg-background',
              mobileView === 'list' ? 'hidden md:flex' : 'flex',
            ].join(' ')}
          >
            {selectedFeature ? (
              <>
                <div className="flex flex-shrink-0 items-center justify-between border-b border-border p-4 sm:p-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileView('list')}
                      className="md:hidden"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                        {getIcon(selectedFeature.icon)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h1 className="truncate text-lg font-semibold sm:text-2xl">
                            {selectedFeature.title}
                          </h1>
                          {selectedFeature.isNew && (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary"
                            >
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {currentIndex + 1} of {features.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="md:hidden"
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent">
                  <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
                    {/* Basic Info */}
                    <div>
                      <p className="mb-4 text-base text-muted-foreground sm:text-lg">
                        {selectedFeature.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className={`size-2 rounded-full ${getCategoryColor(selectedFeature.category)}`}
                          />
                          <span>
                            {
                              FEATURE_CATEGORIES.find(
                                (c) => c.id === selectedFeature.category,
                              )?.title
                            }
                          </span>
                        </div>
                        <span>•</span>
                        <span>Version {selectedFeature.version}</span>
                        <span>•</span>
                        <span>
                          {new Date(
                            selectedFeature.releaseDate,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Screenshot */}
                    {selectedFeature.screenshot && (
                      <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                        <img
                          src={selectedFeature.screenshot}
                          alt={`${selectedFeature.title} screenshot`}
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    {/* Detailed Description */}
                    {selectedFeature.detailedDescription && (
                      <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-6">
                        <h3 className="font-semibold text-lg mb-3">
                          About This Feature
                        </h3>
                        <p className="text-sm leading-relaxed">
                          {selectedFeature.detailedDescription}
                        </p>
                      </div>
                    )}

                    {/* Benefits */}
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                      <h3 className="font-semibold text-lg mb-3">
                        Key Benefits
                      </h3>
                      <ul className="space-y-2">
                        {selectedFeature.benefits.map((benefit, index) => (
                          <li
                            key={`benefit-${selectedFeature.id}-${index}`}
                            className="flex items-start gap-3"
                          >
                            <div className="size-2 rounded-full bg-primary mt-2 shrink-0" />
                            <span className="text-sm">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Examples */}
                    {selectedFeature.examples &&
                      selectedFeature.examples.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                          <h3 className="font-semibold text-lg mb-3">
                            Use Cases & Examples
                          </h3>
                          <ul className="space-y-2">
                            {selectedFeature.examples.map((example, index) => (
                              <li
                                key={`example-${selectedFeature.id}-${index}`}
                                className="flex items-start gap-3"
                              >
                                <div className="size-2 rounded-full bg-green-500 mt-2 shrink-0" />
                                <span className="text-sm italic">
                                  {example}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Improvements */}
                    {selectedFeature.improveExperience &&
                      selectedFeature.improveExperience.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                          <h3 className="font-semibold text-lg mb-3">
                            Experience Improvements
                          </h3>
                          <ul className="space-y-2">
                            {selectedFeature.improveExperience.map(
                              (improvement, index) => (
                                <li
                                  key={`improvement-${selectedFeature.id}-${index}`}
                                  className="flex items-start gap-3"
                                >
                                  <div className="size-2 rounded-full bg-purple-500 mt-2 shrink-0" />
                                  <span className="text-sm">{improvement}</span>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {/* Tags */}
                    {selectedFeature.tags &&
                      selectedFeature.tags.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                          <h3 className="font-semibold text-lg mb-3">
                            Related Topics
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedFeature.tags.map((tag, index) => (
                              <Badge
                                key={`tag-${selectedFeature.id}-${index}`}
                                variant="outline"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={features.length <= 1}
                    >
                      <ChevronLeft className="mr-1 size-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      disabled={features.length <= 1}
                    >
                      Next
                      <ChevronRight className="ml-1 size-4" />
                    </Button>
                  </div>
                  {selectedFeature.learnMoreUrl && (
                    <Button variant="outline" asChild>
                      <a
                        href={selectedFeature.learnMoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gap-2"
                      >
                        <ExternalLink className="size-4" />
                        Learn More
                      </a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="size-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Select a feature to learn more
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simplified Feature Card Component
interface FeatureCardProps {
  feature: Feature;
  isSelected: boolean;
  onClick: () => void;
  getCategoryColor: (categoryId: string) => string;
  getIcon: (iconName: string) => React.ReactElement;
}

function FeatureCard({
  feature,
  isSelected,
  onClick,
  getCategoryColor,
  getIcon,
}: FeatureCardProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        w-full rounded-xl border text-left transition-all cursor-pointer select-none
        ${
          isSelected
            ? 'border-primary/30 bg-primary/5 shadow-sm'
            : 'border-border/60 bg-card hover:bg-muted/40'
        }
      `}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`w-1 self-stretch rounded-full ${getCategoryColor(feature.category)}`}
        />
        <div
          className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 p-2"
        >
          {getIcon(feature.icon)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">{feature.title}</h4>
            {feature.isNew && (
              <div className="size-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}
