import OBSWebSocket from "obs-websocket-js";
import type {
  GetCurrentProgramSceneResponse,
  GetInputSettingsResponse,
  GetSceneItemListResponse,
  InputSettings,
  OBSServiceOptions,
} from "../types";

/**
 * OBSとの通信を管理するサービスクラス
 */
export class OBSService {
  private obs: OBSWebSocket;
  private isConnected: boolean;
  private readonly options: OBSServiceOptions;
  private readonly baseUrl: string;

  /**
   * コンストラクタ
   * @param options OBSサービスのオプション
   * @param baseUrl Alive Studioの基本URL
   */
  constructor(options: OBSServiceOptions, baseUrl: string) {
    this.obs = new OBSWebSocket();
    this.isConnected = false;
    this.options = options;
    this.baseUrl = baseUrl;

    // 接続が切れた時の処理
    this.obs.on("ConnectionClosed", () => {
      console.log("⚠️ OBS connection closed");
      this.isConnected = false;
      this.scheduleReconnect();
    });
  }

  /**
   * OBSへの接続状態を返す
   * @returns 接続状態
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * OBSに接続する
   * @returns 接続成功したかどうか
   */
  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    try {
      const url = `ws://localhost:${this.options.port}`;
      await this.obs.connect(url, this.options.password);
      console.log("✅ Connected to OBS WebSocket");
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to OBS:", (error as Error).message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * OBSへの接続をリトライする
   */
  private scheduleReconnect(): void {
    setTimeout(async () => {
      console.log("🔄 Attempting to reconnect to OBS...");
      const success = await this.connect();
      if (!success) {
        this.scheduleReconnect();
      }
    }, this.options.retryInterval);
  }

  /**
   * 現在のプログラムシーン名を取得する
   * @returns シーン名
   */
  public async getCurrentSceneName(): Promise<string> {
    try {
      const { currentProgramSceneName } = (await this.obs.call(
        "GetCurrentProgramScene",
      )) as GetCurrentProgramSceneResponse;
      return currentProgramSceneName;
    } catch (error) {
      console.error("❌ Failed to get current scene:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 指定されたシーン内のアイテムリストを取得する
   * @param sceneName シーン名
   * @returns シーン内アイテムリスト
   */
  public async getSceneItemList(sceneName: string): Promise<GetSceneItemListResponse> {
    try {
      return (await this.obs.call("GetSceneItemList", {
        sceneName,
      })) as GetSceneItemListResponse;
    } catch (error) {
      console.error("❌ Failed to get scene items:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 指定されたソースの設定を取得する
   * @param inputName ソース名
   * @returns ソース設定
   */
  public async getInputSettings(inputName: string): Promise<GetInputSettingsResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await this.obs.call("GetInputSettings", {
      inputName,
    })) as any;

    // 必要なプロパティを確認して返す
    return {
      inputSettings: {
        url: result.inputSettings.url,
        ...result.inputSettings,
      },
    };
  }

  /**
   * 指定されたソースの設定を更新する
   * @param inputName ソース名
   * @param inputSettings 更新する設定
   */
  public async setInputSettings(inputName: string, inputSettings: InputSettings): Promise<void> {
    try {
      await this.obs.call("SetInputSettings", {
        inputName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSettings: inputSettings as any,
      });
    } catch (error) {
      console.error("❌ Failed to update source settings:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Alive Studioのブラウザソースを検索する
   * @returns 見つかったソースの名前、または見つからなかった場合はnull
   */
  public async findAliveSource(): Promise<string | null> {
    try {
      const currentProgramSceneName = await this.getCurrentSceneName();
      console.log(`🔍 Searching for Alive Studio source in scene: ${currentProgramSceneName}`);

      const { sceneItems } = await this.getSceneItemList(currentProgramSceneName);

      for (const item of sceneItems) {
        const sourceName = String(item.sourceName);

        try {
          const { inputSettings } = await this.getInputSettings(sourceName);
          const sourceUrl = inputSettings.url;

          if (typeof sourceUrl === "string" && sourceUrl.includes(this.baseUrl)) {
            console.log(`✅ Found Alive Studio source: ${sourceName}`);
            return sourceName;
          }
        } catch (_err) {
          // ブラウザソース以外はスキップ（エラーログ不要）
        }
      }

      console.log("❌ No Alive Studio source found in current scene");
      return null;
    } catch (error) {
      console.error("❌ Error finding Alive source:", (error as Error).message);
      return null;
    }
  }

  /**
   * OBSのブラウザソース設定を更新する
   * @param sourceName ソース名
   * @param newUrl 新しいURL
   * @returns 更新に成功したかどうか
   */
  public async updateOBSSource(sourceName: string, newUrl: string): Promise<boolean> {
    try {
      // 現在の設定を取得
      const { inputSettings } = await this.getInputSettings(sourceName);

      // URLだけを更新
      await this.setInputSettings(sourceName, {
        ...inputSettings,
        url: newUrl,
      });

      // 更新を確認
      const { inputSettings: newSettings } = await this.getInputSettings(sourceName);

      const updated = newSettings.url === newUrl;
      console.log(`${updated ? "✅" : "❌"} Source URL ${updated ? "updated" : "update failed"}`);

      return updated;
    } catch (error) {
      console.error("❌ Failed to update OBS source:", (error as Error).message);
      return false;
    }
  }
}
