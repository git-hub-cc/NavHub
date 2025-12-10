import json
import os
import io
from collections import OrderedDict

def generate_compact_json(input_path: str, output_path: str):
    """
    读取JSON文件，重新排序'engines'，并生成一种特殊的紧凑格式：
    - 'categories' 列表中的每个对象占一行。
    - 'engines' 列表中的每个对象占一行。
    然后将结果保存到新文件中。

    Args:
        input_path (str): 输入的JSON文件路径。
        output_path (str): 输出的JSON文件路径。
    """
    if not os.path.exists(input_path):
        print(f"错误: 输入文件未找到于路径 '{input_path}'")
        return

    try:
        # 1. 读取并解析JSON数据
        with io.open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        categories = data.get('categories', [])
        original_engines = data.get('engines', {})

        # 2. 根据 categories 的顺序重新排序 engines
        reordered_engines = OrderedDict()
        for category in categories:
            key = category.get('value')
            if key and key in original_engines:
                reordered_engines[key] = original_engines[key]

        # 3. 手动构建高度自定义的JSON字符串
        output_lines = []
        output_lines.append('{')

        # 3.1 处理 'categories' 部分 (每个对象一行)
        output_lines.append('  "categories": [')
        num_categories = len(categories)
        for i, category_obj in enumerate(categories):
            # 将每个分类对象转换为紧凑的单行JSON字符串
            category_line = '    ' + json.dumps(category_obj, ensure_ascii=False)
            if i < num_categories - 1:
                category_line += ','
            output_lines.append(category_line)
        output_lines.append('  ],')

        # 3.2 处理 'engines' 部分 (每个对象一行)
        output_lines.append('  "engines": {')
        num_engine_keys = len(reordered_engines)
        for i, (key, engine_list) in enumerate(reordered_engines.items()):
            output_lines.append(f'    "{key}": [')
            num_engines = len(engine_list)
            for j, engine_item in enumerate(engine_list):
                # 将每个引擎对象转换为紧凑的单行JSON字符串
                engine_line = '      ' + json.dumps(engine_item, ensure_ascii=False)
                if j < num_engines - 1:
                    engine_line += ','
                output_lines.append(engine_line)

            closing_bracket = '    ]'
            if i < num_engine_keys - 1:
                closing_bracket += ','
            output_lines.append(closing_bracket)

        output_lines.append('  }')
        output_lines.append('}')

        # 4. 将所有行合并并写入文件
        final_output = "\n".join(output_lines) + "\n"

        with io.open(output_path, 'w', encoding='utf-8') as f:
            f.write(final_output)

        print(f"文件处理成功！已将紧凑格式的内容保存到: '{output_path}'")

    except json.JSONDecodeError:
        print(f"错误: 文件 '{input_path}' 的JSON格式无效。")
    except Exception as e:
        print(f"发生未知错误: {e}")

if __name__ == "__main__":
    input_file = os.path.join('../data', '00engines.json')
    output_file = os.path.join('../data', '00engines_compact_formatted.json')

    generate_compact_json(input_file, output_file)