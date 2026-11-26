import axios,{type AxiosRequestConfig} from 'axios'
import type {Envelope} from '../../shared/contracts'
export class ApiError extends Error{constructor(message:string,public code?:number,public requestId?:string){super(message)}}
export const http=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'/api',timeout:12000,headers:{Accept:'application/json'}})
http.interceptors.response.use(r=>r,e=>Promise.reject(new ApiError(e.response?.data?.message||(e.code==='ECONNABORTED'?'请求超时，请重试':'无法连接服务，请检查网络与API服务'),e.response?.status,e.response?.data?.requestId)))
export async function request<T>(config:AxiosRequestConfig):Promise<T>{const {data}=await http.request<Envelope<T>>(config);if(data.code!==0)throw new ApiError(data.message||'接口请求失败',data.code,data.requestId);return data.data}