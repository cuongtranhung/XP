import React, { useState, useMemo } from 'react';
import { useCommentCounts } from '../../hooks/useComments';
import { CommentButton } from '../comments/CommentButton';
import { CommentPanel } from '../comments/CommentPanel';

// Example submission data type
interface Submission {
  id: string;
  form_id: string;
  user_id: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface TableViewWithCommentsProps {
  submissions: Submission[];
  currentUserId: string;
  currentUserName?: string;
  isAdmin?: boolean;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, submission: Submission) => React.ReactNode;
  }>;
}

export const TableViewWithComments: React.FC<TableViewWithCommentsProps> = ({
  submissions,
  currentUserId,
  currentUserName,
  isAdmin = false,
  columns
}) => {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Get all submission IDs
  const submissionIds = useMemo(
    () => submissions.map(s => s.id),
    [submissions]
  );

  // Fetch comment counts for all submissions
  const { data: commentCounts } = useCommentCounts(submissionIds);

  const handleOpenComments = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    // Keep selectedSubmissionId for a moment to prevent flashing
    setTimeout(() => setSelectedSubmissionId(null), 300);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Comments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {submissions.map((submission) => {
              const commentCount = commentCounts?.get(submission.id) || 0;
              
              return (
                <tr
                  key={submission.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                    >
                      {column.render
                        ? column.render(submission.data[column.key], submission)
                        : submission.data[column.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CommentButton
                      submissionId={submission.id}
                      commentCount={commentCount}
                      onClick={() => handleOpenComments(submission.id)}
                      className="text-gray-600 dark:text-gray-400"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                        View
                      </button>
                      <button className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Comment Panel */}
      {selectedSubmissionId && (
        <CommentPanel
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          submissionId={selectedSubmissionId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
};