import assert from "node:assert/strict";
import test from "node:test";
import { encode, renderSVG } from "../src/vendor/uqr.mjs";
import {
  canNativeShare,
  createShareManager,
  getShareUrl,
  renderQrSvg,
} from "../src/ui/share.mjs";

test("QR encoder produces a scannable-size matrix for the arcade URL", () => {
  const result = encode("https://neoarcade.vercel.app", { ecc: "M" });
  assert.ok(result.size >= 21);
  assert.equal(result.data.length, result.size);
  assert.equal(result.data[0].length, result.size);
  assert.ok(result.data.flat().some(Boolean));
});

test("renderQrSvg returns an SVG image for a URL", () => {
  const svg = renderQrSvg("https://neoarcade.vercel.app");
  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
  assert.match(svg, /viewBox=/);
  const fromLib = renderSVG("https://neoarcade.vercel.app", {
    ecc: "M",
    border: 2,
    pixelSize: 8,
  });
  assert.ok(fromLib.includes("<svg"));
});

test("getShareUrl falls back when location is unavailable", () => {
  assert.equal(getShareUrl(), "https://neoarcade.vercel.app");
});

test("canNativeShare is false without navigator.share", () => {
  assert.equal(canNativeShare("https://neoarcade.vercel.app"), false);
});

test("createShareManager opens, renders QR, and closes", () => {
  const rootEl = {
    classList: {
      values: new Set(["hidden"]),
      contains(name) {
        return this.values.has(name);
      },
      add(name) {
        this.values.add(name);
      },
      remove(name) {
        this.values.delete(name);
      },
    },
    addEventListener() {},
  };
  const openButtonEl = {
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    focus() {},
  };
  const closeButtonEl = {
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    focus() {},
  };
  const qrEl = { innerHTML: "", querySelector: () => null };
  const urlEl = { textContent: "" };
  const messageEl = { textContent: "" };
  const nativeShareButtonEl = {
    hidden: false,
    disabled: false,
    addEventListener() {},
  };
  const copyButtonEl = { addEventListener() {} };
  const bodyClass = {
    values: new Set(),
    add(name) {
      this.values.add(name);
    },
    remove(name) {
      this.values.delete(name);
    },
  };
  const originalBody = globalThis.document;
  globalThis.document = {
    body: { classList: bodyClass },
    addEventListener() {},
  };

  try {
    const manager = createShareManager({
      rootEl,
      openButtonEl,
      closeButtonEl,
      qrEl,
      urlEl,
      messageEl,
      nativeShareButtonEl,
      copyButtonEl,
      getUrl: () => "https://neoarcade.vercel.app/share-test",
    });
    manager.init();
    openButtonEl.listeners.click();
    assert.equal(manager.isOpen(), true);
    assert.equal(urlEl.textContent, "https://neoarcade.vercel.app/share-test");
    assert.match(qrEl.innerHTML, /<svg/);
    assert.equal(bodyClass.values.has("share-open"), true);
    assert.equal(nativeShareButtonEl.hidden, true);
    closeButtonEl.listeners.click();
    assert.equal(manager.isOpen(), false);
    assert.equal(bodyClass.values.has("share-open"), false);
  } finally {
    globalThis.document = originalBody;
  }
});
