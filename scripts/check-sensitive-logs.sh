#!/bin/bash

# Script to check for potentially dangerous logging patterns
# Run this before committing to ensure no secrets are being logged

echo "🔍 Checking for sensitive data logging patterns..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# Check for direct secret logging
echo "Checking for direct secret/token logging..."
if rg "console\.log.*\.(secret|token|password|key|apiKey)" \
   --type ts --type tsx \
   --glob '!scripts/**' \
   --glob '!**/*.test.ts' \
   --glob '!lib/utils/secure-logger.ts' 2>/dev/null; then
    echo -e "${RED}❌ Found direct secret logging!${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ No direct secret logging found${NC}"
fi

echo ""

# Check for logging entire session objects
echo "Checking for session object logging..."
if rg "console\.log.*session\)" \
   --type ts --type tsx \
   --glob '!scripts/**' \
   --glob '!**/*.test.ts' 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: Session objects being logged (may contain secrets)${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ No session object logging found${NC}"
fi

echo ""

# Check for client_secret logging
echo "Checking for client_secret logging..."
if rg "console\.log.*client_secret" \
   --type ts --type tsx \
   --glob '!scripts/**' \
   --glob '!**/*.test.ts' \
   -i 2>/dev/null; then
    echo -e "${RED}❌ Found client_secret logging!${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ No client_secret logging found${NC}"
fi

echo ""

# Check for Authorization header logging
echo "Checking for Authorization header logging..."
if rg "console\.log.*[Aa]uthorization" \
   --type ts --type tsx \
   --glob '!scripts/**' \
   --glob '!**/*.test.ts' 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: Authorization headers being logged${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ No Authorization header logging found${NC}"
fi

echo ""

# Check for Bearer token logging
echo "Checking for Bearer token logging..."
if rg "console\.log.*[Bb]earer" \
   --type ts --type tsx \
   --glob '!scripts/**' \
   --glob '!**/*.test.ts' 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: Bearer tokens being logged${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ No Bearer token logging found${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! No sensitive logging detected.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Found $ISSUES_FOUND potential issue(s).${NC}"
    echo ""
    echo "Please review the flagged code and:"
    echo "1. Use the secure logger instead: import { createLogger } from '@/lib/utils/secure-logger'"
    echo "2. Or remove the sensitive logging"
    echo ""
    echo "See SECURE-LOGGING-GUIDE.md for more information."
    exit 1
fi


