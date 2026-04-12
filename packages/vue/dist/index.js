import { computed as p, inject as _e, defineComponent as C, unref as _, renderSlot as w, openBlock as m, createElementBlock as g, normalizeStyle as $, createCommentVNode as D, normalizeClass as q, useSlots as ce, ref as L, watch as A, nextTick as Ee, normalizeProps as de, mergeProps as O, Fragment as I, withDirectives as Ie, withKeys as F, withModifiers as G, vModelText as $e, createTextVNode as ie, toDisplayString as W, renderList as J, createVNode as R, shallowRef as se, provide as Ce, markRaw as Pe, onMounted as De, onBeforeUnmount as Ne, withCtx as X, withMemo as U, createBlock as le, resolveDynamicComponent as Te, createElementVNode as Be, guardReactiveProps as Oe } from "vue";
import { getBoundsFromPoints as Re, getVisibleBounds as ue, createCanvasEngine as Le } from "@canvas/core";
const pe = /* @__PURE__ */ Symbol("canvas-engine"), B = {
  visible: !0,
  pattern: "line",
  minorOpacity: 0.14,
  majorOpacity: 0.18,
  fadeEdges: !0
};
function b() {
  const a = _e(pe);
  if (!a)
    throw new Error("Canvas composables must be used under <CanvasRoot>.");
  return a;
}
function Me() {
  const { snapshot: a } = b();
  return p(() => a.value.camera);
}
function dt() {
  const { snapshot: a } = b();
  return p(() => a.value.nodes);
}
function ut() {
  const { snapshot: a } = b();
  return p(() => a.value.selection);
}
function Ye() {
  const { snapshot: a } = b();
  return p(() => a.value.interaction);
}
function pt() {
  const { snapshot: a, viewportSize: n } = b();
  return p(() => ue(n.value.x, n.value.y, a.value.camera));
}
function ft(a = 200) {
  const { snapshot: n, viewportSize: s } = b();
  return p(() => {
    const d = ue(s.value.x, s.value.y, n.value.camera);
    return n.value.nodes.filter((i) => i.visible ? i.x + i.width > d.minX - a && i.x < d.maxX + a && i.y + i.height > d.minY - a && i.y < d.maxY + a : !1);
  });
}
function Ke() {
  const { snapshot: a, resolvedGrid: n } = b();
  function s(d, i) {
    return (d % i + i) % i;
  }
  return p(() => {
    const d = a.value.camera.z, i = n.value.size, u = n.value.size * n.value.majorEvery, r = i * d, l = u * d, z = a.value.camera.x * d, k = a.value.camera.y * d, v = r < 6 ? 0 : r < 12 ? n.value.minorOpacity * 0.57 : n.value.minorOpacity, x = l < 8 ? n.value.majorOpacity * 0.44 : n.value.majorOpacity;
    return {
      "--grid-minor-size": `${r}px`,
      "--grid-major-size": `${l}px`,
      "--grid-minor-x": `${s(z, r)}px`,
      "--grid-minor-y": `${s(k, r)}px`,
      "--grid-major-x": `${s(z, l)}px`,
      "--grid-major-y": `${s(k, l)}px`,
      "--grid-minor-color": `rgba(148, 163, 184, ${v})`,
      "--grid-major-color": `rgba(71, 85, 105, ${x})`,
      "--grid-mask-image": n.value.fadeEdges ? "radial-gradient(circle at center, black 68%, transparent 100%)" : "none"
    };
  });
}
function mt(a) {
  const { engine: n, snapshot: s, toLocalPoint: d } = b(), i = p(() => {
    const v = s.value.nodes.find((x) => x.id === a);
    if (!v)
      throw new Error(`Node "${a}" is not present in the current snapshot.`);
    return v;
  }), u = p(() => new Set(s.value.selection)), r = p(() => u.value.has(a)), l = p(
    () => s.value.interaction.mode === "editing-text" && s.value.interaction.nodeId === a
  ), z = p(() => i.value.locked), k = p(() => ({
    left: `${i.value.x}px`,
    top: `${i.value.y}px`,
    width: `${i.value.width}px`,
    height: `${i.value.height}px`,
    zIndex: String(i.value.zIndex)
  }));
  return {
    node: i,
    selected: r,
    editing: l,
    locked: z,
    style: k,
    beginEdit: () => n.beginTextEdit(a),
    commitText: (v) => n.commitTextEdit(a, v),
    startDrag: (v) => n.beginNodeDrag(a, v.pointerId, d(v.clientX, v.clientY)),
    startResize: (v, x) => n.beginResize(a, v, x.pointerId, d(x.clientX, x.clientY))
  };
}
function Xe() {
  const a = Ye();
  return p(() => a.value.mode !== "box-select" ? null : Re(a.value.startScreenPoint, a.value.currentScreenPoint));
}
const Ae = /* @__PURE__ */ C({
  __name: "CanvasBoxSelect",
  setup(a) {
    const n = Xe(), s = p(() => n.value ? {
      left: `${n.value.minX}px`,
      top: `${n.value.minY}px`,
      width: `${n.value.maxX - n.value.minX}px`,
      height: `${n.value.maxY - n.value.minY}px`
    } : {});
    return (d, i) => _(n) ? w(d.$slots, "default", {
      key: 0,
      bounds: _(n)
    }, () => [
      _(n) ? (m(), g("div", {
        key: 0,
        class: "canvas-box-select",
        style: $(s.value)
      }, null, 4)) : D("", !0)
    ], !0) : D("", !0);
  }
}), P = (a, n) => {
  const s = a.__vccOpts || a;
  for (const [d, i] of n)
    s[d] = i;
  return s;
}, Ve = /* @__PURE__ */ P(Ae, [["__scopeId", "data-v-2ca667dd"]]), He = /* @__PURE__ */ C({
  __name: "CanvasGrid",
  setup(a) {
    const { resolvedGrid: n } = b(), s = Ke(), d = p(() => {
      switch (n.value.pattern) {
        case "dot":
          return [
            "radial-gradient(circle, var(--grid-major-color) 1px, transparent 1px)",
            "radial-gradient(circle, var(--grid-minor-color) 1px, transparent 1px)"
          ].join(", ");
        case "cross":
          return [
            "linear-gradient(to right, var(--grid-major-color) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--grid-major-color) 1px, transparent 1px)",
            "linear-gradient(to right, var(--grid-minor-color) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--grid-minor-color) 1px, transparent 1px)"
          ].join(", ");
        case "none":
          return "none";
        default:
          return [
            "linear-gradient(to right, var(--grid-minor-color) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--grid-minor-color) 1px, transparent 1px)",
            "linear-gradient(to right, var(--grid-major-color) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--grid-major-color) 1px, transparent 1px)"
          ].join(", ");
      }
    }), i = p(() => n.value.pattern === "dot" ? [
      "var(--grid-major-size) var(--grid-major-size)",
      "var(--grid-minor-size) var(--grid-minor-size)"
    ].join(", ") : [
      "var(--grid-minor-size) var(--grid-minor-size)",
      "var(--grid-minor-size) var(--grid-minor-size)",
      "var(--grid-major-size) var(--grid-major-size)",
      "var(--grid-major-size) var(--grid-major-size)"
    ].join(", ")), u = p(() => n.value.pattern === "dot" ? [
      "var(--grid-major-x) var(--grid-major-y)",
      "var(--grid-minor-x) var(--grid-minor-y)"
    ].join(", ") : [
      "var(--grid-minor-x) var(--grid-minor-y)",
      "var(--grid-minor-x) var(--grid-minor-y)",
      "var(--grid-major-x) var(--grid-major-y)",
      "var(--grid-major-x) var(--grid-major-y)"
    ].join(", "));
    return (r, l) => _(n).visible && _(n).pattern !== "none" ? (m(), g("div", {
      key: 0,
      class: "canvas-grid",
      style: $({
        ..._(s),
        backgroundImage: d.value,
        backgroundSize: i.value,
        backgroundPosition: u.value
      })
    }, null, 4)) : D("", !0);
  }
}), Fe = /* @__PURE__ */ P(He, [["__scopeId", "data-v-5c13b009"]]), Ge = ["data-resize"], Ue = /* @__PURE__ */ C({
  __name: "CanvasNodeHandle",
  props: {
    handle: {}
  },
  setup(a) {
    return (n, s) => (m(), g("div", {
      class: q(["canvas-node-handle", `is-${a.handle}`]),
      "data-resize": a.handle
    }, null, 10, Ge));
  }
}), We = /* @__PURE__ */ P(Ue, [["__scopeId", "data-v-5580b3db"]]), qe = ["data-node-id"], Je = ["onKeydown"], Qe = {
  key: 1,
  class: "canvas-node__content"
}, Ze = /* @__PURE__ */ C({
  __name: "CanvasNode",
  props: {
    node: {},
    selected: { type: Boolean },
    editing: { type: Boolean },
    customRenderer: { type: Boolean }
  },
  setup(a) {
    const n = a, s = ce(), { engine: d } = b(), i = ["n", "ne", "e", "se", "s", "sw", "w", "nw"], u = L(E(n.node)), r = L(null), l = p(() => ({
      left: `${n.node.x}px`,
      top: `${n.node.y}px`,
      width: `${n.node.width}px`,
      height: `${n.node.height}px`,
      zIndex: String(n.node.zIndex)
    })), z = p(() => ({
      node: n.node,
      selected: n.selected,
      editing: n.editing,
      beginEdit: () => d.beginTextEdit(n.node.id),
      commitText: (y) => d.commitTextEdit(n.node.id, y)
    })), k = p(
      () => n.customRenderer !== void 0 ? n.customRenderer : !!s.default
    );
    A(
      () => n.node,
      (y) => {
        u.value = E(y);
      },
      { deep: !0 }
    ), A(
      () => n.editing,
      (y) => {
        y ? Ee(() => {
          r.value?.focus(), r.value?.select();
        }) : u.value = E(n.node);
      }
    );
    function v() {
      d.commitTextEdit(n.node.id, u.value);
    }
    function x() {
      u.value = E(n.node), d.endInteraction();
    }
    function E(y) {
      if (y.type !== "text")
        return "";
      const S = y.data?.content;
      return typeof S == "string" ? S : "";
    }
    return (y, S) => (m(), g("article", {
      class: q(["canvas-node", { "is-selected": a.selected, "is-editing": a.editing, "is-locked": a.node.locked, "is-group": a.node.type === "group" }]),
      style: $(l.value),
      "data-node-id": a.node.id
    }, [
      k.value ? w(y.$slots, "default", de(O({ key: 0 }, z.value)), void 0, !0) : (m(), g(I, { key: 1 }, [
        a.editing && a.node.type === "text" ? Ie((m(), g("textarea", {
          key: 0,
          ref_key: "textareaRef",
          ref: r,
          "onUpdate:modelValue": S[0] || (S[0] = (j) => u.value = j),
          class: "canvas-node__editor",
          "data-editor": "true",
          onBlur: v,
          onKeydown: [
            F(G(v, ["meta", "prevent"]), ["enter"]),
            F(G(v, ["ctrl", "prevent"]), ["enter"]),
            F(G(x, ["prevent"]), ["esc"])
          ]
        }, null, 40, Je)), [
          [$e, u.value]
        ]) : (m(), g("div", Qe, [
          a.node.type === "text" ? (m(), g(I, { key: 0 }, [
            ie(W(E(a.node) || "Double-click to edit"), 1)
          ], 64)) : (m(), g(I, { key: 1 }, [
            ie(W(a.node.type), 1)
          ], 64))
        ]))
      ], 64)),
      a.selected && !a.editing && !a.node.locked ? (m(), g(I, { key: 2 }, J(i, (j) => w(y.$slots, "handle", {
        key: j,
        node: a.node,
        handle: j
      }, () => [
        R(We, { handle: j }, null, 8, ["handle"])
      ], !0)), 64)) : D("", !0)
    ], 14, qe));
  }
}), et = /* @__PURE__ */ P(Ze, [["__scopeId", "data-v-884a9680"]]), tt = {
  key: 0,
  class: "canvas-snap-guides"
}, nt = /* @__PURE__ */ C({
  __name: "CanvasSnapGuides",
  setup(a) {
    const { snapshot: n } = b(), s = p(() => {
      const d = n.value.snapGuides;
      if (!d || d.length === 0) return [];
      const { x: i, y: u, z: r } = n.value.camera;
      return d.map((l) => l.axis === "x" ? {
        axis: "x",
        pos: (l.position + i) * r,
        from: (l.from + u) * r,
        to: (l.to + u) * r
      } : {
        axis: "y",
        pos: (l.position + u) * r,
        from: (l.from + i) * r,
        to: (l.to + i) * r
      });
    });
    return (d, i) => s.value.length > 0 ? (m(), g("div", tt, [
      (m(!0), g(I, null, J(s.value, (u, r) => (m(), g("div", {
        key: r,
        class: q(["canvas-snap-guide", u.axis === "x" ? "canvas-snap-guide--vertical" : "canvas-snap-guide--horizontal"]),
        style: $(
          u.axis === "x" ? { left: u.pos + "px", top: u.from + "px", height: u.to - u.from + "px" } : { top: u.pos + "px", left: u.from + "px", width: u.to - u.from + "px" }
        )
      }, null, 6))), 128))
    ])) : D("", !0);
  }
}), rt = /* @__PURE__ */ P(nt, [["__scopeId", "data-v-46408711"]]), ot = /* @__PURE__ */ C({
  __name: "CanvasViewport",
  setup(a) {
    const n = Me(), s = p(() => ({
      transform: `scale(${n.value.z}) translate(${n.value.x}px, ${n.value.y}px)`,
      "--canvas-zoom": n.value.z
    }));
    return (d, i) => (m(), g("div", {
      class: "canvas-viewport",
      style: $(s.value)
    }, [
      w(d.$slots, "default", {}, void 0, !0)
    ], 4));
  }
}), at = /* @__PURE__ */ P(ot, [["__scopeId", "data-v-24e2d730"]]), it = { class: "canvas-node-compact__label" }, st = /* @__PURE__ */ C({
  __name: "CanvasRoot",
  props: {
    engine: {
      type: Object,
      default: void 0
    },
    cullMargin: {
      type: Number,
      default: 200
    },
    grid: {
      type: [Boolean, Object],
      default: !0
    },
    renderers: {
      type: Object,
      default: () => ({})
    },
    fallbackRenderer: {
      type: Object,
      default: null
    }
  },
  emits: ["ready"],
  setup(a, { emit: n }) {
    const s = a, d = n, i = L(null), u = L({ x: 0, y: 0 }), r = s.engine ?? Le(), l = se(r.getSnapshot()), z = se(s.renderers), k = ce(), v = L(!1);
    function x(e, o) {
      if (e === !1)
        return {
          ...B,
          visible: !1,
          size: o.size,
          majorEvery: o.majorEvery,
          snap: o.snap,
          pattern: o.pattern
        };
      const t = e === !0 ? {} : e;
      return {
        visible: t.visible ?? B.visible,
        size: t.size ?? o.size,
        majorEvery: t.majorEvery ?? o.majorEvery,
        snap: t.snap ?? o.snap,
        pattern: t.pattern ?? o.pattern,
        minorOpacity: t.minorOpacity ?? B.minorOpacity,
        majorOpacity: t.majorOpacity ?? B.majorOpacity,
        fadeEdges: t.fadeEdges ?? B.fadeEdges
      };
    }
    const E = p(() => x(s.grid, l.value.grid));
    Ce(pe, {
      engine: r,
      snapshot: l,
      rootElement: i,
      viewportSize: u,
      renderers: z,
      resolvedGrid: E,
      toLocalPoint: N
    });
    let y = [], S = /* @__PURE__ */ new Set();
    const j = p(() => {
      const e = l.value.selection;
      return e.length === y.length && e.every((o, t) => o === y[t]) || (y = e, S = new Set(e)), S;
    });
    function fe(e, o, t) {
      if (t)
        return "full";
      const c = Math.max(e.width, e.height) * o;
      return c < 8 ? "hidden" : c < 40 ? "simple" : c < 120 ? "compact" : "full";
    }
    function Q(e) {
      if (e.type === "text") {
        const o = e.data?.content;
        if (typeof o == "string") {
          const t = o.split(`
`)[0] ?? "";
          return t.length > 40 ? t.slice(0, 40) + "…" : t;
        }
      }
      return e.type;
    }
    const Z = p(() => {
      const e = r.getVisibleBounds(u.value.x, u.value.y), o = l.value.camera.z, t = j.value, c = [];
      for (const f of l.value.nodes) {
        if (!f.visible || f.x + f.width <= e.minX - s.cullMargin || f.x >= e.maxX + s.cullMargin || f.y + f.height <= e.minY - s.cullMargin || f.y >= e.maxY + s.cullMargin)
          continue;
        const ae = fe(f, o, t.has(f.id));
        ae !== "hidden" && c.push({ ...f, lod: ae });
      }
      return c;
    }), me = p(() => ({
      snapshot: l.value,
      camera: l.value.camera,
      grid: l.value.grid,
      selection: l.value.selection,
      interaction: l.value.interaction,
      visibleNodeCount: Z.value.length,
      trace: r.exportTrace().slice(-20)
    }));
    let V = !1;
    function ve() {
      V || (V = !0, queueMicrotask(() => {
        l.value = r.getSnapshot(), V = !1;
      }));
    }
    const ge = [
      r.on("command:after", ve)
    ];
    A(
      () => s.renderers,
      (e) => {
        z.value = Object.fromEntries(
          Object.entries(e).map(([o, t]) => [o, Pe(t)])
        );
      },
      { immediate: !0, deep: !0 }
    ), A(
      () => s.grid,
      (e) => {
        if (e && typeof e == "object") {
          const o = {};
          e.size !== void 0 && (o.size = e.size), e.majorEvery !== void 0 && (o.majorEvery = e.majorEvery), e.snap !== void 0 && (o.snap = e.snap), e.pattern !== void 0 && (o.pattern = e.pattern), Object.keys(o).length > 0 && r.updateGridSettings(o);
        }
      },
      { immediate: !0, deep: !0 }
    );
    function M() {
      const e = i.value?.getBoundingClientRect();
      u.value = {
        x: e?.width ?? 0,
        y: e?.height ?? 0
      }, r.setViewportSize(u.value);
    }
    function N(e, o) {
      const t = i.value?.getBoundingClientRect();
      return {
        x: e - (t?.left ?? 0),
        y: o - (t?.top ?? 0)
      };
    }
    function ee(e) {
      return e instanceof HTMLElement ? e.closest("[data-node-id]")?.dataset.nodeId : void 0;
    }
    function te(e) {
      return e instanceof HTMLElement ? e.closest("[data-resize]")?.dataset.resize : void 0;
    }
    function ne(e) {
      return e instanceof HTMLElement && !!e.closest('[data-editor="true"]');
    }
    function ye(e) {
      const o = r.screenToWorld(e);
      return [...r.getSnapshot().nodes].sort((c, f) => f.zIndex - c.zIndex).find(
        (c) => o.x >= c.x && o.x <= c.x + c.width && o.y >= c.y && o.y <= c.y + c.height
      )?.id;
    }
    function Y(e, o, t, c) {
      const f = N(e.clientX, e.clientY);
      o === "pan" ? r.beginPan(e.pointerId, f) : o === "drag" && t ? r.beginNodeDrag(t, e.pointerId, f) : o === "resize" && t && c ? r.beginResize(t, c, e.pointerId, f) : r.beginBoxSelect(e.pointerId, f), i.value?.setPointerCapture(e.pointerId), i.value?.focus();
    }
    function xe(e) {
      if (ne(e.target))
        return;
      if (e.button === 1 || v.value) {
        e.preventDefault(), Y(e, "pan");
        return;
      }
      if (e.button !== 0)
        return;
      const o = ee(e.target), t = te(e.target);
      if (t && o) {
        Y(e, "resize", o, t);
        return;
      }
      if (o) {
        Y(e, "drag", o);
        return;
      }
      Y(e, "box-select");
    }
    let h = null, K = !1;
    function he(e) {
      h = { id: e.pointerId, point: N(e.clientX, e.clientY), shift: e.shiftKey }, K || (K = !0, requestAnimationFrame(() => {
        h && r.updatePointer(h.id, h.point, { shift: h.shift }), K = !1, h = null;
      }));
    }
    function be() {
      h && (r.updatePointer(h.id, h.point, { shift: h.shift }), h = null, K = !1);
    }
    function re(e) {
      be(), r.endInteraction(e.pointerId), i.value?.hasPointerCapture(e.pointerId) && i.value.releasePointerCapture(e.pointerId);
    }
    function ze(e) {
      e.preventDefault();
      const o = N(e.clientX, e.clientY);
      e.ctrlKey || e.metaKey ? r.zoomAt(o, Math.max(-10, Math.min(10, e.deltaY))) : r.panBy(e.deltaX, e.deltaY);
    }
    function we(e) {
      if (ne(e.target) || te(e.target))
        return;
      const o = N(e.clientX, e.clientY), t = ee(e.target) ?? ye(o);
      if (t) {
        r.beginTextEdit(t);
        return;
      }
      const c = r.screenToWorld(o), f = r.createNode({
        type: "text",
        x: c.x,
        y: c.y,
        data: { content: "New node" }
      });
      r.beginTextEdit(f.id);
    }
    function oe(e) {
      const o = e.target;
      return o instanceof HTMLTextAreaElement || o instanceof HTMLElement && o.isContentEditable;
    }
    function ke(e) {
      if (e.code === "Space" && !oe(e) && (e.preventDefault(), v.value = !0), oe(e))
        return;
      const o = e.metaKey || e.ctrlKey, t = r.getSelection();
      if (e.key === "Escape") {
        r.clearSelection(), r.endInteraction();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        t.length > 0 && (e.preventDefault(), r.deleteSelected());
        return;
      }
      if (e.key === "Enter" && t.length === 1) {
        r.beginTextEdit(t[0]);
        return;
      }
      if (o && e.key.toLowerCase() === "a") {
        e.preventDefault(), r.selectAll();
        return;
      }
      if (o && e.key.toLowerCase() === "d" && t.length > 0) {
        e.preventDefault(), r.duplicateNodes(t);
        return;
      }
      if (o && e.key.toLowerCase() === "c" && t.length > 0) {
        e.preventDefault(), r.copySelected();
        return;
      }
      if (o && e.key.toLowerCase() === "v") {
        e.preventDefault(), r.pasteClipboard();
        return;
      }
      if (o && e.key === "0") {
        e.preventDefault(), r.zoomTo(1, !0);
        return;
      }
      if (o && e.key === "1") {
        e.preventDefault(), r.zoomToFit(40, !0);
        return;
      }
      if (o && e.key.toLowerCase() === "z") {
        const c = e.shiftKey ? r.redo : r.undo;
        c && (e.preventDefault(), c.call(r));
        return;
      }
      if (o && e.key.toLowerCase() === "y") {
        const c = r.redo;
        c && (e.preventDefault(), c.call(r));
        return;
      }
      if (t.length > 0 && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const c = e.shiftKey ? l.value.grid.size * l.value.grid.majorEvery : l.value.grid.size, f = e.key === "ArrowLeft" ? { x: -c, y: 0 } : e.key === "ArrowRight" ? { x: c, y: 0 } : e.key === "ArrowUp" ? { x: 0, y: -c } : { x: 0, y: c };
        r.translateSelectedNodes(f.x, f.y);
      }
    }
    function Se(e) {
      e.code === "Space" && (v.value = !1);
    }
    function H(e) {
      return z.value[e.type] ?? s.fallbackRenderer;
    }
    function je(e) {
      return !!H(e) || !!k[`node:${e.type}`] || !!k.node;
    }
    let T = null;
    return De(() => {
      M(), i.value && typeof ResizeObserver < "u" ? (T = new ResizeObserver(M), T.observe(i.value)) : window.addEventListener("resize", M), d("ready", r);
    }), Ne(() => {
      for (const e of ge)
        e();
      T ? (T.disconnect(), T = null) : window.removeEventListener("resize", M);
    }), (e, o) => (m(), g("div", {
      ref_key: "rootElement",
      ref: i,
      class: "canvas-root",
      tabindex: "0",
      onPointerdown: xe,
      onPointermove: he,
      onPointerup: re,
      onPointercancel: re,
      onWheel: ze,
      onDblclick: we,
      onKeydown: ke,
      onKeyup: Se
    }, [
      R(Fe),
      R(at, null, {
        default: X(() => [
          w(e.$slots, "viewport", {
            engine: _(r),
            snapshot: l.value
          }, void 0, !0),
          (m(!0), g(I, null, J(Z.value, (t) => (m(), g(I, {
            key: t.id
          }, [
            t.lod === "full" ? U([t.x, t.y, t.width, t.height, t.zIndex, t.lod, j.value.has(t.id), l.value.interaction.mode === "editing-text" && l.value.interaction.nodeId === t.id], () => (m(), le(et, {
              key: 0,
              node: t,
              selected: j.value.has(t.id),
              editing: l.value.interaction.mode === "editing-text" && l.value.interaction.nodeId === t.id,
              "custom-renderer": je(t)
            }, {
              default: X((c) => [
                w(e.$slots, `node:${t.type}`, O({ ref_for: !0 }, c), () => [
                  w(e.$slots, "node", O({ ref_for: !0 }, c), () => [
                    H(t) ? (m(), le(Te(H(t)), O({
                      key: 0,
                      ref_for: !0
                    }, c), null, 16)) : D("", !0)
                  ], !0)
                ], !0)
              ]),
              handle: X((c) => [
                w(e.$slots, "handle", O({ ref_for: !0 }, c), void 0, !0)
              ]),
              _: 2
            }, 1032, ["node", "selected", "editing", "custom-renderer"])), o, 0) : t.lod === "compact" ? U([t.x, t.y, t.width, t.height, t.zIndex, t.lod, Q(t)], () => (m(), g("div", {
              key: 1,
              class: "canvas-node-compact",
              "data-node-id": t.id,
              style: $({ left: t.x + "px", top: t.y + "px", width: t.width + "px", height: t.height + "px", zIndex: t.zIndex })
            }, [
              Be("span", it, W(Q(t)), 1)
            ], 12, ["data-node-id"])), o, 1) : U([t.x, t.y, t.width, t.height, t.zIndex, t.lod], () => (m(), g("div", {
              key: 2,
              class: "canvas-node-simple",
              "data-node-id": t.id,
              style: $({ left: t.x + "px", top: t.y + "px", width: t.width + "px", height: t.height + "px", zIndex: t.zIndex })
            }, null, 12, ["data-node-id"])), o, 2)
          ], 64))), 128))
        ]),
        _: 3
      }),
      R(rt),
      R(Ve, null, {
        default: X((t) => [
          w(e.$slots, "box-select", de(Oe(t)), void 0, !0)
        ]),
        _: 3
      }),
      w(e.$slots, "default", {
        engine: _(r),
        snapshot: l.value,
        debugState: me.value
      }, void 0, !0)
    ], 544));
  }
}), vt = /* @__PURE__ */ P(st, [["__scopeId", "data-v-da20c3fa"]]);
export {
  Ve as CanvasBoxSelect,
  Fe as CanvasGrid,
  et as CanvasNode,
  We as CanvasNodeHandle,
  vt as CanvasRoot,
  rt as CanvasSnapGuides,
  at as CanvasViewport,
  Xe as useBoxSelectBounds,
  Me as useCamera,
  b as useCanvasEngine,
  Ke as useGridStyle,
  Ye as useInteraction,
  mt as useNode,
  dt as useNodes,
  ut as useSelection,
  pt as useVisibleBounds,
  ft as useVisibleNodes
};
