import requests

# 定义要读取的文件名
file_path = 'tmp.html'

# 设置请求头，模拟浏览器访问，避免被一些网站拦截
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

print("正在检查URL，请稍候...")
print("-" * 30)

try:
    # 使用 'utf-8' 编码打开文件，以正确处理中文字符和表情符号
    with open(file_path, 'r', encoding='utf-8') as f:
        # 逐行读取文件内容
        for line in f:
            # 去除行首和行尾的空白字符
            clean_line = line.strip()

            # 检查行中是否包含 "链接: " 关键词
            if '链接:' in clean_line:
                try:
                    # 通过 "链接: " 分割字符串，取后面的部分作为URL
                    url = clean_line.split('链接:')[1].strip()

                    # 发送GET请求，设置10秒超时
                    response = requests.get(url, headers=headers, timeout=10)

                    # 检查HTTP响应状态码是否为200 (OK)
                    if response.status_code == 200:
                        # 如果状态码为200，则打印原始的行内容
                        print(clean_line)

                except requests.exceptions.RequestException as e:
                    # 捕获所有requests可能抛出的异常 (如超时、DNS错误、连接错误等)
                    # print(f"跳过无法访问的URL: {url} (错误: {e})") # 此行为调试信息，可按需取消注释
                    pass # 静默处理错误，直接跳过
                except IndexError:
                    # 如果某一行包含"链接:"但后面没有URL，则跳过
                    pass

except FileNotFoundError:
    print(f"错误: 文件 '{file_path}' 未找到。请确保该文件与脚本在同一目录下。")

print("-" * 30)
print("检查完成。")