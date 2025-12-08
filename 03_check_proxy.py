import os
import json
import requests
import time
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================= 配置区域 =================
DATA_DIR = 'data'
TARGET_EXT = '.json'
EXCLUDED_FILES = ['package-lock.json', 'engines.json', 'pinyin-map.json']

# 请求设置
TIMEOUT = 3  # 3秒超时，任何超过此时间的请求都将视为失败
MAX_WORKERS = 20 # 并发线程数，网络检测是IO密集型，可以设高一点

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}
# ===========================================

def get_target_files(directory):
    """获取所有需要处理的JSON文件路径"""
    files = []
    if not os.path.exists(directory):
        print(f"❌ 目录不存在: {directory}")
        return []
    for filename in os.listdir(directory):
        if filename.endswith(TARGET_EXT) and filename not in EXCLUDED_FILES:
            files.append(os.path.join(directory, filename))
    return files

def get_domain(url):
    """从URL中提取域名（netloc）"""
    try:
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return None

def check_domain_connectivity(domain, sample_url):
    """
    检测域名的连通性
    返回: True (需要代理/连接失败), False (连接正常)
    """
    # 策略：优先构建根域名进行测试，因为根域名通常最快
    # 如果 sample_url 本身就是根域名，则直接用
    try:
        protocol = sample_url.split('://')[0]
        test_url = f"{protocol}://{domain}"
    except:
        test_url = sample_url

    try:
        # 使用 HEAD 请求可以减少流量，但有些服务器不支持 HEAD，GET 更稳妥
        # timeout 设置为 3 秒
        requests.get(test_url, headers=HEADERS, timeout=TIMEOUT)
        return False # 正常连接，不需要代理
    except Exception:
        # 再次尝试：如果根域名失败，尝试原本具体的 sample_url
        if test_url != sample_url:
            try:
                requests.get(sample_url, headers=HEADERS, timeout=TIMEOUT)
                return False
            except Exception:
                pass
        return True # 失败，视为需要代理

def main():
    print("🚀 开始全量代理检测...")
    print(f"⏱️  超时阈值: {TIMEOUT}秒")

    files = get_target_files(DATA_DIR)
    if not files:
        print("🤷 未找到数据文件")
        return

    # 1. 加载所有数据并按域名建立映射
    # 结构: { "www.google.com": [ {site_node1}, {site_node2} ], ... }
    domain_map = {}
    # 记录每个域名的一个代表性 URL，用于测试
    domain_sample_url = {}
    # 记录文件对象，以便最后保存 { "filepath": json_data_object }
    file_data_map = {}

    print("📊 正在加载并聚合数据...")
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                file_data_map[file_path] = data

                if 'categories' not in data:
                    continue

                for category in data['categories']:
                    sites = category.get('sites', [])
                    for site in sites:
                        url = site.get('url', '')
                        if not url: continue

                        domain = get_domain(url)
                        if not domain: continue

                        if domain not in domain_map:
                            domain_map[domain] = []
                            domain_sample_url[domain] = url

                        domain_map[domain].append(site)

        except Exception as e:
            print(f"❌ 读取文件失败: {file_path} - {e}")

    total_domains = len(domain_map)
    print(f"✅ 数据加载完毕，共发现 {total_domains} 个唯一域名需要检测。")

    # 2. 并发检测域名
    need_proxy_domains = set()
    checked_count = 0

    print("\n🔍 开始并发检测...")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 提交所有域名的检测任务
        future_to_domain = {
            executor.submit(check_domain_connectivity, domain, domain_sample_url[domain]): domain
            for domain in domain_map.keys()
        }

        for future in as_completed(future_to_domain):
            domain = future_to_domain[future]
            checked_count += 1

            # 进度条效果
            if checked_count % 50 == 0:
                print(f"   进度: {checked_count}/{total_domains}...", end='\r')

            try:
                is_need_proxy = future.result()
                if is_need_proxy:
                    need_proxy_domains.add(domain)
                    # 打印超时记录
                    # print(f"   🐌 [超时/失败] {domain}")
            except Exception:
                need_proxy_domains.add(domain)

    duration = time.time() - start_time
    print(f"\n✅ 检测完成，耗时 {duration:.2f}秒。")
    print(f"🔴 发现 {len(need_proxy_domains)} 个域名无法直连，需开启代理。")

    # 3. 批量更新数据
    update_count = 0
    for domain in need_proxy_domains:
        site_list = domain_map[domain]
        for site in site_list:
            # 只有当 proxy 原本为 false 或不存在时才更新，避免重复操作
            if not site.get('proxy', False):
                site['proxy'] = True
                update_count += 1

    if update_count > 0:
        print(f"💾 更新了 {update_count} 个站点节点的 proxy 字段，正在保存文件...")

        # 4. 写回文件
        for file_path, data in file_data_map.items():
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                # print(f"   已保存: {file_path}")
            except Exception as e:
                print(f"❌ 保存失败: {file_path} - {e}")
        print("🎉 全部处理完毕！")
    else:
        print("✨ 没有发现新的需要代理的站点。")

if __name__ == "__main__":
    main()