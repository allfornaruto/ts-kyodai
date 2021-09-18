let setting: Setting;

class Setting {
  appVersion = "1.1.1";

  /**
   * 行数
   */
  row = 11;
  /**
   * 列数
   */
  column = 19;
  /**
   * 方块横向间隔系数
   */
  blockMarginRow = 0.9;
  /**
   * 方块纵向间隔系数
   */
  blockMarginColumn = 0.9;
  /**
   * 方块图标数量
   */
  blockIconNum = 30;

  /**
   * N秒内消除就计入combo, 单位毫秒
   */
  comboTime = 10 * 1000;

  /**
   * 剩余时间, 单位毫秒
   */
  gameTime = 4500 * 1000;
  /**
   * 消除一对时间加N秒，单位毫秒
   */
  getTimeOnce = 5 * 1000;

  timeProgressBarMinX = -665;
  timeProgressBarMaxX = 0;
  playerProgressBarMinX = -200;
  playerProgressBarMaxX = 0;

  needSaveInCloudKeys = [];

  webLog = true;
}

export function getSettingModule(): Setting {
  if (!setting) {
    setting = new Setting();
  }
  return setting;
}
