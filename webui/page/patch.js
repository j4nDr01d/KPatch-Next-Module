import { exec, spawn } from 'kernelsu-alt';
import { modDir, superkey } from '../index.js';

function uInt2String(ver) {
    const val = typeof ver === 'string' ? parseInt(ver, 16) : ver;

    const major = (val & 0xff0000) >> 16;
    const minor = (val & 0x00ff00) >> 8;
    const patch = (val & 0x0000ff);

    return `${major}.${minor}.${patch}`;
}

async function getKpimgInfo() {
    const result = await exec(`kptools -l -k ${modDir}/bin/kpimg`, { env: { PATH: `${modDir}/bin` }});
    if (import.meta.env.DEV) { // vite debug
        result.stdout = 'version=0xc06\ncompile_time=11:08:10 Dec 30 2025\nconfig=linux,release';
    }
    let version;
    result.stdout.split('\n').forEach((line) => {
        if (line.startsWith('version=')) {
            version = uInt2String(line.split('=')[1]);
            document.getElementById('kpimg-version').textContent = "Version: " + version;
        } else if (line.startsWith('compile_time=')) {
            const time = line.split('=')[1];
            document.getElementById('kpimg-time').textContent = "Time: " + time;
        } else if (line.startsWith('config=')) {
            const config = line.split('=')[1];
            document.getElementById('kpimg-config').textContent = "Config: " + config;
        }
    });
    return version;
}

function getKernelInfo() {
    exec('cat /proc/version').then((result) => {
        if (import.meta.env.DEV) result.stdout = 'Linux version 6.18.2-arch2-1 (linux@archlinux) (gcc (GCC) 15.2.1 20251112, GNU ld (GNU Binutils) 2.45.1) #1 SMP PREEMPT_DYNAMIC Thu, 18 Dec 2025 18:00:18 +0000';
        document.getElementById('kernel-info').textContent = result.stdout.trim();
    });
}

async function getInstalledVersion() {
    if (superkey === '') return null;
    if (import.meta.env.DEV) return uInt2String('c06');
    const working = await exec(`kpatch ${superkey} hello`, { env: { PATH: `${modDir}/bin` }});
    if (working.stdout.trim() !== 'hello1158') return null;
    const version = await exec(`kpatch ${superkey} kpver`, { env: { PATH: `${modDir}/bin` }});
    return uInt2String(version.stdout.trim());
}

export { getKpimgInfo, getKernelInfo, getInstalledVersion }
