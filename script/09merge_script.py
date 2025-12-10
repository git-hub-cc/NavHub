import json
import os

def merge_json_categories(input_filename, output_filename):
    """
    读取一个包含分类网站列表的JSON文件，将其所有网站合并到一个
    新的分类中，并去除重复项后写入新文件。

    Args:
        input_filename (str): 输入的JSON文件名 (例如 '02服务.json')。
        output_filename (str): 输出的JSON文件名 (例如 'merged_services.json')。
    """
    # 检查输入文件是否存在
    if not os.path.exists(input_filename):
        print(f"错误：输入文件 '{input_filename}' 不存在。")
        return

    try:
        # 1. 读取并解析JSON文件
        with open(input_filename, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 2. 准备一个列表来存放所有网站对象，并用一个集合来跟踪已添加的URL以去重
        all_sites = []
        seen_urls = set()

        # 3. 遍历所有分类和其中的网站
        if 'categories' in data and isinstance(data['categories'], list):
            for category in data['categories']:
                if 'sites' in category and isinstance(category['sites'], list):
                    for site in category['sites']:
                        # 确保 site 是一个字典并且包含 'url' 键
                        if isinstance(site, dict) and 'url' in site:
                            # 如果URL没有出现过，则添加到列表和集合中
                            if site['url'] not in seen_urls:
                                all_sites.append(site)
                                seen_urls.add(site['url'])

        # 4. 创建新的、合并后的数据结构
        merged_data = {
            "categories": [
                {
                    "categoryName": "全部服务",
                    "categoryId": "all-services",
                    "sites": all_sites
                }
            ]
        }

        # 5. 将新数据结构写入输出文件
        with open(output_filename, 'w', encoding='utf-8') as f:
            # 使用 indent=2 美化输出格式
            # 使用 ensure_ascii=False 以正确显示中文字符
            json.dump(merged_data, f, ensure_ascii=False, indent=2)

        print(f"成功！所有网站已合并到新分类中，并已去重。")
        print(f"结果已保存到文件：'{output_filename}'")
        print(f"原始网站数量（含重复）：{sum(len(cat.get('sites', [])) for cat in data.get('categories', []))}")
        print(f"合并后网站数量（已去重）：{len(all_sites)}")

    except json.JSONDecodeError:
        print(f"错误：文件 '{input_filename}' 不是有效的JSON格式。")
    except Exception as e:
        print(f"处理文件时发生未知错误：{e}")


# --- 主程序 ---
if __name__ == "__main__":
    # 定义输入和输出文件名
    input_file = '02服务.json'
    output_file = 'merged_services.json'

    # 执行合并功能
    merge_json_categories(input_file, output_file)