# Field Lab · 训练测算

文献现场估算工具。纯前端静态站，无服务端。覆盖有氧、功能评估、力量、临界功率/速度、供能与脱耦联。

站点：https://chengrui24.github.io/field-lab/

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
