// =========================================================================
// ui.js - UI管理器
// 职责: 负责所有与DOM渲染和界面交互相关的任务。
// 包括：缓存DOM元素、渲染导航卡片和分类、控制模态框、更新UI状态（如主题、编辑模式）等。
// =========================================================================

import { state, CUSTOM_CATEGORY_ID } from './data.js';

// === DOM 元素缓存 ===
export const dom = {
    darkModeSwitch: document.getElementById('dark-mode-switch'),
    categoryList: document.querySelector('.category-list'),
    contentWrapper: document.getElementById('content-wrapper'),
    dataSourceSelect: document.getElementById('data-source-select'),
    importBtn: document.getElementById('import-btn'),
    exportBtn: document.getElementById('export-btn'),
    deleteSourceBtn: document.getElementById('delete-source-btn'),
    importFileInput: document.getElementById('import-file-input'),
    importNameModal: document.getElementById('import-name-modal'),
    importNameForm: document.getElementById('import-name-form'),
    importNameInput: document.getElementById('import-name-input'),
    importNameError: document.getElementById('import-name-error'),
    cancelImportNameBtn: document.getElementById('cancel-import-name-btn'),
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
    searchCategoryButtonsContainer: document.getElementById('search-category-buttons'),
    searchEngineCheckboxesContainer: document.getElementById('search-engine-checkboxes'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    suggestionsList: document.getElementById('suggestions-list'),
    alertConfirmModal: document.getElementById('alert-confirm-modal'),
    alertConfirmTitle: document.getElementById('alert-confirm-title'),
    alertConfirmMessage: document.getElementById('alert-confirm-message'),
    alertConfirmOkBtn: document.getElementById('alert-confirm-ok-btn'),
    alertConfirmCancelBtn: document.getElementById('alert-confirm-cancel-btn'),
};

// === 模态框助手 ===

function showModal(modalElement) {
    modalElement.classList.remove('modal-hidden');
}

function hideModal(modalElement) {
    modalElement.classList.add('modal-hidden');
}

export function showAlert(message, title = '提示') {
    return new Promise(resolve => {
        dom.alertConfirmTitle.textContent = title;
        dom.alertConfirmMessage.innerHTML = message.replace(/\n/g, '<br>');
        dom.alertConfirmOkBtn.textContent = '确认';
        dom.alertConfirmOkBtn.style.display = 'inline-block';
        dom.alertConfirmCancelBtn.style.display = 'none';

        const cleanup = () => {
            hideModal(dom.alertConfirmModal);
            dom.alertConfirmOkBtn.removeEventListener('click', okListener);
            dom.alertConfirmModal.removeEventListener('click', overlayListener);
            resolve(true);
        };
        const okListener = () => cleanup();
        const overlayListener = (e) => { if (e.target === dom.alertConfirmModal) cleanup(); };

        dom.alertConfirmOkBtn.addEventListener('click', okListener);
        dom.alertConfirmModal.addEventListener('click', overlayListener);
        showModal(dom.alertConfirmModal);
    });
}

export function showConfirm(message, title = '请确认') {
    return new Promise(resolve => {
        dom.alertConfirmTitle.textContent = title;
        dom.alertConfirmMessage.innerHTML = message.replace(/\n/g, '<br>');
        dom.alertConfirmOkBtn.textContent = '确认';
        dom.alertConfirmCancelBtn.textContent = '取消';
        dom.alertConfirmOkBtn.style.display = 'inline-block';
        dom.alertConfirmCancelBtn.style.display = 'inline-block';

        const cleanup = (result) => {
            hideModal(dom.alertConfirmModal);
            dom.alertConfirmOkBtn.removeEventListener('click', okListener);
            dom.alertConfirmCancelBtn.removeEventListener('click', cancelListener);
            dom.alertConfirmModal.removeEventListener('click', overlayListener);
            resolve(result);
        };
        const okListener = () => cleanup(true);
        const cancelListener = () => cleanup(false);
        const overlayListener = (e) => { if (e.target === dom.alertConfirmModal) cleanup(false); };

        dom.alertConfirmOkBtn.addEventListener('click', okListener);
        dom.alertConfirmCancelBtn.addEventListener('click', cancelListener);
        dom.alertConfirmModal.addEventListener('click', overlayListener);
        showModal(dom.alertConfirmModal);
    });
}


// === 渲染函数 ===

/**
 * 应用主题（亮色/暗色）
 * @param {string} theme - 'dark' 或 'light'
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-preference', theme);
    if (dom.darkModeSwitch) dom.darkModeSwitch.checked = theme === 'dark';
}

/**
 * 填充数据源选择器下拉列表
 */
export function populateDataSourceSelector() {
    if (!dom.dataSourceSelect) return;
    const currentVal = dom.dataSourceSelect.value;
    dom.dataSourceSelect.innerHTML = '';
    state.allSiteDataSources.forEach(source => {
        const option = document.createElement('option');
        option.value = source.path || source.name;
        option.textContent = source.name;
        dom.dataSourceSelect.appendChild(option);
    });
    // 确保在选项填充后设置 value
    if (currentVal && Array.from(dom.dataSourceSelect.options).some(opt => opt.value === currentVal)) {
        dom.dataSourceSelect.value = currentVal;
    }
    updateDeleteButtonState();
}


/**
 * 根据当前选择的数据源，更新删除按钮的可用状态
 */
export function updateDeleteButtonState() {
    if (!dom.deleteSourceBtn || !dom.dataSourceSelect) return;
    const selectedIdentifier = dom.dataSourceSelect.value;
    const source = state.allSiteDataSources.find(s => (s.path || s.name) === selectedIdentifier);
    // 带有 'path' 属性的是内置源，不可删除
    dom.deleteSourceBtn.disabled = !source || !!source.path;
}

/**
 * --- MODIFICATION ---
 * 渲染整个导航页面内容。
 * 现在会根据当前数据源是否为自定义源来决定是否显示编辑控件。
 */
export function renderNavPage() {
    dom.categoryList.innerHTML = '';
    dom.contentWrapper.innerHTML = '';

    // 判断当前数据源是否为自定义源 (没有 path 属性)
    const currentSourceIdentifier = dom.dataSourceSelect.value;
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

        // 如果是可编辑的源，给分类板块加上特定 class 以便 CSS 和 JS 定位
        if (isCustomSource) {
            section.classList.add('custom-source-section');
        }

        const titleContainer = document.createElement('div');
        titleContainer.className = 'category-title-container';
        titleContainer.innerHTML = `<h2 class="category-title">${category.categoryName}</h2>`;

        // 如果是自定义数据源，则为所有分类添加编辑功能
        if (isCustomSource) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'title-actions';
            actionsDiv.innerHTML = `
                <button id="add-site-btn" class="action-btn" data-category-id="${category.categoryId}">新增</button>
                <button id="edit-site-btn" class="action-btn">编辑</button>
                <button id="delete-site-btn" class="action-btn">删除</button>
            `;
            titleContainer.appendChild(actionsDiv);
        }
        // 对于默认数据源，只给“我的导航”添加编辑功能
        else if (category.categoryId === CUSTOM_CATEGORY_ID) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'title-actions';
            actionsDiv.innerHTML = `
                <button id="add-site-btn" class="action-btn" data-category-id="${category.categoryId}">新增</button>
                <button id="edit-site-btn" class="action-btn">编辑</button>
                <button id="delete-site-btn" class="action-btn">删除</button>
            `;
            section.classList.add('custom-source-section'); // 也给它加上这个class，让编辑功能生效
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
 * 创建单个网站卡片的HTML字符串
 * @param {object} site - 网站数据对象
 * @returns {string} - HTML字符串
 */
function createCardHTML(site) {
    const defaultIcon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🌐%3C/text%3E%3C/svg%3E';
    const iconUrl = site.icon || defaultIcon;
    const proxyBadge = site.proxy ? '<div class="proxy-badge">Proxy</div>' : '';
    // 使用 pinyinConverter 生成拼音数据，用于后续的拼音搜索
    const titlePinyin = pinyinConverter.convert(site.title);
    const descPinyin = pinyinConverter.convert(site.desc || '');

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
 * 设置侧边栏链接的平滑滚动和滚动监听
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
                links.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${entry.target.id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, {rootMargin: "-50% 0px -50% 0px"});
    sections.forEach(section => observer.observe(section));
}

// === 搜索UI ===

/**
 * 渲染搜索类别按钮
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
 * 根据当前选择的搜索类别，渲染搜索引擎复选框
 * @param {string} currentSearchCategory - 当前选中的搜索类别值
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
        // --- MODIFICATION ---
        // 只默认选中第一个 (index === 0)
        checkbox.checked = (index === 0);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${engine.name}`));
        dom.searchEngineCheckboxesContainer.appendChild(label);
    });
}

/**
 * 渲染搜索建议列表
 * @param {string[]} suggestions - 建议词条数组
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
 * 根据搜索词过滤导航卡片
 * @param {string} query - 搜索关键词
 */
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

            if (title.includes(searchTerm) || desc.includes(searchTerm) || url.includes(searchTerm) || pinyinFull.includes(searchTerm) || pinyinInitials.includes(searchTerm)) {
                card.style.display = '';
                visibleCardsInSection++;
            } else {
                card.style.display = 'none';
            }
        });

        // --- MODIFICATION ---
        // 如果分类中没有可见的卡片，则隐藏整个分类板块
        section.style.display = visibleCardsInSection > 0 ? '' : 'none';
    });
}

// === 网站编辑模态框控制 ===

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


// === 导入命名模态框控制 ===

export function openImportNameModal() {
    showModal(dom.importNameModal);
    dom.importNameInput.focus();
}

export function closeImportNameModal() {
    hideModal(dom.importNameModal);
    dom.importNameForm.reset();
    dom.importNameError.style.display = 'none';
}

// === 编辑/删除模式切换 ===

export function toggleEditMode() {
    if (dom.contentWrapper.classList.contains('is-deleting')) {
        toggleDeleteMode(); // 先退出删除模式
    }
    dom.contentWrapper.classList.toggle('is-editing');
    const isInEditMode = dom.contentWrapper.classList.contains('is-editing');

    // --- MODIFICATION ---
    // 将 active 状态应用到所有编辑按钮上
    document.querySelectorAll('#edit-site-btn').forEach(btn => {
        btn.classList.toggle('active', isInEditMode);
        btn.textContent = isInEditMode ? '完成' : '编辑';
    });

    // --- MODIFICATION ---
    // 让所有可编辑区域内的卡片都可拖拽
    document.querySelectorAll('.custom-source-section .card').forEach(card => {
        card.draggable = isInEditMode;
    });
}

export function toggleDeleteMode() {
    if (dom.contentWrapper.classList.contains('is-editing')) {
        toggleEditMode(); // 先退出编辑模式
    }
    dom.contentWrapper.classList.toggle('is-deleting');
    const isInDeleteMode = dom.contentWrapper.classList.contains('is-deleting');

    // --- MODIFICATION ---
    // 将 active 状态应用到所有删除按钮上
    document.querySelectorAll('#delete-site-btn').forEach(btn => {
        btn.classList.toggle('active', isInDeleteMode);
        btn.textContent = isInDeleteMode ? '完成' : '删除';
    });
}