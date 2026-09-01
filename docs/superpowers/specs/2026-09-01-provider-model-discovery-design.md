# Provider 模型列表临时获取设计

## 目标

模型配置弹窗中的“获取模型”应在新建和编辑状态都可用。用户填写协议、API Endpoint、API Key 和可选自定义 Header 后，可以先获取上游模型列表，再决定是否保存配置。

## 范围

- 按钮文案由“刷新模型”改为“获取模型”。
- 新增受现有登录和系统配置权限保护的临时模型发现接口。
- 新建 Provider 时，接口使用表单中尚未保存的协议、Endpoint、API Key 和 Header。
- 编辑 Provider 时，若表单没有填写新密钥，接口使用该 Provider 已加密保存的密钥；若填写了新密钥，则仅在本次请求中使用新值。
- 获取成功后只更新弹窗内的模型候选列表，不保存配置、不切换默认 Provider、不清理会话、不重启运行时。
- 保留现有按 Provider ID 获取模型的接口，避免影响已有调用。

## 接口

新增：

```text
POST /api/config/claude/providers/models/discover
```

请求体：

```json
{
  "providerId": "编辑时可选",
  "protocol": "openai-chat-completions",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "本次请求可选",
  "customHeaders": {}
}
```

服务端验证协议和 HTTP(S) Endpoint。模型列表请求使用 `Endpoint + /models`，保持 Endpoint 由用户明确填写，不猜测或改写 `/v1`。请求超时为 15 秒。

响应沿用现有模型结构：

```json
{
  "models": [{ "id": "model-id", "name": "model-id" }],
  "fetchedAt": "ISO 时间"
}
```

## 密钥与错误处理

- API Key 和 Header 值仅驻留于当前请求内存，不落盘、不写审计日志、不出现在错误响应中。
- 编辑状态使用已保存密钥时，由后端按 Provider ID 读取并解密，前端不接收真实密钥。
- 缺少 Endpoint 或可用认证信息时返回明确的 400 错误。
- 上游非成功响应返回其 HTTP 状态和脱敏后的模型列表 URL，不返回响应正文，防止上游回显敏感信息。
- 空模型列表显示“上游未返回可用模型”，不修改当前模型输入值。

## 验证

- 新建 OpenAI 兼容 Provider 无需保存即可获取模型。
- 编辑已有 Provider 可使用保存的密钥获取模型。
- 编辑时输入新密钥会优先用于临时获取，但不会保存。
- Anthropic 与 OpenAI 的鉴权 Header 保持各自协议行为。
- 点击“获取模型”不会改变 Provider 数量、默认 Provider 或运行中会话。
- Provider API 测试、Web 构建、Backend 构建和 Electron 类型检查通过。
