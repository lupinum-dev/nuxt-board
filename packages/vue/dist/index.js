import { computed as p, inject as je, defineComponent as C, unref as _, renderSlot as w, openBlock as v, createElementBlock as g, normalizeStyle as P, createCommentVNode as D, normalizeClass as W, useSlots as le, ref as L, watch as V, nextTick as Se, normalizeProps as ce, mergeProps as R, Fragment as $, withDirectives as _e, withKeys as G, withModifiers as U, vModelText as Ee, createTextVNode as re, toDisplayString as oe, renderList as q, createVNode as N, shallowRef as ae, provide as $e, markRaw as Ce, onMounted as Ie, onBeforeUnmount as De, withCtx as A, withMemo as ie, createBlock as se, resolveDynamicComponent as Pe, guardReactiveProps as Be } from "vue";
import { getBoundsFromPoints as Te, getVisibleBounds as de, createCanvasEngine as Oe } from "@canvas/core";
const ue = /* @__PURE__ */ Symbol("canvas-engine"), O = {
  visible: !0,
  pattern: "line",
  minorOpacity: 0.14,
  majorOpacity: 0.18,
  fadeEdges: !0
};
function b() {
  const o = je(ue);
  if (!o)
    throw new Error("Canvas composables must be used under <CanvasRoot>.");
  return o;
}
function Re() {
  const { snapshot: o } = b();
  return p(() => o.value.camera);
}
function it() {
  const { snapshot: o } = b();
  return p(() => o.value.nodes);
}
function st() {
  const { snapshot: o } = b();
  return p(() => o.value.selection);
}
function Ne() {
  const { snapshot: o } = b();
  return p(() => o.value.interaction);
}
function lt() {
  const { snapshot: o, viewportSize: n } = b();
  return p(() => de(n.value.x, n.value.y, o.value.camera));
}
function ct(o = 200) {
  const { snapshot: n, viewportSize: s } = b();
  return p(() => {
    const c = de(s.value.x, s.value.y, n.value.camera);
    return n.value.nodes.filter((i) => i.visible ? i.x + i.width > c.minX - o && i.x < c.maxX + o && i.y + i.height > c.minY - o && i.y < c.maxY + o : !1);
  });
}
function Le() {
  const { snapshot: o, resolvedGrid: n } = b();
  function s(c, i) {
    return (c % i + i) % i;
  }
  return p(() => {
    const c = o.value.camera.z, i = n.value.size, d = n.value.size * n.value.majorEvery, r = i * c, l = d * c, z = o.value.camera.x * c, k = o.value.camera.y * c, f = r < 6 ? 0 : r < 12 ? n.value.minorOpacity * 0.57 : n.value.minorOpacity, x = l < 8 ? n.value.majorOpacity * 0.44 : n.value.majorOpacity;
    return {
      "--grid-minor-size": `${r}px`,
      "--grid-major-size": `${l}px`,
      "--grid-minor-x": `${s(z, r)}px`,
      "--grid-minor-y": `${s(k, r)}px`,
      "--grid-major-x": `${s(z, l)}px`,
      "--grid-major-y": `${s(k, l)}px`,
      "--grid-minor-color": `rgba(148, 163, 184, ${f})`,
      "--grid-major-color": `rgba(71, 85, 105, ${x})`,
      "--grid-mask-image": n.value.fadeEdges ? "radial-gradient(circle at center, black 68%, transparent 100%)" : "none"
    };
  });
}
function dt(o) {
  const { engine: n, snapshot: s, toLocalPoint: c } = b(), i = p(() => {
    const f = s.value.nodes.find((x) => x.id === o);
    if (!f)
      throw new Error(`Node "${o}" is not present in the current snapshot.`);
    return f;
  }), d = p(() => new Set(s.value.selection)), r = p(() => d.value.has(o)), l = p(
    () => s.value.interaction.mode === "editing-text" && s.value.interaction.nodeId === o
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
    beginEdit: () => n.beginTextEdit(o),
    commitText: (f) => n.commitTextEdit(o, f),
    startDrag: (f) => n.beginNodeDrag(o, f.pointerId, c(f.clientX, f.clientY)),
    startResize: (f, x) => n.beginResize(o, f, x.pointerId, c(x.clientX, x.clientY))
  };
}
function Me() {
  const o = Ne();
  return p(() => o.value.mode !== "box-select" ? null : Te(o.value.startScreenPoint, o.value.currentScreenPoint));
}
const Ye = /* @__PURE__ */ C({
  __name: "CanvasBoxSelect",
  setup(o) {
    const n = Me(), s = p(() => n.value ? {
      left: `${n.value.minX}px`,
      top: `${n.value.minY}px`,
      width: `${n.value.maxX - n.value.minX}px`,
      height: `${n.value.maxY - n.value.minY}px`
    } : {});
    return (c, i) => _(n) ? w(c.$slots, "default", {
      key: 0,
      bounds: _(n)
    }, () => [
      _(n) ? (v(), g("div", {
        key: 0,
        class: "canvas-box-select",
        style: P(s.value)
      }, null, 4)) : D("", !0)
    ], !0) : D("", !0);
  }
}), I = (o, n) => {
  const s = o.__vccOpts || o;
  for (const [c, i] of n)
    s[c] = i;
  return s;
}, Ke = /* @__PURE__ */ I(Ye, [["__scopeId", "data-v-2ca667dd"]]), Xe = /* @__PURE__ */ C({
  __name: "CanvasGrid",
  setup(o) {
    const { resolvedGrid: n } = b(), s = Le(), c = p(() => {
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
    ].join(", ")), d = p(() => n.value.pattern === "dot" ? [
      "var(--grid-major-x) var(--grid-major-y)",
      "var(--grid-minor-x) var(--grid-minor-y)"
    ].join(", ") : [
      "var(--grid-minor-x) var(--grid-minor-y)",
      "var(--grid-minor-x) var(--grid-minor-y)",
      "var(--grid-major-x) var(--grid-major-y)",
      "var(--grid-major-x) var(--grid-major-y)"
    ].join(", "));
    return (r, l) => _(n).visible && _(n).pattern !== "none" ? (v(), g("div", {
      key: 0,
      class: "canvas-grid",
      style: P({
        ..._(s),
        backgroundImage: c.value,
        backgroundSize: i.value,
        backgroundPosition: d.value
      })
    }, null, 4)) : D("", !0);
  }
}), Ae = /* @__PURE__ */ I(Xe, [["__scopeId", "data-v-5c13b009"]]), Ve = ["data-resize"], He = /* @__PURE__ */ C({
  __name: "CanvasNodeHandle",
  props: {
    handle: {}
  },
  setup(o) {
    return (n, s) => (v(), g("div", {
      class: W(["canvas-node-handle", `is-${o.handle}`]),
      "data-resize": o.handle
    }, null, 10, Ve));
  }
}), Fe = /* @__PURE__ */ I(He, [["__scopeId", "data-v-e9964eeb"]]), Ge = ["data-node-id"], Ue = ["onKeydown"], We = {
  key: 1,
  class: "canvas-node__content"
}, qe = /* @__PURE__ */ C({
  __name: "CanvasNode",
  props: {
    node: {},
    selected: { type: Boolean },
    editing: { type: Boolean },
    customRenderer: { type: Boolean }
  },
  setup(o) {
    const n = o, s = le(), { engine: c } = b(), i = ["n", "ne", "e", "se", "s", "sw", "w", "nw"], d = L(E(n.node)), r = L(null), l = p(() => ({
      left: `${n.node.x}px`,
      top: `${n.node.y}px`,
      width: `${n.node.width}px`,
      height: `${n.node.height}px`,
      zIndex: String(n.node.zIndex)
    })), z = p(() => ({
      node: n.node,
      selected: n.selected,
      editing: n.editing,
      beginEdit: () => c.beginTextEdit(n.node.id),
      commitText: (y) => c.commitTextEdit(n.node.id, y)
    })), k = p(
      () => n.customRenderer !== void 0 ? n.customRenderer : !!s.default
    );
    V(
      () => n.node,
      (y) => {
        d.value = E(y);
      },
      { deep: !0 }
    ), V(
      () => n.editing,
      (y) => {
        y ? Se(() => {
          r.value?.focus(), r.value?.select();
        }) : d.value = E(n.node);
      }
    );
    function f() {
      c.commitTextEdit(n.node.id, d.value);
    }
    function x() {
      d.value = E(n.node), c.endInteraction();
    }
    function E(y) {
      if (y.type !== "text")
        return "";
      const j = y.data?.content;
      return typeof j == "string" ? j : "";
    }
    return (y, j) => (v(), g("article", {
      class: W(["canvas-node", { "is-selected": o.selected, "is-editing": o.editing, "is-locked": o.node.locked }]),
      style: P(l.value),
      "data-node-id": o.node.id
    }, [
      k.value ? w(y.$slots, "default", ce(R({ key: 0 }, z.value)), void 0, !0) : (v(), g($, { key: 1 }, [
        o.editing && o.node.type === "text" ? _e((v(), g("textarea", {
          key: 0,
          ref_key: "textareaRef",
          ref: r,
          "onUpdate:modelValue": j[0] || (j[0] = (S) => d.value = S),
          class: "canvas-node__editor",
          "data-editor": "true",
          onBlur: f,
          onKeydown: [
            G(U(f, ["meta", "prevent"]), ["enter"]),
            G(U(f, ["ctrl", "prevent"]), ["enter"]),
            G(U(x, ["prevent"]), ["esc"])
          ]
        }, null, 40, Ue)), [
          [Ee, d.value]
        ]) : (v(), g("div", We, [
          o.node.type === "text" ? (v(), g($, { key: 0 }, [
            re(oe(E(o.node) || "Double-click to edit"), 1)
          ], 64)) : (v(), g($, { key: 1 }, [
            re(oe(o.node.type), 1)
          ], 64))
        ]))
      ], 64)),
      o.selected && !o.editing && !o.node.locked ? (v(), g($, { key: 2 }, q(i, (S) => w(y.$slots, "handle", {
        key: S,
        node: o.node,
        handle: S
      }, () => [
        N(Fe, { handle: S }, null, 8, ["handle"])
      ], !0)), 64)) : D("", !0)
    ], 14, Ge));
  }
}), Je = /* @__PURE__ */ I(qe, [["__scopeId", "data-v-975fb886"]]), Qe = {
  key: 0,
  class: "canvas-snap-guides"
}, Ze = /* @__PURE__ */ C({
  __name: "CanvasSnapGuides",
  setup(o) {
    const { snapshot: n } = b(), s = p(() => {
      const c = n.value.snapGuides;
      if (!c || c.length === 0) return [];
      const { x: i, y: d, z: r } = n.value.camera;
      return c.map((l) => l.axis === "x" ? {
        axis: "x",
        pos: (l.position + i) * r,
        from: (l.from + d) * r,
        to: (l.to + d) * r
      } : {
        axis: "y",
        pos: (l.position + d) * r,
        from: (l.from + i) * r,
        to: (l.to + i) * r
      });
    });
    return (c, i) => s.value.length > 0 ? (v(), g("div", Qe, [
      (v(!0), g($, null, q(s.value, (d, r) => (v(), g("div", {
        key: r,
        class: W(["canvas-snap-guide", d.axis === "x" ? "canvas-snap-guide--vertical" : "canvas-snap-guide--horizontal"]),
        style: P(
          d.axis === "x" ? { left: d.pos + "px", top: d.from + "px", height: d.to - d.from + "px" } : { top: d.pos + "px", left: d.from + "px", width: d.to - d.from + "px" }
        )
      }, null, 6))), 128))
    ])) : D("", !0);
  }
}), et = /* @__PURE__ */ I(Ze, [["__scopeId", "data-v-46408711"]]), tt = /* @__PURE__ */ C({
  __name: "CanvasViewport",
  setup(o) {
    const n = Re(), s = p(() => ({
      transform: `scale(${n.value.z}) translate(${n.value.x}px, ${n.value.y}px)`
    }));
    return (c, i) => (v(), g("div", {
      class: "canvas-viewport",
      style: P(s.value)
    }, [
      w(c.$slots, "default", {}, void 0, !0)
    ], 4));
  }
}), nt = /* @__PURE__ */ I(tt, [["__scopeId", "data-v-53cada3d"]]), rt = /* @__PURE__ */ C({
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
  setup(o, { emit: n }) {
    const s = o, c = n, i = L(null), d = L({ x: 0, y: 0 }), r = s.engine ?? Oe(), l = ae(r.getSnapshot()), z = ae(s.renderers), k = le(), f = L(!1);
    function x(e, a) {
      if (e === !1)
        return {
          ...O,
          visible: !1,
          size: a.size,
          majorEvery: a.majorEvery,
          snap: a.snap,
          pattern: a.pattern
        };
      const t = e === !0 ? {} : e;
      return {
        visible: t.visible ?? O.visible,
        size: t.size ?? a.size,
        majorEvery: t.majorEvery ?? a.majorEvery,
        snap: t.snap ?? a.snap,
        pattern: t.pattern ?? a.pattern,
        minorOpacity: t.minorOpacity ?? O.minorOpacity,
        majorOpacity: t.majorOpacity ?? O.majorOpacity,
        fadeEdges: t.fadeEdges ?? O.fadeEdges
      };
    }
    const E = p(() => x(s.grid, l.value.grid));
    $e(ue, {
      engine: r,
      snapshot: l,
      rootElement: i,
      viewportSize: d,
      renderers: z,
      resolvedGrid: E,
      toLocalPoint: B
    });
    let y = [], j = /* @__PURE__ */ new Set();
    const S = p(() => {
      const e = l.value.selection;
      return e.length === y.length && e.every((a, t) => a === y[t]) || (y = e, j = new Set(e)), j;
    });
    function pe(e, a, t) {
      if (t)
        return "full";
      const u = Math.max(e.width, e.height) * a;
      return u < 8 ? "hidden" : u < 60 ? "simple" : "full";
    }
    const J = p(() => {
      const e = r.getVisibleBounds(d.value.x, d.value.y), a = l.value.camera.z, t = S.value, u = [];
      for (const m of l.value.nodes) {
        if (!m.visible || m.x + m.width <= e.minX - s.cullMargin || m.x >= e.maxX + s.cullMargin || m.y + m.height <= e.minY - s.cullMargin || m.y >= e.maxY + s.cullMargin)
          continue;
        const X = pe(m, a, t.has(m.id));
        X !== "hidden" && u.push({ ...m, lod: X });
      }
      return u;
    }), fe = p(() => ({
      snapshot: l.value,
      camera: l.value.camera,
      grid: l.value.grid,
      selection: l.value.selection,
      interaction: l.value.interaction,
      visibleNodeCount: J.value.length,
      trace: r.exportTrace().slice(-20)
    }));
    let H = !1;
    function me() {
      H || (H = !0, queueMicrotask(() => {
        l.value = r.getSnapshot(), H = !1;
      }));
    }
    const ve = [
      r.on("command:after", me)
    ];
    V(
      () => s.renderers,
      (e) => {
        z.value = Object.fromEntries(
          Object.entries(e).map(([a, t]) => [a, Ce(t)])
        );
      },
      { immediate: !0, deep: !0 }
    ), V(
      () => s.grid,
      (e) => {
        if (e && typeof e == "object") {
          const a = {};
          e.size !== void 0 && (a.size = e.size), e.majorEvery !== void 0 && (a.majorEvery = e.majorEvery), e.snap !== void 0 && (a.snap = e.snap), e.pattern !== void 0 && (a.pattern = e.pattern), Object.keys(a).length > 0 && r.updateGridSettings(a);
        }
      },
      { immediate: !0, deep: !0 }
    );
    function M() {
      const e = i.value?.getBoundingClientRect();
      d.value = {
        x: e?.width ?? 0,
        y: e?.height ?? 0
      }, r.setViewportSize(d.value);
    }
    function B(e, a) {
      const t = i.value?.getBoundingClientRect();
      return {
        x: e - (t?.left ?? 0),
        y: a - (t?.top ?? 0)
      };
    }
    function Q(e) {
      return e instanceof HTMLElement ? e.closest("[data-node-id]")?.dataset.nodeId : void 0;
    }
    function Z(e) {
      return e instanceof HTMLElement ? e.closest("[data-resize]")?.dataset.resize : void 0;
    }
    function ee(e) {
      return e instanceof HTMLElement && !!e.closest('[data-editor="true"]');
    }
    function Y(e, a, t, u) {
      const m = B(e.clientX, e.clientY);
      a === "pan" ? r.beginPan(e.pointerId, m) : a === "drag" && t ? r.beginNodeDrag(t, e.pointerId, m) : a === "resize" && t && u ? r.beginResize(t, u, e.pointerId, m) : r.beginBoxSelect(e.pointerId, m), i.value?.setPointerCapture(e.pointerId), i.value?.focus();
    }
    function ge(e) {
      if (ee(e.target))
        return;
      if (e.button === 1 || f.value) {
        e.preventDefault(), Y(e, "pan");
        return;
      }
      if (e.button !== 0)
        return;
      const a = Q(e.target), t = Z(e.target);
      if (t && a) {
        Y(e, "resize", a, t);
        return;
      }
      if (a) {
        Y(e, "drag", a);
        return;
      }
      Y(e, "box-select");
    }
    let h = null, K = !1;
    function ye(e) {
      h = { id: e.pointerId, point: B(e.clientX, e.clientY), shift: e.shiftKey }, K || (K = !0, requestAnimationFrame(() => {
        h && r.updatePointer(h.id, h.point, { shift: h.shift }), K = !1, h = null;
      }));
    }
    function xe() {
      h && (r.updatePointer(h.id, h.point, { shift: h.shift }), h = null, K = !1);
    }
    function te(e) {
      xe(), r.endInteraction(e.pointerId), i.value?.hasPointerCapture(e.pointerId) && i.value.releasePointerCapture(e.pointerId);
    }
    function he(e) {
      e.preventDefault();
      const a = B(e.clientX, e.clientY);
      e.ctrlKey || e.metaKey ? r.zoomAt(a, Math.max(-10, Math.min(10, e.deltaY))) : r.panBy(e.deltaX, e.deltaY);
    }
    function be(e) {
      if (ee(e.target) || Z(e.target))
        return;
      const a = Q(e.target);
      if (a) {
        r.beginTextEdit(a);
        return;
      }
      const t = B(e.clientX, e.clientY), u = r.screenToWorld(t), m = r.createNode({
        type: "text",
        x: u.x,
        y: u.y,
        data: { content: "New node" }
      });
      r.beginTextEdit(m.id);
    }
    function ne(e) {
      const a = e.target;
      return a instanceof HTMLTextAreaElement || a instanceof HTMLElement && a.isContentEditable;
    }
    function ze(e) {
      if (e.code === "Space" && !ne(e) && (e.preventDefault(), f.value = !0), ne(e))
        return;
      const a = e.metaKey || e.ctrlKey, t = r.getSelection();
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
      if (a && e.key.toLowerCase() === "a") {
        e.preventDefault(), r.selectAll();
        return;
      }
      if (a && e.key.toLowerCase() === "d" && t.length > 0) {
        e.preventDefault(), r.duplicateNodes(t);
        return;
      }
      if (a && e.key.toLowerCase() === "c" && t.length > 0) {
        e.preventDefault(), r.copySelected();
        return;
      }
      if (a && e.key.toLowerCase() === "v") {
        e.preventDefault(), r.pasteClipboard();
        return;
      }
      if (a && e.key === "0") {
        e.preventDefault(), r.zoomTo(1, !0);
        return;
      }
      if (a && e.key === "1") {
        e.preventDefault(), r.zoomToFit(40, !0);
        return;
      }
      if (a && e.key.toLowerCase() === "z") {
        const u = e.shiftKey ? r.redo : r.undo;
        u && (e.preventDefault(), u.call(r));
        return;
      }
      if (a && e.key.toLowerCase() === "y") {
        const u = r.redo;
        u && (e.preventDefault(), u.call(r));
        return;
      }
      if (t.length > 0 && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const u = e.shiftKey ? l.value.grid.size * l.value.grid.majorEvery : l.value.grid.size, m = e.key === "ArrowLeft" ? { x: -u, y: 0 } : e.key === "ArrowRight" ? { x: u, y: 0 } : e.key === "ArrowUp" ? { x: 0, y: -u } : { x: 0, y: u };
        for (const X of t)
          r.moveNode(X, m.x, m.y);
      }
    }
    function we(e) {
      e.code === "Space" && (f.value = !1);
    }
    function F(e) {
      return z.value[e.type] ?? s.fallbackRenderer;
    }
    function ke(e) {
      return !!F(e) || !!k[`node:${e.type}`] || !!k.node;
    }
    let T = null;
    return Ie(() => {
      M(), i.value && typeof ResizeObserver < "u" ? (T = new ResizeObserver(M), T.observe(i.value)) : window.addEventListener("resize", M), c("ready", r);
    }), De(() => {
      for (const e of ve)
        e();
      T ? (T.disconnect(), T = null) : window.removeEventListener("resize", M);
    }), (e, a) => (v(), g("div", {
      ref_key: "rootElement",
      ref: i,
      class: "canvas-root",
      tabindex: "0",
      onPointerdown: ge,
      onPointermove: ye,
      onPointerup: te,
      onPointercancel: te,
      onWheel: he,
      onDblclick: be,
      onKeydown: ze,
      onKeyup: we
    }, [
      N(Ae),
      N(nt, null, {
        default: A(() => [
          w(e.$slots, "viewport", {
            engine: _(r),
            snapshot: l.value
          }, void 0, !0),
          (v(!0), g($, null, q(J.value, (t) => (v(), g($, {
            key: t.id
          }, [
            t.lod === "full" ? ie([t.x, t.y, t.width, t.height, t.zIndex, t.lod, S.value.has(t.id), l.value.interaction.mode === "editing-text" && l.value.interaction.nodeId === t.id], () => (v(), se(Je, {
              key: 0,
              node: t,
              selected: S.value.has(t.id),
              editing: l.value.interaction.mode === "editing-text" && l.value.interaction.nodeId === t.id,
              "custom-renderer": ke(t)
            }, {
              default: A((u) => [
                w(e.$slots, `node:${t.type}`, R({ ref_for: !0 }, u), () => [
                  w(e.$slots, "node", R({ ref_for: !0 }, u), () => [
                    F(t) ? (v(), se(Pe(F(t)), R({
                      key: 0,
                      ref_for: !0
                    }, u), null, 16)) : D("", !0)
                  ], !0)
                ], !0)
              ]),
              handle: A((u) => [
                w(e.$slots, "handle", R({ ref_for: !0 }, u), void 0, !0)
              ]),
              _: 2
            }, 1032, ["node", "selected", "editing", "custom-renderer"])), a, 0) : ie([t.x, t.y, t.width, t.height, t.zIndex, t.lod], () => (v(), g("div", {
              key: 1,
              class: "canvas-node-simple",
              "data-node-id": t.id,
              style: P({ left: t.x + "px", top: t.y + "px", width: t.width + "px", height: t.height + "px", zIndex: t.zIndex })
            }, null, 12, ["data-node-id"])), a, 1)
          ], 64))), 128))
        ]),
        _: 3
      }),
      N(et),
      N(Ke, null, {
        default: A((t) => [
          w(e.$slots, "box-select", ce(Be(t)), void 0, !0)
        ]),
        _: 3
      }),
      w(e.$slots, "default", {
        engine: _(r),
        snapshot: l.value,
        debugState: fe.value
      }, void 0, !0)
    ], 544));
  }
}), ut = /* @__PURE__ */ I(rt, [["__scopeId", "data-v-d5303f56"]]);
export {
  Ke as CanvasBoxSelect,
  Ae as CanvasGrid,
  Je as CanvasNode,
  Fe as CanvasNodeHandle,
  ut as CanvasRoot,
  et as CanvasSnapGuides,
  nt as CanvasViewport,
  Me as useBoxSelectBounds,
  Re as useCamera,
  b as useCanvasEngine,
  Le as useGridStyle,
  Ne as useInteraction,
  dt as useNode,
  it as useNodes,
  st as useSelection,
  lt as useVisibleBounds,
  ct as useVisibleNodes
};
