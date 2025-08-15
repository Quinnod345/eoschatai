// Types for streams
export interface Stream {
  id: string;
  chatId: string;
  createdAt: Date;
}

// Types for suggestions
export interface Suggestion {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  text: string;
  createdAt: Date;
}
