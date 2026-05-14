import { apiClient } from "@/lib/api/apiClient";
import type { UserT,UserApiResponse } from '../types';



export const getAllUsers = async () => { 
   
    const response = await apiClient.get<UserApiResponse>('/users');
    
    
   return response.data.users || [];
}