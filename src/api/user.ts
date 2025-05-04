import { request } from './request'
import type { LogoutParams } from '../interface/user/login'
import axios from 'axios'


export interface LoginParams {
  login: string
  password: string
}

export interface UserInfo {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
  login: string
}

export const login = (data: LoginParams) => {
  return axios.post<{
    code: number
    result: UserInfo
    error?: string
  }>('http://localhost:8001/api/auth/login', data)
}

export const logout = (data: LogoutParams) => {
  return request({
    data,
    method: 'post',
    url: '/api/user/logout',
  })
}
