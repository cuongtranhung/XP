# PROJECT INFORMATION - XP Form Builder

## 🚀 Quick Start Commands

### Start Everything
```bash
# Frontend (Port 3000)
cd /mnt/c/Users/Admin/source/repos/XP/frontend && PORT=3000 npm run dev

# Backend (Port 5000)
cd /mnt/c/Users/Admin/source/repos/XP/backend && npm run dev
```

## 📁 Project Structure
```
/mnt/c/Users/Admin/source/repos/XP/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   └── locales/       # i18n translations (en, vi)
│   └── package.json
│
├── backend/               # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── modules/       # Feature modules
│   │   ├── middleware/    # Express middleware
│   │   ├── database/      # Database config
│   │   └── server.ts      # Main server file
│   └── package.json
│
└── database/
    └── postgres           # PostgreSQL on 192.168.5.3:5432

```

## 🔑 Authentication
- **Email**: cuongtranhung@gmail.com
- **Password**: @Abcd6789

## 🌐 URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Database**: postgresql://postgres:@abcd1234@192.168.5.3:5432/postgres

## 🎯 Key Features
1. **Dynamic Form Builder** - Create and manage forms
2. **Form Submissions** - Handle form data
3. **Table View** - View submissions in table format
4. **Add Row** - Quick data entry in table view
5. **Multi-language** - Support English and Vietnamese

## 📝 Recent Changes
- ✅ Fixed archived forms display when status = 'Archived'
- ✅ Changed menu "Edit" to "Design" (Thiết kế)
- ✅ Fixed back button navigation in Table View
- ✅ Added "Add Row" feature to Table View for quick data entry
- ✅ Implemented code improvements (removed debug logs, fixed TypeScript types)

## 🛠️ Common Tasks

### Check System Status
```bash
# Check frontend
curl -s http://localhost:3000 | head -n 5

# Check backend
curl -s http://localhost:5000/api/health

# Check processes
ps aux | grep -E "node|vite" | grep -v grep
```

### Restart Services
```bash
# Kill all services
pkill -f vite
pkill -f tsx

# Start frontend
cd frontend && PORT=3000 npm run dev

# Start backend
cd backend && npm run dev
```

### Run Tests
```bash
# Test login
node test-login.js

# Test add row feature
node test-add-row-feature.js

# Test navigation
node test-table-view-navigation.js
```

## 🐛 Troubleshooting

### Frontend không vào được
```bash
# Restart với host binding
cd frontend && npx vite --host 0.0.0.0 --port 3000

# Check WSL IP
ip addr show | grep -E "inet.*eth0"

# Use IP address: http://172.26.249.148:3000
```

### Backend không chạy
```bash
cd backend && npm run dev
# Check logs nếu có lỗi
```

### Database connection issues
- Check VPN/network to 192.168.5.3
- Verify PostgreSQL is running on remote server

## 📦 Dependencies
- Node.js v20.19.4
- PostgreSQL
- React 18
- Vite
- TypeScript
- Express
- Playwright (for testing)

## 🔧 Environment Variables
Frontend uses Vite with proxy config to backend at port 5000
Backend connects to PostgreSQL at 192.168.5.3:5432

## 📌 Important Files
- `/frontend/src/pages/DataTableView.tsx` - Table view with Add Row feature
- `/frontend/src/pages/FormsList.tsx` - Forms list page
- `/backend/src/modules/dynamicFormBuilder/services/FormService.ts` - Form backend service
- `/frontend/src/hooks/useFormBuilder.ts` - Form builder hook
- `/frontend/src/components/EditableCell.tsx` - Inline editing component

## 💡 Tips for Claude Code
1. Always check if services are running before testing
2. Use `http://localhost:3000` for frontend
3. Backend API is at `http://localhost:5000/api`
4. Database is remote at 192.168.5.3
5. Use provided credentials for testing