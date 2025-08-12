# 📝 Comment System Integration Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Frontend
npm install @tanstack/react-query lucide-react

# Backend dependencies already installed (pg)
```

### 2. Setup Database

Run the migration to create comments table:

```bash
psql -U postgres -d postgres -h 172.26.240.1 -f backend/src/migrations/20240115_create_comments_table.sql
```

### 3. Backend Setup

The backend is already configured with:
- REST API endpoints at `/api/comments/*`
- PostgreSQL integration using pg driver
- Transaction support with automatic rollback
- Soft delete functionality

### 4. Frontend Setup

#### Wrap your app with QueryProvider:

```tsx
import { QueryProvider } from './providers/QueryProvider';

function App() {
  return (
    <QueryProvider>
      {/* Your app content */}
    </QueryProvider>
  );
}
```

## 📊 Table View Integration

### Basic Usage

```tsx
import { TableViewWithComments } from './components/TableView/TableViewWithComments';

const MyTablePage = () => {
  const submissions = [...]; // Your submission data
  
  return (
    <TableViewWithComments
      submissions={submissions}
      currentUserId="user-123"
      currentUserName="John Doe"
      isAdmin={false}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        // ... more columns
      ]}
    />
  );
};
```

### Custom Integration

For custom table implementations, use the hooks directly:

```tsx
import { useCommentButton } from './hooks/useCommentButton';

const CustomTable = () => {
  const { CommentButton, CommentPanel } = useCommentButton({
    submissionId: 'sub-123',
    currentUserId: 'user-123',
    currentUserName: 'John Doe',
    isAdmin: false
  });
  
  return (
    <>
      <table>
        {/* Your table implementation */}
        <td>
          <CommentButton />
        </td>
      </table>
      
      <CommentPanel />
    </>
  );
};
```

## 🎣 React Query Hooks

### Available Hooks

```tsx
// Fetch comments
const { data, isLoading, error } = useComments(submissionId);

// Create comment
const createMutation = useCreateComment();
await createMutation.mutateAsync({ 
  submissionId, 
  data: { content, parent_id } 
});

// Update comment
const updateMutation = useUpdateComment();
await updateMutation.mutateAsync({ 
  commentId, 
  data: { content } 
});

// Delete comment
const deleteMutation = useDeleteComment();
await deleteMutation.mutateAsync({ commentId, submissionId });

// Get comment count
const { data: countData } = useCommentCount(submissionId);

// Get counts for multiple submissions
const { data: countsMap } = useCommentCounts(submissionIds);

// Get comment statistics
const { data: stats } = useCommentStats(submissionId);
```

## 🔧 API Endpoints

### REST API Reference

```
GET    /api/comments/submission/:submissionId     - Get comments for submission
POST   /api/comments/submission/:submissionId     - Create new comment
GET    /api/comments/:commentId                   - Get single comment
PUT    /api/comments/:commentId                   - Update comment
DELETE /api/comments/:commentId                   - Soft delete comment
POST   /api/comments/:commentId/restore           - Restore deleted comment
GET    /api/comments/submission/:submissionId/count - Get comment count
POST   /api/comments/counts                       - Get counts for multiple submissions
GET    /api/comments/submission/:submissionId/stats - Get comment statistics
GET    /api/comments/user/:userId                 - Get user's comments
```

## 🎨 Component Customization

### Custom Styling

All components accept className props:

```tsx
<CommentButton 
  className="custom-button-class"
  submissionId={id}
  commentCount={count}
  onClick={handleClick}
/>
```

### Theme Support

Components support both light and dark modes automatically using Tailwind CSS dark: variants.

### Custom Icons

Import from lucide-react to use different icons:

```tsx
import { MessageCircle, Chat, Comment } from 'lucide-react';
```

## 🔐 Authentication

### Setting Auth Token

The comment service automatically includes the auth token from localStorage:

```tsx
// Set token after login
localStorage.setItem('authToken', token);

// Remove token on logout
localStorage.removeItem('authToken');
```

### Permission Model

- **Own comments**: Users can edit/delete their own comments
- **Admin**: Can edit/delete any comment
- **Reply limit**: Maximum 3 levels of nesting

## 📋 Features

### Core Features
- ✅ Nested comments (3 levels max)
- ✅ Edit/Delete with permissions
- ✅ Soft delete with restore
- ✅ Real-time comment counts
- ✅ User avatars and names
- ✅ Relative timestamps
- ✅ Character limit (5000)
- ✅ Keyboard shortcuts
- ✅ Loading states
- ✅ Error handling
- ✅ Dark mode support

### Not Included (Per Requirements)
- ❌ Real-time updates (WebSocket)
- ❌ Live collaboration
- ❌ Typing indicators
- ❌ Online presence

## 🧪 Testing

### Backend Testing

```bash
# Test database connection
npm run db:test

# Test API endpoints
curl -X GET http://localhost:5000/api/comments/submission/sub-001
```

### Frontend Testing

Use React Query Devtools in development:

```tsx
// Automatically included in development mode
// Access via floating button in bottom-right corner
```

## 🚨 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check .env file has correct DB credentials
   - Verify PostgreSQL is running on 172.26.240.1:5432

2. **Comments not loading**
   - Check API is running on port 5000
   - Verify auth token is set in localStorage
   - Check browser console for CORS errors

3. **Cannot create/edit comments**
   - Verify user is authenticated
   - Check user_id matches current user
   - Ensure submission_id exists

4. **Performance issues**
   - Enable query caching in React Query
   - Use pagination for large comment threads
   - Consider implementing virtual scrolling

## 📚 Examples

### Complete Implementation

See `/frontend/src/pages/FormSubmissionsPage.tsx` for a complete working example.

### Integration with Existing Table

```tsx
// Add to your existing table component
import { useCommentCounts } from './hooks/useComments';
import { CommentButton } from './components/Comments';

// In your component
const { data: commentCounts } = useCommentCounts(rowIds);

// In your table row
<CommentButton
  submissionId={row.id}
  commentCount={commentCounts?.get(row.id) || 0}
  onClick={() => openCommentPanel(row.id)}
/>
```

## 🔄 Migration from Existing System

If migrating from an existing comment system:

1. Export existing comments to match the schema
2. Import using the migration script
3. Update user_id references
4. Test permission model
5. Verify nested comment structure

## 📈 Performance Optimization

- Use React Query's stale-while-revalidate strategy
- Implement pagination for large threads
- Cache comment counts aggressively
- Use optimistic updates for better UX
- Consider implementing infinite scroll

## 🛠️ Maintenance

- Regular cleanup of soft-deleted comments (30 days)
- Monitor comment_depth to prevent deep nesting
- Index optimization for large datasets
- Regular backup of comments table