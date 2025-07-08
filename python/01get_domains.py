import json
import re

def extract_unique_base_urls(json_file_path):
    """
    从 JSON 文件中读取 URL，提取网站根地址，并返回去重后的列表。

    Args:
        json_file_path (str): JSON 文件的路径。

    Returns:
        list: 包含唯一网站根地址的排序后列表。
    """
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"错误: 文件 '{json_file_path}' 未找到。请确保文件存在于正确的位置。")
        return []
    except json.JSONDecodeError:
        print(f"错误: 文件 '{json_file_path}' 不是有效的 JSON 格式。")
        return []

    # 定义用于匹配网站根地址的正则表达式
    # 匹配 http:// 或 https:// 开头，直到下一个 / 之前的所有内容
    # 例如：https://tools.pdf24.org/zh/ -> 匹配到 https://tools.pdf24.org/
    pattern = re.compile(r"^(https?://[^/]+/)", re.IGNORECASE)

    all_base_urls = []

    # 遍历 JSON 结构以获取所有 URL
    for category in data.get('categories', []):
        for site in category.get('sites', []):
            # 使用 .get() 方法安全地获取 'url' 键，以防某些条目没有 url
            url = site.get('url')
            if url and isinstance(url, str):
                match = pattern.match(url)
                if match:
                    # match.group(1) 返回第一个捕获组的内容
                    all_base_urls.append(match.group(1))

    # 使用 set 进行去重，然后转换为列表并排序
    unique_urls = sorted(list(set(all_base_urls)))

    return unique_urls

def save_urls_to_file(urls, output_file_path):
    """
    将 URL 列表写入到指定的文本文件中，每个 URL 占一行。

    Args:
        urls (list): 要写入的 URL 列表。
        output_file_path (str): 输出文件的路径。
    """
    try:
        with open(output_file_path, 'w', encoding='utf-8') as f:
            for url in urls:
                f.write(url + '\n')
        print(f"成功！已将 {len(urls)} 个唯一的网站根地址导出到 '{output_file_path}' 文件中。")
    except IOError as e:
        print(f"错误: 无法写入文件 '{output_file_path}'。原因: {e}")

if __name__ == "__main__":
    # 定义输入和输出文件
    json_file = '大数据.json'
    output_file = 'url.txt'

    # 1. 从 JSON 文件提取 URL
    final_urls = extract_unique_base_urls(json_file)

    # 2. 如果成功提取到 URL，则将其保存到文件
    if final_urls:
        save_urls_to_file(final_urls, output_file)
    else:
        print("没有找到任何 URL 或处理过程中出现错误，未生成任何文件。")