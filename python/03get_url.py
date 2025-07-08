import json

def extract_urls_from_json(json_file_path, output_txt_path):
    """
    从指定的JSON文件中提取所有'url'字段，并保存到文本文件中。

    :param json_file_path: 输入的JSON文件路径。
    :param output_txt_path: 输出的文本文件路径。
    """
    # 用于存储所有找到的URL
    all_urls = []

    try:
        # 使用'utf-8'编码打开并加载JSON文件
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 检查'categories'键是否存在
        if 'categories' in data and isinstance(data['categories'], list):
            # 遍历每个分类
            for category in data['categories']:
                # 检查'sites'键是否存在
                if 'sites' in category and isinstance(category['sites'], list):
                    # 遍历分类下的每个站点
                    for site in category['sites']:
                        # 提取'url'字段并添加到列表中
                        if 'url' in site:
                            all_urls.append(site['url'])
        else:
            print("警告: JSON文件中未找到'categories'列表。")

        # 将提取到的URL写入输出文件
        with open(output_txt_path, 'w', encoding='utf-8') as f_out:
            for url in all_urls:
                f_out.write(url + '\n')

        print(f"成功！共提取 {len(all_urls)} 个URL，已保存至 {output_txt_path}")

    except FileNotFoundError:
        print(f"错误：找不到文件 '{json_file_path}'。请确保文件路径正确。")
    except json.JSONDecodeError:
        print(f"错误：文件 '{json_file_path}' 不是有效的JSON格式。")
    except Exception as e:
        print(f"发生未知错误: {e}")

# --- 主程序 ---
if __name__ == "__main__":
    # 定义输入和输出文件名
    input_json = '知识船仓.json'
    output_txt = 'url_all.txt'

    # 调用函数执行提取和写入操作
    extract_urls_from_json(input_json, output_txt)