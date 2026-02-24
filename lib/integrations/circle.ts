/**
 * Circle.so API Client
 * Handles fetching course content from Circle.so for course assistant personas
 */

interface CircleLesson {
  id: string;
  title: string;
  content: string; // Content (may be HTML, plain text, or markdown)
  order: number;
  description?: string;
  isHtml?: boolean; // Flag to indicate if content is HTML and needs conversion
}

interface CircleCourse {
  id: string;
  name: string;
  description: string;
  lessons: CircleLesson[];
}

interface CircleAPIConfig {
  apiToken: string;
  headlessAuthToken: string;
  baseUrl: string;
  spaceId: string;
}

/**
 * Get Circle.so API configuration from environment variables
 */
function getCircleConfig(): CircleAPIConfig {
  const apiToken = process.env.CIRCLE_API_TOKEN;
  const headlessAuthToken = process.env.CIRCLE_HEADLESS_AUTH_TOKEN;
  const baseUrl =
    process.env.CIRCLE_API_BASE_URL || 'https://app.circle.so/api/v1';
  const spaceId = process.env.CIRCLE_SPACE_ID || '';

  if (!apiToken) {
    throw new Error('CIRCLE_API_TOKEN environment variable is not set');
  }

  if (!headlessAuthToken) {
    throw new Error(
      'CIRCLE_HEADLESS_AUTH_TOKEN environment variable is not set',
    );
  }

  return {
    apiToken,
    headlessAuthToken,
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
    Authorization: `Bearer ${config.apiToken}`,
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
function htmlToPlainText(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') return '';

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
 * Note: Circle.so may call these "Courses" or "Space Groups" depending on the product
 */
export async function fetchCourseDetails(
  spaceId: string,
  courseId: string,
): Promise<{ name: string; description: string }> {
  try {
    console.log(
      `[Circle API] Fetching course details for courseId: ${courseId}`,
    );

    // Try fetching as a space group (Circle.so's course/learning module structure)
    const response = await circleRequest<{
      id: number;
      name: string;
      body?: string;
      description?: string;
      space_group?: {
        name: string;
        description?: string;
      };
    }>(`/space_groups/${courseId}`);

    return {
      name: response.space_group?.name || response.name || 'Untitled Course',
      description:
        response.space_group?.description ||
        response.description ||
        response.body ||
        '',
    };
  } catch (error) {
    console.error('[Circle API] Error fetching course details:', error);
    throw new Error(`Failed to fetch course details: ${error}`);
  }
}

/**
 * Generate a member authentication token for Headless API access
 * This uses the Headless Auth token to create a member token
 */
async function getMemberAuthToken(): Promise<string> {
  const config = getCircleConfig();

  try {
    // First, get the current admin user's email
    console.log('[Circle API] Fetching admin user email...');
    const meResponse = await circleRequest<{ email: string }>('/me');
    console.log(`[Circle API] Admin email: ${meResponse.email}`);

    // Generate a member access token using the Headless Auth token
    console.log('[Circle API] Generating member access token...');
    const response = await fetch(`${config.baseUrl}/headless/auth_token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.headlessAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: meResponse.email,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Circle API] Headless auth error (${response.status}):`,
        errorText,
      );
      throw new Error(
        `Failed to generate member token: ${response.status} - ${errorText}`,
      );
    }

    const authResponse = await response.json();
    console.log(
      `[Circle API] Successfully generated member token (expires: ${authResponse.access_token_expires_at})`,
    );
    return authResponse.access_token;
  } catch (error) {
    console.error('[Circle API] Error generating member auth token:', error);
    throw error;
  }
}

/**
 * Fetch all spaces within a space group
 */
async function fetchSpacesInGroup(spaceGroupId: string): Promise<number[]> {
  try {
    const response = await circleRequest<{
      space_order_array: number[];
    }>(`/space_groups/${spaceGroupId}`);

    return response.space_order_array || [];
  } catch (error) {
    console.error('[Circle API] Error fetching spaces in group:', error);
    return [];
  }
}

/**
 * Fetch lessons from a course-type space using Headless API
 */
async function fetchCourseLessonsFromSpace(
  spaceIdNum: number,
  memberToken: string,
): Promise<CircleLesson[]> {
  const lessons: CircleLesson[] = [];

  try {
    console.log(
      `[Circle API] Fetching course sections from space ${spaceIdNum}`,
    );

    // Fetch sections in the course
    const sectionsUrl = `https://app.circle.so/api/headless/v1/courses/${spaceIdNum}/sections`;
    console.log(`[Circle API] Requesting sections from: ${sectionsUrl}`);

    const sectionsResponse = await fetch(sectionsUrl, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sectionsResponse.ok) {
      const errorText = await sectionsResponse.text();
      console.error(
        `[Circle API] Failed to fetch sections (${sectionsResponse.status}):`,
        errorText.substring(0, 200),
      );
      return lessons;
    }

    const sectionsData = await sectionsResponse.json();
    console.log(
      `[Circle API] Full sections response for space ${spaceIdNum}:`,
      JSON.stringify(sectionsData, null, 2),
    );

    // Handle both response formats
    let sections = [];
    if (Array.isArray(sectionsData)) {
      sections = sectionsData;
    } else if (sectionsData.sections && Array.isArray(sectionsData.sections)) {
      sections = sectionsData.sections;
    } else {
      console.error('[Circle API] Unexpected sections response format:', sectionsData);
    }

    console.log(
      `[Circle API] Found ${sections.length} sections in course ${spaceIdNum}`,
    );

    // Fetch lessons from each section
    for (const section of sections) {
      console.log(
        `[Circle API] Processing section: ${section.name} (ID: ${section.id})`,
      );
      const sectionLessons = section.lessons || [];
      console.log(`[Circle API] Section has ${sectionLessons.length} lessons`);

      for (const lesson of sectionLessons) {
        // Fetch full lesson details
        try {
          const lessonUrl = `https://app.circle.so/api/headless/v1/courses/${spaceIdNum}/lessons/${lesson.id}`;
          console.log(`[Circle API] Fetching lesson from: ${lessonUrl}`);

          const lessonResponse = await fetch(lessonUrl, {
            headers: {
              Authorization: `Bearer ${memberToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (lessonResponse.ok) {
            const lessonData = await lessonResponse.json();
            const lessonObj = lessonData.lesson || lessonData;

            // Circle.so uses rich_text_body for lesson content
            // Get ALL content sources and combine them (don't truncate!)
            let content = '';
            let isHtml = false; // Track if content is HTML
            
            // Priority 1: Full rich text body (most complete - ALREADY PLAIN TEXT!)
            // Check if it exists AND has actual content (length > 0)
            if (lessonObj.rich_text_body?.body && 
                typeof lessonObj.rich_text_body.body === 'string' && 
                lessonObj.rich_text_body.body.trim().length > 0) {
              content = lessonObj.rich_text_body.body;
              isHtml = false; // rich_text_body.body is already plain text
            } 
            // Priority 2: Fallback text (PLAIN TEXT - often has the actual content!)
            else if (lessonObj.rich_text_body?.circle_ios_fallback_text &&
                     lessonObj.rich_text_body.circle_ios_fallback_text.trim().length > 0) {
              content = lessonObj.rich_text_body.circle_ios_fallback_text;
              isHtml = false; // Fallback text is already plain text
            }
            // Priority 3: Plain body field (THIS might be HTML)
            else if (lessonObj.body && lessonObj.body.trim().length > 0) {
              content = lessonObj.body;
              isHtml = true; // body field might contain HTML
            }
            
            // Also include description if available (prepend to content)
            let fullContent = content;
            if (lessonObj.description?.trim()) {
              fullContent = `${lessonObj.description}\n\n${content}`;
            }

            lessons.push({
              id: lessonObj.id?.toString() || lesson.id.toString(),
              title: lessonObj.name || lesson.name || 'Untitled Lesson',
              content: fullContent,
              order: lessons.length,
              description: lessonObj.description || '',
              isHtml, // Flag whether content needs HTML conversion
            });

            console.log(
              `[Circle API] ✅ Fetched lesson: ${lessonObj.name} (${fullContent.length} chars total, ${content.length} body, ${(lessonObj.description || '').length} desc)`,
            );
          } else {
            const errorText = await lessonResponse.text();
            console.error(
              `[Circle API] Failed to fetch lesson ${lesson.id}: ${lessonResponse.status}`,
              errorText.substring(0, 200),
            );
          }
        } catch (lessonError) {
          console.error(
            `[Circle API] Error fetching lesson ${lesson.id}:`,
            lessonError,
          );
        }
      }
    }
  } catch (error) {
    console.error(`[Circle API] Error fetching course sections:`, error);
  }

  return lessons;
}

/**
 * Fetch posts from a regular space using Headless API
 */
async function fetchPostsFromSpace(
  spaceIdNum: number,
  memberToken: string,
): Promise<CircleLesson[]> {
  const posts: CircleLesson[] = [];

  try {
    console.log(`[Circle API] Fetching posts from space ${spaceIdNum}`);

    let page = 1;
    let hasMore = true;
    let totalFetched = 0;

    // Paginate through ALL posts (not just first 100)
    while (hasMore) {
    const response = await fetch(
        `https://app.circle.so/api/headless/v1/spaces/${spaceIdNum}/posts?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      console.error(
          `[Circle API] Failed to fetch posts page ${page}: ${response.status}`,
      );
        break;
    }

    const data = await response.json();
    const postRecords = data.posts || data.records || [];

      if (postRecords.length === 0) {
        hasMore = false;
        break;
      }

      totalFetched += postRecords.length;
    console.log(
        `[Circle API] Fetched page ${page}: ${postRecords.length} posts (${totalFetched} total)`,
    );

    for (const post of postRecords) {
        // Extract FULL content from rich_text_body (not truncated fallback!)
        let content = '';
        let isHtml = false;
        
        // Priority 1: Full rich text body (PLAIN TEXT)
        // Check for actual content, not just existence
        if (post.rich_text_body?.body && 
            typeof post.rich_text_body.body === 'string' &&
            post.rich_text_body.body.trim().length > 0) {
          content = post.rich_text_body.body;
          isHtml = false; // Already plain text
        }
        // Priority 2: Fallback text (PLAIN TEXT - often has actual content!)
        else if (post.rich_text_body?.circle_ios_fallback_text &&
                 post.rich_text_body.circle_ios_fallback_text.trim().length > 0) {
          content = post.rich_text_body.circle_ios_fallback_text;
          isHtml = false; // Already plain text
        }
        // Priority 3: Plain body (might be HTML)
        else if (post.body && typeof post.body === 'string' && post.body.trim().length > 0) {
          content = post.body;
          isHtml = true; // Might be HTML
        }

        // Include description/excerpt if available
        let fullContent = content;
        if (post.excerpt && typeof post.excerpt === 'string' && post.excerpt.trim().length > 0) {
          fullContent = `${post.excerpt}\n\n${content}`;
        }

      posts.push({
        id: post.id.toString(),
        title: post.name || 'Untitled Post',
          content: fullContent,
        order: post.is_pinned ? -1 : posts.length,
          description: post.slug || post.excerpt || '',
          isHtml, // Flag for HTML conversion
      });
    }

      // Check if there are more pages
      if (postRecords.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(
      `[Circle API] ✅ Total posts fetched from space ${spaceIdNum}: ${posts.length}`,
    );
  } catch (error) {
    console.error(`[Circle API] Error fetching posts:`, error);
  }

  return posts;
}

/**
 * Fetch all lessons/posts for a course from Circle.so
 * Uses Headless Member API to fetch actual content
 */
export async function fetchCourseLessons(
  spaceId: string,
  courseId: string,
): Promise<CircleLesson[]> {
  try {
    console.log(`[Circle API] Fetching lessons for courseId: ${courseId}`);

    // Get member auth token for Headless API
    const memberToken = await getMemberAuthToken();
    console.log('[Circle API] Got member auth token');

    // Get all spaces in this space group
    const spaceIds = await fetchSpacesInGroup(courseId);
    console.log(
      `[Circle API] Found ${spaceIds.length} spaces in space group ${courseId}`,
    );

    if (spaceIds.length === 0) {
      console.log('[Circle API] No spaces found in space group');
      return [];
    }

    const allLessons: CircleLesson[] = [];

    // Fetch content from each space
    for (const spaceIdNum of spaceIds) {
      try {
        // Get space details to check if it's a course-type space
        const spaceDetailsResponse = await circleRequest<{
          space_type?: string;
          display_view?: string;
        }>(`/spaces/${spaceIdNum}`);

        console.log(
          `[Circle API] Space ${spaceIdNum} type: ${spaceDetailsResponse.space_type || 'regular'}`,
        );

        // Check if it's a course-type space (has lessons) or regular space (has posts)
        if (spaceDetailsResponse.space_type === 'course') {
          // Fetch lessons from course
          const courseLessons = await fetchCourseLessonsFromSpace(
            spaceIdNum,
            memberToken,
          );
          allLessons.push(...courseLessons);
        } else {
          // Fetch posts from regular space
          const spacePosts = await fetchPostsFromSpace(spaceIdNum, memberToken);
          allLessons.push(...spacePosts);
        }
      } catch (spaceError) {
        console.error(
          `[Circle API] Error fetching content from space ${spaceIdNum}:`,
          spaceError,
        );
        continue;
      }
    }

    // Sort by order (pinned first, then by index)
    allLessons.sort((a, b) => {
      if (a.order === -1 && b.order === -1) return 0;
      if (a.order === -1) return -1;
      if (b.order === -1) return 1;
      return a.order - b.order;
    });

    console.log(
      `[Circle API] Total lessons fetched: ${allLessons.length} from ${spaceIds.length} spaces`,
    );
    return allLessons;
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

  // Create a document for each lesson (skip empty lessons)
  for (const lesson of course.lessons) {
    // ONLY convert HTML to plain text if content is actually HTML!
    // rich_text_body.body is already plain text and doesn't need conversion
    const lessonContent = lesson.isHtml 
      ? htmlToPlainText(lesson.content) 
      : lesson.content; // Already plain text - use as is!
      
    const description = lesson.description
      ? htmlToPlainText(lesson.description) // Descriptions might still be HTML
      : '';

    let content = `# ${lesson.title}\n\n`;
    if (description) {
      content += `${description}\n\n`;
    }
    content += lessonContent;

    // Only skip if completely empty (just the title header)
    // Even short lessons might have valuable info (links, references, etc.)
    const contentWithoutTitle = content.replace(`# ${lesson.title}\n\n`, '').trim();
    
    if (contentWithoutTitle.length === 0) {
      console.log(
        `[Circle API] Skipping truly empty lesson: ${lesson.title} (no content beyond title)`,
      );
      continue;
    }
    
    // Log if content is short (for monitoring, but still include it)
    if (content.trim().length < 100) {
      console.log(
        `[Circle API] ⚠️  Short content: ${lesson.title} (${content.length} chars) - including anyway`,
      );
    }

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

  console.log(`[Circle API] Converted course to ${documents.length} documents`);
  return documents;
}

/**
 * Test Circle.so API connectivity
 */
export async function testCircleConnection(): Promise<boolean> {
  try {
    const config = getCircleConfig();
    console.log('[Circle API] Testing connection...');

    // Test with a simple endpoint - fetch current community info
    await circleRequest('/me');

    console.log('[Circle API] Connection test successful');
    return true;
  } catch (error) {
    console.error('[Circle API] Connection test failed:', error);
    return false;
  }
}
