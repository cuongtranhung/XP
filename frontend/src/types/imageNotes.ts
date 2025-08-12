// Frontend types for Image Notes system

export interface ImageNote {
  id: string;
  attachment_id: string;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  
  // Populated user data
  user?: {
    id: number;
    full_name: string;
    email: string;
    avatar_url?: string;
    username?: string;
  };
}

export interface CreateImageNoteData {
  attachment_id: string;
  content: string;
}

export interface UpdateImageNoteData {
  content: string;
}

export interface ImageNotesListResponse {
  success: true;
  data: {
    notes: ImageNote[];
    total: number;
    attachment_id: string;
  };
}

export interface ImageNoteCreateResponse {
  success: true;
  data: {
    note: ImageNote;
  };
}

export interface ImageNotesApiError {
  success: false;
  error: string;
}