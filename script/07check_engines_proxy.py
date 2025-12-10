import os
import json
import requests
import time
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================= 配置区域 =================
# 目标文件位于 data 目录下
DATA_DIR = '../data'
TARGET_FILE = '00engines.json'

# 请求设置
TIMEOUT = 3  # 3秒超时，任何超过此时间的请求都将视为失败
MAX_WORKERS = 20  # 并发线程数

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}
# ===========================================

def get_domain(url):
    """从URL中提取域名（netloc）"""
    try:
        return urlparse(url).netloc
    except Exception:
        return None

def check_domain_connectivity(domain, sample_url):
    """
    检测域名的连通性。
    优先测试根域名，失败则尝试具体URL。
    返回: True (需要代理/连接失败), False (连接正常)
    """
    protocol = sample_url.split('://')[0] if '://' in sample_url else 'https'
    test_url = f"{protocol}://{domain}"

    try:
        requests.get(test_url, headers=HEADERS, timeout=TIMEOUT)
        return False
    except requests.exceptions.RequestException:
        if test_url != sample_url:
            try:
                requests.get(sample_url, headers=HEADERS, timeout=TIMEOUT)
                return False
            except requests.exceptions.RequestException:
                pass
        return True

def save_custom_formatted_json(file_path, data):
    """
    自定义JSON保存函数，以匹配原始文件的特定格式。
    - "categories" 列表中的每个对象占一行。
    - "engines" 中每个引擎列表里的站点对象占一行。
    """
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('{\n')

        # 1. 处理 categories
        categories = data.get('categories', [])
        category_lines = []
        for cat in categories:
            # ensure_ascii=False 保证中文正常显示
            line = json.dumps(cat, ensure_ascii=False)
            category_lines.append(f'    {line}')

        f.write('  "categories": [\n')
        f.write(',\n'.join(category_lines))
        f.write('\n  ],\n')

        # 2. 处理 engines
        engines = data.get('engines', {})
        engine_blocks = []
        for name, sites in engines.items():
            site_lines = [f'      {json.dumps(site, ensure_ascii=False)}' for site in sites]

            block = f'    "{name}": [\n'
            block += ',\n'.join(site_lines)
            block += '\n    ]'
            engine_blocks.append(block)

        f.write('  "engines": {\n')
        f.write(',\n'.join(engine_blocks))
        f.write('\n  }\n')

        f.write('}\n')


def main():
    """主执行函数"""
    print("🚀 开始检测 00engines.json 代理状态...")
    file_path = os.path.join(DATA_DIR, TARGET_FILE)

    if not os.path.exists(file_path):
        print(f"❌ 错误: 文件不存在 -> {file_path}")
        return

    # 1. 加载数据并按域名聚合
    domain_map = {}
    domain_sample_url = {}

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for sites in data.get('engines', {}).values():
            for site in sites:
                url = site.get('url')
                if not url: continue

                domain = get_domain(url)
                if not domain: continue

                if domain not in domain_map:
                    domain_map[domain] = []
                    domain_sample_url[domain] = url

                domain_map[domain].append(site)

    except Exception as e:
        print(f"❌ 读取或解析JSON文件失败: {file_path} - {e}")
        return

    total_domains = len(domain_map)
    if total_domains == 0:
        print("🤷 文件中未发现有效的URL。")
        return

    print(f"📊 数据加载完毕，共发现 {total_domains} 个唯一域名需要检测。")
    print(f"⏱️  超时阈值: {TIMEOUT}秒, 并发数: {MAX_WORKERS}")

    # 2. 并发检测所有域名
    need_proxy_domains = set()
    checked_count = 0

    print("\n🔍 开始并发检测...")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_domain = {
            executor.submit(check_domain_connectivity, domain, domain_sample_url[domain]): domain
            for domain in domain_map.keys()
        }

        for future in as_completed(future_to_domain):
            domain = future_to_domain[future]
            checked_count += 1
            progress = (checked_count / total_domains) * 100
            print(f"   进度: {checked_count}/{total_domains} ({progress:.1f}%)", end='\r')

            try:
                if future.result():
                    need_proxy_domains.add(domain)
            except Exception as e:
                print(f"\n   ⚠️ 检测异常 for {domain}: {e}")
                need_proxy_domains.add(domain)

    duration = time.time() - start_time
    print(f"\n✅ 检测完成，耗时 {duration:.2f} 秒。")
    print(f"🔴 发现 {len(need_proxy_domains)} 个域名无法直连，将被标记为 'proxy: true'。")

    # 3. 更新JSON对象中的 'proxy' 字段
    update_count = 0
    for domain, sites_list in domain_map.items():
        needs_proxy = domain in need_proxy_domains
        for site in sites_list:
            if site.get('proxy') is not needs_proxy:
                site['proxy'] = needs_proxy
                update_count += 1

    # 4. 如果有变动，则写回文件
    if update_count > 0:
        print(f"💾 共有 {update_count} 个站点的 'proxy' 状态发生变更，正在保存文件...")
        try:
            # 使用自定义的格式化保存函数
            save_custom_formatted_json(file_path, data)
            print(f"🎉 文件 {file_path} 保存成功！")
        except Exception as e:
            print(f"❌ 保存文件失败: {file_path} - {e}")
    else:
        print("✨ 所有站点的代理状态均未发生变化，无需更新文件。")

if __name__ == "__main__":
    main()