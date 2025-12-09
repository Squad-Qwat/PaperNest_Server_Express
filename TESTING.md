# Unit Testing Documentation

## Overview
Comprehensive unit testing suite for PaperNest Express.js TypeScript backend using Jest.

## Test Infrastructure

### Tools & Frameworks
- **Jest** (v30.2.0) - JavaScript testing framework
- **ts-jest** (v29.4.6) - TypeScript preprocessor for Jest
- **Supertest** (v7.1.4) - HTTP assertion library
- **@types/jest** - TypeScript definitions for Jest

### Configuration
- `jest.config.js` - Jest configuration with TypeScript support
- `tsconfig.json` - Excludes test files from build
- Coverage thresholds: 80% statements, 70% branches, 80% functions, 80% lines

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in verbose mode
npm run test:verbose
```

## Test Structure

```
src/
├── __tests__/
│   ├── controllers/        # Controller unit tests
│   ├── middlewares/        # Middleware unit tests
│   ├── repositories/       # Repository unit tests
│   └── utils/             # Utility function tests
├── tests/
│   ├── fixtures/          # Test data fixtures
│   ├── mocks/             # Mock objects and helpers
│   └── setup.ts           # Jest setup file
└── __mocks__/
    └── firebase-admin.ts  # Firebase Admin SDK mock
```

## Test Coverage

### Repositories (3 tests)
- ✅ `userRepository.test.ts` - User CRUD operations
- ✅ `citationRepository.test.ts` - Citation management
- ✅ `documentRepository.test.ts` - Document operations

### Controllers (2 tests)
- ✅ `citationController.test.ts` - Citation endpoints
- ✅ `documentController.test.ts` - Document endpoints

### Middlewares (2 tests)
- ✅ `auth.test.ts` - Authentication logic
- ✅ `authorization.test.ts` - Role-based access control

### Utils (2 tests)
- ✅ `responseFormatter.test.ts` - Response formatting
- ✅ `errorTypes.test.ts` - Custom error classes

## Test Utilities

### Fixtures (`src/tests/fixtures/index.ts`)
Pre-defined test data for all entities:
- `mockUser`, `mockLecturerUser`
- `mockWorkspace`
- `mockDocument`, `mockDocuments`
- `mockCitation`, `mockCitations`
- `mockComment`, `mockReplyComment`
- `mockReview`, `mockApprovedReview`
- `mockNotification`, `mockNotifications`

### Mock Helpers (`src/tests/mocks/`)
- **express.mocks.ts** - Mock Request, Response, NextFunction
- **repository.mocks.ts** - Mock repository methods

### Firebase Mocks (`__mocks__/firebase-admin.ts`)
Complete Firebase Admin SDK mock including:
- Firestore operations (collections, documents, queries)
- Auth operations (user management, token verification)
- Storage operations

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockRequest, mockResponse } from '../../tests/mocks/express.mocks';

describe('YourModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('yourFunction', () => {
    it('should do something', async () => {
      // Arrange
      const req = mockRequest({ body: { data: 'test' } });
      const res = mockResponse();

      // Act
      await yourFunction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
  });
});
```

### Mocking Repositories

```typescript
jest.mock('../../repositories/userRepository');
import userRepository from '../../repositories/userRepository';

(userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
```

### Testing Controllers

```typescript
it('should create resource successfully', async () => {
  const req = mockAuthRequest('user-123', {
    body: { title: 'Test' }
  });
  const res = mockResponse();

  await controller.create(req, res);

  expect(repository.create).toHaveBeenCalledWith({ title: 'Test' });
  expect(res.status).toHaveBeenCalledWith(201);
});
```

## Best Practices

1. **Isolation** - Each test should be independent
2. **Clear Mocks** - Always clear mocks in `beforeEach`
3. **AAA Pattern** - Arrange, Act, Assert
4. **Descriptive Names** - Test names should describe behavior
5. **Mock External Dependencies** - Don't hit real Firebase/databases
6. **Test Error Cases** - Include unhappy path tests
7. **Use Fixtures** - Reuse test data from fixtures

## Common Patterns

### Testing Async Functions
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Error Handling
```typescript
it('should throw NotFoundError when resource missing', async () => {
  repository.findById.mockResolvedValue(null);
  
  await expect(
    controller.getById(req, res)
  ).rejects.toThrow(NotFoundError);
});
```

### Testing Middleware
```typescript
it('should call next() on success', async () => {
  const next = mockNext();
  await middleware(req, res, next);
  expect(next).toHaveBeenCalled();
});
```

## Troubleshooting

### TypeScript Errors
- Ensure `types` array is removed from tsconfig.json
- Check that test files are excluded from build

### Mock Not Working
- Verify mock is declared before import
- Use `jest.clearAllMocks()` in beforeEach
- Check mock implementation matches actual interface

### Coverage Issues
- Run `npm run test:coverage` to see uncovered lines
- Add tests for edge cases and error paths
- Check if all exports are tested

## Next Steps

### Remaining Tests to Implement
- [ ] commentController.test.ts
- [ ] notificationController.test.ts
- [ ] reviewController.test.ts
- [ ] userController.test.ts
- [ ] versionController.test.ts
- [ ] workspaceController.test.ts
- [ ] authController.test.ts
- [ ] authService.test.ts
- [ ] validation.test.ts
- [ ] errorHandler.test.ts
- [ ] helpers.test.ts

### Integration Tests
- [ ] Setup Firestore emulator
- [ ] End-to-end API tests
- [ ] Authentication flow tests

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://jestjs.io/docs/expect)
- [Supertest Guide](https://github.com/visionmedia/supertest)
