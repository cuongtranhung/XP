# CLAUDE CODE - HƯỚNG DẪN TUÂN THỦ TÀI LIỆU DỰ ÁN XP

## 🤖 TỔNG QUAN CHO AI ASSISTANT

Đây là tài liệu hướng dẫn đặc biệt dành cho Claude Code và các AI assistants khác khi làm việc với dự án XP. Vui lòng đọc kỹ và tuân thủ nghiêm ngặt các quy tắc này.

## 📋 QUY TẮC CƠ BẢN

### 1. NGUYÊN TẮC VÀNG
```yaml
ALWAYS:
  - Maintain existing documentation structure
  - Follow established naming conventions
  - Update related docs when making changes
  - Include metadata headers in all docs
  - Test code examples before documenting

NEVER:
  - Delete existing documentation without explicit request
  - Change documentation structure without approval
  - Include sensitive information (passwords, API keys)
  - Create duplicate documentation
  - Use inconsistent formatting
```

### 2. NGÔN NGỮ SỬ DỤNG
```yaml
Technical Documentation:
  language: English
  exceptions:
    - User guides for Vietnamese users
    - Business requirements documents

Code Comments:
  language: English
  style: JSDoc/TSDoc format

Commit Messages:
  language: English
  format: "docs: [action] [scope] - [description]"
```

## 🏗️ CẤU TRÚC TÀI LIỆU

### Khi Tạo Tài Liệu Mới
```markdown
1. Xác định loại tài liệu:
   - Feature Documentation → /docs/03-features/
   - API Documentation → /docs/04-api/
   - Guides → /docs/01-getting-started/
   - Architecture → /docs/02-architecture/

2. Sử dụng template phù hợp:
   - Feature: Use feature-doc-template.md
   - API: Use api-doc-template.md
   - Guide: Use guide-template.md

3. Thêm metadata header:
   ---
   title: [Document Title]
   version: 1.0.0
   date: [YYYY-MM-DD]
   author: Claude Code
   status: draft
   tags: [relevant, tags]
   ---
```

### File Naming Convention
```bash
# Format: [category]-[topic]-[subtopic].md
# Examples:
api-auth-endpoints.md       # API documentation
guide-form-builder-basic.md  # User guide
feature-comments-system.md   # Feature documentation

# WRONG examples (DO NOT USE):
AuthAPI.md                   # Wrong: PascalCase
api_auth_endpoints.md        # Wrong: underscores
api-auth.md                  # Wrong: too generic
```

## 📝 TEMPLATES CHO CLAUDE CODE

### Template 1: Feature Documentation
```markdown
---
title: [Feature Name]
version: 1.0.0
date: YYYY-MM-DD
author: Claude Code
status: draft
tags: [feature, module-name]
---

# [Feature Name]

## Overview
[2-3 sentences describing the feature]

## Key Features
- Feature point 1
- Feature point 2
- Feature point 3

## Technical Implementation

### Architecture
[Describe the architecture with diagrams if needed]

### Components
| Component | Purpose | Location |
|-----------|---------|----------|
| Component1 | Purpose | /path/to/component |

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/resource | Get resources |
| POST | /api/resource | Create resource |

## Usage Examples

### Basic Usage
\`\`\`typescript
// Example code here
\`\`\`

### Advanced Usage
\`\`\`typescript
// Advanced example
\`\`\`

## Configuration
\`\`\`env
# Required environment variables
VARIABLE_NAME=value
\`\`\`

## Testing
- Unit tests: /path/to/tests
- Integration tests: /path/to/integration
- E2E tests: /e2e/tests/

## Troubleshooting

### Common Issues
| Issue | Solution |
|-------|----------|
| Error message | Solution steps |

## Related Documentation
- [Related Doc 1](./related-doc-1.md)
- [Related Doc 2](./related-doc-2.md)
```

### Template 2: API Documentation
```markdown
---
title: API - [Endpoint Name]
version: 1.0.0
date: YYYY-MM-DD
author: Claude Code
status: draft
tags: [api, endpoint]
---

# API: [Endpoint Name]

## Endpoint
`[METHOD] /api/path/to/endpoint`

## Description
[What this endpoint does]

## Authentication
- Required: Yes/No
- Type: JWT Bearer Token
- Permissions: [list required permissions]

## Request

### Headers
| Header | Value | Required |
|--------|-------|----------|
| Authorization | Bearer {token} | Yes |
| Content-Type | application/json | Yes |

### Parameters
| Name | Type | Required | Description | Example |
|------|------|----------|-------------|---------|
| param1 | string | Yes | Description | "value" |

### Body
\`\`\`json
{
  "field1": "value1",
  "field2": 123
}
\`\`\`

## Response

### Success (200)
\`\`\`json
{
  "success": true,
  "data": {
    "id": 1,
    "field": "value"
  }
}
\`\`\`

### Error Responses
| Code | Description | Response |
|------|-------------|----------|
| 400 | Bad Request | `{"error": "Invalid input"}` |
| 401 | Unauthorized | `{"error": "Token invalid"}` |
| 404 | Not Found | `{"error": "Resource not found"}` |
| 500 | Server Error | `{"error": "Internal server error"}` |

## Examples

### cURL
\`\`\`bash
curl -X POST https://api.example.com/endpoint \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"field": "value"}'
\`\`\`

### JavaScript
\`\`\`javascript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ field: 'value' })
});
\`\`\`

## Rate Limiting
- Limit: 100 requests per minute
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial release |
```

## 🔄 KHI CẬP NHẬT TÀI LIỆU

### Checklist Trước Khi Cập Nhật
```markdown
Before updating any documentation:
- [ ] Read the current version completely
- [ ] Identify all sections that need updates
- [ ] Check for related documents that might be affected
- [ ] Verify code changes that triggered the update
- [ ] Test any new code examples
```

### Quy Trình Cập Nhật
```yaml
1. Update Content:
   - Make necessary changes
   - Keep existing structure
   - Maintain consistent formatting

2. Update Metadata:
   - Increment version number
   - Update date
   - Change status if needed
   - Add your identifier (Claude Code)

3. Update Changelog:
   - Add entry to document's changelog section
   - Update main CHANGELOG.md if significant

4. Cross-Reference Check:
   - Update any documents that reference this one
   - Fix broken links
   - Update examples in other docs

5. Validation:
   - Verify all code examples work
   - Check all links are valid
   - Ensure formatting is consistent
```

## 🎯 SPECIFIC RULES FOR XP PROJECT

### 1. Technology Stack Documentation
```yaml
Frontend (React + TypeScript):
  - Always use TypeScript in examples
  - Include type definitions
  - Use functional components with hooks
  - Follow established component patterns

Backend (Node.js + Express):
  - Use async/await patterns
  - Include error handling
  - Document middleware requirements
  - Specify TypeScript types

Database (PostgreSQL):
  - Include migration files references
  - Document table relationships
  - Provide SQL examples
  - Reference existing schemas
```

### 2. Module-Specific Rules

#### Dynamic Form Builder
```markdown
Location: /docs/03-features/dynamic-forms/
Required Sections:
- Field types documentation
- Validation rules
- Conditional logic
- Form templates
- API integration
```

#### Authentication System
```markdown
Location: /docs/03-features/authentication/
Required Sections:
- JWT token flow
- Session management
- Security considerations
- API endpoints
- Error handling
```

#### Comment System
```markdown
Location: /docs/03-features/comments/
Required Sections:
- Nested structure
- Real-time updates
- Moderation features
- Database schema
- WebSocket events
```

## 🚨 CRITICAL WARNINGS

### NEVER Do These
```yaml
Security Violations:
  - ❌ Include real API keys or tokens
  - ❌ Show actual user data
  - ❌ Expose internal URLs or IPs
  - ❌ Document security vulnerabilities without fixes

Documentation Sins:
  - ❌ Delete without explicit permission
  - ❌ Change core structure without approval
  - ❌ Create duplicate documentation
  - ❌ Use inconsistent formatting
  - ❌ Mix languages inappropriately
```

### ALWAYS Do These
```yaml
Best Practices:
  - ✅ Test all code examples
  - ✅ Update version numbers
  - ✅ Include metadata headers
  - ✅ Cross-reference related docs
  - ✅ Follow naming conventions
  - ✅ Maintain existing structure
  - ✅ Add to appropriate indexes
```

## 📊 AUTOMATED CHECKS

### When Creating/Updating Docs, Verify:
```bash
# 1. Markdown syntax is valid
# Check for common markdown errors

# 2. Links are working
# All internal links should resolve

# 3. Code examples are valid
# TypeScript/JavaScript should compile

# 4. Metadata is complete
# All required fields present

# 5. File naming is correct
# Follows kebab-case convention

# 6. Location is appropriate
# In correct directory structure
```

## 🔗 INTEGRATION POINTS

### With Existing Documentation
```yaml
Always Update These Indexes:
  - /docs/README.md - Main documentation index
  - /docs/[category]/README.md - Category index
  - /CHANGELOG.md - For significant changes
  - /README.md - If affecting main features

Cross-Reference Requirements:
  - Link to related documentation
  - Update references in other docs
  - Maintain bidirectional links
  - Update navigation structures
```

### With Code Changes
```yaml
Code → Documentation Flow:
  1. Code change detected
  2. Identify affected documentation
  3. Update technical details
  4. Update examples
  5. Update API documentation
  6. Update troubleshooting if needed
```

## 📈 QUALITY METRICS

### Your Documentation Should Meet:
```yaml
Completeness:
  - All sections filled
  - Examples provided
  - Edge cases covered
  - Troubleshooting included

Accuracy:
  - Code examples tested
  - API details verified
  - Version numbers correct
  - Links functional

Clarity:
  - Clear language
  - Logical structure
  - Good formatting
  - Helpful diagrams

Consistency:
  - Follows templates
  - Uses standard terms
  - Maintains style
  - Proper categorization
```

## 🆘 WHEN IN DOUBT

### Ask for Clarification On:
1. Major structural changes
2. Deleting existing documentation
3. Creating new categories
4. Changing established patterns
5. Security-related documentation
6. Architecture decisions

### Default Behaviors:
```yaml
When uncertain:
  - Preserve existing content
  - Add rather than replace
  - Mark sections as "draft"
  - Include TODO comments
  - Request human review
```

## 📝 COMMIT MESSAGE FORMAT

### For Documentation Changes:
```bash
# Format: docs: [action] [scope] - [description]

# Examples:
docs: add form-builder guide - comprehensive usage instructions
docs: update api-auth - add refresh token endpoint
docs: fix deployment guide - correct Docker commands
docs: refactor features section - improve organization

# Actions: add, update, fix, remove, refactor
# Scope: specific document or section
# Description: clear, concise summary
```

## 🎯 QUICK REFERENCE

### Document Types & Locations
| Type | Location | Template | Language |
|------|----------|----------|----------|
| Feature | /docs/03-features/ | feature-template | English |
| API | /docs/04-api/ | api-template | English |
| Guide | /docs/01-getting-started/ | guide-template | EN/VN |
| Architecture | /docs/02-architecture/ | arch-template | English |
| Troubleshooting | /docs/07-troubleshooting/ | trouble-template | EN/VN |

### Version Increment Rules
| Change Type | Version Change | Example |
|-------------|---------------|---------|
| Major rewrite | X.0.0 | 1.0.0 → 2.0.0 |
| New sections | 0.X.0 | 1.0.0 → 1.1.0 |
| Minor fixes | 0.0.X | 1.0.0 → 1.0.1 |

---

## FINAL NOTES FOR CLAUDE CODE

1. **This document is your primary reference** for documentation standards in the XP project
2. **When conflicts arise**, this document takes precedence over general practices
3. **Always maintain backward compatibility** in documentation structure
4. **Request clarification** when requirements are ambiguous
5. **Prioritize accuracy over speed** - better to be correct than fast

Remember: Good documentation is an investment in the project's future. Your contributions help developers understand, maintain, and extend the system effectively.

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-10  
**For**: Claude Code and AI Assistants  
**Project**: XP - Fullstack Authentication System