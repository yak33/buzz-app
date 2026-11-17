# 界面本地化

当前支持英文（en-US）和简体中文（zh-CN）。设置 → 语言可立即切换，选择只保存在当前设备；其他共享 localStorage 的窗口通过 storage 事件同步。首次启动优先读取已保存的选择，再按系统/浏览器语言顺序匹配，最后回退英文。保存失败时保留本次选择，并显示重试按钮。

## 实现位置

- `src/features/localization/service.ts`：读取、保存、跨窗口同步语言；useLingui 订阅语言变化。
- `src/features/localization/locales.ts`：支持的语言及语言匹配规则。
- `src/features/localization/locales/*.po`：英文源码文案和中文译文，包含来源文件。
- `src/app/LanguageSettings.tsx`：语言设置入口，复用 SettingsGroup、PreferenceRow、Select、ToastNotice。
- `scripts/localization-plugin.ts`：Vite、Vitest 和浏览器测试的统一宏/语言包编译配置。

Lingui 宏由构建过程展开，通过 lingui.config.ts 指向本项目的 i18n/useLingui 实例。组件必须使用 useLingui，才能在语言变化时重新渲染；纯配置使用 msg 描述符，在渲染时调用 i18n._，不要在模块初始化时缓存翻译结果。

## 添加文案

1. 组件中从 @lingui/react/macro 引入 useLingui，使用其 t 模板标记完整句子。动态数量使用 Lingui 的复数格式；不要拼接需要调整语序的句子。
2. 执行 `pnpm i18n:extract`，在 zh-CN.po 中填写译文，保留占位符名称。
3. 执行 `pnpm i18n:check`；该命令检查目录同步，并在使用英文回退之前检查译文缺失。
4. 执行 `pnpm typecheck` 和修改模块的 Vitest 测试，再在页面中验证切换、刷新、深浅色、窄窗口和放大显示。

英文缺失回退由 Lingui 编译语言包时处理。界面尚未全部覆盖，所以 document.lang 保持英文；已翻译区域、Select 弹层与 Toast 显式携带语言标记。用户编写的内容不进入翻译函数。插件提供的标题保留原文及对应语言边界。

## 当前覆盖与剩余范围

本批覆盖设置导航、语言设置、个人资料主要表单、外观、通知、本地设置（含仓库目录和对话保留时间）及软件更新页面。尚未完成：应用外壳的部分标题、登录/社区加入、消息与话题、智能体设置、身份与安全、快捷键、头像编辑、插件管理和各内置插件、原生菜单，以及部分嵌套表单和后端错误文案。UI 翻译不改变语音识别或语音合成支持的语言。

浏览器验证不等于 Windows 原生安装包验证。继续开发时按模块增加文案并复用现有组件，保持协议字段、持久化值、路由 ID、用户消息和代码不变。

## 来源

本实现参考并适配上游尚未合并的 Lingui 国际化提案 block/buzz-app#1115（dce7cf4a88164de8931d99d90ed23bea045d0411），没有合并该 PR 的旧版应用代码。新增依赖为固定版本 6.9.1 的 @lingui/core、@lingui/react、@lingui/cli、@lingui/format-po 和 @lingui/vite-plugin，分别负责消息运行时、React 宏、提取检查、PO 格式和构建编译。
