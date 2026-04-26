# 6SQ QuanX Check-in

六西格玛品质网（6SQ）Quantumult X 签到脚本。

## 特性
- 不在脚本内保存明文 cookie
- 通过 QuanX `script-request-header` 在你登录网页时自动抓取 cookie
- cookie 仅保存在 QuanX 本地存储
- 定时任务读取本地 cookie 自动签到
- cookie 失效通知会绑定 `https://www.6sq.net/qiandao/`，点击通知可直达签到页重新抓取 cookie
- 点击通知打开签到页后，脚本会在抓到新 cookie 时立即尝试补签

## 文件
- `6sq-checkin-quanx.js`：二合一脚本（抓 cookie + 定时签到）

## 一键导入
### QuanX 真正一键导入（推荐）
- 6SQ：`quantumult-x:///add-resource?remote-resource=https%3A%2F%2Fraw.githubusercontent.com%2Feleven252412%2F6sq-quanx-checkin%2Fmain%2Fquanx-import.conf,tag=6SQ%E7%AD%BE%E5%88%B0&img-url=https%3A%2F%2Fraw.githubusercontent.com%2Fgithub%2Fexplore%2Fmain%2Ftopics%2Fquantumult-x%2Fquantumult-x.png`

### 原始配置文件链接
- 6SQ：`https://raw.githubusercontent.com/eleven252412/6sq-quanx-checkin/main/quanx-import.conf`

## QuanX 配置
### 1. 抓取 cookie
```ini
[rewrite_local]
^https?:\/\/www\.6sq\.net\/(qiandao\/?.*|account\/login\/?.*|$) url script-request-header https://raw.githubusercontent.com/eleven252412/6sq-quanx-checkin/main/6sq-checkin-quanx.js
```

### 2. 定时签到
```ini
[task_local]
0 8 * * * https://raw.githubusercontent.com/eleven252412/6sq-quanx-checkin/main/6sq-checkin-quanx.js, tag=6SQ签到, enabled=true
```

## 使用步骤
1. 在 QuanX 添加上面的 `rewrite_local`
2. 登录 `https://www.6sq.net/account/login/`
3. 登录后打开 `https://www.6sq.net/qiandao/`
4. 看到 `6SQ Cookie 抓取 / 成功 / 已保存到 QuanX 本地存档`
5. 再添加 `task_local` 定时任务

## 说明
- 站点签到接口：`POST https://www.6sq.net/qiandao/ajax/send/`
- 页面里的“手机用户专用签到”和普通签到走同一接口
- 成功/已签通知已改为极简：`签到成功 | 今日获取X6SQ币 | 总积分Y`
- 签到失败、登录失效、接口异常时才保留详细诊断信息
- 如果本地 cookie 失效，通知会带可点击链接，点开后直接进入 `https://www.6sq.net/qiandao/` 重新抓 cookie
- 如果 QuanX/Safari 里仍是登录态，打开签到页会自动保存新 cookie 并立即补签；如果网页也已退出登录，则需要先重新登录 6SQ
- 脚本不会上传 cookie 到外部服务

## 敏感信息检查
发布版已移除：
- 明文 cookie
- 本地绝对路径
- 个人手机号占位值

## License
MIT
