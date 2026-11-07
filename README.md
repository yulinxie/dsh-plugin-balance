# dsh-plugin-balance

在 DSH（DeepSeek Harness）Web 界面顶部中间显示一个「余额 ¥x.xx」小胶囊，数据来自宿主自己的 `deepseekAccount` 服务，插件本身不接触任何 token。

- 服务端：`GET /dsh-plugin-balance/state` → `{ ok, balance, currency, raw }`
- 客户端：把 Pill 注册进 `shell.overlay` 插槽，每 60 秒轮询一次
- 失败时静默：取不到数据就不渲染，不会在界面上留下报错

## 安装到另一台电脑

前提：目标机器已安装 **DSH 桌面版或 Web 版，且登录了 DeepSeek 账号**（`deepseekAccount` 服务由宿主提供）。

### 方式 A：插件页安装（推荐，桌面版同样适用）

1. 把 `dsh-plugin-balance-0.1.0.tgz` 拷到目标机器，例如 `D:\tools\dsh-plugin-balance-0.1.0.tgz`。
2. 打开 DSH，左侧边栏 → **插件** → 安装 / 添加组合包。
3. 在输入框里填 **绝对路径**：

   ```
   D:\tools\dsh-plugin-balance-0.1.0.tgz
   ```

   也可以写 `file:D:\tools\dsh-plugin-balance-0.1.0.tgz`；不能写相对路径。
4. 确认安装。装完组合包会自动加入 `dsh.profile.bundles`，页面通常热加载；没看到胶囊就 F5 刷新一次。

### 方式 B：命令行（`web` / `headless` 等非 desktop profile）

`dsh plugin` 只是把参数转发给 pnpm，**不会**替你选中组合包，装完还要把名字加进 profile 的 `dsh.profile.bundles`：

```sh
dsh plugin --profile web add file:/path/to/dsh-plugin-balance-0.1.0.tgz
```

> `desktop` profile 由桌面端持有，npm CLI 会拒绝管理它 —— 桌面版请走方式 A。

### 方式 C：没有网络/不想走 pnpm

把 `balance-plugin` 整个目录拷过去，在 profile 的 `package.json` 里声明路径依赖，再安装：

```json
"dependencies": { "dsh-plugin-balance": "link:D:/tools/balance-plugin" }
```

这种方式依赖源目录一直在，移动/删除就失效；分发建议用方式 A。

## 验证装好了

- 界面顶部中间出现「余额 ¥…」。
- 或直接请求：`http://127.0.0.1:54390/dsh-plugin-balance/state`（端口以实际 Web GUI 为准），应返回 `{"ok":true,"balance":...}`。
- 返回 `404` = 插件没被加载（没选中组合包，或包没装进 profile）。
- 返回 `{"ok":false,...}` = 插件在跑但宿主账号不可用（没登录 / 服务不可达）。

## 更新 / 卸载

- 更新：改 `package.json` 的 `version` → `pnpm pack` → 卸载旧版 → 用新 `.tgz` 再装一次（同版本号重复安装会被 `already-installed` 拒绝）。
- 卸载：插件页移除该组合包，或 `dsh plugin --profile <name> remove dsh-plugin-balance`（记得同步从 `dsh.profile.bundles` 删掉）。

## 兼容性

- 依赖宿主契约：`webServer.register`、`deepseekAccount.getBalance`、客户端 `shell.overlay` 插槽、`window.__ModuleLoader__`。已在 DSH `0.2.1-rc.5` 上验证。
- `package.json` 的 `engines.dsh` 声明了可接受的宿主范围；超出范围时安装会被拒绝，可用 `dsh plugin allow-version` 做精确版本豁免。

## 打包

```sh
cd balance-plugin
pnpm pack --pack-destination ..
```

产物是 `dsh-plugin-balance-<version>.tgz`，只包含 `package.json`、`index.mjs`、`client.js`、`cordis.patch.yml`、`README.md`。
