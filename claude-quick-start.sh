#!/bin/bash

# CLAUDE CODE QUICK START SCRIPT
# Automatically loads project context and standards for Claude

echo "🤖 Claude Code Quick Start - XP Project"
echo "======================================="
echo ""

# Project Information
echo "📁 Project: XP - Fullstack Authentication System"
echo "🏗️  Architecture: React + Node.js + PostgreSQL"
echo "📅 Last Updated: $(date)"
echo ""

# Check if documentation files exist
echo "📋 Checking documentation files..."

CLAUDE_MD="CLAUDE.md"
DOCS_COMPLIANCE="docs/DOCUMENTATION_COMPLIANCE_RULES_VN.md"
DOCS_MANAGEMENT="docs/DOCUMENTATION_MANAGEMENT_SYSTEM.md"
VALIDATION_CHECKLIST="docs/CLAUDE_VALIDATION_CHECKLIST.md"
PROJECT_INDEX="COMPLETE_PROJECT_INDEX.md"

check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1"
        return 0
    else
        echo "❌ $1 (MISSING)"
        return 1
    fi
}

# Check all required files
all_files_exist=true

check_file "$CLAUDE_MD" || all_files_exist=false
check_file "$DOCS_COMPLIANCE" || all_files_exist=false
check_file "$DOCS_MANAGEMENT" || all_files_exist=false
check_file "$VALIDATION_CHECKLIST" || all_files_exist=false
check_file "$PROJECT_INDEX" || all_files_exist=false

echo ""

if [ "$all_files_exist" = true ]; then
    echo "✅ All documentation files are present!"
else
    echo "❌ Some documentation files are missing. Please check the files above."
    exit 1
fi

# Display quick context summary
echo ""
echo "🎯 CONTEXT SUMMARY FOR CLAUDE:"
echo "════════════════════════════════"

# Project Structure
echo ""
echo "📂 KEY DIRECTORIES:"
echo "   • /docs/           - Main documentation (10 categories)"
echo "   • /backend/src/    - Node.js API server"
echo "   • /frontend/src/   - React TypeScript SPA"
echo "   • /e2e/            - End-to-end tests"
echo "   • /migrations/     - Database migrations"

# Documentation Rules
echo ""
echo "📝 DOCUMENTATION RULES:"
echo "   • Language: English (technical), Bilingual EN/VN (user guides)"
echo "   • Format: Markdown with metadata headers"
echo "   • Naming: kebab-case.md ([category]-[topic]-[subtopic].md)"
echo "   • Location: Organized in /docs/01-10 numbered categories"

# Security Rules
echo ""
echo "🔒 SECURITY REQUIREMENTS:"
echo "   • NEVER include passwords, API keys, tokens"
echo "   • NEVER expose internal URLs or user data"
echo "   • ALWAYS sanitize examples and add security warnings"

# Current Focus
echo ""
echo "🎯 CURRENT FOCUS AREAS (2025):"
echo "   1. Performance Optimization"
echo "   2. TypeScript 5.7 Migration"
echo "   3. User Activity Logging Enhancement"
echo "   4. Form Builder UX Improvements"
echo "   5. Real-time Communication Optimization"

# Quick Commands
echo ""
echo "⚡ QUICK COMMANDS:"
echo "   • npm run dev              - Start development servers"
echo "   • npm run claude:status    - Show project status"
echo "   • npm run docs:validate    - Validate documentation"

# Memory and Context
echo ""
echo "🧠 SESSION MEMORY:"
if [ -d "coordination/memory_bank" ]; then
    memory_files=$(find coordination/memory_bank -name "*.json" 2>/dev/null | wc -l)
    echo "   • Project Memory: $memory_files files stored"
else
    echo "   • Project Memory: Not initialized"
    mkdir -p coordination/memory_bank
fi

if [ -d "memory/sessions" ]; then
    session_files=$(find memory/sessions -name "*.json" 2>/dev/null | wc -l)
    echo "   • Session Memory: $session_files files stored"
else
    echo "   • Session Memory: Not initialized"
    mkdir -p memory/sessions
fi

# Recent changes check
echo ""
echo "🔄 RECENT ACTIVITY:"
if command -v git &> /dev/null; then
    echo "   • Recent commits:"
    git log --oneline -5 --pretty=format:"     %h %s (%cr)" 2>/dev/null || echo "     No git history available"
    
    echo ""
    echo "   • Modified files in last 24 hours:"
    find . -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
    xargs ls -lt 2>/dev/null | head -5 | \
    awk '{print "     " $9 " (modified " $6 " " $7 " " $8 ")"}' || echo "     No recent modifications"
else
    echo "   • Git not available"
fi

# Instructions for Claude
echo ""
echo "🤖 INSTRUCTIONS FOR CLAUDE CODE:"
echo "════════════════════════════════════"
echo ""
echo "1. ALWAYS read CLAUDE.md first for detailed instructions"
echo "2. Use docs/CLAUDE_VALIDATION_CHECKLIST.md before creating/updating docs"
echo "3. Follow templates in docs/templates/ directory"
echo "4. Test all code examples before documenting"
echo "5. Never include sensitive information"
echo "6. Always include metadata headers in documentation"
echo "7. Use 'docs: [action] [scope] - [description]' for commit messages"
echo ""

# Context loading recommendations
echo "📚 RECOMMENDED READING ORDER:"
echo "   1. .claudecontext          - Quick project overview"
echo "   2. CLAUDE.md               - Detailed AI instructions"
echo "   3. COMPLETE_PROJECT_INDEX.md - Full project structure"
echo "   4. docs/CLAUDE_VALIDATION_CHECKLIST.md - Quality checklist"
echo ""

# Final status
echo "🚀 READY FOR CLAUDE CODE!"
echo "Use this information to understand the project context and follow documentation standards."
echo ""
echo "For more details, ask Claude to read the specific documentation files mentioned above."
echo ""
echo "Last run: $(date)"
echo "═══════════════════════════════════════════════════════════════════════════════════"