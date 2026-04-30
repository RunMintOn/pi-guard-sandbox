> [!TIP]
> 两轮真实环境测试 **全部通过**：日常 bash、文件读写、git 操作丝滑无感；越界写入、危险命令、敏感读取一击即拦。

**支持平台：Linux / WSL。** macOS 未测试，理论上可能可用。Windows 不支持。

**Pi Guard** 给你的 Agent 加了一层 OS 级的**写边界保护**。它不靠正则猜意图，不搞令牌审批地狱。它知道什么时候该闭嘴让你干活，什么时候该出手替你挡刀。

- 🧠 **聪明**：工作区内任意发挥，工作区外寸步难行
- 🪶 **无感**：不打断你的正常编码流，只拦截真正越界的操作
- 🛡️ **硬核**：bash 命令运行在真实 sandbox 里，不是字符串匹配
- 🎯 **精准**：read-only 和 workspace-write 两个模式，选一个就不用再纠结

---

[English](README.md)

---

## 1. 安装

### 系统依赖

| 工具 | 作用 | 安装 |
|------|------|------|
| `bwrap` | Linux 进程沙箱 | `sudo apt install bubblewrap` |
| `socat` | 沙箱网络代理 | `sudo apt install socat` |
| `rg` | 文件扫描 | `sudo apt install ripgrep` |

### 安装扩展

#### 从 npm 安装

```bash
pi install npm:pi-guard-sandbox      # 全局安装，所有项目生效
pi install -l npm:pi-guard-sandbox   # 仅当前项目生效
```

安装完成后进入项目，执行 `/guard i` 初始化。

#### 在本仓库内安装

如果你已经克隆了本仓库，扩展代码就在 `.pi/extensions/pi-guard/` 下：

```bash
cd .pi/extensions/pi-guard && npm install
```

启动 Pi，执行 `/guard i` 初始化。

> 要全局安装，将 `.pi/extensions/pi-guard/` 复制到 `~/.pi/agent/extensions/pi-guard/`，在该目录执行 `npm install` 即可。

---

## 2. Guard 在你的项目里留下了什么

安装 Guard 之后，你的项目里会多出这些东西。了解它们，免得困惑。

| 项目 | 说明 |
|------|------|
| `.pi/pi-guard.json` | `init` 时创建，Guard 全部配置 |
| footer 状态行 | Pi 底部持续显示当前模式 |
| bash 沙箱 | 所有 Agent bash 命令改为沙箱执行，不在宿主机直跑 |
| `vendor/` 目录 | ~1.8MB，沙箱运行时（fork 自 `@anthropic-ai/sandbox-runtime`） |
| `.pi/extensions/pi-guard/` | 扩展代码本身 |

> 删除 `.pi/pi-guard.json` 后执行 `/reload` 即可停用 Guard。

---

## 3. 快速开始

在项目目录启动 Pi，然后：

```
/guard i        → 初始化，创建配置
/guard r        → 切到 read-only 模式
/guard w        → 切到 workspace-write 模式（默认）
```

初始化后 Guard 立即生效，footer 会显示当前状态。

---

## 4. 命令参考

| 命令 | 简写 | 作用 |
|------|------|------|
| `/guard` | — | 查看当前状态和配置 |
| `/guard init` | `/guard i` | 创建 `.pi/pi-guard.json` 并启用 Guard |
| `/guard read-only` | `/guard r` | 切换到 read-only 模式 |
| `/guard workspace-write` | `/guard w` | 切换到 workspace-write 模式 |

---

## 5. 模式说明

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

## 6. 故障排查

| 状态 | 原因 | 处理 |
|------|------|------|
| `Guard: uninitialized` | 未初始化 | 执行 `/guard i` |
| `Guard: invalid-config` | JSON 格式错误 | 检查 `.pi/pi-guard.json` 语法，修复后 `/reload` |
| `Guard: sandbox-unavailable` | 系统依赖缺失或 npm 未安装 | 执行第 1 节安装步骤，检查 `bwrap`、`socat`、`rg` |

---

## 7. 配置文件 `.pi/pi-guard.json`

`/guard init` 会在项目根目录生成这个文件，你也可以手动编辑（修改后需 `/reload` 生效）。

### 完整示例

```json
{
  "mode": "workspace-write",

  "sensitiveReadDeny": [
    "~/.ssh",
    "~/.aws",
    "~/.npmrc"
  ],

  "protectedPaths": {
    "block": [
      ".git",
      "node_modules"
    ],
    "approval": [
      ".env",
      ".env.*",
      ".pi/pi-guard.json"
    ]
  },

  "bashPolicy": {
    "directBlock": [
      "sudo",
      "su",
      "dd"
    ],
    "requireApproval": [
      "rm-rf",
      "git-reset-hard",
      "git-clean-fd"
    ]
  }
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `mode` | `"readonly"` 或 `"workspace-write"`。`/guard r` / `/guard w` 可直接切换 |
| `sensitiveReadDeny` | 禁止读取的路径，支持 `~` 和 glob。对所有 Agent 读操作生效 |
| `protectedPaths.block` | `write` / `edit` 直接拒绝的路径 |
| `protectedPaths.approval` | `write` / `edit` 弹审批的路径 |
| `bashPolicy.directBlock` | bash 直接拒绝的命令 |
| `bashPolicy.requireApproval` | bash 需审批的命令 |

### 添加你自己的敏感路径

```json
"sensitiveReadDeny": [
  "~/.ssh",
  "~/.aws",
  "~/my-project/secrets.yml"
]
```

### 添加你要拦截的危险命令

```json
"bashPolicy": {
  "directBlock": [
    "sudo",
    "docker-host-root-bind"
  ],
  "requireApproval": [
    "rm-rf",
    "bash-c"
  ]
}
```

> `bashPolicy` 里的是**策略 ID**，不是正则。完整可用的 ID 列表见 `init` 生成的默认配置。
