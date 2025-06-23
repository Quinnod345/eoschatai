'use client';

import { useState, useEffect } from 'react';
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

  const newFeatures = getNewFeatures(lastSeenVersion);
  const allFeatures = FEATURES;

  // Initialize selected feature when modal opens
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'whats-new' && newFeatures.length > 0) {
        setSelectedFeatureId(newFeatures[0].id);
      } else if (activeTab === 'all-features' && allFeatures.length > 0) {
        setSelectedFeatureId(allFeatures[0].id);
      }
    }
  }, [isOpen, activeTab, newFeatures.length, allFeatures.length]);

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
  };

  const handlePrevious = () => {
    if (features.length <= 1) return;
    const prevIndex =
      currentIndex === 0 ? features.length - 1 : currentIndex - 1;
    setSelectedFeatureId(features[prevIndex].id);
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-5xl h-[85vh] p-0 overflow-hidden"
        hideCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>What&apos;s New - Features and Updates</DialogTitle>
        </VisuallyHidden>

        <div className="relative h-full">
          {/* Sidebar */}
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-muted/30 border-r border-border flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border flex-shrink-0">
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
              {activeTab === 'whats-new' ? (
                // What's New Tab
                newFeatures.length > 0 ? (
                  <div className="space-y-2">
                    {newFeatures.map((feature) => (
                      <FeatureCard
                        key={feature.id}
                        feature={feature}
                        isSelected={selectedFeatureId === feature.id}
                        onClick={() => setSelectedFeatureId(feature.id)}
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
                              onClick={() => setSelectedFeatureId(feature.id)}
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

          {/* Main Content */}
          <div className="absolute left-80 right-0 top-0 bottom-0 flex flex-col">
            {selectedFeature ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={features.length <= 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      {getIcon(selectedFeature.icon)}
                      <h1 className="text-2xl font-bold">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNext}
                      disabled={features.length <= 1}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentIndex + 1} of {features.length}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Basic Info */}
                    <div>
                      <p className="text-lg text-muted-foreground mb-4">
                        {selectedFeature.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                      <div className="rounded-lg border border-border overflow-hidden">
                        <img
                          src={selectedFeature.screenshot}
                          alt={`${selectedFeature.title} screenshot`}
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    {/* Detailed Description */}
                    {selectedFeature.detailedDescription && (
                      <div className="bg-muted/30 rounded-lg p-6">
                        <h3 className="font-semibold text-lg mb-3">
                          About This Feature
                        </h3>
                        <p className="text-sm leading-relaxed">
                          {selectedFeature.detailedDescription}
                        </p>
                      </div>
                    )}

                    {/* Benefits */}
                    <div>
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
                        <div>
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
                        <div>
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
                        <div>
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

                {/* Footer */}
                {selectedFeature.learnMoreUrl && (
                  <div className="p-6 border-t border-border flex-shrink-0">
                    <div className="flex justify-center">
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
                    </div>
                  </div>
                )}
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
  getIcon: (iconName: string) => JSX.Element;
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
        w-full p-3 rounded-lg text-left transition-all cursor-pointer select-none
        ${
          isSelected
            ? 'bg-primary/10 border-primary/20 border shadow-sm'
            : 'hover:bg-muted/50 border border-transparent'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-1.5 rounded-md ${getCategoryColor(feature.category)} text-white shrink-0`}
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
