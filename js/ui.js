// =========================================================================
// ui.js - UI管理器
// 职责: 负责所有与DOM渲染和界面交互相关的任务。
// 包括：缓存DOM元素、渲染导航卡片和分类、控制模态框、更新UI状态（如主题、编辑模式）等。
// =========================================================================

import { state, CUSTOM_CATEGORY_ID, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY } from './dataManager.js';

// === DOM 元素缓存 ===
export const dom = {
    darkModeSwitch: document.getElementById('dark-mode-switch'),
    categoryList: document.querySelector('.category-list'),
    contentWrapper: document.getElementById('content-wrapper'),
    // 自定义选择器元素
    customSelect: document.getElementById('custom-select'),
    customSelectTrigger: document.getElementById('custom-select-trigger'),
    customSelectSelectedText: document.getElementById('custom-select-selected-text'),
    customSelectOptions: document.getElementById('custom-select-options'),
    // 功能按钮
    importBtn: document.getElementById('import-btn'),
    exportBtn: document.getElementById('export-btn'),
    deleteSourceBtn: document.getElementById('delete-source-btn'),
    // 导入模态框
    importFileInput: document.getElementById('import-file-input'),
    importNameModal: document.getElementById('import-name-modal'),
    importNameForm: document.getElementById('import-name-form'),
    importNameInput: document.getElementById('import-name-input'),
    importNameError: document.getElementById('import-name-error'),
    cancelImportNameBtn: document.getElementById('cancel-import-name-btn'),
    // 网站编辑模态框
    siteModal: document.getElementById('site-modal'),
    modalTitle: document.getElementById('modal-title'),
    siteForm: document.getElementById('site-form'),
    cancelBtn: document.getElementById('cancel-btn'),
    siteIdInput: document.getElementById('site-id'),
    categoryIdInput: document.getElementById('category-id'),
    siteUrlInput: document.getElementById('site-url'),
    siteTitleInput: document.getElementById('site-title'),
    siteIconInput: document.getElementById('site-icon'),
    siteDescInput: document.getElementById('site-desc'),
    siteProxyInput: document.getElementById('site-proxy'),
    // 搜索区
    searchCategoryButtonsContainer: document.getElementById('search-category-buttons'),
    searchEngineCheckboxesContainer: document.getElementById('search-engine-checkboxes'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    suggestionsList: document.getElementById('suggestions-list'),
    // 通用确认/提示模态框
    alertConfirmModal: document.getElementById('alert-confirm-modal'),
    alertConfirmTitle: document.getElementById('alert-confirm-title'),
    alertConfirmMessage: document.getElementById('alert-confirm-message'),
    alertConfirmOkBtn: document.getElementById('alert-confirm-ok-btn'),
    alertConfirmCancelBtn: document.getElementById('alert-confirm-cancel-btn'),
};

// =========================================================================
// #region 模态框与对话框
// =========================================================================

/**
 * 显示一个模态框。
 * @param {HTMLElement} modalElement - 要显示的模态框元素。
 */
function showModal(modalElement) {
    modalElement.classList.remove('modal-hidden');
}

/**
 * 隐藏一个模态框。
 * @param {HTMLElement} modalElement - 要隐藏的模态框元素。
 */
function hideModal(modalElement) {
    modalElement.classList.add('modal-hidden');
}

/**
 * 显示一个通用对话框（Alert 或 Confirm 的内部实现）。
 * @private
 * @param {object} options - 配置对象。
 * @param {string} options.title - 对话框标题。
 * @param {string} options.message - 对话框消息。
 * @param {string} options.okText - 确认按钮的文本。
 * @param {string|null} options.cancelText - 取消按钮的文本，如果为null则不显示。
 * @returns {Promise<boolean>} - 用户点击确认时解析为 true，否则为 false。
 */
function _showDialog(options) {
    return new Promise(resolve => {
        dom.alertConfirmTitle.textContent = options.title;
        dom.alertConfirmMessage.innerHTML = options.message.replace(/\n/g, '<br>');

        const buttons = [
            { el: dom.alertConfirmOkBtn, text: options.okText, value: true, style: 'inline-block' },
            { el: dom.alertConfirmCancelBtn, text: options.cancelText, value: false, style: options.cancelText ? 'inline-block' : 'none' }
        ];
        const listeners = [];

        const cleanup = (result) => {
            hideModal(dom.alertConfirmModal);
            listeners.forEach(({ el, type, handler }) => el.removeEventListener(type, handler));
            resolve(result);
        };

        const overlayHandler = (e) => { if (e.target === dom.alertConfirmModal) cleanup(false); };
        dom.alertConfirmModal.addEventListener('click', overlayHandler);
        listeners.push({ el: dom.alertConfirmModal, type: 'click', handler: overlayHandler });

        buttons.forEach(btnConfig => {
            btnConfig.el.textContent = btnConfig.text;
            btnConfig.el.style.display = btnConfig.style;
            if (btnConfig.text) {
                const handler = () => cleanup(btnConfig.value);
                btnConfig.el.addEventListener('click', handler);
                listeners.push({ el: btnConfig.el, type: 'click', handler });
            }
        });

        showModal(dom.alertConfirmModal);
    });
}

/**
 * 显示一个提示框 (Alert)。
 * @param {string} message - 提示信息。
 * @param {string} [title='提示'] - 提示框标题。
 * @returns {Promise<boolean>} - 用户点击确认后 resolve。
 */
export function showAlert(message, title = '提示') {
    return _showDialog({ title, message, okText: '确认', cancelText: null });
}

/**
 * 显示一个确认框 (Confirm)。
 * @param {string} message - 确认信息。
 * @param {string} [title='请确认'] - 确认框标题。
 * @returns {Promise<boolean>} - 用户点击“确认”解析为 true，点击“取消”或关闭则为 false。
 */
export function showConfirm(message, title = '请确认') {
    return _showDialog({ title, message, okText: '确认', cancelText: '取消' });
}
// #endregion

// =========================================================================
// #region 核心UI渲染
// =========================================================================

/**
 * 应用指定的主题（亮色/暗色）。
 * @param {'dark' | 'light'} theme - 主题名称。
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-preference', theme);
    if (dom.darkModeSwitch) dom.darkModeSwitch.checked = theme === 'dark';
}

/**
 * 填充自定义数据源选择器。
 */
export function populateDataSourceSelector() {
    if (!dom.customSelect) return;

    const selectedIdentifier = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;
    let selectedText = '选择源...'; // 默认文本

    dom.customSelectOptions.innerHTML = '';
    state.allSiteDataSources.forEach(source => {
        const option = document.createElement('div');
        option.className = 'custom-select-option';
        const value = source.path || source.name;
        option.dataset.value = value;
        option.textContent = source.name;

        if (value === selectedIdentifier) {
            option.classList.add('selected');
            selectedText = source.name;
        }
        dom.customSelectOptions.appendChild(option);
    });

    dom.customSelect.dataset.value = selectedIdentifier;
    dom.customSelectSelectedText.textContent = selectedText;

    updateDeleteButtonState();
}

/**
 * 根据当前选择的数据源，更新“删除源”按钮的可用状态。
 */
export function updateDeleteButtonState() {
    if (!dom.deleteSourceBtn || !dom.customSelect) return;
    const selectedIdentifier = dom.customSelect.dataset.value;
    const source = state.allSiteDataSources.find(s => (s.path || s.name) === selectedIdentifier);
    // 带有 'path' 属性的是内置源，不可删除
    dom.deleteSourceBtn.disabled = !source || !!source.path;
}

/**
 * 渲染整个导航页面内容，包括侧边栏和主内容区。
 */
export function renderNavPage() {
    dom.categoryList.innerHTML = '';
    dom.contentWrapper.innerHTML = '';

    const currentSourceIdentifier = dom.customSelect.dataset.value;
    const currentSource = state.allSiteDataSources.find(s => (s.path || s.name) === currentSourceIdentifier);
    const isCustomSource = currentSource && !currentSource.path;

    state.siteData.categories.forEach(category => {
        // 创建侧边栏链接
        const categoryLink = document.createElement('a');
        categoryLink.href = `#${category.categoryId}`;
        categoryLink.textContent = category.categoryName;
        dom.categoryList.appendChild(categoryLink);

        // 创建主内容区的分类板块
        const section = document.createElement('section');
        section.id = category.categoryId;
        section.className = 'category-section';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'category-title-container';
        titleContainer.innerHTML = `<h2 class="category-title">${category.categoryName}</h2>`;

        // 仅当源是自定义源，或分类是“我的导航”时，显示编辑控件
        const shouldShowActions = isCustomSource || category.categoryId === CUSTOM_CATEGORY_ID;
        if (shouldShowActions) {
            // 添加 class 以便 CSS 和 JS 定位可编辑区域
            section.classList.add('custom-source-section');
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'title-actions';
            actionsDiv.innerHTML = `
                <button id="add-site-btn" class="action-btn" data-category-id="${category.categoryId}">新增</button>
                <button id="edit-site-btn" class="action-btn">编辑</button>
                <button id="delete-site-btn" class="action-btn btn-danger">删除</button>
            `;
            titleContainer.appendChild(actionsDiv);
        }

        const cardGrid = document.createElement('div');
        cardGrid.className = 'card-grid';
        category.sites.forEach(site => cardGrid.innerHTML += createCardHTML(site));

        section.appendChild(titleContainer);
        section.appendChild(cardGrid);
        dom.contentWrapper.appendChild(section);
    });

    setupSidebarLinks(); // 重新设置侧边栏链接的滚动监听
}

/**
 * 创建单个网站卡片的HTML字符串。
 * @param {object} site - 网站数据对象。
 * @returns {string} - HTML字符串。
 */
function createCardHTML(site) {
    const defaultIcon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🌐%3C/text%3E%3C/svg%3E';
    const iconUrl = site.icon || defaultIcon;
    const proxyBadge = site.proxy ? '<div class="proxy-badge">Proxy</div>' : '';
    // 使用 pinyinConverter 生成拼音数据，用于后续的拼音搜索
    const titlePinyin = pinyinManager.convert(site.title);
    const descPinyin = pinyinManager.convert(site.desc || '');

    return `
        <div class="card"
             data-id="${site.id}"
             data-url="${site.url}"
             data-pinyin-full="${titlePinyin.full} ${descPinyin.full}"
             data-pinyin-initials="${titlePinyin.initials} ${descPinyin.initials}"
             draggable="false">
            ${proxyBadge}
            <div class="card-header">
                <img src="${iconUrl}" alt="${site.title}" class="card-icon" draggable="false" onerror="this.src='${defaultIcon}'">
                <h3 class="card-title">${site.title}</h3>
            </div>
            <p class="card-desc">${site.desc || ''}</p>
        </div>`;
}

/**
 * 设置侧边栏链接的平滑滚动和滚动监听，以高亮当前可视区域对应的链接。
 */
export function setupSidebarLinks() {
    const links = dom.categoryList.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));
            if (targetElement) targetElement.scrollIntoView({behavior: 'smooth'});
        });
    });

    const sections = document.querySelectorAll('.category-section');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const activeLink = dom.categoryList.querySelector(`a[href="#${entry.target.id}"]`);
                if (activeLink) {
                    links.forEach(link => link.classList.remove('active'));
                    activeLink.classList.add('active');
                }
            }
        });
    }, { rootMargin: "-50% 0px -50% 0px" }); // 当分类板块进入屏幕垂直中线时触发
    sections.forEach(section => observer.observe(section));
}
// #endregion

// =========================================================================
// #region 搜索相关UI
// =========================================================================

/**
 * 渲染搜索类别按钮。
 */
export function renderSearchCategories() {
    dom.searchCategoryButtonsContainer.innerHTML = '';
    state.searchConfig.categories.forEach(cat => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = cat.label;
        button.dataset.value = cat.value;
        dom.searchCategoryButtonsContainer.appendChild(button);
    });
}

/**
 * 根据当前选择的搜索类别，渲染搜索引擎复选框。
 * @param {string} currentSearchCategory - 当前选中的搜索类别值。
 */
export function renderEngineCheckboxes(currentSearchCategory) {
    dom.searchEngineCheckboxesContainer.innerHTML = '';
    const engines = state.searchConfig.engines[currentSearchCategory] || [];
    engines.forEach((engine, index) => {
        const label = document.createElement('label');
        label.className = 'engine-checkbox';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = engine.url;
        checkbox.checked = (index === 0); // 默认只选中第一个
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${engine.name}`));
        dom.searchEngineCheckboxesContainer.appendChild(label);
    });
}

/**
 * 渲染搜索建议列表。
 * @param {string[]} suggestions - 建议词条数组。
 */
export function renderSuggestions(suggestions) {
    dom.suggestionsList.innerHTML = '';
    if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.textContent = suggestion;
            dom.suggestionsList.appendChild(li);
        });
        dom.suggestionsList.style.display = 'block';
    } else {
        dom.suggestionsList.style.display = 'none';
    }
}

/**
 * 根据搜索词过滤导航卡片和分类的显示。
 * @param {string} query - 搜索关键词。
 */
export function filterNavCards(query) {
    const searchTerm = query.toLowerCase().trim();
    const sections = document.querySelectorAll('.category-section');

    if (searchTerm === '') {
        // 如果搜索词为空，显示所有内容
        sections.forEach(section => {
            section.style.display = '';
            section.querySelectorAll('.card').forEach(card => card.style.display = '');
        });
        return;
    }

    sections.forEach(section => {
        let visibleCardsInSection = 0;
        const cards = section.querySelectorAll('.card');
        cards.forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            const desc = card.querySelector('.card-desc').textContent.toLowerCase();
            const url = card.dataset.url.toLowerCase();
            const pinyinFull = card.dataset.pinyinFull || '';
            const pinyinInitials = card.dataset.pinyinInitials || '';

            const isMatch = title.includes(searchTerm) || desc.includes(searchTerm) || url.includes(searchTerm) || pinyinFull.includes(searchTerm) || pinyinInitials.includes(searchTerm);

            card.style.display = isMatch ? '' : 'none';
            if (isMatch) visibleCardsInSection++;
        });

        // 如果分类中没有可见的卡片，则隐藏整个分类板块
        section.style.display = visibleCardsInSection > 0 ? '' : 'none';
    });
}
// #endregion

// =========================================================================
// #region 模态框控制函数
// =========================================================================

/**
 * 打开网站编辑/新增模态框。
 * @param {'add' | 'edit'} mode - 模态框模式。
 * @param {object | null} site - 在编辑模式下要填充的网站对象。
 * @param {string} categoryId - 在新增模式下，网站将被添加到的分类ID。
 */
export function openSiteModal(mode, site = null, categoryId) {
    dom.siteForm.reset();
    dom.categoryIdInput.value = categoryId;
    if (mode === 'add') {
        dom.modalTitle.textContent = '新增网站';
        dom.siteIdInput.value = '';
    } else if (mode === 'edit' && site) {
        dom.modalTitle.textContent = '编辑网站';
        dom.siteIdInput.value = site.id;
        dom.siteUrlInput.value = site.url;
        dom.siteTitleInput.value = site.title;
        dom.siteIconInput.value = site.icon || '';
        dom.siteDescInput.value = site.desc || '';
        dom.siteProxyInput.checked = site.proxy || false;
    }
    showModal(dom.siteModal);
    dom.siteUrlInput.focus();
}

/** 关闭网站编辑模态框 */
export function closeSiteModal() {
    hideModal(dom.siteModal);
}

/** 打开导入命名模态框 */
export function openImportNameModal() {
    showModal(dom.importNameModal);
    dom.importNameInput.focus();
}

/** 关闭导入命名模态框 */
export function closeImportNameModal() {
    hideModal(dom.importNameModal);
    dom.importNameForm.reset();
    dom.importNameError.style.display = 'none';
}
// #endregion

// =========================================================================
// #region 编辑/删除模式切换
// =========================================================================

/**
 * 切换编辑模式。
 * 进入编辑模式会退出删除模式。
 */
export function toggleEditMode() {
    if (dom.contentWrapper.classList.contains('is-deleting')) {
        toggleDeleteMode(); // 先退出删除模式
    }
    const isNowEditing = dom.contentWrapper.classList.toggle('is-editing');

    // 更新所有编辑按钮的状态和文本
    document.querySelectorAll('#edit-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowEditing);
        btn.textContent = isNowEditing ? '完成' : '编辑';
    });

    // 启用或禁用可编辑区域内卡片的拖拽功能
    document.querySelectorAll('.custom-source-section .card').forEach(card => {
        card.draggable = isNowEditing;
    });
}

/**
 * 切换删除模式。
 * 进入删除模式会退出编辑模式。
 */
export function toggleDeleteMode() {
    if (dom.contentWrapper.classList.contains('is-editing')) {
        toggleEditMode(); // 先退出编辑模式
    }
    const isNowDeleting = dom.contentWrapper.classList.toggle('is-deleting');

    // 更新所有删除按钮的状态和文本
    document.querySelectorAll('#delete-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowDeleting);
        btn.textContent = isNowDeleting ? '完成' : '删除';
    });
}
// #endregion