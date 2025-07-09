// =========================================================================
// main.js - 主程序 / 事件协调器
// 职责: 作为应用的入口点，初始化所有模块，并设置事件监听器。
// 它将用户的交互（如点击、输入）与数据处理和UI更新连接起来，是整个应用的“神经中枢”。
// =========================================================================

import { state, getThemePreference, loadAllDataSources, loadSearchConfig, performDataSourceSwitch, saveNavData, findSiteById, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY, CUSTOM_CATEGORY_ID } from './data.js';
import { dom, applyTheme, populateDataSourceSelector, renderNavPage, updateDeleteButtonState, showAlert, openSiteModal, closeSiteModal, closeImportNameModal, toggleEditMode, toggleDeleteMode, filterNavCards, renderSearchCategories, renderEngineCheckboxes, renderSuggestions, showConfirm } from './ui.js';
import { handleExport, handleImportClick, handleFileSelect, handleImportNameSubmit, handleDeleteSource } from './import-export.js';

// === 应用状态 (主要用于本模块内的交互) ===
let currentSearchCategory = '';
let suggestions = [];
let suggestionTimer = null;

// === 初始化与事件绑定 ===

/**
 * 应用总初始化函数
 */
async function init() {
    // 1. 应用基础样式和数据
    applyTheme(getThemePreference());
    loadAllDataSources();

    // 2. 绑定静态元素的事件监听
    setupStaticEventListeners();

    // 3. 动态内容区的事件监听（使用事件委托）
    setupDynamicEventListeners();

    // 4. 并发加载核心数据
    const lastUsedSource = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;

    // 提前填充选择器，这样即使用户网络慢，也能看到选项
    populateDataSourceSelector();
    if(lastUsedSource) dom.dataSourceSelect.value = lastUsedSource;

    await Promise.all([
        performDataSourceSwitch(lastUsedSource, true, onDataSourceSwitchSuccess, onDataSourceSwitchFail),
        loadSearchConfig(),
        pinyinConverter.loadMap('data/pinyin-map.json')
    ]);

    // 5. 初始化依赖于数据的组件
    initEnhancedSearch();
}

/**
 * 绑定不会被重复渲染的静态元素的事件
 */
function setupStaticEventListeners() {
    dom.darkModeSwitch.addEventListener('change', () => applyTheme(dom.darkModeSwitch.checked ? 'dark' : 'light'));
    dom.dataSourceSelect.addEventListener('change', handleDataSourceChange);
    dom.exportBtn.addEventListener('click', handleExport);
    dom.importBtn.addEventListener('click', handleImportClick);
    dom.deleteSourceBtn.addEventListener('click', handleDeleteSource);
    dom.importFileInput.addEventListener('change', handleFileSelect);
    dom.importNameForm.addEventListener('submit', handleImportNameSubmit);
    dom.cancelImportNameBtn.addEventListener('click', closeImportNameModal);
    dom.importNameModal.addEventListener('click', e => {
        if (e.target === dom.importNameModal) closeImportNameModal();
    });
    dom.siteForm.addEventListener('submit', handleSiteFormSubmit);
    dom.cancelBtn.addEventListener('click', closeSiteModal);
    dom.siteModal.addEventListener('click', e => {
        if (e.target === dom.siteModal) closeSiteModal();
    });
    dom.siteUrlInput.addEventListener('blur', e => {
        if (dom.siteIconInput.value || !e.target.value) return;
        try {
            const url = new URL(e.target.value);
            dom.siteIconInput.value = `${url.origin}/favicon.ico`;
        } catch (error) {/* 忽略无效URL */ }
    });
}

/**
 * --- MODIFICATION ---
 * 为动态内容区设置事件监听，拖拽逻辑被完全重构以支持通用编辑。
 */
function setupDynamicEventListeners() {
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
        if (card) {
            e.preventDefault();
            const isInEditMode = dom.contentWrapper.classList.contains('is-editing');
            const isInDeleteMode = dom.contentWrapper.classList.contains('is-deleting');
            const isEditable = card.closest('.custom-source-section');

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

    let draggedItem = null, placeholder = null;
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

    dom.contentWrapper.addEventListener('dragover', e => {
        e.preventDefault();
        if (!draggedItem) return;
        const overCard = e.target.closest('.card:not(.dragging)');
        const overGrid = e.target.closest('.card-grid');
        const overSection = e.target.closest('.custom-source-section');

        if (overSection) {
            if (overCard) {
                const rect = overCard.getBoundingClientRect();
                const midpointY = rect.top + rect.height / 2;
                overCard.parentNode.insertBefore(placeholder, e.clientY < midpointY ? overCard : overCard.nextSibling);
            } else if (overGrid && !overGrid.querySelector('.placeholder')) {
                overGrid.appendChild(placeholder);
            }
        }
    });

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

        // 1. 从DOM中放置卡片
        placeholder.parentNode.replaceChild(draggedItem, placeholder);

        // 2. 更新数据模型
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

        // 3. 如果源分类变空，并且不是“我的导航”，则删除它
        if (sourceCategory.sites.length === 0 && sourceCategory.categoryId !== CUSTOM_CATEGORY_ID) {
            state.siteData.categories = state.siteData.categories.filter(c => c.categoryId !== sourceCategory.categoryId);
            document.getElementById(sourceCategory.categoryId)?.remove();
            dom.categoryList.querySelector(`a[href="#${sourceCategory.categoryId}"]`)?.remove();
        }

        saveNavData();
    });

    dom.contentWrapper.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        draggedItem = null;
        placeholder = null;
    });
}


// === 事件处理器 ===

function handleDataSourceChange(e) {
    const newIdentifier = e.target.value;
    performDataSourceSwitch(newIdentifier, false, onDataSourceSwitchSuccess, onDataSourceSwitchFail);
}

function onDataSourceSwitchSuccess(identifier) {
    // 确保在成功回调后，select的值是正确的
    if (dom.dataSourceSelect) dom.dataSourceSelect.value = identifier;
    renderNavPage();
    dom.searchInput.value = '';
    filterNavCards('');
    updateDeleteButtonState();
}

function onDataSourceSwitchFail(sourceName, error) {
    showAlert(`加载数据源失败: ${sourceName}\n${error.message}`, '加载错误');
    if (dom.dataSourceSelect) dom.dataSourceSelect.value = state.originalDataSourceValue;
    updateDeleteButtonState();
}

/**
 * --- MODIFICATION ---
 * 处理网站表单提交，并在保存后保持当前的编辑/删除模式。
 */
async function handleSiteFormSubmit(e) {
    e.preventDefault();

    // 1. 记录当前的UI模式
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
    } else if(targetCategory) { // 新增模式
        targetCategory.sites.unshift(sitePayload);
    } else {
        // 如果找不到分类，则不执行任何操作
        showAlert(`无法找到分类ID: ${targetCategoryId}`, '错误');
        closeSiteModal();
        return;
    }

    saveNavData();

    // 2. 在重新渲染之前，暂时移除模式类，以避免toggle函数行为不正确
    if (wasInEditMode) dom.contentWrapper.classList.remove('is-editing');
    if (wasInDeleteMode) dom.contentWrapper.classList.remove('is-deleting');

    renderNavPage(); // 重新渲染UI
    closeSiteModal();

    // 3. 如果之前在某个模式下，则通过调用toggle函数重新进入该模式
    // 这将正确地将所有UI元素（按钮文本、卡片动画等）设置为该模式的状态
    if (wasInEditMode) toggleEditMode();
    if (wasInDeleteMode) toggleDeleteMode();

    filterNavCards(dom.searchInput.value);
}


/**
 * --- MODIFICATION ---
 * 处理卡片删除，并增加空分类自动删除逻辑和“我的导航”回退逻辑。
 */
async function handleCardDelete(cardElement) {
    const siteId = cardElement.dataset.id;
    const { site, category } = findSiteById(siteId);

    if (!site || !category) return;

    const confirmed = await showConfirm(`确定要删除网站 "${site.title}" 吗?`, "删除确认");
    if (!confirmed) return;

    // 从数据模型中删除
    category.sites = category.sites.filter(s => s.id !== siteId);

    let needsRerender = false;

    // 如果分类为空，并且不是受保护的“我的导航”，则删除整个分类
    if (category.sites.length === 0 && category.categoryId !== CUSTOM_CATEGORY_ID) {
        state.siteData.categories = state.siteData.categories.filter(c => c.categoryId !== category.categoryId);

        // 检查是否所有分类都被删除了
        if (state.siteData.categories.length === 0) {
            state.siteData.categories.push({
                categoryName: '我的导航',
                categoryId: CUSTOM_CATEGORY_ID,
                sites: []
            });
            needsRerender = true; // 需要完全重绘以显示新的“我的导航”
        }
    }

    if (needsRerender) {
        renderNavPage();
    } else {
        // 否则，只需从DOM中移除卡片和可能的空分类
        if (category.sites.length === 0 && category.categoryId !== CUSTOM_CATEGORY_ID) {
            document.getElementById(category.categoryId)?.remove();
            dom.categoryList.querySelector(`a[href="#${category.categoryId}"]`)?.remove();
        } else {
            cardElement.remove();
        }
    }

    saveNavData();
}

// === 增强搜索逻辑 === (无改动，保持原样)
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
        if (e.target !== dom.searchInput && !dom.suggestionsList.contains(e.target)) {
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
function selectSearchCategory(categoryValue) {
    currentSearchCategory = categoryValue;
    const buttons = dom.searchCategoryButtonsContainer.querySelectorAll('.category-btn');
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === categoryValue));
    renderEngineCheckboxes(currentSearchCategory);
}
function handleSearchSubmit(e) {
    e.preventDefault();
    const query = dom.searchInput.value.trim();
    const checkedEngines = dom.searchEngineCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    if (query === '' && checkedEngines.length > 0) {
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
function handleSuggestionInput() {
    const query = dom.searchInput.value.trim();
    filterNavCards(query);
    if (query !== '') {
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
function startSuggestionTimer() {
    clearSuggestionTimer();
    suggestionTimer = setTimeout(() => {
        suggestions = [];
        renderSuggestions(suggestions);
    }, 3000);
}
function clearSuggestionTimer() {
    clearTimeout(suggestionTimer);
}

// === 启动应用 ===
document.addEventListener('DOMContentLoaded', init);