// ── CLI I/O ──
// Thin readline wrapper. Only file with side effects.

import { createInterface } from 'readline';

let rl = null;

export function initIO() {
  rl = createInterface({ input: process.stdin, output: process.stdout });
  return rl;
}

export function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export function print(text) {
  console.log(text);
}

export function closeIO() {
  if (rl) rl.close();
}
