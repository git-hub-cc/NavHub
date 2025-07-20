// =========================================================================
// data.js - 数据管理器
// 职责: 管理应用的核心数据、状态和业务逻辑。
// 包括：定义常量、管理全局状态、处理数据源的加载/切换、与LocalStorage交互等。
// =========================================================================

import { dom } from './ui.js'; // 引入 dom 以便访问 dataSourceSelect

// === 常量定义 ===
export const THEME_STORAGE_KEY = 'theme-preference';
export const NAV_DATA_STORAGE_KEY = 'my-awesome-nav-data';
export const NAV_DATA_SOURCE_PREFERENCE_KEY = 'nav-data-source-preference';
export const NAV_CUSTOM_SOURCES_KEY = 'nav-custom-data-sources';
export const NAV_CUSTOM_USER_SITES_KEY = 'nav-user-custom-sites-data';
export const CUSTOM_CATEGORY_ID = 'custom-user-sites';
export const DEFAULT_SITES_PATH = "data/04影音娱乐.json";

// === 默认数据源列表 ===
export const defaultSiteDataSources = [
    {name: "阿里资源", path: "data/00阿里资源.json"},
    {name: "在线服务", path: "data/01在线服务.json"},
    {name: "工具", path: "data/02工具.json"},
    {name: "软件", path: "data/03软件.json"},
    {name: "影音娱乐", path: "data/04影音娱乐.json"},
    {name: "学习与生产力", path: "data/05学习与生产力.json"},
    {name: "技术与开发", path: "data/06技术与开发.json"},
    {name: "其它", path: "data/07其它.json"},
];

// === 全局状态变量 ===
// 使用一个对象来封装状态，便于管理和传递
export const state = {
    siteData: {categories: []},
    searchConfig: {categories: [], engines: {}},
    allSiteDataSources: [],
    originalDataSourceValue: null, // 用于在切换失败时恢复选择
};

/**
 * 从 localStorage 获取自定义数据源
 * @returns {Array} - 自定义数据源数组
 */
export function getCustomSources() {
    try {
        return JSON.parse(localStorage.getItem(NAV_CUSTOM_SOURCES_KEY)) || [];
    } catch {
        return [];
    }
}

/**
 * 加载所有数据源（默认+自定义）到状态中
 */
export function loadAllDataSources() {
    const customSources = getCustomSources();
    state.allSiteDataSources = [...defaultSiteDataSources, ...customSources];
}

/**
 * 获取用户的主题偏好设置
 * @returns {string} - 'dark' 或 'light'
 */
export function getThemePreference() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 从文件加载搜索引擎配置
 */
export async function loadSearchConfig() {
    try {
        const response = await fetch('data/engines.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        state.searchConfig = await response.json();
    } catch (error) {
        console.error("无法加载或处理搜索配置文件:", error);
        // 提供一个空的回退配置，防止应用崩溃
        state.searchConfig = {categories: [], engines: {}};
    }
}

/**
 * --- MODIFICATION ---
 * 保存当前导航数据。
 * 这个函数现在更加智能，能够区分正在编辑的是默认数据源还是自定义数据源。
 * 并且在保存自定义数据源后，会同步更新内存中的 state。
 */
export function saveNavData() {
    // --- MODIFICATION: Use custom select's data-value ---
    const currentSourceIdentifier = dom.customSelect.dataset.value;
    const currentSource = state.allSiteDataSources.find(s => (s.path || s.name) === currentSourceIdentifier);

    if (!currentSource) {
        console.warn(`保存数据时未找到数据源: ${currentSourceIdentifier}`);
        return;
    }

    // 1. 如果正在编辑的是自定义数据源 (没有 path 属性)
    if (!currentSource.path) {
        const customSources = getCustomSources();
        const sourceIndex = customSources.findIndex(s => s.name === currentSource.name);

        if (sourceIndex > -1) {
            // 深拷贝当前 state.siteData 以更新该数据源
            const updatedData = JSON.parse(JSON.stringify(state.siteData));

            // (可选但推荐) 清理掉空的分类，除了受保护的“我的导航”分类
            updatedData.categories = updatedData.categories.filter(c => {
                return c.sites.length > 0 || c.categoryId === CUSTOM_CATEGORY_ID;
            });

            // 步骤 1: 更新用于持久化的数组
            customSources[sourceIndex].data = updatedData;

            // 步骤 2: 持久化到 localStorage
            localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(customSources));

            // --- 新增的关键修复 ---
            // 步骤 3: 同步更新内存中的 state.allSiteDataSources
            // 这一步确保了在不刷新页面的情况下，切换数据源也能加载到最新的数据
            const inMemorySource = state.allSiteDataSources.find(s => !s.path && s.name === currentSource.name);
            if (inMemorySource) {
                inMemorySource.data = updatedData; // 使用已经深拷贝过的 updatedData
                console.log(`In-memory state for "${currentSource.name}" has been synchronized.`);
            }
        }
    }
    // 2. 如果正在编辑的是默认数据源 (有 path 属性)
    else {
        // 沿用旧逻辑：只持久化用户的“我的导航”分类
        const customCategory = state.siteData.categories.find(c => c.categoryId === CUSTOM_CATEGORY_ID);
        if (customCategory) {
            localStorage.setItem(NAV_CUSTOM_USER_SITES_KEY, JSON.stringify(customCategory));
        }

        // 将不含用户自定义分类的基础数据缓存起来 (用于快速加载)
        const baseData = JSON.parse(JSON.stringify(state.siteData));
        baseData.categories = baseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
        localStorage.setItem(NAV_DATA_STORAGE_KEY, JSON.stringify(baseData));
    }
}


/**
 * 根据站点ID查找站点及其所属分类
 * @param {string} siteId - 要查找的站点ID
 * @returns {{site: object|null, category: object|null}}
 */
export function findSiteById(siteId) {
    for (const category of state.siteData.categories) {
        const site = category.sites.find(s => s.id === siteId);
        if (site) return {site, category};
    }
    return {site: null, category: null};
}


/**
 * 执行数据源切换的核心逻辑
 * @param {string} identifier - 数据源的唯一标识 (路径或名称)
 * @param {boolean} useCache - 是否尝试使用缓存的导航数据
 * @param {Function} onSwitchSuccess - 切换成功后的回调
 * @param {Function} onSwitchFail - 切换失败后的回调
 */
export async function performDataSourceSwitch(identifier, useCache = false, onSwitchSuccess, onSwitchFail) {
    let newBaseData;
    const source = state.allSiteDataSources.find(s => (s.path || s.name) === identifier);

    // 步骤 1: 尝试从缓存加载数据 (仅在初次加载时，且针对默认数据源)
    if (useCache && source && source.path) { // 只对默认数据源使用缓存
        const storedBaseData = localStorage.getItem(NAV_DATA_STORAGE_KEY);
        if (storedBaseData) {
            try {
                newBaseData = JSON.parse(storedBaseData);
            } catch (e) {
                console.error("解析缓存数据失败，将重新获取。", e);
            }
        }
    }

    // 步骤 2: 如果无缓存数据，则从源头获取
    if (!newBaseData) {
        let effectiveSource = source;
        let effectiveIdentifier = identifier;
        // 处理已保存的数据源被删除的情况，回退到默认
        if (!effectiveSource) {
            const fallbackIdentifier = DEFAULT_SITES_PATH;
            console.warn(`数据源 "${identifier}" 未找到, 回退到默认源.`);
            effectiveIdentifier = fallbackIdentifier;
            effectiveSource = state.allSiteDataSources.find(s => s.path === effectiveIdentifier);
        }

        identifier = effectiveIdentifier; // 更新 identifier 以便后续使用

        try {
            if (effectiveSource.path) { // 默认数据源，从文件加载
                const response = await fetch(effectiveSource.path);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                newBaseData = await response.json();
            } else { // 自定义数据源，从 state 中直接获取
                // 深拷贝以防意外修改原始数据
                newBaseData = JSON.parse(JSON.stringify(effectiveSource.data));
            }
        } catch (error) {
            // 如果获取失败，调用失败回调并终止
            if (onSwitchFail) onSwitchFail(effectiveSource ? effectiveSource.name : identifier, error);
            return;
        }
    }

    // 步骤 3: 合并用户的“我的导航”数据 (如果当前源不是自定义源)
    // 对于自定义源，其数据本身就应该包含了所有分类，不需要再合并
    let finalData;
    if (source && source.path) { // 是默认数据源
        let customCategory;
        try {
            const customDataRaw = localStorage.getItem(NAV_CUSTOM_USER_SITES_KEY);
            customCategory = customDataRaw ? JSON.parse(customDataRaw) : {
                categoryName: '我的导航',
                categoryId: CUSTOM_CATEGORY_ID,
                sites: []
            };
        } catch (e) {
            console.error("解析用户自定义网站失败，已重置。", e);
            customCategory = {categoryName: '我的导航', categoryId: CUSTOM_CATEGORY_ID, sites: []};
        }
        // 确保 "我的导航" 分类始终存在且在最前面
        const otherCategories = newBaseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
        finalData = {
            ...newBaseData,
            categories: [customCategory, ...otherCategories]
        };
    } else { // 是自定义数据源
        finalData = newBaseData;
    }


    state.siteData = JSON.parse(JSON.stringify(finalData)); // 深拷贝以避免意外修改

    // 步骤 4: 持久化偏好设置
    state.originalDataSourceValue = identifier;
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, identifier);

    // 步骤 5: 调用成功回调，以更新UI
    if (onSwitchSuccess) onSwitchSuccess(identifier);
}