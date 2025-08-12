# CLAUDE CODE - VALIDATION CHECKLIST

## 🎯 MASTER CHECKLIST FOR AI-GENERATED DOCUMENTATION

This checklist ensures all documentation created or modified by Claude Code meets XP project standards.

---

## ✅ PRE-DOCUMENTATION CHECKLIST

### 1. Context Understanding
- [ ] Read existing related documentation
- [ ] Understand the feature/component being documented
- [ ] Identify target audience (developers/users/admins)
- [ ] Review recent code changes that triggered documentation need
- [ ] Check for existing similar documentation to avoid duplication

### 2. Planning
- [ ] Choose correct document type (feature/api/guide/troubleshooting)
- [ ] Select appropriate template
- [ ] Determine correct location in /docs structure
- [ ] Plan sections and content outline
- [ ] Identify required code examples

---

## 📝 DURING DOCUMENTATION CHECKLIST

### 3. Metadata Header
```yaml
Required Fields - ALL must be present:
- [ ] title: Descriptive and clear
- [ ] version: Starting at 1.0.0 for new docs
- [ ] date: YYYY-MM-DD format
- [ ] author: "Claude Code" or appropriate identifier
- [ ] status: draft|review|approved|deprecated
- [ ] tags: Relevant keywords for searchability
```

### 4. Content Structure
- [ ] Clear hierarchy with proper heading levels (# ## ###)
- [ ] Logical flow from overview to details
- [ ] All required sections per template included
- [ ] No missing or empty sections
- [ ] Consistent formatting throughout

### 5. Language & Style
- [ ] Technical docs in English
- [ ] User guides bilingual if needed (EN/VN)
- [ ] Clear, concise sentences
- [ ] Active voice preferred
- [ ] Technical terms explained on first use
- [ ] No jargon without explanation

### 6. Code Examples
```markdown
Every code example must:
- [ ] Be syntactically correct
- [ ] Include proper language tag (```typescript, ```javascript)
- [ ] Have appropriate comments
- [ ] Show both basic and advanced usage
- [ ] Include error handling
- [ ] Be tested and working
- [ ] Include import statements where needed
```

### 7. API Documentation
If documenting APIs:
- [ ] Complete endpoint URL
- [ ] HTTP method specified
- [ ] Authentication requirements clear
- [ ] All parameters documented with types
- [ ] Request body examples
- [ ] All possible response codes
- [ ] Response body examples
- [ ] Rate limiting information
- [ ] cURL and JavaScript examples

### 8. Tables & Lists
- [ ] Tables have headers
- [ ] Table columns aligned properly
- [ ] Lists use consistent markers (- or 1.)
- [ ] Nested lists properly indented
- [ ] No broken table formatting

### 9. Links & References
- [ ] All internal links use relative paths
- [ ] External links use full URLs
- [ ] Links are functional (not broken)
- [ ] Cross-references to related docs included
- [ ] Link text is descriptive (not "click here")

---

## 🔒 SECURITY & COMPLIANCE CHECKLIST

### 10. Security Review
```yaml
MUST NOT include:
- [ ] Real passwords or credentials
- [ ] Actual API keys or tokens  
- [ ] Production URLs or IPs
- [ ] Real user data or PII
- [ ] Internal system paths
- [ ] Security vulnerabilities without fixes

MUST include:
- [ ] Security warnings where appropriate
- [ ] Best practices for secure usage
- [ ] Authentication/authorization requirements
```

### 11. Compliance
- [ ] Follows project naming conventions
- [ ] Located in correct directory
- [ ] File name follows kebab-case
- [ ] Matches [category]-[topic]-[subtopic].md format
- [ ] No copyright violations
- [ ] Proper attributions for external content

---

## ✨ POST-DOCUMENTATION CHECKLIST

### 12. Quality Assurance
```markdown
Technical Accuracy:
- [ ] All information factually correct
- [ ] Version numbers accurate
- [ ] Dependencies correctly listed
- [ ] Configuration values verified

Completeness:
- [ ] All use cases covered
- [ ] Edge cases documented
- [ ] Troubleshooting section included
- [ ] FAQ if applicable

Clarity:
- [ ] Can be understood by target audience
- [ ] No ambiguous instructions
- [ ] Step-by-step procedures clear
- [ ] Examples illustrate concepts well
```

### 13. Integration
- [ ] Added to appropriate index files
- [ ] Updated main /docs/README.md if needed
- [ ] Updated category README.md
- [ ] Cross-references updated in related docs
- [ ] Navigation structure maintained

### 14. Version Control
```bash
Commit preparation:
- [ ] Meaningful commit message
- [ ] Format: "docs: [action] [scope] - [description]"
- [ ] All related files included
- [ ] No unrelated changes mixed in
```

### 15. Final Validation
- [ ] Markdown syntax valid (no rendering errors)
- [ ] Spell check passed
- [ ] Grammar check passed
- [ ] Format consistency verified
- [ ] File size reasonable (<100KB for most docs)

---

## 🔄 UPDATE CHECKLIST

When updating existing documentation:

### 16. Pre-Update
- [ ] Read entire current document
- [ ] Understand what triggered the update
- [ ] Identify all sections needing changes
- [ ] Check for dependent documentation

### 17. During Update  
- [ ] Maintain existing structure
- [ ] Update version number (increment appropriately)
- [ ] Update date in metadata
- [ ] Add changelog entry
- [ ] Keep consistent formatting
- [ ] Test any new code examples

### 18. Post-Update
- [ ] All changes documented in changelog
- [ ] Related documents updated
- [ ] Broken links fixed
- [ ] Index files updated if needed
- [ ] Commit message describes changes

---

## 🚨 CRITICAL VALIDATION POINTS

### Red Flags - STOP if any are true:
```yaml
- Including sensitive information
- Deleting content without permission  
- Major structural changes without approval
- Creating duplicate documentation
- Changing established patterns
- Mixing languages inappropriately
- Untested code examples
- Broken markdown formatting
```

### Green Flags - PROCEED when all are true:
```yaml
- Metadata complete and accurate
- Structure follows templates
- Examples tested and working
- Security reviewed
- Links validated
- Properly located and named
- Integrated with existing docs
- Quality standards met
```

---

## 📊 AUTOMATED VALIDATION COMMANDS

### Commands Claude Code Should Run:
```bash
# 1. Validate Markdown syntax
npx markdownlint docs/your-file.md

# 2. Check for broken links
npx markdown-link-check docs/your-file.md

# 3. Spell check
npx cspell docs/your-file.md

# 4. Format check
npx prettier --check docs/your-file.md

# 5. Custom validation (if available)
npm run docs:validate docs/your-file.md
```

---

## 📈 QUALITY SCORING

Rate your documentation (aim for 90%+):

### Scoring Criteria (10 points each):
1. [ ] Metadata complete and accurate (10)
2. [ ] Structure follows template (10)
3. [ ] All sections properly filled (10)
4. [ ] Code examples tested and working (10)
5. [ ] Links functional and relevant (10)
6. [ ] Security guidelines followed (10)
7. [ ] Language clear and consistent (10)
8. [ ] Properly integrated with existing docs (10)
9. [ ] Troubleshooting section helpful (10)
10. [ ] Version control properly handled (10)

**Total Score: ___/100**

### Score Interpretation:
- **90-100**: Excellent - Ready to publish
- **70-89**: Good - Minor improvements needed
- **50-69**: Fair - Significant improvements required
- **Below 50**: Poor - Major rework needed

---

## 🎯 QUICK VALIDATION SUMMARY

### For New Documentation:
```
1. ✓ Correct template used
2. ✓ Metadata header complete
3. ✓ Located in right directory
4. ✓ Named correctly (kebab-case)
5. ✓ All sections filled
6. ✓ Code examples tested
7. ✓ Links validated
8. ✓ Security reviewed
9. ✓ Integrated with indexes
10. ✓ Commit message proper
```

### For Updates:
```
1. ✓ Version incremented
2. ✓ Date updated
3. ✓ Changelog entry added
4. ✓ Related docs updated
5. ✓ Examples still working
6. ✓ Links still valid
7. ✓ Structure maintained
8. ✓ Cross-references updated
9. ✓ Indexes updated
10. ✓ Commit describes changes
```

---

## 📞 ESCALATION GUIDE

### When to Request Human Review:

1. **Major Changes**: Structural reorganization, new categories
2. **Security Concerns**: Documenting auth, encryption, vulnerabilities  
3. **Architecture Decisions**: System design, technology choices
4. **Public-Facing**: User guides, API documentation for external use
5. **Uncertainty**: Any doubt about approach or content

### How to Mark for Review:
```yaml
---
status: review_required
review_notes: |
  - Concern about security implications
  - Need confirmation on API design
  - Unsure about example appropriateness
---
```

---

## 🏁 FINAL CHECKLIST BEFORE SUBMISSION

### The Ultimate Final Check:
- [ ] Would a new developer understand this?
- [ ] Are all examples actually helpful?
- [ ] Is sensitive information protected?
- [ ] Does it follow all project standards?
- [ ] Is it better than what existed before?

If all boxes are checked: **✅ READY TO COMMIT**

---

**Validation Checklist Version**: 1.0.0  
**Last Updated**: 2025-01-10  
**Purpose**: Ensure AI-generated documentation meets XP project standards  
**Usage**: Check each item before creating or updating documentation