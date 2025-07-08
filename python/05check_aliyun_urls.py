import requests
import re
import os
import json
import time
from tqdm import tqdm

# --- 配置 ---
API_URL_S = "https://api.aliyundrive.com/adrive/v3/share_link/get_share_by_anonymous"
API_URL_T = "https://api.aliyundrive.com/adrive/v1/share/getByAnonymous"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Referer': 'https://www.aliyundrive.com/',
    'Content-Type': 'application/json'
}
# 每个请求后的强制等待时间（秒）
REQUEST_DELAY = 1.5

def get_share_info(url: str) -> tuple | None:
    """从URL中提取 share_id 和链接类型 ('s' 或 't')"""
    s_match = re.search(r'aliyundrive\.com/s/([a-zA-Z0-9]+)', url)
    if s_match:
        return s_match.group(1), 's'

    t_match = re.search(r'aliyundrive\.com/t/([a-zA-Z0-9]+)', url)
    if t_match:
        return t_match.group(1), 't'

    return None

def check_url_sync(session: requests.Session, url: str) -> tuple:
    """
    同步检查单个URL的状态。
    """
    share_info = get_share_info(url)
    if not share_info:
        return url, "格式错误", "无法从URL中提取share_id"

    share_id, link_type = share_info
    api_url = API_URL_S if link_type == 's' else API_URL_T
    payload = json.dumps({"share_id": share_id})

    try:
        response = session.post(api_url, data=payload, headers=HEADERS, timeout=15)

        # 即使是同步模式，也检查一下429，以防万一
        if response.status_code == 429:
            return url, "请求失败", "触发限速(429)，请尝试增加REQUEST_DELAY的值"

        if response.status_code == 200:
            data = response.json()
            if 'code' in data:
                code = data.get('code', '')
                if 'Password' in code: return url, "需要提取码", "链接需要密码"
                if 'ShareLink' in code or 'NotFound' in code or 'Expired' in code or 'Cancelled' in code: return url, "失效", f"API返回错误码: {code}"
                return url, "未知", f"API返回了未明确处理的代码: {code}"

            if data.get('file_infos') or data.get('file_name') or data.get('share_name'):
                if data.get('file_count') == 0: return url, "有效 (空目录)", data.get('share_name', 'N/A')
                return url, "有效", data.get('share_name', 'N/A')

            return url, "未知", "API响应格式无法解析"

        return url, "请求失败", f"HTTP状态码: {response.status_code}"

    except requests.exceptions.Timeout:
        return url, "请求失败", "请求超时"
    except requests.exceptions.RequestException as e:
        return url, "请求失败", f"网络请求发生错误: {e}"

def main(filename: str):
    """主函数，读取文件并按顺序处理所有URL。"""
    if not os.path.exists(filename):
        print(f"错误：文件 '{filename}' 不存在。")
        return

    with open(filename, 'r', encoding='utf-8') as f:
        urls = sorted(list(set([line.strip() for line in f if line.strip()])))

    if not urls:
        print(f"文件 '{filename}' 为空。")
        return

    print(f"从 {filename} 读取到 {len(urls)} 个唯一的URL。")
    print(f"将以每 {REQUEST_DELAY} 秒一个的速度进行检查，请耐心等待...")

    results = []
    # 使用Session对象可以复用TCP连接，略微提高效率
    with requests.Session() as session:
        for url in tqdm(urls, desc="检查进度"):
            result = check_url_sync(session, url)
            results.append(result)
            # 严格执行等待时间
            time.sleep(REQUEST_DELAY)

    # --- 分类和报告 ---
    invalid_urls, valid_urls, password_urls, failed_urls = [], [], [], []
    for url, status, message in results:
        if status == "失效": invalid_urls.append(url)
        elif status.startswith("有效"): valid_urls.append(url)
        elif status == "需要提取码": password_urls.append(url)
        else: failed_urls.append(f"{url} ({status}: {message})")

    print("\n" + "="*60 + "\n检查完成！\n" + "="*60 + "\n")

    if invalid_urls:
        print(f"--- 发现 {len(invalid_urls)} 个失效的链接 ---")
        for url in invalid_urls: print(url)
    else:
        print("--- 未发现任何失效的链接 ---")

    if failed_urls:
        print(f"\n--- {len(failed_urls)} 个链接检查失败或格式错误 ---")
        for url_info in failed_urls: print(url_info)

    print("\n" + "--- 总结 ---".center(60))
    print(f"总链接数（去重后）: {len(urls)}")
    print(f"有效链接          : {len(valid_urls)}")
    print(f"需要提取码        : {len(password_urls)}")
    print(f"失效链接          : {len(invalid_urls)}")
    print(f"检查失败/格式错误   : {len(failed_urls)}")
    print("="*60)

if __name__ == "__main__":
    main("url_all.txt")