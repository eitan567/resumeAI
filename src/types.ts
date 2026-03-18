export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  plan: 'free' | 'pro';
  credits: number;
  createdAt: string;
  proExpiresAt?: string;
  reminderSent?: boolean;
}

export interface GeneratedDocument {
  id: string;
  userId: string;
  type: 'resume' | 'cover_letter';
  content: string;
  createdAt: string;
  template?: string;
}
