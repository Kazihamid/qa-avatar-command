import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
 build:{ssr:true,target:'node22',outDir:'dist/codex',emptyOutDir:true,rollupOptions:{
  input:{login:resolve(__dirname,'server/codex-login.ts'),worker:resolve(__dirname,'server/codex-worker.ts'),browser:resolve(__dirname,'server/codex-browser.ts'),runner:resolve(__dirname,'server/codex-runner.ts'),model:resolve(__dirname,'lib/codex-execution.ts')},
  external:[/^node:/,'playwright','playwright/test',/^@modelcontextprotocol\//,'zod'],
  output:{format:'es',entryFileNames:'[name].mjs'}
 }}
});
