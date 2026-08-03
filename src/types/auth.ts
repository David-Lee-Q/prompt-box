export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface AuthState {
  currentUser: Omit<User, 'passwordHash' | 'salt'> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  password: string;
  confirmPassword: string;
}
