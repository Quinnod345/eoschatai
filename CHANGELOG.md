# Changelog

All notable changes to EOSAI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Public API (OpenAI-Compatible)
- New `/api/v1/chat` endpoint with streaming support for external developers
- New `/api/v1/models` endpoint to list available models and EOS namespaces
- New `/api/v1/usage` endpoint to check API key usage and rate limits
- Secure API key generation with hashed storage and prefix identification
- Per-minute and per-day rate limiting for API consumers

#### API Keys Admin UI
- New `ApiKey` and `ApiKeyUsageLog` database tables with migration
- Full CRUD API routes for key management (`/api/api-keys/*`)
- `ApiKeysManager` component with key generation, listing, and revocation
- Usage statistics dashboard with daily breakdown per key
- "API Keys" section in Settings modal (Business plan only, gated by `api_access` entitlement)

#### Loading States & Skeleton Loaders
- Comprehensive skeleton loaders for chat interface, settings, and navigation
- Smooth loading transitions throughout the application

#### Error Boundaries
- Robust error boundaries added to key components
- Graceful error recovery with user-friendly fallback UI

#### SEO Improvements
- Comprehensive meta tags, Open Graph, and Twitter Card support
- Structured data (JSON-LD) for better search engine indexing
- Improved landing page copy and accessibility

#### Accessibility
- ARIA labels and roles across interactive elements
- Keyboard navigation improvements
- Screen reader compatibility enhancements
- Focus management improvements

### Changed

#### Performance Optimizations
- Bundle size optimization with dynamic imports and lazy loading
- Image optimization with next/image and lazy loading for heavy components
- API caching strategy with Cache-Control headers
- Database optimization analysis and migration recommendations

#### Frontend Polish
- Dark mode consistency improvements across all components
- React Hook dependency fixes
- Sentry deprecation warnings resolved
- React component naming standardization

#### Backend Improvements
- Enhanced error handling across the application
- Standardized validation and error response patterns
- Improved test coverage for backend services

#### Landing Page
- Updated SEO, copy, and accessibility
- Performance optimizations

### Fixed

#### UI Bugs
- 401 errors on protected routes
- Invite toast notification issues
- R3F (React Three Fiber) and Sentry integration conflicts
- Unescaped entities in JSX causing lint errors

#### Security Vulnerabilities
- XSS vulnerability in advanced-search component (sanitized `marked()` output)
- Added comprehensive security headers (X-Frame-Options, CSP, X-Content-Type-Options)
- Secure database query wrappers with built-in authorization checks
- Standardized admin checks using `isAdminEmail` utility function

### Security

- Comprehensive security headers in `next.config.ts`
- Rate limiting infrastructure for API endpoints
- Input validation schemas for all user inputs
- Enhanced authorization patterns for data access
- Defense-in-depth approach with multiple security layers
- Security review documentation added

### Tests

#### E2E Tests (Playwright)
- Landing page tests (loading, navigation, responsiveness)
- Authentication flow tests (login, register, validation, logout)
- Chat interface tests (UI, document upload, history, search, keyboard shortcuts, error handling)
- Settings modal tests (profile, theme, organization switching, API keys)
- Updated `playwright.config.ts` to detect both `.test.ts` and `.spec.ts` files
- Added `test:e2e` npm script

#### Unit Tests
- Comprehensive unit tests for custom React hooks
- Component tests for React components
- Backend service tests

### Documentation

- OpenAPI specification for the Public API
- Improved API documentation
- Enhanced README with setup instructions
- UI bug review documentation from automated testing
- Security review documentation

### Maintenance

#### Dependencies
- Safe patch and minor dependency updates
- Dependency audit with security review

#### Code Cleanup
- Removed dead code and unused test files
- Console statement cleanup
- TypeScript fixes and improvements

---

## Branch Summary (Feb 4, 2026)

The following feature branches contain the changes above:

| Category | Branches |
|----------|----------|
| Features | `feature/api-keys-ui-feb04`, `feature/public-api-feb04` |
| Performance | `optimize/bundle-feb04-v2`, `improve/caching-feb04`, `improve/performance-feb04` |
| Security | `security/hardening-feb04` |
| Tests | `test/e2e-feb04`, `test/unit-tests-feb04`, `test/hooks-coverage-feb04-v2`, `test/component-tests-feb04` |
| Documentation | `docs/api-docs-feb04`, `docs/improvements-feb04` |
| Bug Fixes | `fix/ui-bugs-feb04`, `fix/ui-review-feb04`, `fix/build-feb04` |
| Improvements | `improve/accessibility-feb04`, `improve/error-boundaries-feb04`, `improve/error-handling-feb04`, `improve/frontend-feb04`, `improve/landing-feb04`, `improve/loading-states-feb04`, `improve/seo-feb04`, `improve/backend-feb04` |
| Maintenance | `chore/deps-audit-feb04`, `chore/deps-update-feb04`, `chore/dead-code-cleanup-feb04`, `chore/console-cleanup-feb04`, `chore/typescript-fixes-feb04-v2` |
| Database | `optimize/database-feb04` |
