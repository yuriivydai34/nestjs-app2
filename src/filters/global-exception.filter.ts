import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorSanitizer } from '../utils/error-sanitizer';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // If it's already a structured response, use it
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
      } else {
        message = exception.message;
      }
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      // Log full error details for debugging
      this.logger.error(`[GLOBAL_EXCEPTION] Unexpected error:
        Message: ${exception instanceof Error ? exception.message : String(exception)}
        Stack: ${exception instanceof Error ? exception.stack : 'No stack trace'}
        URL: ${request.url}
        Method: ${request.method}
        User Agent: ${request.get('User-Agent') || 'Unknown'}
        Timestamp: ${new Date().toISOString()}
      `);
      
      // Provide generic message to user
      message = 'An unexpected error occurred. Please try again later.';
    }

    // Sanitize the error message before sending to client
    const sanitizedMessage = ErrorSanitizer.sanitizeErrorMessage(message);

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: sanitizedMessage,
    };

    response.status(status).json(errorResponse);
  }
}