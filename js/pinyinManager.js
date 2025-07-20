// =========================================================================
// pinyinManager.js - 拼音转换工具
// 职责: 提供汉字到拼音的转换功能。
//
// 工作方式:
// 这是一个自执行函数 (IIFE)，它会创建一个全局唯一的 `pinyinConverter` 对象。
// 这种设计使其可以作为一个独立的工具库，在项目的任何地方都能方便地访问。
// 必须在使用前通过调用 `loadMap()` 方法加载拼音映射文件。
// =========================================================================

const pinyinManager = (function() {
    // 内部状态，用于存储拼音映射表，不会污染全局作用域。
    let pinyinMap = {};

    /**
     * 异步加载拼音映射表文件。这是使用该转换器的第一步。
     * @param {string} [path='data/pinyin-map.json'] - pinyin-map.json 文件的路径。
     * @returns {Promise<void>}
     */
    async function loadMap(path = 'data/pinyin-map.json') {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`无法加载拼音映射文件: ${response.statusText}`);
            }
            pinyinMap = await response.json();
        } catch (error) {
            console.error('拼音映射表加载失败:', error);
            // 如果加载失败，回退为空对象，防止程序崩溃。
            pinyinMap = {};
        }
    }

    /**
     * 将包含汉字的字符串转换为拼音。
     * @param {string} text - 输入的字符串，可以包含中英文、数字和符号。
     * @returns {{full: string, initials: string}} 一个包含全拼和首字母缩写的对象。
     */
    function convert(text) {
        if (!text) {
            return { full: '', initials: '' };
        }

        let fullPinyin = '';
        let initials = '';

        for (const char of text) {
            if (pinyinMap[char]) {
                // 如果是可转换的汉字
                const pinyin = pinyinMap[char];
                fullPinyin += pinyin;
                initials += pinyin.charAt(0);
            } else {
                // 对于非中文字符（如字母、数字、符号），直接保留在全拼中，
                // 但不将其添加到首字母（initials）中，以确保首字母搜索的准确性。
                // 例如 "NavHub-导航" 的首字母应为 "nhd" 而不是 "NavHub-dh"。
                fullPinyin += char;
            }
        }

        // 统一返回小写形式，便于不区分大小写的比较。
        return {
            full: fullPinyin.toLowerCase(),
            initials: initials.toLowerCase()
        };
    }

    // 返回公共接口
    return {
        loadMap,
        convert
    };
})();