/**
 * githubClient.js
 * 职责: 封装与 GitHub REST API 的所有交互。
 * 包括: 用户验证、仓库检查、文件读取(Base64解码)、文件写入(Base64编码+SHA校验)。
 * 特性: 支持 UTF-8 字符（解决中文乱码），内置错误处理。
 */

export class GitHubClient {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.token = null;
        this.repo = null; // 格式: username/repo-name
        this.branch = 'main'; // 默认分支
    }

    /**
     * 设置认证 Token
     * @param {string} token
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * 设置目标仓库
     * @param {string} repo
     */
    setRepo(repo) {
        this.repo = repo;
    }

    /**
     * 获取通用请求头
     */
    _getHeaders() {
        return {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        };
    }

    /**
     * 验证 Token 有效性并获取用户信息
     * @returns {Promise<Object>} 用户信息对象
     */
    async getUser() {
        if (!this.token) throw new Error("Token 未设置");
        const res = await fetch(`${this.baseUrl}/user`, {
            headers: this._getHeaders()
        });
        if (!res.ok) {
            if (res.status === 401) throw new Error("无效的 GitHub Token");
            throw new Error(`获取用户信息失败: ${res.status}`);
        }
        return await res.json();
    }

    /**
     * 检查仓库是否存在
     * @param {string} username
     * @param {string} repoName
     * @returns {Promise<boolean>}
     */
    async checkRepoExists(username, repoName) {
        const res = await fetch(`${this.baseUrl}/repos/${username}/${repoName}`, {
            headers: this._getHeaders()
        });
        return res.status === 200;
    }

    /**
     * 创建数据存储仓库
     * @param {string} repoName
     * @returns {Promise<Object>}
     */
    async createRepo(repoName) {
        const res = await fetch(`${this.baseUrl}/user/repos`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({
                name: repoName,
                description: 'NavHub 个人导航数据存储仓库',
                private: true, // 默认为私有仓库以保护隐私
                auto_init: true // 自动初始化，创建 README
            })
        });
        if (!res.ok) throw new Error("创建仓库失败");
        return await res.json();
    }

    /**
     * 读取文件内容
     * @param {string} path 文件路径 (如 data.json)
     * @returns {Promise<{content: any, sha: string}|null>} 返回解析后的JSON内容和SHA值，文件不存在返回null
     */
    async getFile(path) {
        if (!this.repo) throw new Error("仓库未设置");

        // 添加时间戳防止缓存
        const url = `${this.baseUrl}/repos/${this.repo}/contents/${path}?t=${Date.now()}`;
        const res = await fetch(url, {
            headers: this._getHeaders()
        });

        if (res.status === 404) return null; // 文件不存在
        if (!res.ok) throw new Error(`读取文件失败: ${res.status}`);

        const data = await res.json();

        // GitHub API 返回的内容是 Base64 编码的
        // 使用 decodeURIComponent(escape(atob())) 解决中文乱码问题
        try {
            const rawContent = data.content.replace(/\n/g, '');
            const decodedContent = decodeURIComponent(escape(window.atob(rawContent)));
            return {
                content: JSON.parse(decodedContent),
                sha: data.sha
            };
        } catch (e) {
            console.error("文件解析失败", e);
            throw new Error("远程文件格式错误");
        }
    }

    /**
     * 创建或更新文件
     * @param {string} path 文件路径
     * @param {Object} contentJSON 要保存的 JSON 对象
     * @param {string} sha (可选) 更新文件时必须提供上一个版本的 SHA
     * @param {string} message commit 信息
     */
    async saveFile(path, contentJSON, sha = null, message = "Update NavHub data") {
        if (!this.repo) throw new Error("仓库未设置");

        // 编码为 Base64，处理中文
        const contentStr = JSON.stringify(contentJSON, null, 2);
        const contentBase64 = window.btoa(unescape(encodeURIComponent(contentStr)));

        const body = {
            message: message,
            content: contentBase64,
            branch: this.branch
        };

        if (sha) {
            body.sha = sha;
        }

        const res = await fetch(`${this.baseUrl}/repos/${this.repo}/contents/${path}`, {
            method: 'PUT',
            headers: this._getHeaders(),
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            // 处理并发冲突 (409 Conflict)
            if (res.status === 409) throw new Error("版本冲突，请刷新页面后重试");
            throw new Error(`保存失败: ${res.status}`);
        }

        return await res.json();
    }
}

// 导出单例，方便全局调用
export const githubClient = new GitHubClient();