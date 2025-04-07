import { extractUrlParams, parseParams, stringifyParams, updateUrl } from "../src/utils/url.utils";

describe("URL Utilities", () => {
  describe("extractUrlParams", () => {
    it("should extract parameters from URL", () => {
      const url =
        "https://studio.alive-project.com/item?slot=alive-studio-ctrl&background=blue&sound=on";
      const params = extractUrlParams(url);
      expect(params).toBe("background=blue&sound=on");
    });

    it("should return empty string if no parameters found", () => {
      const url = "https://example.com/path";
      const params = extractUrlParams(url);
      expect(params).toBe("");
    });
  });

  describe("parseParams", () => {
    it("should parse parameter string to object", () => {
      const paramsStr = "width=1920&height=1080&background=red";
      const paramsObj = parseParams(paramsStr);
      expect(paramsObj).toEqual({
        width: "1920",
        height: "1080",
        background: "red",
      });
    });

    it("should return empty object for empty string", () => {
      const paramsObj = parseParams("");
      expect(paramsObj).toEqual({});
    });

    it("should handle malformed parameters", () => {
      const paramsStr = "width=1920&malformed&height=1080";
      const paramsObj = parseParams(paramsStr);
      expect(paramsObj).toEqual({
        width: "1920",
        height: "1080",
      });
    });
  });

  describe("stringifyParams", () => {
    it("should convert params object to string", () => {
      const paramsObj = {
        width: "1920",
        height: "1080",
        background: "red",
      };
      const paramsStr = stringifyParams(paramsObj);
      expect(paramsStr).toBe("width=1920&height=1080&background=red");
    });

    it("should return empty string for empty object", () => {
      const paramsStr = stringifyParams({});
      expect(paramsStr).toBe("");
    });
  });

  describe("updateUrl", () => {
    const baseUrl = "https://studio.alive-project.com/item?slot=alive-studio-ctrl&";

    it("should update URL with new parameters", () => {
      const currentUrl =
        "https://studio.alive-project.com/item?slot=alive-studio-ctrl&width=1920&height=1080&background=red";
      const inputParam = "background=blue&sound=on";

      const result = updateUrl(inputParam, currentUrl, baseUrl);

      // タイムスタンプはテスト時間によって変わるため、含まれているかのみ確認
      expect(result).toContain("width=1920");
      expect(result).toContain("height=1080");
      expect(result).toContain("background=blue"); // 上書きされるべき
      expect(result).toContain("sound=on"); // 新しいパラメータ
      expect(result).toContain("timestamp="); // タイムスタンプの存在確認
    });

    it("should handle empty current URL", () => {
      const currentUrl = "";
      const inputParam = "background=blue&sound=on";

      const result = updateUrl(inputParam, currentUrl, baseUrl);

      expect(result).toContain("background=blue");
      expect(result).toContain("sound=on");
      expect(result).toContain("timestamp=");
      expect(result).not.toContain("width=");
      expect(result).not.toContain("height=");
    });

    it("should preserve only specific parameters", () => {
      const currentUrl =
        "https://studio.alive-project.com/item?slot=alive-studio-ctrl&width=1920&height=1080&sound=off&version=1.0";
      const inputParam = "background=blue&sound=on";

      const result = updateUrl(inputParam, currentUrl, baseUrl);

      expect(result).toContain("width=1920"); // 保持されるべき
      expect(result).toContain("height=1080"); // 保持されるべき
      expect(result).toContain("version=1.0"); // 保持されるべき
      expect(result).toContain("background=blue"); // 新しいパラメータ
      expect(result).toContain("sound=on"); // 上書きされるべき
      expect(result).not.toContain("sound=off"); // 上書きされるべき
    });
  });
});
