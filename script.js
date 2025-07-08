document.addEventListener('DOMContentLoaded', () => {
    // === 全局状态和常量 ===
    const THEME_STORAGE_KEY = 'theme-preference';
    const NAV_DATA_STORAGE_KEY = 'my-awesome-nav-data';
    const NAV_CUSTOM_SOURCES_KEY = 'nav-custom-data-sources';
    const NAV_CUSTOM_USER_SITES_KEY = 'nav-user-custom-sites-data';
    const CUSTOM_CATEGORY_ID = 'custom-user-sites';
    const DEFAULT_SITES_PATH = "data/小帅同学.json";

    let siteData = {categories: []};
    let searchConfig = {categories: [], engines: {}};
    let pendingImportData = null;
    let currentSearchCategory = '';
    let suggestions = [];
    let suggestionTimer = null;
    let originalDataSourceValue = null;

    const defaultSiteDataSources = [
        {name: "小帅同学", path: "data/小帅同学.json"},
        {name: "NavHub", path: "data/navhub.json"},
        {name: "哆啦A梦的神奇口袋", path: "data/哆啦A梦的神奇口袋.json"},
        {name: "懒人找资源", path: "data/懒人找资源.json"},
        {name: "薛信的资料室", path: "data/薛信的资料室.json"},
        {name: "资源公社&语雀分享", path: "data/资源公社&语雀分享.json"},
        {name: "资源汇社区资源库", path: "data/资源汇社区资源库.json"},
        {name: "金榜题名", path: "data/金榜题名.json"},
        {name: "阿虚同学", path: "data/阿虚同学.json"},
        {name: "阿虚软件库", path: "data/阿虚软件库.json"},
        {name: "陈蛋蛋的宝藏库", path: "data/陈蛋蛋的宝藏库.json"},
        {name: "鱼果天晴的资源库", path: "data/鱼果天晴的资源库.json"}
    ];
    let allSiteDataSources = [];

    // === DOM 元素缓存 ===
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    const categoryList = document.querySelector('.category-list');
    const contentWrapper = document.getElementById('content-wrapper');
    const dataSourceSelect = document.getElementById('data-source-select');
    const importBtn = document.getElementById('import-btn');
    const exportBtn = document.getElementById('export-btn');
    const deleteSourceBtn = document.getElementById('delete-source-btn');
    const importFileInput = document.getElementById('import-file-input');
    const importNameModal = document.getElementById('import-name-modal');
    const importNameForm = document.getElementById('import-name-form');
    const importNameInput = document.getElementById('import-name-input');
    const importNameError = document.getElementById('import-name-error');
    const cancelImportNameBtn = document.getElementById('cancel-import-name-btn');
    const siteModal = document.getElementById('site-modal');
    const modalTitle = document.getElementById('modal-title');
    const siteForm = document.getElementById('site-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const siteIdInput = document.getElementById('site-id');
    const categoryIdInput = document.getElementById('category-id');
    const siteUrlInput = document.getElementById('site-url');
    const siteTitleInput = document.getElementById('site-title');
    const siteIconInput = document.getElementById('site-icon');
    const siteDescInput = document.getElementById('site-desc');
    const siteProxyInput = document.getElementById('site-proxy');
    const searchCategoryButtonsContainer = document.getElementById('search-category-buttons');
    const searchEngineCheckboxesContainer = document.getElementById('search-engine-checkboxes');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const suggestionsList = document.getElementById('suggestions-list');
    const alertConfirmModal = document.getElementById('alert-confirm-modal');
    const alertConfirmTitle = document.getElementById('alert-confirm-title');
    const alertConfirmMessage = document.getElementById('alert-confirm-message');
    const alertConfirmOkBtn = document.getElementById('alert-confirm-ok-btn');
    const alertConfirmCancelBtn = document.getElementById('alert-confirm-cancel-btn');

    // =========================================================================
    // 通用模态框 (MODAL HELPERS)
    // =========================================================================
    function showModal(modalElement) {
        modalElement.classList.remove('modal-hidden');
    }

    function hideModal(modalElement) {
        modalElement.classList.add('modal-hidden');
    }

    function showAlert(message, title = '提示') {
        return new Promise(resolve => {
            alertConfirmTitle.textContent = title;
            alertConfirmMessage.innerHTML = message.replace(/\n/g, '<br>');

            alertConfirmOkBtn.textContent = '确认';
            alertConfirmOkBtn.style.display = 'inline-block';
            alertConfirmCancelBtn.style.display = 'none';

            const cleanup = () => {
                hideModal(alertConfirmModal);
                alertConfirmOkBtn.removeEventListener('click', okListener);
                alertConfirmModal.removeEventListener('click', overlayListener);
                resolve(true);
            };

            const okListener = () => cleanup();
            const overlayListener = (e) => {
                if (e.target === alertConfirmModal) {
                    cleanup();
                }
            };

            alertConfirmOkBtn.addEventListener('click', okListener);
            alertConfirmModal.addEventListener('click', overlayListener);

            showModal(alertConfirmModal);
        });
    }

    function showConfirm(message, title = '请确认') {
        return new Promise(resolve => {
            alertConfirmTitle.textContent = title;
            alertConfirmMessage.innerHTML = message.replace(/\n/g, '<br>');

            alertConfirmOkBtn.textContent = '确认';
            alertConfirmCancelBtn.textContent = '取消';
            alertConfirmOkBtn.style.display = 'inline-block';
            alertConfirmCancelBtn.style.display = 'inline-block';

            const cleanup = (result) => {
                hideModal(alertConfirmModal);
                alertConfirmOkBtn.removeEventListener('click', okListener);
                alertConfirmCancelBtn.removeEventListener('click', cancelListener);
                alertConfirmModal.removeEventListener('click', overlayListener);
                resolve(result);
            };

            const okListener = () => cleanup(true);
            const cancelListener = () => cleanup(false);
            const overlayListener = (e) => {
                if (e.target === alertConfirmModal) {
                    cleanup(false);
                }
            };

            alertConfirmOkBtn.addEventListener('click', okListener);
            alertConfirmCancelBtn.addEventListener('click', cancelListener);
            alertConfirmModal.addEventListener('click', overlayListener);

            showModal(alertConfirmModal);
        });
    }


    // =========================================================================
    // 数据导入/导出 (DATA IMPORT/EXPORT)
    // =========================================================================
    function handleExport() {
        saveNavData();
        const dataStr = JSON.stringify(siteData, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = (new Date).toISOString().slice(0, 10);
        a.download = `NavHub-Export-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url)
    }

    function handleImportClick() {
        importFileInput.click()
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader;
        reader.onload = e => {
            try {
                pendingImportData = JSON.parse(e.target.result);
                if (!pendingImportData || !Array.isArray(pendingImportData.categories)) {
                    throw new Error("无效的 NavHub 文件格式。")
                }
                importNameModal.classList.remove('modal-hidden');
                importNameInput.focus()
            } catch (error) {
                showAlert(`无法解析文件: ${error.message}`, '导入错误');
                pendingImportData = null
            }
        };
        reader.onerror = () => {
            showAlert('读取文件时出错。', '文件读取失败');
        };
        reader.readAsText(file);
        event.target.value = ''
    }

    function handleImportNameSubmit(e) {
        e.preventDefault();
        const newName = importNameInput.value.trim();
        if (!newName) return;

        const nameExists = allSiteDataSources.some(source => source.name === newName);
        if (nameExists) {
            importNameError.textContent = '此名称已存在，请换一个。';
            importNameError.style.display = 'block';
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
        populateDataSourceSelector();

        // The imported data now completely overwrites the current data.
        siteData = JSON.parse(JSON.stringify(newCustomSource.data)); // Deep copy to prevent mutation
        saveNavData();
        renderNavPage();
        dataSourceSelect.value = newName;
        originalDataSourceValue = newName;
        updateDeleteButtonState(); // Update button state after import

        closeImportNameModal();
    }

    function getCustomSources() {
        try {
            return JSON.parse(localStorage.getItem(NAV_CUSTOM_SOURCES_KEY)) || []
        } catch {
            return []
        }
    }

    function closeImportNameModal() {
        importNameModal.classList.add('modal-hidden');
        importNameForm.reset();
        importNameError.style.display = 'none';
        pendingImportData = null
    }

    async function handleDeleteSource() {
        const sourceIdentifier = dataSourceSelect.value;
        const source = allSiteDataSources.find(s => (s.path || s.name) === sourceIdentifier);

        if (!source || source.path) {
            await showAlert('无法删除内置的默认数据源。');
            return;
        }

        const confirmed = await showConfirm(`确定要删除数据源 "${source.name}" 吗？此操作不可撤销。`);
        if (!confirmed) {
            return;
        }

        // Perform deletion
        const customSources = getCustomSources();
        const updatedCustomSources = customSources.filter(s => s.name !== source.name);
        localStorage.setItem(NAV_CUSTOM_SOURCES_KEY, JSON.stringify(updatedCustomSources));

        await showAlert(`数据源 "${source.name}" 已被删除。`);

        // Reload and switch to a safe default
        loadAllDataSources();
        populateDataSourceSelector();
        // Switch to the very first default data source
        const safeSourcePath = defaultSiteDataSources[0].path;
        performDataSourceSwitch(safeSourcePath);
    }

    // =========================================================================
    // 增强搜索功能 (ENHANCED SEARCH)
    // =========================================================================
    function initEnhancedSearch() {
        renderSearchCategories();
        if (searchConfig.categories.length > 0) {
            selectSearchCategory(searchConfig.categories[0].value)
        }
        searchForm.addEventListener('submit', handleSearchSubmit);
        searchInput.addEventListener('input', handleSuggestionInput);
        suggestionsList.addEventListener('mouseleave', startSuggestionTimer);
        suggestionsList.addEventListener('mouseenter', clearSuggestionTimer);
        document.addEventListener('click', e => {
            if (e.target !== searchInput && !suggestionsList.contains(e.target)) {
                suggestions = [];
                renderSuggestions()
            }
        });
        window.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                suggestions = [];
                renderSuggestions()
            }
        })
    }

    function renderSearchCategories() {
        searchCategoryButtonsContainer.innerHTML = '';
        searchConfig.categories.forEach(cat => {
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.textContent = cat.label;
            button.dataset.value = cat.value;
            button.addEventListener('click', () => selectSearchCategory(cat.value));
            searchCategoryButtonsContainer.appendChild(button)
        })
    }

    function selectSearchCategory(categoryValue) {
        currentSearchCategory = categoryValue;
        const buttons = searchCategoryButtonsContainer.querySelectorAll('.category-btn');
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === categoryValue));
        renderEngineCheckboxes()
    }

    function renderEngineCheckboxes() {
        searchEngineCheckboxesContainer.innerHTML = '';
        const engines = searchConfig.engines[currentSearchCategory] || [];
        engines.forEach(engine => {
            const label = document.createElement('label');
            label.className = 'engine-checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = engine.url;
            checkbox.checked = true;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${engine.name}`));
            searchEngineCheckboxesContainer.appendChild(label)
        })
    }

    function filterNavCards(query) {
        const searchTerm = query.toLowerCase().trim();
        const sections = document.querySelectorAll('.category-section');

        if (searchTerm === '') {
            sections.forEach(section => {
                section.style.display = '';
                section.querySelectorAll('.card').forEach(card => {
                    card.style.display = '';
                });
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
                // Get pre-calculated pinyin from data attributes
                const pinyinFull = card.dataset.pinyinFull || '';
                const pinyinInitials = card.dataset.pinyinInitials || '';

                if (title.includes(searchTerm) ||
                    desc.includes(searchTerm) ||
                    url.includes(searchTerm) ||
                    pinyinFull.includes(searchTerm) ||
                    pinyinInitials.includes(searchTerm)
                ) {
                    card.style.display = '';
                    visibleCardsInSection++;
                } else {
                    card.style.display = 'none';
                }
            });
            if (section.id === CUSTOM_CATEGORY_ID) {
                section.style.display = '';
            } else {
                section.style.display = visibleCardsInSection > 0 ? '' : 'none';
            }
        });
    }


    function handleSearchSubmit(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        const checkedEngines = searchEngineCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
        if (query === '' && checkedEngines.length > 0) {
            const firstEngine = checkedEngines[0];
            const urlTemplate = firstEngine.value;
            const regex = /^(https?:\/\/[^\/]+)\//;
            const match = urlTemplate.match(regex);
            if (match) window.open(match[1], "_blank");
            return
        }
        if (checkedEngines.length === 0) {
            showAlert('请至少选择一个搜索引擎！');
            return
        }
        checkedEngines.forEach(engineCheckbox => {
            const urlTemplate = engineCheckbox.value;
            const searchUrl = urlTemplate.replaceAll('%s', encodeURIComponent(query));
            window.open(searchUrl, '_blank')
        });
        suggestions = [];
        renderSuggestions()
    }

    function handleSuggestionInput() {
        const query = searchInput.value.trim();
        filterNavCards(query);
        if (query !== '') {
            const script = document.createElement('script');
            script.src = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&cb=window.baidu.sug`;
            document.body.appendChild(script);
            script.onload = () => document.body.removeChild(script);
            script.onerror = () => document.body.removeChild(script)
        } else {
            suggestions = [];
            renderSuggestions()
        }
        clearSuggestionTimer();
        startSuggestionTimer()
    }

    window.baidu = {
        sug: data => {
            suggestions = (data && data.s) ? data.s : [];
            renderSuggestions()
        }
    };

    function renderSuggestions() {
        suggestionsList.innerHTML = '';
        if (suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.className = 'suggestion-item';
                li.textContent = suggestion;
                li.addEventListener('click', () => {
                    searchInput.value = suggestion;
                    suggestions = [];
                    renderSuggestions();
                    searchInput.focus()
                });
                suggestionsList.appendChild(li)
            });
            suggestionsList.style.display = 'block'
        } else {
            suggestionsList.style.display = 'none'
        }
    }

    function startSuggestionTimer() {
        clearSuggestionTimer();
        suggestionTimer = setTimeout(() => {
            suggestions = [];
            renderSuggestions()
        }, 3000)
    }

    function clearSuggestionTimer() {
        clearTimeout(suggestionTimer)
    }

    // =========================================================================
    // 主题切换 (THEME SWITCHER)
    // =========================================================================
    function getThemePreference() {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme) return storedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        if (darkModeSwitch) darkModeSwitch.checked = theme === 'dark'
    }

    if (darkModeSwitch) {
        darkModeSwitch.addEventListener('change', () => {
            applyTheme(darkModeSwitch.checked ? 'dark' : 'light')
        })
    }

    // =========================================================================
    // 数据源切换 (DATA SOURCE SWITCHER)
    // =========================================================================
    function updateDeleteButtonState() {
        const selectedIdentifier = dataSourceSelect.value;
        const source = allSiteDataSources.find(s => (s.path || s.name) === selectedIdentifier);
        // A source with a 'path' property is a default, non-deletable source.
        deleteSourceBtn.disabled = !source || !!source.path;
    }

    function loadAllDataSources() {
        const customSources = getCustomSources();
        allSiteDataSources = [...defaultSiteDataSources, ...customSources]
    }

    function populateDataSourceSelector() {
        if (!dataSourceSelect) return;
        dataSourceSelect.innerHTML = '';
        originalDataSourceValue = dataSourceSelect.value;
        allSiteDataSources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.path || source.name;
            option.textContent = source.name;
            dataSourceSelect.appendChild(option)
        });
        dataSourceSelect.removeEventListener('change', handleDataSourceChange);
        dataSourceSelect.addEventListener('change', handleDataSourceChange);
        updateDeleteButtonState(); // Update on initial population
    }

    function handleDataSourceChange(e) {
        const newIdentifier = e.target.value;
        performDataSourceSwitch(newIdentifier);
        updateDeleteButtonState(); // Update on every change
    }

    async function performDataSourceSwitch(identifier) {
        const source = allSiteDataSources.find(s => (s.path || s.name) === identifier);
        if (!source) {
            console.error("Data source not found:", identifier);
            dataSourceSelect.value = originalDataSourceValue; // Revert dropdown on error
            updateDeleteButtonState(); // Update button state on revert
            return;
        }

        let newBaseData;
        try {
            if (source.path) { // It's a default source from a file
                const response = await fetch(source.path);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                newBaseData = await response.json();
            } else { // It's a custom source from localStorage
                newBaseData = source.data;
            }
        } catch (error) {
            showAlert(`加载数据源失败: ${source.name}\n${error.message}`, '加载错误');
            dataSourceSelect.value = originalDataSourceValue; // Revert dropdown
            updateDeleteButtonState(); // Update button state on revert
            return;
        }

        let customCategory;
        try {
            const customDataRaw = localStorage.getItem(NAV_CUSTOM_USER_SITES_KEY);
            customCategory = customDataRaw ? JSON.parse(customDataRaw) : { categoryName: '我的导航', categoryId: CUSTOM_CATEGORY_ID, sites: [] };
        } catch (e) {
            console.error("Failed to parse custom user sites, resetting.", e);
            customCategory = { categoryName: '我的导航', categoryId: CUSTOM_CATEGORY_ID, sites: [] };
        }

        const otherCategories = newBaseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);

        const newMergedData = {
            ...newBaseData,
            categories: [customCategory, ...otherCategories]
        };

        siteData = JSON.parse(JSON.stringify(newMergedData));

        saveNavData();
        originalDataSourceValue = identifier;
        if (dataSourceSelect) dataSourceSelect.value = identifier;

        renderNavPage();
        searchInput.value = '';
        filterNavCards('');
        updateDeleteButtonState(); // Update button state after a successful switch
    }

    // =========================================================================
    // 导航卡片逻辑 (NAV CARDS LOGIC)
    // =========================================================================
    async function loadNavData(filePath = DEFAULT_SITES_PATH) {
        let baseData;
        const storedBaseData = localStorage.getItem(NAV_DATA_STORAGE_KEY);

        if (storedBaseData) {
            baseData = JSON.parse(storedBaseData);
        } else {
            try {
                const response = await fetch(filePath);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                baseData = await response.json();
            } catch (error) {
                console.error(`无法加载或处理导航配置文件: ${filePath}`, error);
                baseData = { categories: [] };
            }
        }

        let customCategory;
        try {
            const customDataRaw = localStorage.getItem(NAV_CUSTOM_USER_SITES_KEY);
            customCategory = customDataRaw ? JSON.parse(customDataRaw) : { categoryName: '我的导航', categoryId: CUSTOM_CATEGORY_ID, sites: [] };
        } catch (e) {
            console.error("Failed to parse custom user sites, resetting.", e);
            customCategory = { categoryName: '我的导航', categoryId: CUSTOM_CATEGORY_ID, sites: [] };
        }

        const otherCategories = baseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
        siteData = {
            ...baseData,
            categories: [customCategory, ...otherCategories]
        };

        saveNavData();

        const lastUsedSourceIdentifier = originalDataSourceValue || filePath;
        const currentSource = allSiteDataSources.find(s => (s.path || s.name) === lastUsedSourceIdentifier) || allSiteDataSources[0];
        const currentIdentifier = currentSource.path || currentSource.name;
        originalDataSourceValue = currentIdentifier;
        if (dataSourceSelect) dataSourceSelect.value = currentIdentifier
    }

    async function loadSearchConfig() {
        try {
            const response = await fetch('data/engines.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            searchConfig = await response.json()
        } catch (error) {
            console.error("无法加载或处理搜索配置文件:", error)
        }
    }

    function saveNavData() {
        const customCategory = siteData.categories.find(c => c.categoryId === CUSTOM_CATEGORY_ID);
        if (customCategory) {
            localStorage.setItem(NAV_CUSTOM_USER_SITES_KEY, JSON.stringify(customCategory));
        }

        const baseData = JSON.parse(JSON.stringify(siteData)); // Deep copy
        baseData.categories = baseData.categories.filter(c => c.categoryId !== CUSTOM_CATEGORY_ID);
        localStorage.setItem(NAV_DATA_STORAGE_KEY, JSON.stringify(baseData));
    }

    function renderNavPage() {
        categoryList.innerHTML = '';
        contentWrapper.innerHTML = '';
        siteData.categories.forEach(category => {
            const categoryLink = document.createElement('a');
            categoryLink.href = `#${category.categoryId}`;
            categoryLink.textContent = category.categoryName;
            categoryList.appendChild(categoryLink);
            const section = document.createElement('section');
            section.id = category.categoryId;
            section.className = 'category-section';
            const titleContainer = document.createElement('div');
            titleContainer.className = 'category-title-container';
            titleContainer.innerHTML = `<h2 class="category-title">${category.categoryName}</h2>`;
            if (category.categoryId === CUSTOM_CATEGORY_ID) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'title-actions';
                actionsDiv.innerHTML = `
                    <button id="add-site-btn" class="action-btn" data-category-id="${category.categoryId}">新增</button>
                    <button id="edit-site-btn" class="action-btn">编辑</button>
                    <button id="delete-site-btn" class="action-btn">删除</button>
                `;
                titleContainer.appendChild(actionsDiv)
            }
            const cardGrid = document.createElement('div');
            cardGrid.className = 'card-grid';
            category.sites.forEach(site => cardGrid.innerHTML += createCardHTML(site));
            section.appendChild(titleContainer);
            section.appendChild(cardGrid);
            contentWrapper.appendChild(section)
        });
        setupSidebarLinks()
    }

    function createCardHTML(site) {
        const proxyBadge = site.proxy ? '<div class="proxy-badge">Proxy</div>' : '';
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
                    <img src="${site.icon}" alt="${site.title}" class="card-icon" draggable="false" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
                    <h3 class="card-title">${site.title}</h3>
                </div>
                <p class="card-desc">${site.desc || ''}</p>
            </div>`;
    }

    function setupSidebarLinks() {
        const links = categoryList.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const targetElement = document.querySelector(this.getAttribute('href'));
                if (targetElement) targetElement.scrollIntoView({behavior: 'smooth'})
            })
        });
        const sections = document.querySelectorAll('.category-section');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    links.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${entry.target.id}`) {
                            link.classList.add('active')
                        }
                    })
                }
            })
        }, {rootMargin: "-50% 0px -50% 0px"});
        sections.forEach(section => observer.observe(section))
    }

    function findSiteById(siteId) {
        for (const category of siteData.categories) {
            const site = category.sites.find(s => s.id === siteId);
            if (site) return {site, category}
        }
        return {site: null, category: null}
    }

    function openSiteModal(mode, site = null, categoryId = CUSTOM_CATEGORY_ID) {
        siteForm.reset();
        categoryIdInput.value = categoryId;
        if (mode === 'add') {
            modalTitle.textContent = '新增网站';
            siteIdInput.value = ''
        } else if (mode === 'edit' && site) {
            modalTitle.textContent = '编辑网站';
            siteIdInput.value = site.id;
            siteUrlInput.value = site.url;
            siteTitleInput.value = site.title;
            siteIconInput.value = site.icon || '';
            siteDescInput.value = site.desc || '';
            siteProxyInput.checked = site.proxy || false
        }
        siteModal.classList.remove('modal-hidden')
    }

    function closeSiteModal() {
        siteModal.classList.add('modal-hidden')
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const siteId = siteIdInput.value;
        const targetCategoryId = categoryIdInput.value;
        const sitePayload = {
            id: siteId || `site-${Date.now()}-${Math.random()}`,
            url: siteUrlInput.value,
            title: siteTitleInput.value,
            icon: siteIconInput.value,
            desc: siteDescInput.value,
            proxy: siteProxyInput.checked
        };
        if (siteId) {
            const {site} = findSiteById(siteId);
            if (site) Object.assign(site, sitePayload)
        } else {
            const targetCategory = siteData.categories.find(c => c.categoryId === targetCategoryId);
            if (targetCategory) targetCategory.sites.push(sitePayload)
        }
        saveNavData();
        renderNavPage();
        closeSiteModal();
        filterNavCards(searchInput.value)
    }

    function toggleEditMode() {
        if (contentWrapper.classList.contains('is-deleting')) {
            toggleDeleteMode()
        }
        contentWrapper.classList.toggle('is-editing');
        const isInEditMode = contentWrapper.classList.contains('is-editing');
        const editBtn = document.getElementById('edit-site-btn');
        if (editBtn) {
            editBtn.classList.toggle('active', isInEditMode);
            editBtn.textContent = isInEditMode ? '完成' : '编辑'
        }
        // --- BUG FIX: Only make cards in the custom category draggable ---
        document.querySelectorAll(`#${CUSTOM_CATEGORY_ID} .card`).forEach(card => card.draggable = isInEditMode)
    }

    function toggleDeleteMode() {
        if (contentWrapper.classList.contains('is-editing')) {
            toggleEditMode()
        }
        contentWrapper.classList.toggle('is-deleting');
        const isInDeleteMode = contentWrapper.classList.contains('is-deleting');
        const deleteBtn = document.getElementById('delete-site-btn');
        if (deleteBtn) {
            deleteBtn.classList.toggle('active', isInDeleteMode);
            deleteBtn.textContent = isInDeleteMode ? '完成' : '删除'
        }
    }

    function handleCardDelete(cardElement) {
        const siteId = cardElement.dataset.id;
        const {site, category} = findSiteById(siteId);
        if (site && category) {
            category.sites = category.sites.filter(s => s.id !== siteId);
            saveNavData();
            cardElement.remove()
        }
    }

    function setupStaticNavEventListeners() {
        cancelBtn.addEventListener('click', closeSiteModal);
        siteModal.addEventListener('click', (e) => {
            if (e.target === siteModal) closeSiteModal();
        });
        siteForm.addEventListener('submit', handleFormSubmit);

        siteUrlInput.addEventListener('blur', (e) => {
            if (siteIconInput.value || !e.target.value) return;
            try {
                const url = new URL(e.target.value);
                siteIconInput.value = `${url.origin}/favicon.ico`;
            } catch (error) { /* silently fail */
            }
        });

        exportBtn.addEventListener('click', handleExport);
        importBtn.addEventListener('click', handleImportClick);
        deleteSourceBtn.addEventListener('click', handleDeleteSource);
        importFileInput.addEventListener('change', handleFileSelect);
        importNameForm.addEventListener('submit', handleImportNameSubmit);
        cancelImportNameBtn.addEventListener('click', closeImportNameModal);
        importNameModal.addEventListener('click', (e) => {
            if (e.target === importNameModal) closeImportNameModal();
        });
    }

    function setupDynamicNavEventListeners() {
        contentWrapper.addEventListener('click', e => {
            const editSiteBtn = e.target.closest('#edit-site-btn');
            const addSiteBtn = e.target.closest('#add-site-btn');
            const deleteSiteBtn = e.target.closest('#delete-site-btn');
            const card = e.target.closest('.card');
            if (editSiteBtn) {
                toggleEditMode();
                return
            }
            if (addSiteBtn) {
                openSiteModal('add', null, addSiteBtn.dataset.categoryId);
                return
            }
            if (deleteSiteBtn) {
                toggleDeleteMode();
                return
            }
            if (card) {
                e.preventDefault();
                const isInEditMode = contentWrapper.classList.contains('is-editing');
                const isInDeleteMode = contentWrapper.classList.contains('is-deleting');
                if (isInDeleteMode) {
                    handleCardDelete(card)
                } else if (isInEditMode) {
                    const {site} = findSiteById(card.dataset.id);
                    if (site) openSiteModal('edit', site)
                } else {
                    window.open(card.dataset.url, '_blank')
                }
            }
        });
        let draggedItem = null, placeholder = null;
        contentWrapper.addEventListener('dragstart', e => {
            if (e.target.classList.contains('card') && e.target.draggable) {
                draggedItem = e.target;
                placeholder = document.createElement('div');
                placeholder.className = 'placeholder';
                placeholder.style.width = `${draggedItem.offsetWidth}px`;
                placeholder.style.height = `${draggedItem.offsetHeight}px`;
                setTimeout(() => draggedItem.classList.add('dragging'), 0)
            }
        });
        contentWrapper.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedItem) return;
            const overCard = e.target.closest('.card:not(.dragging)');
            const overGrid = e.target.closest('.card-grid');
            if (overCard) {
                const rect = overCard.getBoundingClientRect();
                const midpointY = rect.top + rect.height / 2;
                overCard.parentNode.insertBefore(placeholder, e.clientY < midpointY ? overCard : overCard.nextSibling)
            } else if (overGrid && !overGrid.querySelector('.placeholder')) {
                overGrid.appendChild(placeholder)
            }
        });
        contentWrapper.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggedItem || !placeholder || !placeholder.parentNode) return;
            const draggedSiteId = draggedItem.dataset.id;
            const {site: draggedSite, category: sourceCategory} = findSiteById(draggedSiteId);
            const targetGrid = placeholder.closest('.card-grid');
            const targetSection = placeholder.closest('.category-section');
            const targetCategoryId = targetSection.id;
            if (!draggedSite || !targetCategoryId) return;
            sourceCategory.sites = sourceCategory.sites.filter(s => s.id !== draggedSiteId);
            placeholder.parentNode.replaceChild(draggedItem, placeholder);
            const targetCategory = siteData.categories.find(c => c.categoryId === targetCategoryId);
            const newOrderedIds = Array.from(targetGrid.querySelectorAll('.card')).map(c => c.dataset.id);
            const siteMap = new Map(siteData.categories.flatMap(c => c.sites).map(s => [s.id, s]));
            siteMap.set(draggedSiteId, draggedSite);
            targetCategory.sites = newOrderedIds.map(id => siteMap.get(id)).filter(Boolean);
            saveNavData()
        });
        contentWrapper.addEventListener('dragend', () => {
            if (draggedItem) draggedItem.classList.remove('dragging');
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            draggedItem = null;
            placeholder = null
        })
    }

    // =========================================================================
    // 初始化 (INITIALIZATION)
    // =========================================================================
    async function init() {
        applyTheme(getThemePreference());
        loadAllDataSources();
        populateDataSourceSelector();
        setupStaticNavEventListeners();
        setupDynamicNavEventListeners();

        // Use Promise.all to load all necessary data concurrently
        await Promise.all([
            loadNavData(),
            loadSearchConfig(),
            pinyinConverter.loadMap('data/pinyin-map.json')
        ]);

        renderNavPage();
        initEnhancedSearch();
        updateDeleteButtonState(); // Set initial state of the delete button
    }

    init();
});