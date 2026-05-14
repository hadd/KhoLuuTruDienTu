// export type UserT = {
//   id: string
//   email: string
//   fullName: string
//   avatarUrl: string | null
//   dateOfBirth: string | null
//   gender: string | null
//   phone: string | null
//   address: string | null
//   lastLoginAt: string
//   createdAt: string
//   updatedAt: string
//   deletedAt: string | null
//   userRoles?: Array<UserRoleT>
//   userId?: string
// }

// export type UserRoleT = {
//   id: string
//   userId: string
//   roleId: string
//   isCurrent: boolean
//   createdAt: string
//   expiredAt: string | null
//   role: RoleT
// }
// export type RoleT = {
//   id: string
//   name: string
//   description: string | null
//   rules: string
//   isBaseRole: boolean
//   createdAt: string
//   updatedAt: string
//   deletedAt: string | null
// }


// Test 
export interface HairT {
  color: string
  type: string
}

export interface CoordinatesT {
  lat: number
  lng: number
}

export interface AddressT {
  address: string
  city: string
  state: string
  stateCode: string
  postalCode: string
  coordinates: CoordinatesT
  country: string
}

export interface UserT {
  id: number
  firstName: string
  lastName: string
  maidenName: string
  age: number
  gender: string
  email: string
  phone: string
  username: string
  password: string
  birthDate: string
  image: string
  bloodGroup: string
  height: number
  weight: number
  eyeColor: string
  hair: HairT
  ip: string
  address: AddressT
}
    
    

export interface UserApiResponse {
  users: Array<UserT>;
  total: number;
  skip: number;
  limit: number;
}