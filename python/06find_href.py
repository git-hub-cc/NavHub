from bs4 import BeautifulSoup
import os

# 定义HTML文件名
file_path = 'tmp.html'

# 检查文件是否存在
if not os.path.exists(file_path):
    print(f"错误: 文件 '{file_path}' 未找到。请确保文件存在于当前目录。")
else:
    # 使用 with open 读取文件，并指定UTF-8编码，防止中文乱码
    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 使用BeautifulSoup解析HTML
    # 第二个参数 'lxml' 是解析器，也可以换成 'html.parser'
    soup = BeautifulSoup(html_content, 'lxml')

    # 找到所有的 <a> 标签
    all_a_tags = soup.find_all('a')

    print("--- 开始提取 <a> 标签内容 ---")

    # 遍历所有找到的 <a> 标签
    for tag in all_a_tags:
        # 获取 href 属性（链接）
        # 使用 .get() 方法，如果 href 不存在，会返回 None，避免出错
        href = tag.get('href')

        # 获取标签内的文本内容，并用 .strip() 清除两端的空白字符
        text = tag.get_text().strip()

        # 我们只关心那些真正有链接（href不为空）和有文本内容的标签
        if href and text and href != '#':
            print(f"文本: {text}, 链接: {href}")

    print("--- 提取完毕 ---")