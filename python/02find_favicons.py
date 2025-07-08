import requests
import re
from urllib.parse import urljoin, urlparse

# --- 配置 ---
INPUT_FILE = 'url.txt'
SUCCESS_FILE = 'url&favicon.txt'
ERROR_FILE = 'error.txt'

# 设置请求头，模拟浏览器访问，防止被部分网站拒绝
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# --- 函数定义 ---

def find_favicon_in_html(html_content, base_url):
    """使用正则表达式在HTML内容中查找favicon。"""
    # 正则表达式，用于匹配 <link ... rel="...icon..." ... href="..." >
    # 它会捕获 href 属性的值
    # re.IGNORECASE 忽略大小写，因为 rel 可能是 "ICON"
    pattern = re.compile(r'<link[^>]*?rel=[\'"](?:shortcut )?icon[\'"][^>]*?href=[\'"]([^\'"]+)[\'"]', re.IGNORECASE)
    match = pattern.search(html_content)

    if match:
        # match.group(1) 提取第一个捕获组的内容，即 href 的值
        favicon_path = match.group(1)
        # 使用 urljoin 将可能为相对路径的 favicon 地址转换为绝对 URL
        return urljoin(base_url, favicon_path)
    return None

def check_default_favicon(base_url):
    """检查网站根目录下是否存在默认的 favicon.ico。"""
    default_favicon_url = urljoin(base_url, '/favicon.ico')
    try:
        # 使用 HEAD 请求，只获取响应头，不下载文件内容，速度更快
        response = requests.head(default_favicon_url, headers=HEADERS, timeout=5, allow_redirects=True)
        if response.status_code == 200:
            return default_favicon_url
    except requests.exceptions.RequestException:
        # 忽略检查时的网络错误
        pass
    return None

# --- 主程序 ---

def main():
    """主执行函数"""
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"错误: 输入文件 '{INPUT_FILE}' 未找到。")
        return

    print(f"共找到 {len(urls)} 个 URL。开始处理...")

    # 使用 'w' 模式打开文件，每次运行都会清空旧内容
    with open(SUCCESS_FILE, 'w', encoding='utf-8') as f_success, \
         open(ERROR_FILE, 'w', encoding='utf-8') as f_error:

        for i, url in enumerate(urls):
            print(f"[{i+1}/{len(urls)}] 正在处理: {url}")
            favicon_url = None

            try:
                # 1. 请求原始 URL
                response = requests.get(url, headers=HEADERS, timeout=10)

                # 2. 检查响应状态码
                if response.status_code == 200:
                    # 3. 优先在 HTML 中查找 favicon
                    favicon_url = find_favicon_in_html(response.text, url)

                    # 4. 如果没找到，尝试检查默认的 /favicon.ico
                    if not favicon_url:
                        print(" -> 在HTML中未找到，尝试检查 /favicon.ico ...")
                        favicon_url = check_default_favicon(url)

                    if favicon_url:
                        print(f"  \033[92m[成功]\033[0m 找到 Favicon: {favicon_url}")
                        f_success.write(f"{url} {favicon_url}\n")
                    else:
                        error_msg = f"{url} - 响应200但未找到Favicon"
                        print(f"  \033[93m[警告]\033[0m {error_msg}")
                        f_error.write(error_msg + '\n')
                else:
                    error_msg = f"{url} - 响应状态码: {response.status_code}"
                    print(f"  \033[91m[错误]\033[0m {error_msg}")
                    f_error.write(error_msg + '\n')

            except requests.exceptions.RequestException as e:
                # 捕获所有 requests 相关的异常 (如连接错误, 超时等)
                error_msg = f"{url} - 请求失败: {type(e).__name__}"
                print(f"  \033[91m[错误]\033[0m {error_msg}")
                f_error.write(error_msg + '\n')

    print("\n处理完成！")
    print(f"成功的结果已保存到: {SUCCESS_FILE}")
    print(f"失败或错误的记录已保存到: {ERROR_FILE}")


if __name__ == "__main__":
    main()