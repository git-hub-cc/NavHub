// =========================================================================
// dataManager.js - 数据管理器 (增强版: 支持 GitHub 同步)
// 职责: 管理应用的核心数据、状态、业务逻辑以及与 GitHub 的数据同步。
// =========================================================================

import { githubClient } from './githubClient.js';
import { showAlert } from './ui.js'; // 仅用于关键错误提示，避免循环依赖

// === 常量定义 ===
export const THEME_STORAGE_KEY = 'theme-preference';
export const NAV_DATA_STORAGE_KEY = 'my-awesome-nav-data'; // 本地缓存的基础数据
export const NAV_DATA_SOURCE_PREFERENCE_KEY = 'nav-data-source-preference'; // 用户最后选择的数据源标识
export const NAV_CUSTOM_SOURCES_KEY = 'nav-custom-data-sources'; // 本地自定义源
export const NAV_CUSTOM_USER_SITES_KEY = 'nav-user-custom-sites-data'; // 本地“我的导航”数据
export const PROXY_MODE_KEY = 'proxy-mode-preference';
export const CUSTOM_CATEGORY_ID = 'custom-user-sites';
export const DEFAULT_SITES_PATH = "data/02服务.json";

// === GitHub 相关常量 ===
export const GITHUB_TOKEN_KEY = 'navhub-github-token';
export const GITHUB_REPO_KEY = 'navhub-github-repo';
export const GITHUB_DATA_FILE = 'navhub-data.json';
export const DEFAULT_REPO_NAME = 'navhub-data'; // 默认创建的仓库名

// === 默认内置数据源列表 ===
export const defaultSiteDataSources = [
    {name: "资源", path: "data/01资源.json"},
    {name: "服务", path: "data/02服务.json"}
];

// === 全局状态对象 ===
export const state = {
    siteData: { categories: [] }, // 当前页面数据
    searchConfig: { categories: [], engines: {} },
    allSiteDataSources: [], // 所有可用数据源
    originalDataSourceValue: null,

    // GitHub 同步状态
    github: {
        token: null,
        user: null,
        repo: null, // full_name: username/repo
        remoteSha: null, // 远程文件的 SHA，用于乐观锁更新
        isSyncing: false,
        lastSyncTime: null,
        syncStatus: 'idle' // idle, syncing, success, error, conflict
    }
};

// =========================================================================
// #region 偏好设置管理
// =========================================================================

export function getThemePreference() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getProxyMode() {
    return localStorage.getItem(PROXY_MODE_KEY) === 'true';
}

export function setProxyMode(isProxyOn) {
    localStorage.setItem(PROXY_MODE_KEY, String(isProxyOn));
}

// =========================================================================
// #region GitHub 核心逻辑 (新增)
// =========================================================================

/**
 * 初始化 GitHub 客户端
 * 尝试从 localStorage 读取 Token 并验证，如果有效则设置 state
 */
export async function initGitHub() {
    const token = localStorage.getItem(GITHUB_TOKEN_KEY);
    const savedRepo = localStorage.getItem(GITHUB_REPO_KEY);

    if (!token) return false;

    try {
        githubClient.setToken(token);
        const user = await githubClient.getUser();

        state.github.token = token;
        state.github.user = user;

        // 确定仓库名称
        let repoName = savedRepo;
        if (!repoName) {
            // 如果没存过，先检查默认仓库是否存在
            const exists = await githubClient.checkRepoExists(user.login, DEFAULT_REPO_NAME);
            if (exists) {
                repoName = `${user.login}/${DEFAULT_REPO_NAME}`;
            }
        } else if (!repoName.includes('/')) {
            // 兼容只存了 repo 名的情况
            repoName = `${user.login}/${repoName}`;
        }

        if (repoName) {
            state.github.repo = repoName;
            githubClient.setRepo(repoName);
            localStorage.setItem(GITHUB_REPO_KEY, repoName);
        }

        console.log(`[GitHub] 已登录: ${user.login}, 仓库: ${state.github.repo || '未设置'}`);
        return true;
    } catch (e) {
        console.warn("[GitHub] 初始化失败:", e);
        // Token 失效，清除本地存储防止死循环
        if (e.message.includes("无效")) {
            localStorage.removeItem(GITHUB_TOKEN_KEY);
        }
        return false;
    }
}

/**
 * 绑定 GitHub 账号
 * @param {string} token
 * @param {string} [customRepoName] 可选的自定义仓库名
 */
export async function bindGitHub(token, customRepoName) {
    githubClient.setToken(token);
    const user = await githubClient.getUser(); // 验证 Token

    // 确定仓库
    let targetRepoName = customRepoName || DEFAULT_REPO_NAME;
    let fullRepoName = `${user.login}/${targetRepoName}`;

    // 检查仓库是否存在，不存在则创建
    const exists = await githubClient.checkRepoExists(user.login, targetRepoName);
    if (!exists) {
        try {
            await githubClient.createRepo(targetRepoName);
            console.log(`[GitHub] 自动创建仓库: ${fullRepoName}`);
        } catch (e) {
            throw new Error(`无法创建仓库 ${targetRepoName}: ${e.message}`);
        }
    }

    // 保存状态
    localStorage.setItem(GITHUB_TOKEN_KEY, token);
    localStorage.setItem(GITHUB_REPO_KEY, fullRepoName);

    state.github.token = token;
    state.github.user = user;
    state.github.repo = fullRepoName;
    githubClient.setRepo(fullRepoName);

    return true;
}

/**
 * 从 GitHub 拉取数据并同步到本地
 * @param {Function} onStatusChange 状态回调
 */
export async function syncFromGitHub(onStatusChange) {
    if (!state.github.token || !state.github.repo) return;

    if (onStatusChange) onStatusChange('syncing');

    try {
        const fileData = await githubClient.getFile(GITHUB_DATA_FILE);

        if (fileData) {
            const { content, sha } = fileData;
            state.github.remoteSha = sha; // 记录 SHA 用于下次更新

            // 1. 同步“我的导航”数据
            if (content.customUserSites) {
                localStorage.setItem(NAV_CUSTOM_USER_SITES_KEY, JSON.stringify(content.customUserSites));
            }

            // 2. 同步自定义源数据
            if (content.customSources) {
                localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(content.customSources));
            }

            // 3. 同步偏好设置
            if (content.preferences) {
                if (content.preferences.theme) applyThemeAndSave(content.preferences.theme);
                if (content.preferences.proxyMode !== undefined) {
                    setProxyMode(content.preferences.proxyMode);
                    // 注意：这里只更新数据，UI更新需由调用者处理
                }
            }

            state.github.lastSyncTime = Date.now();
            console.log("[GitHub] 数据拉取成功 (SHA: " + sha.substring(0, 7) + ")");
        } else {
            console.log("[GitHub] 远程文件不存在，将在首次保存时创建。");
        }

        if (onStatusChange) onStatusChange('success');
    } catch (e) {
        console.error("[GitHub] 同步失败:", e);
        if (onStatusChange) onStatusChange('error');
    }
}

/**
 * 推送数据到 GitHub
 * 包含防抖逻辑在调用层实现，此处为核心原子操作
 */
export async function syncToGitHub() {
    if (!state.github.token || !state.github.repo) return;

    // 收集所有需要同步的数据
    const dataToSync = {
        updatedAt: Date.now(),
        preferences: {
            theme: getThemePreference(),
            proxyMode: getProxyMode()
        },
        // 读取最新的本地数据
        customUserSites: JSON.parse(localStorage.getItem(NAV_CUSTOM_USER_SITES_KEY) || 'null'),
        customSources: JSON.parse(localStorage.getItem(NAV_CUSTOM_SOURCES_KEY) || '[]')
    };

    try {
        // 如果我们没有 remoteSha，说明还没拉取过，或者文件不存在
        // 为了安全，先尝试拉取一次获取 SHA，避免覆盖冲突
        if (!state.github.remoteSha) {
            try {
                const existing = await githubClient.getFile(GITHUB_DATA_FILE);
                if (existing) state.github.remoteSha = existing.sha;
            } catch (ignore) {}
        }

        const res = await githubClient.saveFile(GITHUB_DATA_FILE, dataToSync, state.github.remoteSha);

        // 更新 SHA
        state.github.remoteSha = res.content.sha;
        state.github.lastSyncTime = Date.now();
        state.github.syncStatus = 'success';
        console.log("[GitHub] 数据推送成功, 新 SHA:", res.content.sha.substring(0, 7));

        return true;
    } catch (e) {
        console.error("[GitHub] 推送失败:", e);
        state.github.syncStatus = 'error';
        throw e;
    }
}

// 辅助：内部更新主题并保存本地（用于同步下载后的应用）
function applyThemeAndSave(theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
}

// =========================================================================
// #region 数据源处理
// =========================================================================

export function getCustomSources() {
    try {
        return JSON.parse(localStorage.getItem(NAV_CUSTOM_SOURCES_KEY)) || [];
    } catch {
        return [];
    }
}

export function loadAllDataSources() {
    const customSources = getCustomSources();
    state.allSiteDataSources = [...defaultSiteDataSources, ...customSources];
}

export async function performDataSourceSwitch(identifier, useCache = false, onSwitchSuccess, onSwitchFail) {
    let newBaseData;
    let source = state.allSiteDataSources.find(s => (s.path || s.name) === identifier);

    if (!source) {
        console.warn(`数据源 "${identifier}" 未找到, 回退默认.`);
        identifier = DEFAULT_SITES_PATH;
        source = state.allSiteDataSources.find(s => s.path === identifier);
    }

    if (useCache && source && source.path === DEFAULT_SITES_PATH) {
        const storedBaseData = localStorage.getItem(NAV_DATA_STORAGE_KEY);
        if (storedBaseData) {
            try { newBaseData = JSON.parse(storedBaseData); } catch (e) {}
        }
    }

    if (!newBaseData) {
        try {
            if (source.path) {
                const response = await fetch(source.path);
                if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
                newBaseData = await response.json();
            } else {
                newBaseData = JSON.parse(JSON.stringify(source.data));
            }
        } catch (error) {
            if (onSwitchFail) onSwitchFail(source ? source.name : identifier, error);
            return;
        }
    }

    let finalData;
    if (source && source.path) {
        let customCategory;
        try {
            // 这里的数据可能已经被 syncFromGitHub 更新过了
            const customDataRaw = localStorage.getItem(NAV_CUSTOM_USER_SITES_KEY);
            customCategory = customDataRaw ? JSON.parse(customDataRaw) : {
                categoryName: '我的导航',
                categoryId: CUSTOM_CATEGORY_ID,
                sites: []
            };
        } catch (e) {
            customCategory = {categoryName: '我的导航', categoryId: CUSTOM_CATEGORY_ID, sites: []};
        }

        // 确保“我的导航”数据结构有效
        if (!customCategory.categoryId) customCategory.categoryId = CUSTOM_CATEGORY_ID;
        if (!customCategory.sites) customCategory.sites = [];

        const otherCategories = newBaseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
        finalData = { ...newBaseData, categories: [customCategory, ...otherCategories] };
    } else {
        finalData = newBaseData;
    }

    state.siteData = JSON.parse(JSON.stringify(finalData));
    state.originalDataSourceValue = identifier;
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, identifier);

    if (onSwitchSuccess) onSwitchSuccess(identifier);
}

// =========================================================================
// #region 数据读写与保存
// =========================================================================

export async function loadSearchConfig() {
    try {
        const response = await fetch('data/00engines.json');
        state.searchConfig = await response.json();
    } catch (error) {
        state.searchConfig = {categories: [], engines: {}};
    }
}

// 防抖计时器
let saveDebounceTimer = null;

/**
 * 保存导航数据 (本地 + 触发云同步)
 * @param {string} currentSourceIdentifier
 */
export function saveNavData(currentSourceIdentifier) {
    const currentSource = state.allSiteDataSources.find(s => (s.path || s.name) === currentSourceIdentifier);
    if (!currentSource) return;

    // 1. 本地持久化逻辑
    if (!currentSource.path) {
        // 自定义源
        const customSources = getCustomSources();
        const sourceIndex = customSources.findIndex(s => s.name === currentSource.name);
        if (sourceIndex > -1) {
            const updatedData = JSON.parse(JSON.stringify(state.siteData));
            updatedData.categories = updatedData.categories.filter(c => c.sites.length > 0 || c.categoryId === CUSTOM_CATEGORY_ID);

            customSources[sourceIndex].data = updatedData;
            localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(customSources));

            const inMemorySource = state.allSiteDataSources.find(s => !s.path && s.name === currentSource.name);
            if (inMemorySource) inMemorySource.data = updatedData;
        }
    } else {
        // 默认源，只保存“我的导航”
        const customCategory = state.siteData.categories.find(c => c.categoryId === CUSTOM_CATEGORY_ID);
        if (customCategory) {
            localStorage.setItem(NAV_CUSTOM_USER_SITES_KEY, JSON.stringify(customCategory));
        }

        if (currentSourceIdentifier === DEFAULT_SITES_PATH) {
            const baseData = JSON.parse(JSON.stringify(state.siteData));
            baseData.categories = baseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
            localStorage.setItem(NAV_DATA_STORAGE_KEY, JSON.stringify(baseData));
        }
    }

    // 2. 触发 GitHub 同步 (防抖 2秒)
    if (state.github.token && state.github.repo) {
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

        // 通知 UI 正在等待同步 (可选: 通过回调或事件)
        const event = new CustomEvent('navhub-sync-status', { detail: { status: 'pending' } });
        window.dispatchEvent(event);

        saveDebounceTimer = setTimeout(() => {
            const eventStart = new CustomEvent('navhub-sync-status', { detail: { status: 'syncing' } });
            window.dispatchEvent(eventStart);

            syncToGitHub().then(() => {
                window.dispatchEvent(new CustomEvent('navhub-sync-status', { detail: { status: 'success' } }));
            }).catch(() => {
                window.dispatchEvent(new CustomEvent('navhub-sync-status', { detail: { status: 'error' } }));
            });
        }, 2000);
    }
}

export function findSiteById(siteId) {
    for (const category of state.siteData.categories) {
        const site = category.sites.find(s => s.id === siteId);
        if (site) return {site, category};
    }
    return {site: null, category: null};
}