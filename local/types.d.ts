// Minimal types for the D1 / R2 shapes the shared app code references.
interface D1Database{prepare(sql:string):{bind(...a:unknown[]):{first<T=unknown>():Promise<T|null>;all<T=unknown>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>};first<T=unknown>():Promise<T|null>;all<T=unknown>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>};}
interface R2Bucket{put(key:string,value:Uint8Array,options?:unknown):Promise<unknown>;get(key:string):Promise<{body:ReadableStream}|null>;delete(key:string):Promise<void>;}
declare module 'cloudflare:workers'{export const env:Record<string,unknown>;}
