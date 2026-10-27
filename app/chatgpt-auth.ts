// Local build: the app only listens on 127.0.0.1 for the person using this computer, so there is one fixed local user.
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{return {userId:'local-user',displayName:'Local user',email:'local@localhost',fullName:null};}
