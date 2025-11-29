/**
 * Authentication Types
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface CognitoIdTokenPayload {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  'custom:role'?: string;
  'custom:firstName'?: string;
  'custom:lastName'?: string;
  'custom:email'?: string;
  iat: number;
  exp: number;
}
