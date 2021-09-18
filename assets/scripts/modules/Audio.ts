import { Model } from "../constants/Model";

const AudioEnum = Model.AudioEnum;

class AudioModule {
  audio: { [key: string]: cc.AudioClip } = {};
  /**
   * 搭配loadFiles函数一起使用，是否加载完全部音乐资源
   */
  loadFinished: boolean = false;

  async play(key: Model.AudioEnum, loop = false, volume = 1): Promise<number> {
    return new Promise((resolve, _) => {
      try {
        let ref = -1;
        if (key === undefined || key === null) {
          resolve(ref);
          return;
        }
        if (this.loadFinished === false) {
          this.loadFiles(() => {
            const mp3 = this.audio[key];
            ref = cc.audioEngine.play(mp3, loop, volume);
            resolve(ref);
          });
        } else {
          const mp3 = this.audio[key];
          ref = cc.audioEngine.play(mp3, loop, volume);
          resolve(ref);
        }
      } catch (e) {
        cc.error(e);
      }
    });
  }

  /**
   * 当音乐资源较小时，可以使用该方法一次性加载全部音乐资源
   * @param cb 加载完音乐资源的回调
   */
  async loadFiles(cb?: Function) {
    return new Promise<void>((resolve, _) => {
      // 不可放在constructor中或全局环境中执行，cc.resources访问不到
      cc.resources.loadDir("mp3", cc.AudioClip, (err: Error, assets: cc.AudioClip[]) => {
        try {
          if (err) {
            cc.error(err);
            return;
          }
          const infos = cc.resources.getDirWithPath("mp3", cc.AudioClip);
          const paths = infos.map(info => info.path);
          paths.forEach((path: string, index: number) => {
            if (path) {
              const name = path.split("/")[1];
              this.audio[AudioEnum[name]] = assets[index];
            }
          });
          this.loadFinished = true;
          if (cb && typeof cb === "function") {
            cb();
          }
          resolve();
        } catch (e) {
          cc.error(e);
        }
      });
    });
  }

  /**
   * 当音乐资源较大时，可以使用该方法按需加载指定的音乐资源
   * @param fileName mp3文件名
   * @returns
   */
  async loadFile(fileName: Model.AudioEnum) {
    return new Promise<void>((resolve, reject) => {
      // 不可放在constructor中或全局环境中执行，cc.resources访问不到
      cc.resources.load(`/mp3/${fileName}`, cc.AudioClip, (err: Error, asset: cc.AudioClip) => {
        try {
          if (err) {
            cc.error(err);
            return;
          }
          if (!asset) throw new Error(`Audio.ts loadFile fileName=${fileName} is null`);
          this.audio[fileName] = asset;
          resolve();
        } catch (e) {
          reject();
          cc.error(e);
        }
      });
    });
  }
}

let audioModule: AudioModule;
export function getAudioModule(): AudioModule {
  if (!audioModule) audioModule = new AudioModule();
  return audioModule;
}
