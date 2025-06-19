import { NextResponse } from 'next/server';
import { Logger } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const createApiResponse = <T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse<T>> => {
  return NextResponse.json({
    success: true,
    data
  }, { status });
};

export const createApiError = (
  error: string | Error | ApiError,
  status: number = 500,
  code?: string,
  details?: string
): NextResponse<ApiResponse> => {
  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details
    }, { status: error.statusCode });
  }

  const errorMessage = error instanceof Error ? error.message : error;
  return NextResponse.json({
    success: false,
    error: errorMessage,
    code,
    details
  }, { status });
};

export const handleApiError = (
  route: string,
  error: any,
  duration: number,
  fallbackMessage: string = 'An error occurred'
): NextResponse<ApiResponse> => {
  Logger.apiError(route, duration, error);
  
  if (error instanceof ApiError) {
    return createApiError(error);
  }

  return createApiError(
    fallbackMessage,
    500,
    'INTERNAL_ERROR',
    error instanceof Error ? error.message : String(error)
  );
};

export const validateRequestBody = <T>(
  body: any,
  requiredFields: (keyof T)[],
  route: string
): T => {
  const missingFields = requiredFields.filter(field => !body[field]);
  
  if (missingFields.length > 0) {
    Logger.warn(`${route} - Missing required fields`, {
      missingFields,
      receivedFields: Object.keys(body)
    });
    throw new ApiError(
      `Missing required fields: ${missingFields.join(', ')}`,
      400,
      'MISSING_FIELDS'
    );
  }

  return body as T;
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  operationName: string = 'operation'
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        Logger.error(`${operationName} failed after ${maxRetries} attempts`, {
          error: lastError.message,
          attempts: maxRetries
        });
        throw lastError;
      }
      
      Logger.warn(`${operationName} failed, retrying in ${delayMs}ms`, {
        attempt,
        maxRetries,
        error: lastError.message,
        nextRetryIn: delayMs
      });
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2; // 지수 백오프
    }
  }
  
  throw lastError!;
}; 