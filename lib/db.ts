import {env} from 'cloudflare:workers';
// The local build aliases this module to local/env.ts; Workers provides real bindings.
export function db(){return env.DB as unknown as D1Database;}
