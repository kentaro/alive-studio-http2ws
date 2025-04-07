import type { UrlParams } from "../types";

/**
 * URLからパラメータ部分を抽出する
 * @param url 現在のURL
 * @returns 抽出されたパラメータ文字列
 */
export function extractUrlParams(url: string): string {
  const match = url.match(/\?slot=alive-studio-ctrl&(.+)$/);
  return match ? match[1] : "";
}

/**
 * パラメータ文字列をオブジェクトに変換する
 * @param paramsStr パラメータ文字列
 * @returns パラメータオブジェクト
 */
export function parseParams(paramsStr: string): UrlParams {
  const paramsObj: UrlParams = {};

  if (!paramsStr) return paramsObj;

  for (const param of paramsStr.split("&")) {
    const [key, value] = param.split("=");
    if (key && value) {
      paramsObj[key] = value;
    }
  }

  return paramsObj;
}

/**
 * パラメータオブジェクトをURLパラメータ文字列に変換する
 * @param paramsObj パラメータオブジェクト
 * @returns URLパラメータ文字列
 */
export function stringifyParams(paramsObj: UrlParams): string {
  return Object.entries(paramsObj)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/**
 * URLを更新する
 * @param inputParam 追加するパラメータ文字列
 * @param currentUrl 現在のURL
 * @param baseUrl ベースURL
 * @returns 更新されたURL
 */
export function updateUrl(inputParam: string, currentUrl: string, baseUrl: string): string {
  // 入力パラメータをオブジェクトに変換
  const inputParamsObj = parseParams(inputParam);

  // 基本パラメータを保持（もしあれば）
  const baseParamsObj: UrlParams = {};
  if (currentUrl) {
    const paramsStr = extractUrlParams(currentUrl);
    const currentParams = parseParams(paramsStr);

    // 基本パラメータのみ保持（width, height, version など）
    for (const [key, value] of Object.entries(currentParams)) {
      if (key === "width" || key === "height" || key === "version") {
        baseParamsObj[key] = value;
      }
    }
  }

  // 基本パラメータと新しいパラメータを組み合わせる（音や背景などのパラメータはリクエストのもので上書き）
  const combinedParamsObj: UrlParams = {
    ...baseParamsObj,
    ...inputParamsObj,
    // タイムスタンプは常に最新
    timestamp: new Date().toISOString(),
  };

  return `${baseUrl}${stringifyParams(combinedParamsObj)}`;
}
