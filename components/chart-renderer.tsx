import { useEffect, useRef, useState } from 'react';
import type { ChartData } from '@/artifacts/chart/client';
import { Button } from './ui/button';
import { ChartIcon, LineChartIcon } from './icons';

// Default color palette for better chart appearance
const DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

// Function to get professional colors for charts
function getDefaultColors(count: number) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
  }
  return colors;
}

// Function to render a bar chart on a canvas
function renderBarChart(canvas: HTMLCanvasElement, chartData: ChartData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get dimensions
  const width = canvas.width;
  const height = canvas.height;
  const padding = 60;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;

  // Find max value for scaling
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue;
  const scaledMax = range > 0 ? maxValue + range * 0.1 : maxValue * 1.1; // Add 10% padding

  // Calculate bar width
  const barCount = values.length;
  const barWidth = Math.max(8, (availableWidth / barCount) * 0.7);
  const spacing = (availableWidth - barWidth * barCount) / (barCount + 1);

  // Set up styling
  ctx.fillStyle = '#374151'; // Gray-700
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 30);
  }

  // Draw grid lines and y-axis labels
  const gridLines = 5;
  ctx.strokeStyle = '#E5E7EB'; // Gray-200
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6B7280'; // Gray-500
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (availableHeight / gridLines) * i;
    const value = scaledMax - (scaledMax / gridLines) * i;
    
    // Draw grid line
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    
    // Draw y-axis label
    ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
  }

  // Get default colors if not provided
  const defaultColors = getDefaultColors(values.length);
  
  // Draw bars
  values.forEach((value, index) => {
    const x = padding + spacing + index * (barWidth + spacing);
    const barHeight = (value / scaledMax) * availableHeight;
    const y = height - padding - barHeight;

    // Get colors with improved defaults
    let fillColor = defaultColors[index];
    let strokeColor = fillColor;

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

    // Add gradient effect
    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, fillColor + '80'); // Add transparency

    ctx.fillStyle = gradient;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    // Draw rounded rectangle
    const radius = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
    ctx.fill();
    ctx.stroke();

    // Draw value on top of bar
    ctx.fillStyle = '#374151'; // Gray-700
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value.toString(), x + barWidth / 2, y - 8);

    // Draw label below x-axis
    if (labels[index]) {
      ctx.fillStyle = '#6B7280'; // Gray-500
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);
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

// Function to render a pie chart on a canvas
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
  const radius = Math.min(width, height) / 2 - 80;

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;
  const total = values.reduce((sum, value) => sum + value, 0);

  // Get default colors
  const defaultColors = getDefaultColors(values.length);

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
      : defaultColors[index];
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
      : '#FFFFFF';
  };

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillStyle = '#374151'; // Gray-700
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 30);
  }

  // Draw pie with enhanced styling
  let startAngle = -Math.PI / 2; // Start from top
  values.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    const percentage = ((value / total) * 100).toFixed(1);

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();

    ctx.fillStyle = getBackgroundColor(index);
    ctx.strokeStyle = getBorderColor(index);
    ctx.lineWidth = 3;

    ctx.fill();
    ctx.stroke();

    // Calculate position for label
    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius + 25;
    const labelX = centerX + Math.cos(labelAngle) * labelRadius;
    const labelY = centerY + Math.sin(labelAngle) * labelRadius;

    // Draw label with percentage
    ctx.fillStyle = '#374151'; // Gray-700
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${labels[index]}`, labelX, labelY - 6);
    ctx.fillStyle = '#6B7280'; // Gray-500
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${percentage}%`, labelX, labelY + 6);

    // Draw line from slice to label
    const lineStartX = centerX + Math.cos(labelAngle) * (radius + 5);
    const lineStartY = centerY + Math.sin(labelAngle) * (radius + 5);
    const lineEndX = centerX + Math.cos(labelAngle) * (radius + 20);
    const lineEndY = centerY + Math.sin(labelAngle) * (radius + 20);
    
    ctx.strokeStyle = '#9CA3AF'; // Gray-400
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();

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
  const padding = 60;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  // Get data
  const labels = chartData.data.labels;
  const dataset = chartData.data.datasets[0];
  const values = dataset.data;

  // Find max and min values for scaling
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue;
  const scaledMax = range > 0 ? maxValue + range * 0.1 : maxValue * 1.1;
  const scaledMin = range > 0 ? minValue - range * 0.1 : minValue * 0.9;

  // Calculate point spacing
  const pointCount = values.length;
  const pointSpacing = availableWidth / (pointCount - 1);

  // Draw title if available
  if (chartData.options?.plugins?.title?.text) {
    ctx.fillStyle = '#374151'; // Gray-700
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.options.plugins.title.text, width / 2, 30);
  }

  // Draw grid lines and axes
  const gridLines = 5;
  ctx.strokeStyle = '#E5E7EB'; // Gray-200
  ctx.lineWidth = 1;
  
  // Y-axis grid lines and labels
  ctx.fillStyle = '#6B7280'; // Gray-500
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (availableHeight / gridLines) * i;
    const value = scaledMax - ((scaledMax - scaledMin) / gridLines) * i;
    
    // Draw grid line
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    
    // Draw y-axis label
    ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
  }

  // Get default colors
  const defaultColors = getDefaultColors(1);
  
  // Get colors with improved defaults
  const lineColor =
    typeof dataset.borderColor === 'string'
      ? dataset.borderColor
      : defaultColors[0];

  const fillColor =
    typeof dataset.backgroundColor === 'string'
      ? dataset.backgroundColor
      : defaultColors[0] + '20'; // Add transparency

  // Draw area fill if needed
  if (dataset.fill) {
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = padding + index * pointSpacing;
      const y = height - padding - ((value - scaledMin) / (scaledMax - scaledMin)) * availableHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        if (dataset.tension && dataset.tension > 0) {
          // Smooth curves
          const prevX = padding + (index - 1) * pointSpacing;
          const prevY = height - padding - ((values[index - 1] - scaledMin) / (scaledMax - scaledMin)) * availableHeight;
          const cpX1 = prevX + (x - prevX) * 0.5;
          const cpX2 = prevX + (x - prevX) * 0.5;
          ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    // Close the area
    const lastX = padding + (pointCount - 1) * pointSpacing;
    ctx.lineTo(lastX, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  // Draw the line
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding + index * pointSpacing;
    const y = height - padding - ((value - scaledMin) / (scaledMax - scaledMin)) * availableHeight;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      if (dataset.tension && dataset.tension > 0) {
        // Smooth curves
        const prevX = padding + (index - 1) * pointSpacing;
        const prevY = height - padding - ((values[index - 1] - scaledMin) / (scaledMax - scaledMin)) * availableHeight;
        const cpX1 = prevX + (x - prevX) * 0.5;
        const cpX2 = prevX + (x - prevX) * 0.5;
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  });

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw points and labels
  values.forEach((value, index) => {
    const x = padding + index * pointSpacing;
    const y = height - padding - ((value - scaledMin) / (scaledMax - scaledMin)) * availableHeight;

    // Draw point with glow effect
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw value above point
    ctx.fillStyle = '#374151'; // Gray-700
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value.toString(), x, y - 15);

    // Draw x-axis label
    if (labels[index]) {
      ctx.fillStyle = '#6B7280'; // Gray-500
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x, height - padding + 20);
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
  if (!canvas || !chartData) {
    console.error('renderChart called without canvas or chartData');
    return;
  }

  // Set canvas size with higher resolution for crisp rendering
  const displayWidth = canvas.offsetWidth || 600;
  const displayHeight = 400;
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  canvas.width = displayWidth * devicePixelRatio;
  canvas.height = displayHeight * devicePixelRatio;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  try {
    console.log(`Rendering ${chartData.type} chart with data:`, {
      labels: chartData.data.labels,
      datasets: chartData.data.datasets.length,
      firstDatasetPoints: chartData.data.datasets[0]?.data?.length || 0,
    });

    // Create a temporary canvas element with display dimensions for the rendering functions
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = displayWidth;
    tempCanvas.height = displayHeight;
    
    if (chartData.type === 'bar') {
      console.log('Using renderBarChart');
      renderBarChart(tempCanvas, chartData);
    } else if (chartData.type === 'pie' || chartData.type === 'doughnut') {
      console.log('Using renderPieChart');
      renderPieChart(tempCanvas, chartData);
    } else if (chartData.type === 'line') {
      console.log('Using renderLineChart');
      renderLineChart(tempCanvas, chartData);
    } else if (chartData.type === 'polarArea') {
      console.log('Using renderPolarAreaChart');
      renderPolarAreaChart(tempCanvas, chartData);
    } else {
      // For unsupported chart types, show a message
      console.warn(`Unsupported chart type: ${chartData.type}`);
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.fillStyle = '#374151';
        tempCtx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.fillText(
          `Chart type '${chartData.type}' is currently being implemented`,
          tempCanvas.width / 2,
          tempCanvas.height / 2,
        );
      }
    }
    
    // Copy the rendered content to the high-DPI canvas
    if (ctx) {
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    console.log('Chart rendered successfully');
  } catch (error) {
    console.error('Error rendering chart:', error);
  }
}

export function ChartRenderer({
  chartData,
  onChangeChartType,
}: {
  chartData: ChartData;
  onChangeChartType?: (newType: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !chartData) return;
    renderChart(canvasRef.current, chartData);
  }, [chartData]);

  const handleChartTypeChange = (newType: string) => {
    if (onChangeChartType) {
      onChangeChartType(newType);
    }
  };

  return (
    <div className="chart-renderer w-full">
      <div className="relative">
        {onChangeChartType && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowControls(!showControls)}
              className="h-8 w-8 p-0"
            >
              <ChartIcon size={16} />
            </Button>

            {showControls && (
              <div className="absolute right-0 mt-2 p-2 bg-white dark:bg-zinc-800 rounded-md shadow-md border border-zinc-200 dark:border-zinc-700">
                <div className="text-xs font-medium mb-1">Chart Type</div>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChartTypeChange('bar')}
                    className={`justify-start px-2 ${chartData.type === 'bar' ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
                  >
                    <ChartIcon size={14} />
                    <span className="ml-2 text-xs">Bar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChartTypeChange('line')}
                    className={`justify-start px-2 ${chartData.type === 'line' ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
                  >
                    <LineChartIcon size={14} />
                    <span className="ml-2 text-xs">Line</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChartTypeChange('pie')}
                    className={`justify-start px-2 ${chartData.type === 'pie' ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 2V12L17 17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="ml-2 text-xs">Pie</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChartTypeChange('polarArea')}
                    className={`justify-start px-2 ${chartData.type === 'polarArea' ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 2L12 22"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M2 12L22 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M5 5L19 19"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M19 5L5 19"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="ml-2 text-xs">Polar Area</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
