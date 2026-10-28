import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'@/lib/seed':resolve(__dirname,'cloudflare/seed.ts'),'@':resolve(__dirname)}},ssr:{noExternal:true,external:['cloudflare:workers']},build:{ssr:'cloudflare/worker.ts',outDir:'dist/cloudflare',emptyOutDir:true,target:'es2022',rollupOptions:{external:['cloudflare:workers'],output:{format:'es',entryFileNames:'worker.mjs'}}}});
