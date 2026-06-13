# 待修复 Bug

> 来源: 2026-06-12 专家审查 | 最后验证: 2026-06-13 | 状态: ✅ 全部已修复

---

## 全部已修复

| 编号 | 问题 | 修复位置 | 修复日期 |
|------|------|---------|---------|
| P2-#5 | TypeError 全捕获掩盖 bug | Sprint 2 #16 — `err.message.includes('fetch')` 精确匹配 | 06-12 |
| P2-#7 | generateCandidates 空响应 | Sprint 2 #17 — GenerateDialog 显示空状态 | 06-12 |
| P2-#15 | 流中断后内容丢失 | Sprint 2 #18 — catch 返回已累积 fullText | 06-13 |
| P2-#16 | 跨标签页 settings 同步 | Sprint 2 #8 — storage 事件 + visibilitychange | 06-13 |
| P2-#17 | current 模块级可变状态 | Sprint 2 #19 — 从 store 直读，移除 let current | 06-13 |
| P2-#19 | MultiModelTest 并发 | ✅ 已用函数式 setState（原有修复） | 06-12 |
| P3-#10 | Key 输入框可视切换 | Sprint 3 #29 — Eye/EyeOff 按钮 | 06-13 |
| P3-#11 | AbortSignal 不对称 | 评审决定不做（SDK 原生实现正确） | 06-12 |
| P3-#12 | Registry 重复警告 | Sprint 3 #31 — `console.warn` | 06-13 |
| P3-#13 | maxTokens/temperature | Sprint 3 #32 — 删除死字段 | 06-13 |
| P3-#21 | TestPanel cleanup | 审查确认代码已正确 | 06-13 |
| N1 | 空 Key trim | Sprint 3 #34 — requireProvider + save handler | 06-12 |
| N3 | think 块跨 chunk | thinkFilter 未闭合标签删除至末尾 | 06-13 |

该文件保留作为历史记录，无待修复项。
