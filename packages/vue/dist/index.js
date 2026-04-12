import { computed as d, inject as fe, defineComponent as C, unref as E, renderSlot as b, openBlock as f, createElementBlock as x, normalizeStyle as M, createCommentVNode as T, normalizeClass as Z, useSlots as ee, ref as D, watch as R, normalizeProps as te, guardReactiveProps as ne, withDirectives as ge, withKeys as X, withModifiers as K, vModelText as ve, Fragment as O, createTextVNode as G, toDisplayString as q, renderList as re, createVNode as L, shallowRef as J, provide as ye, markRaw as xe, onMounted as he, onBeforeUnmount as be, withCtx as B, createBlock as Q, mergeProps as N, resolveDynamicComponent as ze } from "vue";
import { getBoundsFromPoints as je, getVisibleBounds as oe, createCanvasEngine as we } from "@canvas/core";
const ae = /* @__PURE__ */ Symbol("canvas-engine"), I = {
  visible: !0,
  pattern: "line",
  minorOpacity: 0.14,
  majorOpacity: 0.18,
  fadeEdges: !0
};
function z() {
  const n = fe(ae);
  if (!n)
    throw new Error("Canvas composables must be used under <CanvasRoot>.");
  return n;
}
function ke() {
  const { snapshot: n } = z();
  return d(() => n.value.camera);
}
function He() {
  const { snapshot: n } = z();
  return d(() => n.value.nodes);
}
function Ue() {
  const { snapshot: n } = z();
  return d(() => n.value.selection);
}
function Ee() {
  const { snapshot: n } = z();
  return d(() => n.value.interaction);
}
function We() {
  const { snapshot: n, viewportSize: t } = z();
  return d(() => oe(t.value.x, t.value.y, n.value.camera));
}
function Fe(n = 200) {
  const { snapshot: t, viewportSize: s } = z();
  return d(() => {
    const c = oe(s.value.x, s.value.y, t.value.camera);
    return t.value.nodes.filter((i) => i.visible ? i.x + i.width > c.minX - n && i.x < c.maxX + n && i.y + i.height > c.minY - n && i.y < c.maxY + n : !1);
  });
}
function Se() {
  const { snapshot: n, resolvedGrid: t } = z();
  function s(c, i) {
    return (c % i + i) % i;
  }
  return d(() => {
    const c = n.value.camera.z, i = t.value.size, m = t.value.size * t.value.majorEvery, g = i * c, r = m * c, l = n.value.camera.x * c, p = n.value.camera.y * c, v = g < 6 ? 0 : g < 12 ? t.value.minorOpacity * 0.57 : t.value.minorOpacity, j = r < 8 ? t.value.majorOpacity * 0.44 : t.value.majorOpacity;
    return {
      "--grid-minor-size": `${g}px`,
      "--grid-major-size": `${r}px`,
      "--grid-minor-x": `${s(l, g)}px`,
      "--grid-minor-y": `${s(p, g)}px`,
      "--grid-major-x": `${s(l, r)}px`,
      "--grid-major-y": `${s(p, r)}px`,
      "--grid-minor-color": `rgba(148, 163, 184, ${v})`,
      "--grid-major-color": `rgba(71, 85, 105, ${j})`,
      "--grid-mask-image": t.value.fadeEdges ? "radial-gradient(circle at center, black 68%, transparent 100%)" : "none"
    };
  });
}
function Ge(n) {
  const { engine: t, snapshot: s, toLocalPoint: c } = z(), i = d(() => {
    const p = s.value.nodes.find((v) => v.id === n);
    if (!p)
      throw new Error(`Node "${n}" is not present in the current snapshot.`);
    return p;
  }), m = d(() => s.value.selection.includes(n)), g = d(
    () => s.value.interaction.mode === "editing-text" && s.value.interaction.nodeId === n
  ), r = d(() => i.value.locked), l = d(() => ({
    left: `${i.value.x}px`,
    top: `${i.value.y}px`,
    width: `${i.value.width}px`,
    height: `${i.value.height}px`,
    zIndex: String(i.value.zIndex)
  }));
  return {
    node: i,
    selected: m,
    editing: g,
    locked: r,
    style: l,
    beginEdit: () => t.beginTextEdit(n),
    commitText: (p) => t.commitTextEdit(n, p),
    startDrag: (p) => t.beginNodeDrag(n, p.pointerId, c(p.clientX, p.clientY)),
    startResize: (p, v) => t.beginResize(n, p, v.pointerId, c(v.clientX, v.clientY))
  };
}
function Ce() {
  const n = Ee();
  return d(() => n.value.mode !== "box-select" ? null : je(n.value.startScreenPoint, n.value.currentScreenPoint));
}
const $e = /* @__PURE__ */ C({
  __name: "CanvasBoxSelect",
  setup(n) {
    const t = Ce(), s = d(() => t.value ? {
      left: `${t.value.minX}px`,
      top: `${t.value.minY}px`,
      width: `${t.value.maxX - t.value.minX}px`,
      height: `${t.value.maxY - t.value.minY}px`
    } : {});
    return (c, i) => E(t) ? b(c.$slots, "default", {
      key: 0,
      bounds: E(t)
    }, () => [
      E(t) ? (f(), x("div", {
        key: 0,
        class: "canvas-box-select",
        style: M(s.value)
      }, null, 4)) : T("", !0)
    ], !0) : T("", !0);
  }
}), $ = (n, t) => {
  const s = n.__vccOpts || n;
  for (const [c, i] of t)
    s[c] = i;
  return s;
}, _e = /* @__PURE__ */ $($e, [["__scopeId", "data-v-2ca667dd"]]), Ie = /* @__PURE__ */ C({
  __name: "CanvasGrid",
  setup(n) {
    const { resolvedGrid: t } = z(), s = Se(), c = d(() => {
      switch (t.value.pattern) {
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
    }), i = d(() => t.value.pattern === "dot" ? [
      "var(--grid-major-size) var(--grid-major-size)",
      "var(--grid-minor-size) var(--grid-minor-size)"
    ].join(", ") : [
      "var(--grid-minor-size) var(--grid-minor-size)",
      "var(--grid-minor-size) var(--grid-minor-size)",
      "var(--grid-major-size) var(--grid-major-size)",
      "var(--grid-major-size) var(--grid-major-size)"
    ].join(", ")), m = d(() => t.value.pattern === "dot" ? [
      "var(--grid-major-x) var(--grid-major-y)",
      "var(--grid-minor-x) var(--grid-minor-y)"
    ].join(", ") : [
      "var(--grid-minor-x) var(--grid-minor-y)",
      "var(--grid-minor-x) var(--grid-minor-y)",
      "var(--grid-major-x) var(--grid-major-y)",
      "var(--grid-major-x) var(--grid-major-y)"
    ].join(", "));
    return (g, r) => E(t).visible && E(t).pattern !== "none" ? (f(), x("div", {
      key: 0,
      class: "canvas-grid",
      style: M({
        ...E(s),
        backgroundImage: c.value,
        backgroundSize: i.value,
        backgroundPosition: m.value
      })
    }, null, 4)) : T("", !0);
  }
}), De = /* @__PURE__ */ $(Ie, [["__scopeId", "data-v-5c13b009"]]), Te = ["data-resize"], Pe = /* @__PURE__ */ C({
  __name: "CanvasNodeHandle",
  props: {
    handle: {}
  },
  setup(n) {
    return (t, s) => (f(), x("div", {
      class: Z(["canvas-node-handle", `is-${n.handle}`]),
      "data-resize": n.handle
    }, null, 10, Te));
  }
}), Be = /* @__PURE__ */ $(Pe, [["__scopeId", "data-v-e9964eeb"]]), Ne = ["data-node-id"], Oe = ["onKeydown"], Le = {
  key: 1,
  class: "canvas-node__content"
}, Re = /* @__PURE__ */ C({
  __name: "CanvasNode",
  props: {
    node: {},
    selected: { type: Boolean },
    editing: { type: Boolean }
  },
  setup(n) {
    const t = n, s = ee(), { engine: c } = z(), i = ["n", "ne", "e", "se", "s", "sw", "w", "nw"], m = D(j(t.node)), g = d(() => ({
      left: `${t.node.x}px`,
      top: `${t.node.y}px`,
      width: `${t.node.width}px`,
      height: `${t.node.height}px`,
      zIndex: String(t.node.zIndex)
    })), r = d(() => ({
      node: t.node,
      selected: t.selected,
      editing: t.editing,
      beginEdit: () => c.beginTextEdit(t.node.id),
      commitText: (y) => c.commitTextEdit(t.node.id, y)
    })), l = d(() => !!s.default);
    R(
      () => t.node,
      (y) => {
        m.value = j(y);
      },
      { deep: !0 }
    ), R(
      () => t.editing,
      (y) => {
        y || (m.value = j(t.node));
      }
    );
    function p() {
      c.commitTextEdit(t.node.id, m.value);
    }
    function v() {
      m.value = j(t.node), c.endInteraction();
    }
    function j(y) {
      if (y.type !== "text")
        return "";
      const k = y.data?.content;
      return typeof k == "string" ? k : "";
    }
    return (y, k) => (f(), x("article", {
      class: Z(["canvas-node", { "is-selected": n.selected, "is-editing": n.editing, "is-locked": n.node.locked }]),
      style: M(g.value),
      "data-node-id": n.node.id
    }, [
      b(y.$slots, "default", te(ne(r.value)), () => [
        n.editing && !l.value && n.node.type === "text" ? ge((f(), x("textarea", {
          key: 0,
          "onUpdate:modelValue": k[0] || (k[0] = (S) => m.value = S),
          class: "canvas-node__editor",
          "data-editor": "true",
          onBlur: p,
          onKeydown: [
            X(K(p, ["meta", "prevent"]), ["enter"]),
            X(K(p, ["ctrl", "prevent"]), ["enter"]),
            X(K(v, ["prevent"]), ["esc"])
          ]
        }, null, 40, Oe)), [
          [ve, m.value]
        ]) : (f(), x("div", Le, [
          n.node.type === "text" ? (f(), x(O, { key: 0 }, [
            G(q(j(n.node) || "Double-click to edit"), 1)
          ], 64)) : (f(), x(O, { key: 1 }, [
            G(q(n.node.type), 1)
          ], 64))
        ]))
      ], !0),
      n.selected && !n.editing && !n.node.locked ? (f(), x(O, { key: 0 }, re(i, (S) => b(y.$slots, "handle", {
        key: S,
        node: n.node,
        handle: S
      }, () => [
        L(Be, { handle: S }, null, 8, ["handle"])
      ], !0)), 64)) : T("", !0)
    ], 14, Ne));
  }
}), Me = /* @__PURE__ */ $(Re, [["__scopeId", "data-v-3f2792a7"]]), Ye = /* @__PURE__ */ C({
  __name: "CanvasViewport",
  setup(n) {
    const t = ke(), s = d(() => ({
      transform: `scale(${t.value.z}) translate(${t.value.x}px, ${t.value.y}px)`
    }));
    return (c, i) => (f(), x("div", {
      class: "canvas-viewport",
      style: M(s.value)
    }, [
      b(c.$slots, "default", {}, void 0, !0)
    ], 4));
  }
}), Xe = /* @__PURE__ */ $(Ye, [["__scopeId", "data-v-53cada3d"]]), Ke = /* @__PURE__ */ C({
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
  setup(n, { emit: t }) {
    const s = n, c = t, i = D(null), m = D({ x: 0, y: 0 }), g = D(0), r = s.engine ?? we(), l = J(r.getSnapshot()), p = J(s.renderers);
    ee();
    const v = D(!1);
    function j(e, o) {
      if (e === !1)
        return {
          ...I,
          visible: !1,
          size: o.size,
          majorEvery: o.majorEvery,
          snap: o.snap,
          pattern: o.pattern
        };
      const a = e === !0 ? {} : e;
      return {
        visible: a.visible ?? I.visible,
        size: a.size ?? o.size,
        majorEvery: a.majorEvery ?? o.majorEvery,
        snap: a.snap ?? o.snap,
        pattern: a.pattern ?? o.pattern,
        minorOpacity: a.minorOpacity ?? I.minorOpacity,
        majorOpacity: a.majorOpacity ?? I.majorOpacity,
        fadeEdges: a.fadeEdges ?? I.fadeEdges
      };
    }
    const y = d(() => j(s.grid, l.value.grid));
    ye(ae, {
      engine: r,
      snapshot: l,
      rootElement: i,
      viewportSize: m,
      renderers: p,
      resolvedGrid: y,
      renderCount: g,
      toLocalPoint: _
    });
    const k = d(() => {
      const e = r.getVisibleBounds(m.value.x, m.value.y);
      return l.value.nodes.filter((o) => o.visible ? o.x + o.width > e.minX - s.cullMargin && o.x < e.maxX + s.cullMargin && o.y + o.height > e.minY - s.cullMargin && o.y < e.maxY + s.cullMargin : !1);
    }), S = d(() => ({
      snapshot: l.value,
      camera: l.value.camera,
      grid: l.value.grid,
      selection: l.value.selection,
      interaction: l.value.interaction,
      visibleNodeCount: k.value.length,
      renderCount: g.value,
      trace: r.exportTrace().slice(-20)
    }));
    function h() {
      l.value = r.getSnapshot();
    }
    const ie = [
      r.on("camera:change", h),
      r.on("node:created", h),
      r.on("node:updated", h),
      r.on("node:deleted", h),
      r.on("node:moved", h),
      r.on("node:resized", h),
      r.on("selection:change", h),
      r.on("interaction:start", h),
      r.on("interaction:update", h),
      r.on("interaction:end", h),
      r.on("command:after", h)
    ];
    R(
      () => s.renderers,
      (e) => {
        p.value = Object.fromEntries(
          Object.entries(e).map(([o, a]) => [o, xe(a)])
        );
      },
      { immediate: !0, deep: !0 }
    ), R(
      () => s.grid,
      (e) => {
        if (e && typeof e == "object") {
          const o = {};
          e.size !== void 0 && (o.size = e.size), e.majorEvery !== void 0 && (o.majorEvery = e.majorEvery), e.snap !== void 0 && (o.snap = e.snap), e.pattern !== void 0 && (o.pattern = e.pattern), Object.keys(o).length > 0 && r.updateGridSettings(o);
        }
      },
      { immediate: !0, deep: !0 }
    );
    function Y() {
      const e = i.value?.getBoundingClientRect();
      m.value = {
        x: e?.width ?? 0,
        y: e?.height ?? 0
      }, r.setViewportSize(m.value);
    }
    function _(e, o) {
      const a = i.value?.getBoundingClientRect();
      return {
        x: e - (a?.left ?? 0),
        y: o - (a?.top ?? 0)
      };
    }
    function V(e) {
      return e instanceof HTMLElement ? e.closest("[data-node-id]")?.dataset.nodeId : void 0;
    }
    function A(e) {
      return e instanceof HTMLElement ? e.closest("[data-resize]")?.dataset.resize : void 0;
    }
    function H(e) {
      return e instanceof HTMLElement && !!e.closest('[data-editor="true"]');
    }
    function P(e, o, a, u) {
      const w = _(e.clientX, e.clientY);
      o === "pan" ? r.beginPan(e.pointerId, w) : o === "drag" && a ? r.beginNodeDrag(a, e.pointerId, w) : o === "resize" && a && u ? r.beginResize(a, u, e.pointerId, w) : r.beginBoxSelect(e.pointerId, w), i.value?.setPointerCapture(e.pointerId), i.value?.focus();
    }
    function se(e) {
      if (H(e.target))
        return;
      if (e.button === 1 || v.value) {
        e.preventDefault(), P(e, "pan");
        return;
      }
      if (e.button !== 0)
        return;
      const o = V(e.target), a = A(e.target);
      if (a && o) {
        P(e, "resize", o, a);
        return;
      }
      if (o) {
        P(e, "drag", o);
        return;
      }
      P(e, "box-select");
    }
    function ce(e) {
      r.updatePointer(e.pointerId, _(e.clientX, e.clientY));
    }
    function U(e) {
      r.endInteraction(e.pointerId), i.value?.hasPointerCapture(e.pointerId) && i.value.releasePointerCapture(e.pointerId);
    }
    function le(e) {
      e.preventDefault();
      const o = _(e.clientX, e.clientY);
      e.ctrlKey || e.metaKey ? r.zoomAt(o, Math.max(-10, Math.min(10, e.deltaY))) : r.panBy(e.deltaX, e.deltaY);
    }
    function de(e) {
      if (H(e.target) || A(e.target))
        return;
      const o = V(e.target);
      if (o) {
        r.beginTextEdit(o);
        return;
      }
      const a = _(e.clientX, e.clientY), u = r.screenToWorld(a), w = r.createNode({
        type: "text",
        x: u.x,
        y: u.y,
        data: { content: "New node" }
      });
      r.beginTextEdit(w.id);
    }
    function W(e) {
      const o = e.target;
      return o instanceof HTMLTextAreaElement || o instanceof HTMLElement && o.isContentEditable;
    }
    function ue(e) {
      if (e.code === "Space" && !W(e) && (e.preventDefault(), v.value = !0), W(e))
        return;
      const o = e.metaKey || e.ctrlKey, a = r.getSelection();
      if (e.key === "Escape") {
        r.clearSelection(), r.endInteraction();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        a.length > 0 && (e.preventDefault(), r.deleteSelected());
        return;
      }
      if (e.key === "Enter" && a.length === 1) {
        r.beginTextEdit(a[0]);
        return;
      }
      if (o && e.key.toLowerCase() === "a") {
        e.preventDefault(), r.selectAll();
        return;
      }
      if (o && e.key.toLowerCase() === "d" && a.length > 0) {
        e.preventDefault(), r.duplicateNodes(a);
        return;
      }
      if (o && e.key.toLowerCase() === "c" && a.length > 0) {
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
        const u = e.shiftKey ? r.redo : r.undo;
        u && (e.preventDefault(), u.call(r));
        return;
      }
      if (o && e.key.toLowerCase() === "y") {
        const u = r.redo;
        u && (e.preventDefault(), u.call(r));
        return;
      }
      if (a.length > 0 && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const u = e.shiftKey ? l.value.grid.size * l.value.grid.majorEvery : l.value.grid.size, w = e.key === "ArrowLeft" ? { x: -u, y: 0 } : e.key === "ArrowRight" ? { x: u, y: 0 } : e.key === "ArrowUp" ? { x: 0, y: -u } : { x: 0, y: u };
        for (const me of a)
          r.moveNode(me, w.x, w.y);
      }
    }
    function pe(e) {
      e.code === "Space" && (v.value = !1);
    }
    function F(e) {
      return p.value[e.type] ?? s.fallbackRenderer;
    }
    return he(() => {
      Y(), window.addEventListener("resize", Y), c("ready", r);
    }), be(() => {
      for (const e of ie)
        e();
      window.removeEventListener("resize", Y);
    }), (e, o) => (f(), x("div", {
      ref_key: "rootElement",
      ref: i,
      class: "canvas-root",
      tabindex: "0",
      onPointerdown: se,
      onPointermove: ce,
      onPointerup: U,
      onPointercancel: U,
      onWheel: le,
      onDblclick: de,
      onKeydown: ue,
      onKeyup: pe
    }, [
      L(De),
      L(Xe, null, {
        default: B(() => [
          b(e.$slots, "viewport", {
            engine: E(r),
            snapshot: l.value
          }, void 0, !0),
          (f(!0), x(O, null, re(k.value, (a) => (f(), Q(Me, {
            key: a.id,
            node: a,
            selected: l.value.selection.includes(a.id),
            editing: l.value.interaction.mode === "editing-text" && l.value.interaction.nodeId === a.id
          }, {
            default: B((u) => [
              b(e.$slots, `node:${a.type}`, N({ ref_for: !0 }, u), () => [
                b(e.$slots, "node", N({ ref_for: !0 }, u), () => [
                  F(a) ? (f(), Q(ze(F(a)), N({
                    key: 0,
                    ref_for: !0
                  }, u), null, 16)) : T("", !0)
                ], !0)
              ], !0)
            ]),
            handle: B((u) => [
              b(e.$slots, "handle", N({ ref_for: !0 }, u), void 0, !0)
            ]),
            _: 2
          }, 1032, ["node", "selected", "editing"]))), 128))
        ]),
        _: 3
      }),
      L(_e, null, {
        default: B((a) => [
          b(e.$slots, "box-select", te(ne(a)), void 0, !0)
        ]),
        _: 3
      }),
      b(e.$slots, "default", {
        engine: E(r),
        snapshot: l.value,
        debugState: S.value
      }, void 0, !0)
    ], 544));
  }
}), qe = /* @__PURE__ */ $(Ke, [["__scopeId", "data-v-a1b42e1c"]]);
export {
  _e as CanvasBoxSelect,
  De as CanvasGrid,
  Me as CanvasNode,
  Be as CanvasNodeHandle,
  qe as CanvasRoot,
  Xe as CanvasViewport,
  Ce as useBoxSelectBounds,
  ke as useCamera,
  z as useCanvasEngine,
  Se as useGridStyle,
  Ee as useInteraction,
  Ge as useNode,
  He as useNodes,
  Ue as useSelection,
  We as useVisibleBounds,
  Fe as useVisibleNodes
};
