import * as fs from 'fs';
import * as cp from 'child_process';

export function fileExists(file: string): Promise<boolean> {
    return new Promise<boolean>((resolve, _reject) => {
        fs.exists(file, (value) => {
            resolve(value);
        })
    })
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
