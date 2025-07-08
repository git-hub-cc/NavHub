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
                // 对于非中文字符，直接保留
                fullPinyin += char;
                initials += char;
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