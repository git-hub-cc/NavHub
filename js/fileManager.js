// =========================================================================
// fileManager.js - 导入/导出模块
// 职责: 封装所有与数据导入、导出相关的复杂逻辑。
// 包括：导出JSON文件、处理文件导入（JSON和HTML书签）、解析HTML书签、管理自定义数据源（新增、删除）。
// =========================================================================

import { state, getCustomSources, loadAllDataSources, saveNavData, performDataSourceSwitch, CUSTOM_CATEGORY_ID, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY, NAV_CUSTOM_SOURCES_KEY } from './dataManager.js';
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
            // 注意：这里使用了一个简单的ID生成器，因为我们移除了拼音管理器
            category.categoryId = `category-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            console.warn(`[Export] 为分类 "${category.categoryName}" 添加了缺失的 categoryId: ${category.categoryId}`);
        }
        if (category.sites && Array.isArray(category.sites)) {
            category.sites.forEach(site => {
                if (!site.id) {
                    site.id = `site-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                    console.warn(`[Export] 为网站 "${site.title}" 添加了缺失的 id: ${site.id}`);
                }
            });
        }
    });

    // 导出时不应包含任何空的分类，除非它是受保护的“我的导航”
    dataToExport.categories = dataToExport.categories.filter(c => (c.sites && c.sites.length > 0) || c.categoryId === CUSTOM_CATEGORY_ID);

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
    if (!pendingImportData) return;

    const importMode = dom.importNameForm.querySelector('input[name="import-mode"]:checked').value;

    if (importMode === 'new-source') {
        // --- 逻辑分支1: 作为新的数据源导入 ---
        const newName = dom.importNameInput.value.trim();
        if (!newName) {
            dom.importNameError.textContent = '请输入数据源名称。';
            dom.importNameError.style.display = 'block';
            return;
        }

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
        localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(customSources));

        loadAllDataSources();
        performDataSourceSwitch(newName, false, (identifier) => {
            populateDataSourceSelector();
            renderNavPage();
            updateDeleteButtonState();
            localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, identifier);
        });

    } else if (importMode === 'merge-to-custom') {
        // --- 逻辑分支2: 合并到“我的导航” ---
        let customCategory = state.siteData.categories.find(c => c.categoryId === CUSTOM_CATEGORY_ID);
        // 如果当前数据中没有“我的导航”分类，则创建一个
        if (!customCategory) {
            customCategory = {
                categoryName: '我的导航',
                categoryId: CUSTOM_CATEGORY_ID,
                sites: []
            };
            state.siteData.categories.unshift(customCategory);
        }

        // 遍历导入的数据，将所有网站追加到“我的导航”中
        pendingImportData.categories.forEach(importedCategory => {
            if (importedCategory.sites && importedCategory.sites.length > 0) {
                customCategory.sites.push(...importedCategory.sites);
            }
        });

        // 保存更改并刷新UI
        const currentSourceIdentifier = dom.customSelect.dataset.value;
        saveNavData(currentSourceIdentifier);
        renderNavPage();
        showAlert('书签已成功添加到“我的导航”分类中。', '导入成功');
    }

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
    localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(updatedCustomSources));

    // 重新加载数据源列表并切换到默认数据源
    loadAllDataSources();
    const safeSourcePath = DEFAULT_SITES_PATH;
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, safeSourcePath);

    // 手动更新选择器UI并执行切换
    handleDataSourceChange(safeSourcePath);
}

/**
 * 辅助函数，用于在删除源后手动触发数据源切换和UI更新。
 * （此函数在handleDeleteSource中使用，因为performDataSourceSwitch本身不会更新选择器显示）
 */
function handleDataSourceChange(newIdentifier) {
    const option = dom.customSelectOptions.querySelector(`[data-value="${newIdentifier}"]`);
    if (option) {
        dom.customSelectSelectedText.textContent = option.textContent;
        dom.customSelect.dataset.value = newIdentifier;
        const oldSelected = dom.customSelectOptions.querySelector('.selected');
        if (oldSelected) oldSelected.classList.remove('selected');
        option.classList.add('selected');
    }
    performDataSourceSwitch(newIdentifier, false, () => {
        renderNavPage();
        updateDeleteButtonState();
    });
}
// #endregion

// =========================================================================
// #region 书签HTML解析助手函数 (已移除拼音依赖)
// =========================================================================

/**
 * 根据分类名称生成一个唯一的ID。
 * @param {string} name - 分类名称。
 * @returns {string} - 生成的ID。
 */
function generateCategoryId(name) {
    // 使用时间戳和随机数生成唯一ID，不依赖拼音转换
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

    if (!name || !name.trim()) {
        return `category-untitled-${uniqueSuffix}`;
    }

    // 将名称简单化处理为基础ID
    let baseId = name
        .replace(/\s+/g, '-') // 将空格替换为连字符
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, ''); // 移除非中英文字符、数字、连字符

    // 截断过长的ID并拼接唯一后缀
    return `${baseId.substring(0, 50)}-${uniqueSuffix}`;
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
                const url = contentNode.attributes?.href || '';
                // 如果URL长度超过2000字符，则大概率不是一个有效的网站链接（可能是data URI），予以忽略。
                if (url.length > 2000) {
                    console.warn(`[Import] 已忽略一个URL超长的书签 (长度: ${url.length}): "${contentNode.children[0]?.textContent || '无标题'}"`);
                    continue; // 跳过此条目
                }
                // 新标签页。
                if (url === "chrome-native://newtab/") {
                    console.warn(`[Import] 已忽略一个URL特殊的书签 newtab"`);
                    continue; // 跳过此条目
                }

                results.push({
                    id: `bm-${Date.now()}-${Math.random()}`,
                    title: contentNode.children[0]?.textContent || '无标题',
                    url: url,
                    icon: contentNode.attributes?.icon || '',
                    desc: '',
                    proxy: false,
                });
            }
        }
        return results;
    }

    const topLevelItems = processDlNode(sourceJson);
    const topLevelSites = [];
    const otherCategories = [];

    // 分离顶层书签和文件夹
    topLevelItems.forEach(item => {
        if (item.url) { // 是一个网站
            topLevelSites.push(item);
        } else if (item.categoryName) { // 是一个分类(文件夹)
            otherCategories.push(item);
        }
    });

    // 为了避免数据丢失，智能地处理顶层书签
    if (topLevelSites.length > 0) {
        if (otherCategories.length > 0) {
            // 如果存在其他文件夹，则将顶层书签合并到第一个文件夹中
            otherCategories[0].sites.unshift(...topLevelSites);
        } else {
            // 如果只有顶层书签，则为它们创建一个新的分类
            otherCategories.push({
                categoryName: '导入的书签',
                categoryId: generateCategoryId('导入的书签'),
                sites: topLevelSites
            });
        }
    }

    return { categories: otherCategories };
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