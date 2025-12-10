import os
import json
import re
import base64
import requests
import mimetypes
import time
import threading
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================= 配置区域 =================
# 数据目录
DATA_DIR = '../data'
# 要处理的文件扩展名
TARGET_EXT = '.json'
# 需要排除的配置文件
EXCLUDED_FILES = [
    'package-lock.json',
    'engines.json',
    'pinyin-map.json'
]

# 请求头
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
}

# 超时设置 (秒)
TIMEOUT = 10
# Base64 转换的大小限制 (字节)，50KB
MAX_ICON_SIZE = 50 * 1024
# 并发线程数
MAX_WORKERS = 20
# 同一域名请求间隔 (秒)
DOMAIN_REQUEST_INTERVAL = 1.0
# ===========================================

class DomainRateLimiter:
    """
    域名速率限制器
    用于在多线程环境下控制对同一域名的请求频率
    """
    def __init__(self, interval):
        self.interval = interval
        self.domains = {}  # 记录域名最后访问时间 { 'baidu.com': 1680000000.00 }
        self.lock = threading.Lock() # 线程锁，保证字典读写安全

    def wait_if_needed(self, url):
        """
        解析URL中的域名，如果该域名最近刚被访问过，则强制休眠
        """
        try:
            domain = urlparse(url).netloc
            if not domain:
                return

            wait_time = 0

            with self.lock:
                last_time = self.domains.get(domain, 0)
                now = time.time()
                # 计算需要等待的时间： 间隔 - (当前时间 - 上次时间)
                diff = now - last_time
                if diff < self.interval:
                    wait_time = self.interval - diff
                    # 更新该域名的预计完成时间（当前时间 + 需要等待的时间）
                    # 这样下一个线程进来时，会基于这个更新后的时间计算等待
                    self.domains[domain] = now + wait_time
                else:
                    self.domains[domain] = now

            # 在锁外部进行休眠，避免阻塞其他针对不同域名的线程
            if wait_time > 0:
                time.sleep(wait_time)

        except Exception:
            # 解析出错则不限制，避免阻断流程
            pass

# 初始化全局限流器
rate_limiter = DomainRateLimiter(DOMAIN_REQUEST_INTERVAL)

def get_target_files(directory):
    """获取目录下所有需要处理的JSON文件"""
    files = []
    if not os.path.exists(directory):
        print(f"❌ 目录不存在: {directory}")
        return []

    for filename in os.listdir(directory):
        if filename.endswith(TARGET_EXT) and filename not in EXCLUDED_FILES:
            files.append(os.path.join(directory, filename))
    return files

def image_to_base64(content, content_type):
    """将二进制图片内容转换为Base64字符串"""
    try:
        base64_data = base64.b64encode(content).decode('utf-8')
        return f"data:{content_type};base64,{base64_data}"
    except Exception as e:
        print(f"   ⚠️ Base64转换失败: {e}")
        return None

def find_favicon_url(html_content, base_url):
    """从HTML内容中正则提取favicon链接"""
    icon_patterns = [
        r'<link[^>]*?rel=["\'](?:shortcut )?icon["\'][^>]*?href=["\'](.*?)["\']',
        r'<link[^>]*?href=["\'](.*?)["\'][^>]*?rel=["\'](?:shortcut )?icon["\']',
        r'<link[^>]*?rel=["\']apple-touch-icon["\'][^>]*?href=["\'](.*?)["\']'
    ]

    for pattern in icon_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            href = match.group(1).strip()
            if href.startswith('//'):
                return 'https:' + href
            elif href.startswith('data:image'):
                return None
            else:
                return urljoin(base_url, href)
    return None

def process_site_node(site):
    """
    处理单个站点节点的核心逻辑
    """
    original_url = site.get('url', '')
    title = site.get('title', '未知标题')

    if not original_url:
        return None

    # 1. 强制升级 HTTPS
    target_url = original_url
    if target_url.startswith('http://'):
        target_url = target_url.replace('http://', 'https://', 1)

    try:
        # === 限流介入 ===
        # 在发起任何请求前，先检查该域名是否需要等待
        rate_limiter.wait_if_needed(target_url)
        # =============

        # 2. 验证站点连通性
        response = requests.get(target_url, headers=HEADERS, timeout=TIMEOUT)

        if response.status_code >= 400:
            print(f"❌ [删除] 状态码异常 {response.status_code}: {title}")
            return None

        site['url'] = response.url

        # 3. 提取 Favicon
        icon_url = find_favicon_url(response.text, response.url)

        if not icon_url:
            parsed_uri = urlparse(response.url)
            base_domain = '{uri.scheme}://{uri.netloc}/'.format(uri=parsed_uri)
            icon_url = urljoin(base_domain, 'favicon.ico')

        # 4. 下载并转换图标
        if icon_url:
            # 下载图标前，也需要针对图标所在的域名进行限流检查
            # 因为图标往往和主站在同一个域名下
            rate_limiter.wait_if_needed(icon_url)

            try:
                icon_resp = requests.get(icon_url, headers=HEADERS, timeout=5)
                if icon_resp.status_code == 200:
                    content_type = icon_resp.headers.get('Content-Type', '')
                    content_size = len(icon_resp.content)

                    if 'image' not in content_type:
                        ext = os.path.splitext(icon_url)[1]
                        content_type = mimetypes.types_map.get(ext.lower(), 'image/x-icon')

                    # 大小检查
                    if content_size > MAX_ICON_SIZE:
                        print(f"   ⚠️ [保留URL] 图标过大 ({content_size/1024:.1f}KB): {title}")
                        site['icon'] = icon_url
                    else:
                        base64_icon = image_to_base64(icon_resp.content, content_type)
                        if base64_icon:
                            site['icon'] = base64_icon
                            print(f"   ✅ [Base64] 图标更新成功: {title}")
            except Exception as e:
                # 图标下载失败不应导致节点删除，保留原状或不处理
                print(f"   ⚠️ 图标下载失败: {title} - {e}")

    except requests.exceptions.SSLError:
        print(f"❌ [删除] SSL/HTTPS 证书错误: {title}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ [删除] 无法访问: {title} - {type(e).__name__}")
        return None
    except Exception as e:
        print(f"❌ [删除] 未知错误: {title} - {e}")
        return None

    return site

def process_file(file_path):
    """读取并处理单个JSON文件"""
    print(f"\n📂 正在处理文件: {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 读取JSON失败: {file_path} - {e}")
        return

    if 'categories' not in data:
        print(f"⚠️ 跳过: 文件格式不符合规范 (缺少 categories 字段)")
        return

    total_sites_before = 0
    valid_sites_count = 0
    new_categories = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for category in data['categories']:
            cat_name = category.get('categoryName', '未知分类')
            sites = category.get('sites', [])

            if not sites:
                continue

            total_sites_before += len(sites)
            print(f"  👉 正在处理分类: {cat_name} ({len(sites)} 个站点)...")

            # 提交任务
            futures = [executor.submit(process_site_node, site) for site in sites]

            valid_sites = []
            for future in as_completed(futures):
                result = future.result()
                if result:
                    valid_sites.append(result)

            if valid_sites:
                category['sites'] = valid_sites
                new_categories.append(category)
                valid_sites_count += len(valid_sites)
            else:
                print(f"  🗑️ 分类 [{cat_name}] 已清空，将被移除。")

    data['categories'] = new_categories

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"💾 保存成功: {file_path}")
        print(f"📊 统计: 原有 {total_sites_before} -> 现有 {valid_sites_count} (删除了 {total_sites_before - valid_sites_count} 个无效节点)")
    except Exception as e:
        print(f"❌ 写入文件失败: {file_path} - {e}")

def main():
    print("🚀 开始批量处理导航数据...")
    print(f"📌 规则: 仅保留支持HTTPS的站点，内联Base64图标")
    print(f"⏳ 限流: 同一域名间隔 {DOMAIN_REQUEST_INTERVAL} 秒")

    files = get_target_files(DATA_DIR)

    if not files:
        print("🤷 未找到符合条件的JSON文件。")
        return

    for file_path in files:
        process_file(file_path)

    print("\n🎉 所有任务处理完成！")

if __name__ == "__main__":
    main()