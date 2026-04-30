# Pi Guard v0.1

**Pi Guard** 是一个 Pi coding agent 的项目级扩展。为 Agent 发出的文件读写和 bash 命令加上**写边界保护**：防止越界修改、拦截危险命令，同时尽量保留 Agent 的正常工作效率。

---

## 1. 安装

### 系统依赖

| 工具 | 作用 | 安装 |
|------|------|------|
| `bwrap` | Linux 进程沙箱 | `sudo apt install bubblewrap` |
| `socat` | 沙箱网络代理 | `sudo apt install socat` |
| `rg` | 文件扫描 | `sudo apt install ripgrep` |

### 项目依赖

```bash
cd .pi/extensions/pi-guard && npm install
```

> 发布到 npm 后可直接 `pi install npm:pi-guard`。

---

## 2. 快速开始

在项目目录启动 Pi，然后：

```
/guard i        → 初始化，创建配置
/guard r        → 切到 read-only 模式
/guard w        → 切到 workspace-write 模式（默认）
```

初始化后 Guard 立即生效，footer 会显示当前状态。

---

## 3. 命令参考

| 命令 | 简写 | 作用 |
|------|------|------|
| `/guard` | — | 查看当前状态和配置 |
| `/guard init` | `/guard i` | 创建 `.pi/pi-guard.json` 并启用 Guard |
| `/guard read-only` | `/guard r` | 切换到 read-only 模式 |
| `/guard workspace-write` | `/guard w` | 切换到 workspace-write 模式 |

---

## 4. 模式说明

| | read-only | workspace-write |
|---|---|---|
| 读工作区内文件 | ✅ | ✅ |
| 读工作区外文件 | ✅（敏感路径除外） | ✅（敏感路径除外） |
| 写工作区内文件 | ❌ | ✅ |
| 写工作区外文件 | ❌ | ❌（需审批） |
| bash 运行命令 | ✅（不可写真实文件） | ✅（可写工作区 + /tmp） |
| bash 写工作区外 | ❌ | ❌ |
| 危险命令 | 拦截 + 审批 | 拦截 + 审批 |

### 敏感路径（不可读）

`~/.ssh`  `~/.aws`  `~/.gnupg`  `~/.git-credentials`
`~/.npmrc`  `~/.pypirc`  `~/.netrc`  `~/.env`  `~/.env.*`

### 不保护的对象

**用户手动 `!cmd` / `!!cmd` 不受 Guard 保护。** Guard 只保护 Agent 自发调用的工具。

---

## 5. Guard 在你的项目里留下了什么

| 项目 | 说明 |
|------|------|
| `.pi/pi-guard.json` | `init` 时创建，Guard 全部配置 |
| footer 状态行 | Pi 底部持续显示当前模式 |
| bash 沙箱 | 所有 Agent bash 命令改为沙箱执行 |
| `vendor/` 目录 | ~1.8MB，沙箱运行时（fork 自 `@anthropic-ai/sandbox-runtime`） |
| `.pi/extensions/pi-guard/` | 扩展代码本身 |

删除 `.pi/pi-guard.json` 后执行 `/reload` 即可停用 Guard。

---

## 6. 故障排查

| 状态 | 原因 | 处理 |
|------|------|------|
| `Guard: uninitialized` | 未初始化 | 执行 `/guard i` |
| `Guard: invalid-config` | JSON 格式错误 | 检查 `.pi/pi-guard.json` 语法，修复后 `/reload` |
| `Guard: sandbox-unavailable` | 系统依赖缺失或 npm 未安装 | 执行第 1 节安装步骤，检查 `bwrap`、`socat`、`rg` |
