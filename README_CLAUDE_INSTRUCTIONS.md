# HƯỚNG DẪN CHO CLAUDE CODE - MỖI SESSION MỚI

## 🔄 TỰ ĐỘNG TẢI CONTEXT KHI KHỞI ĐỘNG

### Cách Claude Tự Động Hiểu Dự Án XP

Khi Claude Code khởi động session mới, hãy làm theo thứ tự này:

## 📋 BƯỚC 1: CHẠY QUICK START SCRIPT

```bash
# Chạy script này ngay khi bắt đầu session
./claude-quick-start.sh
```

Script này sẽ:
- ✅ Kiểm tra tất cả file documentation cần thiết
- 📊 Hiển thị tóm tắt context dự án
- 🔍 Chỉ ra các thay đổi gần đây
- 🎯 Liệt kê focus areas hiện tại
- 🧠 Kiểm tra trạng thái memory system

## 📋 BƯỚC 2: ĐỌC CÁC FILE CONTEXT CHÍNH

### Theo thứ tự ưu tiên:

1. **`.claudecontext`** - Quick project overview
```bash
# Đọc file này NGAY để hiểu tổng quan
cat .claudecontext
```

2. **`CLAUDE.md`** - Detailed AI instructions  
```bash
# Hướng dẫn chi tiết cho Claude Code
cat CLAUDE.md
```

3. **`COMPLETE_PROJECT_INDEX.md`** - Full project structure
```bash
# Cấu trúc hoàn chỉnh của dự án
cat COMPLETE_PROJECT_INDEX.md
```

4. **`docs/CLAUDE_VALIDATION_CHECKLIST.md`** - Quality checklist
```bash
# Checklist để đảm bảo chất lượng documentation
cat docs/CLAUDE_VALIDATION_CHECKLIST.md
```

## 📋 BƯỚC 3: HIỂU CÁC QUY TẮC CƠ BẢN

### ✅ LUÔN LÀM (ALWAYS DO):
- Đọc file `.claudecontext` trước khi làm việc
- Follow templates trong `docs/templates/`
- Test tất cả code examples trước khi document
- Include metadata headers trong all docs
- Use commit format: `docs: [action] [scope] - [description]`
- Maintain existing documentation structure

### ❌ KHÔNG BAO GIỜ LÀM (NEVER DO):
- Delete documentation without explicit permission
- Include passwords, API keys, tokens
- Change core structure without approval  
- Mix languages inappropriately
- Create duplicate documentation
- Skip testing code examples

## 📋 BƯỚC 4: SỬ DỤNG MEMORY SYSTEM

### Memory Locations:
```bash
# Project long-term memory
ls coordination/memory_bank/

# Session-specific memory  
ls memory/sessions/

# Task memory
ls coordination/subtasks/
```

### Load Previous Context:
```bash
# Check for previous session data
cat memory/claude-session-loader.json
```

## 📋 BƯỚC 5: KIỂM TRA TRẠNG THÁI DỰ ÁN

```bash
# Kiểm tra git status
git status

# Xem commits gần đây
git log --oneline -10

# Kiểm tra package.json changes
git diff HEAD~1 package.json

# Check documentation changes
find docs/ -name "*.md" -newer .git/HEAD
```

## 🎯 WORKFLOW CHO TỪNG LOẠI TASK

### Khi Tạo Documentation Mới:

1. **Đọc context files** (bước 1-2 ở trên)
2. **Choose template** từ `docs/templates/`
3. **Check location** trong docs structure
4. **Use validation checklist** trước khi commit
5. **Test examples** và validate links

### Khi Update Documentation:

1. **Load current context** từ memory
2. **Read existing doc** hoàn toàn
3. **Identify changes needed** based on code changes
4. **Update with validation** using checklist
5. **Update cross-references** và indexes

### Khi Troubleshoot:

1. **Check .claudecontext** for quick overview
2. **Review CLAUDE.md** for specific guidelines
3. **Use emergency procedures** trong session-loader.json
4. **Escalate if needed** theo guidelines

## 🚀 AUTOMATION COMMANDS

### Validation Commands:
```bash
# Validate markdown
npm run docs:lint

# Check links
npm run docs:links  

# Spell check
npm run docs:spell

# Full validation
npm run docs:validate
```

### Build Commands:
```bash
# Build docs
npm run docs:build

# Deploy docs  
npm run docs:deploy

# Generate API docs
npm run docs:generate-api
```

## 📞 QUICK REFERENCE CHEAT SHEET

### File Locations:
| Type | Location | Purpose |
|------|----------|---------|
| Main guide | `/CLAUDE.md` | Detailed AI instructions |
| Quick context | `/.claudecontext` | Fast project overview |
| Validation | `/docs/CLAUDE_VALIDATION_CHECKLIST.md` | Quality checklist |
| Templates | `/docs/templates/` | Document templates |
| Memory | `/memory/claude-session-loader.json` | Session persistence |

### Documentation Rules:
| Rule | Value | Notes |
|------|-------|-------|
| Language | English (tech), EN/VN (user) | Never mix inappropriately |
| Format | Markdown + metadata | Always include headers |
| Naming | kebab-case.md | [category]-[topic]-[subtopic] |
| Location | /docs/01-10/ | Numbered categories |
| Templates | Mandatory | Choose appropriate template |

### Quality Standards:
| Metric | Target | Validation |
|--------|--------|------------|
| Completeness | 95%+ | All sections filled |
| Accuracy | 100% | All examples tested |
| Currency | <48h | Update after code changes |
| Security | 100% | No sensitive info |

## 🆘 EMERGENCY PROCEDURES

### If Context is Lost:
```bash
# Step 1: Run quick start
./claude-quick-start.sh

# Step 2: Load main context
cat .claudecontext

# Step 3: Read instructions
cat CLAUDE.md

# Step 4: Check memory
cat memory/claude-session-loader.json
```

### If Documentation Standards Unclear:
1. Check `CLAUDE.md` for specific rules
2. Use `docs/CLAUDE_VALIDATION_CHECKLIST.md`
3. Look at existing docs as examples
4. Ask for human clarification if needed

### If Code Examples Don't Work:
1. Test examples in development environment
2. Update examples to match current code
3. Document any breaking changes
4. Update troubleshooting sections

## ✅ SESSION READINESS CHECKLIST

Trước khi bắt đầu làm việc, đảm bảo:

- [ ] Đã chạy `./claude-quick-start.sh`
- [ ] Đã đọc `.claudecontext` file
- [ ] Hiểu project structure từ `COMPLETE_PROJECT_INDEX.md`
- [ ] Nắm rõ rules từ `CLAUDE.md`
- [ ] Load được memory từ previous sessions
- [ ] Kiểm tra recent changes trong git
- [ ] Hiểu current focus areas
- [ ] Sẵn sàng validation checklist

## 🎯 SUMMARY

**MỖI SESSION MỚI = CHẠY NGAY:**
1. `./claude-quick-start.sh` 
2. `cat .claudecontext`
3. `cat CLAUDE.md`
4. Ready to work with full context!

---

**Tạo bởi**: XP Development Team  
**Mục đích**: Đảm bảo Claude Code luôn có context đầy đủ  
**Cập nhật**: 2025-01-10