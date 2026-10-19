# Field Lab · 训练测算

文献现场估算工具。纯前端静态站，无服务端。覆盖有氧、功能评估、力量、临界功率/速度、供能与脱耦联。

站点：https://chengrui24.github.io/field-lab/

## 搜索引擎

构建会生成 `sitemap.xml`，并带上 canonical、Open Graph 图、面包屑结构化数据。每次发布后，Actions 用 IndexNow 把更新过的网址通知 Bing（以及接收 IndexNow 的其他引擎）。Google 不接收 IndexNow。

还需要各做一次人工验证：

1. 在 [Google Search Console](https://search.google.com/search-console) 和 [Bing Webmaster Tools](https://www.bing.com/webmasters) 添加网址前缀资源 `https://chengrui24.github.io/field-lab/`。
2. 用他们给出的 HTML meta，或把验证文件放进 `public/` 后重新发布。
3. 提交 `https://chengrui24.github.io/field-lab/sitemap.xml`。Google 再对首页使用「请求编入索引」。

百度、360、搜狗先不接。`github.io` 项目站的 `robots.txt` 必须放在 `https://chengrui24.github.io/robots.txt` 才会被读取；子目录这份只作说明，提交站点地图不依赖它。

## 本地运行

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 工具

| 页面 | 用途 |
|---|---|
| 心率与分区 | Tanaka / Gulati / Fox 对照，Karvonen 五区，LT 心率 |
| 阈值与配速 | 30 分钟计时赛、比赛反推 LT、Daniels VDOT 训练配速（不是心率） |
| VO₂max | Cooper、2.4 km 计时、Rockport 1.6 km、台阶、YMCA 功率车、ACSM 代谢式 |
| 无设备对照 | 谈话测试、鼻吸、RPE；说明为何不用 SpO₂ |
| 步行与基础功能 | 6 分钟步行、常速、5 次起坐、TUG、握力；AWGS / EWGSOP2 筛查切点 |
| 心率脱耦联 | 前半 vs 后半的心率相对配速或功率 |
| 1RM 与负荷 | Epley / Brzycki，ACSM 2026 负荷表，RIR |
| 临界功率与速度 | 骑行 CP、FTP、跑步 CS、游泳 CSS（不能互换） |
| 供能与出汗 | 咖啡因、蛋白、肌酸、碳水，体重差法出汗率 |

结果均为现场估算，不是实验室诊断。
