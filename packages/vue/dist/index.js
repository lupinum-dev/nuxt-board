import { inject as de, defineComponent as M, useTemplateRef as ue, ref as x, computed as w, watch as j, nextTick as me, onMounted as L, onUpdated as pe, openBlock as g, createElementBlock as b, normalizeStyle as N, normalizeClass as D, withDirectives as ve, withKeys as O, withModifiers as P, vModelText as fe, toDisplayString as ge, Fragment as U, renderList as F, createElementVNode as H, createCommentVNode as W, createBlock as ye, unref as _, shallowRef as xe, provide as be, onBeforeUnmount as he, createVNode as we, renderSlot as Ee } from "vue";
import { getVisibleBounds as Se, createCanvasEngine as Ce } from "@canvas/core";
const q = /* @__PURE__ */ Symbol("canvas-engine"), C = {
  visible: !0,
  minorOpacity: 0.14,
  majorOpacity: 0.18,
  fadeEdges: !0
};
function J() {
  const r = de(q);
  if (!r)
    throw new Error("useCanvasEngine must be used under <CanvasRoot>.");
  return r;
}
const ze = ["data-node-id"], _e = ["onKeydown"], je = {
  key: 1,
  class: "canvas-node-card__content"
}, Ie = ["data-resize"], ke = /* @__PURE__ */ M({
  __name: "CanvasNodeCard",
  props: {
    node: {},
    selected: { type: Boolean },
    editing: { type: Boolean }
  },
  setup(r) {
    const o = r, { engine: l, renderStats: d } = J(), f = ue("textarea"), s = x(o.node.text), n = ["n", "ne", "e", "se", "s", "sw", "w", "nw"], a = w(() => ({
      left: `${o.node.x}px`,
      top: `${o.node.y}px`,
      width: `${o.node.width}px`,
      height: `${o.node.height}px`,
      zIndex: String(o.node.zIndex)
    }));
    j(
      () => o.editing,
      async (y) => {
        if (!y) {
          s.value = o.node.text;
          return;
        }
        await me(), f.value?.focus(), f.value?.select();
      },
      { immediate: !0 }
    ), j(
      () => o.node.text,
      (y) => {
        o.editing || (s.value = y);
      }
    );
    function c() {
      l.commitTextEdit(o.node.id, s.value);
    }
    function m() {
      s.value = o.node.text, l.endInteraction();
    }
    return L(d.incrementRenderCount), pe(d.incrementRenderCount), (y, h) => (g(), b("article", {
      class: D(["canvas-node-card", { "is-selected": r.selected, "is-editing": r.editing }]),
      style: N(a.value),
      "data-node-id": r.node.id
    }, [
      r.editing ? ve((g(), b("textarea", {
        key: 0,
        ref_key: "textarea",
        ref: f,
        "onUpdate:modelValue": h[0] || (h[0] = (p) => s.value = p),
        class: "canvas-node-card__editor",
        "data-editor": "true",
        onBlur: c,
        onKeydown: [
          O(P(c, ["meta", "prevent"]), ["enter"]),
          O(P(c, ["ctrl", "prevent"]), ["enter"]),
          O(P(m, ["prevent"]), ["esc"])
        ]
      }, null, 40, _e)), [
        [fe, s.value]
      ]) : (g(), b("div", je, ge(r.node.text || "Double-click to edit"), 1)),
      r.selected && !r.editing ? (g(), b(U, { key: 2 }, F(n, (p) => H("div", {
        key: p,
        class: D(["canvas-node-card__handle", `is-${p}`]),
        "data-resize": p
      }, null, 10, Ie)), 64)) : W("", !0)
    ], 14, ze));
  }
}), B = (r, o) => {
  const l = r.__vccOpts || r;
  for (const [d, f] of o)
    l[d] = f;
  return l;
}, $e = /* @__PURE__ */ B(ke, [["__scopeId", "data-v-d7d22ae7"]]), Oe = /* @__PURE__ */ M({
  __name: "CanvasViewport",
  props: {
    cullMargin: { default: 200 }
  },
  setup(r) {
    const o = r, { snapshot: l, viewportSize: d, renderStats: f } = J(), s = w(() => ({
      transform: `scale(${l.value.camera.z}) translate(${l.value.camera.x}px, ${l.value.camera.y}px)`
    })), n = w(() => {
      const a = Se(d.value.x, d.value.y, l.value.camera);
      return l.value.nodes.filter((c) => c.x + c.width > a.minX - o.cullMargin && c.x < a.maxX + o.cullMargin && c.y + c.height > a.minY - o.cullMargin && c.y < a.maxY + o.cullMargin);
    });
    return j(
      n,
      (a) => {
        f.setVisibleNodeCount(a.length);
      },
      { immediate: !0 }
    ), (a, c) => (g(), b("div", {
      class: "canvas-viewport",
      style: N(s.value)
    }, [
      (g(!0), b(U, null, F(n.value, (m) => (g(), ye($e, {
        key: m.id,
        node: m,
        selected: _(l).selection.includes(m.id),
        editing: _(l).interaction.mode === "editing-text" && _(l).interaction.nodeId === m.id
      }, null, 8, ["node", "selected", "editing"]))), 128))
    ], 4));
  }
}), Pe = /* @__PURE__ */ B(Oe, [["__scopeId", "data-v-3a489015"]]), De = ["data-grid-visible", "data-grid-minor", "data-grid-major"], Me = /* @__PURE__ */ M({
  __name: "CanvasRoot",
  props: {
    engine: {
      type: Object,
      default: void 0
    },
    debug: {
      type: Boolean,
      default: !1
    },
    cullMargin: {
      type: Number,
      default: 200
    },
    grid: {
      type: [Boolean, Object],
      default: !0
    }
  },
  emits: ["ready"],
  setup(r, { expose: o, emit: l }) {
    const d = r, f = l, s = x(null), n = d.engine ?? Ce(), a = xe(n.getSnapshot()), c = x({ x: 0, y: 0 }), m = x(0), y = x(0), h = x(null), p = x(null), I = x([]), T = {
      visibleNodeCount: m,
      renderCount: y,
      lastPerformanceSample: h,
      lastInvariantFailure: p,
      incrementRenderCount() {
        y.value += 1;
      },
      setVisibleNodeCount(e) {
        m.value = e;
      },
      consumeEvent(e) {
        e.type === "performance:sample" && (h.value = e), e.type === "invariant:failed" && (p.value = e);
      }
    };
    be(q, {
      engine: n,
      snapshot: a,
      viewportSize: c,
      renderStats: T
    });
    const Q = n.subscribe((e) => {
      T.consumeEvent(e), e.type === "state:changed" && (a.value = e.snapshot), I.value = [...I.value.slice(-19), e];
    }), R = w(() => ({
      camera: a.value.camera,
      grid: a.value.grid,
      selection: a.value.selection,
      interaction: a.value.interaction,
      visibleNodeCount: m.value,
      renderCount: y.value,
      lastPerformanceSample: h.value?.type === "performance:sample" ? h.value.sample : null,
      lastInvariantFailure: p.value?.type === "invariant:failed" ? p.value.failure.message : null,
      recentEvents: I.value
    }));
    function z(e, t) {
      return (e % t + t) % t;
    }
    function Z(e, t) {
      if (e === !1)
        return {
          ...C,
          visible: !1,
          size: t.size,
          majorEvery: t.majorEvery,
          snap: t.snap
        };
      const i = e === !0 ? {} : e;
      return {
        visible: i.visible ?? C.visible,
        size: i.size ?? t.size,
        majorEvery: i.majorEvery ?? t.majorEvery,
        snap: i.snap ?? t.snap,
        minorOpacity: i.minorOpacity ?? C.minorOpacity,
        majorOpacity: i.majorOpacity ?? C.majorOpacity,
        fadeEdges: i.fadeEdges ?? C.fadeEdges
      };
    }
    const v = w(() => Z(d.grid, a.value.grid)), k = w(() => {
      const e = a.value.camera.z, t = v.value.size, i = v.value.size * v.value.majorEvery, u = t * e, E = i * e, A = a.value.camera.x * e, K = a.value.camera.y * e, le = u < 6 ? 0 : u < 12 ? v.value.minorOpacity * 0.57 : v.value.minorOpacity, ce = E < 8 ? v.value.majorOpacity * 0.44 : v.value.majorOpacity;
      return {
        "--grid-minor-size": `${u}px`,
        "--grid-major-size": `${E}px`,
        "--grid-minor-x": `${z(A, u)}px`,
        "--grid-minor-y": `${z(K, u)}px`,
        "--grid-major-x": `${z(A, E)}px`,
        "--grid-major-y": `${z(K, E)}px`,
        "--grid-minor-color": `rgba(148, 163, 184, ${le})`,
        "--grid-major-color": `rgba(71, 85, 105, ${ce})`,
        "--grid-mask-image": v.value.fadeEdges ? "radial-gradient(circle at center, black 65%, transparent 100%)" : "none"
      };
    }), G = w(() => ({
      "is-panning": a.value.interaction.mode === "panning"
    }));
    j(
      () => d.grid,
      (e) => {
        if (e && typeof e == "object") {
          const t = {};
          e.size !== void 0 && (t.size = e.size), e.majorEvery !== void 0 && (t.majorEvery = e.majorEvery), e.snap !== void 0 && (t.snap = e.snap), Object.keys(t).length > 0 && n.updateGridSettings(t);
        }
      },
      { immediate: !0, deep: !0 }
    );
    function $() {
      const e = s.value;
      if (!e)
        return;
      const t = e.getBoundingClientRect();
      c.value = { x: t.width, y: t.height };
    }
    function S(e, t) {
      const i = s.value?.getBoundingClientRect();
      return {
        x: e - (i?.left ?? 0),
        y: t - (i?.top ?? 0)
      };
    }
    function V(e) {
      if (e instanceof HTMLElement)
        return e.closest("[data-node-id]")?.dataset.nodeId;
    }
    function Y(e) {
      if (e instanceof HTMLElement)
        return e.closest("[data-resize]")?.dataset.resize;
    }
    function ee(e) {
      return e instanceof HTMLElement && !!e.closest('[data-editor="true"]');
    }
    function te(e) {
      if (ee(e.target))
        return;
      if (e.button === 1) {
        e.preventDefault(), n.beginPan(e.pointerId, S(e.clientX, e.clientY)), s.value?.setPointerCapture(e.pointerId), s.value?.focus();
        return;
      }
      if (e.button !== 0)
        return;
      const t = S(e.clientX, e.clientY), i = V(e.target), u = Y(e.target);
      u && i ? n.beginResize(i, u, e.pointerId, t) : i ? n.beginNodeDrag(i, e.pointerId, t) : (n.clearSelection(), n.beginPan(e.pointerId, t)), s.value?.setPointerCapture(e.pointerId), s.value?.focus();
    }
    function ne(e) {
      e.button === 1 && e.preventDefault();
    }
    function ae(e) {
      e.button === 1 && e.preventDefault();
    }
    function oe(e) {
      n.updatePointer(e.pointerId, S(e.clientX, e.clientY));
    }
    function X(e) {
      n.endInteraction(e.pointerId), s.value?.hasPointerCapture(e.pointerId) && s.value.releasePointerCapture(e.pointerId);
    }
    function ie(e) {
      e.preventDefault();
      const t = S(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        const i = Math.max(-10, Math.min(10, e.deltaY));
        n.zoomAtScreenPoint(t, i);
      } else
        n.panByScreenDelta(e.deltaX, e.deltaY);
    }
    function re(e) {
      if (Y(e.target))
        return;
      const t = V(e.target);
      if (t) {
        n.beginTextEdit(t);
        return;
      }
      const i = S(e.clientX, e.clientY), u = n.screenToWorld(i), E = n.createNode({
        x: u.x,
        y: u.y,
        text: "New card"
      });
      n.beginTextEdit(E.id);
    }
    function se(e) {
      if (a.value.interaction.mode !== "editing-text") {
        if (e.key === "Escape") {
          n.clearSelection(), n.endInteraction();
          return;
        }
        (e.key === "Backspace" || e.key === "Delete") && a.value.selection.length > 0 && (e.preventDefault(), n.deleteSelected());
      }
    }
    return L(() => {
      $(), window.addEventListener("resize", $), f("ready", n);
    }), he(() => {
      Q(), window.removeEventListener("resize", $);
    }), o({
      engine: n,
      debugState: R
    }), (e, t) => (g(), b("div", {
      ref_key: "root",
      ref: s,
      class: D(["canvas-root", G.value]),
      "data-grid-visible": v.value.visible ? "true" : "false",
      "data-grid-minor": k.value["--grid-minor-size"],
      "data-grid-major": k.value["--grid-major-size"],
      tabindex: "0",
      onMousedown: ne,
      onAuxclick: ae,
      onPointerdown: te,
      onPointermove: oe,
      onPointerup: X,
      onPointercancel: X,
      onWheel: ie,
      onDblclick: re,
      onKeydown: se
    }, [
      t[0] || (t[0] = H("div", { class: "canvas-root__backdrop" }, null, -1)),
      v.value.visible ? (g(), b("div", {
        key: 0,
        class: "canvas-root__grid",
        style: N(k.value)
      }, null, 4)) : W("", !0),
      we(Pe, { "cull-margin": r.cullMargin }, null, 8, ["cull-margin"]),
      Ee(e.$slots, "default", {
        engine: _(n),
        snapshot: a.value,
        debugState: R.value
      }, void 0, !0)
    ], 42, De));
  }
}), Te = /* @__PURE__ */ B(Me, [["__scopeId", "data-v-e7c5684c"]]);
export {
  $e as CanvasNodeCard,
  Te as CanvasRoot,
  Pe as CanvasViewport,
  J as useCanvasEngine
};
