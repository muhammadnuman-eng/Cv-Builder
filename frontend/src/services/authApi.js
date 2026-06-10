import api from './api'

export const register = (name, email, password) =>
  api.post('/auth/register', { name, email, password })

export const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password })
  if (!res.data?.access_token) {
    throw new Error('Backend not reachable or invalid response')
  }
  localStorage.setItem('token', res.data.access_token)
  return res
}

export const logout = () => {
  localStorage.removeItem('token')
  window.location.href = '/auth/login'
}

export const getMe = () => api.get('/auth/me')

export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('token')
}
