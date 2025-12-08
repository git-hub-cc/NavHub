import os
import json
import re
import base64
import hashlib
import io
import requests
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

# ================= 配置区域 =================
DATA_DIR = 'data'
IMG_DIR = 'img'
TARGET_HEIGHT = 42
IMAGE_QUALITY = 80
MAX_WORKERS = 16
TARGET_EXT = '.json'
EXCLUDED_FILES = ['package-lock.json', 'engines.json', 'pinyin-map.json']

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}
# ===========================================

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"📁 创建目录: {directory}")

def get_target_files(directory):
    files = []
    if not os.path.exists(directory):
        return []
    for filename in os.listdir(directory):
        if filename.endswith(TARGET_EXT) and filename not in EXCLUDED_FILES:
            files.append(os.path.join(directory, filename))
    return files

def get_image_bytes(source_str, site_title):
    """
    根据输入的字符串获取图片的二进制数据
    增加 site_title 参数用于日志定位
    """
    if not source_str:
        return None

    # 1. 处理 Base64
    if source_str.startswith('data:image'):
        try:
            if ',' in source_str:
                header, encoded = source_str.split(',', 1)

                # --- 增强健壮性：清理非法字符 ---
                # 某些 Base64 可能包含换行符 \n 或空格，需清理
                clean_encoded = re.sub(r'[^a-zA-Z0-9+/=]', '', encoded)

                return base64.b64decode(clean_encoded)
        except Exception as e:
            print(f"   ❌ [Base64错误] 网站: {site_title}")
            print(f"      原因: {e}")
            # 打印部分字符串以便调试（前50个字符）
            print(f"      数据片段: {source_str[:50]}...")
            return None

    # 2. 处理 URL
    if source_str.startswith('http'):
        try:
            resp = requests.get(source_str, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                return resp.content
        except Exception:
            return None

    return None

def process_and_save_image(image_bytes, site_title):
    """处理并保存图片"""
    if not image_bytes:
        return None

    try:
        md5_hash = hashlib.md5(image_bytes).hexdigest()
        filename = f"{md5_hash}.webp"
        save_path = os.path.join(IMG_DIR, filename)
        web_path = f"{IMG_DIR}/{filename}"

        if os.path.exists(save_path):
            return web_path

        with Image.open(io.BytesIO(image_bytes)) as img:
            if img.mode in ('CMYK', 'P', '1'):
                img = img.convert('RGBA')
            if img.mode == 'RGB':
                img = img.convert('RGBA')

            aspect_ratio = img.width / img.height
            new_width = int(TARGET_HEIGHT * aspect_ratio)

            if img.height != TARGET_HEIGHT:
                img = img.resize((new_width, TARGET_HEIGHT), Image.Resampling.LANCZOS)

            img.save(save_path, 'WEBP', quality=IMAGE_QUALITY)

        return web_path

    except Exception as e:
        print(f"   ⚠️ [图片处理失败] 网站: {site_title}")
        print(f"      原因: {e}")
        return None

def process_site_node(site):
    """处理单个站点节点"""
    original_icon = site.get('icon', '')
    site_title = site.get('title', '未知标题') # 获取标题用于日志

    if not original_icon:
        return False

    if original_icon.startswith(f"{IMG_DIR}/"):
        if os.path.exists(original_icon):
            return False
        return False

    # 传递 site_title
    img_bytes = get_image_bytes(original_icon, site_title)

    if img_bytes:
        # 传递 site_title
        new_path = process_and_save_image(img_bytes, site_title)
        if new_path:
            site['icon'] = new_path
            return True

    return False

def process_file(file_path):
    print(f"\n📂 处理文件: {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 读取失败: {e}")
        return

    if 'categories' not in data:
        return

    changed_count = 0
    tasks = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for category in data['categories']:
            sites = category.get('sites', [])
            for site in sites:
                tasks.append(executor.submit(process_site_node, site))

        for future in as_completed(tasks):
            if future.result():
                changed_count += 1

    if changed_count > 0:
        print(f"   💾 更新了 {changed_count} 个图标，正在保存...")
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"   ❌ 保存失败: {e}")
    else:
        print("   ✨ 无需更新")

def main():
    print("🚀 开始图片本地化与压缩处理...")
    ensure_dir(IMG_DIR)
    files = get_target_files(DATA_DIR)

    if not files:
        print("🤷 未找到数据文件")
        return

    for file_path in files:
        process_file(file_path)

    print("\n🎉 全部处理完成！")

if __name__ == "__main__":
    main()