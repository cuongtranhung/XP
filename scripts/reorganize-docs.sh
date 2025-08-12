#!/bin/bash

# Script tự động tổ chức lại documentation
# Usage: ./reorganize-docs.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Documentation Reorganization Script ===${NC}"

# Step 1: Backup existing files
echo -e "${YELLOW}Step 1: Creating backup...${NC}"
BACKUP_DIR="docs-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r *.md "$BACKUP_DIR/" 2>/dev/null || true
cp -r *.MD "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✓ Backup created in $BACKUP_DIR${NC}"

# Step 2: Create new directory structure
echo -e "${YELLOW}Step 2: Creating new directory structure...${NC}"
mkdir -p docs/{01-getting-started,02-architecture/{components},03-features/{dynamic-forms,user-management,gps-tracking,activity-logging,real-time},04-api/{endpoints},05-deployment,06-testing,07-troubleshooting,08-development,09-reports/{performance,security-audits,improvement-logs}}

echo -e "${GREEN}✓ Directory structure created${NC}"

# Step 3: Move and rename files
echo -e "${YELLOW}Step 3: Moving and organizing files...${NC}"

# Getting Started
[ -f "DEV_SETUP.md" ] && mv "DEV_SETUP.md" "docs/01-getting-started/dev-setup.md"
[ -f "DATABASE_SETUP.md" ] && mv "DATABASE_SETUP.md" "docs/01-getting-started/database-setup.md"
[ -f "TEST_CREDENTIALS.md" ] && mv "TEST_CREDENTIALS.md" "docs/01-getting-started/test-credentials.md"
[ -f "PERMANENT_TEST_CREDENTIALS.md" ] && mv "PERMANENT_TEST_CREDENTIALS.md" "docs/01-getting-started/test-credentials-permanent.md"

# Architecture
[ -f "PROJECT_STRUCTURE.md" ] && mv "PROJECT_STRUCTURE.md" "docs/02-architecture/project-structure.md"
[ -f "SYSTEM_IMPROVEMENT_INITIATIVES.md" ] && mv "SYSTEM_IMPROVEMENT_INITIATIVES.md" "docs/02-architecture/system-initiatives.md"

# Dynamic Forms Feature
for file in DYNAMIC_FORM_BUILDER_*.md DYNAMIC-FORM-BUILDER-*.MD; do
    if [ -f "$file" ]; then
        new_name=$(echo "$file" | sed 's/DYNAMIC_FORM_BUILDER_//g' | sed 's/DYNAMIC-FORM-BUILDER-//g' | tr '[:upper:]' '[:lower:]')
        mv "$file" "docs/03-features/dynamic-forms/$new_name"
    fi
done

# GPS Feature
for file in GPS*.md GPS*.MD; do
    if [ -f "$file" ]; then
        new_name=$(echo "$file" | sed 's/GPS_//g' | sed 's/GPS-//g' | tr '[:upper:]' '[:lower:]')
        mv "$file" "docs/03-features/gps-tracking/$new_name"
    fi
done

# User Activity Logging
for file in UAL_*.md USER_ACTIVITY_*.md; do
    if [ -f "$file" ]; then
        new_name=$(echo "$file" | sed 's/UAL_//g' | sed 's/USER_ACTIVITY_//g' | tr '[:upper:]' '[:lower:]')
        mv "$file" "docs/03-features/activity-logging/$new_name"
    fi
done

# API Documentation
[ -f "API_DOCUMENTATION.md" ] && mv "API_DOCUMENTATION.md" "docs/04-api/overview.md"
[ -f "API_DOCUMENTATION_COMPLETE.md" ] && mv "API_DOCUMENTATION_COMPLETE.md" "docs/04-api/complete-reference.md"

# Deployment
[ -f "DOCKER_SETUP.md" ] && mv "DOCKER_SETUP.md" "docs/05-deployment/docker.md"
[ -f "DEPLOYMENT_GUIDE.md" ] && mv "DEPLOYMENT_GUIDE.md" "docs/05-deployment/deployment-guide.md"
[ -f "WINDOWS_SERVER_DEPLOYMENT.md" ] && mv "WINDOWS_SERVER_DEPLOYMENT.md" "docs/05-deployment/windows-server.md"
[ -f "WINDOWS_WSL2_ACCESS_FIX.md" ] && mv "WINDOWS_WSL2_ACCESS_FIX.md" "docs/05-deployment/wsl2-setup.md"
[ -f "MONITORING_GUIDE.md" ] && mv "MONITORING_GUIDE.md" "docs/05-deployment/monitoring.md"

# Testing
[ -f "TEST_REPORT.md" ] && mv "TEST_REPORT.md" "docs/06-testing/test-report.md"
[ -f "MANUAL_TEST_GUIDE.md" ] && mv "MANUAL_TEST_GUIDE.md" "docs/06-testing/manual-testing.md"
[ -f "test-manual-steps.md" ] && mv "test-manual-steps.md" "docs/06-testing/manual-test-steps.md"
[ -f "test-report.md" ] && mv "test-report.md" "docs/06-testing/test-results.md"

# Troubleshooting - Merge similar files
echo -e "${YELLOW}Merging troubleshooting files...${NC}"

# Merge LOGIN files
cat LOGIN_*.md 2>/dev/null > "docs/07-troubleshooting/login-issues.md" || true
rm -f LOGIN_*.md

# Merge STABILITY files
cat STABILITY*.md 2>/dev/null > "docs/07-troubleshooting/stability.md" || true
rm -f STABILITY*.md

# Other troubleshooting
[ -f "TROUBLESHOOTING_FINAL.md" ] && mv "TROUBLESHOOTING_FINAL.md" "docs/07-troubleshooting/common-issues.md"
[ -f "EMERGENCY_RECOVERY.md" ] && mv "EMERGENCY_RECOVERY.md" "docs/07-troubleshooting/emergency-recovery.md"

# Development
[ -f "CLAUDE.md" ] && mv "CLAUDE.md" "docs/08-development/claude-config.md"
[ -f "CLAUDE_QUICK_REF.md" ] && mv "CLAUDE_QUICK_REF.md" "docs/08-development/claude-quick-ref.md"
[ -f "DEVELOPMENT_GUIDELINES_DO_NOT.md" ] && mv "DEVELOPMENT_GUIDELINES_DO_NOT.md" "docs/08-development/guidelines.md"
[ -f "SWARM_SETUP_GUIDE.md" ] && mv "SWARM_SETUP_GUIDE.md" "docs/08-development/swarm-setup.md"

# Reports
[ -f "BUILD_REPORT.md" ] && mv "BUILD_REPORT.md" "docs/09-reports/performance/build-report.md"
[ -f "BUILD_RESULTS.md" ] && mv "BUILD_RESULTS.md" "docs/09-reports/performance/build-results.md"
[ -f "STARTUP_PERFORMANCE_REPORT.md" ] && mv "STARTUP_PERFORMANCE_REPORT.md" "docs/09-reports/performance/startup-performance.md"
[ -f "STARTUP_OPTIMIZATION_RESULTS.md" ] && mv "STARTUP_OPTIMIZATION_RESULTS.md" "docs/09-reports/performance/startup-optimization.md"
[ -f "IMPROVEMENT_SUMMARY.md" ] && mv "IMPROVEMENT_SUMMARY.md" "docs/09-reports/improvement-logs/improvement-summary.md"
[ -f "TYPESCRIPT_FIX_REPORT.md" ] && mv "TYPESCRIPT_FIX_REPORT.md" "docs/09-reports/improvement-logs/typescript-fixes.md"

# Move remaining reports
for file in *_REPORT.md *_SUMMARY.md; do
    if [ -f "$file" ]; then
        new_name=$(echo "$file" | tr '[:upper:]' '[:lower:]')
        mv "$file" "docs/09-reports/improvement-logs/$new_name"
    fi
done

echo -e "${GREEN}✓ Files moved and organized${NC}"

# Step 4: Create index files
echo -e "${YELLOW}Step 4: Creating index files...${NC}"

# Main docs index
cat > docs/README.md << 'EOF'
# Documentation Index

## 📚 Quick Navigation

### 1. [Getting Started](./01-getting-started/)
- [Installation & Setup](./01-getting-started/dev-setup.md)
- [Database Setup](./01-getting-started/database-setup.md)
- [Test Credentials](./01-getting-started/test-credentials.md)

### 2. [Architecture](./02-architecture/)
- [System Design](./02-architecture/project-structure.md)
- [Components](./02-architecture/components/)

### 3. [Features](./03-features/)
- [Dynamic Forms](./03-features/dynamic-forms/)
- [User Management](./03-features/user-management/)
- [GPS Tracking](./03-features/gps-tracking/)
- [Activity Logging](./03-features/activity-logging/)

### 4. [API Documentation](./04-api/)
- [API Overview](./04-api/overview.md)
- [Endpoints](./04-api/endpoints/)

### 5. [Deployment](./05-deployment/)
- [Docker Setup](./05-deployment/docker.md)
- [Windows Server](./05-deployment/windows-server.md)
- [Monitoring](./05-deployment/monitoring.md)

### 6. [Testing](./06-testing/)
- [Manual Testing](./06-testing/manual-testing.md)
- [Test Reports](./06-testing/test-report.md)

### 7. [Troubleshooting](./07-troubleshooting/)
- [Common Issues](./07-troubleshooting/common-issues.md)
- [Login Issues](./07-troubleshooting/login-issues.md)
- [Stability Issues](./07-troubleshooting/stability.md)

### 8. [Development](./08-development/)
- [Claude Configuration](./08-development/claude-config.md)
- [Development Guidelines](./08-development/guidelines.md)

### 9. [Reports & Analysis](./09-reports/)
- [Performance Reports](./09-reports/performance/)
- [Improvement Logs](./09-reports/improvement-logs/)
EOF

echo -e "${GREEN}✓ Index files created${NC}"

# Step 5: Clean up empty files and old references
echo -e "${YELLOW}Step 5: Cleaning up...${NC}"
find docs -type f -empty -delete
find docs -type d -empty -delete

# Step 6: Summary
echo -e "${GREEN}=== Reorganization Complete ===${NC}"
echo -e "${GREEN}Original files backed up to: $BACKUP_DIR${NC}"
echo -e "${GREEN}New documentation structure created in: docs/${NC}"

# Count files
TOTAL_FILES=$(find docs -name "*.md" | wc -l)
echo -e "${GREEN}Total markdown files organized: $TOTAL_FILES${NC}"

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the new structure in docs/"
echo "2. Update any broken links in the documentation"
echo "3. Remove the backup directory when satisfied: rm -rf $BACKUP_DIR"
echo "4. Commit changes: git add docs/ && git commit -m 'Reorganize documentation structure'"