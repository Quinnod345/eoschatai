/**
 * Circle.so API Client
 * Handles fetching course content from Circle.so for course assistant personas
 */

interface CircleLesson {
  id: string;
  title: string;
  content: string; // HTML/markdown content
  order: number;
  description?: string;
}

interface CircleCourse {
  id: string;
  name: string;
  description: string;
  lessons: CircleLesson[];
}

interface CircleAPIConfig {
  apiToken: string;
  baseUrl: string;
  spaceId: string;
}

/**
 * Get Circle.so API configuration from environment variables
 */
function getCircleConfig(): CircleAPIConfig {
  const apiToken = process.env.CIRCLE_API_TOKEN;
  const baseUrl =
    process.env.CIRCLE_API_BASE_URL || 'https://api.circle.so/v1';
  const spaceId = process.env.CIRCLE_SPACE_ID || '';

  if (!apiToken) {
    throw new Error('CIRCLE_API_TOKEN environment variable is not set');
  }

  return {
    apiToken,
    baseUrl,
    spaceId,
  };
}

/**
 * Make authenticated request to Circle.so API
 */
async function circleRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getCircleConfig();

  const url = `${config.baseUrl}${endpoint}`;
  const headers = {
    Authorization: `Token ${config.apiToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  console.log(`[Circle API] Requesting: ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Circle API] Error response:`, errorText);
      throw new Error(
        `Circle.so API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`[Circle API] Request failed:`, error);
    throw error;
  }
}

/**
 * Convert HTML content to plain text for embedding
 * Strips HTML tags and normalizes whitespace
 */
function htmlToPlainText(html: string): string {
  if (!html) return '';

  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Replace <br> and </p> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  // Trim each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  return text.trim();
}

/**
 * Fetch course details from Circle.so
 */
export async function fetchCourseDetails(
  spaceId: string,
  courseId: string,
): Promise<{ name: string; description: string }> {
  try {
    console.log(
      `[Circle API] Fetching course details for courseId: ${courseId}`,
    );

    // Note: Adjust endpoint based on actual Circle.so API documentation
    // This is a placeholder structure - update with actual Circle.so API endpoints
    const response = await circleRequest<{
      name: string;
      description: string;
      body?: string;
    }>(`/spaces/${spaceId}/courses/${courseId}`);

    return {
      name: response.name,
      description: response.description || response.body || '',
    };
  } catch (error) {
    console.error('[Circle API] Error fetching course details:', error);
    throw new Error(`Failed to fetch course details: ${error}`);
  }
}

/**
 * Fetch all lessons for a course from Circle.so
 */
export async function fetchCourseLessons(
  spaceId: string,
  courseId: string,
): Promise<CircleLesson[]> {
  try {
    console.log(`[Circle API] Fetching lessons for courseId: ${courseId}`);

    // Note: Adjust endpoint based on actual Circle.so API documentation
    // This is a placeholder structure - update with actual Circle.so API endpoints
    const response = await circleRequest<{
      records: Array<{
        id: string;
        name: string;
        body: string;
        position?: number;
        description?: string;
      }>;
      next_page?: string;
    }>(`/spaces/${spaceId}/courses/${courseId}/lessons`);

    const lessons: CircleLesson[] = response.records.map((lesson, index) => ({
      id: lesson.id,
      title: lesson.name,
      content: lesson.body,
      order: lesson.position !== undefined ? lesson.position : index,
      description: lesson.description,
    }));

    // Handle pagination if needed
    let nextPage = response.next_page;
    while (nextPage) {
      const paginatedResponse = await circleRequest<{
        records: Array<{
          id: string;
          name: string;
          body: string;
          position?: number;
          description?: string;
        }>;
        next_page?: string;
      }>(nextPage);

      const moreLessons = paginatedResponse.records.map((lesson, index) => ({
        id: lesson.id,
        title: lesson.name,
        content: lesson.body,
        order:
          lesson.position !== undefined
            ? lesson.position
            : lessons.length + index,
        description: lesson.description,
      }));

      lessons.push(...moreLessons);
      nextPage = paginatedResponse.next_page;
    }

    // Sort by order
    lessons.sort((a, b) => a.order - b.order);

    console.log(`[Circle API] Fetched ${lessons.length} lessons`);
    return lessons;
  } catch (error) {
    console.error('[Circle API] Error fetching course lessons:', error);
    throw new Error(`Failed to fetch course lessons: ${error}`);
  }
}

/**
 * Fetch complete course content including all lessons
 */
export async function fetchCourseContent(
  spaceId: string,
  courseId: string,
): Promise<CircleCourse> {
  try {
    console.log(
      `[Circle API] Fetching complete course content for courseId: ${courseId}`,
    );

    // Fetch course details and lessons in parallel
    const [courseDetails, lessons] = await Promise.all([
      fetchCourseDetails(spaceId, courseId),
      fetchCourseLessons(spaceId, courseId),
    ]);

    return {
      id: courseId,
      name: courseDetails.name,
      description: courseDetails.description,
      lessons,
    };
  } catch (error) {
    console.error('[Circle API] Error fetching course content:', error);
    throw error;
  }
}

/**
 * Convert course content to structured text documents for RAG processing
 * Returns an array of documents (one per lesson + course overview)
 */
export function courseToDocuments(course: CircleCourse): Array<{
  title: string;
  content: string;
  metadata: {
    lessonId?: string;
    order?: number;
    type: 'overview' | 'lesson';
  };
}> {
  const documents = [];

  // Create overview document
  documents.push({
    title: `${course.name} - Overview`,
    content: `# ${course.name}\n\n${htmlToPlainText(course.description)}`,
    metadata: {
      type: 'overview' as const,
    },
  });

  // Create a document for each lesson
  for (const lesson of course.lessons) {
    const lessonContent = htmlToPlainText(lesson.content);
    const description = lesson.description
      ? htmlToPlainText(lesson.description)
      : '';

    let content = `# ${lesson.title}\n\n`;
    if (description) {
      content += `${description}\n\n`;
    }
    content += lessonContent;

    documents.push({
      title: `${course.name} - Lesson ${lesson.order + 1}: ${lesson.title}`,
      content,
      metadata: {
        lessonId: lesson.id,
        order: lesson.order,
        type: 'lesson' as const,
      },
    });
  }

  console.log(
    `[Circle API] Converted course to ${documents.length} documents`,
  );
  return documents;
}

/**
 * Test Circle.so API connectivity
 */
export async function testCircleConnection(): Promise<boolean> {
  try {
    const config = getCircleConfig();
    console.log('[Circle API] Testing connection...');

    // Try to fetch space info or a simple endpoint
    await circleRequest(`/spaces/${config.spaceId}`);

    console.log('[Circle API] Connection test successful');
    return true;
  } catch (error) {
    console.error('[Circle API] Connection test failed:', error);
    return false;
  }
}


