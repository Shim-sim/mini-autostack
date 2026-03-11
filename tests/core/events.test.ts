import { describe, it, expect, vi } from "vitest";
import { TypedEventEmitter } from "@mini-autostack/core";

describe("TypedEventEmitter", () => {
  it("should emit and receive events with correct payload", () => {
    const emitter = new TypedEventEmitter();
    const handler = vi.fn();

    emitter.on("vision:start", handler);
    emitter.emit("vision:start", { imageSource: "/path/to/image.png" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ imageSource: "/path/to/image.png" });
  });

  it("should support multiple listeners for the same event", () => {
    const emitter = new TypedEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on("schema:validate:pass", handler1);
    emitter.on("schema:validate:pass", handler2);
    emitter.emit("schema:validate:pass", { tableCount: 3, relationCount: 2 });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("should return unsubscribe function", () => {
    const emitter = new TypedEventEmitter();
    const handler = vi.fn();

    const unsub = emitter.on("pipeline:start", handler);
    unsub();
    emitter.emit("pipeline:start", {
      imageSource: "test.png",
      startedAt: new Date().toISOString(),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should record events in log", () => {
    const emitter = new TypedEventEmitter();

    emitter.emit("vision:start", { imageSource: "a.png" });
    emitter.emit("vision:complete", {
      components: [],
      entities: [],
      palette: {
        primary: "#000",
        secondary: "#111",
        background: "#fff",
        surface: "#eee",
        text: "#000",
      },
      layoutType: "dashboard",
      description: "test",
    });

    const log = emitter.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].type).toBe("vision:start");
    expect(log[1].type).toBe("vision:complete");
  });

  it("should clear event log", () => {
    const emitter = new TypedEventEmitter();

    emitter.emit("vision:start", { imageSource: "a.png" });
    expect(emitter.getEventLog()).toHaveLength(1);

    emitter.clearLog();
    expect(emitter.getEventLog()).toHaveLength(0);
  });

  it("should not throw if listener throws", () => {
    const emitter = new TypedEventEmitter();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    emitter.on("vision:start", () => {
      throw new Error("listener error");
    });

    expect(() =>
      emitter.emit("vision:start", { imageSource: "a.png" }),
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("should handle events with complex payloads", () => {
    const emitter = new TypedEventEmitter();
    const handler = vi.fn();

    emitter.on("schema:validate:fail", handler);
    emitter.emit("schema:validate:fail", {
      errors: [
        {
          severity: "error",
          message: "Missing @id field",
          location: { line: 5, column: 1 },
          suggestion: "Add @id attribute to primary key field",
        },
      ],
    });

    expect(handler).toHaveBeenCalledWith({
      errors: [
        expect.objectContaining({
          severity: "error",
          message: "Missing @id field",
        }),
      ],
    });
  });
});
