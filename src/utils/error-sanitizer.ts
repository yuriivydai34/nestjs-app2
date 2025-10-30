/**
 * Utility functions for sanitizing error messages and removing sensitive information
 */

export class ErrorSanitizer {
  /**
   * Sanitizes error messages by removing sensitive information like:
   * - Database URLs with credentials
   * - Connection strings
   * - API keys
   * - File paths that might reveal system structure
   */
  static sanitizeErrorMessage(error: Error | string): string {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    // Remove database URLs with credentials
    let sanitized = errorMessage.replace(
      /postgresql:\/\/[^:]+:[^@]+@[^\/]+\/[^\s\?"']*/g,
      'postgresql://***:***@***/***(credentials hidden)'
    );
    
    // Remove other database connection strings
    sanitized = sanitized.replace(
      /mysql:\/\/[^:]+:[^@]+@[^\/]+\/[^\s\?"']*/g,
      'mysql://***:***@***/***(credentials hidden)'
    );
    
    // Remove MongoDB connection strings
    sanitized = sanitized.replace(
      /mongodb:\/\/[^:]+:[^@]+@[^\/]+\/[^\s\?"']*/g,
      'mongodb://***:***@***/***(credentials hidden)'
    );
    
    // Remove file paths that might reveal system structure
    sanitized = sanitized.replace(
      /\/(?:home|Users)\/[^\/\s]+/g,
      '/***'
    );
    
    // Remove absolute paths
    sanitized = sanitized.replace(
      /[A-Za-z]:\\[^\s"']*/g,
      'C:\\***'
    );
    
    // Remove any remaining connection string patterns
    sanitized = sanitized.replace(
      /(?:password|pwd|secret|key|token)[\s]*[=:][\s]*[^\s\;&"']+/gi,
      'password=***(hidden)'
    );
    
    return sanitized;
  }

  /**
   * Creates a user-friendly error message based on the error type
   */
  static getUserFriendlyMessage(error: Error | string, context: string): string {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('command not found') || lowerError.includes('pg_dump')) {
      return `Database backup tool (pg_dump) is not available. Please ensure PostgreSQL client tools are installed.`;
    }
    
    if (lowerError.includes('permission denied') || lowerError.includes('eacces')) {
      return `Permission denied while creating backup. Please check file system permissions.`;
    }
    
    if (lowerError.includes('no such file or directory') || lowerError.includes('enoent')) {
      return `Required files or directories are missing for backup operation.`;
    }
    
    if (lowerError.includes('connection') || lowerError.includes('connect')) {
      return `Unable to connect to the database. Please check database connectivity.`;
    }
    
    if (lowerError.includes('authentication') || lowerError.includes('auth')) {
      return `Database authentication failed. Please check database credentials.`;
    }
    
    if (lowerError.includes('timeout')) {
      return `Backup operation timed out. The database might be too large or busy.`;
    }
    
    if (lowerError.includes('disk') || lowerError.includes('space')) {
      return `Insufficient disk space to create backup.`;
    }
    
    // Default generic message for unknown errors
    return `${context} failed due to an unexpected error. Please try again or contact support.`;
  }

  /**
   * Logs the full error details for debugging while returning sanitized message
   */
  static logAndSanitize(
    logger: { error: (message: string) => void },
    error: Error | string,
    context: string,
    userId?: string | number
  ): string {
    // Log full error details for debugging (these logs should be secured)
    const fullErrorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;
    
    logger.error(`[${context}] Full error details for debugging:
      Message: ${fullErrorMessage}
      Stack: ${errorStack || 'No stack trace'}
      User ID: ${userId || 'Unknown'}
      Timestamp: ${new Date().toISOString()}
    `);
    
    // Return user-friendly message
    return this.getUserFriendlyMessage(error, context);
  }
}