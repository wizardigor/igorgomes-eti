import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
await build({entryPoints:['node_modules/mespeak/src/index.js'],bundle:true,platform:'browser',format:'iife',globalName:'meSpeak',minify:true,outfile:'vendor/mespeak.js'});
await copyFile('node_modules/mespeak/src/mespeak_config.json','vendor/mespeak_config.json');
await copyFile('node_modules/mespeak/voices/pt.json','vendor/pt.json');
