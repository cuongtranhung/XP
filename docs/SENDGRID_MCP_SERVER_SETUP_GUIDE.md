# 📧 SENDGRID MCP SERVER - HƯỚNG DẪN CÀI ĐẶT & CẤU HÌNH

**Ngày cập nhật**: Tháng 1, 2025  
**Phiên bản**: MCP v1.0  
**Tương thích**: Claude Code, Cursor IDE

---

## 📋 TỔNG QUAN

### SendGrid MCP Server là gì?
SendGrid MCP (Model Context Protocol) server cung cấp khả năng tích hợp SendGrid API v3 vào Claude Code và các AI agents, cho phép:
- Quản lý danh sách liên hệ (contacts)
- Tạo và gửi email campaigns
- Quản lý email templates
- Theo dõi thống kê email
- Xác thực email addresses

### Yêu cầu hệ thống
- Node.js 16+ 
- SendGrid API Key (Free tier hoặc Paid)
- Claude Code hoặc Cursor IDE
- Git (để clone repository)

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT

### Bước 1: Lấy SendGrid API Key

1. **Đăng ký tài khoản SendGrid**
   - Truy cập: https://sendgrid.com/en-us/pricing
   - Chọn plan phù hợp (có Free tier 100 emails/ngày)

2. **Tạo API Key**
   ```
   Dashboard → Settings → API Keys → Create API Key
   - Name: "MCP Server Key"
   - API Key Permissions: Full Access (hoặc Restricted Access với các quyền cần thiết)
   - Copy và lưu API Key (chỉ hiển thị 1 lần)
   ```

### Bước 2: Clone SendGrid MCP Repository

```bash
# Clone official repository
git clone https://github.com/Garoth/sendgrid-mcp.git
cd sendgrid-mcp

# Hoặc sử dụng npm/npx
npm install -g @garoth/sendgrid-mcp

# Build project (nếu cần)
npm install
npm run build
```

### Bước 3: Cài đặt cho Claude Code

#### Phương pháp 1: Sử dụng Command Line
```bash
claude mcp add-json "sendgrid" '{
  "command": "node",
  "args": ["/path/to/sendgrid-mcp/build/index.js"],
  "env": {
    "SENDGRID_API_KEY": "SG.YOUR_API_KEY_HERE"
  },
  "disabled": false,
  "autoApprove": [
    "list_contacts",
    "list_contact_lists", 
    "list_templates",
    "list_single_sends",
    "get_single_send",
    "list_verified_senders",
    "list_suppression_groups",
    "get_stats",
    "validate_email"
  ]
}'
```

#### Phương pháp 2: Cấu hình thủ công
1. Mở file cấu hình Claude Code:
   - Windows: `%APPDATA%\claude\mcp.json`
   - macOS: `~/Library/Application Support/claude/mcp.json`
   - Linux: `~/.config/claude/mcp.json`

2. Thêm cấu hình SendGrid:
```json
{
  "mcpServers": {
    "sendgrid": {
      "command": "node",
      "args": ["C:/path/to/sendgrid-mcp/build/index.js"],
      "env": {
        "SENDGRID_API_KEY": "SG.YOUR_API_KEY_HERE"
      },
      "disabled": false,
      "autoApprove": [
        "list_contacts",
        "list_contact_lists",
        "list_templates",
        "list_single_sends",
        "get_single_send",
        "list_verified_senders",
        "list_suppression_groups",
        "get_stats",
        "validate_email"
      ]
    }
  }
}
```

### Bước 4: Cài đặt cho Cursor IDE

1. **Global Installation** (recommended):
   ```bash
   # Tạo/edit file cấu hình global
   ~/.cursor/mcp.json
   ```

2. **Project-specific Installation**:
   ```bash
   # Trong project directory
   .cursor/mcp.json
   ```

3. Thêm cấu hình tương tự như Claude Code vào file JSON

### Bước 5: Verify Installation

1. **Restart Claude Code/Cursor**
2. **Check MCP Status**:
   - Claude Code: Settings → MCP → Refresh
   - Cursor: Settings → Extensions → MCP → Refresh

3. **Test với command**:
   ```
   "List all SendGrid templates"
   "Show my SendGrid contacts"
   "Check SendGrid email stats"
   ```

---

## 🛠️ CẤU HÌNH NÂNG CAO

### Environment Variables
```bash
# .env file trong project
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Your Company Name
SENDGRID_REPLY_TO=support@yourdomain.com
```

### Custom Configuration
```json
{
  "mcpServers": {
    "sendgrid": {
      "command": "node",
      "args": ["./sendgrid-mcp/build/index.js"],
      "env": {
        "SENDGRID_API_KEY": "${SENDGRID_API_KEY}",
        "SENDGRID_REGION": "global",
        "SENDGRID_RETRY_LIMIT": "3",
        "SENDGRID_TIMEOUT": "10000"
      },
      "disabled": false,
      "autoApprove": [
        // Read-only operations (safe to auto-approve)
        "list_contacts",
        "list_contact_lists",
        "list_templates",
        "list_single_sends",
        "get_single_send",
        "list_verified_senders",
        "list_suppression_groups",
        "get_stats",
        "validate_email"
      ],
      "requireApproval": [
        // Write operations (require manual approval)
        "send_email",
        "create_contact",
        "update_contact",
        "delete_contact",
        "create_template",
        "update_template",
        "delete_template",
        "create_campaign",
        "schedule_campaign"
      ]
    }
  }
}
```

---

## 📚 SỬ DỤNG SENDGRID MCP SERVER

### Available Tools/Functions

#### 1. Contact Management
```typescript
// List all contacts
list_contacts({
  page_size?: number,
  page?: number,
  search?: string
})

// Create new contact
create_contact({
  email: string,
  first_name?: string,
  last_name?: string,
  custom_fields?: object
})

// Update contact
update_contact({
  contact_id: string,
  data: ContactData
})
```

#### 2. Email Templates
```typescript
// List templates
list_templates({
  page_size?: number,
  page?: number,
  generation?: 'dynamic' | 'legacy'
})

// Get template
get_template({
  template_id: string
})

// Create template
create_template({
  name: string,
  subject: string,
  html_content: string,
  plain_content?: string
})
```

#### 3. Send Emails
```typescript
// Send single email
send_email({
  to: string | string[],
  from: {
    email: string,
    name?: string
  },
  subject: string,
  html?: string,
  text?: string,
  template_id?: string,
  dynamic_template_data?: object
})

// Send to list
send_to_list({
  list_ids: string[],
  sender_id: string,
  subject: string,
  html_content: string,
  suppression_group_id?: number,
  custom_unsubscribe_url?: string
})
```

#### 4. Statistics & Analytics
```typescript
// Get email statistics
get_stats({
  start_date: string, // YYYY-MM-DD
  end_date?: string,
  aggregated_by?: 'day' | 'week' | 'month'
})

// Get bounce statistics
get_bounces({
  start_date: string,
  end_date?: string
})
```

---

## 🔧 INTEGRATION VỚI PROJECT XP

### Tích hợp vào Backend

1. **Create Email Service Integration**:
```typescript
// backend/src/services/sendgridMCPService.ts
export class SendGridMCPService {
  async sendWelcomeEmail(user: User) {
    // Use MCP to send email via Claude Code
    const command = `
      Send welcome email using SendGrid:
      - To: ${user.email}
      - Template: welcome-email-template
      - Dynamic data: {
        name: "${user.full_name}",
        activation_link: "${this.generateActivationLink(user.id)}"
      }
    `;
    
    // Claude Code will handle via MCP
    return await this.executeMCPCommand(command);
  }
  
  async sendPasswordReset(email: string, token: string) {
    const command = `
      Send password reset email using SendGrid:
      - To: ${email}
      - Template: password-reset-template
      - Dynamic data: {
        reset_link: "${process.env.FRONTEND_URL}/reset-password?token=${token}"
      }
    `;
    
    return await this.executeMCPCommand(command);
  }
}
```

2. **Update Email Service**:
```typescript
// backend/src/services/emailService.ts
import { SendGridMCPService } from './sendgridMCPService';

export class EmailService {
  private sendgridMCP: SendGridMCPService;
  
  constructor() {
    this.sendgridMCP = new SendGridMCPService();
  }
  
  async sendEmail(options: EmailOptions) {
    // Use MCP for production
    if (process.env.USE_SENDGRID_MCP === 'true') {
      return this.sendgridMCP.send(options);
    }
    
    // Fallback to existing email service
    return this.sendViaSMTP(options);
  }
}
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. Security Best Practices
- **NEVER** commit API keys to git
- Use environment variables cho production
- Rotate API keys định kỳ
- Set restricted permissions cho API keys

### 2. Rate Limits
- Free tier: 100 emails/day
- Essentials: 40,000 emails/month
- Pro: 100,000+ emails/month
- API rate limit: 600 requests/second

### 3. Compliance Requirements
- **CAN-SPAM Act**: Phải có unsubscribe link
- **GDPR**: Cần consent cho EU users
- **Sender Verification**: Email gửi phải được verify

### 4. Eventually Consistent API
```javascript
// Data changes có thể không hiển thị ngay
// Implement retry logic
async function waitForContact(email, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const contact = await getContact(email);
    if (contact) return contact;
    await sleep(2000); // Wait 2 seconds
  }
  throw new Error('Contact not found after creation');
}
```

---

## 🐛 TROUBLESHOOTING

### Common Issues & Solutions

#### 1. "API Key Invalid"
```bash
# Verify API key format
echo $SENDGRID_API_KEY
# Should start with "SG."

# Test API key
curl -X GET "https://api.sendgrid.com/v3/templates" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

#### 2. "Sender not verified"
```
Solution:
1. Go to SendGrid Dashboard
2. Settings → Sender Authentication
3. Verify domain or single sender
4. Wait for DNS propagation (up to 48h)
```

#### 3. "MCP Server not found"
```bash
# Check installation path
ls -la /path/to/sendgrid-mcp/build/index.js

# Verify Node.js
node --version # Should be 16+

# Rebuild if needed
cd sendgrid-mcp
npm install
npm run build
```

#### 4. "Rate limit exceeded"
```javascript
// Implement exponential backoff
async function sendWithRetry(data, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await sendEmail(data);
    } catch (error) {
      if (error.code === 429) { // Rate limited
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}
```

---

## 📊 MONITORING & LOGGING

### Enable Debug Logging
```json
{
  "mcpServers": {
    "sendgrid": {
      "env": {
        "SENDGRID_API_KEY": "...",
        "DEBUG": "sendgrid-mcp:*",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### View Logs
```bash
# Claude Code logs
tail -f ~/.claude/logs/mcp-sendgrid.log

# Cursor logs
tail -f ~/.cursor/logs/mcp-sendgrid.log
```

---

## 🔗 RESOURCES

### Official Documentation
- [SendGrid API v3 Docs](https://docs.sendgrid.com/api-reference/how-to-use-the-sendgrid-v3-api)
- [SendGrid MCP GitHub](https://github.com/Garoth/sendgrid-mcp)
- [MCP Protocol Spec](https://modelcontextprotocol.io)

### Alternative MCP Servers
- **CData SendGrid MCP**: Enterprise-grade với JDBC driver support
- **Custom MCP Server**: Build your own với MCP SDK

### Support
- SendGrid Support: https://support.sendgrid.com
- MCP Community: https://github.com/modelcontextprotocol/community
- Claude Code Forums: https://community.anthropic.com

---

## ✅ CHECKLIST SAU CÀI ĐẶT

- [ ] SendGrid account created
- [ ] API Key generated và saved
- [ ] MCP server installed
- [ ] Configuration added to Claude Code/Cursor
- [ ] Server restarted
- [ ] Test command executed successfully
- [ ] Sender email verified
- [ ] Unsubscribe group created (for compliance)
- [ ] Templates created (optional)
- [ ] Monitoring setup (optional)

---

**Prepared by**: DevOps Team  
**Last Updated**: January 2025  
**Next Review**: When SendGrid API v4 releases