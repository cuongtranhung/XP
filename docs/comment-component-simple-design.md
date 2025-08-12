# 📝 Comment Component Design (Simple Version)
## Thiết kế Hệ thống Comment cho Table View - Phiên bản đơn giản

---

## 📋 Tổng quan

### Mục tiêu
- Cho phép người dùng comment trên mỗi row trong Table View
- Hỗ trợ reply (trả lời) comment 
- Không cần real-time, chỉ cần refresh để xem comment mới
- Đơn giản, dễ sử dụng, hiệu năng tốt

### Tính năng chính
✅ **Core Features**
- Thêm comment cho mỗi data row
- Reply comment (nested comments)
- Edit/Delete comment của mình
- Hiển thị thời gian và người comment
- Phân trang cho comment nhiều

❌ **Không bao gồm** (để đơn giản)
- Real-time updates
- Typing indicators  
- User presence
- Reactions/Emoji
- File attachments
- Rich text editor (chỉ plain text)

---

## 🗄️ Database Schema

### 1. Bảng `comments`
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,  -- Link tới form submission (row)
    parent_id UUID,               -- NULL = root comment, có giá trị = reply
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,         -- Soft delete
    
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_comments_submission ON comments(submission_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);
```

### 2. Database Model
```typescript
interface Comment {
  id: string;
  submissionId: string;
  parentId?: string | null;
  userId: string;
  userName?: string;      // JOIN từ users table
  userAvatar?: string;    // JOIN từ users table
  content: string;
  isEdited: boolean;
  replies?: Comment[];    // Nested replies
  replyCount?: number;    // Số lượng replies
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
```

---

## 🎨 UI/UX Design

### 1. Comment Indicator trên Table Row
```
┌─────────────────────────────────────────────┐
│ Row Data | Col 1 | Col 2 | ... | 💬 3       │
└─────────────────────────────────────────────┘
```
- Icon 💬 với số lượng comment
- Click để mở Comment Panel

### 2. Comment Panel Layout
```
┌──────────────────────────────────────┐
│  💬 Comments (3)              [X]    │
├──────────────────────────────────────┤
│                                      │
│  [User Avatar] John Doe              │
│  This is a comment text...           │
│  2 hours ago | Reply | Edit | Delete │
│                                      │
│  └─ [Avatar] Jane Smith             │
│     Reply comment text...           │
│     1 hour ago | Reply | Delete     │
│                                      │
├──────────────────────────────────────┤
│  [Text Input Area]                   │
│                    [Cancel] [Submit] │
└──────────────────────────────────────┘
```

### 3. Component Structure
```
CommentSystem/
├── CommentButton.tsx      // Nút hiển thị số comment
├── CommentPanel.tsx       // Panel chứa comments
├── CommentList.tsx        // Danh sách comments
├── CommentItem.tsx        // Single comment
├── CommentForm.tsx        // Form thêm/edit comment
└── CommentAPI.ts          // API calls
```

---

## 🔌 Backend API

### Endpoints
```typescript
// 1. Get comments cho một submission
GET /api/submissions/:submissionId/comments
Response: {
  comments: Comment[],
  total: number,
  page: number,
  pageSize: number
}

// 2. Create comment
POST /api/submissions/:submissionId/comments
Body: {
  content: string,
  parentId?: string  // for replies
}

// 3. Update comment
PUT /api/comments/:commentId
Body: {
  content: string
}

// 4. Delete comment (soft delete)
DELETE /api/comments/:commentId

// 5. Get comment count
GET /api/submissions/:submissionId/comments/count
Response: {
  count: number
}
```

### API Service (Backend)
```typescript
class CommentService {
  // Lấy comments với nested structure
  async getComments(submissionId: string, page = 1, limit = 20) {
    // Get root comments
    const rootComments = await db.query(`
      SELECT c.*, u.name as user_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.submission_id = ? 
        AND c.parent_id IS NULL
        AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [submissionId, limit, (page - 1) * limit]);

    // Get replies for each root comment
    for (const comment of rootComments) {
      comment.replies = await this.getReplies(comment.id);
    }

    return rootComments;
  }

  // Recursive function to get nested replies
  async getReplies(parentId: string): Promise<Comment[]> {
    const replies = await db.query(`
      SELECT c.*, u.name as user_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ?
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `, [parentId]);

    // Get nested replies (limit depth to 3 levels)
    for (const reply of replies) {
      if (reply.depth < 3) {
        reply.replies = await this.getReplies(reply.id);
      }
    }

    return replies;
  }
}
```

---

## 🎯 Frontend Implementation

### 1. Comment Button Component
```tsx
const CommentButton: React.FC<{submissionId: string}> = ({submissionId}) => {
  const [count, setCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    // Fetch comment count
    fetchCommentCount(submissionId).then(setCount);
  }, [submissionId]);

  return (
    <>
      <button onClick={() => setShowPanel(true)}>
        💬 {count > 0 && count}
      </button>
      
      {showPanel && (
        <CommentPanel
          submissionId={submissionId}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
};
```

### 2. Comment Panel Component
```tsx
const CommentPanel: React.FC<Props> = ({submissionId, onClose}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadComments = async () => {
    setLoading(true);
    const data = await fetchComments(submissionId);
    setComments(data);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, [submissionId]);

  return (
    <div className="comment-panel">
      <div className="panel-header">
        <h3>💬 Comments ({comments.length})</h3>
        <button onClick={onClose}>✕</button>
      </div>
      
      <div className="panel-body">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <CommentList 
            comments={comments}
            onUpdate={loadComments}
          />
        )}
      </div>
      
      <div className="panel-footer">
        <CommentForm
          submissionId={submissionId}
          onSubmit={loadComments}
        />
      </div>
    </div>
  );
};
```

### 3. Comment Item Component
```tsx
const CommentItem: React.FC<Props> = ({comment, onUpdate}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const {user} = useAuth();

  const canEdit = user?.id === comment.userId;

  return (
    <div className="comment-item">
      <div className="comment-header">
        <img src={comment.userAvatar} alt="" />
        <span>{comment.userName}</span>
        <span>{formatTime(comment.createdAt)}</span>
      </div>
      
      <div className="comment-content">
        {isEditing ? (
          <CommentForm
            initialValue={comment.content}
            onSubmit={(content) => {
              updateComment(comment.id, content);
              setIsEditing(false);
              onUpdate();
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <p>{comment.content}</p>
        )}
      </div>
      
      <div className="comment-actions">
        <button onClick={() => setIsReplying(!isReplying)}>
          Reply
        </button>
        {canEdit && (
          <>
            <button onClick={() => setIsEditing(true)}>Edit</button>
            <button onClick={() => deleteComment(comment.id)}>Delete</button>
          </>
        )}
      </div>
      
      {isReplying && (
        <CommentForm
          parentId={comment.id}
          onSubmit={() => {
            setIsReplying(false);
            onUpdate();
          }}
          onCancel={() => setIsReplying(false)}
        />
      )}
      
      {comment.replies && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 🚀 Integration với Table View

### Cập nhật DataTableView.tsx
```tsx
// Thêm vào mỗi row
const renderRow = (submission: Submission) => {
  return (
    <tr>
      {/* ... other columns ... */}
      <td>
        <CommentButton submissionId={submission.id} />
      </td>
    </tr>
  );
};
```

---

## ⚡ Performance Optimizations

1. **Lazy Loading**: Chỉ load comments khi user click vào
2. **Pagination**: Load 20 comments đầu tiên, load more khi scroll
3. **Caching**: Cache comment count trong 5 phút
4. **Debounce**: Debounce khi gõ comment (draft auto-save)
5. **Virtual Scrolling**: Nếu comments > 100

---

## 🎨 Styling (CSS)

```css
.comment-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 400px;
  background: white;
  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.comment-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.comment-replies {
  margin-left: 40px;
  border-left: 2px solid #eee;
}

.comment-form {
  padding: 12px;
  border-top: 1px solid #eee;
}

.comment-form textarea {
  width: 100%;
  min-height: 60px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
```

---

## 📊 Ước tính thời gian phát triển

| Task | Thời gian | Priority |
|------|-----------|----------|
| Database schema & migration | 2 giờ | High |
| Backend API (5 endpoints) | 4 giờ | High |
| Frontend Components | 6 giờ | High |
| Integration với Table View | 2 giờ | High |
| Testing | 3 giờ | Medium |
| Styling & Polish | 2 giờ | Low |
| **Tổng cộng** | **19 giờ** | |

---

## ✅ Checklist Implementation

- [ ] Create database migration
- [ ] Implement Comment model
- [ ] Create API endpoints
- [ ] Build CommentButton component
- [ ] Build CommentPanel component
- [ ] Build CommentList component
- [ ] Build CommentItem component
- [ ] Build CommentForm component
- [ ] Integrate with DataTableView
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test CRUD operations
- [ ] Test nested replies
- [ ] Optimize performance
- [ ] Polish UI/UX

---

## 🎯 Kết luận

Thiết kế này tập trung vào:
- **Đơn giản**: Không có real-time, WebSocket phức tạp
- **Hiệu quả**: Load on-demand, pagination
- **Dễ maintain**: Code structure rõ ràng
- **User-friendly**: UI/UX trực quan

Bạn có muốn điều chỉnh gì trong thiết kế này không?