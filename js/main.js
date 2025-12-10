// =========================================================================
// main.js - 主程序 / 事件协调器 (适配新设计)
// =========================================================================

import { state, getThemePreference, getProxyMode, setProxyMode, loadAllDataSources, loadSearchConfig, performDataSourceSwitch, saveNavData, findSiteById, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY, CUSTOM_CATEGORY_ID } from './dataManager.js';
import { dom, applyTheme, applyProxyMode, populateDataSourceSelector, renderNavPage, updateDeleteButtonState, showAlert, openSiteModal, closeSiteModal, closeImportNameModal, toggleEditMode, toggleDeleteMode, filterNavCards, renderSearchCategories, renderEngineCheckboxes, renderSuggestions, showConfirm, toggleMobileSidebar, closeMobileSidebar, isolateSidebarScroll } from './ui.js';
import { handleExport, handleImportClick, handleFileSelect, handleImportNameSubmit, handleDeleteSource } from './fileManager.js';

let currentSearchCategory = '';
let suggestions = [];
let suggestionTimer = null;

// =========================================================================
// #region 初始化与事件绑定
// =========================================================================

async function init() {
    // 1. 初始化偏好 (主题 + 代理模式)
    applyTheme(getThemePreference());
    applyProxyMode(getProxyMode()); // 【新增】初始化代理模式显示

    loadAllDataSources();
    setupStaticEventListeners();
    setupDynamicEventListeners();

    const lastUsedSource = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;
    populateDataSourceSelector();

    await Promise.all([
        performDataSourceSwitch(lastUsedSource, true, onDataSourceSwitchSuccess, onDataSourceSwitchFail),
        loadSearchConfig(),
        // 确保 pinyinManager 已加载
        (window.pinyinManager ? window.pinyinManager.loadMap('data/pinyin-map.json') : Promise.resolve())
    ]);

    initEnhancedSearch();
}

function setupStaticEventListeners() {
    // 移动端菜单控制
    if (dom.mobileMenuBtn) {
        dom.mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileSidebar();
        });
    }
    // 点击遮罩层关闭侧边栏
    if (dom.sidebarOverlay) {
        dom.sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // 初始化侧边栏滚动隔离，防止干扰主页面滚动
    isolateSidebarScroll();

    // 主题切换
    dom.darkModeSwitch.addEventListener('change', () => applyTheme(dom.darkModeSwitch.checked ? 'dark' : 'light'));

    // 【新增】代理模式切换
    if (dom.proxyModeSwitch) {
        dom.proxyModeSwitch.addEventListener('change', () => {
            const isChecked = dom.proxyModeSwitch.checked;
            applyProxyMode(isChecked);
            setProxyMode(isChecked);
            // 切换模式后，必须重新渲染搜索引擎复选框，因为它们被过滤了
            renderEngineCheckboxes(currentSearchCategory);
        });
    }

    // 自定义数据源选择器
    dom.customSelectTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.customSelect.classList.toggle('open');
    });

    dom.customSelectOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option) {
            e.stopPropagation();
            const newValue = option.dataset.value;
            if (newValue !== dom.customSelect.dataset.value) {
                handleDataSourceChange(newValue);
            }
            dom.customSelect.classList.remove('open');
        }
    });

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
        } catch (error) {}
    });
}

function setupDynamicEventListeners() {
    dom.contentWrapper.addEventListener('click', e => {
        // 使用 class 选择器捕获新增按钮
        const addSiteBtn = e.target.closest('.add-site-btn');
        const editSiteBtn = e.target.closest('#edit-site-btn');
        const deleteSiteBtn = e.target.closest('#delete-site-btn');
        const card = e.target.closest('.card');

        // 1. 点击“新增”按钮
        if (addSiteBtn) {
            const categoryId = addSiteBtn.dataset.categoryId;
            // 获取分类名称，避免 ID 重复导致显示错误
            const categoryName = addSiteBtn.dataset.categoryName;
            // 传入 categoryName 作为第四个参数
            openSiteModal('add', null, categoryId, categoryName);
            return;
        }

        // 2. 点击分类标题栏的“编辑”按钮
        if (editSiteBtn) {
            toggleEditMode();
            return;
        }

        // 3. 点击分类标题栏的“删除”按钮
        if (deleteSiteBtn) {
            toggleDeleteMode();
            return;
        }

        // 4. 点击具体卡片
        if (card) {
            e.preventDefault();
            const isInEditMode = dom.contentWrapper.classList.contains('is-editing');
            const isInDeleteMode = dom.contentWrapper.classList.contains('is-deleting');
            const isEditable = card.closest('.custom-source-section');

            if (isInDeleteMode && isEditable) {
                handleCardDelete(card);
            } else if (isInEditMode && isEditable) {
                // 编辑卡片时，同时获取 site 和 category
                const { site, category } = findSiteById(card.dataset.id);
                if (site && category) {
                    // 传入 category.categoryName
                    openSiteModal('edit', site, category.categoryId, category.categoryName);
                }
            } else {
                window.open(card.dataset.url, '_blank');
            }
        }
    });

    // --- 拖拽排序逻辑 ---
    let draggedItem = null, placeholder = null;

    dom.contentWrapper.addEventListener('dragstart', e => {
        const card = e.target.closest('.card');
        if (card && card.draggable) {
            draggedItem = card;
            placeholder = document.createElement('div');
            placeholder.className = 'placeholder';
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
                const midpointX = rect.left + rect.width / 2;

                const isAfter = (e.clientY > midpointY) || (e.clientX > midpointX && Math.abs(e.clientY - midpointY) < 50);

                overCard.parentNode.insertBefore(placeholder, isAfter ? overCard.nextSibling : overCard);
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

        placeholder.parentNode.replaceChild(draggedItem, placeholder);

        const sourceSites = sourceCategory.sites;
        const siteIndex = sourceSites.findIndex(s => s.id === draggedSiteId);
        if (siteIndex > -1) sourceSites.splice(siteIndex, 1);

        const newOrderedIds = Array.from(targetSection.querySelectorAll('.card')).map(c => c.dataset.id);

        if (sourceCategory.categoryId !== targetCategory.categoryId) {
            targetCategory.sites.push(draggedSite);
        }

        targetCategory.sites.sort((a, b) => newOrderedIds.indexOf(a.id) - newOrderedIds.indexOf(b.id));

        if (sourceCategory.sites.length === 0 && sourceCategory.categoryId !== CUSTOM_CATEGORY_ID) {
            state.siteData.categories = state.siteData.categories.filter(c => c.categoryId !== sourceCategory.categoryId);
            renderNavPage();
        }

        saveNavData(dom.customSelect.dataset.value);
    });

    dom.contentWrapper.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        draggedItem = null;
        placeholder = null;
    });
}

// =========================================================================
// #region 事件处理器
// =========================================================================

function handleDataSourceChange(newIdentifier) {
    const option = dom.customSelectOptions.querySelector(`[data-value="${newIdentifier}"]`);
    if (option) {
        dom.customSelectSelectedText.textContent = option.textContent;
        dom.customSelect.dataset.value = newIdentifier;
        const oldSelected = dom.customSelectOptions.querySelector('.selected');
        if (oldSelected) oldSelected.classList.remove('selected');
        option.classList.add('selected');
    }
    performDataSourceSwitch(newIdentifier, false, onDataSourceSwitchSuccess, onDataSourceSwitchFail);
}

function onDataSourceSwitchSuccess() {
    renderNavPage();
    dom.searchInput.value = '';
    filterNavCards('');
    updateDeleteButtonState();
    if (window.innerWidth <= 768) closeMobileSidebar();
}

function onDataSourceSwitchFail(sourceName, error) {
    showAlert(`加载数据源失败: ${sourceName}\n${error.message}`, '加载错误');
    localStorage.setItem(NAV_DATA_SOURCE_PREFERENCE_KEY, state.originalDataSourceValue);
    populateDataSourceSelector();
}

async function handleSiteFormSubmit(e) {
    e.preventDefault();
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

    if (siteId) {
        const { site } = findSiteById(siteId);
        if (site) {
            Object.assign(site, sitePayload);
        } else {
            if (targetCategory) targetCategory.sites.unshift(sitePayload);
        }
    } else {
        if (targetCategory) {
            targetCategory.sites.unshift(sitePayload);
        } else {
            showAlert(`操作失败：找不到目标分类 (ID: ${targetCategoryId})`, '错误');
            closeSiteModal();
            return;
        }
    }

    saveNavData(dom.customSelect.dataset.value);

    dom.contentWrapper.classList.remove('is-editing', 'is-deleting');
    renderNavPage();
    closeSiteModal();

    if (wasInEditMode) toggleEditMode();
    if (wasInDeleteMode) toggleDeleteMode();
    filterNavCards(dom.searchInput.value);
}

async function handleCardDelete(cardElement) {
    const siteId = cardElement.dataset.id;
    const { site, category } = findSiteById(siteId);

    if (!site || !category) return;

    const confirmed = await showConfirm(`确定要删除网站 "${site.title}" 吗?`, "删除确认");
    if (!confirmed) return;

    category.sites = category.sites.filter(s => s.id !== siteId);

    if (category.sites.length === 0 && category.categoryId !== CUSTOM_CATEGORY_ID) {
        state.siteData.categories = state.siteData.categories.filter(c => c.categoryId !== category.categoryId);
        if (state.siteData.categories.length === 0) {
            state.siteData.categories.push({
                categoryName: '我的导航',
                categoryId: CUSTOM_CATEGORY_ID,
                sites: []
            });
        }
        renderNavPage();
    } else {
        cardElement.remove();
    }

    saveNavData(dom.customSelect.dataset.value);
}

// =========================================================================
// #region 增强搜索逻辑
// =========================================================================

function initEnhancedSearch() {
    renderSearchCategories();
    if (state.searchConfig.categories.length > 0) {
        selectSearchCategory(state.searchConfig.categories[0].value);
    }
    dom.searchForm.addEventListener('submit', handleSearchSubmit);
    dom.searchInput.addEventListener('input', handleSuggestionInput);

    dom.searchInput.addEventListener('focus', () => {
        dom.searchForm.classList.add('focused');
        document.body.classList.add('search-focused');
    });
    dom.searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            dom.searchForm.classList.remove('focused');
            document.body.classList.remove('search-focused');
        }, 200);
    });

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
            dom.searchInput.blur();
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
    dom.searchInput.blur();
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