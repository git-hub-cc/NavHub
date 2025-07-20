// =========================================================================
// main.js - 主程序 / 事件协调器
// 职责: 作为应用的入口点，初始化所有模块，并设置事件监听器。
// 它将用户的交互（如点击、输入）与数据处理和UI更新连接起来，是整个应用的“神经中枢”。
// =========================================================================

import { state, getThemePreference, loadAllDataSources, loadSearchConfig, performDataSourceSwitch, saveNavData, findSiteById, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY, CUSTOM_CATEGORY_ID } from './dataManager.js';
import { dom, applyTheme, populateDataSourceSelector, renderNavPage, updateDeleteButtonState, showAlert, openSiteModal, closeSiteModal, closeImportNameModal, toggleEditMode, toggleDeleteMode, filterNavCards, renderSearchCategories, renderEngineCheckboxes, renderSuggestions, showConfirm } from './ui.js';
import { handleExport, handleImportClick, handleFileSelect, handleImportNameSubmit, handleDeleteSource } from './fileManager.js';

// === 模块内状态 ===
let currentSearchCategory = '';
let suggestions = [];
let suggestionTimer = null;

// =========================================================================
// #region 初始化与事件绑定
// =========================================================================

/**
 * 应用总初始化函数
 */
async function init() {
    // 1. 应用基础样式
    applyTheme(getThemePreference());
    // 2. 加载所有可用数据源的定义（默认+自定义）
    loadAllDataSources();
    // 3. 绑定静态和动态元素的事件监听
    setupStaticEventListeners();
    setupDynamicEventListeners();

    // 4. 确定要加载的数据源
    const lastUsedSource = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;

    // 5. 渲染数据源选择器UI
    populateDataSourceSelector();

    // 6. 并发加载核心数据和资产
    await Promise.all([
        performDataSourceSwitch(lastUsedSource, true, onDataSourceSwitchSuccess, onDataSourceSwitchFail),
        loadSearchConfig(),
        pinyinManager.loadMap('data/pinyin-map.json')
    ]);

    // 7. 初始化依赖于已加载数据的组件
    initEnhancedSearch();
}

/**
 * 绑定不会被重复渲染的静态元素的事件
 */
function setupStaticEventListeners() {
    // 主题切换
    dom.darkModeSwitch.addEventListener('change', () => applyTheme(dom.darkModeSwitch.checked ? 'dark' : 'light'));

    // 自定义数据源选择器
    dom.customSelectTrigger.addEventListener('click', () => {
        dom.customSelect.classList.toggle('open');
    });

    dom.customSelectOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option) {
            e.stopPropagation(); // 防止事件冒泡到 customSelectTrigger
            const newValue = option.dataset.value;
            if (newValue !== dom.customSelect.dataset.value) {
                handleDataSourceChange(newValue);
            }
            dom.customSelect.classList.remove('open');
        }
    });

    // 点击外部区域关闭数据源选择器
    document.addEventListener('click', (e) => {
        if (!dom.customSelect.contains(e.target)) {
            dom.customSelect.classList.remove('open');
        }
    });

    // 导入导出与数据源管理
    dom.exportBtn.addEventListener('click', handleExport);
    dom.importBtn.addEventListener('click', handleImportClick);
    dom.deleteSourceBtn.addEventListener('click', handleDeleteSource);
    dom.importFileInput.addEventListener('change', handleFileSelect);
    dom.importNameForm.addEventListener('submit', handleImportNameSubmit);
    dom.cancelImportNameBtn.addEventListener('click', closeImportNameModal);
    dom.importNameModal.addEventListener('click', e => {
        if (e.target === dom.importNameModal) closeImportNameModal();
    });

    // 网站编辑模态框
    dom.siteForm.addEventListener('submit', handleSiteFormSubmit);
    dom.cancelBtn.addEventListener('click', closeSiteModal);
    dom.siteModal.addEventListener('click', e => {
        if (e.target === dom.siteModal) closeSiteModal();
    });

    // 自动填充图标URL
    dom.siteUrlInput.addEventListener('blur', e => {
        if (dom.siteIconInput.value || !e.target.value) return;
        try {
            const url = new URL(e.target.value);
            dom.siteIconInput.value = `${url.origin}/favicon.ico`;
        } catch (error) {/* 忽略无效URL */ }
    });
}

/**
 * 为动态内容区设置事件监听（例如，通过渲染生成的卡片）
 * 包含完整的拖拽排序和编辑/删除逻辑。
 */
function setupDynamicEventListeners() {
    // 使用事件委托处理所有卡片和按钮的点击事件
    dom.contentWrapper.addEventListener('click', e => {
        const addSiteBtn = e.target.closest('#add-site-btn');
        const editSiteBtn = e.target.closest('#edit-site-btn');
        const deleteSiteBtn = e.target.closest('#delete-site-btn');
        const card = e.target.closest('.card');

        if (addSiteBtn) {
            openSiteModal('add', null, addSiteBtn.dataset.categoryId);
            return;
        }
        if (editSiteBtn) {
            toggleEditMode();
            return;
        }
        if (deleteSiteBtn) {
            toggleDeleteMode();
            return;
        }
        // 处理卡片点击
        if (card) {
            e.preventDefault();
            const isInEditMode = dom.contentWrapper.classList.contains('is-editing');
            const isInDeleteMode = dom.contentWrapper.classList.contains('is-deleting');
            const isEditable = card.closest('.custom-source-section'); // 检查卡片是否属于可编辑区域

            if (isInDeleteMode && isEditable) {
                handleCardDelete(card);
            } else if (isInEditMode && isEditable) {
                const { site } = findSiteById(card.dataset.id);
                if (site) openSiteModal('edit', site);
            } else {
                window.open(card.dataset.url, '_blank');
            }
        }
    });

    // --- 拖拽排序逻辑 ---
    let draggedItem = null, placeholder = null;

    // 步骤1: 拖拽开始，记录被拖拽的卡片并创建占位符
    dom.contentWrapper.addEventListener('dragstart', e => {
        const card = e.target.closest('.card');
        if (card && card.draggable) {
            draggedItem = card;
            placeholder = document.createElement('div');
            placeholder.className = 'placeholder';
            placeholder.style.width = `${draggedItem.offsetWidth}px`;
            placeholder.style.height = `${draggedItem.offsetHeight}px`;
            setTimeout(() => draggedItem.classList.add('dragging'), 0);
        }
    });

    // 步骤2: 拖拽经过，根据鼠标位置移动占位符
    dom.contentWrapper.addEventListener('dragover', e => {
        e.preventDefault();
        if (!draggedItem) return;
        const overCard = e.target.closest('.card:not(.dragging)');
        const overGrid = e.target.closest('.card-grid');
        const overSection = e.target.closest('.custom-source-section');

        // 只允许在可编辑的分类区域内移动
        if (overSection) {
            if (overCard) { // 在卡片上
                const rect = overCard.getBoundingClientRect();
                const midpointY = rect.top + rect.height / 2;
                overCard.parentNode.insertBefore(placeholder, e.clientY < midpointY ? overCard : overCard.nextSibling);
            } else if (overGrid && !overGrid.querySelector('.placeholder')) { // 在网格空白处
                overGrid.appendChild(placeholder);
            }
        }
    });

    // 步骤3: 拖拽释放，更新DOM和数据模型
    dom.contentWrapper.addEventListener('drop', e => {
        e.preventDefault();
        if (!draggedItem || !placeholder || !placeholder.parentNode) return;

        const draggedSiteId = draggedItem.dataset.id;
        const { site: draggedSite, category: sourceCategory } = findSiteById(draggedSiteId);
        const targetSection = placeholder.closest('.custom-source-section');

        if (!draggedSite || !sourceCategory || !targetSection) return;

        const targetCategoryId = targetSection.id;
        const targetCategory = state.siteData.categories.find(c => c.categoryId === targetCategoryId);

        if (!targetCategory) return;

        // 3.1. 更新DOM：用实际卡片替换占位符
        placeholder.parentNode.replaceChild(draggedItem, placeholder);

        // 3.2. 更新数据模型
        // 从源分类中移除
        const sourceSites = sourceCategory.sites;
        const siteIndex = sourceSites.findIndex(s => s.id === draggedSiteId);
        if (siteIndex > -1) sourceSites.splice(siteIndex, 1);

        // 获取目标分类中所有卡片的ID的新顺序
        const newOrderedIds = Array.from(targetSection.querySelectorAll('.card')).map(c => c.dataset.id);

        // 如果是跨分类移动，将被拖动的站点对象添加到目标分类中
        if (sourceCategory.categoryId !== targetCategory.categoryId) {
            targetCategory.sites.push(draggedSite);
        }

        // 根据新的ID顺序重新排序目标分类的站点数组
        targetCategory.sites.sort((a, b) => newOrderedIds.indexOf(a.id) - newOrderedIds.indexOf(b.id));

        // 3.3. 如果源分类变空，并且不是受保护的“我的导航”，则删除它
        if (sourceCategory.sites.length === 0 && sourceCategory.categoryId !== CUSTOM_CATEGORY_ID) {
            state.siteData.categories = state.siteData.categories.filter(c => c.categoryId !== sourceCategory.categoryId);
            renderNavPage(); // 涉及分类删除，需要完全重绘
        }

        saveNavData(dom.customSelect.dataset.value);
    });

    // 步骤4: 拖拽结束，清理状态
    dom.contentWrapper.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        draggedItem = null;
        placeholder = null;
    });
}
// #endregion

// =========================================================================
// #region 事件处理器
// =========================================================================

/**
 * 处理数据源选择变化
 * @param {string} newIdentifier - 新数据源的标识符 (路径或名称)
 */
function handleDataSourceChange(newIdentifier) {
    // 立即更新UI以提供即时反馈
    const option = dom.customSelectOptions.querySelector(`[data-value="${newIdentifier}"]`);
    if (option) {
        dom.customSelectSelectedText.textContent = option.textContent;
        dom.customSelect.dataset.value = newIdentifier;
        const oldSelected = dom.customSelectOptions.querySelector('.selected');
        if (oldSelected) oldSelected.classList.remove('selected');
        option.classList.add('selected');
    }
    // 触发实际的数据加载和渲染
    performDataSourceSwitch(newIdentifier, false, onDataSourceSwitchSuccess, onDataSourceSwitchFail);
}

/**
 * 数据源切换成功后的回调函数
 */
function onDataSourceSwitchSuccess() {
    renderNavPage();
    dom.searchInput.value = '';
    filterNavCards('');
    updateDeleteButtonState();
}

/**
 * 数据源切换失败后的回调函数
 * @param {string} sourceName - 尝试加载的数据源名称
 * @param {Error} error - 发生的错误
 */
function onDataSourceSwitchFail(sourceName, error) {
    showAlert(`加载数据源失败: ${sourceName}\n${error.message}`, '加载错误');
    // 恢复到上次成功加载的数据源
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, state.originalDataSourceValue);
    populateDataSourceSelector(); // 重新渲染选择器以反映正确的状态
}

/**
 * 处理网站编辑/新增表单的提交
 * @param {Event} e - 表单提交事件
 */
async function handleSiteFormSubmit(e) {
    e.preventDefault();

    // 记录提交前的UI模式，以便操作后恢复
    const wasInEditMode = dom.contentWrapper.classList.contains('is-editing');
    const wasInDeleteMode = dom.contentWrapper.classList.contains('is-deleting');

    const siteId = dom.siteIdInput.value;
    const targetCategoryId = dom.categoryIdInput.value;

    const sitePayload = {
        id: siteId || `site-${Date.now()}-${Math.random()}`,
        url: dom.siteUrlInput.value,
        title: dom.siteTitleInput.value,
        icon: dom.siteIconInput.value,
        desc: dom.siteDescInput.value,
        proxy: dom.siteProxyInput.checked
    };

    let targetCategory = state.siteData.categories.find(c => c.categoryId === targetCategoryId);

    if (siteId) { // 编辑模式
        const { site } = findSiteById(siteId);
        if (site) Object.assign(site, sitePayload);
    } else if (targetCategory) { // 新增模式
        targetCategory.sites.unshift(sitePayload);
    } else {
        showAlert(`操作失败：找不到目标分类 (ID: ${targetCategoryId})`, '错误');
        closeSiteModal();
        return;
    }

    saveNavData(dom.customSelect.dataset.value);

    // 重新渲染前，暂时移除模式类，防止 toggle 函数行为异常
    dom.contentWrapper.classList.remove('is-editing', 'is-deleting');

    renderNavPage(); // 重新渲染UI以反映数据变化
    closeSiteModal();

    // 如果之前处于编辑/删除模式，则恢复该模式
    if (wasInEditMode) toggleEditMode();
    if (wasInDeleteMode) toggleDeleteMode();

    filterNavCards(dom.searchInput.value); // 保持搜索过滤结果
}


/**
 * 处理网站卡片的删除操作
 * @param {HTMLElement} cardElement - 被点击删除的卡片元素
 */
async function handleCardDelete(cardElement) {
    const siteId = cardElement.dataset.id;
    const { site, category } = findSiteById(siteId);

    if (!site || !category) return;

    const confirmed = await showConfirm(`确定要删除网站 "${site.title}" 吗?`, "删除确认");
    if (!confirmed) return;

    // 1. 从数据模型中删除
    category.sites = category.sites.filter(s => s.id !== siteId);

    // 2. 检查分类是否变空
    if (category.sites.length === 0 && category.categoryId !== CUSTOM_CATEGORY_ID) {
        // 如果非保护分类变空，则删除整个分类
        state.siteData.categories = state.siteData.categories.filter(c => c.categoryId !== category.categoryId);
        // 检查是否所有分类都被删除了
        if (state.siteData.categories.length === 0) {
            // 如果是，则自动添加一个空的“我的导航”作为回退
            state.siteData.categories.push({
                categoryName: '我的导航',
                categoryId: CUSTOM_CATEGORY_ID,
                sites: []
            });
        }
        renderNavPage(); // 因为分类结构改变，需要完全重绘
    } else {
        // 否则，只需从DOM中移除卡片
        cardElement.remove();
    }

    saveNavData(dom.customSelect.dataset.value);
}
// #endregion

// =========================================================================
// #region 增强搜索逻辑
// =========================================================================

/**
 * 初始化搜索相关的功能
 */
function initEnhancedSearch() {
    renderSearchCategories();
    if (state.searchConfig.categories.length > 0) {
        selectSearchCategory(state.searchConfig.categories[0].value);
    }
    dom.searchForm.addEventListener('submit', handleSearchSubmit);
    dom.searchInput.addEventListener('input', handleSuggestionInput);
    dom.suggestionsList.addEventListener('mouseleave', startSuggestionTimer);
    dom.suggestionsList.addEventListener('mouseenter', clearSuggestionTimer);
    document.addEventListener('click', e => {
        if (!dom.searchForm.contains(e.target) && !dom.suggestionsList.contains(e.target)) {
            suggestions = [];
            renderSuggestions(suggestions);
        }
    });
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            suggestions = [];
            renderSuggestions(suggestions);
        }
    });
    dom.searchCategoryButtonsContainer.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            selectSearchCategory(e.target.dataset.value);
        }
    });
}

/**
 * 选中一个搜索类别，并更新UI
 * @param {string} categoryValue - 搜索类别的值
 */
function selectSearchCategory(categoryValue) {
    currentSearchCategory = categoryValue;
    const buttons = dom.searchCategoryButtonsContainer.querySelectorAll('.category-btn');
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === categoryValue));
    renderEngineCheckboxes(currentSearchCategory);
}

/**
 * 处理搜索表单提交
 * @param {Event} e - 提交事件
 */
function handleSearchSubmit(e) {
    e.preventDefault();
    const query = dom.searchInput.value.trim();
    const checkedEngines = dom.searchEngineCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');

    if (query === '' && checkedEngines.length > 0) {
        // 空搜索，则打开第一个选中的搜索引擎主页
        const firstEngineUrl = new URL(checkedEngines[0].value.replace('%s', ''));
        window.open(firstEngineUrl.origin, "_blank");
        return;
    }
    if (checkedEngines.length === 0) {
        showAlert('请至少选择一个搜索引擎！');
        return;
    }
    checkedEngines.forEach(engineCheckbox => {
        const searchUrl = engineCheckbox.value.replaceAll('%s', encodeURIComponent(query));
        window.open(searchUrl, '_blank');
    });
    suggestions = [];
    renderSuggestions(suggestions);
}

/**
 * 处理搜索框输入，获取建议并过滤导航卡片
 */
function handleSuggestionInput() {
    const query = dom.searchInput.value.trim();
    filterNavCards(query); // 实时过滤站内导航
    if (query !== '') {
        // 使用JSONP从百度获取搜索建议
        const script = document.createElement('script');
        script.src = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&cb=window.baidu.sug`;
        document.body.appendChild(script);
        script.onload = () => document.body.removeChild(script);
        script.onerror = () => document.body.removeChild(script);
    } else {
        suggestions = [];
        renderSuggestions(suggestions);
    }
    clearSuggestionTimer();
    startSuggestionTimer();
}

/**
 * 全局回调函数，用于接收百度的搜索建议
 * @type {{sug: function(object): void}}
 */
window.baidu = {
    sug: data => {
        suggestions = (data && Array.isArray(data.s)) ? data.s : [];
        renderSuggestions(suggestions);
        dom.suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                dom.searchInput.value = item.textContent;
                suggestions = [];
                renderSuggestions(suggestions);
                dom.searchInput.focus();
                filterNavCards(dom.searchInput.value);
            });
        });
    }
};

/**
 * 启动一个计时器，在3秒后自动隐藏建议列表
 */
function startSuggestionTimer() {
    clearSuggestionTimer();
    suggestionTimer = setTimeout(() => {
        suggestions = [];
        renderSuggestions(suggestions);
    }, 3000);
}

/**
 * 清除建议列表的隐藏计时器
 */
function clearSuggestionTimer() {
    clearTimeout(suggestionTimer);
}
// #endregion

// === 启动应用 ===
document.addEventListener('DOMContentLoaded', init);