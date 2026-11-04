import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':resolve(__dirname)}},build:{manifest:'asset-manifest.json',rolldownOptions:{output:{codeSplitting:{groups:[{name:'module-runtime',test:/vite[\/]preload-helper|rolldown[:\/]runtime|commonjsHelpers|(?:document-limits|case-title)\.ts$/}]}}},outDir:'dist/public',emptyOutDir:true}});
