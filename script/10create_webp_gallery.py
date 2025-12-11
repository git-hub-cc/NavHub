import os
import html

def generate_html_gallery():
    """
    Scans the current directory for .webp images and generates an index.html
    file to display them in a gallery.
    """
    # 1. 获取当前目录下的所有文件和文件夹
    try:
        all_files = os.listdir('.')
    except FileNotFoundError:
        print("错误：无法访问当前目录。")
        return

    # 2. 筛选出所有 .webp 文件，并按字母顺序排序
    #    使用 .lower() 确保对 .WEBP, .Webp 等也有效
    webp_files = sorted([f for f in all_files if f.lower().endswith('.webp')])

    if not webp_files:
        print("在当前目录下没有找到 .webp 图片。")
        # 即使没有图片，也生成一个空的html文件，告知用户
        html_content = create_html_document([])
    else:
        print(f"找到了 {len(webp_files)} 张 .webp 图片。正在生成 index.html...")
        html_content = create_html_document(webp_files)

    # 3. 将生成的HTML内容写入到 index.html 文件
    try:
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(html_content)
        print("\n成功生成 index.html！")
        print("现在你可以在浏览器中打开这个文件来预览图片。")
    except IOError as e:
        print(f"错误：无法写入 index.html 文件: {e}")

def create_html_document(image_files):
    """
    根据图片文件列表生成完整的HTML文档字符串。
    """
    # HTML 模板的头部和样式
    html_head = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebP 图片预览</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f9;
            color: #333;
        }}
        .header {{
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #ddd;
        }}
        h1 {{
            margin: 0;
        }}
        .gallery-container {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px; /* 图片之间的间距 */
            justify-content: center;
            padding: 20px 0;
        }}
        .image-card {{
            width: 250px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            display: flex;
            flex-direction: column;
        }}
        .image-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }}
        .image-card a {{
            display: block;
            text-decoration: none;
            color: inherit;
        }}
        .image-card img {{
            width: 100%;
            height: 200px;
            object-fit: cover; /* 保持图片比例，裁剪多余部分 */
            display: block;
        }}
        .image-card p {{
            padding: 10px;
            margin: 0;
            font-size: 14px;
            text-align: center;
            word-wrap: break-word;
            background-color: #fafafa;
            border-top: 1px solid #eee;
            flex-grow: 1; /* 让p元素填满剩余空间 */
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .empty-message {{
            text-align: center;
            font-size: 1.2em;
            color: #888;
            margin-top: 50px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>WebP 图片预览</h1>
        <p>在当前目录下共找到 {len(image_files)} 张图片</p>
    </div>
    """

    # HTML 主体内容
    if not image_files:
        gallery_content = '<p class="empty-message">未找到任何 .webp 图片。</p>'
    else:
        image_cards = []
        for filename in image_files:
            # 使用 html.escape 防止文件名中的特殊字符（如 < > &）破坏HTML结构
            safe_filename = html.escape(filename)
            card = f"""
        <div class="image-card">
            <a href="{safe_filename}" target="_blank" title="点击查看原图：{safe_filename}">
                <img src="{safe_filename}" alt="{safe_filename}" loading="lazy">
            </a>
            <p>{safe_filename}</p>
        </div>"""
            image_cards.append(card)
        gallery_content = '<div class="gallery-container">' + '\n'.join(image_cards) + '</div>'

    # HTML 尾部
    html_foot = """
</body>
</html>
    """

    return html_head + gallery_content + html_foot


if __name__ == "__main__":
    generate_html_gallery()