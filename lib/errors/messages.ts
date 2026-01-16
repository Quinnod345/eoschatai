/**
 * User-friendly error message generator
 */

import type { ErrorCategory, ClassifiedError } from './types';

/**
 * Generate a user-friendly error message based on error category and context
 */
export function generateUserMessage(
  classified: ClassifiedError,
  context?: string,
): string {
  // If we have a custom context, try to make it contextual
  if (context) {
    return generateContextualMessage(classified, context);
  }

  // Use the classified user message or fall back to category-based message
  return classified.userMessage || getCategoryMessage(classified.category);
}

/**
 * Generate contextual error messages based on what the user was doing
 */
function generateContextualMessage(
  classified: ClassifiedError,
  context: string,
): string {
  const lowerContext = context.toLowerCase();

  // Network errors
  if (classified.category === 'network') {
    if (lowerContext.includes('upload')) {
      return 'Upload failed due to network issues. Please check your connection and try again.';
    }
    if (lowerContext.includes('save') || lowerContext.includes('saving')) {
      return 'Could not save changes due to network issues. Please try again.';
    }
    if (lowerContext.includes('load') || lowerContext.includes('loading')) {
      return 'Could not load data due to network issues. Please refresh the page.';
    }
    if (lowerContext.includes('chat') || lowerContext.includes('message')) {
      return 'Could not send message. Please check your connection.';
    }
    return `${context} failed due to network issues. Please try again.`;
  }

  // Authentication errors
  if (classified.category === 'authentication') {
    if (lowerContext.includes('login') || lowerContext.includes('sign in')) {
      return 'Invalid credentials. Please check your email and password.';
    }
    if (lowerContext.includes('session')) {
      return 'Your session has expired. Please log in again.';
    }
    return `${context} requires authentication. Please log in.`;
  }

  // Validation errors
  if (classified.category === 'validation') {
    if (lowerContext.includes('upload')) {
      return 'Invalid file. Please check the file type and size.';
    }
    if (lowerContext.includes('form') || lowerContext.includes('input')) {
      return 'Please check your input and try again.';
    }
    if (lowerContext.includes('email')) {
      return 'Please enter a valid email address.';
    }
    return `${context} failed validation. Please check your input.`;
  }

  // Database errors
  if (classified.category === 'database') {
    if (lowerContext.includes('save') || lowerContext.includes('saving')) {
      return 'Could not save changes. Please try again.';
    }
    if (lowerContext.includes('delete') || lowerContext.includes('deleting')) {
      return 'Could not delete item. Please try again.';
    }
    if (lowerContext.includes('create') || lowerContext.includes('creating')) {
      return 'Could not create item. Please try again.';
    }
    return `${context} encountered a database error. Please try again.`;
  }

  // AI/Streaming errors
  if (classified.category === 'ai_streaming') {
    if (lowerContext.includes('chat') || lowerContext.includes('message')) {
      return 'AI service is temporarily unavailable. Please try again.';
    }
    if (lowerContext.includes('generat')) {
      return 'Could not generate content. Please try again.';
    }
    return `${context} failed. AI service is temporarily unavailable.`;
  }

  // File operation errors
  if (classified.category === 'file_operation') {
    if (lowerContext.includes('upload')) {
      if (classified.message.toLowerCase().includes('too large')) {
        return 'File is too large. Please upload a smaller file.';
      }
      if (classified.message.toLowerCase().includes('format')) {
        return 'Unsupported file format. Please upload a different file.';
      }
      return 'File upload failed. Please try again.';
    }
    if (lowerContext.includes('download')) {
      return 'File download failed. Please try again.';
    }
    return `${context} failed. Please try again.`;
  }

  // Permission errors
  if (classified.category === 'permission') {
    if (lowerContext.includes('access')) {
      return 'You do not have permission to access this resource.';
    }
    if (lowerContext.includes('delete')) {
      return 'You do not have permission to delete this item.';
    }
    if (lowerContext.includes('edit') || lowerContext.includes('update')) {
      return 'You do not have permission to edit this item.';
    }
    return `You do not have permission to ${context.toLowerCase()}.`;
  }

  // Rate limit errors
  if (classified.category === 'rate_limit') {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Default with context
  return `${context} failed. ${classified.userMessage}`;
}

/**
 * Get default message for each error category
 */
function getCategoryMessage(category: ErrorCategory): string {
  switch (category) {
    case 'network':
      return 'Network error. Please check your connection and try again.';
    case 'authentication':
      return 'Authentication required. Please log in.';
    case 'validation':
      return 'Invalid input. Please check your data and try again.';
    case 'database':
      return 'Database error. Please try again.';
    case 'ai_streaming':
      return 'AI service temporarily unavailable. Please try again.';
    case 'file_operation':
      return 'File operation failed. Please try again.';
    case 'permission':
      return 'You do not have permission to perform this action.';
    case 'rate_limit':
      return 'Rate limit exceeded. Please wait a moment.';
    case 'business_logic':
      return 'Operation failed. Please try again.';
    case 'unknown':
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Generate a title for error toasts based on category
 */
export function generateErrorTitle(category: ErrorCategory): string {
  switch (category) {
    case 'network':
      return 'Connection Error';
    case 'authentication':
      return 'Authentication Required';
    case 'validation':
      return 'Invalid Input';
    case 'database':
      return 'Save Error';
    case 'ai_streaming':
      return 'AI Service Unavailable';
    case 'file_operation':
      return 'File Error';
    case 'permission':
      return 'Permission Denied';
    case 'rate_limit':
      return 'Too Many Requests';
    case 'business_logic':
      return 'Operation Failed';
    case 'unknown':
    default:
      return 'Error';
  }
}

/**
 * Generate helpful tips based on error category
 */
export function generateErrorTip(category: ErrorCategory): string | undefined {
  switch (category) {
    case 'network':
      return 'Check your internet connection and try again.';
    case 'authentication':
      return 'Your session may have expired. Try logging in again.';
    case 'validation':
      return 'Double-check that all required fields are filled correctly.';
    case 'rate_limit':
      return 'Wait a few seconds before trying again.';
    case 'file_operation':
      return 'Make sure your file is the correct format and size.';
    default:
      return undefined;
  }
}














