import { parseDotEnv, interpolate } from "./env.js";

describe("env utils", () => {
  describe("parseDotEnv", () => {
    it("should parse standard key=value pairs", () => {
      const input = "KEY1=VALUE1\nKEY2=VALUE2";
      const result = parseDotEnv(input);
      expect(result).toEqual({
        KEY1: "VALUE1",
        KEY2: "VALUE2",
      });
    });

    it("should handle spaces around equals and keys/values", () => {
      const input = "  KEY1  =  VALUE1  ";
      const result = parseDotEnv(input);
      expect(result).toEqual({
        KEY1: "VALUE1",
      });
    });

    it("should strip quotes from values", () => {
      const input = 'KEY1="VALUE1"\nKEY2=\'VALUE2\'';
      const result = parseDotEnv(input);
      expect(result).toEqual({
        KEY1: "VALUE1",
        KEY2: "VALUE2",
      });
    });

    it("should skip comments and empty lines", () => {
      const input = "# comment\n\nKEY1=VALUE1\n  # another comment";
      const result = parseDotEnv(input);
      expect(result).toEqual({
        KEY1: "VALUE1",
      });
    });

    it("should handle lines without equals", () => {
      const input = "INVALID_LINE\nKEY1=VALUE1";
      const result = parseDotEnv(input);
      expect(result).toEqual({
        KEY1: "VALUE1",
      });
    });
  });

  describe("interpolate", () => {
    it("should replace placeholders with variables", () => {
      const input = "Building {{PROJECT_NAME}} for {{PLATFORM}}";
      const vars = {
        PROJECT_NAME: "MyApp",
        PLATFORM: "android",
      };
      const result = interpolate(input, vars);
      expect(result).toBe("Building MyApp for android");
    });

    it("should replace unknown placeholders with empty string", () => {
      const input = "Hello {{NAME}}";
      const result = interpolate(input, {});
      expect(result).toBe("Hello ");
    });

    it("should handle multiple occurrences of the same placeholder", () => {
      const input = "{{APP}} is {{APP}}";
      const vars = { APP: "Orchestrator" };
      const result = interpolate(input, vars);
      expect(result).toBe("Orchestrator is Orchestrator");
    });
  });
});
