const { ccclass, property } = cc._decorator;

@ccclass
export class Lightning extends cc.Component {
  @property(cc.Node)
  lightningRow: cc.Node = null;

  @property(cc.Node)
  lightningColumn: cc.Node = null;

  onLoad() {
    this.scheduleOnce(() => {
      this.destroy();
    }, 1);
  }

  init(options: { row: boolean; column: boolean }) {
    const { row, column } = options;
    if (row) {
      this.lightningRow.active = true;
      this.node.getComponent(cc.Animation).play("lightningRow");
    }
    if (column) {
      this.lightningColumn.active = true;
      this.node.getComponent(cc.Animation).play("lightningCol");
    }
  }
}
