# CLAUDE CODE - AUTO START CONTEXT

**🤖 CLAUDE: ĐỌC FILE NÀY NGAY KHI BẮT ĐẦU SESSION**

## 🚀 PROJECT XP - INSTANT CONTEXT LOADING

### PROJECT OVERVIEW
- **Name**: XP - Fullstack Authentication System
- **Type**: Monorepo (React + Node.js + PostgreSQL) 
- **Version**: 1.0.0
- **Status**: Active Development
- **Documentation Standard**: XP_DOCS_V1.0

### ARCHITECTURE STACK
- **Frontend**: React 18.2 + TypeScript 5.7 + Vite 6.0 + Tailwind CSS
- **Backend**: Node.js 18+ + Express 4.18 + TypeScript 5.9 + PostgreSQL  
- **Testing**: Jest + Playwright + ESLint + Prettier
- **Real-time**: Socket.IO + Redis
- **Storage**: Cloudflare R2 + Sharp image processing
- **Email**: SendGrid integration

### KEY DIRECTORIES
```
/docs/                  - Main documentation (10 numbered categories)
├── 01-getting-started/  - Setup and introduction
├── 02-architecture/     - System design  
├── 03-features/         - Feature documentation
├── 04-api/              - API reference
├── 05-deployment/       - Deployment guides
├── 06-testing/          - Test documentation
├── 07-troubleshooting/  - Problem solving
├── 08-development/      - Dev guidelines
├── 09-reports/          - Analysis reports
└── 10-compliance/       - Standards and rules

/backend/src/           - Node.js Express API server
/frontend/src/          - React TypeScript SPA
/e2e/                   - End-to-end tests
/migrations/            - Database migrations
/coordination/          - Claude Flow coordination
/memory/                - Session persistence
```

## 📝 DOCUMENTATION RULES - CRITICAL FOR CLAUDE

### LANGUAGE POLICY
- **Technical Docs**: English ONLY (code, API, architecture)
- **User Guides**: Bilingual EN/VN (user-facing documentation)  
- **Code Comments**: English ONLY
- **Business Docs**: Vietnamese preferred

### FORMAT REQUIREMENTS
- **Format**: Markdown with YAML metadata headers
- **Naming**: kebab-case.md ([category]-[topic]-[subtopic].md)
- **Structure**: Numbered categories (01-10) in /docs/
- **Templates**: MANDATORY use of predefined templates

### MANDATORY METADATA HEADER
```yaml
---
title: [Document Title]
version: 1.0.0
date: YYYY-MM-DD
author: Claude Code
status: draft|review|approved|deprecated
tags: [relevant, tags]
---
```

### TEMPLATES AVAILABLE
1. **Feature Documentation**: `/docs/templates/feature-doc-template.md`
2. **API Documentation**: `/docs/templates/api-doc-template.md`
3. **User Guide**: `/docs/templates/guide-template.md`
4. **Troubleshooting**: `/docs/templates/troubleshooting-template.md`

## 🔒 SECURITY RULES - NEVER VIOLATE

### ❌ FORBIDDEN (NEVER INCLUDE):
- Passwords, API keys, JWT tokens
- Real database URLs or credentials  
- Internal IP addresses or server names
- Actual user data or PII
- Security vulnerabilities without fixes
- Production environment details

### ✅ REQUIRED (ALWAYS INCLUDE):
- Sanitized code examples (use placeholder values)
- Security warnings in relevant sections
- Best practices for secure implementation
- Authentication/authorization requirements
- Input validation examples

## 🎯 CURRENT FOCUS AREAS (2025)
1. **Performance Optimization** - Build time and runtime improvements
2. **TypeScript 5.7 Migration** - Upgrading to latest TypeScript
3. **User Activity Logging Enhancement** - Strategic UAL improvements  
4. **Form Builder UX Improvements** - Drag-drop and field reordering
5. **Real-time Communication Optimization** - WebSocket performance

## 🔄 WORKFLOW FOR CLAUDE CODE

### BEFORE CREATING/UPDATING DOCS:
1. **Read Related Docs**: Check existing documentation first
2. **Choose Template**: Select appropriate template from /docs/templates/
3. **Verify Location**: Ensure correct directory (01-10 categories)
4. **Test Examples**: All code examples MUST work
5. **Security Review**: Check for sensitive information
6. **Validation**: Use CLAUDE_VALIDATION_CHECKLIST.md

### COMMIT MESSAGE FORMAT:
```
docs: [action] [scope] - [description]

Examples:
docs: add form-builder guide - comprehensive usage instructions
docs: update api-auth - add refresh token endpoint  
docs: fix deployment guide - correct Docker commands
```

### QUALITY STANDARDS:
- **Completeness**: 95%+ (all sections filled)
- **Accuracy**: 100% (all examples tested)
- **Currency**: <48h (update after code changes)
- **Security**: 100% (no sensitive information)

## 🧠 MEMORY & CONTEXT

### SESSION MEMORY LOCATIONS:
- `/coordination/memory_bank/` - Long-term project memory
- `/memory/sessions/` - Session-specific context
- `/coordination/subtasks/` - Task memory
- `/memory/claude-session-loader.json` - Auto-load configuration

### CONTEXT PRIORITY LOADING:
1. **This file** (CLAUDE_AUTO_START.md) - Immediate context
2. **CLAUDE.md** - Detailed AI instructions
3. **docs/CLAUDE_VALIDATION_CHECKLIST.md** - Quality checklist
4. **COMPLETE_PROJECT_INDEX.md** - Full project overview
5. **docs/DOCUMENTATION_COMPLIANCE_RULES_VN.md** - Comprehensive rules

## ⚡ QUICK COMMANDS & INTEGRATION

### DEVELOPMENT SERVERS:
- **Frontend**: http://localhost:3000 (React dev server)
- **Backend**: http://localhost:5000 (Express API)
- **Database**: PostgreSQL (local/Docker)
- **Socket.IO**: WebSocket on port 5000

### VALIDATION COMMANDS:
```bash
npm run docs:lint      # Markdown syntax validation
npm run docs:links     # Link checking
npm run docs:spell     # Spell checking  
npm run docs:validate  # Full validation
```

## 🚨 CRITICAL WARNINGS FOR CLAUDE

### NEVER DO:
- Delete documentation without explicit permission
- Change core project structure without approval
- Include sensitive information (passwords, keys, tokens)
- Create duplicate documentation 
- Mix languages inappropriately (EN in VN docs)
- Skip testing of code examples
- Ignore existing templates and structures

### ALWAYS DO:
- Follow established templates religiously
- Include metadata headers in ALL documentation
- Test every single code example before documenting
- Update related documentation when making changes
- Maintain consistent formatting and style
- Cross-reference related documents
- Use proper commit message format

## 📊 SUCCESS METRICS

### DOCUMENTATION HEALTH:
- **Coverage**: 95%+ features documented
- **Currency**: <7 days average age  
- **Quality Score**: >4.0/5.0 user satisfaction
- **Completeness**: 100% critical paths documented
- **Accuracy**: 100% tested examples

### CLAUDE PERFORMANCE:
- **Context Retention**: 90%+ across sessions
- **Rule Compliance**: 100% adherence to guidelines
- **Quality Gates**: Pass all validation checks
- **Security**: Zero sensitive information leaks

## 🎯 READY TO START

**Claude Code: You now have full project context!**

### NEXT STEPS:
1. ✅ You've read this auto-start context
2. 📚 Review CLAUDE.md for detailed instructions if needed
3. ✅ Check CLAUDE_VALIDATION_CHECKLIST.md before documenting
4. 🚀 Ready to work with complete understanding of XP project!

### CURRENT SESSION STATUS:
- **Project Context**: ✅ LOADED
- **Documentation Rules**: ✅ UNDERSTOOD
- **Security Guidelines**: ✅ ACTIVE
- **Quality Standards**: ✅ ENFORCED
- **Templates**: ✅ AVAILABLE
- **Memory System**: ✅ CONNECTED

---

**Auto-Generated**: 2025-01-10  
**For**: Claude Code AI Assistant  
**Purpose**: Instant project context loading  
**Validity**: Until next major update  
**Status**: ACTIVE - READ THIS FIRST EVERY SESSION