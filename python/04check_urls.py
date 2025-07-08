import requests
import concurrent.futures
import time

# --- 配置 ---
INPUT_FILE = 'url_all.txt'
OUTPUT_FILE = 'error.txt'
# 需要检测的错误关键词列表
ERROR_KEYWORDS = [
    "信息有误",
    "百度网盘-链接不存在",
    "页面不存在",
    "来晚啦...文件取消分享了",
    "404 Not Found",
    "404错误",
    "页面找不到了"
]
# 并发请求的线程数（可根据你的网络情况调整）
MAX_WORKERS = 10
# 请求超时时间（秒）
TIMEOUT = 10

# 设置请求头，模拟浏览器访问，防止被一些网站拦截
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def check_url(url):
    """
    检查单个URL，如果发现错误或关键词，则返回错误信息，否则返回None。
    """
    try:
        # 发起GET请求，禁止重定向，设置超时
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)

        # 检查HTTP状态码，4xx和5xx通常表示客户端或服务器错误
        if response.status_code >= 400:
            return (url, f"HTTP Error: {response.status_code}")

        # 获取页面内容，尝试用utf-8解码，如果失败则忽略错误
        content = response.text

        # 遍历关键词列表，检查内容中是否包含任一关键词
        for keyword in ERROR_KEYWORDS:
            if keyword in content:
                return (url, f"Keyword Found: '{keyword}'")

    except requests.exceptions.Timeout:
        return (url, "Request Timed Out")
    except requests.exceptions.RequestException as e:
        # 捕获其他所有requests库的异常，如连接错误等
        return (url, f"Connection Error: {e.__class__.__name__}")
    except Exception as e:
        return (url, f"An Unexpected Error: {e}")

    # 如果没有发现任何问题，返回None
    return None

def main():
    """
    主函数，负责读取URL、并发处理和写入结果。
    """
    print("--- URL可用性检查脚本 ---")

    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            # 读取所有URL，并去除每行首尾的空白字符
            urls = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"错误：输入文件 '{INPUT_FILE}' 未找到。请确保文件存在于同一目录下。")
        return

    if not urls:
        print("输入文件中没有找到任何URL。")
        return

    print(f"共找到 {len(urls)} 个URL，开始检查...")
    start_time = time.time()

    error_results = []

    # 使用ThreadPoolExecutor进行并发处理
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 提交所有URL检查任务
        future_to_url = {executor.submit(check_url, url): url for url in urls}

        processed_count = 0
        total_urls = len(urls)

        # 当任务完成时，处理结果
        for future in concurrent.futures.as_completed(future_to_url):
            processed_count += 1
            result = future.result()
            if result:
                # 如果有错误信息，则添加到结果列表
                error_results.append(result)
                print(f"[{processed_count}/{total_urls}] 发现问题: {result[0]} - {result[1]}")
            else:
                # 打印进度
                url = future_to_url[future]
                print(f"[{processed_count}/{total_urls}] 检查正常: {url}")

    end_time = time.time()
    print(f"\n检查完成！总耗时: {end_time - start_time:.2f} 秒。")

    # 将错误结果写入文件
    if error_results:
        print(f"共发现 {len(error_results)} 个有问题的URL，正在写入到 '{OUTPUT_FILE}'...")
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(f"URL可用性检查报告 (共 {len(error_results)} 个问题)\n")
            f.write("=" * 40 + "\n\n")
            for url, reason in sorted(error_results): # 对结果进行排序，方便查看
                f.write(f"URL: {url}\n")
                f.write(f"原因: {reason}\n")
                f.write("-" * 20 + "\n")
        print("报告已生成！")
    else:
        print("太棒了！所有URL均未发现问题。")

# --- 脚本入口 ---
if __name__ == "__main__":
    main()