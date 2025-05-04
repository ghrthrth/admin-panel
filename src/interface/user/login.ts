export interface LoginParams {
  login: string;  // изменили username на login
  password: string;
}

export interface UserInfo {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  login: string;
}

export interface LoginResult {
  token: string
  username: string
}

export interface LogoutParams {
  token: string
}
