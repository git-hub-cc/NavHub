import json
import os
import hashlib
import requests
from PIL import Image
from io import BytesIO

# --- 配置 ---
JSON_INPUT_FILE = '02服务.json'
JSON_OUTPUT_FILE = '02服务_updated.json'
IMAGE_OUTPUT_DIR = 'img'
IMAGE_SIZE = (32, 32)
OVERWRITE_INPUT = True  # 是否直接覆盖输入文件

def process_image_url(url, session):
    """
    下载、处理图片并返回新的本地路径。
    """
    try:
        # 设置合理的超时和 User-Agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = session.get(url, timeout=15, headers=headers)
        response.raise_for_status()  # 如果请求失败 (如 404), 则抛出异常
        image_data = response.content

        # 计算图片内容的 MD5 哈希值作为文件名
        hasher = hashlib.md5()
        hasher.update(image_data)
        hash_name = hasher.hexdigest()

        # 定义新的文件名和路径
        is_svg = url.lower().endswith('.svg') or b'<svg' in image_data[:500].lower()
        ext = "svg" if is_svg else "webp"
        new_filename = f"{hash_name}.{ext}"
        local_path = os.path.join(IMAGE_OUTPUT_DIR, new_filename)
        json_path = f"{IMAGE_OUTPUT_DIR}/{new_filename}" # JSON 中使用正斜杠

        # 如果文件已存在，则跳过处理，直接返回路径
        if os.path.exists(local_path):
            print(f"  -> 已存在, 跳过: {local_path}")
            return json_path

        if is_svg:
            # SVG 直接保存
            with open(local_path, 'wb') as f:
                f.write(image_data)
            print(f"  -> SVG 成功保存到: {local_path}")
            return json_path

        # 使用 Pillow 处理图片
        with Image.open(BytesIO(image_data)) as img:
            # 调整大小
            img.thumbnail(IMAGE_SIZE, Image.Resampling.LANCZOS)

            # 转换为 RGB 模式以确保可以保存为 WEBP
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')

            # 保存为 WEBP 格式
            img.save(local_path, 'webp', quality=85)
            print(f"  -> 成功保存到: {local_path}")
            return json_path

    except requests.exceptions.RequestException as e:
        print(f"  -> [错误] 下载失败: {url} | {e}")
        return None
    except Exception as e:
        print(f"  -> [错误] 处理图片失败: {url} | {e}")
        return None


def main():
    """
    主函数，读取、处理并保存 JSON 文件。
    """
    # 切换到脚本所在目录，确保相对路径正确
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # 检查输入文件是否存在
    if not os.path.exists(JSON_INPUT_FILE):
        print(f"错误: 输入文件 '{JSON_INPUT_FILE}' 不存在。")
        return

    # 创建用于保存图片的目录
    if not os.path.exists(IMAGE_OUTPUT_DIR):
        os.makedirs(IMAGE_OUTPUT_DIR)
        print(f"创建目录: '{IMAGE_OUTPUT_DIR}'")

    # 读取 JSON 数据
    with open(JSON_INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 使用 requests.Session 来复用连接，提高效率
    session = requests.Session()
    total_sites = 0
    processed_urls = 0

    # 遍历 JSON 结构
    for category in data.get('categories', []):
        category_name = category.get('categoryName', '未知分类')
        print(f"\n正在处理分类: {category_name}")
        for site in category.get('sites', []):
            total_sites += 1
            icon_value = site.get('icon')

            # 检查 icon 字段是否为 HTTP/HTTPS URL
            if isinstance(icon_value, str) and icon_value.startswith(('http://', 'https://')):
                processed_urls += 1
                print(f"处理URL: {icon_value}")

                # 下载并处理图片
                new_icon_path = process_image_url(icon_value, session)

                # 如果处理成功，则更新 JSON 中的 icon 字段
                if new_icon_path:
                    site['icon'] = new_icon_path
                else:
                    # 如果处理失败，可以选择保留原样或设置为空
                    # 这里我们保留原URL，并在日志中打印错误
                    print(f"  -> 保留原始URL: {site.get('title')}")

    # 将更新后的数据写入文件
    output_file = JSON_INPUT_FILE if OVERWRITE_INPUT else JSON_OUTPUT_FILE
    with open(output_file, 'w', encoding='utf-8') as f:
        # ensure_ascii=False 保证中文字符正常显示
        # indent=2 使 JSON 文件格式化，易于阅读
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n--- 处理完成 ---")
    print(f"总计检查了 {total_sites} 个网站条目。")
    print(f"处理了 {processed_urls} 个 icon URL。")
    print(f"更新后的 JSON 文件已保存到: '{output_file}'")
    print(f"图片文件已保存到: '{IMAGE_OUTPUT_DIR}/' 目录。")


if __name__ == '__main__':
    main()