import { getSettingModule } from "./modules/Setting";
import { Util } from "./modules/Util";
import { Block } from "./prefabs/Block";
import { Lightning } from "./prefabs/Lightning";
import { Model } from "./constants/Model";
import { getAudioModule } from "./modules/Audio";

const AudioModule = getAudioModule();
const SettingModule = getSettingModule();
const { ccclass, property } = cc._decorator;

type BlockIndexOfContainer = { xIndex: number; yIndex: number };

@ccclass
export class Game extends cc.Component {
  isPlaying = false;

  gameTime = SettingModule.gameTime;

  map: cc.JsonAsset = null;

  blockContainer: cc.Node = null;

  lightningContainer: cc.Node = null;

  @property(cc.Prefab)
  blockPrefab: cc.Prefab = null;

  @property(cc.Prefab)
  lightningPrefab: cc.Prefab = null;

  public combo: number = 0;
  public lastComboTimeStamp = 0;

  private blockWidth: number;
  private blockHeight: number;

  private blockSelect1: number = -1;
  private blockSelectIconIndex1: number = -1;
  private blockSelect2: number = -1;
  private blockSelectIconIndex2: number = -1;

  private currentMap: number[][] = [];

  // 闪电样式类型
  private lightningType: Model.LightningType;
  // 闪电路径坐标点，最多有3条线
  private pointBeginFst: BlockIndexOfContainer;
  private pointEndFst: BlockIndexOfContainer;
  private pointBeginSec: BlockIndexOfContainer;
  private pointEndSec: BlockIndexOfContainer;
  private pointBeginThr: BlockIndexOfContainer;
  private pointEndThr: BlockIndexOfContainer;

  // 背景音乐钩子
  private bgRef: number;

  private dts = 0;

  async onLoad() {
    this.blockContainer = cc.find("blockContainer", this.node);
    this.lightningContainer = cc.find("lightningContainer", this.node);
    this.blockContainer.scale = 1;
    this.lightningContainer.scale = 1;

    this.getBlockWidthAndHeight();

    if (!this.map) await this.loadJson("map");
    const index = Util.getRandomNumber(0, this.map.json.length);
    this.generateBlocks({ map: this.map.json[index].map });

    this.isPlaying = true;

    this.bgRef = await AudioModule.play(Model.AudioEnum.bg, true, 1);

    AudioModule.play(Model.AudioEnum.start);
  }

  update(dt: number) {
    this.dts += dt;
    if (this.dts > 0.2) {
      const total = cc.find("total", this.node).getComponent(cc.Label);
      total.string = `剩余：${this.blockContainer.childrenCount}`;

      // 方块数为0则胜利
      if (this.isPlaying && this.blockContainer.childrenCount === 0) {
        // 播放音效
        AudioModule.play(Model.AudioEnum.end);
        this.isPlaying = false;
        cc.audioEngine.stop(this.bgRef);
      }

      this.dts = 0;
    }
  }

  blockClick(options: { siblingIndex: number; iconIndex: number }) {
    const { siblingIndex, iconIndex } = options;

    if (this.blockSelect1 === -1) {
      this.blockSelect1 = siblingIndex;
      this.blockSelectIconIndex1 = iconIndex;
    } else if (this.blockSelectIconIndex1 === iconIndex) {
      this.blockSelect2 = this.blockSelect1;
      this.blockSelectIconIndex2 = this.blockSelectIconIndex1;
      this.blockSelect1 = siblingIndex;
      this.blockSelectIconIndex1 = iconIndex;

      // 连续点击同一个方块
      if (this.blockSelect1 === this.blockSelect2) {
        return;
      }

      // 尝试消除
      this.blockClear({
        blockSelect1: this.blockSelect1,
        blockSelectIconIndex1: this.blockSelectIconIndex1,
        blockSelect2: this.blockSelect2,
        blockSelectIconIndex2: this.blockSelectIconIndex2,
      });
    } else {
      this.blockSelect1 = siblingIndex;
      this.blockSelectIconIndex1 = iconIndex;
      this.blockSelect2 = -1;
      this.blockSelectIconIndex2 = -1;
    }

    const tmp = [this.blockSelect1, this.blockSelect2];
    this.blockContainer.children.forEach((child, index) => {
      const block = child.getComponent(Block);
      if (tmp.includes(index)) {
        block.select();
      } else {
        block.unSelect();
      }
    });
  }

  /**
   * 尝试消除两个方块
   */
  private blockClear(options: {
    blockSelect1: number;
    blockSelectIconIndex1: number;
    blockSelect2: number;
    blockSelectIconIndex2: number;
  }): boolean {
    const { blockSelect1, blockSelectIconIndex1, blockSelect2, blockSelectIconIndex2 } = options;

    if (blockSelectIconIndex1 !== blockSelectIconIndex2) return false;

    const begin = this.blockContainer.children[blockSelect2];
    if (!begin) throw Error(`Game.ts blockClear() begin is null, blockSelect2=${blockSelect2}`);

    const beginCom = begin.getComponent(Block);

    const end = this.blockContainer.children[blockSelect1];
    if (!end) throw Error(`Game.ts blockClear() end is null, blockSelect1=${blockSelect1}`);

    const endCom = end.getComponent(Block);

    // 水平方向判断
    if (this.horizon({ begin: beginCom, end: endCom })) {
      this.blockBoom(beginCom, endCom);
      return true;
    }
    // 垂直方向判断
    if (this.vertical({ begin: beginCom, end: endCom })) {
      this.blockBoom(beginCom, endCom);
      return true;
    }
    // 一折点判断
    if (this.brokenLineOnce({ begin: beginCom, end: endCom })) {
      this.blockBoom(beginCom, endCom);
      return true;
    }
    // 两折点判断
    if (this.brokenLineTwice({ begin: beginCom, end: endCom })) {
      this.blockBoom(beginCom, endCom);
      return true;
    }
    return false;
  }

  /**
   * 判断方块是否在同一水平方向可消除
   */
  private horizon(options: { begin: BlockIndexOfContainer; end: BlockIndexOfContainer }) {
    const { begin, end } = options;

    if (begin.yIndex !== end.yIndex) return false;

    // 两点之间是否有障碍物
    const min = Math.min(begin.xIndex, end.xIndex);
    const max = Math.max(begin.xIndex, end.xIndex);
    for (let i = min + 1; i < max; i++) {
      if (this.currentMap[begin.yIndex][i] != -1) {
        return false;
      }
    }

    // 如果可以连通，则设定闪电动画样式类型和起点节点、终点节点
    this.lightningType = Model.LightningType.X;
    this.pointBeginFst = begin;
    this.pointEndFst = end;

    return true;
  }

  /**
   * 判断方块是否在同一垂直方向可消除
   */
  private vertical(options: { begin: BlockIndexOfContainer; end: BlockIndexOfContainer }) {
    const { begin, end } = options;

    if (begin.xIndex !== end.xIndex) return false;

    // 两点之间是否有障碍物
    const min = Math.min(begin.yIndex, end.yIndex);
    const max = Math.max(begin.yIndex, end.yIndex);
    for (let i = min + 1; i < max; i++) {
      if (this.currentMap[i][begin.xIndex] !== -1) {
        return false;
      }
    }

    // 如果可以连通，则设定闪电动画样式类型和起点节点、终点节点
    this.lightningType = Model.LightningType.Y;
    this.pointBeginFst = begin;
    this.pointEndFst = end;

    return true;
  }

  /**
   * 判断方块是否一次折线即可消除
   */
  private brokenLineOnce(options: { begin: BlockIndexOfContainer; end: BlockIndexOfContainer }) {
    const { begin, end } = options;

    // 如果两个方块通过一次折线即可连通，那么他们就可以形成一个矩形
    // 找到另外两个矩形点
    const begin_side = { xIndex: end.xIndex, yIndex: begin.yIndex };
    const end_side = { xIndex: begin.xIndex, yIndex: end.yIndex };

    // 有两种消除路线，begin->begin_side->end  begin->end_side->end
    // 分别判断是否能连通

    // 路线一：begin->begin_side->end
    if (this.currentMap[begin_side.yIndex][begin_side.xIndex] === -1) {
      // 如果矩形点本身就有障碍，也不行
      if (this.horizon({ begin, end: begin_side })) {
        if (this.vertical({ begin: begin_side, end })) {
          // 如果可以连通，则设定类型和绘制坐标
          this.lightningType = Model.LightningType.XY;
          this.pointBeginFst = begin;
          this.pointEndFst = begin_side;
          this.pointBeginSec = begin_side;
          this.pointEndSec = end;
          return true;
        }
      }
    }

    // 路线二：begin->end_side->end
    if (this.currentMap[end_side.yIndex][end_side.xIndex] == -1) {
      // 如果矩形点本身就有障碍，也不行
      if (this.vertical({ begin, end: end_side })) {
        if (this.horizon({ begin: end_side, end })) {
          // 如果可以连通，则设定类型和绘制坐标
          this.lightningType = Model.LightningType.YX;
          this.pointBeginFst = begin;
          this.pointEndFst = end_side;
          this.pointBeginSec = end_side;
          this.pointEndSec = end;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 判断方块是否两次折线即可消除
   */
  private brokenLineTwice(options: { begin: BlockIndexOfContainer; end: BlockIndexOfContainer }) {
    const { begin, end } = options;

    // 如果两个方块通过两次折线即可连通，那么可以拆分为 1条水平/垂直线 + 1条一折线
    // 因此可以遍历 begin 上下左右四条线上的所有点，判断这些点能否和 end 进行一次折线连接

    // 循环遍历 begin 左边
    // 为0左边就没有方块了
    if (begin.xIndex > 0) {
      for (let i = 0; i < begin.xIndex; i++) {
        let tempPoint = { xIndex: begin.xIndex - (i + 1), yIndex: begin.yIndex };
        // 左边点本身若为障碍，直接停止循环
        if (this.currentMap[tempPoint.yIndex][tempPoint.xIndex] !== -1) {
          break;
        }
        // 左边的点能否连通，有障碍就停止循环
        if (this.horizon({ begin, end: tempPoint })) {
          // 左边的点能否和 end 形成一折线
          if (this.brokenLineOnce({ begin: tempPoint, end })) {
            // 能够连通，设定类型和绘制坐标
            this.setTypeAndLocaltion(Model.LightningType.XYX, begin, tempPoint, end);
            return true;
          }
        } else {
          break;
        }
      }
    }
    // 循环遍历 begin 右边
    // 默认方块一行最多SettingModule.column个，为SettingModule.column - 1则右边没方块了
    if (begin.xIndex < SettingModule.column - 1) {
      for (let i = begin.xIndex; i < SettingModule.column - 1; i++) {
        const tempPoint = { xIndex: i + 1, yIndex: begin.yIndex };
        // 左边点本身若为障碍，直接停止循环
        if (this.currentMap[tempPoint.yIndex][tempPoint.xIndex] !== -1) {
          break;
        }
        // 右边的点能否连通，有障碍就停止循环
        if (this.horizon({ begin, end: tempPoint })) {
          // 右边的点能否和 end 形成一折线
          if (this.brokenLineOnce({ begin: tempPoint, end })) {
            // 能够连通，设定类型和绘制坐标
            this.setTypeAndLocaltion(Model.LightningType.XYX, begin, tempPoint, end);
            return true;
          }
        } else {
          break;
        }
      }
    }
    // 循环遍历 begin 上边
    // 为0上边就没有方块了
    if (begin.yIndex > 0) {
      for (let i = 0; i < begin.yIndex; i++) {
        const tempPoint = { xIndex: begin.xIndex, yIndex: begin.yIndex - (i + 1) };
        // 左边点本身若为障碍，直接停止循环
        if (this.currentMap[tempPoint.yIndex][tempPoint.xIndex] !== -1) {
          break;
        }
        // 上边的点能否连通，有障碍就停止循环
        if (this.vertical({ begin, end: tempPoint })) {
          // 上边的点能否和 end 形成一折线
          if (this.brokenLineOnce({ begin: tempPoint, end })) {
            // 能够连通，设定类型和绘制坐标
            this.setTypeAndLocaltion(Model.LightningType.YXY, begin, tempPoint, end);
            return true;
          }
        } else {
          break;
        }
      }
    }
    // 循环遍历 begin 下边
    // 默认方块一列最多SettingModule.row个，为SettingModule.row - 1则下边没方块了
    if (begin.yIndex < SettingModule.row - 1) {
      for (let i = begin.yIndex; i < SettingModule.row - 1; i++) {
        const tempPoint = { xIndex: begin.xIndex, yIndex: i + 1 };
        // 左边点本身若为障碍，直接停止循环
        if (this.currentMap[tempPoint.yIndex][tempPoint.xIndex] !== -1) {
          break;
        }
        // 下边的点能否连通，有障碍就停止循环
        if (this.vertical({ begin, end: tempPoint })) {
          // 下边的点能否和 end 形成一折线
          if (this.brokenLineOnce({ begin: tempPoint, end })) {
            // 能够连通，设定类型和绘制坐标
            this.setTypeAndLocaltion(Model.LightningType.YXY, begin, tempPoint, end);
            return true;
          }
        } else {
          break;
        }
      }
    }

    return false;
  }

  /**
   * 二折线设定类型和绘制坐标
   */
  private setTypeAndLocaltion(
    type: Model.LightningType,
    begin: BlockIndexOfContainer,
    tempPoint: BlockIndexOfContainer,
    end: BlockIndexOfContainer
  ) {
    // 如果可以连通，先获取一折线起点
    const oncePoint = this.pointEndFst;
    // 再设定类型和绘制坐标
    this.lightningType = type;
    this.pointBeginFst = begin;
    this.pointEndFst = tempPoint;
    this.pointBeginSec = tempPoint;
    this.pointEndSec = oncePoint;
    this.pointBeginThr = oncePoint;
    this.pointEndThr = end;
  }

  /**
   * 方块消除处理
   * @param {BlockIndexOfContainer} begin
   * @param {BlockIndexOfContainer} end
   */
  private blockBoom(begin: BlockIndexOfContainer, end: BlockIndexOfContainer) {
    try {
      // 选中方块置空
      this.blockSelect1 = -1;
      this.blockSelectIconIndex1 = -1;
      this.blockSelect2 = -1;
      this.blockSelectIconIndex2 = -1;
      // 清除map中两个方块的值
      this.currentMap[begin.yIndex][begin.xIndex] = -1;
      this.currentMap[end.yIndex][end.xIndex] = -1;

      const now = +new Date();

      if (now - this.lastComboTimeStamp > SettingModule.comboTime) {
        this.combo = 0;
      }
      this.gameTime += SettingModule.getTimeOnce;
      if (this.gameTime > SettingModule.gameTime) this.gameTime = SettingModule.gameTime;
      this.combo++;
      this.lastComboTimeStamp = now;

      const beginNode = this.findBlock(begin);
      const endNode = this.findBlock(end);

      if (cc.isValid(beginNode, true)) beginNode.getComponent(Block).explode();
      if (cc.isValid(endNode, true)) endNode.getComponent(Block).explode();

      // 播放闪电及爆炸音效
      AudioModule.play(Model.AudioEnum.elec, false, 0.3);
      AudioModule.play(Model.AudioEnum.elec, false, 0.3);
      AudioModule.play(Model.AudioEnum.itemboom);

      // 闪电节点
      if (this.lightningType === Model.LightningType.X) {
        // 获取方块中心点的x坐标
        const begin = this.findBlock(this.pointBeginFst);
        const begin_x = begin.x;
        const end = this.findBlock(this.pointEndFst);
        const end_x = end.x;
        // 获取方块中心点的y坐标
        const y = begin.y;
        // 大约一个方块的距离绘制一次闪电
        const min = Math.min(begin_x, end_x);
        const count = Math.round(Math.abs(begin_x - end_x) / (this.blockWidth * SettingModule.blockMarginRow));
        for (let i = 0; i < count; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: true, column: false });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = min + (this.blockWidth * SettingModule.blockMarginRow) / 2 + i * this.blockWidth * SettingModule.blockMarginRow;
          lightningNode.y = y;
        }
      } else if (this.lightningType === Model.LightningType.Y) {
        // 获取方块中心点的x坐标
        const begin = this.findBlock(this.pointBeginFst);
        const x = begin.x;
        // 获取方块中心点的y坐标
        const end = this.findBlock(this.pointEndFst);
        const begin_y = begin.y;
        const end_y = end.y;
        // 大约一个方块的距离绘制一次闪电
        const min = Math.min(begin_y, end_y);
        const count = Math.round(Math.abs(begin_y - end_y) / (this.blockHeight * SettingModule.blockMarginColumn));
        for (let i = 0; i < count; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: false, column: true });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = x;
          lightningNode.y =
            min + (this.blockHeight * SettingModule.blockMarginColumn) / 2 + i * this.blockHeight * SettingModule.blockMarginColumn;
        }
      } else if (this.lightningType === Model.LightningType.XY) {
        // 横线
        // 获取方块中心点坐标
        const begin = this.findBlock(this.pointBeginFst);
        const begin_x = begin.x;
        // 虚拟方块
        const virtualBlock_x =
          begin_x + (this.pointEndFst.xIndex - this.pointBeginFst.xIndex) * this.blockWidth * SettingModule.blockMarginRow;
        const virtualBlock_y = begin.y;
        // 获取方块中心点的y坐标
        const y = begin.y;
        // 大约一个方块的距离绘制一次闪电
        const min = Math.min(begin_x, virtualBlock_x);
        const count = Math.round(Math.abs(begin_x - virtualBlock_x) / (this.blockWidth * SettingModule.blockMarginRow));
        for (let i = 0; i < count; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: true, column: false });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = min + (this.blockWidth * SettingModule.blockMarginRow) / 2 + i * this.blockWidth * SettingModule.blockMarginRow;
          lightningNode.y = y;
        }

        // 竖线
        // 虚拟方块
        const begin_y = virtualBlock_y;
        // 获取方块中心点坐标
        const endSec = this.findBlock(this.pointEndSec);
        const x = endSec.x;
        const end_y = endSec.y;

        // 大约一个方块的距离绘制一次闪电
        const min1 = Math.min(begin_y, end_y);
        const count1 = Math.round(Math.abs(begin_y - end_y) / (this.blockHeight * SettingModule.blockMarginColumn));
        for (let i = 0; i < count1; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: false, column: true });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = x;
          lightningNode.y =
            min1 + (this.blockHeight * SettingModule.blockMarginColumn) / 2 + i * this.blockHeight * SettingModule.blockMarginColumn;
        }
      } else if (this.lightningType === Model.LightningType.YX) {
        // 竖线
        const begin = this.findBlock(this.pointBeginFst);
        const end = this.findBlock(this.pointEndSec);
        const virtual_x = begin.x;
        const virtual_y = end.y;
        const begin_y = begin.y;
        const min1 = Math.min(begin_y, virtual_y);
        const count1 = Math.round(Math.abs(begin_y - virtual_y) / (this.blockHeight * SettingModule.blockMarginColumn));
        for (let i = 0; i < count1; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: false, column: true });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = virtual_x;
          lightningNode.y =
            min1 + (this.blockHeight * SettingModule.blockMarginColumn) / 2 + i * this.blockHeight * SettingModule.blockMarginColumn;
        }

        // 横线
        const end_x = end.x;
        const y = end.y;
        const min = Math.min(virtual_x, end_x);
        const count = Math.round(Math.abs(virtual_x - end_x) / (this.blockWidth * SettingModule.blockMarginRow));
        for (let i = 0; i < count; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: true, column: false });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = min + (this.blockWidth * SettingModule.blockMarginRow) / 2 + i * this.blockWidth * SettingModule.blockMarginRow;
          lightningNode.y = y;
        }
      } else if (this.lightningType === Model.LightningType.XYX) {
        // 横线
        const begin = this.findBlock(this.pointBeginFst);
        const begin_x = begin.x;
        const virtual_x1 = begin_x + (this.pointEndFst.xIndex - this.pointBeginFst.xIndex) * this.blockWidth * SettingModule.blockMarginRow;
        const virtual_y1 = begin.y;
        const min = Math.min(begin_x, virtual_x1);
        const count = Math.round(Math.abs(begin_x - virtual_x1) / (this.blockWidth * SettingModule.blockMarginRow));
        for (let i = 0; i < count; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: true, column: false });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = min + (this.blockWidth * SettingModule.blockMarginRow) / 2 + i * this.blockWidth * SettingModule.blockMarginRow;
          lightningNode.y = virtual_y1;
        }

        // 竖线
        const end = this.findBlock(this.pointEndThr);
        const virtual_x2 = virtual_x1;
        const virtual_y2 = end.y;
        const min1 = Math.min(virtual_y1, virtual_y2);
        const count1 = Math.round(Math.abs(virtual_y1 - virtual_y2) / (this.blockHeight * SettingModule.blockMarginColumn));
        for (let i = 0; i < count1; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: false, column: true });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = virtual_x2;
          lightningNode.y =
            min1 + (this.blockHeight * SettingModule.blockMarginColumn) / 2 + i * this.blockHeight * SettingModule.blockMarginColumn;
        }

        // 横线
        const min2 = Math.min(virtual_x2, end.x);
        const count2 = Math.round(Math.abs(virtual_x2 - end.x) / (this.blockWidth * SettingModule.blockMarginRow));
        for (let i = 0; i < count2; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: true, column: false });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x =
            min2 + (this.blockWidth * SettingModule.blockMarginRow) / 2 + i * this.blockWidth * SettingModule.blockMarginRow;
          lightningNode.y = end.y;
        }
      } else if (this.lightningType === Model.LightningType.YXY) {
        // 竖线
        const begin = this.findBlock(this.pointBeginFst);
        const begin_y = begin.y;
        const virtual_x1 = begin.x;
        const virtual_y1 =
          begin_y + (this.pointBeginFst.yIndex - this.pointEndFst.yIndex) * this.blockHeight * SettingModule.blockMarginColumn;

        const min1 = Math.min(begin_y, virtual_y1);
        const count1 = Math.round(Math.abs(begin_y - virtual_y1) / (this.blockHeight * SettingModule.blockMarginColumn));

        for (let i = 0; i < count1; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: false, column: true });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = virtual_x1;
          lightningNode.y =
            min1 + (this.blockHeight * SettingModule.blockMarginColumn) / 2 + i * this.blockHeight * SettingModule.blockMarginColumn;
        }

        //横线
        const end = this.findBlock(this.pointEndThr);
        const virtual_x2 = end.x;
        const virtual_y2 = virtual_y1;

        const min = Math.min(virtual_x1, virtual_x2);
        const count = Math.round(Math.abs(virtual_x2 - virtual_x1) / (this.blockWidth * SettingModule.blockMarginRow));

        for (let i = 0; i < count; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: true, column: false });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = min + (this.blockWidth * SettingModule.blockMarginRow) / 2 + i * this.blockWidth * SettingModule.blockMarginRow;
          lightningNode.y = virtual_y2;
        }

        // 竖线
        const end_y = end.y;
        const min2 = Math.min(virtual_y2, end_y);
        const count2 = Math.round(Math.abs(virtual_y2 - end_y) / (this.blockHeight * SettingModule.blockMarginColumn));

        for (let i = 0; i < count2; i++) {
          const lightningNode = cc.instantiate(this.lightningPrefab);
          const lightning = lightningNode.getComponent(Lightning);
          lightning.init({ row: false, column: true });
          this.lightningContainer.addChild(lightningNode);
          lightningNode.x = end.x;
          lightningNode.y =
            min2 + (this.blockHeight * SettingModule.blockMarginColumn) / 2 + i * this.blockHeight * SettingModule.blockMarginColumn;
        }
      }
    } catch (e) {
      cc.error(e);
    }
  }

  /**
   * 注意：仅可用来寻找真实存在的节点，而不是虚拟节点
   * @param {BlockIndexOfContainer} blockIndexOfContainer
   * @returns
   */
  private findBlock(blockIndexOfContainer: BlockIndexOfContainer) {
    const result = this.blockContainer.children.find(child => {
      const com = child.getComponent(Block);
      if (com.xIndex === blockIndexOfContainer.xIndex && com.yIndex === blockIndexOfContainer.yIndex) return true;
      return false;
    });
    if (!result) throw Error(`Game.ts findBlock() result is null, 注意：该方法仅可用来寻找真实存在的节点，而不是虚拟节点`);
    return result;
  }

  private getBlockWidthAndHeight() {
    const block = cc.instantiate(this.blockPrefab);
    if (!this.blockWidth) this.blockWidth = block.width;
    if (!this.blockHeight) this.blockHeight = block.height;
    block.destroy();
  }

  private generateBlocks(options: { map: number[][] }) {
    try {
      const { map } = options;

      if (!map) throw Error("Game.ts generateBlocks() options.map 参数错误");

      const blockCount = map.reduce((result, item) => {
        if (item) {
          item.forEach(item2 => {
            if (item2 === 0) result++;
          });
        }
        return result;
      }, 0);
      const blockIconIndexArr = this.generateBlockIconIndexArr(blockCount);

      const { row, column } = SettingModule;
      const startX = -100;
      const startY = -70;
      let blockPosition = new cc.Vec3(startX, startY);
      // 从右上往左下倒着生成
      for (let i = 0; i < row; i++) {
        for (let j = column - 1; j >= 0; j--) {
          if (blockPosition.x === 0) {
            blockPosition.x -= 5.5 * this.blockWidth;
          }
          if (blockPosition.y === 0) {
            blockPosition.y -= 3.5 * this.blockHeight;
          }

          if (map[i][j] === 0) {
            const block = cc.instantiate(this.blockPrefab);
            const blockCom = block.getComponent(Block);
            blockCom.init({ xIndex: j, yIndex: i, iconIndex: blockIconIndexArr.shift() });
            this.blockContainer.addChild(block);

            // 避免让坐标出现浮点数
            block.x = Math.floor(blockPosition.x);
            block.y = Math.floor(blockPosition.y);
          }

          blockPosition.x -= this.blockWidth * SettingModule.blockMarginRow;
        }
        blockPosition.x = startX;
        blockPosition.y -= this.blockHeight * SettingModule.blockMarginColumn;
      }

      this.currentMap = map;
    } catch (e) {
      cc.error(e);
    }
  }

  private generateBlockIconIndexArr(blockCount: number): number[] {
    if (blockCount & 1) throw Error(`Game.ts generateBlockIconIndexArr 参数 blockCount 需为偶数`);

    let result = [];

    for (let i = 0; i < blockCount; i += 2) {
      const random = Util.getRandomNumber(0, SettingModule.blockIconNum);
      // 必须是一对
      result.push(random);
      result.push(random);
    }

    return Util.shuffle(result);
  }

  /**
   * 动态加载json牌组数据
   * @param fileName 牌组json名称
   */
  private async loadJson(fileName: string) {
    return new Promise<void>((resolve, reject) => {
      try {
        cc.resources.load(`json/${fileName}`, cc.JsonAsset, (err: Error, asset: cc.JsonAsset) => {
          if (err) {
            cc.error(err);
            reject();
            return;
          }
          this[fileName] = asset;
          resolve();
        });
      } catch (e) {
        cc.error(e);
      }
    });
  }
}
