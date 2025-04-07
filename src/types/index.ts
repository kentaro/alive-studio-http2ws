/**
 * OBSのブラウザソース設定に関する型定義
 */
export interface InputSettings {
  url: string;
  [key: string]: unknown;
}

/**
 * OBSのブラウザソース設定取得APIのレスポンス型
 */
export interface GetInputSettingsResponse {
  inputSettings: InputSettings;
}

/**
 * OBSの現在のシーン取得APIのレスポンス型
 */
export interface GetCurrentProgramSceneResponse {
  currentProgramSceneName: string;
}

/**
 * OBSのシーン内アイテム型
 */
export interface SceneItem {
  sourceName: string;
  sceneItemId: number;
  [key: string]: unknown;
}

/**
 * OBSのシーン内アイテムリスト取得APIのレスポンス型
 */
export interface GetSceneItemListResponse {
  sceneItems: SceneItem[];
}

/**
 * APIリクエスト本文の型
 */
export interface RequestBody {
  url?: string;
  key?: string;
  value?: string;
}

/**
 * URLパラメータオブジェクトの型
 */
export interface UrlParams {
  [key: string]: string;
}

/**
 * OBSサービスの設定オプション型
 */
export interface OBSServiceOptions {
  port: string;
  password?: string;
  retryInterval: number;
}

/**
 * アプリケーション設定の型
 */
export interface AppConfig {
  obsPort: string;
  obsPassword?: string;
  baseUrl: string;
  serverPort: number;
  retryInterval: number;
}
