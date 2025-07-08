// pinyin-converter.js

const pinyinConverter = (function() {
    let pinyinMap = {};

    /**
     * 加载拼音映射表
     * @param {string} path - pinyin-map.json 文件的路径
     */
    async function loadMap(path = 'pinyin-map.json') {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load pinyin map: ${response.statusText}`);
            }
            pinyinMap = await response.json();
            console.log('Pinyin map loaded successfully.');
        } catch (error) {
            console.error(error);
            // Fallback to an empty map if loading fails
            pinyinMap = {};
        }
    }

    /**
     * 将汉字字符串转换为拼音
     * @param {string} text - 输入的字符串
     * @returns {{full: string, initials: string}} - 包含全拼和简拼的对象
     */
    function convert(text) {
        if (!text) {
            return { full: '', initials: '' };
        }

        let fullPinyin = '';
        let initials = '';

        for (const char of text) {
            if (pinyinMap[char]) {
                const pinyin = pinyinMap[char];
                fullPinyin += pinyin;
                initials += pinyin.charAt(0);
            } else {
                // 对于非中文字符，只将其保留在全拼（fullPinyin）中。
                // 不将其添加到首字母（initials）字符串中，以避免混合字符导致的不准确匹配。
                // 例如，"数学-李" 的首字母串不应是 "sx-l"，而应是 "sxl"。
                // 这可以防止 "xl" 错误地匹配 "学-李"，并确保 "sx" 能正确匹配 "数学"。
                fullPinyin += char;
                // 此处原有的 'initials += char;' 已被移除，以修复bug。
            }
        }
        return {
            full: fullPinyin.toLowerCase(),
            initials: initials.toLowerCase()
        };
    }

    return {
        loadMap,
        convert
    };
})();