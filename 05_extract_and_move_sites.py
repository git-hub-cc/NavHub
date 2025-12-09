import os
import json
from urllib.parse import urlparse
import tldextract # 需要先安装 pip install tldextract

# ================= 配置区域 =================
# 和其他脚本保持一致
DATA_DIR = 'data'
TARGET_EXT = '.json'
EXCLUDED_FILES = ['package-lock.json', 'engines.json', 'pinyin-map.json']

# 要迁移的域名列表 (使用集合 set 以获得更快的查找速度)
TARGET_DOMAINS_TO_MIGRATE = {
    'www.aliyundrive.com',
    'wwi.lanzoui.com',
    'www.yuque.com',
    'baozangku.lanzoui.com',
    'pan.baidu.com',
    'mp.weixin.qq.com',
    'www.lanzoui.com',
    'baozangku.lanzoux.com',
    'flowus.cn',
    'github.com',
    'www.lanzoul.com',
    'url67.ctfile.com',
    'chendandan.lanzoux.com'
}

# 输出文件名
OUTPUT_FILENAME = '00资源.json'
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
        if '://' not in url:
            url = 'http://' + url
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return None

def get_root_domain(domain):
    """
    使用 tldextract 获取根域名
    例如: a.b.c.com -> c.com
          a.b.com.cn -> b.com.cn
    """
    if not domain:
        return ""
    extracted = tldextract.extract(domain)
    # top_domain_under_public_suffix 是 'registered_domain' 的新名称，功能相同
    return extracted.top_domain_under_public_suffix

def main():
    print("🚀 开始迁移指定域名的网站节点...")
    print(f"🎯 将迁移 {len(TARGET_DOMAINS_TO_MIGRATE)} 个指定域名及其子域名的节点。")

    files = get_target_files(DATA_DIR)
    if not files:
        print("🤷 未找到任何 JSON 数据文件。")
        return

    migrated_nodes = []
    modified_files_count = 0

    print("\n🔍 正在扫描文件并提取节点...")
    # --- 阶段一: 遍历所有文件，提取目标节点并从源文件删除 ---
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            file_was_modified = False

            if 'categories' not in data:
                continue

            for category in data.get('categories', []):
                sites_to_keep = []
                original_sites = category.get('sites', [])

                for site in original_sites:
                    url = site.get('url')
                    if not url:
                        sites_to_keep.append(site)
                        continue

                    domain = get_domain(url)
                    if domain in TARGET_DOMAINS_TO_MIGRATE:
                        # 这是一个目标节点，添加到迁移列表
                        migrated_nodes.append(site)
                        file_was_modified = True
                    else:
                        # 非目标节点，保留在原处
                        sites_to_keep.append(site)

                # 用过滤后的列表替换原来的 sites 列表
                category['sites'] = sites_to_keep

            # 如果文件被修改过，则写回文件
            if file_was_modified:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                modified_files_count += 1
                print(f"   ✏️ 已修改: {os.path.basename(file_path)}")

        except Exception as e:
            print(f"❌ 处理文件时发生错误: {file_path} - {e}")

    print(f"\n✅ 节点提取和源文件更新完成。共提取 {len(migrated_nodes)} 个节点，修改了 {modified_files_count} 个文件。")

    if not migrated_nodes:
        print("✨ 没有找到任何需要迁移的节点。")
        return

    # --- 阶段二: 对提取的节点进行排序 ---
    print("\n🔄 正在对提取的节点进行排序...")
    # 排序规则:
    # 1. 按根域名 (e.g., lanzoui.com) 排序
    # 2. 在根域名相同的情况下，按完整子域名 (e.g., baozangku.lanzoui.com) 排序
    sorted_nodes = sorted(
        migrated_nodes,
        key=lambda site: (
            get_root_domain(get_domain(site.get('url', ''))),
            get_domain(site.get('url', ''))
        )
    )
    print("✅ 排序完成。")

    # --- 阶段三: 将排序后的节点写入新文件 ---
    output_path = os.path.join(DATA_DIR, OUTPUT_FILENAME)
    print(f"\n💾 正在将 {len(sorted_nodes)} 个节点写入新文件: {output_path}")

    # 构建新文件的 JSON 结构
    new_data = {
        "name": "迁移的合集",
        "description": f"该文件包含从其他文件中自动迁移过来的 {len(sorted_nodes)} 个网站节点。",
        "categories": [
            {
                "name": "全部迁移内容",
                "description": "按主域名和子域名排序。",
                "sites": sorted_nodes
            }
        ]
    }

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        print(f"🎉 成功创建迁移文件: {output_path}")
    except Exception as e:
        print(f"❌ 写入新文件失败: {e}")

    print("\n✨ 全部处理完毕！")


if __name__ == "__main__":
    main()