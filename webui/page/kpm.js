import { exec, toast } from 'kernelsu-alt';
import { modDir, superkey } from '../index.js';

async function getKpmList() {
    if (import.meta.env.DEV) { // vite debug
        return [
            {
                name: 'Test Module',
                version: '1.0.0',
                description: 'This is a test module',
                author: 'KOWX712',
                license: 'MIT',
                args: 'test'
            },
            {
                name: 'Test Module 2',
                version: '1.0.0',
                description: 'This is a test module',
                author: 'KOWX712',
                license: 'MIT',
                args: 'test'
            }
        ];
    }

    const listResult = await exec(`kpatch ${superkey} kpm list`, { env: { PATH: `${modDir}/bin` } });
    const modules = listResult.stdout.trim().split('\n').filter(line => line.trim());

    const modulePromises = modules.map(async (moduleName) => {
        const infoResult = await exec(`kpatch ${superkey} kpm info ${moduleName}`, { env: { PATH: `${modDir}/bin` } });
        const infoLines = infoResult.stdout.trim().split('\n');

        const moduleInfo = {};
        infoLines.forEach(line => {
            const [key, ...valueParts] = line.split('=');
            moduleInfo[key] = valueParts.join('=');
        });

        return moduleInfo;
    });

    return await Promise.all(modulePromises);
}

async function controlModule(moduleName, action) {
    const result = await exec(`kpatch ${superkey} kpm ctl0 ${moduleName} ${action}`, { env: { PATH: `${modDir}/bin` } });
    toast(result.errno === 0 ? result.stdout : result.stderr);
}

async function unloadModule(moduleName) {
    const result = await exec(`kpatch ${superkey} kpm unload ${moduleName}`, { env: { PATH: `${modDir}/bin` } });
    return result.errno === 0;
}

async function loadModule(modulePath) {
    const result = await exec(`kpatch ${superkey} kpm load ${modulePath}`, { env: { PATH: `${modDir}/bin` } });
    return result.errno === 0;
}

async function refreshKpmList() {
    const list = await getKpmList();
    const container = document.getElementById('kpm-list');

    document.getElementById('no-module').classList.toggle('hidden', list.length > 0);
    container.innerHTML = '';
    list.forEach(module => {
        const item = document.createElement('div');
        item.className = 'card module-card';
        item.innerHTML = `
            <div class="module-card-header">
                <div class="module-card-title">${module.name}</div>
                <div class="module-card-subtitle">${module.version}, Author ${module.author}</div>
                <div class="module-card-subtitle">Args: ${module.args ? module.args : '(null)'}</div>
            </div>
            <div class="module-card-content">
                <div class="module-card-text">${module.description}</div>
            </div>
            <md-divider></md-divider>
            <div class="module-card-actions">
                <md-filled-tonal-icon-button class="control">
                    <md-icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" /></svg></md-icon>
                </md-filled-tonal-icon-button>
                <md-filled-tonal-icon-button class="unload">
                    <md-icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg></md-icon>
                </md-filled-tonal-icon-button>
            </div>
        `;

        item.querySelector('.control').onclick = () => {
            const dialog = document.getElementById('control-dialog');
            const textField = dialog.querySelector('md-outlined-text-field');
            dialog.querySelector('.cancel').onclick = () => dialog.close();
            dialog.querySelector('.confirm').onclick = async () => {
                await controlModule(module.name, textField.value);
                textField.value = '';
                dialog.close();
            };
            dialog.show();
        }
        item.querySelector('.unload').onclick = async () => {
            const dialog = document.getElementById('unload-dialog');
            dialog.querySelector('[slot=content]').innerHTML = `<div>Unload ${module.name} module?</div>`;
            dialog.querySelector('.cancel').onclick = () => dialog.close();
            dialog.querySelector('.confirm').onclick = async () => {
                await unloadModule(module.name);
                refreshKpmList();
                dialog.close();
            };
            dialog.show();
        }

        container.appendChild(item);
    });
}

async function uploadAndLoadModule() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kpm';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.kpm')) {
            toast('Please select a .kpm file');
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];

            try {
                const result = await exec(`mkdir -p ${modDir}/kpm && echo '${base64}' | base64 -d > ${modDir}/kpm/${file.name}`);
                if (result.errno !== 0) {
                    toast(`Failed to write file: ${result.stderr}`);
                    return;
                }

                const success = await loadModule(`${modDir}/kpm/${file.name}`);
                if (success) {
                    toast(`Successfully loaded ${file.name}`);
                    refreshKpmList();
                    exec(`rm -f ${modDir}/kpm/${file.name}`);
                } else {
                    toast(`Failed to load module ${file.name}`);
                }
            } catch (e) {
                toast(`Error: ${e.message}`);
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

export { loadModule, refreshKpmList, uploadAndLoadModule }
