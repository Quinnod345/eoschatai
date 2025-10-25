/**
 * Recovery action suggestions based on error type
 */

import type { ClassifiedError, RecoveryAction } from './types';

/**
 * Generate recovery actions based on the classified error
 */
export function generateRecoveryActions(
  classified: ClassifiedError,
  onRetry?: () => Promise<void> | void,
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];

  // Add retry action for retryable errors
  if (classified.isRetryable && onRetry) {
    actions.push({
      label: 'Retry',
      action: onRetry,
      isPrimary: true,
    });
  }

  // Category-specific actions
  switch (classified.category) {
    case 'network':
      actions.push({
        label: 'Refresh Page',
        action: () => window.location.reload(),
      });
      break;

    case 'authentication':
      actions.push({
        label: 'Log In',
        action: () => {
          window.location.href = '/login';
        },
        isPrimary: !classified.isRetryable,
      });
      break;

    case 'permission':
      // Check if user might need to upgrade
      if (
        classified.message.toLowerCase().includes('quota') ||
        classified.message.toLowerCase().includes('limit') ||
        classified.message.toLowerCase().includes('upgrade')
      ) {
        actions.push({
          label: 'Upgrade',
          action: () => {
            window.location.href = '/account';
          },
          isPrimary: true,
        });
      } else {
        actions.push({
          label: 'Go to Dashboard',
          action: () => {
            window.location.href = '/chat';
          },
        });
      }
      break;

    case 'validation':
      // No specific action needed - user should fix input
      break;

    case 'rate_limit':
      // Retry is the main action, already added above
      if (!onRetry) {
        actions.push({
          label: 'Wait and Retry',
          action: async () => {
            await new Promise((resolve) =>
              setTimeout(resolve, classified.retryDelay || 5000),
            );
            window.location.reload();
          },
          isPrimary: true,
        });
      }
      break;

    case 'file_operation':
      if (classified.message.toLowerCase().includes('too large')) {
        // No automatic action for file size issues
      } else if (onRetry) {
        // Retry is already added
      }
      break;

    case 'database':
    case 'ai_streaming':
    case 'business_logic':
    case 'unknown':
      // Retry if available, or refresh
      if (!onRetry) {
        actions.push({
          label: 'Refresh',
          action: () => window.location.reload(),
        });
      }
      break;
  }

  // Add support action for critical errors
  if (classified.severity === 'critical') {
    actions.push({
      label: 'Contact Support',
      action: () => {
        // Open support email or help page
        window.location.href = 'mailto:support@eoschatai.com';
      },
    });
  }

  return actions;
}

/**
 * Determine if we should show a "Report Issue" button
 */
export function shouldShowReportIssue(classified: ClassifiedError): boolean {
  return (
    classified.severity === 'critical' ||
    classified.category === 'unknown' ||
    (classified.category === 'database' && !classified.isRetryable)
  );
}

/**
 * Generate a report issue action
 */
export function generateReportIssueAction(
  classified: ClassifiedError,
): RecoveryAction {
  return {
    label: 'Report Issue',
    action: () => {
      const subject = encodeURIComponent(
        `Error Report: ${classified.category}`,
      );
      const body = encodeURIComponent(
        `Error Details:
Category: ${classified.category}
Severity: ${classified.severity}
Message: ${classified.message}
Context: ${classified.context || 'N/A'}
Time: ${classified.timestamp.toISOString()}

Additional information:
`,
      );
      window.location.href = `mailto:support@eoschatai.com?subject=${subject}&body=${body}`;
    },
  };
}

/**
 * Get a user-friendly action label based on context
 */
export function getContextualActionLabel(
  classified: ClassifiedError,
  context?: string,
): string {
  if (!context) return 'Try Again';

  const lowerContext = context.toLowerCase();

  if (lowerContext.includes('save') || lowerContext.includes('saving')) {
    return 'Retry Save';
  }
  if (lowerContext.includes('upload')) {
    return 'Retry Upload';
  }
  if (lowerContext.includes('load') || lowerContext.includes('loading')) {
    return 'Reload';
  }
  if (lowerContext.includes('delete')) {
    return 'Retry Delete';
  }
  if (lowerContext.includes('send')) {
    return 'Resend';
  }

  return 'Try Again';
}
