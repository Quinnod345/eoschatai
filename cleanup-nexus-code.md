# Nexus Code Cleanup Guide

## Files to Remove

### 1. Core Nexus Libraries
```bash
# Old orchestrator and related files
lib/ai/nexus-orchestrator.ts
lib/ai/nexus-query-generator.ts
lib/ai/nexus-step-analyzer.ts
lib/ai/nexus-research-evaluator.ts
lib/ai/nexus-search-executor.ts
lib/ai/nexus-research-storage.ts
lib/ai/nexus-resumable-stream.ts
```

### 2. API Routes
```bash
# Old Nexus API endpoint
app/(chat)/api/nexus-chat/route.ts
app/(chat)/api/nexus-execute/route.ts  # if exists
```

### 3. Documentation (Keep for reference)
```bash
# These can be archived rather than deleted
NEXUS-MODE-ENHANCEMENTS.md
NEXUS-RESUMABLE-STREAMS.md
```

## Code to Update

### 1. Remove Nexus imports from chat route
In `app/api/chat/route.ts`, remove:
- Import of old nexus-orchestrator
- References to runNexusResearch

### 2. Update UI Components

#### components/nexus-research-selector.tsx
- Keep this file but rename to `research-mode-selector.tsx`
- Update all "Nexus" references to "Deep Research"

#### components/nexus-research-plan.tsx
- Keep and rename to `research-plan.tsx`
- Update component name and exports

#### components/nexus-research-progress.tsx
- Keep and rename to `research-progress.tsx`
- Update component name and exports

### 3. Update imports in components/chat.tsx
Replace:
```typescript
import { NexusResearchProgress } from './nexus-research-progress';
import { NexusResearchPlan } from './nexus-research-plan';
```

With:
```typescript
import { ResearchProgress } from './research-progress';
import { ResearchPlan } from './research-plan';
```

### 4. Environment Variables to Update
Add to `.env.example`:
```env
# Firesearch Configuration
FIRESEARCH_MAX_DEPTH=3
FIRESEARCH_MAX_SOURCES=20
FIRESEARCH_TIMEOUT=120000
FIRESEARCH_FOLLOWUP=true
FIRESEARCH_STREAMING=true
FIRESEARCH_RATE_LIMIT=10
```

## Search and Replace Commands

### Find all Nexus references:
```bash
# Find all files with "nexus" in the name
find . -name "*nexus*" -type f | grep -v node_modules

# Find all code references to "nexus"
grep -r "nexus" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .

# Find all references to old orchestrator
grep -r "nexus-orchestrator" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

### Update event types:
Replace all instances of:
- `nexus-phase-update` → Keep (still used)
- `nexus-search-progress` → Keep (still used)
- `nexus-search-complete` → Keep (still used)
- `nexus-error` → Keep (still used)

## Cleanup Script

Create and run this cleanup script:

```bash
#!/bin/bash
# cleanup-nexus.sh

echo "🧹 Starting Nexus cleanup..."

# Remove old Nexus files
echo "📁 Removing old Nexus files..."
rm -f lib/ai/nexus-orchestrator.ts
rm -f lib/ai/nexus-query-generator.ts
rm -f lib/ai/nexus-step-analyzer.ts
rm -f lib/ai/nexus-research-evaluator.ts
rm -f lib/ai/nexus-search-executor.ts
rm -f lib/ai/nexus-research-storage.ts
rm -f lib/ai/nexus-resumable-stream.ts
rm -rf app/\(chat\)/api/nexus-chat

# Rename components
echo "📝 Renaming components..."
mv components/nexus-research-selector.tsx components/research-mode-selector.tsx 2>/dev/null || true
mv components/nexus-research-plan.tsx components/research-plan.tsx 2>/dev/null || true
mv components/nexus-research-progress.tsx components/research-progress.tsx 2>/dev/null || true

echo "✅ Cleanup complete!"
echo "⚠️  Don't forget to:"
echo "  1. Update imports in components/chat.tsx"
echo "  2. Update component names inside the renamed files"
echo "  3. Test everything still works"
```

## Verification Steps

After cleanup:

1. **Build Check:**
   ```bash
   npm run build
   ```

2. **Type Check:**
   ```bash
   npm run type-check
   ```

3. **Test Deep Research:**
   - Open the app
   - Try a deep research query
   - Verify all features work

## Rollback Plan

If something breaks:

1. **Git Revert:**
   ```bash
   git revert HEAD
   ```

2. **Restore from Backup:**
   - Keep a backup branch before cleanup
   - Cherry-pick Firesearch additions without removals

## Final Checklist

- [ ] All old Nexus files removed
- [ ] Components renamed
- [ ] Imports updated
- [ ] No TypeScript errors
- [ ] Deep Research mode works
- [ ] Follow-up questions work
- [ ] Progress tracking works
- [ ] Documentation updated



