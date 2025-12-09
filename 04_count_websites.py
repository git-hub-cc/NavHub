import os
import json
from urllib.parse import urlparse
from collections import Counter

# ================= 配置区域 =================
# 和 03_check_proxy.py 脚本保持一致，方便用户理解
DATA_DIR = 'data'
TARGET_EXT = '.json'
EXCLUDED_FILES = ['package-lock.json', 'engines.json', 'pinyin-map.json']
# ===========================================

def get_target_files(directory):
    """获取所有需要处理的JSON文件路径 (复用自 03_check_proxy.py)"""
    files = []
    if not os.path.exists(directory):
        print(f"❌ 目录不存在: {directory}")
        return []
    for filename in os.listdir(directory):
        if filename.endswith(TARGET_EXT) and filename not in EXCLUDED_FILES:
            files.append(os.path.join(directory, filename))
    return files

def get_domain(url):
    """从URL中提取域名（netloc）(复用自 03_check_proxy.py 并优化)"""
    try:
        # urlparse 需要一个协议头 (scheme) 才能正确解析 netloc
        # 如果 URL 中没有，则为其添加一个默认的
        if '://' not in url:
            url = 'http://' + url
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return None

def main():
    """主函数，用于统计各域名出现的次数"""
    print("🚀 开始统计 data 目录下的域名数量...")

    files = get_target_files(DATA_DIR)
    if not files:
        print("🤷 未找到任何 JSON 数据文件。")
        return

    # 使用 collections.Counter 来高效地进行计数
    domain_counts = Counter()
    total_sites_processed = 0

    print(f"🔍 正在处理 {len(files)} 个文件...")

    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 根据 03_check_proxy.py 的结构，数据在 'categories' -> 'sites' -> 'url'
            if 'categories' not in data:
                continue

            for category in data.get('categories', []):
                for site in category.get('sites', []):
                    url = site.get('url')
                    if not url:
                        continue

                    total_sites_processed += 1
                    domain = get_domain(url)

                    if domain:
                        # Counter 会自动处理新域名并增加已有域名的计数
                        domain_counts[domain] += 1
                    else:
                        print(f"⚠️ 无法从 '{url}' 解析域名 (文件: {file_path})")

        except json.JSONDecodeError as e:
            print(f"❌ JSON 解析失败: {file_path} - {e}")
        except Exception as e:
            print(f"❌ 读取文件时发生未知错误: {file_path} - {e}")

    print("\n✅ 数据处理完毕！")
    print(f"📊 共扫描 {total_sites_processed} 个站点条目，发现 {len(domain_counts)} 个独立域名。")

    if not domain_counts:
        print("🤷 未能从文件中统计出任何域名。")
        return

    print("\n--- 域名数量统计 (按出现次数降序) ---")
    # domain_counts.most_common() 返回一个按计数值降序排序的 (元素, 计数值) 列表
    for domain, count in domain_counts.most_common():
        # 使用格式化字符串对齐输出，使结果更美观
        print(f"{domain:<30} | {count} 次")

if __name__ == "__main__":
    main()