import os
import json
import shutil

# --- 配置 ---
# 包含JSON文件的目录
DATA_DIR = '../data'
# 备份图片的目录
IMG_BAK_DIR = '../img'

def find_icons_recursively(data, icon_paths_set):
    """
    递归地在嵌套的字典或列表中查找 'icon' 键，并将非空值添加到集合中。

    :param data: 要搜索的JSON数据（字典或列表）。
    :param icon_paths_set: 用于存储找到的图标路径的集合。
    """
    if isinstance(data, dict):
        for key, value in data.items():
            # 如果键是 'icon' 并且值是一个非空字符串，则添加它
            if key == 'icon' and isinstance(value, str) and value:
                icon_paths_set.add(value)
            # 否则，继续递归搜索
            else:
                find_icons_recursively(value, icon_paths_set)
    elif isinstance(data, list):
        # 如果是列表，遍历列表中的每一项
        for item in data:
            find_icons_recursively(item, icon_paths_set)

def main():
    """
    主执行函数
    """
    print("--- 开始处理图标文件 ---")

    # 1. 检查data目录是否存在
    if not os.path.isdir(DATA_DIR):
        print(f"错误: 目录 '{DATA_DIR}' 不存在。请确保脚本与 '{DATA_DIR}' 目录在同一级别。")
        return

    # 2. 查找并读取所有JSON文件以提取图标路径
    json_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json')]
    if not json_files:
        print(f"在 '{DATA_DIR}' 目录中没有找到任何JSON文件。")
        return

    print(f"找到 {len(json_files)} 个JSON文件: {', '.join(json_files)}")

    all_icon_paths = set()
    for json_file in json_files:
        file_path = os.path.join(DATA_DIR, json_file)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                find_icons_recursively(data, all_icon_paths)
        except json.JSONDecodeError:
            print(f"警告: 文件 '{json_file}' 不是有效的JSON格式，已跳过。")
        except Exception as e:
            print(f"读取文件 '{json_file}' 时出错: {e}")

    # 3. 报告找到的唯一图标数量
    if not all_icon_paths:
        print("所有JSON文件中均未找到任何有效的 'icon' 路径。")
        return

    print(f"\n共找到 {len(all_icon_paths)} 个唯一的图标路径。")

    # 4. 创建备份目录
    if not os.path.exists(IMG_BAK_DIR):
        os.makedirs(IMG_BAK_DIR)
        print(f"已创建备份目录: '{IMG_BAK_DIR}'")

    # 5. 复制文件
    print("\n--- 开始复制文件 ---")
    copied_count = 0
    not_found_count = 0

    # 对路径进行排序，以确保输出顺序一致
    sorted_paths = sorted(list(all_icon_paths))

    for icon_path in sorted_paths:
        # 确保路径分隔符与当前操作系统兼容
        source_path = os.path.normpath(icon_path)

        if not os.path.dirname(source_path):
            print(f"警告: 路径 '{icon_path}' 格式不正确，已跳过。")
            continue

        # 目标路径仅使用文件名
        dest_filename = os.path.basename(source_path)
        dest_path = os.path.join(IMG_BAK_DIR, dest_filename)

        if os.path.exists(source_path):
            try:
                shutil.copy2(source_path, dest_path)
                print(f"  [成功] 已复制: {source_path} -> {dest_path}")
                copied_count += 1
            except Exception as e:
                print(f"  [失败] 复制 '{source_path}' 时出错: {e}")
        else:
            print(f"  [警告] 源文件未找到，跳过: {source_path}")
            not_found_count += 1

    # 6. 打印最终总结
    print("\n--- 处理完成 ---")
    print(f"成功复制文件数: {copied_count}")
    print(f"未找到的源文件数: {not_found_count}")
    print(f"备份文件已保存至 '{IMG_BAK_DIR}' 目录。")

if __name__ == '__main__':
    main()