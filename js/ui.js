// =========================================================================
// ui.js - UI管理器 (增强版: 支持 GitHub UI 交互)
// 职责: 管理和渲染所有用户界面元素、处理UI事件、显示模态框、GitHub 状态反馈。
// =========================================================================

import { state, CUSTOM_CATEGORY_ID, DEFAULT_SITES_PATH, NAV_DATA_SOURCE_PREFERENCE_KEY, getProxyMode, bindGitHub, initGitHub, syncFromGitHub, GITHUB_TOKEN_KEY, GITHUB_REPO_KEY, performDataSourceSwitch } from './dataManager.js';

// === DOM 元素缓存 ===
export const dom = {
    // 基础布局
    darkModeSwitch: document.getElementById('dark-mode-switch'),
    proxyModeSwitch: document.getElementById('proxy-mode-switch'),
    categoryList: document.querySelector('.category-list'),
    contentWrapper: document.getElementById('content-wrapper'),
    sidebarScrollArea: document.querySelector('.sidebar-scroll-area'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),

    // GitHub 相关
    githubBtn: document.getElementById('github-btn'), // 新增
    githubModal: document.getElementById('github-modal'), // 新增
    githubForm: document.getElementById('github-form'), // 新增
    githubTokenInput: document.getElementById('github-token-input'), // 新增
    githubRepoInput: document.getElementById('github-repo-input'), // 新增
    githubStatusDot: document.getElementById('github-status-dot'), // 新增状态指示灯
    githubUserInfo: document.getElementById('github-user-info'), // 新增
    githubLogoutBtn: document.getElementById('github-logout-btn'), // 新增
    closeGithubModalBtn: document.getElementById('close-github-modal-btn'), // 新增

    // 自定义选择器元素
    customSelect: document.getElementById('custom-select'),
    customSelectTrigger: document.getElementById('custom-select-trigger'),
    customSelectSelectedText: document.getElementById('custom-select-selected-text'),
    customSelectOptions: document.getElementById('custom-select-options'),

    // 功能按钮
    importBtn: document.getElementById('import-btn'),
    exportBtn: document.getElementById('export-btn'),
    deleteSourceBtn: document.getElementById('delete-source-btn'),

    // 模态框组
    importFileInput: document.getElementById('import-file-input'),
    importNameModal: document.getElementById('import-name-modal'),
    importNameForm: document.getElementById('import-name-form'),
    importNameInput: document.getElementById('import-name-input'),
    importNameError: document.getElementById('import-name-error'),
    cancelImportNameBtn: document.getElementById('cancel-import-name-btn'),
    importModeNewRadio: document.getElementById('import-mode-new'),
    importModeMergeRadio: document.getElementById('import-mode-merge'),

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

    // 通用确认框
    alertConfirmModal: document.getElementById('alert-confirm-modal'),
    alertConfirmTitle: document.getElementById('alert-confirm-title'),
    alertConfirmMessage: document.getElementById('alert-confirm-message'),
    alertConfirmOkBtn: document.getElementById('alert-confirm-ok-btn'),
    alertConfirmCancelBtn: document.getElementById('alert-confirm-cancel-btn'),
};

// =========================================================================
// #region GitHub UI 交互逻辑 (新增)
// =========================================================================

/**
 * 初始化 GitHub UI 组件状态
 */
export function initGithubUI() {
    // 监听全局同步状态事件
    window.addEventListener('navhub-sync-status', (e) => {
        updateGithubStatusIndicator(e.detail.status);
    });

    if (state.github.token) {
        updateGithubStatusIndicator('idle'); // 已登录，空闲
        if (dom.githubBtn) dom.githubBtn.classList.add('active'); // 按钮变亮
    }

    // 绑定按钮事件
    if (dom.githubBtn) {
        dom.githubBtn.addEventListener('click', openGithubModal);
    }
    if (dom.closeGithubModalBtn) {
        dom.closeGithubModalBtn.addEventListener('click', closeGithubModal);
    }
    if (dom.githubModal) {
        dom.githubModal.addEventListener('click', (e) => {
            if (e.target === dom.githubModal) closeGithubModal();
        });
    }
    if (dom.githubForm) {
        dom.githubForm.addEventListener('submit', handleGithubBind);
    }
    if (dom.githubLogoutBtn) {
        dom.githubLogoutBtn.addEventListener('click', handleGithubLogout);
    }
}

/**
 * 更新侧边栏底部的同步状态指示灯
 * @param {'idle' | 'pending' | 'syncing' | 'success' | 'error' | 'disconnected'} status
 */
export function updateGithubStatusIndicator(status) {
    if (!dom.githubStatusDot) return;

    // 移除所有状态类
    dom.githubStatusDot.className = 'status-dot';
    dom.githubStatusDot.title = '未连接 GitHub';

    if (!state.github.token) {
        dom.githubStatusDot.classList.add('status-disconnected');
        return;
    }

    switch (status) {
        case 'idle':
            dom.githubStatusDot.classList.add('status-idle');
            dom.githubStatusDot.title = 'GitHub 已连接';
            break;
        case 'pending': // 等待同步（防抖中）
            dom.githubStatusDot.classList.add('status-pending');
            dom.githubStatusDot.title = '准备同步...';
            break;
        case 'syncing':
            dom.githubStatusDot.classList.add('status-syncing');
            dom.githubStatusDot.title = '正在同步数据...';
            break;
        case 'success':
            dom.githubStatusDot.classList.add('status-success');
            dom.githubStatusDot.title = '同步成功';
            // 3秒后恢复空闲状态
            setTimeout(() => {
                if (dom.githubStatusDot.classList.contains('status-success')) {
                    updateGithubStatusIndicator('idle');
                }
            }, 3000);
            break;
        case 'error':
            dom.githubStatusDot.classList.add('status-error');
            dom.githubStatusDot.title = '同步失败，请检查网络或 Token';
            break;
    }
}

function openGithubModal() {
    // 填充当前状态
    if (state.github.token) {
        dom.githubTokenInput.value = state.github.token; // 出于安全，通常掩码显示，这里简单回显
        dom.githubForm.style.display = 'none'; // 已登录则隐藏表单
        dom.githubUserInfo.style.display = 'block';
        dom.githubUserInfo.innerHTML = `
            <div class="user-card">
                <img src="${state.github.user.avatar_url}" class="user-avatar">
                <div>
                    <h4>${state.github.user.login}</h4>
                    <p class="text-xs text-secondary">仓库: ${state.github.repo}</p>
                </div>
            </div>
            <div class="sync-actions" style="margin-top:15px; display:flex; gap:10px;">
                <button type="button" id="force-pull-btn" class="btn-primary-glass" style="flex:1;">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.09 17.67 14.1 17.11 14.96L18.53 16.38C19.45 15.14 20 13.63 20 12C20 7.58 16.42 4 12 4ZM6.89 8.04L5.47 6.62C4.55 7.86 4 9.37 4 11C4 15.42 7.58 19 12 19V22L16 18L12 14V17C8.69 17 6 14.31 6 11C6 9.91 6.33 8.9 6.89 8.04Z" fill="currentColor"/></svg>
                    立即拉取
                </button>
            </div>
        `;

        // 绑定手动拉取事件
        const pullBtn = document.getElementById('force-pull-btn');
        if (pullBtn) pullBtn.addEventListener('click', async () => {
            pullBtn.disabled = true;
            pullBtn.innerHTML = '拉取中...';
            await syncFromGitHub((s) => updateGithubStatusIndicator(s));
            // 拉取后刷新页面数据
            const currentSource = dom.customSelect.dataset.value;
            performDataSourceSwitch(currentSource, false, () => {
                renderNavPage();
                showAlert("数据已从云端更新。", "同步完成");
                pullBtn.disabled = false;
                pullBtn.innerHTML = '立即拉取';
                closeGithubModal();
            });
        });

    } else {
        dom.githubForm.style.display = 'block';
        dom.githubUserInfo.style.display = 'none';
        dom.githubTokenInput.value = '';
        dom.githubRepoInput.value = '';
    }
    showModal(dom.githubModal);
}

function closeGithubModal() {
    hideModal(dom.githubModal);
}

async function handleGithubBind(e) {
    e.preventDefault();
    const token = dom.githubTokenInput.value.trim();
    const repo = dom.githubRepoInput.value.trim();

    if (!token) {
        showAlert("请输入 Personal Access Token");
        return;
    }

    const submitBtn = dom.githubForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '连接中...';

    try {
        await bindGitHub(token, repo);

        // 绑定成功后，尝试立即拉取一次数据
        await syncFromGitHub((s) => updateGithubStatusIndicator(s));

        // 刷新页面显示
        const currentSource = dom.customSelect.dataset.value;
        performDataSourceSwitch(currentSource, false, () => {
            renderNavPage();
            showAlert(`成功连接到 GitHub！\n账号: ${state.github.user.login}\n仓库: ${state.github.repo}`, "连接成功");
            closeGithubModal();
            updateGithubStatusIndicator('idle');
            if (dom.githubBtn) dom.githubBtn.classList.add('active');
        });
    } catch (err) {
        showAlert(`连接失败: ${err.message}`, "错误");
        updateGithubStatusIndicator('disconnected');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleGithubLogout() {
    const confirmed = await showConfirm("确定要断开 GitHub 连接吗？\n本地数据将保留，但不再进行云同步。");
    if (!confirmed) return;

    localStorage.removeItem(GITHUB_TOKEN_KEY);
    localStorage.removeItem(GITHUB_REPO_KEY);
    state.github.token = null;
    state.github.repo = null;
    state.github.user = null;
    state.github.remoteSha = null;

    closeGithubModal();
    updateGithubStatusIndicator('disconnected');
    if (dom.githubBtn) dom.githubBtn.classList.remove('active');
    showAlert("已断开 GitHub 连接。");
}

// =========================================================================
// #region 移动端控制 (保持不变)
// =========================================================================
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

export function closeMobileSidebar() {
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('visible');
}

// =========================================================================
// #region 模态框基础 (保持不变)
// =========================================================================
function showModal(modalElement) {
    if (modalElement) modalElement.classList.remove('modal-hidden');
}

function hideModal(modalElement) {
    if (modalElement) modalElement.classList.add('modal-hidden');
}

function _showDialog(options) {
    return new Promise(resolve => {
        dom.alertConfirmTitle.textContent = options.title;
        dom.alertConfirmMessage.innerHTML = options.message.replace(/\n/g, '<br>');

        const buttons = [
            { el: dom.alertConfirmOkBtn, text: options.okText, value: true, style: 'inline-block' },
            { el: dom.alertConfirmCancelBtn, text: options.cancelText, value: false, style: options.cancelText ? 'inline-block' : 'none' }
        ];

        const cleanup = (result) => {
            hideModal(dom.alertConfirmModal);
            // 简单处理：克隆节点以移除所有监听器
            const newOk = dom.alertConfirmOkBtn.cloneNode(true);
            const newCancel = dom.alertConfirmCancelBtn.cloneNode(true);
            dom.alertConfirmOkBtn.parentNode.replaceChild(newOk, dom.alertConfirmOkBtn);
            dom.alertConfirmCancelBtn.parentNode.replaceChild(newCancel, dom.alertConfirmCancelBtn);
            dom.alertConfirmOkBtn = newOk;
            dom.alertConfirmCancelBtn = newCancel;
            resolve(result);
        };

        const overlayHandler = (e) => { if (e.target === dom.alertConfirmModal) cleanup(false); };
        dom.alertConfirmModal.onclick = overlayHandler;

        buttons.forEach(btnConfig => {
            btnConfig.el.textContent = btnConfig.text;
            btnConfig.el.style.display = btnConfig.style;
            if (btnConfig.text) {
                btnConfig.el.onclick = () => cleanup(btnConfig.value);
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
// #region 渲染核心 (保持不变)
// =========================================================================
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-preference', theme);
    if (dom.darkModeSwitch) dom.darkModeSwitch.checked = theme === 'dark';
}

export function applyProxyMode(isProxyOn) {
    document.documentElement.setAttribute('data-proxy-mode', String(isProxyOn));
    if (dom.proxyModeSwitch) dom.proxyModeSwitch.checked = isProxyOn;
}

export function populateDataSourceSelector() {
    if (!dom.customSelect) return;

    const selectedIdentifier = localStorage.getItem(NAV_DATA_SOURCE_PREFERENCE_KEY) || DEFAULT_SITES_PATH;
    let selectedText = '服务';

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
    const isDisabled = !source || !!source.path;

    dom.deleteSourceBtn.disabled = isDisabled;
    dom.deleteSourceBtn.style.opacity = isDisabled ? '0.5' : '1';
    dom.deleteSourceBtn.style.pointerEvents = isDisabled ? 'none' : 'auto';
}

export function renderNavPage() {
    const sidebarFragment = document.createDocumentFragment();
    const contentFragment = document.createDocumentFragment();

    dom.categoryList.innerHTML = '';
    dom.contentWrapper.innerHTML = '';

    const currentSourceIdentifier = dom.customSelect.dataset.value;
    const currentSource = state.allSiteDataSources.find(s => (s.path || s.name) === currentSourceIdentifier);
    const isCustomSource = currentSource && !currentSource.path;

    state.siteData.categories.forEach(category => {
        const categoryLink = document.createElement('a');
        categoryLink.href = `#${category.categoryId}`;
        categoryLink.innerHTML = ` ${category.categoryName}`;
        sidebarFragment.appendChild(categoryLink);

        const section = document.createElement('section');
        section.id = category.categoryId;
        section.className = 'category-section';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'category-title-container';
        let actionsHTML = '';

        const isEditable = isCustomSource || category.categoryId === CUSTOM_CATEGORY_ID;

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
        const cardsHTML = category.sites.map(site => createCardHTML(site, isEditable)).join('');
        cardGrid.innerHTML = cardsHTML;

        section.appendChild(titleContainer);
        section.appendChild(cardGrid);
        contentFragment.appendChild(section);
    });

    dom.categoryList.appendChild(sidebarFragment);
    dom.contentWrapper.appendChild(contentFragment);

    setupSidebarLinks();
}

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

export function setupSidebarLinks() {
    const links = dom.categoryList.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));
            if (targetElement) {
                const headerOffset = 80;
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
// #region 搜索与交互 (保持不变)
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
    let engines = state.searchConfig.engines[currentSearchCategory] || [];
    const showProxy = getProxyMode();
    if (!showProxy) {
        engines = engines.filter(engine => !engine.proxy);
    }
    engines.forEach((engine, index) => {
        const label = document.createElement('label');
        label.className = 'engine-checkbox';
        if (engine.desc) label.title = engine.desc;
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
            const isMatch = title.includes(searchTerm) || desc.includes(searchTerm) || url.includes(searchTerm);
            card.style.display = isMatch ? '' : 'none';
            if (isMatch) visibleCardsInSection++;
        });
        section.style.display = visibleCardsInSection > 0 ? '' : 'none';
    });
}

export function openSiteModal(mode, site = null, categoryId, categoryName = '') {
    dom.siteForm.reset();
    dom.categoryIdInput.value = categoryId || '';
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

export function closeSiteModal() {
    hideModal(dom.siteModal);
}

export function openImportNameModal() {
    dom.importModeNewRadio.checked = true;
    dom.importNameInput.disabled = false;
    showModal(dom.importNameModal);
    dom.importNameInput.focus();
}

export function closeImportNameModal() {
    hideModal(dom.importNameModal);
    dom.importNameForm.reset();
    dom.importNameInput.disabled = false;
    dom.importNameError.style.display = 'none';
}

export function toggleEditMode() {
    if (dom.contentWrapper.classList.contains('is-deleting')) toggleDeleteMode();
    const isNowEditing = dom.contentWrapper.classList.toggle('is-editing');
    document.querySelectorAll('.edit-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowEditing);
        btn.innerHTML = isNowEditing ? '<svg class="icon" viewBox="0 0 24 24"><path d="M10 15.172L19.192 5.979L20.607 7.393L10 18L3.636 11.636L5.05 10.222L10 15.172Z" fill="currentColor"></path></svg> 退出编辑' : '<svg class="icon" viewBox="0 0 24 24"><path d="M12.8995 6.85453L17.1421 11.0972L7.24264 20.9967H3V16.754L12.8995 6.85453ZM14.3137 5.44032L16.435 3.319C16.8256 2.92848 17.4587 2.92848 17.8492 3.319L20.6777 6.14743C21.0682 6.53795 21.0682 7.17112 20.6777 7.56164L18.5563 9.68296L14.3137 5.44032Z" fill="currentColor"></path></svg> 编辑';
    });
    document.querySelectorAll('.custom-source-section .card').forEach(card => card.draggable = isNowEditing);
}

export function toggleDeleteMode() {
    if (dom.contentWrapper.classList.contains('is-editing')) toggleEditMode();
    const isNowDeleting = dom.contentWrapper.classList.toggle('is-deleting');
    document.querySelectorAll('.delete-site-btn').forEach(btn => {
        btn.classList.toggle('active', isNowDeleting);
        btn.innerHTML = isNowDeleting ? '<svg class="icon" viewBox="0 0 24 24"><path d="M10 15.172L19.192 5.979L20.607 7.393L10 18L3.636 11.636L5.05 10.222L10 15.172Z" fill="currentColor"></path></svg> 退出删除' : '<svg class="icon" viewBox="0 0 24 24"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" fill="currentColor"></path></svg> 删除';
    });
}

export function isolateSidebarScroll() {
    if (!dom.sidebarScrollArea) return;
    dom.sidebarScrollArea.addEventListener('wheel', (e) => {
        const { scrollTop, scrollHeight, clientHeight } = dom.sidebarScrollArea;
        const deltaY = e.deltaY;
        if (scrollTop === 0 && deltaY < 0) e.preventDefault();
        if (scrollTop + clientHeight >= scrollHeight - 1 && deltaY > 0) e.preventDefault();
    }, { passive: false });
}