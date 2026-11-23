import { mkdir, cp, copyFile } from 'node:fs/promises';
import './check.mjs';
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('src', 'dist/src', { recursive: true });
console.log('Build estático criado em dist/.');
