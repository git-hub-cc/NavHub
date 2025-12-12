// =========================================================================
// ui.js - UI管理器 (重构版 - 移除拼音依赖)
// 职责: 管理和渲染所有用户界面元素、处理UI事件、显示模态框等。
// =========================================================================

import { state, CUSTOM_CATEGORY_ID, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY, getProxyMode } from './dataManager.js';

// === DOM 元素缓存 ===
// 缓存所有需要操作的DOM元素，避免重复查询，提高性能。
export const dom = {
    // 基础布局
    darkModeSwitch: document.getElementById('dark-mode-switch'),
    proxyModeSwitch: document.getElementById('proxy-mode-switch'),
    categoryList: document.querySelector('.category-list'),
    contentWrapper: document.getElementById('content-wrapper'),
    // 侧边栏滚动区域，用于事件隔离
    sidebarScrollArea: document.querySelector('.sidebar-scroll-area'),
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
    // 新增: 导入模式单选按钮
    importModeNewRadio: document.getElementById('import-mode-new'),
    importModeMergeRadio: document.getElementById('import-mode-merge'),

    // 网站编辑模态框
    siteModal: document.getElementById('site-modal'),
    modalTitle: document.getElementById('modal-title'),
    siteForm: document.getElementById('site-form'),
    cancelBtn: document.getElementById('cancel-btn'),
    siteIdInput: document.getElementById('site-id'),
    categoryIdInput: document.getElementById('category-id'),
    siteCategoryNameInput: document.getElementById('site-category-name'),
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

/**
 * 切换移动端侧边栏的显示/隐藏状态。
 */
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

/**
 * 强制关闭移动端侧边栏。
 */
export function closeMobileSidebar() {
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('visible');
}

// =========================================================================
// #region 模态框与对话框
// =========================================================================

/**
 * 显示一个指定的模态框元素。
 * @param {HTMLElement} modalElement - 要显示的模态框。
 */
function showModal(modalElement) {
    if (modalElement) modalElement.classList.remove('modal-hidden');
}

/**
 * 隐藏一个指定的模态框元素。
 * @param {HTMLElement} modalElement - 要隐藏的模态框。
 */
function hideModal(modalElement) {
    if (modalElement) modalElement.classList.add('modal-hidden');
}

/**
 * 显示一个通用的对话框（警告/确认），并返回一个 Promise。
 * @param {object} options - 对话框配置。
 * @param {string} options.title - 对话框标题。
 * @param {string} options.message - 对话框消息内容。
 * @param {string} options.okText - 确认按钮的文本。
 * @param {string|null} options.cancelText - 取消按钮的文本，如果为null则不显示。
 * @returns {Promise<boolean>} - 用户点击确认返回 true，否则返回 false。
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

        // 清理函数，用于移除监听器并解决Promise
        const cleanup = (result) => {
            hideModal(dom.alertConfirmModal);
            listeners.forEach(({ el, type, handler }) => el.removeEventListener(type, handler));
            resolve(result);
        };

        // 点击模态框背景层时，视为取消
        const overlayHandler = (e) => { if (e.target === dom.alertConfirmModal) cleanup(false); };
        dom.alertConfirmModal.addEventListener('click', overlayHandler);
        listeners.push({ el: dom.alertConfirmModal, type: 'click', handler: overlayHandler });

        // 为按钮绑定一次性点击事件
        buttons.forEach(btnConfig => {
            btnConfig.el.textContent = btnConfig.text;
            btnConfig.el.style.display = btnConfig.style;
            if (btnConfig.text) {
                const handler = () => cleanup(btnConfig.value);
                btnConfig.el.addEventListener('click', handler, { once: true });
                listeners.push({ el: btnConfig.el, type: 'click', handler });
            }
        });

        showModal(dom.alertConfirmModal);
    });
}

/**
 * 显示一个警告框。
 * @param {string} message - 警告消息。
 * @param {string} [title='提示'] - 警告框标题。
 * @returns {Promise<boolean>}
 */
export function showAlert(message, title = '提示') {
    return _showDialog({ title, message, okText: '确认', cancelText: null });
}

/**
 * 显示一个确认框。
 * @param {string} message - 确认消息。
 * @param {string} [title='请确认'] - 确认框标题。
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = '请确认') {
    return _showDialog({ title, message, okText: '确认', cancelText: '取消' });
}

// =========================================================================
// #region 核心UI渲染
// =========================================================================

/**
 * 应用并持久化主题设置。
 * @param {'dark' | 'light'} theme - 要应用的主题。
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-preference', theme);
    if (dom.darkModeSwitch) dom.darkModeSwitch.checked = theme === 'dark';
}

/**
 * 应用代理显示模式，通过切换HTML根元素的属性来触发CSS规则。
 * @param {boolean} isProxyOn - 代理模式是否开启。
 */
export function applyProxyMode(isProxyOn) {
    document.documentElement.setAttribute('data-proxy-mode', String(isProxyOn));
    if (dom.proxyModeSwitch) dom.proxyModeSwitch.checked = isProxyOn;
}

/**
 * 填充数据源下拉选择器，并设置当前选中的项。
 */
export function populateDataSourceSelector() {
    if (!dom.customSelect) return;

    const selectedIdentifier = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;
    let selectedText = '服务'; // 默认值

    dom.customSelectOptions.innerHTML = ''; // 清空旧选项
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
 * 更新“删除数据源”按钮的可用状态和样式。
 */
export function updateDeleteButtonState() {
    if (!dom.deleteSourceBtn || !dom.customSelect) return;
    const selectedIdentifier = dom.customSelect.dataset.value;
    const source = state.allSiteDataSources.find(s => (s.path || s.name) === selectedIdentifier);
    const isDisabled = !source || !!source.path; // 内置数据源（有path）不可删除

    dom.deleteSourceBtn.disabled = isDisabled;
    dom.deleteSourceBtn.style.opacity = isDisabled ? '0.5' : '1';
    dom.deleteSourceBtn.style.pointerEvents = isDisabled ? 'none' : 'auto';
}

/**
 * 渲染整个导航页面，包括侧边栏和主内容区。
 */
export function renderNavPage() {
    const sidebarFragment = document.createDocumentFragment();
    const contentFragment = document.createDocumentFragment();

    // 清空现有内容
    dom.categoryList.innerHTML = '';
    dom.contentWrapper.innerHTML = '';

    const currentSourceIdentifier = dom.customSelect.dataset.value;
    const currentSource = state.allSiteDataSources.find(s => (s.path || s.name) === currentSourceIdentifier);
    const isCustomSource = currentSource && !currentSource.path;

    state.siteData.categories.forEach(category => {
        // 1. 生成侧边栏链接
        const categoryLink = document.createElement('a');
        categoryLink.href = `#${category.categoryId}`;
        categoryLink.innerHTML = ` ${category.categoryName}`;
        sidebarFragment.appendChild(categoryLink);

        // 2. 生成主内容分类区块
        const section = document.createElement('section');
        section.id = category.categoryId;
        section.className = 'category-section';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'category-title-container';
        let actionsHTML = '';

        const isEditable = isCustomSource || category.categoryId === CUSTOM_CATEGORY_ID;

        // 如果是自定义数据源或“我的导航”分类，则添加编辑/删除/清空按钮
        // 修改说明: 将 id="edit-site-btn" 改为 class="action-btn edit-site-btn"
        // 修改说明: 将 id="delete-site-btn" 改为 class="action-btn delete-site-btn"
        if (isEditable) {
            section.classList.add('custom-source-section');
            actionsHTML = `
                <div class="title-actions">
                    <button class="action-btn add-site-btn" data-category-id="${category.categoryId}" data-category-name="${category.categoryName}">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z" fill="currentColor"></path></svg> 新增
                    </button>
                    <button class="action-btn edit-site-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M12.8995 6.85453L17.1421 11.0972L7.24264 20.9967H3V16.754L12.8995 6.85453ZM14.3137 5.44032L16.435 3.319C16.8256 2.92848 17.4587 2.92848 17.8492 3.319L20.6777 6.14743C21.0682 6.53795 21.0682 7.17112 20.6777 7.56164L18.5563 9.68296L14.3137 5.44032Z" fill="currentColor"></path></svg> 编辑</button>
                    <button class="action-btn delete-site-btn" style="color:var(--danger)"><svg class="icon" viewBox="0 0 24 24"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" fill="currentColor"></path></svg> 删除</button>
                    <button class="action-btn clear-category-btn" data-category-id="${category.categoryId}" data-category-name="${category.categoryName}" style="color:var(--danger)"><svg class="icon" viewBox="0 0 24 24"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8Z" fill="currentColor"></path></svg> 清空</button>
                </div>
            `;
        }

        titleContainer.innerHTML = `<h2 class="category-title">${category.categoryName}</h2>${actionsHTML}`;

        const cardGrid = document.createElement('div');
        cardGrid.className = 'card-grid';

        // 使用 map + join 批量生成HTML字符串，然后一次性插入，以提高性能
        const cardsHTML = category.sites.map(site => createCardHTML(site, isEditable)).join('');
        cardGrid.innerHTML = cardsHTML;

        section.appendChild(titleContainer);
        section.appendChild(cardGrid);
        contentFragment.appendChild(section);
    });

    // 将生成的文档片段一次性挂载到DOM树
    dom.categoryList.appendChild(sidebarFragment);
    dom.contentWrapper.appendChild(contentFragment);

    // 重新绑定侧边栏链接的平滑滚动和高亮逻辑
    setupSidebarLinks();
}

/**
 * 根据网站数据对象创建单个卡片的HTML字符串。
 * @param {object} site - 网站数据对象。
 * @param {boolean} isEditable - 该卡片所属区域是否可编辑。
 * @returns {string} - 生成的HTML字符串。
 */
function createCardHTML(site, isEditable) {
    const defaultIcon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🌐%3C/text%3E%3C/svg%3E';
    const iconUrl = site.icon || defaultIcon;
    const proxyBadge = site.proxy ? '<div class="proxy-dot" title="需代理"></div>' : '';

    const editOverlay = isEditable ? `
        <div class="card-overlay-edit">
            <svg class="icon icon-drag" viewBox="0 0 24 24"><path d="M18 11V8L22 12L18 16V13H13V18H16L12 22L8 18H11V13H6V16L2 12L6 8V11H11V6H8L12 2L16 6H13V11H18Z" fill="currentColor"></path></svg>
            <svg class="icon icon-delete" viewBox="0 0 24 24"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" fill="currentColor"></path></svg>
        </div>
    ` : '';

    const proxyAttr = site.proxy ? 'data-proxy="true"' : 'data-proxy="false"';

    return `
        <div class="card"
             ${proxyAttr}
             data-id="${site.id}"
             data-url="${site.url}"
             draggable="${isEditable ? 'true' : 'false'}">
            ${proxyBadge}
            ${editOverlay}
            
            <div class="card-header">
                <div class="card-icon-wrapper">
                    <img src="${iconUrl}" alt="" class="card-icon" draggable="false" loading="lazy" onerror="this.src='${defaultIcon}'">
                </div>
                <h3 class="card-title" title="${site.title}">${site.title}</h3>
            </div>
            <p class="card-desc" title="${site.desc || ''}">${site.desc || '暂无描述'}</p>
        </div>`;
}

/**
 * 为侧边栏链接设置平滑滚动和滚动监听高亮。
 */
export function setupSidebarLinks() {
    const links = dom.categoryList.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));
            if (targetElement) {
                const headerOffset = 80; // 为移动端顶部导航栏留出空间
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });

                if (window.innerWidth <= 768) {
                    closeMobileSidebar();
                }
            }
        });
    });

    const sections = document.querySelectorAll('.category-section');
    if (sections.length === 0) return;

    // 使用 IntersectionObserver 监听滚动，实现侧边栏链接高亮
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
    }, { rootMargin: "-20% 0px -60% 0px" }); // 调整视窗范围，优化高亮时机
    sections.forEach(section => observer.observe(section));
}

// =========================================================================
// #region 搜索相关UI
// =========================================================================

/**
 * 渲染搜索类别按钮。
 */
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

/**
 * 渲染指定类别的搜索引擎复选框，并根据代理模式进行过滤。
 * @param {string} currentSearchCategory - 当前选中的搜索类别值。
 */
export function renderEngineCheckboxes(currentSearchCategory) {
    dom.searchEngineCheckboxesContainer.innerHTML = '';
    let engines = state.searchConfig.engines[currentSearchCategory] || [];

    const showProxy = getProxyMode();
    // 如果代理开关关闭，则过滤掉需要代理的搜索引擎
    if (!showProxy) {
        engines = engines.filter(engine => !engine.proxy);
    }

    engines.forEach((engine, index) => {
        const label = document.createElement('label');
        label.className = 'engine-checkbox';
        // 【关键修改】将搜索引擎的描述(desc)作为 title 属性，实现悬浮提示
        if (engine.desc) {
            label.title = engine.desc;
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = engine.url;
        checkbox.checked = (index === 0); // 默认选中第一个

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${engine.name}`));
        dom.searchEngineCheckboxesContainer.appendChild(label);
    });
}

/**
 * 渲染搜索建议下拉列表。
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
 * 根据搜索查询过滤导航卡片的显示。
 * @param {string} query - 用户的搜索输入。
 */
export function filterNavCards(query) {
    const searchTerm = query.toLowerCase().trim();
    const sections = document.querySelectorAll('.category-section');

    // 如果搜索词为空，则显示所有内容
    if (searchTerm === '') {
        sections.forEach(section => {
            section.style.display = '';
            section.querySelectorAll('.card').forEach(card => card.style.display = '');
        });
        return;
    }

    // 遍历每个分类区块
    sections.forEach(section => {
        let visibleCardsInSection = 0;
        const cards = section.querySelectorAll('.card');
        // 遍历区块内的每个卡片
        cards.forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            const desc = card.querySelector('.card-desc').textContent.toLowerCase();
            const url = card.dataset.url.toLowerCase();

            // 匹配逻辑：标题、描述或URL中包含搜索词
            const isMatch = title.includes(searchTerm) || desc.includes(searchTerm) || url.includes(searchTerm);

            card.style.display = isMatch ? '' : 'none';
            if (isMatch) visibleCardsInSection++;
        });

        // 如果区块内没有可见卡片，则隐藏整个区块
        section.style.display = visibleCardsInSection > 0 ? '' : 'none';
    });
}

// =========================================================================
// #region 模态框控制
// =========================================================================

/**
 * 打开网站编辑或新增模态框。
 * @param {'add' | 'edit'} mode - 模态框的模式。
 * @param {object|null} site - 编辑模式下要编辑的网站对象。
 * @param {string} categoryId - 目标分类的ID。
 * @param {string} [categoryName=''] - 目标分类的名称。
 */
export function openSiteModal(mode, site = null, categoryId, categoryName = '') {
    dom.siteForm.reset();
    dom.categoryIdInput.value = categoryId || '';

    // 优先使用传入的 categoryName，如果为空则通过 categoryId 查找
    let displayCategoryName = categoryName;
    if (!displayCategoryName && categoryId) {
        const category = state.siteData.categories.find(c => c.categoryId === categoryId);
        if (category) displayCategoryName = category.categoryName;
    }
    dom.siteCategoryNameInput.value = displayCategoryName || '未知分类';

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

/**
 * 关闭网站编辑/新增模态框。
 */
export function closeSiteModal() {
    hideModal(dom.siteModal);
}

/**
 * 打开导入数据源命名模态框。
 */
export function openImportNameModal() {
    // 每次打开时重置为默认状态
    dom.importModeNewRadio.checked = true;
    dom.importNameInput.disabled = false;
    showModal(dom.importNameModal);
    dom.importNameInput.focus();
}

/**
 * 关闭导入数据源命名模态框，并重置表单。
 */
export function closeImportNameModal() {
    hideModal(dom.importNameModal);
    dom.importNameForm.reset();
    dom.importNameInput.disabled = false; // 确保输入框在关闭后恢复可用
    dom.importNameError.style.display = 'none';
}

// =========================================================================
// #region 编辑/删除模式切换
// =========================================================================

/**
 * 切换内容区的编辑模式（拖拽排序）。
 */
export function toggleEditMode() {
    // 确保删除模式被关闭
    if (dom.contentWrapper.classList.contains('is-deleting')) {
        toggleDeleteMode();
    }
    const isNowEditing = dom.contentWrapper.classList.toggle('is-editing');

    // 更新所有编辑按钮的状态和文本
    // 修改说明: 使用 class 选择器 .edit-site-btn，并将文本改为“退出编辑”以消除歧义
    document.querySelectorAll('.edit-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowEditing);
        btn.innerHTML = isNowEditing ? '<svg class="icon" viewBox="0 0 24 24"><path d="M10 15.172L19.192 5.979L20.607 7.393L10 18L3.636 11.636L5.05 10.222L10 15.172Z" fill="currentColor"></path></svg> 退出编辑' : '<svg class="icon" viewBox="0 0 24 24"><path d="M12.8995 6.85453L17.1421 11.0972L7.24264 20.9967H3V16.754L12.8995 6.85453ZM14.3137 5.44032L16.435 3.319C16.8256 2.92848 17.4587 2.92848 17.8492 3.319L20.6777 6.14743C21.0682 6.53795 21.0682 7.17112 20.6777 7.56164L18.5563 9.68296L14.3137 5.44032Z" fill="currentColor"></path></svg> 编辑';
    });

    // 启用或禁用可编辑区域卡片的可拖拽属性
    document.querySelectorAll('.custom-source-section .card').forEach(card => {
        card.draggable = isNowEditing;
    });
}

/**
 * 切换内容区的删除模式。
 */
export function toggleDeleteMode() {
    // 确保编辑模式被关闭
    if (dom.contentWrapper.classList.contains('is-editing')) {
        toggleEditMode();
    }
    const isNowDeleting = dom.contentWrapper.classList.toggle('is-deleting');

    // 更新所有删除按钮的状态和文本
    // 修改说明: 使用 class 选择器 .delete-site-btn，并将文本改为“退出删除”以消除歧义
    document.querySelectorAll('.delete-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowDeleting);
        btn.innerHTML = isNowDeleting ? '<svg class="icon" viewBox="0 0 24 24"><path d="M10 15.172L19.192 5.979L20.607 7.393L10 18L3.636 11.636L5.05 10.222L10 15.172Z" fill="currentColor"></path></svg> 退出删除' : '<svg class="icon" viewBox="0 0 24 24"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" fill="currentColor"></path></svg> 删除';
    });
}

// =========================================================================
// #region 交互增强
// =========================================================================

/**
 * 隔离侧边栏的滚动事件，防止在滚动到顶部或底部时，事件冒泡导致主页面滚动。
 */
export function isolateSidebarScroll() {
    if (!dom.sidebarScrollArea) return;

    dom.sidebarScrollArea.addEventListener('wheel', (e) => {
        const { scrollTop, scrollHeight, clientHeight } = dom.sidebarScrollArea;
        const deltaY = e.deltaY;

        // 检查是否滚动到顶部且仍在向上滚动
        if (scrollTop === 0 && deltaY < 0) {
            e.preventDefault();
        }

        // 检查是否滚动到底部且仍在向下滚动
        if (scrollTop + clientHeight >= scrollHeight - 1 && deltaY > 0) {
            e.preventDefault();
        }
    }, { passive: false }); // 需要设置 passive: false 才能调用 preventDefault
}