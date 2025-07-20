// =========================================================================
// dataManager - 数据管理器
// 职责: 管理应用的核心数据、状态和业务逻辑。
// 包括：定义常量、管理全局状态、处理数据源的加载/切换、与LocalStorage交互等。
// =========================================================================

// === 常量定义 ===
export const THEME_STORAGE_KEY = 'theme-preference';
export const NAV_DATA_STORAGE_KEY = 'my-awesome-nav-data'; // 用于缓存默认数据源的基础数据
export const NAV_DATA_SOURCE_PREFERENCE_KEY = 'nav-data-source-preference'; // 用户最后选择的数据源
export const NAV_CUSTOM_SOURCES_KEY = 'nav-custom-data-sources'; // 存储所有自定义数据源
export const NAV_CUSTOM_USER_SITES_KEY = 'nav-user-custom-sites-data'; // 存储“我的导航”数据
export const CUSTOM_CATEGORY_ID = 'custom-user-sites'; // “我的导航”分类的固定ID
export const DEFAULT_SITES_PATH = "data/04影音娱乐.json"; // 默认加载的数据源

// === 默认内置数据源列表 ===
export const defaultSiteDataSources = [
    {name: "阿里资源", path: "data/00阿里资源.json"},
    {name: "在线服务", path: "data/01在线服务.json"},
    {name: "工具", path: "data/02工具.json"},
    {name: "软件", path: "data/03软件.json"},
    {name: "影音娱乐", path: "data/04影音娱乐.json"},
    {name: "生产力", path: "data/05生产力.json"},
    {name: "信息", path: "data/06信息.json"}
];

// === 全局状态对象 ===
export const state = {
    siteData: { categories: [] }, // 当前导航页面的数据
    searchConfig: { categories: [], engines: {} }, // 搜索引擎配置
    allSiteDataSources: [], // 所有可用数据源（默认+自定义）的列表
    originalDataSourceValue: null, // 用于在数据源切换失败时，恢复到上一个有效的值
};

// =========================================================================
// #region 数据源处理
// =========================================================================

/**
 * 从 localStorage 获取所有自定义数据源。
 * @returns {Array} 自定义数据源对象数组。
 */
export function getCustomSources() {
    try {
        return JSON.parse(localStorage.getItem(NAV_CUSTOM_SOURCES_KEY)) || [];
    } catch {
        // 解析失败时返回空数组，防止应用崩溃
        return [];
    }
}

/**
 * 加载所有数据源（默认+自定义）到全局状态 `state.allSiteDataSources` 中。
 */
export function loadAllDataSources() {
    const customSources = getCustomSources();
    state.allSiteDataSources = [...defaultSiteDataSources, ...customSources];
}

/**
 * 执行数据源切换的核心逻辑。
 * @param {string} identifier - 数据源的唯一标识 (路径或名称)。
 * @param {boolean} useCache - 是否尝试使用缓存的导航数据 (仅用于应用初次加载)。
 * @param {Function} onSwitchSuccess - 切换成功后的回调函数，接收 identifier。
 * @param {Function} onSwitchFail - 切换失败后的回调函数，接收源名称和错误对象。
 */
export async function performDataSourceSwitch(identifier, useCache = false, onSwitchSuccess, onSwitchFail) {
    let newBaseData;
    let source = state.allSiteDataSources.find(s => (s.path || s.name) === identifier);

    // 步骤 1: 处理数据源不存在的情况（例如，被删除后），回退到默认源。
    if (!source) {
        console.warn(`数据源 "${identifier}" 未找到, 回退到默认源.`);
        identifier = DEFAULT_SITES_PATH;
        source = state.allSiteDataSources.find(s => s.path === identifier);
    }

    // 步骤 2: 尝试从缓存加载数据 (仅在初次加载时，且针对默认数据源)。
    if (useCache && source && source.path) {
        const storedBaseData = localStorage.getItem(NAV_DATA_STORAGE_KEY);
        if (storedBaseData) {
            try {
                newBaseData = JSON.parse(storedBaseData);
            } catch (e) {
                console.error("解析缓存数据失败，将从网络重新获取。", e);
            }
        }
    }

    // 步骤 3: 如果无缓存数据，则从源头获取。
    if (!newBaseData) {
        try {
            if (source.path) { // 默认数据源，从文件加载
                const response = await fetch(source.path);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                newBaseData = await response.json();
            } else { // 自定义数据源，从 state 中直接获取
                // 深拷贝以防意外修改 state.allSiteDataSources 中的原始数据
                newBaseData = JSON.parse(JSON.stringify(source.data));
            }
        } catch (error) {
            if (onSwitchFail) onSwitchFail(source ? source.name : identifier, error);
            return;
        }
    }

    // 步骤 4: 合并用户的“我的导航”数据。
    let finalData;
    if (source && source.path) { // 默认数据源需要合并“我的导航”
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
        finalData = { ...newBaseData, categories: [customCategory, ...otherCategories] };
    } else { // 自定义数据源其数据本身就是完整的，无需合并。
        finalData = newBaseData;
    }

    // 深拷贝最终数据到主状态，防止后续操作意外修改源数据
    state.siteData = JSON.parse(JSON.stringify(finalData));

    // 步骤 5: 持久化偏好设置并记录当前成功的值
    state.originalDataSourceValue = identifier;
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, identifier);

    if (onSwitchSuccess) onSwitchSuccess(identifier);
}
// #endregion

// =========================================================================
// #region 数据读写与查询
// =========================================================================

/**
 * 获取用户的主题偏好设置。
 * @returns {'dark' | 'light'} - 主题名称。
 */
export function getThemePreference() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme) return storedTheme;
    // 根据系统偏好设置默认主题
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 从文件加载搜索引擎配置。
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
 * 保存当前导航数据。此函数能智能区分默认源和自定义源的保存逻辑。
 * @param {string} currentSourceIdentifier - 当前正在编辑的数据源的标识符。
 */
export function saveNavData(currentSourceIdentifier) {
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
            const updatedData = JSON.parse(JSON.stringify(state.siteData));
            // 清理掉空的分类，除了受保护的“我的导航”
            updatedData.categories = updatedData.categories.filter(c => c.sites.length > 0 || c.categoryId === CUSTOM_CATEGORY_ID);

            // 更新持久化数据
            customSources[sourceIndex].data = updatedData;
            localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(customSources));

            // 同步更新内存中的 state.allSiteDataSources，确保不刷新页面时数据也是最新的
            const inMemorySource = state.allSiteDataSources.find(s => !s.path && s.name === currentSource.name);
            if (inMemorySource) {
                inMemorySource.data = updatedData;
            }
        }
    }
    // 2. 如果正在编辑的是默认数据源 (有 path 属性)
    else {
        // 只持久化用户的“我的导航”分类
        const customCategory = state.siteData.categories.find(c => c.categoryId === CUSTOM_CATEGORY_ID);
        if (customCategory) {
            localStorage.setItem(NAV_CUSTOM_USER_SITES_KEY, JSON.stringify(customCategory));
        }

        // 将不含用户自定义分类的基础数据缓存起来 (用于下次快速加载)
        const baseData = JSON.parse(JSON.stringify(state.siteData));
        baseData.categories = baseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
        localStorage.setItem(NAV_DATA_STORAGE_KEY, JSON.stringify(baseData));
    }
}

/**
 * 根据站点ID查找站点及其所属分类。
 * @param {string} siteId - 要查找的站点ID。
 * @returns {{site: object|null, category: object|null}} 包含站点和分类对象的元组。
 */
export function findSiteById(siteId) {
    for (const category of state.siteData.categories) {
        const site = category.sites.find(s => s.id === siteId);
        if (site) return {site, category};
    }
    return {site: null, category: null};
}
// #endregion