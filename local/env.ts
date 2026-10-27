// Replaces the 'cloudflare:workers' module. Same shape the app code expects: env.DB, env.BUCKET, env secrets.
import {d1} from './sqlite';
import {fileBucket} from './storage';
export const env={
 get DB(){return d1;},
 get BUCKET(){return fileBucket;},
 get OPENAI_API_KEY(){return process.env.OPENAI_API_KEY||undefined;},
 get OPENAI_MODEL(){return process.env.OPENAI_MODEL||undefined;},
};
