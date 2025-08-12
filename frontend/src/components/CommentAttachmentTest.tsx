import React, { useState } from 'react';
import axios from 'axios';

interface AttachmentUploadResult {
  success: boolean;
  attachment?: {
    id: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    fileCategory: string;
    validationStatus: string;
    virusScanStatus: string;
  };
  error?: string;
}

export const CommentAttachmentTest: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [commentId, setCommentId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AttachmentUploadResult | null>(null);
  const [token, setToken] = useState<string>('');
  const [commentCreated, setCommentCreated] = useState(false);
  const [submissionId] = useState('123866b4-0c6d-448e-b4cb-bb78818de408'); // Existing submission ID that has comments
  const [useExistingComment, setUseExistingComment] = useState(false);

  // Get authentication token
  const getAuthToken = async () => {
    try {
      const response = await axios.post('/api/auth/login', {
        email: 'cuongtranhung@gmail.com',
        password: '@Abcd6789'
      });
      
      if (response.data.success && response.data.data?.token) {
        setToken(response.data.data.token);
        return response.data.data.token;
      }
    } catch (error) {
      console.error('Auth failed:', error);
      return null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      // Get token if not have
      let authToken = token;
      if (!authToken) {
        authToken = await getAuthToken();
        if (!authToken) {
          setResult({
            success: false,
            error: 'Authentication failed'
          });
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `/api/comment-attachments/comment/${commentId}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            // Don't set Content-Type for FormData - let axios handle it
          },
          timeout: 30000,
        }
      );

      setResult({
        success: true,
        attachment: response.data.attachment
      });

    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data?.error || error.message
      });
    } finally {
      setUploading(false);
    }
  };

  // Create a test comment first
  const createTestComment = async () => {
    try {
      // Get token if not have
      let authToken = token;
      if (!authToken) {
        authToken = await getAuthToken();
        if (!authToken) {
          setResult({
            success: false,
            error: 'Authentication failed'
          });
          return;
        }
      }

      const response = await axios.post(
        `/api/comments/submission/${submissionId}`,
        {
          content: 'Test comment for attachment upload testing - ' + new Date().toISOString(),
          isAnonymous: false
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success && response.data.data?.id) {
        setCommentId(response.data.data.id);
        setCommentCreated(true);
        setResult({
          success: true,
          error: `Comment created with ID: ${response.data.data.id}`
        });
        return response.data.data.id;
      }
    } catch (error: any) {
      console.error('Comment creation failed:', error);
      setResult({
        success: false,
        error: error.response?.data?.error || 'Failed to create test comment'
      });
      return null;
    }
  };

  // Use an existing comment for testing
  const useExistingCommentId = () => {
    // Use one of the existing comment IDs from submission_comments table
    const existingCommentIds = [
      '0488c09c-df7e-4dd0-abc1-72bad0cc9dd2',
      '171ae94d-afd7-4f16-b6cb-0e4d61e8828e',
      'a5abb440-61b3-4093-b5db-71ce310a69d8',
      '4a32ca6f-f649-413a-8a2b-792e04148283',
      '4fbe8e54-6577-46ff-b17c-727a50ff14b0'
    ];
    const randomId = existingCommentIds[Math.floor(Math.random() * existingCommentIds.length)];
    setCommentId(randomId);
    setUseExistingComment(true);
    setCommentCreated(true);
    setResult({
      success: true,
      error: `Using existing submission_comment ID: ${randomId}`
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🧪 Comment Attachment Test</h1>
      
      {/* Authentication Status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-100">
        <p className="text-sm">
          <strong>Auth Status:</strong> {token ? '✅ Authenticated' : '❌ Not authenticated'}
        </p>
        {!token && (
          <button
            onClick={getAuthToken}
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Get Auth Token
          </button>
        )}
      </div>

      {/* Comment Creation */}
      <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
        <p className="text-sm font-medium mb-2">
          <strong>Step 1:</strong> Select or create a comment
        </p>
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={commentId}
              onChange={(e) => setCommentId(e.target.value)}
              placeholder="Comment ID will appear here"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={useExistingCommentId}
              className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              📋 Use Existing Comment
            </button>
            <button
              onClick={createTestComment}
              className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              🆕 Create New Comment
            </button>
          </div>
        </div>
        {commentId && (
          <p className="text-xs text-green-600 mt-2">
            ✅ Comment ready for attachments (ID: {commentId})
            {useExistingComment && ' (Existing comment)'}
          </p>
        )}
      </div>

      {/* File Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Select file to upload:
        </label>
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <div className="mt-2 text-sm text-gray-600">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB, {file.type})
          </div>
        )}
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading || !commentId}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300 hover:bg-blue-600"
      >
        {!commentId ? '⚠️ Create Comment First' : uploading ? '⏳ Uploading...' : '📎 Upload Attachment'}
      </button>

      {/* Result Display */}
      {result && (
        <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h3 className="font-semibold mb-2">
            {result.success ? '✅ Upload Successful' : '❌ Upload Failed'}
          </h3>
          
          {result.success && result.attachment ? (
            <div className="space-y-2 text-sm">
              <p><strong>ID:</strong> {result.attachment.id}</p>
              <p><strong>Original Name:</strong> {result.attachment.originalName}</p>
              <p><strong>MIME Type:</strong> {result.attachment.mimeType}</p>
              <p><strong>File Size:</strong> {(result.attachment.fileSize / 1024).toFixed(2)} KB</p>
              <p><strong>Category:</strong> {result.attachment.fileCategory}</p>
              <p><strong>Validation:</strong> 
                <span className={`ml-1 px-2 py-1 rounded text-xs ${
                  result.attachment.validationStatus === 'validated' ? 'bg-green-100 text-green-800' : 
                  result.attachment.validationStatus === 'rejected' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {result.attachment.validationStatus}
                </span>
              </p>
              <p><strong>Virus Scan:</strong> 
                <span className={`ml-1 px-2 py-1 rounded text-xs ${
                  result.attachment.virusScanStatus === 'clean' ? 'bg-green-100 text-green-800' : 
                  result.attachment.virusScanStatus === 'infected' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {result.attachment.virusScanStatus}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-red-600 text-sm">{result.error}</p>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">📋 How to Test Upload</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Click "Create Comment" to create a test comment</li>
          <li>Select a file to upload (max 100MB)</li>
          <li>Click "Upload Attachment" to attach the file to the comment</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-sm font-medium mb-1">Supported File Types:</p>
          <p className="text-xs"><strong>Images:</strong> JPEG, PNG, GIF, WebP</p>
          <p className="text-xs"><strong>Documents:</strong> PDF, Word, Excel</p>
          <p className="text-xs"><strong>Videos:</strong> MP4, QuickTime</p>
        </div>
      </div>
    </div>
  );
};

export default CommentAttachmentTest;