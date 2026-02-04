# EOSAI Dependency & Security Audit
**Date:** February 4, 2026
**Branch:** `chore/deps-audit-feb04`

## Summary

- **Vulnerabilities Before:** 29 (1 critical, 12 high, 14 moderate, 2 low)
- **Vulnerabilities After:** 27 (1 critical, 11 high, 13 moderate, 2 low)
- **Safe Updates Applied:** 47 packages (patch/minor versions)
- **Major Updates Needed:** 30+ packages (documented below, NOT applied)

---

## ✅ Safe Updates Applied (Patch/Minor)

### AI SDK & Core
| Package | From | To |
|---------|------|-----|
| @ai-sdk/anthropic | 3.0.14 | 3.0.36 |
| @ai-sdk/openai | 3.0.11 | 3.0.25 |
| @ai-sdk/react | 3.0.39 | 3.0.71 |
| @anthropic-ai/sdk | 0.71.2 | 0.72.1 |
| ai | 6.0.37 | 6.0.69 |

### Infrastructure
| Package | From | To |
|---------|------|-----|
| @aws-sdk/client-s3 | 3.896.0 | 3.982.0 |
| @sentry/nextjs | 10.28.0 | 10.38.0 |
| @upstash/redis | 1.35.4 | 1.36.2 |
| @vercel/analytics | 1.5.0 | 1.6.1 |
| next | 15.5.9 | **15.5.10** ⚡ (security patch) |
| pg | 8.16.3 | 8.18.0 |
| postgres | 3.4.7 | 3.4.8 |
| redis | 5.8.2 | 5.10.0 |
| resend | 6.1.0 | 6.9.1 |

### UI Libraries
| Package | From | To |
|---------|------|-----|
| @codemirror/lang-html | 6.4.10 | 6.4.11 |
| @codemirror/state | 6.5.2 | 6.5.4 |
| @codemirror/view | 6.38.3 | 6.39.12 |
| @radix-ui/react-avatar | 1.1.10 | 1.1.11 |
| @radix-ui/react-label | 2.1.7 | 2.1.8 |
| @radix-ui/react-separator | 1.1.7 | 1.1.8 |
| @radix-ui/react-slot | 1.2.3 | 1.2.4 |
| @radix-ui/react-visually-hidden | 1.2.3 | 1.2.4 |
| @react-three/fiber | 9.4.0 | 9.5.0 |
| chart.js | 4.5.0 | 4.5.1 |
| gsap | 3.13.0 | 3.14.2 |
| lenis | 1.3.11 | 1.3.17 |
| motion | 12.23.24 | 12.31.0 |
| postprocessing | 6.37.8 | 6.38.2 |
| react-easy-crop | 5.5.1 | 5.5.6 |
| three | 0.180.0 | 0.182.0 |

### Editor/Text
| Package | From | To |
|---------|------|-----|
| prosemirror-inputrules | 1.5.0 | 1.5.1 |
| prosemirror-markdown | 1.13.2 | 1.13.3 |
| prosemirror-model | 1.25.3 | 1.25.4 |
| prosemirror-state | 1.4.3 | 1.4.4 |
| prosemirror-view | 1.41.1 | 1.41.5 |

### Utilities
| Package | From | To |
|---------|------|-----|
| mathjs | 15.0.0 | 15.1.0 |
| resumable-stream | 2.2.4 | 2.2.10 |
| sharp | 0.34.4 | 0.34.5 |
| swr | 2.3.6 | 2.4.0 |
| tiktoken | 1.0.17 | 1.0.22 |
| ws | 8.18.3 | 8.19.0 |
| zod | 4.3.5 | 4.3.6 |
| zustand | 5.0.8 | 5.0.11 |

### Dev Dependencies
| Package | From | To |
|---------|------|-----|
| @playwright/test | 1.55.1 | 1.58.1 |
| @types/papaparse | 5.3.16 | 5.5.2 |
| @types/pg | 8.15.5 | 8.16.0 |
| @types/three | 0.180.0 | 0.182.0 |
| tsx | 4.20.5 | 4.21.0 |
| typescript | 5.9.2 | 5.9.3 |

---

## 🔴 Security Vulnerabilities Remaining

### Critical (1)
| Package | Issue | Fix |
|---------|-------|-----|
| **jspdf@2.5.2** | Local File Inclusion/Path Traversal | Update to 4.0.0+ (MAJOR) |

### High (11)
| Package | Issue | Fix |
|---------|-------|-----|
| **jspdf@2.5.2** | ReDoS, DoS, PDF Injection, BMP DoS (6 CVEs total) | Update to 4.1.0+ (MAJOR) |
| **xlsx@0.18.5** | Prototype Pollution, ReDoS | **No fix available** - consider alternative |
| **glob** (transitive) | Command injection via CLI | Update eslint-config-next, tailwindcss |
| **jws@4.0.0** (via googleapis) | HMAC signature verification bypass | Update googleapis to 171.x (MAJOR) |
| **qs** (via googleapis, stripe) | DoS via memory exhaustion | Update googleapis, stripe |
| **fast-xml-parser** (via @aws-sdk) | RangeError DoS | Resolved by @aws-sdk update |

### Moderate (13)
| Package | Issue | Notes |
|---------|-------|-------|
| esbuild (via drizzle-kit) | Dev server security | Dev only |
| dompurify (via jspdf) | XSS | Fixed by jspdf 4.x |
| jsondiffpatch (via ai-legacy) | XSS | Fixed by removing ai-legacy |
| vite (via vitest) | Windows path bypass | OS-specific |
| next-auth@5.0.0-beta.25 | Email misdelivery | Update to beta.30+ |
| mdast-util-to-hast | Unsanitized class | Update react-markdown |
| undici (via @vercel/blob) | Decompression DoS | Update @vercel/blob |
| js-yaml | Prototype pollution | Transitive, many paths |

### Low (2)
| Package | Issue |
|---------|-------|
| ai@4.3.19 (ai-legacy) | Filetype whitelist bypass |
| @smithy/config-resolver | Region parameter defense |

---

## ⚠️ Major Updates Needed (DO NOT APPLY OVERNIGHT)

### 🚨 High Priority (Security)
| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| **jspdf** | 2.5.2 | 4.1.0 | **CRITICAL** - 6 CVEs. API changes likely. |
| **xlsx** | 0.18.5 | - | **No fix** - Consider exceljs or SheetJS Pro |
| **next-auth** | 5.0.0-beta.25 | 5.0.0-beta.30+ | Still in beta, test auth flows |
| **googleapis** | 134.0.0 | 171.2.0 | Fixes jws vuln, major jump |

### Framework & Build
| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| next | 15.5.10 | 16.1.6 | MAJOR - Breaking changes |
| react/react-dom | 19.0.0-rc | 19.2.4 | Should upgrade to stable |
| tailwindcss | 3.4.17 | 4.1.18 | MAJOR - New config format |
| eslint | 8.57.1 | 9.39.2 | MAJOR - Flat config |
| vitest | 2.1.9 | 4.0.18 | MAJOR |
| @biomejs/biome | 1.9.4 | 2.3.14 | MAJOR |

### Database & ORM
| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| @prisma/client | 6.16.2 | 7.3.0 | MAJOR - Check migrations |
| drizzle-orm | 0.34.1 | 0.45.1 | Test thoroughly |
| drizzle-kit | 0.25.0 | 0.31.8 | Test thoroughly |

### API & Services
| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| openai | 4.104.0 | 6.17.0 | MAJOR - API changes |
| stripe | 18.5.0 | 20.3.0 | MAJOR - Test payments |
| @vercel/functions | 2.2.13 | 3.4.1 | MAJOR |
| @vercel/blob | 0.24.1 | 2.0.1 | MAJOR |

### UI & Animation
| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| framer-motion | 11.18.2 | 12.31.0 | MAJOR |
| sonner | 1.7.4 | 2.0.7 | MAJOR |
| react-resizable-panels | 2.1.9 | 4.5.9 | MAJOR |
| tailwind-merge | 2.6.0 | 3.4.0 | MAJOR |
| lucide-react | 0.446.0 | 0.563.0 | Minor-ish |

### Other Notable
| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| puppeteer | 23.11.1 | 24.36.1 | MAJOR - Chrome version |
| marked | 15.0.12 | 17.0.1 | MAJOR |
| natural | 6.12.0 | 8.1.0 | MAJOR |
| dotenv | 16.6.1 | 17.2.3 | MAJOR |

---

## ⚡ Deprecated Packages

| Package | Status | Action |
|---------|--------|--------|
| **@vercel/postgres** | Deprecated | Migrate to `postgres` or `pg` |
| **eslint@8.x** | No longer supported | Upgrade to 9.x |
| **puppeteer@23.x** | < 24.10.2 deprecated | Upgrade to 24.x+ |

---

## 📋 Recommended Actions

### Immediate (This PR)
- ✅ **Next.js security patch** - Applied (15.5.9 → 15.5.10)
- ✅ **47 safe dependency updates** - Applied

### This Week
1. 🔲 **jspdf upgrade** - Test in dev, then upgrade to 4.1.0 (fixes CRITICAL vuln)
2. 🔲 **xlsx replacement** - Evaluate alternatives (exceljs, xlsx-populate)
3. 🔲 **next-auth update** - Test auth flows, update to beta.30+

### Short Term (2 Weeks)
1. 🔲 **googleapis** - Update to fix jws vulnerability
2. 🔲 **React stable** - Move from RC to 19.2.4
3. 🔲 **stripe** - Test payment flows, update to v20

### Medium Term (1 Month)
1. 🔲 **ESLint 9** - New flat config format
2. 🔲 **Tailwind 4** - New config system
3. 🔲 **Next.js 16** - After stable release testing

---

## 🔍 Peer Dependency Warnings

```
├── @ai-sdk/react: wants react@"^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"
│   └── found: 19.0.0-rc (upgrade React to stable)
├── next-themes: wants react@"^16.8 || ^17 || ^18"
│   └── found: 19.0.0-rc (needs next-themes 0.4+)
├── ai-legacy (ai@4.3.19): wants zod@^3.23.8
│   └── found: 4.3.6 (zod v4 breaking)
└── openai: wants zod@^3.23.8
    └── found: 4.3.6 (zod v4 breaking)
```

**Note:** Consider removing `ai-legacy` alias if not actively used.

---

## Files Changed

- `pnpm-lock.yaml` - Updated with 47 safe dependency versions
- `DEPENDENCY-AUDIT.md` - This report

---

*Generated by automated dependency audit on Feb 4, 2026*
