import {spawn} from 'node:child_process';
import {findCodex} from './codex-cli';
const child=spawn(await findCodex(),['login',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
