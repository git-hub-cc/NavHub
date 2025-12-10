import os
import json
import re
import base64
import hashlib
import io
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, UnidentifiedImageError

# ================= 配置区域 =================
DATA_DIR = '../data'
IMG_DIR = '../img'
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
    返回: bytes 或 None (None表示获取失败)
    """
    if not source_str:
        return None

    # 1. 处理 Base64
    if source_str.strip().startswith('data:image'):
        try:
            if ',' in source_str:
                # 分割头部和数据
                header, encoded = source_str.split(',', 1)

                # 清理数据：移除换行符、空格等非Base64字符
                clean_encoded = re.sub(r'[^a-zA-Z0-9+/=]', '', encoded)

                # 尝试解码
                return base64.b64decode(clean_encoded)
            else:
                return None
        except Exception:
            # 这里的异常通常是 binascii.Error，表示 Base64 格式不对
            # 我们不在这里打印错误，直接返回 None，由上层逻辑决定清除
            return None

    # 2. 处理 URL
    if source_str.strip().startswith('http'):
        try:
            resp = requests.get(source_str, headers=HEADERS, timeout=8)
            if resp.status_code == 200:
                return resp.content
        except Exception:
            return None

    return None

def process_and_save_image(image_bytes, site_title):
    """
    处理并保存图片
    返回: 保存后的相对路径 或 None (None表示图片无效)
    """
    if not image_bytes:
        return None

    try:
        # 计算哈希作为文件名
        md5_hash = hashlib.md5(image_bytes).hexdigest()
        filename = f"{md5_hash}.webp"
        save_path = os.path.join(IMG_DIR, filename)
        web_path = f"{IMG_DIR}/{filename}"

        # 如果文件已存在，直接返回路径
        if os.path.exists(save_path):
            return web_path

        # 尝试打开并处理图片
        with Image.open(io.BytesIO(image_bytes)) as img:
            # 转换模式以支持 WebP
            if img.mode in ('CMYK', 'P', '1'):
                img = img.convert('RGBA')
            if img.mode == 'RGB':
                img = img.convert('RGBA')

            # 计算尺寸并调整
            aspect_ratio = img.width / img.height
            new_width = int(TARGET_HEIGHT * aspect_ratio)

            # 只有高度不一致时才缩放
            if img.height != TARGET_HEIGHT:
                img = img.resize((new_width, TARGET_HEIGHT), Image.Resampling.LANCZOS)

            # 保存
            img.save(save_path, 'WEBP', quality=IMAGE_QUALITY)

        return web_path

    except (UnidentifiedImageError, OSError, Exception):
        # 这里的异常包括：无法识别的图片格式、损坏的图片流等
        # 返回 None 表示处理失败
        return None

def process_site_node(site):
    """
    处理单个站点节点
    返回: True (数据已修改) / False (无变化)
    """
    original_icon = site.get('icon', '')
    site_title = site.get('title', '未知标题')

    # 1. 已经是空字符串，无需处理，返回 False
    if not original_icon:
        return False

    # 2. 检查是否已经是本地处理过的图片
    if original_icon.startswith(f"{IMG_DIR}/"):
        # 额外检查：虽然路径写的是本地，但文件还在吗？
        if os.path.exists(original_icon):
            return False
        else:
            # 文件丢失，重置为空
            print(f"   ❌ [文件丢失] 本地文件缺失，清除图标: {site_title}")
            site['icon'] = ""
            return True

    # 3. 尝试获取图片二进制数据
    img_bytes = get_image_bytes(original_icon, site_title)

    # === 关键修改：获取失败（Base64错误或下载失败）则清空 ===
    if not img_bytes:
        print(f"   🗑️ [数据无效] Base64错误或链接失效，清除图标: {site_title}")
        site['icon'] = ""
        return True

    # 4. 尝试通过 PIL 处理并保存图片
    new_path = process_and_save_image(img_bytes, site_title)

    # === 关键修改：处理失败（无法识别的图片格式）则清空 ===
    if not new_path:
        print(f"   🗑️ [图片损坏] 无法识别图像文件，清除图标: {site_title}")
        site['icon'] = ""
        return True

    # 5. 成功，更新路径
    site['icon'] = new_path
    return True

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

    # 使用线程池并发处理
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for category in data['categories']:
            sites = category.get('sites', [])
            for site in sites:
                tasks.append(executor.submit(process_site_node, site))

        for future in as_completed(tasks):
            if future.result():
                changed_count += 1

    if changed_count > 0:
        print(f"   💾 修改了 {changed_count} 个条目（包含更新或清除），正在保存...")
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"   ❌ 保存失败: {e}")
    else:
        print("   ✨ 无需更新")

def main():
    print("🚀 开始图片本地化、压缩与清洗处理...")
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