import { Game } from "../Game";
import { getAudioModule } from "../modules/Audio";
import { Model } from "../constants/Model";

const AudioModule = getAudioModule();
const { ccclass, property } = cc._decorator;

@ccclass
export class Block extends cc.Component {
  @property(cc.Node)
  selectNode: cc.Node = null;

  @property(cc.Node)
  iconNode: cc.Node = null;

  @property({
    type: cc.SpriteFrame,
  })
  iconSpriteFrameList: cc.SpriteFrame[] = [];

  isSelected: boolean = false;

  iconIndex: number = -1;
  xIndex: number = -1;
  yIndex: number = -1;

  isExplode = false;

  onLoad() {
    this.node.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => this.onTouchEnd(event));
  }

  init(options: { xIndex: number; yIndex: number; iconIndex: number }) {
    const { iconIndex, xIndex, yIndex } = options;

    this.xIndex = xIndex;
    this.yIndex = yIndex;
    this.iconIndex = iconIndex;

    this.iconNode.getComponent(cc.Sprite).spriteFrame = this.iconSpriteFrameList[iconIndex];
    this.iconNode.active = true;

    cc.find("index", this.node).getComponent(cc.Label).string = `${xIndex}/${yIndex}`;
  }

  select() {
    if (this.isSelected) return;
    this.isSelected = true;
    this.selectNode.active = true;
  }

  unSelect() {
    if (!this.isSelected) return;
    this.isSelected = false;
    this.selectNode.active = false;
  }

  explode() {
    if (this.isExplode) return;
    this.isExplode = true;
    this.node.getChildByName("bgGray").active = false;
    this.node.getChildByName("bg").active = false;
    this.node.getChildByName("icon").active = false;
    this.node.getChildByName("select").active = false;
    this.node.getChildByName("index").active = false;

    const explodeContainer = cc.find("Canvas/explodeContainer");
    const explodeNode = this.node.getChildByName("explode");
    const pos = explodeContainer.convertToNodeSpaceAR(this.node.convertToWorldSpaceAR(explodeNode.position));
    explodeNode.removeFromParent(false);

    explodeContainer.addChild(explodeNode);
    explodeNode.position = pos;
    explodeNode.active = true;
    explodeNode.getComponent(cc.Animation).play("explode");

    this.node.destroy();
    this.scheduleOnce(() => {
      explodeNode.destroy();
    }, 0.5);
  }

  private async onTouchEnd(event: cc.Event.EventTouch) {
    try {
      event.stopPropagation();

      AudioModule.play(Model.AudioEnum.sel, false, 1);

      const siblingIndex = this.node.getSiblingIndex();

      const game = cc.find("Canvas").getComponent(Game);
      game.blockClick({ siblingIndex, iconIndex: this.iconIndex });
    } catch (e) {
      cc.error(e);
    }
  }
}
