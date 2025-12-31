import '@material/web/all.js';
import { exec } from 'kernelsu-alt';
import { setupRoute } from './route.js';
import * as patchModule from './page/patch.js';
import * as kpmModule from './page/kpm.js';

export const modDir = '/data/adb/modules/KPatch-Next';

export let superkey = localStorage.getItem('kp-next_superkey') || '';

async function updateStatus() {
    const version = await patchModule.getInstalledVersion();
    const notInstalled = document.getElementById('not-installed');
    const working = document.getElementById('working');
    if (version) {
        document.getElementById('version').textContent = version;
        notInstalled.setAttribute('hidden', '');
        working.removeAttribute('hidden');
        kpmModule.refreshKpmList();
    } else {
        document.getElementById('version').textContent = 'Not installed';
        notInstalled.removeAttribute('hidden');
        working.setAttribute('hidden', '');

        if (superkey) {
            updateSuperkey('');
            updateBtnState(false);
            const failedDialog = document.getElementById('authentication-failed-dialog');
            failedDialog.show();
            failedDialog.querySelector('.confirm').onclick = () => failedDialog.close();
        }
    }
}

function updateSuperkey(key) {
    superkey = key;
    document.querySelectorAll('.password-field').forEach(field => {
        field.value = key;
    });
    localStorage.setItem('kp-next_superkey', key);
}

function updateBtnState(value) {
    document.querySelector('#superkey-dialog .confirm').disabled = !value;
    document.getElementById('start').disabled = !value;
}

function initInfo() {
    exec('uname -r && getprop ro.build.version.release && getprop ro.build.fingerprint && getenforce').then((result) => {
        if (import.meta.env.DEV) { // vite debug
            result.stdout = '6.18.2-linux\n16\nLinuxPC\nEnforcing'
        }
        const info = result.stdout.trim().split('\n');
        document.getElementById('kernel').textContent = info[0];
        document.getElementById('system').textContent = info[1];
        document.getElementById('fingerprint').textContent = info[2];
        document.getElementById('selinux').textContent = info[3];
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[unresolved]').forEach(el => el.removeAttribute('unresolved'));

    setupRoute();

    // visibility toggle for SuperKey text field
    document.querySelectorAll('.password-field').forEach(field => {
        const toggleBtn = field.querySelector('md-icon-button[toggle]');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', () => {
                field.type = toggleBtn.selected ? 'password' : 'text';
            });
        }
    });

    // Superkey
    const superkeyDialog = document.getElementById('superkey-dialog');
    const clearSuperkeyDialog = document.getElementById('clear-superkey-dialog');
    document.getElementById('authenticate').addEventListener('click', (e) => {
        e.stopPropagation();
        superkeyDialog.show();
    });
    document.querySelectorAll('.password-field').forEach(input => {
        input.oninput = () => updateBtnState(input.value);
    });
    superkeyDialog.querySelector('.cancel').onclick = () => superkeyDialog.close();
    superkeyDialog.querySelector('.confirm').onclick = () => {
        const value = superkeyDialog.querySelector('.password-field').value;
        updateSuperkey(value);
        updateBtnState(value);
        updateStatus();
        superkeyDialog.close();
    }
    document.getElementById('clear-superkey').onclick = () => clearSuperkeyDialog.show();
    clearSuperkeyDialog.querySelector('.cancel').onclick = () => clearSuperkeyDialog.close();
    clearSuperkeyDialog.querySelector('.confirm').onclick = () => {
        clearSuperkeyDialog.close();
        updateSuperkey('');
        updateBtnState('');
        updateStatus();
    }

    // Kpm
    const controlDialog = document.getElementById('control-dialog');
    const controlTextField = controlDialog.querySelector('md-outlined-text-field');
    controlTextField.addEventListener('input', () => {
        controlDialog.querySelector('.confirm').disabled = !controlTextField.value;
    });
    document.getElementById('load').onclick = () => {
        kpmModule.uploadAndLoadModule();
        kpmModule.refreshKpmList();
    }

    updateStatus();
    updateBtnState(superkey);
    initInfo();
});

// Overwrite default dialog animation
document.querySelectorAll('md-dialog').forEach(dialog => {
    const defaultOpenAnim = dialog.getOpenAnimation;
    const defaultCloseAnim = dialog.getCloseAnimation;

    dialog.getOpenAnimation = () => {
        const defaultAnim = defaultOpenAnim.call(dialog);
        const customAnim = {};
        Object.keys(defaultAnim).forEach(key => customAnim[key] = defaultAnim[key]);

        customAnim.dialog = [
            [
                [{ opacity: 0, transform: 'translateY(50px)' }, { opacity: 1, transform: 'translateY(0)' }],
                { duration: 300, easing: 'ease' }
            ]
        ];
        customAnim.scrim = [
            [
                [{ 'opacity': 0 }, { 'opacity': 0.32 }],
                { duration: 300, easing: 'linear' },
            ],
        ];
        customAnim.container = [];

        return customAnim;
    };

    dialog.getCloseAnimation = () => {
        const defaultAnim = defaultCloseAnim.call(dialog);
        const customAnim = {};
        Object.keys(defaultAnim).forEach(key => customAnim[key] = defaultAnim[key]);

        customAnim.dialog = [
            [
                [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-50px)' }],
                { duration: 300, easing: 'ease' }
            ]
        ];
        customAnim.scrim = [
            [
                [{ 'opacity': 0.32 }, { 'opacity': 0 }],
                { duration: 300, easing: 'linear' },
            ],
        ];
        customAnim.container = [];

        return customAnim;
    };
});
