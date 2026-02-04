# Contributing to EOSAI

Thank you for your interest in contributing to EOSAI! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept responsibility for mistakes and learn from them

## Getting Started

### Prerequisites

- **Node.js 18+** - JavaScript runtime
- **pnpm 9.12+** - Package manager
- **PostgreSQL 15+** - Database with pgvector extension
- **Git** - Version control

### Local Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/eoschatai.git
   cd eoschatai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Required variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `OPENAI_API_KEY` - OpenAI API key
   - `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
   - `UPSTASH_VECTOR_REST_URL` - Upstash Vector URL (for RAG)
   - `UPSTASH_VECTOR_REST_TOKEN` - Upstash Vector token

4. **Set up the database**
   ```bash
   pnpm db:migrate
   pnpm db:pgvector
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features (e.g., `feature/voice-mode`)
- `fix/` - Bug fixes (e.g., `fix/message-streaming`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/rag-pipeline`)
- `chore/` - Maintenance tasks (e.g., `chore/deps-update`)

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

Examples:
```bash
feat(chat): add message pinning functionality
fix(rag): resolve vector dimension mismatch
docs(api): add authentication examples
```

## Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**
   ```bash
   pnpm lint
   pnpm test
   ```

4. **Commit your changes** with a descriptive message

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature
   ```

6. **Open a Pull Request** against `main`

### PR Requirements

- [ ] Code follows the project's coding standards
- [ ] All tests pass
- [ ] New features include tests
- [ ] Documentation is updated
- [ ] PR description explains the changes
- [ ] No unrelated changes included

### PR Review Process

1. At least one maintainer review is required
2. All CI checks must pass
3. Resolve all review comments
4. Squash commits if requested

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` type when possible
- Use interfaces for object shapes
- Export types that might be reused

```typescript
// ✅ Good
interface UserDocument {
  id: string;
  content: string;
  embedding: number[];
}

export async function processDocument(doc: UserDocument): Promise<void> {
  // ...
}

// ❌ Avoid
export async function processDocument(doc: any) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Use proper TypeScript props typing
- Follow the component file structure:

```tsx
// imports
import { useState } from 'react';

// types
interface Props {
  title: string;
  onClose: () => void;
}

// component
export function Modal({ title, onClose }: Props) {
  // hooks
  const [isOpen, setIsOpen] = useState(false);
  
  // handlers
  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };
  
  // render
  return (
    <div className="modal">
      <h2>{title}</h2>
      <button onClick={handleClose}>Close</button>
    </div>
  );
}
```

### Styling

- Use Tailwind CSS for styling
- Follow the existing design system
- Use CSS variables for theming
- Keep responsive design in mind

### File Organization

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (chat)/            # Chat interface routes
│   └── api/               # API routes
├── components/            # Reusable React components
├── lib/                   # Utility functions and modules
│   ├── ai/               # AI-related functionality
│   ├── db/               # Database schemas and queries
│   └── utils/            # General utilities
└── public/               # Static assets
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test -- tests/specific-test.spec.ts
```

### Writing Tests

- Use Playwright for E2E tests
- Test user flows, not implementation details
- Mock external services appropriately
- Include both happy path and error cases

```typescript
import { test, expect } from '@playwright/test';

test('user can send a message', async ({ page }) => {
  await page.goto('/');
  
  await page.fill('[data-testid="message-input"]', 'Hello AI');
  await page.click('[data-testid="send-button"]');
  
  await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
});
```

## Documentation

### Code Documentation

- Add JSDoc comments to exported functions
- Document complex logic with inline comments
- Keep README files updated

```typescript
/**
 * Generates embeddings for a text query using OpenAI's embedding model.
 * Results are cached for 60 seconds to avoid duplicate API calls.
 * 
 * @param query - The text to generate an embedding for
 * @returns A 1536-dimensional embedding vector
 * @throws Error if the embedding generation fails
 * 
 * @example
 * ```ts
 * const embedding = await generateEmbedding("What is EOS?");
 * console.log(embedding.length); // 1536
 * ```
 */
export async function generateEmbedding(query: string): Promise<number[]> {
  // ...
}
```

### Updating Documentation

When making changes:

1. Update relevant README sections
2. Add/update JSDoc comments
3. Update API documentation if endpoints change
4. Update `.env.example` if new env vars are added

## Questions?

If you have questions about contributing:

1. Check existing [GitHub Issues](https://github.com/your-org/eoschatai/issues)
2. Start a [GitHub Discussion](https://github.com/your-org/eoschatai/discussions)
3. Reach out to maintainers

Thank you for contributing to EOSAI! 🚀
