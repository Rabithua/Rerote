# 直接导入 Rote

连接 Rote 实例地址与 OpenKey，选择 Memos、flomo、微信读书或 Dinox 来源，转换后预览并勾选笔记，再直接导入。JSON 下载保留为可选备份。

OpenKey 仅保存在当前页面内存，刷新或断开连接后需要重新输入。连接通过实际浏览器请求 `GET /v2/api/openkey/permissions` 检查账号、权限、导入协议和实例 CORS。旧实例需要升级到支持 OpenKey 正式导入的版本。基础权限为 GETROTE、SENDROTE；附件还需要 UPLOADATTACHMENT，视频需要 UPLOADVIDEO 和账号的视频能力；覆盖需明确勾选并具备 EDITROTE。微信读书产生的文章 upsert 还需要 SENDARTICLE、EDITARTICLE。

默认私密、跳过已有来源。执行器先对所有选中笔记按 50 条调用 plan，再下载、处理、上传附件，最后每批最多提交 50 条到正式 import。保留历史 createdAt、来源映射和附件顺序。附件部分失败时整条笔记不提交，成功上传的未绑定资源进入清理流程。取消停止后续工作，已发出的提交等待结果后再清理；响应丢失时暂留附件，重试先重新 plan，确认此前提交的结果，避免再次转存已存在的笔记。清理失败的资源留在页面内存并在重试前再次清理。

远程附件地址必须允许浏览器 CORS 下载。Memos 的来源令牌仅发送至原 Memos 实例路径范围，不发送至其他图片域名或 Rote。下载、媒体处理、上传、finalize 和提交的失败阶段及附件序号可在结果明细查看。音频和普通文件明确报告不支持，不会转换成图片。

## 图片与视频

原图字节单独上传并计算 SHA256。浏览器使用 libwebp 1.6.0 WASM 在 Worker 中生成 WebP；处理 EXIF 方向、sRGB 与透明度。依次尝试 `(1600,80)`、`(1600,65)`、`(1200,65)`、`(900,55)`、`(600,45)`，采用首个最长边不超过 1600、大小不超过 512 KiB 的结果。全部失败明确报错，无 PNG 回退。上传声明真实 MIME 和大小。视频原件与浏览器生成的 JPEG 封面分别上传，遵循 Rote 视频附件协议。

运行 `scripts/build-webp-codec.sh` 可用 Emscripten 4.0.18 从官方 libwebp 1.6.0 源码重建。随附 COPYING 与 PATENTS；当前 WASM SHA256 为 `82213bbbece86fe0c332c25f79252a0ad094fcf33f3d50374991547a6cdc2d41`。

## Dinox

根数组，优先完整 contentMd，再用 contentHtml/contentText。标题合入正文，首个文字块已有标题则不重复。保留仅标题、仅图片，跳过完全空白；无时区 createTime 按北京时间转 UTC，无效日期报错，缺少更新时间不生成。明确 tags 优先，层级路径保留，代码中的 # 不作为标签。Markdown 图片与相邻 kind:image/resourceId 注释提取为有序附件，代码块保持原样。

来源账号跨文件稳定。笔记身份由原创建时间、原标题、原正文指纹与相同记录出现次数组成，使用现有 UUIDv5 来源函数；清理和显示选项不会影响身份。resourceId 仅用于附件身份。无原始笔记 ID 的格式在编辑原始字段或改变重复记录数量后可能产生新身份。

## 验证与发布状态

已使用合成 fixture 和本机隔离 PostgreSQL 验证字段、标题、空白、标签、时区、来源身份、正式导入、重复跳过、附件顺序、失败清理与重试。浏览器验证真实 WebP、原图 SHA256、方向与透明度。完整上传链路使用真实 Rote 路由与 presign SDK，对象存储由本机内存 S3 fixture 接收；不代表真实云存储验收。另一台机器上的两份 Dinox 真实样本尚未验证。

本次只合并代码，不发布生产。`vercel.json` 保留 hkg1，同时通过 `git.deploymentEnabled.main = false` 暂停 main 的 Git 自动部署，PR 分支预览正常。收到单独的生产发布授权后再恢复 main 自动部署并进行发布验收。
