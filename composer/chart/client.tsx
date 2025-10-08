import { Composer } from '@/components/create-composer';
import {
  CopyIcon,
  DownloadIcon,
  RedoIcon,
  UndoIcon,
  SparklesIcon,
  MessageIcon,
} from '@/components/icons';
import { toast } from '@/lib/toast-system';
import { useState, useEffect, useRef } from 'react';

// Types for chart metadata
export interface ChartData {
  type:
    | 'line'
    | 'bar'
    | 'pie'
    | 'doughnut'
    | 'radar'
    | 'polarArea'
    | 'scatter'
    | 'bubble';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
    }>;
  };
  options?: any;
}

interface ChartComposerMetadata {
  chartData: ChartData | null;
  editMode: 'visual' | 'code';
}

// Simple function to render a bar chart on a canvas
function renderBarChart(canvas: HTMLCanvasElement, chartData: ChartData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get dimensions
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;

  // Find max value for scaling
  const maxValue = Math.max(...values);

  // Calculate bar width
  const barCount = values.length;
  const barWidth = (availableWidth / barCount) * 0.8;
  const spacing = (availableWidth / barCount) * 0.2;

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 20);
  }

  // Draw bars
  values.forEach((value, index) => {
    const x = padding + index * (barWidth + spacing);
    const barHeight = (value / maxValue) * availableHeight;
    const y = height - padding - barHeight;

    // Get colors with fallbacks
    let fillColor = 'rgba(255, 99, 132, 0.2)';
    let strokeColor = 'rgb(255, 99, 132)';

    if (
      Array.isArray(dataset.backgroundColor) &&
      index < dataset.backgroundColor.length
    ) {
      fillColor = dataset.backgroundColor[index] as string;
    } else if (typeof dataset.backgroundColor === 'string') {
      fillColor = dataset.backgroundColor;
    }

    if (
      Array.isArray(dataset.borderColor) &&
      index < dataset.borderColor.length
    ) {
      strokeColor = dataset.borderColor[index] as string;
    } else if (typeof dataset.borderColor === 'string') {
      strokeColor = dataset.borderColor;
    }

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = dataset.borderWidth || 1;

    ctx.beginPath();
    ctx.rect(x, y, barWidth, barHeight);
    ctx.fill();
    ctx.stroke();

    // Draw value
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value.toString(), x + barWidth / 2, y - 5);

    // Draw label
    if (labels[index]) {
      ctx.fillStyle = 'black';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, height - padding + 15);
    }
  });

  // Draw legend
  if (dataset.label) {
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dataset.label, width / 2, 40);
  }
}

// Simple function to render a pie chart on a canvas
function renderPieChart(canvas: HTMLCanvasElement, chartData: ChartData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get dimensions
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 40;

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;
  const total = values.reduce((sum, value) => sum + value, 0);

  // Colors
  const getBackgroundColor = (index: number) => {
    if (
      Array.isArray(dataset.backgroundColor) &&
      index < dataset.backgroundColor.length
    ) {
      return dataset.backgroundColor[index] as string;
    }
    return typeof dataset.backgroundColor === 'string'
      ? dataset.backgroundColor
      : 'rgba(255, 99, 132, 0.2)';
  };

  const getBorderColor = (index: number) => {
    if (
      Array.isArray(dataset.borderColor) &&
      index < dataset.borderColor.length
    ) {
      return dataset.borderColor[index] as string;
    }
    return typeof dataset.borderColor === 'string'
      ? dataset.borderColor
      : 'rgb(255, 99, 132)';
  };

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 20);
  }

  // Draw pie
  let startAngle = 0;
  values.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();

    ctx.fillStyle = getBackgroundColor(index);
    ctx.strokeStyle = getBorderColor(index);
    ctx.lineWidth = dataset.borderWidth || 1;

    ctx.fill();
    ctx.stroke();

    // Calculate position for label
    const labelAngle = startAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
    const labelY = centerY + Math.sin(labelAngle) * (radius + 20);

    // Draw label
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[index], labelX, labelY);

    startAngle += sliceAngle;
  });

  // Draw legend
  if (dataset.label) {
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dataset.label, width / 2, height - 20);
  }
}

// Function to render a line chart on a canvas
function renderLineChart(canvas: HTMLCanvasElement, chartData: ChartData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get dimensions
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;

  // Find max value for scaling
  const maxValue = Math.max(...values);

  // Calculate point spacing
  const pointCount = values.length;
  const pointSpacing = availableWidth / (pointCount - 1);

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 20);
  }

  // Get colors with fallbacks
  const lineColor =
    typeof dataset.borderColor === 'string'
      ? dataset.borderColor
      : 'rgb(54, 162, 235)';

  const fillColor =
    typeof dataset.backgroundColor === 'string'
      ? dataset.backgroundColor
      : 'rgba(54, 162, 235, 0.1)';

  // Draw the line
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding + index * pointSpacing;
    const y = height - padding - (value / maxValue) * availableHeight;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      // Use curved lines if tension is set
      if (dataset.tension && index > 0) {
        const prevX = padding + (index - 1) * pointSpacing;
        const prevY =
          height - padding - (values[index - 1] / maxValue) * availableHeight;

        const cpX1 = prevX + (x - prevX) / 3;
        const cpX2 = prevX + (2 * (x - prevX)) / 3;

        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  });

  // Draw fill if needed
  if (dataset.fill) {
    ctx.lineTo(padding + (pointCount - 1) * pointSpacing, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  } else {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = dataset.borderWidth || 2;
    ctx.stroke();
  }

  // Reset path for points
  ctx.beginPath();

  // Draw points and labels
  values.forEach((value, index) => {
    const x = padding + index * pointSpacing;
    const y = height - padding - (value / maxValue) * availableHeight;

    // Draw point
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw value
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value.toString(), x, y - 10);

    // Draw label
    if (labels[index]) {
      ctx.fillStyle = 'black';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x, height - padding + 15);
    }
  });

  // Draw legend
  if (dataset.label) {
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dataset.label, width / 2, 40);
  }
}

// Function to render a polar area chart on a canvas
function renderPolarAreaChart(canvas: HTMLCanvasElement, chartData: ChartData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get dimensions
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 60; // Smaller radius to leave room for labels

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;

  // Find max value for scaling
  const maxValue = Math.max(...values);

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 20);
  }

  // Colors
  const getBackgroundColor = (index: number) => {
    if (
      Array.isArray(dataset.backgroundColor) &&
      index < dataset.backgroundColor.length
    ) {
      return dataset.backgroundColor[index] as string;
    }
    return typeof dataset.backgroundColor === 'string'
      ? dataset.backgroundColor
      : 'rgba(255, 99, 132, 0.2)';
  };

  const getBorderColor = (index: number) => {
    if (
      Array.isArray(dataset.borderColor) &&
      index < dataset.borderColor.length
    ) {
      return dataset.borderColor[index] as string;
    }
    return typeof dataset.borderColor === 'string'
      ? dataset.borderColor
      : 'rgb(255, 99, 132)';
  };

  // Calculate the angle between each segment
  const segmentAngle = (2 * Math.PI) / values.length;

  // Draw each segment
  values.forEach((value, index) => {
    // Scale the radius based on the value
    const segmentRadius = (value / maxValue) * radius;

    // Calculate angles for this segment
    const startAngle = index * segmentAngle - Math.PI / 2; // Start from top
    const endAngle = (index + 1) * segmentAngle - Math.PI / 2;

    // Draw the segment
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, segmentRadius, startAngle, endAngle);
    ctx.closePath();

    // Fill and stroke the segment
    ctx.fillStyle = getBackgroundColor(index);
    ctx.strokeStyle = getBorderColor(index);
    ctx.lineWidth = dataset.borderWidth || 1;
    ctx.fill();
    ctx.stroke();

    // Calculate position for label
    const labelAngle = startAngle + segmentAngle / 2;
    const labelRadius = radius + 20; // Position labels just outside the chart
    const labelX = centerX + Math.cos(labelAngle) * labelRadius;
    const labelY = centerY + Math.sin(labelAngle) * labelRadius;

    // Draw label
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[index], labelX, labelY);

    // Draw value within the segment
    const valueX = centerX + Math.cos(labelAngle) * (segmentRadius / 2);
    const valueY = centerY + Math.sin(labelAngle) * (segmentRadius / 2);
    ctx.fillStyle = 'black';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value.toString(), valueX, valueY);
  });

  // Draw legend
  if (dataset.label) {
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dataset.label, width / 2, height - 20);
  }
}

// Function to render charts based on type
function renderChart(canvas: HTMLCanvasElement, chartData: ChartData) {
  if (!canvas || !chartData) return;

  // Set canvas size to its display size
  canvas.width = canvas.offsetWidth;
  canvas.height = 400;

  try {
    console.log(`Rendering ${chartData.type} chart...`);

    if (chartData.type === 'bar') {
      renderBarChart(canvas, chartData);
    } else if (chartData.type === 'pie' || chartData.type === 'doughnut') {
      renderPieChart(canvas, chartData);
    } else if (chartData.type === 'line') {
      renderLineChart(canvas, chartData);
    } else if (chartData.type === 'polarArea') {
      renderPolarAreaChart(canvas, chartData);
    } else {
      // For unsupported chart types, show a message
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          `Chart type '${chartData.type}' is currently being implemented`,
          canvas.width / 2,
          canvas.height / 2,
        );
      }
    }

    console.log('Chart rendered successfully');
  } catch (error) {
    console.error('Error rendering chart:', error);
  }
}

export const chartComposer = new Composer<'chart', ChartComposerMetadata>({
  kind: 'chart',
  description:
    'Create and display interactive charts and graphs for data visualization',
  initialize: async ({ setMetadata }) => {
    setMetadata({
      chartData: null,
      editMode: 'visual',
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setComposer }) => {
    if (streamPart.type === 'text-delta') {
      try {
        const contentStr = streamPart.content as string;
        console.log(
          '[ComposerClient onStreamPart] Received text-delta length:',
          contentStr.length,
        );

        let parsedChartDataFromStream: ChartData | null = null;
        const hasBeginMarker = contentStr.includes('CHART_DATA_BEGIN');
        const hasEndMarker = contentStr.includes('CHART_DATA_END');

        if (hasBeginMarker && hasEndMarker) {
          try {
            const startIndex =
              contentStr.indexOf('CHART_DATA_BEGIN') +
              'CHART_DATA_BEGIN'.length;
            const endIndex = contentStr.indexOf('CHART_DATA_END');
            if (startIndex >= 0 && endIndex > startIndex) {
              const jsonStr = contentStr.substring(startIndex, endIndex).trim();
              parsedChartDataFromStream = JSON.parse(jsonStr) as ChartData;
              console.log(
                '[ComposerClient onStreamPart] Parsed chart data from markers:',
                parsedChartDataFromStream.type,
              );
            }
          } catch (error) {
            console.error(
              '[ComposerClient onStreamPart] Failed to parse chart data between markers:',
              error,
            );
          }
        } else if (
          contentStr.trim().startsWith('{') &&
          contentStr.includes('"type"')
        ) {
          try {
            const jsonStartIndex = contentStr.indexOf('{');
            const jsonEndIndex = contentStr.lastIndexOf('}') + 1;
            if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
              const jsonStr = contentStr.substring(
                jsonStartIndex,
                jsonEndIndex,
              );
              parsedChartDataFromStream = JSON.parse(jsonStr) as ChartData;
              console.log(
                '[ComposerClient onStreamPart] Parsed chart data from raw JSON:',
                parsedChartDataFromStream.type,
              );
            }
          } catch (error) {
            console.error(
              '[ComposerClient onStreamPart] Failed to parse chart data from raw JSON:',
              error,
            );
          }
        }

        if (parsedChartDataFromStream) {
          // Validate chart data structure before setting
          const isValid =
            parsedChartDataFromStream.type &&
            parsedChartDataFromStream.data &&
            Array.isArray(parsedChartDataFromStream.data) &&
            parsedChartDataFromStream.data.length > 0;

          if (isValid) {
            setMetadata((metadata) => {
              console.log(
                '[ComposerClient onStreamPart] Updating metadata with chartData from stream:',
                parsedChartDataFromStream.type,
              );
              return {
                ...metadata,
                chartData: parsedChartDataFromStream,
              };
            });
          } else {
            console.warn(
              '[ComposerClient onStreamPart] Invalid chart data, skipping:',
              parsedChartDataFromStream,
            );
          }
        }

        setComposer((draftComposer) => ({
          ...draftComposer,
          // IMPORTANT: The server sends the whole block with markers as one text-delta.
          // So, composer.content will store the string with markers.
          content: draftComposer.content + (streamPart.content as string),
          isVisible:
            draftComposer.status === 'streaming' &&
            draftComposer.content.length > 50
              ? true
              : draftComposer.isVisible,
          status: 'streaming',
        }));
      } catch (error) {
        console.error(
          '[ComposerClient onStreamPart] Error handling stream part:',
          error,
        );
      }
    }
  },
  content: ({
    content, // This `content` is the string from the database, likely with markers
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    status,
    metadata, // This `metadata` is from the useComposer hook
    setMetadata,
  }) => {
    const [localChartData, setLocalChartData] = useState<ChartData | null>(
      null,
    );
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      console.log('[ComposerClient Content] useEffect for parsing triggered.');
      console.log(
        '[ComposerClient Content] Initial metadata.chartData type:',
        metadata?.chartData?.type,
      );
      console.log(
        '[ComposerClient Content] Initial `content` prop (first 100 chars):',
        content?.substring(0, 100),
      );

      const parseContentStringToChartData = (
        contentString: string,
      ): ChartData | null => {
        try {
          const hasBeginMarker = contentString.includes('CHART_DATA_BEGIN');
          const hasEndMarker = contentString.includes('CHART_DATA_END');

          if (hasBeginMarker && hasEndMarker) {
            const startIndex =
              contentString.indexOf('CHART_DATA_BEGIN') +
              'CHART_DATA_BEGIN'.length;
            const endIndex = contentString.indexOf('CHART_DATA_END');
            if (startIndex >= 0 && endIndex > startIndex) {
              const jsonStr = contentString
                .substring(startIndex, endIndex)
                .trim();
              console.log(
                '[ComposerClient Content] Extracted JSON from markers in content string:',
                `${jsonStr.substring(0, 100)}...`,
              );
              const parsed = JSON.parse(jsonStr) as ChartData;
              if (parsed?.type && parsed?.data) {
                console.log(
                  '[ComposerClient Content] Successfully parsed from markers:',
                  parsed.type,
                );
                return parsed;
              }
            } else {
              console.warn(
                '[ComposerClient Content] Markers found but invalid substring indices.',
              );
            }
          } else {
            console.log(
              '[ComposerClient Content] No markers in content string, trying raw JSON parse.',
            );
            const parsed = JSON.parse(contentString) as ChartData;
            if (parsed?.type && parsed?.data) {
              console.log(
                '[ComposerClient Content] Successfully parsed raw JSON from content string:',
                parsed.type,
              );
              return parsed;
            }
          }
          console.warn(
            '[ComposerClient Content] Parsed data from content string is not valid chart data.',
          );
        } catch (e) {
          console.error(
            '[ComposerClient Content] Error parsing content string to ChartData:',
            e,
          );
        }
        return null;
      };

      if (metadata?.chartData) {
        console.log(
          '[ComposerClient Content] Using chartData directly from metadata:',
          metadata.chartData.type,
        );
        setLocalChartData(metadata.chartData);
      } else if (content) {
        console.log(
          '[ComposerClient Content] metadata.chartData is null/undefined. Trying to parse from `content` prop.',
        );
        const parsedDataFromContent = parseContentStringToChartData(content);
        if (parsedDataFromContent) {
          console.log(
            '[ComposerClient Content] Successfully parsed chartData from `content` prop, type:',
            parsedDataFromContent.type,
          );
          setLocalChartData(parsedDataFromContent);
          // Update metadata to be the source of truth once parsed from content
          setMetadata((current) => {
            console.log(
              '[ComposerClient Content] Updating metadata with chartData parsed from content.',
            );
            return {
              ...current,
              chartData: parsedDataFromContent,
            };
          });
        } else {
          console.warn(
            '[ComposerClient Content] Failed to parse chartData from `content` prop. `localChartData` will be null.',
          );
          setLocalChartData(null);
        }
      } else {
        console.log(
          '[ComposerClient Content] No metadata.chartData and no content string. Setting `localChartData` to null.',
        );
        setLocalChartData(null);
      }
    }, [content, metadata, setMetadata]);

    // Effect to render chart when data changes or canvas is ready
    useEffect(() => {
      if (!localChartData || !canvasRef.current) {
        if (!localChartData)
          console.log(
            '[ComposerClient RenderEffect] No localChartData to render.',
          );
        if (!canvasRef.current)
          console.log('[ComposerClient RenderEffect] Canvas ref not ready.');
        return;
      }
      console.log(
        '[ComposerClient RenderEffect] Rendering chart with localChartData, type:',
        localChartData.type,
      );
      renderChart(canvasRef.current, localChartData);
    }, [localChartData]);

    // Toggle between visual and code modes
    const toggleEditMode = () => {
      setMetadata((current) => ({
        ...current,
        editMode: current.editMode === 'visual' ? 'code' : 'visual',
      }));
    };

    // Function to handle chart type changes
    const handleChartTypeChange = (newType: string) => {
      if (!localChartData) return;
      try {
        const updatedChartData: ChartData = {
          ...localChartData,
          type: newType as ChartData['type'],
        };
        if (newType === 'line') {
          updatedChartData.data.datasets = updatedChartData.data.datasets.map(
            (dataset) => ({ ...dataset, fill: false, tension: 0.4 }),
          );
        } else if (newType === 'bar') {
          updatedChartData.data.datasets = updatedChartData.data.datasets.map(
            (dataset) => ({ ...dataset, fill: undefined, tension: undefined }),
          );
        }
        setLocalChartData(updatedChartData);
        setMetadata((current) => ({ ...current, chartData: updatedChartData }));
        const updatedContent = JSON.stringify(updatedChartData, null, 2);
        // Wrap with markers for consistency when saving if preferred, or save raw JSON
        // For now, let's save raw JSON when changed via UI, server will wrap if it processes.
        // Or, to be super safe, always wrap when saving if editMode is 'visual'
        const contentToSave =
          metadata?.editMode === 'visual'
            ? `CHART_DATA_BEGIN
${updatedContent}
CHART_DATA_END`
            : updatedContent;
        onSaveContent(contentToSave, true);
        toast.success(`Changed chart type to ${newType}`);
      } catch (error) {
        console.error('Error changing chart type:', error);
        toast.error('Failed to change chart type');
      }
    };

    // Code editor for manual chart configuration
    const updateChartConfig = (newConfig: string) => {
      // Used in 'code' mode
      try {
        // In code mode, newConfig is the raw content string
        const parsed = JSON.parse(newConfig); // User expected to provide valid JSON
        if (parsed?.type && parsed?.data) {
          setLocalChartData(parsed);
          setMetadata((current) => ({ ...current, chartData: parsed }));
          // Here, onSaveContent directly saves the newConfig string.
          // If markers are desired even for code mode edits, they should be added here or by the server.
          // For now, assume newConfig from code editor is what user wants as the content string.
          onSaveContent(newConfig, true);
        } else {
          toast.error('Invalid chart configuration: Missing type or data.');
        }
      } catch (error) {
        toast.error('Invalid chart configuration: Not valid JSON.');
        console.error('Error updating chart config from textarea:', error);
      }
    };

    // Helper to format chart type names for display (defensive)
    const formatChartTypeName = (type?: string) => {
      const safeType =
        typeof type === 'string' && type.length > 0 ? type : 'bar';
      if (safeType === 'polarArea') return 'Polar Area';
      let name = `${safeType.charAt(0).toUpperCase()}${safeType.slice(1)}`;
      name = name.replace('Area', ' Area'); // e.g., PolarArea -> Polar Area
      name = name.replace('chart', ' Chart'); // e.g., Barchart -> Bar Chart (if it occurred)
      return name;
    };

    return (
      <div className="flex flex-col items-center p-8 w-full">
        {metadata?.editMode === 'visual' ? (
          <>
            {localChartData ? (
              <div className="w-full max-w-3xl">
                <div className="chart-container relative">
                  <div className="absolute top-2 right-2 z-10">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => {
                          const dropdown = document.getElementById(
                            'chart-type-dropdown',
                          );
                          if (dropdown) {
                            dropdown.classList.toggle('hidden');
                          }
                        }}
                        className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-2 text-xs flex items-center gap-1"
                      >
                        <span>{`Chart Type: ${formatChartTypeName(localChartData.type)}`}</span>
                        <svg
                          width="10"
                          height="6"
                          viewBox="0 0 10 6"
                          fill="none"
                        >
                          <path
                            d="M1 1L5 5L9 1"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <div
                        id="chart-type-dropdown"
                        className="hidden absolute right-0 mt-1 w-36 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-50"
                      >
                        <div className="py-1">
                          {[
                            'bar',
                            'line',
                            'pie',
                            'doughnut',
                            'polarArea',
                            'radar',
                            'scatter',
                            'bubble',
                          ].map((type) => (
                            <button
                              key={type}
                              type="button"
                              className={`px-4 py-2 text-sm w-full text-left ${localChartData.type === type ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
                              onClick={() => handleChartTypeChange(type)}
                            >
                              {formatChartTypeName(type)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="w-full" />
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    {`Chart type: ${formatChartTypeName(localChartData.type)}`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-12 border rounded-lg border-dashed">
                <p className="text-muted-foreground">
                  {(() => {
                    const message = content
                      ? 'Processing chart configuration...'
                      : 'No chart data available yet';
                    console.log(
                      `[ComposerClient Content] Fallback UI: "${message}". localChartData is null. Content exists: ${!!content}. Metadata chartData exists: ${!!metadata?.chartData}`,
                    );
                    return message;
                  })()}
                </p>
                {content && (
                  <div className="text-xs mt-4 text-gray-500 overflow-auto max-h-32">
                    <pre>
                      Content (first 100): {content.substring(0, 100)}...
                    </pre>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="mt-4 text-sm text-blue-500 hover:underline"
              onClick={toggleEditMode}
            >
              Edit Chart Configuration
            </button>
          </>
        ) : (
          <div className="w-full max-w-3xl">
            <textarea
              className="w-full h-80 p-4 font-mono text-sm border rounded-lg"
              value={content || ''}
              onChange={(e) => updateChartConfig(e.target.value)}
            />
            <button
              type="button"
              className="mt-4 text-sm text-blue-500 hover:underline"
              onClick={toggleEditMode}
            >
              View Chart
            </button>
          </div>
        )}
      </div>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy chart configuration',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Chart configuration copied to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download as PNG',
      onClick: async ({ metadata }) => {
        try {
          const chartDiv = document.querySelector('.chart-container canvas');
          if (chartDiv) {
            const dataUrl = (chartDiv as HTMLCanvasElement).toDataURL(
              'image/png',
            );
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'chart.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success('Chart downloaded as PNG');
          } else {
            toast.error('Chart not found for download');
          }
        } catch (error) {
          console.error('Error downloading chart:', error);
          toast.error('Failed to download chart');
        }
      },
    },
  ],
  toolbar: [
    {
      description: 'Format chart',
      icon: <SparklesIcon />,
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Please improve the formatting of this chart to make it more professional and easier to read.',
        });
      },
    },
    {
      description: 'Suggest improvements',
      icon: <MessageIcon />,
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Can you suggest improvements or alternative ways to visualize this data?',
        });
      },
    },
  ],
});
