import { createDocumentHandler } from '@/lib/composer/server';

interface ChartData {
  type: string;
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

// Chart colors for consistent visualization
const CHART_COLORS = {
  red: 'rgb(255, 99, 132)',
  orange: 'rgb(255, 159, 64)',
  yellow: 'rgb(255, 205, 86)',
  green: 'rgb(75, 192, 192)',
  blue: 'rgb(54, 162, 235)',
  purple: 'rgb(153, 102, 255)',
  grey: 'rgb(201, 203, 207)',
};

// Default transparent backgrounds with solid borders
const DEFAULT_COLORS = Object.values(CHART_COLORS).map((color) =>
  color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
);
const DEFAULT_BORDERS = Object.values(CHART_COLORS);

export const chartDocumentHandler = createDocumentHandler({
  kind: 'chart',
  onCreateDocument: async ({ title, dataStream }) => {
    console.log('Creating chart document with title:', title);

    // Default empty chart configuration
    const defaultChart: ChartData = {
      type: 'bar',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May', 'June'],
        datasets: [
          {
            label: 'Sample Data',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: DEFAULT_COLORS[0],
            borderColor: DEFAULT_BORDERS[0],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: title,
          },
        },
      },
    };

    // Convert to string with proper formatting
    const chartContent = JSON.stringify(defaultChart, null, 2);
    console.log('Sending chart data via text-delta');

    // Send with a special marker to help client-side processing
    dataStream.write({
      'type': 'data',

      'value': [{
        type: 'text-delta',
        content: `CHART_DATA_BEGIN\n${chartContent}\nCHART_DATA_END`,
      }]
    });

    console.log('Chart document created successfully');

    // Return the serialized chart configuration as content
    return chartContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    try {
      // Parse the existing chart configuration
      const chartData: ChartData = JSON.parse(document.content || '{}');
      console.log(`Updating chart document: ${description.substring(0, 100)}`);

      // First, let's see if we need to change the chart type
      const chartTypeMatches = {
        line: [
          'line chart',
          'line graph',
          'linear chart',
          'linear graph',
          'time series',
        ],
        bar: ['bar chart', 'bar graph', 'column chart', 'histogram'],
        pie: ['pie chart', 'circular chart', 'donut chart'],
        doughnut: ['donut chart', 'doughnut chart', 'ring chart'],
        radar: ['radar chart', 'spider chart', 'web chart'],
        polarArea: [
          'polar area',
          'polar chart',
          'polar area chart',
          'radial chart',
        ],
        scatter: ['scatter plot', 'scatter chart', 'scatter graph'],
        bubble: ['bubble chart', 'bubble graph'],
      };

      const updatedChartData = { ...chartData };
      let hasChanges = false;

      // Check for chart type changes in the description
      const descLower = description.toLowerCase();

      for (const [chartType, keywords] of Object.entries(chartTypeMatches)) {
        if (keywords.some((keyword) => descLower.includes(keyword))) {
          if (chartData.type !== chartType) {
            console.log(
              `Changing chart type from ${chartData.type} to ${chartType}`,
            );
            updatedChartData.type = chartType;
            hasChanges = true;

            // Add special properties for certain chart types
            if (chartType === 'line') {
              updatedChartData.data.datasets.forEach((dataset) => {
                dataset.fill = false;
                dataset.tension = 0.4; // Slight curve for better visualization
              });
            } else if (chartType === 'scatter' || chartType === 'bubble') {
              // For scatter and bubble, we need to make sure the background color is visible
              updatedChartData.data.datasets.forEach((dataset, index) => {
                const colorKey = Object.keys(CHART_COLORS)[
                  index % Object.keys(CHART_COLORS).length
                ] as keyof typeof CHART_COLORS;
                dataset.backgroundColor = CHART_COLORS[colorKey];
              });
            }
          }
          break;
        }
      }

      // Check for title changes
      const titleMatch =
        description.match(/change title to ["'](.+?)["']/i) ??
        description.match(/title should be ["'](.+?)["']/i) ??
        description.match(/rename to ["'](.+?)["']/i);

      if (titleMatch?.[1]) {
        const newTitle = titleMatch[1];
        updatedChartData.options = updatedChartData.options || {};
        updatedChartData.options.plugins =
          updatedChartData.options.plugins || {};
        updatedChartData.options.plugins.title =
          updatedChartData.options.plugins.title || {};

        updatedChartData.options.plugins.title.display = true;
        updatedChartData.options.plugins.title.text = newTitle;
        hasChanges = true;
      }

      // Check for color changes
      if (
        descLower.includes('color') ||
        descLower.includes('colours') ||
        descLower.includes('colors')
      ) {
        // If user wants different colors
        // For bar and pie charts, use different colors for each data point
        if (
          ['bar', 'pie', 'doughnut', 'polarArea'].includes(
            updatedChartData.type,
          )
        ) {
          updatedChartData.data.datasets[0].backgroundColor = DEFAULT_COLORS;
          updatedChartData.data.datasets[0].borderColor = DEFAULT_BORDERS;
          hasChanges = true;
        }
        // For line charts, use a single color but make it vibrant
        else if (updatedChartData.type === 'line') {
          // Choose a nice color for line charts
          const lineColor = CHART_COLORS.blue;
          updatedChartData.data.datasets[0].borderColor = lineColor;
          updatedChartData.data.datasets[0].backgroundColor = lineColor
            .replace('rgb', 'rgba')
            .replace(')', ', 0.1)');
          hasChanges = true;
        }
      }

      // Build the updated chart content
      const finalChartContent = JSON.stringify(updatedChartData, null, 2);

      // Send the updated chart data
      dataStream.write({
        'type': 'data',

        'value': [{
          type: 'text-delta',
          content: `CHART_DATA_BEGIN\n${finalChartContent}\nCHART_DATA_END`,
        }]
      });

      if (hasChanges) {
        console.log('Chart data updated successfully');
        return finalChartContent;
      } else {
        console.log('No changes detected in chart update request');
        return document.content || '{}';
      }
    } catch (error) {
      console.error('Error updating chart document:', error);
      return document.content || '{}';
    }
  },
});
