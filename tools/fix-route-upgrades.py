#!/usr/bin/env python3
"""
修复路线牌价值过高问题

问题：路线牌除了给路线进度，还额外给了属性加成
解决方案：移除所有路线牌的stats effect，只保留route effect
"""

import re

# 读取文件
with open('src/data/upgrades.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 统计
route_upgrades_fixed = 0
stats_removed = 0

# 正则模式：匹配 category: 'route' 的升级项中的 stats effect
# 匹配从 effects: [ 开始，到包含 type: 'route' 的结束
pattern = r"(category: 'route',[\s\S]*?effects: \[)\s*\{\s*type: 'stats',\s*modifiers: \{[^}]+\},?\s*\},\s*(\{\s*type: 'route',)"

def replacer(match):
    global route_upgrades_fixed, stats_removed
    route_upgrades_fixed += 1
    stats_removed += 1
    before = match.group(1)
    route_effect = match.group(2)
    return f"{before}\n      {route_effect}"

# 执行替换
new_content = re.sub(pattern, replacer, content)

print(f'开始修复路线牌价值过高问题...\n')
print(f'修复完成！')
print(f'- 修复路线牌数量: {route_upgrades_fixed}')
print(f'- 移除stats块数量: {stats_removed}')

# 写回文件
with open('src/data/upgrades.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f'\n已保存到: src/data/upgrades.ts')
