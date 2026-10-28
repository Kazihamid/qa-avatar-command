export async function authorized(request:Request,password:string,username='qa-admin'):Promise<boolean> {
 const header=request.headers.get('authorization')||'';
 if(!password||!header.startsWith('Basic '))return false;
 let supplied:string;try{supplied=atob(header.slice(6));}catch{return false;}
 const encode=new TextEncoder();
 const [actual,expected]=await Promise.all([supplied,username+':'+password].map(value=>crypto.subtle.digest('SHA-256',encode.encode(value))));
 const a=new Uint8Array(actual),b=new Uint8Array(expected);let difference=0;
 for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
 return difference===0;
}
