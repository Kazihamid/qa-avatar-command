import {defineConfig} from 'vite';
import {resolve} from 'node:path';
// Bundles server/index.ts (+ the shared API routes) into dist/server/index.mjs.
export default defineConfig({
 resolve:{alias:{'@':resolve(__dirname),'cloudflare:workers':resolve(__dirname,'local/env.ts')}},
 ssr:{noExternal:true},
 build:{ssr:'server/index.ts',outDir:'dist/server',emptyOutDir:true,target:'node22',rollupOptions:{external:[/^node:/],output:{format:'es',entryFileNames:'index.mjs'}}},
});
