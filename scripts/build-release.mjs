import { execFileSync } from 'node:child_process';

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}

run('pnpm', ['install']);
run('pnpm', ['db:generate']);
run('pnpm', ['build:editor']);
run('pnpm', ['build:monitor']);
run('pnpm', ['build:engine-manager']);
run('pnpm', ['build:engine']);
run('pnpm', ['build:web']);
run('pnpm', ['pack:layout']);

console.log('Release layout is ready at release/install-layout');
