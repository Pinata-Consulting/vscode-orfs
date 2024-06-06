import * as fs from 'fs';
import * as cp from 'child_process';

export function fileExists(file: string): boolean {
    return fs.existsSync(file)
}

export function runCommand(cmd: string, options: cp.ExecOptions = {}): Promise<{ stdout: string, stderr: string }> {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        cp.exec(cmd, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}
