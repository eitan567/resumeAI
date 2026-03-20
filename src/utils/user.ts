import { UserProfile } from '../types';

export const getUserDisplayName = (user: UserProfile | null | undefined): string => {
  if (!user) return '';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.name || '';
};
