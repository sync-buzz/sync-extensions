import { describe, expect, it } from "vitest";

import { addressed, committed, spelled } from "./addressing";

describe("addressed", () => {
  it("takes the name off the head of a message", () => {
    expect(addressed("@checks look at the migrations")).toEqual({
      handed: { to: "checks" },
      body: "look at the migrations",
    });
  });

  it("reads the agent where one is named", () => {
    expect(addressed("@checks:codex look")).toEqual({
      handed: { to: "checks", with: "codex" },
      body: "look",
    });
  });

  /**
   * The whole reason the address is anchored. A name in a sentence is somebody
   * referring to a conversation, and treating it as an address would make the
   * sentence unsayable.
   */
  it("leaves a name inside a sentence alone", () => {
    const said = "see what @checks comes back with";
    expect(addressed(said)).toEqual({ body: said });
  });

  it("steps over blank space before the name", () => {
    expect(addressed("  @checks go")).toEqual({ handed: { to: "checks" }, body: "go" });
  });

  /**
   * The name has to end where the address ends. `@checksum` is its own name and
   * reads as one; `@checks.io` is not a name at all, and half-reading it as
   * `checks` would hand somebody's work to a conversation they did not type.
   */
  it("needs the name to end at a space", () => {
    expect(addressed("@checksum is wrong")).toEqual({
      handed: { to: "checksum" },
      body: "is wrong",
    });
    const address = "@checks.io is down";
    expect(addressed(address)).toEqual({ body: address });
  });

  it("names the conversation when nothing follows it", () => {
    expect(addressed("@checks")).toEqual({ handed: { to: "checks" }, body: "" });
  });

  it("keeps the rest of a message whole", () => {
    expect(addressed("@checks first\nsecond")).toEqual({
      handed: { to: "checks" },
      body: "first\nsecond",
    });
  });

  it("carries a name written in Cyrillic", () => {
    expect(addressed("@проверка глянь")).toEqual({
      handed: { to: "проверка" },
      body: "глянь",
    });
  });
});

describe("committed", () => {
  /** The whole reason it is not `addressed`: a name at the end is being typed. */
  it("waits for something to follow the name", () => {
    expect(committed("@check")).toBeNull();
    expect(committed("@checks")).toBeNull();
  });

  it("settles once a space follows it", () => {
    expect(committed("@checks ")).toEqual({ handed: { to: "checks" }, body: "" });
    expect(committed("@checks go")).toEqual({ handed: { to: "checks" }, body: "go" });
  });

  it("settles on a new line as readily as on a space", () => {
    expect(committed("@checks\ngo")).toEqual({ handed: { to: "checks" }, body: "go" });
  });

  it("says nothing about a message with no address", () => {
    expect(committed("look at the migrations")).toBeNull();
  });
});

describe("spelled", () => {
  it("writes back what a token took", () => {
    expect(spelled({ to: "checks" })).toBe("@checks");
    expect(spelled({ to: "checks", with: "codex" })).toBe("@checks:codex");
  });
});
