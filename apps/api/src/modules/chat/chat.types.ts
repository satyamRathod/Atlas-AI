export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  id: string;
  reply: string;
  createdAt: string;
}
