import React from 'react';
import { FileText, Image } from 'lucide-react';

interface FileAttachment {
  id: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_key: string;
  url?: string;
}

// Mock data for demonstration
const mockAttachments: FileAttachment[] = [
  {
    id: '1',
    original_name: 'profile-image.jpg',
    mime_type: 'image/jpeg',
    file_size: 245760,
    file_key: 'images/profile.jpg',
    url: 'https://picsum.photos/200/200?random=1'
  },
  {
    id: '2',
    original_name: 'document.pdf',
    mime_type: 'application/pdf',
    file_size: 512000,
    file_key: 'docs/document.pdf'
  },
  {
    id: '3',
    original_name: 'screenshot.png',
    mime_type: 'image/png',
    file_size: 189440,
    file_key: 'images/screenshot.png',
    url: 'https://picsum.photos/200/200?random=2'
  },
  {
    id: '4',
    original_name: 'report.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_size: 87040,
    file_key: 'reports/report.xlsx'
  },
  {
    id: '5',
    original_name: 'presentation.pptx',
    mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    file_size: 1024000,
    file_key: 'slides/presentation.pptx'
  }
];

export const AttachmentGalleryDemo: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <h1 className="text-2xl font-bold mb-6">🖼️ Attachment Gallery Demo</h1>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Comment with Attachments</h3>
        <p className="text-gray-700 mb-3">Đây là một comment có kèm theo các file đính kèm. Bạn có thể xem thumbnail và tải file về.</p>
        
        {/* Attachment Gallery */}
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-2 font-medium">
            📎 {mockAttachments.length} tệp đính kèm
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#CBD5E0 #F7FAFC'
          }}>
            {mockAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex-shrink-0 group cursor-pointer"
                onClick={() => window.open(attachment.url || '#', '_blank')}
              >
                <div className="w-20 h-20 bg-gray-50 border border-gray-200 rounded-lg p-1 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center relative group-hover:scale-105">
                  {attachment.mime_type.startsWith('image/') ? (
                    <div className="w-full h-full relative overflow-hidden rounded">
                      <img 
                        src={attachment.url || `/api/comment-attachments/${attachment.id}/download`}
                        alt={attachment.original_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `
                            <div class="w-full h-full flex flex-col items-center justify-center">
                              <svg class="w-6 h-6 text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div class="text-[10px] text-center text-gray-600 leading-tight">IMG</div>
                            </div>
                          `;
                        }}
                      />
                    </div>
                  ) : attachment.mime_type === 'application/pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <FileText className="w-6 h-6 text-red-500 mb-1" />
                      <div className="text-[10px] text-center text-gray-600 leading-tight">
                        PDF
                      </div>
                    </div>
                  ) : attachment.mime_type.includes('word') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600 mb-1" />
                      <div className="text-[10px] text-center text-gray-600 leading-tight">
                        DOC
                      </div>
                    </div>
                  ) : attachment.mime_type.includes('excel') || attachment.mime_type.includes('sheet') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <FileText className="w-6 h-6 text-green-600 mb-1" />
                      <div className="text-[10px] text-center text-gray-600 leading-tight">
                        XLS
                      </div>
                    </div>
                  ) : attachment.mime_type.includes('presentation') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <FileText className="w-6 h-6 text-orange-600 mb-1" />
                      <div className="text-[10px] text-center text-gray-600 leading-tight">
                        PPT
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-500 mb-1" />
                      <div className="text-[10px] text-center text-gray-600 leading-tight">
                        FILE
                      </div>
                    </div>
                  )}
                </div>
                {/* File info tooltip on hover */}
                <div className="mt-1 w-20">
                  <div className="text-[10px] text-gray-700 truncate text-center" title={attachment.original_name}>
                    {attachment.original_name.length > 12 
                      ? attachment.original_name.substring(0, 12) + '...' 
                      : attachment.original_name}
                  </div>
                  <div className="text-[9px] text-gray-500 text-center">
                    {Math.round(attachment.file_size / 1024)}KB
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">💡 Các tính năng</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✅ Hiển thị thumbnail thật cho hình ảnh</li>
          <li>✅ Icons phân loại theo loại file (PDF, DOC, XLS, PPT)</li>
          <li>✅ Trượt ngang khi có nhiều file</li>
          <li>✅ Hiệu ứng hover và scale</li>
          <li>✅ Hiển thị tên file và kích thước</li>
          <li>✅ Click để tải/xem file</li>
          <li>✅ Responsive trên mobile</li>
        </ul>
      </div>
    </div>
  );
};

export default AttachmentGalleryDemo;