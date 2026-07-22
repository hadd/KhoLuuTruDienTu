// User entity types (shared across features)
export interface UserT {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  dateOfBirth: string | null
  gender: string | null
  phone: string | null
  address: string | null
  lastLoginAt: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  hasDownloadPassword?: boolean
  downloadPasswordEnabled?: boolean
}
