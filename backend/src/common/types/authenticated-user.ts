export type AuthenticatedUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'DRIVER';
  status: 'ACTIVE' | 'SUSPENDED';
};
