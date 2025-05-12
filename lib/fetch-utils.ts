/**
 * Safely parses JSON response from a fetch request
 * @param response The fetch Response object
 * @param defaultValue Default value to return if parsing fails
 * @returns Parsed JSON or default value
 */
export async function safeParseJson<T>(
  response: Response,
  defaultValue: T,
): Promise<T> {
  try {
    // First check if the response is ok
    if (!response.ok) {
      console.error(
        `Response not OK: ${response.status} ${response.statusText}`,
      );
      return defaultValue;
    }

    // Try to get the response text
    const text = await response.text();

    // If the response is empty, return default
    if (!text || text.trim() === '') {
      console.warn('Response was empty');
      return defaultValue;
    }

    // Check if the response starts with HTML (common error in these cases)
    if (
      text.trim().startsWith('<!DOCTYPE') ||
      text.trim().startsWith('<html')
    ) {
      console.error('Response contains HTML instead of JSON');
      return defaultValue;
    }

    // Try to parse as JSON
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    return defaultValue;
  }
}

/**
 * Safely handles fetch errors and returns a default value
 * @param fn The fetch function to execute
 * @param defaultValue Default value to return if fetch fails
 * @returns Result of fetch or default value
 */
export async function safeFetch<T>(
  fn: () => Promise<T>,
  defaultValue: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Error during fetch operation:', error);
    return defaultValue;
  }
}
