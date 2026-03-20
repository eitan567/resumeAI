export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  phone?: string;
  linkedin?: string;
  portfolio?: string;
  plan: 'free' | 'pro';
  credits: number;
  createdAt: string;
  proExpiresAt?: string;
  reminderSent?: boolean;
  username?: string;
  photos?: string[];
}

export interface GeneratedDocument {
  id: string;
  userId: string;
  type: 'resume' | 'cover_letter';
  content: string;
  createdAt: string;
  template?: string;
  photoUrl?: string;
  slug?: string;
  isPublic?: boolean;
  isProfilePrimary?: boolean;
  includePersonalLink?: boolean;
  jobTitle?: string;
  userName?: string;
  userEmail?: string;
}
