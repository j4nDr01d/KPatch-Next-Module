import { listPackages, getPackagesInfo, exec } from 'kernelsu-alt';
import { modDir, persistDir, superkey } from '../index.js';
import fallbackIcon from '../icon.png';

let allApps = [];
let showSystemApp = false;
let searchQuery = '';

const iconObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target.querySelector('.app-icon');
            const loader = img.parentElement.querySelector('.loader');
            const pkg = img.dataset.package;
            img.onload = () => {
                img.style.opacity = '1';
                loader.remove();
            };
            img.onerror = () => {
                img.src = fallbackIcon;
                img.style.opacity = '1';
                loader.remove();
            };
            img.src = `ksu://icon/${pkg}`;
            iconObserver.unobserve(entry.target);
        }
    });
}, { rootMargin: '200px' });

async function refreshAppList() {
    const appList = document.getElementById('app-list');
    appList.innerHTML = '<div class="empty-list">Loading...</div>';

    try {
        if (import.meta.env.DEV) { // vite debug
            allApps = [
                { appLabel: 'Chrome', packageName: 'com.android.chrome', isSystem: false, uid: 10001 },
                { appLabel: 'Google', packageName: 'com.google.android.googlequicksearchbox', isSystem: true, uid: 1010002 },
                { appLabel: 'Settings', packageName: 'com.android.settings', isSystem: true, uid: 10003 },
                { appLabel: 'WhatsApp', packageName: 'com.whatsapp', isSystem: false, uid: 10123 },
                { appLabel: 'Instagram', packageName: 'com.instagram.android', isSystem: false, uid: 1010456 }
            ];
        } else {
            const pkgs = await listPackages();
            const info = await getPackagesInfo(pkgs);
            allApps = Array.isArray(info) ? info : [];
        }
        renderAppList();
    } catch (e) {
        appList.innerHTML = `<div class="empty-list">Error loading apps: ${e.message}</div>`;
    }
}

async function saveExcludedList(excludedApps) {
    const header = 'pkg,exclude,allow,uid';
    const lines = excludedApps.map(app => `${app.packageName},1,0,${app.uid % 100000}`);
    const csvContent = [header, ...lines].join('\n');
    if (import.meta.env.DEV) {
        localStorage.setItem('kp-next_excluded_mock', csvContent);
        return;
    }
    await exec(`echo "${csvContent}" > ${persistDir}/package_config`);
}

async function renderAppList() {
    const appList = document.getElementById('app-list');

    try {
        appList.innerHTML = '';
        let excludedApps = [];
        let rawContent = '';
        if (import.meta.env.DEV) {
            rawContent = localStorage.getItem('kp-next_excluded_mock') || '';
        } else {
            try {
                const result = await exec(`cat ${persistDir}/package_config`);
                if (result.errno === 0) {
                    rawContent = result.stdout.trim();
                }
            } catch (e) {
                console.warn('pacakge_config not available.')
            }
        }

        if (rawContent) {
            let lines = rawContent.split('\n').filter(l => l.trim());

            // Skip header
            if (lines.length > 0 && lines[0].startsWith('pkg,exclude')) {
                lines = lines.slice(1);
            }

            const list = lines.map(line => {
                const parts = line.split(',');
                if (parts.length < 4) return null;
                return { packageName: parts[0].trim(), uid: parseInt(parts[3]) };
            }).filter(item => item !== null);


            // Consistency check
            if (allApps.length > 0) {
                const currentAppsMap = new Map(allApps.map(app => [(app.packageName || '').trim(), app]));

                let changed = false;
                excludedApps = list.map(item => {
                    const app = currentAppsMap.get(item.packageName);
                    if (!app) return item;
                    const realUid = app.uid % 100000;
                    if (realUid !== item.uid) {
                        changed = true;
                        return { packageName: item.packageName, uid: realUid };
                    }
                    return item;
                });

                if (changed) {
                    saveExcludedList(excludedApps);
                }
            } else {
                excludedApps = list;
            }
        }

        const excludedPkgNames = new Set(excludedApps.map(app => app.packageName));

        let filteredApps = allApps.filter(app => {
            const label = app.appLabel || '';
            const pkgName = app.packageName || '';
            const matchesSearch = label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pkgName.toLowerCase().includes(searchQuery.toLowerCase());
            const isSystem = app.isSystem;
            return matchesSearch && (showSystemApp || !isSystem);
        });

        filteredApps.sort((a, b) => {
            const aExcluded = excludedPkgNames.has(a.packageName);
            const bExcluded = excludedPkgNames.has(b.packageName);
            if (aExcluded !== bExcluded) return aExcluded ? -1 : 1;
            return (a.appLabel || '').localeCompare(b.appLabel || '');
        });

        document.getElementById('no-app').classList.toggle('hidden', filteredApps.length > 0);

        filteredApps.forEach(app => {
            const item = document.createElement('label');
            item.className = 'app-item';
            const isExcluded = excludedPkgNames.has(app.packageName);
            const userIdx = Math.floor(app.uid / 100000);
            const extraTags = [];
            if (userIdx > 0) extraTags.push(`USER ${userIdx}`);
            if (app.isSystem) extraTags.push('SYSTEM');
            const extraTagsHtml = extraTags.length > 0 ? `
                <div class="tag-wrapper">
                    ${extraTags.map(tag => `<div class="tag ${tag.toLowerCase()}">${tag}</div>`).join('')}
                </div>
            ` : '';

            item.innerHTML = `
                <md-ripple></md-ripple>
                <div class="icon-container">
                    <div class="loader"></div>
                    <img class="app-icon" data-package="${app.packageName || ''}" style="opacity: 0;">
                </div>
                <div class="app-info">
                    <div class="app-label">${app.appLabel || 'Unknown'}</div>
                    <div class="app-package">${app.packageName || 'Unknown'}</div>
                    ${extraTagsHtml}
                </div>
                <md-switch class="app-switch" ${isExcluded ? 'selected' : ''}></md-switch>
            `;

            const toggle = item.querySelector('md-switch');
            let saveTimeout = null;
            toggle.addEventListener('change', () => {
                const realUid = app.uid % 100000;
                if (toggle.selected) {
                    if (!excludedApps.some(e => e.packageName === app.packageName)) {
                        excludedApps.push({ packageName: app.packageName, uid: realUid });
                    }
                } else {
                    excludedApps = excludedApps.filter(e => e.packageName !== app.packageName);
                }
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveExcludedList(excludedApps);
                }, 500);
                exec(`kpatch ${superkey} exclude_set ${realUid} ${toggle.selected ? 1 : 0}`, { env: { PATH: `${modDir}/bin` } });
            });

            appList.appendChild(item);
            iconObserver.observe(item);
        });
    } catch (e) {
        appList.innerHTML = `<div class="empty-list">Error rendering apps: ${e.message}</div>`;
    }
}

// Initial setup for the search and menu
function initExcludePage() {
    const searchBtn = document.getElementById('search-btn');
    const searchBar = document.getElementById('app-search-bar');
    const closeBtn = document.getElementById('close-app-search-btn');
    const searchInput = document.getElementById('app-search-input');
    const menuBtn = document.getElementById('exclude-menu-btn');
    const menu = document.getElementById('exclude-menu');
    const systemAppCheckbox = document.getElementById('show-system-app');

    searchBtn.onclick = () => {
        searchBar.classList.add('show');
        document.querySelectorAll('.search-bg').forEach(el => el.classList.add('hide'));
        searchInput.focus();
    };

    closeBtn.onclick = (e) => {
        searchBar.classList.remove('show');
        document.querySelectorAll('.search-bg').forEach(el => el.classList.remove('hide'));
        searchQuery = '';
        searchInput.value = '';
        searchInput.blur();
        if (e && e.isTrusted) {
            renderAppList();
        }
    };

    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderAppList();
    });

    menuBtn.onclick = () => menu.show();

    systemAppCheckbox.addEventListener('change', () => {
        showSystemApp = systemAppCheckbox.checked;
        localStorage.setItem('kp-next_show_system_app', showSystemApp);
        renderAppList();
    });
    if (localStorage.getItem('kp-next_show_system_app') === 'true') {
        showSystemApp = true;
        systemAppCheckbox.checked = true;
    }

    document.getElementById('refresh-app-list').onclick = () => {
        refreshAppList();
    };

    // init render
    refreshAppList();
}

export { refreshAppList, initExcludePage };
