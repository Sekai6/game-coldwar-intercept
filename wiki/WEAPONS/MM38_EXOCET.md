# 飞鱼 MM38 反舰导弹

> 当前主分支 · Unreleased。早期舰射 MM38，不是 AM39、SM39 或 MM40。

[武器目录](README.md) · [参数表](MISSILE_PARAMETERS.md) · [English](../en/WEAPONS/MM38_EXOCET.md)

## 公开资料与型号边界

法国 Exocet／飞鱼系列的早期舰射型号，1967 年开始研制，1975 年服役。CSIS 的 MM38 分项列出：长约 5.21 m、直径约 .35 m、发射质量约 735 kg、165 kg 高爆破片战斗部、射程约 40 km；使用固体火箭助推／续航、惯性导航及主动雷达末制导，亚音速掠海飞行。

这些数字只描述 MM38。不能把系列信息框或 MM40 Block 3 的涡喷、180–200 km 级射程、GPS／对陆能力套用到本型号；也不能将舰射 MM38 当成空射 AM39。公开性能用于背景说明，不能从中推导本游戏的探测距离、突防概率或毁伤值。

## 外形与游戏实现

![飞鱼 MM38 程序化模型](../../verification-threat-mm38-exocet-ultra.png)

- 稳定 ID：`MM38 Exocet`；定义：`src/threats/exocet.ts`；预设：`EXOCET RAID`。
- 细长弹体、尖形雷达罩、大型后掠十字主翼和较小后部控制翼；主翼与尾翼错开，**不添加涡喷进气道**。程序化外形用于识别，不是工程复刻。
- 巡航／末段高度 `.3 / .1`、速度 `5.8 / 6.4`、伤害 `20`、RCS `.13` 是游戏参数；生成距离 `340` 世界单位不是现实射程。共享飞行模型不模拟完整固体火箭推力／滑翔曲线。
- 仅支持 `in-flight` 波次，不新增舰艇或飞机挂载，不允许通过 Moskva 发射槽发射。复用雷达、SAM／CIWS、ECM、箔条及 AAR／Tacview；不继承 Harpoon 的 HOJ、跃升或蛇形机动。
- 沿用预生成来袭的简化末段激活和反制偏转，不新增独立导引头捕获／失锁状态机。

## 来源

核对日期：2026-10-24。

- [CSIS Missile Threat — Exocet](https://missilethreat.csis.org/missile/exocet/)：以 **Exocet MM38** 分项核对年代、尺寸、质量、战斗部、射程、动力和制导，未采用其他型号的指标。
- [Exocet — Wikipedia](https://en.wikipedia.org/wiki/Exocet)：交叉核对系列历史和型号区别；页面首图是 AM39，未将其标成 MM38。
