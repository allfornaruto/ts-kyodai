export const Util = {
  /**
   * 随机数生成 [min, max)
   * @param min 包含
   * @param max 不包含
   */
  getRandomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min)) + min;
  },
  /**
   * 数组乱序
   * @param arr
   * @returns
   */
  shuffle(arr: number[]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      let rIndex = Math.floor(Math.random() * (i + 1));
      let temp = arr[rIndex];
      arr[rIndex] = arr[i];
      arr[i] = temp;
    }
    return arr;
  },
};
