import json
import re
from typing import List, Dict, Any

# 尝试导入 pypinyin，如果失败则给出提示
try:
    from pypinyin import pinyin, Style
except ImportError:
    print("错误：'pypinyin' 库未安装。")
    print("请先通过命令 'pip install pypinyin' 安装它。")
    exit()

def generate_category_id(name: str) -> str:
    """
    根据分类名称生成一个适合用作ID的拼音字符串。
    例如: "🎒 阿里云盘-K12教育 (Part 1)" -> "aliyupan-k12-jiaoyu-part-1"
    """
    # 1. 移除表情符号等非文本字符（可选，但推荐）
    name = re.sub(r'[^\w\s\-\(\)（）]', '', name).strip()

    # 2. 使用 pypinyin 转换
    pinyin_list = pinyin(name, style=Style.NORMAL)
    # 将 [[ 'zhōng'], ['wén']] 格式展平为 ['zhong', 'wen']
    flat_list = [item for sublist in pinyin_list for item in sublist]
    pinyin_str = ''.join(flat_list)

    # 3. 转换为小写
    pinyin_str = pinyin_str.lower()

    # 4. 将所有非字母数字字符替换为连字符
    pinyin_str = re.sub(r'[^a-z0-9]+', '-', pinyin_str)

    # 5. 清理首尾可能出现的连字符
    pinyin_str = pinyin_str.strip('-')

    return pinyin_str

def load_metadata_from_json(filepath: str) -> Dict[str, Dict[str, Any]]:
    """
    从旧的 JSON 文件中加载元数据。
    返回一个以 URL 为键，元数据（desc, icon, proxy）为值的字典。
    """
    metadata_map = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for category in data.get("categories", []):
            for site in category.get("sites", []):
                if "url" in site:
                    metadata_map[site["url"]] = {
                        "desc": site.get("desc", ""),
                        "icon": site.get("icon", ""),
                        "proxy": site.get("proxy", False)
                    }
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"警告: 无法读取或解析 {filepath}。将不会添加任何现有元数据。错误: {e}")
    return metadata_map

def parse_markdown(filepath: str) -> List[Dict[str, Any]]:
    """
    解析 Markdown 文件，提取分类和站点信息。
    """
    categories = []
    current_category = None

    site_pattern = re.compile(r"^\s*-\s*\*\*(.+?)\*\*:\s*(https?://[^\s]+)")

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()

                if line.startswith("### "):
                    if current_category:
                        categories.append(current_category)
                    category_name = line[4:].strip()
                    current_category = {
                        "categoryName": category_name,
                        "sites": []
                    }
                    continue

                if current_category:
                    match = site_pattern.match(line)
                    if match:
                        title = match.group(1).strip()
                        url = match.group(2).strip()
                        current_category["sites"].append({"title": title, "url": url})

            if current_category:
                categories.append(current_category)

    except FileNotFoundError:
        print(f"错误: 文件 {filepath} 未找到。")
        return []

    return categories

def main():
    """
    主函数，执行读取、合并和生成新 JSON 的流程。
    """
    md_file = 'tmp.md'
    old_json_file = '01资源.json'
    output_json_file = 'generated_resources.json'

    print(f"正在从 '{old_json_file}' 加载现有元数据...")
    metadata_map = load_metadata_from_json(old_json_file)

    print(f"正在从 '{md_file}' 解析分类和站点...")
    new_categories = parse_markdown(md_file)

    if not new_categories:
        print("Markdown 文件中未找到任何分类。程序退出。")
        return

    print("正在合并数据并为站点补充元数据...")
    final_data_structure = {"categories": []}

    for category in new_categories:
        category_name = category["categoryName"]
        category_id = generate_category_id(category_name)

        enriched_category = {
            "categoryName": category_name,
            "categoryId": category_id,
            "sites": []
        }

        print(f"  -> 正在处理分类: '{category_name}' (ID: '{category_id}')")

        for site in category["sites"]:
            url = site["url"]
            title = site["title"]

            metadata = metadata_map.get(url)

            if metadata:
                enriched_site = {
                    "title": title,
                    "url": url,
                    "desc": metadata["desc"],
                    "icon": metadata["icon"],
                    "proxy": metadata["proxy"]
                }
            else:
                enriched_site = {
                    "title": title,
                    "url": url,
                    "desc": title,
                    "icon": "",
                    "proxy": False
                }

            enriched_category["sites"].append(enriched_site)

        final_data_structure["categories"].append(enriched_category)

    print(f"正在将最终结果写入 '{output_json_file}'...")
    with open(output_json_file, 'w', encoding='utf-8') as f:
        json.dump(final_data_structure, f, ensure_ascii=False, indent=2)

    print(f"成功生成 '{output_json_file}'。")

if __name__ == "__main__":
    main()