import { Request, Response, NextFunction } from 'express';

// Extended Request type with user property
interface RequestWithUser extends Request {
  user?: any;
  userId?: string;
}

// Mock Express Request
export const mockRequest = (overrides: Partial<RequestWithUser> = {}): Partial<RequestWithUser> => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: undefined,
    userId: undefined,
    get: jest.fn((header: string) => {
      const headers = (overrides.headers || {}) as Record<string, string | string[]>;
      return headers[header.toLowerCase()];
    }) as any,
    ...overrides,
  };
};

// Mock Express Response
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
};

// Mock Next Function
export const mockNext = (): NextFunction => {
  return jest.fn() as NextFunction;
};

// Mock Authenticated Request
export const mockAuthRequest = (
  userId: string = 'user-123',
  overrides: Partial<RequestWithUser> = {}
): Partial<RequestWithUser> => {
  return mockRequest({
    userId,
    user: {
      userId,
      email: 'test@example.com',
      name: 'Test User',
      username: 'testuser',
      role: 'Student',
      photoURL: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    headers: {
      authorization: 'Bearer mock-jwt-token',
      ...((overrides.headers as Record<string, string>) || {}),
    },
    ...overrides,
  });
};

// Helper to create mock request with validation
export const mockValidatedRequest = (
  body: any,
  params: any = {},
  query: any = {}
): Partial<Request> => {
  return mockRequest({
    body,
    params,
    query,
  });
};
