import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
for(const file of ['public/model.mjs','public/app.mjs','server.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
const html=await readFile('public/index.html','utf8');
for(const path of ['/styles.css','/app.mjs']){if(!html.includes(path))throw Error(`Missing asset ${path}`);await readFile('public'+path);}
execFileSync(process.execPath,['tests/model.test.mjs'],{stdio:'inherit'});
console.log('Static application validated. Publish public/ to Vercel.');
