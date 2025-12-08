// =========================================================================
// ui.js - UI管理器 (重构版)
// =========================================================================

import { state, CUSTOM_CATEGORY_ID, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY } from './dataManager.js';

// === DOM 元素缓存 ===
export const dom = {
    // 基础布局
    darkModeSwitch: document.getElementById('dark-mode-switch'),
    categoryList: document.querySelector('.category-list'),
    contentWrapper: document.getElementById('content-wrapper'),
    // 移动端控件
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),

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
// #region 移动端侧边栏控制
// =========================================================================

/** 切换移动端侧边栏状态 */
export function toggleMobileSidebar() {
    const isOpen = dom.sidebar.classList.contains('open');
    if (isOpen) {
        dom.sidebar.classList.remove('open');
        dom.sidebarOverlay.classList.remove('visible');
    } else {
        dom.sidebar.classList.add('open');
        dom.sidebarOverlay.classList.add('visible');
    }
}

/** 关闭移动端侧边栏 */
export function closeMobileSidebar() {
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('visible');
}

// =========================================================================
// #region 模态框与对话框
// =========================================================================

function showModal(modalElement) {
    modalElement.classList.remove('modal-hidden');
}

function hideModal(modalElement) {
    modalElement.classList.add('modal-hidden');
}

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

export function showAlert(message, title = '提示') {
    return _showDialog({ title, message, okText: '确认', cancelText: null });
}

export function showConfirm(message, title = '请确认') {
    return _showDialog({ title, message, okText: '确认', cancelText: '取消' });
}

// =========================================================================
// #region 核心UI渲染
// =========================================================================

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-preference', theme);
    if (dom.darkModeSwitch) dom.darkModeSwitch.checked = theme === 'dark';
}

export function populateDataSourceSelector() {
    if (!dom.customSelect) return;

    const selectedIdentifier = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;
    let selectedText = '默认数据';

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

export function updateDeleteButtonState() {
    if (!dom.deleteSourceBtn || !dom.customSelect) return;
    const selectedIdentifier = dom.customSelect.dataset.value;
    const source = state.allSiteDataSources.find(s => (s.path || s.name) === selectedIdentifier);
    dom.deleteSourceBtn.disabled = !source || !!source.path;
    // 视觉上也置灰
    dom.deleteSourceBtn.style.opacity = (!source || !!source.path) ? '0.5' : '1';
    dom.deleteSourceBtn.style.pointerEvents = (!source || !!source.path) ? 'none' : 'auto';
}

export function renderNavPage() {
    dom.categoryList.innerHTML = '';
    dom.contentWrapper.innerHTML = '';

    const currentSourceIdentifier = dom.customSelect.dataset.value;
    const currentSource = state.allSiteDataSources.find(s => (s.path || s.name) === currentSourceIdentifier);
    const isCustomSource = currentSource && !currentSource.path;

    state.siteData.categories.forEach(category => {
        // 侧边栏链接 - 增加图标
        const categoryLink = document.createElement('a');
        categoryLink.href = `#${category.categoryId}`;
        // 根据分类名称简单分配一个通用图标，也可以在数据源中扩展 icon 字段
        categoryLink.innerHTML = `<i class="ri-folder-3-line" style="margin-right:8px;font-size:16px;"></i> ${category.categoryName}`;
        dom.categoryList.appendChild(categoryLink);

        // 主内容分类区
        const section = document.createElement('section');
        section.id = category.categoryId;
        section.className = 'category-section';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'category-title-container';
        let actionsHTML = '';

        // 判断该区域是否可编辑 (自定义数据源 或 "我的导航" 分类)
        const isEditable = isCustomSource || category.categoryId === CUSTOM_CATEGORY_ID;

        if (isEditable) {
            section.classList.add('custom-source-section');
            actionsHTML = `
                <div class="title-actions">
                    <button id="add-site-btn" class="action-btn" data-category-id="${category.categoryId}"><i class="ri-add-line"></i> 新增</button>
                    <button id="edit-site-btn" class="action-btn"><i class="ri-edit-line"></i> 编辑</button>
                    <button id="delete-site-btn" class="action-btn" style="color:var(--danger)"><i class="ri-delete-bin-line"></i> 删除</button>
                </div>
            `;
        }

        titleContainer.innerHTML = `<h2 class="category-title">${category.categoryName}</h2>${actionsHTML}`;

        const cardGrid = document.createElement('div');
        cardGrid.className = 'card-grid';
        // 传递 isEditable 标志位到 createCardHTML
        category.sites.forEach(site => cardGrid.innerHTML += createCardHTML(site, isEditable));

        section.appendChild(titleContainer);
        section.appendChild(cardGrid);
        dom.contentWrapper.appendChild(section);
    });

    setupSidebarLinks();
}

/**
 * 创建单个网站卡片的HTML
 * @param {object} site - 网站数据对象
 * @param {boolean} isEditable - 该卡片所属区域是否可编辑
 */
function createCardHTML(site, isEditable) {
    const defaultIcon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🌐%3C/text%3E%3C/svg%3E';
    const iconUrl = site.icon || defaultIcon;
    const proxyBadge = site.proxy ? '<div class="proxy-dot" title="需代理"></div>' : '';
    const titlePinyin = pinyinManager.convert(site.title);
    const descPinyin = pinyinManager.convert(site.desc || '');

    // 仅在可编辑时生成遮罩层
    // 更新逻辑：同时放入两个图标，通过 CSS 控制其显示/隐藏
    const editOverlay = isEditable ? `
        <div class="card-overlay-edit">
            <i class="ri-drag-move-2-line icon-drag"></i>
            <i class="ri-delete-bin-7-line icon-delete"></i>
        </div>
    ` : '';

    return `
        <div class="card"
             data-id="${site.id}"
             data-url="${site.url}"
             data-pinyin-full="${titlePinyin.full} ${descPinyin.full}"
             data-pinyin-initials="${titlePinyin.initials} ${descPinyin.initials}"
             draggable="false">
            ${proxyBadge}
            ${editOverlay}
            
            <div class="card-header">
                <div class="card-icon-wrapper">
                    <img src="${iconUrl}" alt="" class="card-icon" draggable="false" onerror="this.src='${defaultIcon}'">
                </div>
                <h3 class="card-title" title="${site.title}">${site.title}</h3>
            </div>
            <p class="card-desc" title="${site.desc || ''}">${site.desc || '暂无描述'}</p>
        </div>`;
}

export function setupSidebarLinks() {
    const links = dom.categoryList.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));
            if (targetElement) {
                const headerOffset = 80; // 留出头部空间
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });

                // 移动端点击后自动关闭侧边栏
                if (window.innerWidth <= 768) {
                    closeMobileSidebar();
                }
            }
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
    }, { rootMargin: "-20% 0px -60% 0px" });
    sections.forEach(section => observer.observe(section));
}

// =========================================================================
// #region 搜索相关UI
// =========================================================================

export function renderSearchCategories() {
    dom.searchCategoryButtonsContainer.innerHTML = '';
    state.searchConfig.categories.forEach((cat, index) => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = cat.label;
        button.dataset.value = cat.value;
        if (index === 0) button.classList.add('active');
        dom.searchCategoryButtonsContainer.appendChild(button);
    });
}

export function renderEngineCheckboxes(currentSearchCategory) {
    dom.searchEngineCheckboxesContainer.innerHTML = '';
    const engines = state.searchConfig.engines[currentSearchCategory] || [];
    engines.forEach((engine, index) => {
        const label = document.createElement('label');
        label.className = 'engine-checkbox';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = engine.url;
        checkbox.checked = (index === 0);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${engine.name}`));
        dom.searchEngineCheckboxesContainer.appendChild(label);
    });
}

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

export function filterNavCards(query) {
    const searchTerm = query.toLowerCase().trim();
    const sections = document.querySelectorAll('.category-section');

    if (searchTerm === '') {
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

        section.style.display = visibleCardsInSection > 0 ? '' : 'none';
    });
}

// =========================================================================
// #region 模态框控制
// =========================================================================

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
}

export function closeSiteModal() {
    hideModal(dom.siteModal);
}

export function openImportNameModal() {
    showModal(dom.importNameModal);
    dom.importNameInput.focus();
}

export function closeImportNameModal() {
    hideModal(dom.importNameModal);
    dom.importNameForm.reset();
    dom.importNameError.style.display = 'none';
}

// =========================================================================
// #region 编辑/删除模式切换
// =========================================================================

export function toggleEditMode() {
    if (dom.contentWrapper.classList.contains('is-deleting')) {
        toggleDeleteMode();
    }
    const isNowEditing = dom.contentWrapper.classList.toggle('is-editing');

    // 更新图标和文字
    document.querySelectorAll('#edit-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowEditing);
        btn.innerHTML = isNowEditing ? '<i class="ri-check-line"></i> 完成' : '<i class="ri-edit-line"></i> 编辑';
    });

    // 只有在 custom-source-section 内的卡片才允许拖拽
    document.querySelectorAll('.custom-source-section .card').forEach(card => {
        card.draggable = isNowEditing;
    });
}

export function toggleDeleteMode() {
    if (dom.contentWrapper.classList.contains('is-editing')) {
        toggleEditMode();
    }
    const isNowDeleting = dom.contentWrapper.classList.toggle('is-deleting');

    document.querySelectorAll('#delete-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowDeleting);
        btn.innerHTML = isNowDeleting ? '<i class="ri-check-line"></i> 完成' : '<i class="ri-delete-bin-line"></i> 删除';
    });
}