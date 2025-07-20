// =========================================================================
// fileManager.js - 导入/导出模块
// 职责: 封装所有与数据导入、导出相关的复杂逻辑。
// 包括：导出JSON文件、处理文件导入（JSON和HTML书签）、解析HTML书签、管理自定义数据源（新增、删除）。
// =========================================================================

import { state, getCustomSources, loadAllDataSources, saveNavData, performDataSourceSwitch, CUSTOM_CATEGORY_ID, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY } from './dataManager.js';
import { dom, showAlert, showConfirm, populateDataSourceSelector, renderNavPage, updateDeleteButtonState, closeImportNameModal, openImportNameModal } from './ui.js';

let pendingImportData = null; // 用于暂存待导入的数据

// =========================================================================
// #region 导出逻辑
// =========================================================================

/**
 * 处理导出按钮点击事件，将当前数据源的数据保存为JSON文件。
 */
export function handleExport() {
    const currentSourceIdentifier = dom.customSelect.dataset.value;
    saveNavData(currentSourceIdentifier); // 确保保存的是最新数据

    const dataToExport = JSON.parse(JSON.stringify(state.siteData)); // 深拷贝以安全操作

    // 导出前，确保所有分类和网站都有ID，保证数据的完整性和可再导入性
    dataToExport.categories.forEach(category => {
        if (!category.categoryId) {
            category.categoryId = generateCategoryId(category.categoryName);
            console.warn(`[Export] 为分类 "${category.categoryName}" 添加了缺失的 categoryId: ${category.categoryId}`);
        }
        if (category.sites && Array.isArray(category.sites)) {
            category.sites.forEach(site => {
                if (!site.id) {
                    site.id = `site-${Date.now()}-${Math.random()}`;
                    console.warn(`[Export] 为网站 "${site.title}" 添加了缺失的 id: ${site.id}`);
                }
            });
        }
    });

    // 导出时不应包含任何空的分类，除非它是受保护的“我的导航”
    dataToExport.categories = dataToExport.categories.filter(c => c.sites.length > 0 || c.categoryId === CUSTOM_CATEGORY_ID);

    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = (new Date()).toISOString().slice(0, 10);
    const sourceName = dom.customSelectSelectedText.textContent;
    a.download = `NavHub-Export-${sourceName}-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// #endregion

// =========================================================================
// #region 导入逻辑
// =========================================================================

/**
 * 触发文件选择对话框。
 */
export function handleImportClick() {
    dom.importFileInput.click();
}

/**
 * 处理用户选择的文件，支持.json和.html格式。
 * @param {Event} event - 文件输入框的 change 事件
 */
export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const content = e.target.result;
            let parsedData;

            if (file.name.endsWith('.html') || file.type === 'text/html') {
                // 解析HTML书签文件
                const nodeList = textToNodeList(content);
                const bookmarkNode = getBookmarkNode(nodeList);
                if (!bookmarkNode) throw new Error('未在此文件中找到有效的书签数据 (缺少 <DL> 标签)。');
                const rawJson = nodeToJson(bookmarkNode);
                const nestedNavJson = transformToNavFormat(rawJson);
                parsedData = flattenNavJson(nestedNavJson);

                if (!parsedData || !Array.isArray(parsedData.categories) || parsedData.categories.length === 0) {
                    throw new Error("无法从书签文件中解析出任何有效的分类和网站。");
                }
            } else {
                // 默认作为NavHub的JSON文件解析
                parsedData = JSON.parse(content);
                if (!parsedData || !Array.isArray(parsedData.categories)) {
                    throw new Error("无效的 NavHub JSON 文件格式。");
                }
            }
            pendingImportData = parsedData;
            openImportNameModal();

        } catch (error) {
            showAlert(`无法解析文件: ${error.message}`, '导入错误');
            pendingImportData = null;
        }
    };
    reader.onerror = () => {
        showAlert('读取文件时出错。', '文件读取失败');
    };

    reader.readAsText(file);
    event.target.value = ''; // 重置输入框，以便再次选择同名文件
}

/**
 * 处理导入数据源的命名和保存。
 * @param {Event} e - 表单提交事件
 */
export function handleImportNameSubmit(e) {
    e.preventDefault();
    const newName = dom.importNameInput.value.trim();
    if (!newName || !pendingImportData) return;

    if (state.allSiteDataSources.some(source => source.name === newName)) {
        dom.importNameError.textContent = '此名称已存在，请换一个。';
        dom.importNameError.style.display = 'block';
        return;
    }

    const customSources = getCustomSources();
    const newCustomSource = {
        name: newName,
        data: pendingImportData
    };
    customSources.push(newCustomSource);
    localStorage.setItem('nav-custom-data-sources', JSON.stringify(customSources));

    // 重新加载并刷新UI
    loadAllDataSources();

    // 导入后，立即切换到这个新的数据源
    performDataSourceSwitch(newName, false, (identifier) => {
        populateDataSourceSelector(); // 在成功后填充，以保证UI正确
        renderNavPage();
        updateDeleteButtonState();
        localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, identifier);
    });

    closeImportNameModal();
    pendingImportData = null;
}
// #endregion

// =========================================================================
// #region 数据源管理
// =========================================================================

/**
 * 删除一个自定义数据源。
 */
export async function handleDeleteSource() {
    const sourceIdentifier = dom.customSelect.dataset.value;
    const source = state.allSiteDataSources.find(s => (s.path || s.name) === sourceIdentifier);

    if (!source || source.path) {
        await showAlert('无法删除内置的默认数据源。');
        return;
    }

    const confirmed = await showConfirm(`确定要删除数据源 "${source.name}" 吗？\n此操作不可撤销。`);
    if (!confirmed) return;

    // 从LocalStorage中删除
    const customSources = getCustomSources();
    const updatedCustomSources = customSources.filter(s => s.name !== source.name);
    localStorage.setItem('nav-custom-data-sources', JSON.stringify(updatedCustomSources));

    // 重新加载数据源列表并切换到默认数据源
    loadAllDataSources();
    const safeSourcePath = DEFAULT_SITES_PATH;
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, safeSourcePath);
    populateDataSourceSelector(); // 更新选择器UI

    performDataSourceSwitch(safeSourcePath, false, () => {
        renderNavPage();
        updateDeleteButtonState();
    });
}
// #endregion

// =========================================================================
// #region 书签HTML解析助手函数
// =========================================================================

/**
 * 根据分类名称生成一个唯一的、URL友好的ID。
 * @param {string} name - 分类名称。
 * @returns {string} - 生成的ID。
 */
function generateCategoryId(name) {
    if (!name || !name.trim()) return `category-${Date.now()}`;
    // 依赖全局的 pinyinConverter
    let pinyinName = pinyinManager.convert(name).full;
    let categoryId = pinyinName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return categoryId || `category-${Date.now()}`;
}

/**
 * 将HTML字符串转换为DOM节点列表。
 * @param {string} text - HTML字符串。
 * @returns {NodeListOf<ChildNode>} - 节点列表。
 */
function textToNodeList(text) {
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.childNodes;
}

/**
 * 在节点列表中找到书签的根 <DL> 节点。
 * @param {NodeListOf<ChildNode>} nodeList - 节点列表。
 * @returns {Node|null} - <DL> 节点或 null。
 */
function getBookmarkNode(nodeList) {
    for (const node of nodeList) {
        if (node.nodeName.toUpperCase() === 'DL') return node;
    }
    return null;
}

/**
 * 获取DOM节点的所有属性。
 * @param {Node} dom - DOM节点。
 * @returns {object|null} - 属性对象或 null。
 */
function getNodeAttrs(dom) {
    if (!dom.attributes) return null;
    let info = {};
    Array.from(dom.attributes).forEach(m => { info[m.name] = m.value; });
    return Object.keys(info).length > 0 ? info : null;
}

/**
 * 将DOM节点递归地转换为JSON对象。
 * @param {Node} dom - DOM节点。
 * @returns {object} - 转换后的JSON对象。
 */
function nodeToJson(dom) {
    const obj = { nodeName: dom.nodeName.toLocaleLowerCase().replace('#', '') };
    const attrs = getNodeAttrs(dom);
    if (attrs) obj.attributes = attrs;

    let childNodes = Array.from(dom.childNodes).filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim().length > 0));
    if (childNodes.length > 0) {
        obj.children = childNodes.map(m => nodeToJson(m));
    }
    if (obj.nodeName === 'text') {
        obj.textContent = dom.textContent.trim().replace(/<[^>]*>/g, '');
    }
    return obj;
}

/**
 * 将原始的书签JSON结构转换为NavHub的嵌套分类格式。
 * @param {object} sourceJson - 从 nodeToJson 生成的JSON。
 * @returns {{categories: Array}} - NavHub格式的JSON。
 */
function transformToNavFormat(sourceJson) {
    function processDlNode(dlNode) {
        if (!dlNode || dlNode.nodeName !== 'dl' || !dlNode.children) return [];
        const results = [];
        for (const dtNode of dlNode.children) {
            if (dtNode.nodeName !== 'dt' || !dtNode.children) continue;
            const contentNode = dtNode.children[0];
            if (!contentNode) continue;

            if (contentNode.nodeName === 'h3') { // 文件夹 -> 分类
                const categoryName = contentNode.children[0]?.textContent || '未命名分类';
                const newCategory = {
                    categoryName: categoryName,
                    categoryId: generateCategoryId(categoryName),
                    sites: []
                };
                const innerDlNode = dtNode.children[1];
                if (innerDlNode && innerDlNode.nodeName === 'dl') {
                    newCategory.sites = processDlNode(innerDlNode);
                }
                results.push(newCategory);
            } else if (contentNode.nodeName === 'a') { // 链接 -> 网站
                results.push({
                    id: `bm-${Date.now()}-${Math.random()}`,
                    title: contentNode.children[0]?.textContent || '无标题',
                    url: contentNode.attributes?.href || '',
                    icon: contentNode.attributes?.icon || '',
                    desc: '',
                    proxy: false,
                });
            }
        }
        return results;
    }

    const topLevelItems = processDlNode(sourceJson);
    const rootCategory = { categoryName: "书签栏", categoryId: "bookmarks-bar", sites: [] };
    const otherCategories = [];

    topLevelItems.forEach(item => {
        if (item.url) rootCategory.sites.push(item);
        else otherCategories.push(item);
    });

    const finalCategories = [];
    if (rootCategory.sites.length > 0) finalCategories.push(rootCategory);
    finalCategories.push(...otherCategories);
    return { categories: finalCategories };
}

/**
 * 将嵌套的分类结构展平为单层分类列表。
 * @param {object} nestedData - transformToNavFormat 生成的嵌套数据。
 * @returns {{categories: Array}} - 展平后的数据。
 */
function flattenNavJson(nestedData) {
    const finalCategories = [];
    function collectCategories(categoriesList) {
        if (!categoriesList) return;
        for (const item of categoriesList) {
            if (!item.categoryName) continue;
            const currentCategory = {
                categoryName: item.categoryName,
                categoryId: item.categoryId || generateCategoryId(item.categoryName),
                sites: []
            };
            const subCategories = [];
            if (item.sites) {
                for (const siteOrCategory of item.sites) {
                    if (siteOrCategory.url) currentCategory.sites.push(siteOrCategory);
                    else if (siteOrCategory.categoryName) subCategories.push(siteOrCategory);
                }
            }
            if (currentCategory.sites.length > 0) finalCategories.push(currentCategory);
            if (subCategories.length > 0) collectCategories(subCategories);
        }
    }
    collectCategories(nestedData.categories);
    return { categories: finalCategories };
}
// #endregion