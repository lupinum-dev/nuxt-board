import { inject as ie, defineComponent as R, useTemplateRef as re, ref as x, computed as b, watch as D, nextTick as ce, onMounted as W, onUpdated as le, openBlock as y, createElementBlock as S, normalizeStyle as T, normalizeClass as N, withDirectives as se, withKeys as P, withModifiers as $, vModelText as de, toDisplayString as ue, Fragment as F, renderList as H, createElementVNode as B, createCommentVNode as me, createBlock as pe, unref as k, shallowRef as fe, provide as ge, onBeforeUnmount as ve, createVNode as xe, renderSlot as ye } from "vue";
import { getVisibleBounds as he, createCanvasEngine as we } from "@canvas/core";
const U = /* @__PURE__ */ Symbol("canvas-engine");
function A() {
  const i = ie(U);
  if (!i)
    throw new Error("useCanvasEngine must be used under <CanvasRoot>.");
  return i;
}
const Se = ["data-node-id"], Ce = ["onKeydown"], be = {
  key: 1,
  class: "canvas-node-card__content"
}, _e = ["data-resize"], Ie = /* @__PURE__ */ R({
  __name: "CanvasNodeCard",
  props: {
    node: {},
    selected: { type: Boolean },
    editing: { type: Boolean }
  },
  setup(i) {
    const a = i, { engine: c, renderStats: p } = A(), f = re("textarea"), r = x(a.node.text), t = ["n", "ne", "e", "se", "s", "sw", "w", "nw"], o = b(() => ({
      left: `${a.node.x}px`,
      top: `${a.node.y}px`,
      width: `${a.node.width}px`,
      height: `${a.node.height}px`,
      zIndex: String(a.node.zIndex)
    }));
    D(
      () => a.editing,
      async (g) => {
        if (!g) {
          r.value = a.node.text;
          return;
        }
        await ce(), f.value?.focus(), f.value?.select();
      },
      { immediate: !0 }
    ), D(
      () => a.node.text,
      (g) => {
        a.editing || (r.value = g);
      }
    );
    function s() {
      c.commitTextEdit(a.node.id, r.value);
    }
    function u() {
      r.value = a.node.text, c.endInteraction();
    }
    return W(p.incrementRenderCount), le(p.incrementRenderCount), (g, h) => (y(), S("article", {
      class: N(["canvas-node-card", { "is-selected": i.selected, "is-editing": i.editing }]),
      style: T(o.value),
      "data-node-id": i.node.id
    }, [
      i.editing ? se((y(), S("textarea", {
        key: 0,
        ref_key: "textarea",
        ref: f,
        "onUpdate:modelValue": h[0] || (h[0] = (m) => r.value = m),
        class: "canvas-node-card__editor",
        "data-editor": "true",
        onBlur: s,
        onKeydown: [
          P($(s, ["meta", "prevent"]), ["enter"]),
          P($(s, ["ctrl", "prevent"]), ["enter"]),
          P($(u, ["prevent"]), ["esc"])
        ]
      }, null, 40, Ce)), [
        [de, r.value]
      ]) : (y(), S("div", be, ue(i.node.text || "Double-click to edit"), 1)),
      i.selected && !i.editing ? (y(), S(F, { key: 2 }, H(t, (m) => B("div", {
        key: m,
        class: N(["canvas-node-card__handle", `is-${m}`]),
        "data-resize": m
      }, null, 10, _e)), 64)) : me("", !0)
    ], 14, Se));
  }
}), V = (i, a) => {
  const c = i.__vccOpts || i;
  for (const [p, f] of a)
    c[p] = f;
  return c;
}, ke = /* @__PURE__ */ V(Ie, [["__scopeId", "data-v-d7d22ae7"]]), ze = /* @__PURE__ */ R({
  __name: "CanvasViewport",
  props: {
    cullMargin: { default: 200 }
  },
  setup(i) {
    const a = i, { snapshot: c, viewportSize: p, renderStats: f } = A(), r = b(() => ({
      transform: `scale(${c.value.camera.z}) translate(${c.value.camera.x}px, ${c.value.camera.y}px)`
    })), t = b(() => {
      const o = he(p.value.x, p.value.y, c.value.camera);
      return c.value.nodes.filter((s) => s.x + s.width > o.minX - a.cullMargin && s.x < o.maxX + a.cullMargin && s.y + s.height > o.minY - a.cullMargin && s.y < o.maxY + a.cullMargin);
    });
    return D(
      t,
      (o) => {
        f.setVisibleNodeCount(o.length);
      },
      { immediate: !0 }
    ), (o, s) => (y(), S("div", {
      class: "canvas-viewport",
      style: T(r.value)
    }, [
      (y(!0), S(F, null, H(t.value, (u) => (y(), pe(ke, {
        key: u.id,
        node: u,
        selected: k(c).selection.includes(u.id),
        editing: k(c).interaction.mode === "editing-text" && k(c).interaction.nodeId === u.id
      }, null, 8, ["node", "selected", "editing"]))), 128))
    ], 4));
  }
}), Ee = /* @__PURE__ */ V(ze, [["__scopeId", "data-v-3a489015"]]), Me = ["data-grid-minor", "data-grid-major"], Pe = /* @__PURE__ */ R({
  __name: "CanvasRoot",
  props: {
    engine: { default: void 0 },
    debug: { type: Boolean, default: !1 },
    cullMargin: { default: 200 }
  },
  emits: ["ready"],
  setup(i, { expose: a, emit: c }) {
    const p = i, f = c, r = x(null), t = p.engine ?? we(), o = fe(t.getSnapshot()), s = x({ x: 0, y: 0 }), u = x(0), g = x(0), h = x(null), m = x(null), z = x([]), Y = {
      visibleNodeCount: u,
      renderCount: g,
      lastPerformanceSample: h,
      lastInvariantFailure: m,
      incrementRenderCount() {
        g.value += 1;
      },
      setVisibleNodeCount(e) {
        u.value = e;
      },
      consumeEvent(e) {
        e.type === "performance:sample" && (h.value = e), e.type === "invariant:failed" && (m.value = e);
      }
    };
    ge(U, {
      engine: t,
      snapshot: o,
      viewportSize: s,
      renderStats: Y
    });
    const O = t.subscribe((e) => {
      Y.consumeEvent(e), e.type === "state:changed" && (o.value = e.snapshot), z.value = [...z.value.slice(-19), e];
    }), j = b(() => ({
      camera: o.value.camera,
      selection: o.value.selection,
      interaction: o.value.interaction,
      visibleNodeCount: u.value,
      renderCount: g.value,
      lastPerformanceSample: h.value?.type === "performance:sample" ? h.value.sample : null,
      lastInvariantFailure: m.value?.type === "invariant:failed" ? m.value.failure.message : null,
      recentEvents: z.value
    }));
    function I(e, n) {
      return (e % n + n) % n;
    }
    function q(e) {
      const l = 32 / Math.max(e, 1e-4), d = Math.floor(Math.log10(l)), v = Math.pow(10, d), C = l / v;
      let w = 1;
      return C > 5 ? w = 10 : C > 2 ? w = 5 : C > 1 && (w = 2), w * v;
    }
    const E = b(() => {
      const e = o.value.camera.z, n = q(e), l = n * 5, d = n * e, v = l * e, C = o.value.camera.x * e, w = o.value.camera.y * e;
      return {
        "--grid-minor-size": `${d}px`,
        "--grid-major-size": `${v}px`,
        "--grid-minor-x": `${I(C, d)}px`,
        "--grid-minor-y": `${I(w, d)}px`,
        "--grid-major-x": `${I(C, v)}px`,
        "--grid-major-y": `${I(w, v)}px`
      };
    }), G = b(() => ({
      "is-panning": o.value.interaction.mode === "panning"
    }));
    function M() {
      const e = r.value;
      if (!e)
        return;
      const n = e.getBoundingClientRect();
      s.value = { x: n.width, y: n.height };
    }
    function _(e, n) {
      const l = r.value?.getBoundingClientRect();
      return {
        x: e - (l?.left ?? 0),
        y: n - (l?.top ?? 0)
      };
    }
    function X(e) {
      if (e instanceof HTMLElement)
        return e.closest("[data-node-id]")?.dataset.nodeId;
    }
    function K(e) {
      if (e instanceof HTMLElement)
        return e.closest("[data-resize]")?.dataset.resize;
    }
    function J(e) {
      return e instanceof HTMLElement && !!e.closest('[data-editor="true"]');
    }
    function Q(e) {
      if (J(e.target))
        return;
      if (e.button === 1) {
        e.preventDefault(), t.beginPan(e.pointerId, _(e.clientX, e.clientY)), r.value?.setPointerCapture(e.pointerId), r.value?.focus();
        return;
      }
      if (e.button !== 0)
        return;
      const n = _(e.clientX, e.clientY), l = X(e.target), d = K(e.target);
      d && l ? t.beginResize(l, d, e.pointerId, n) : l ? t.beginNodeDrag(l, e.pointerId, n) : (t.clearSelection(), t.beginPan(e.pointerId, n)), r.value?.setPointerCapture(e.pointerId), r.value?.focus();
    }
    function Z(e) {
      e.button === 1 && e.preventDefault();
    }
    function ee(e) {
      e.button === 1 && e.preventDefault();
    }
    function te(e) {
      t.updatePointer(e.pointerId, _(e.clientX, e.clientY));
    }
    function L(e) {
      t.endInteraction(e.pointerId), r.value?.hasPointerCapture(e.pointerId) && r.value.releasePointerCapture(e.pointerId);
    }
    function ne(e) {
      e.preventDefault();
      const n = _(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        const l = Math.max(-10, Math.min(10, e.deltaY));
        t.zoomAtScreenPoint(n, l);
      } else
        t.panByScreenDelta(e.deltaX, e.deltaY);
    }
    function oe(e) {
      if (K(e.target))
        return;
      const n = X(e.target);
      if (n) {
        t.beginTextEdit(n);
        return;
      }
      const l = _(e.clientX, e.clientY), d = t.screenToWorld(l), v = t.createNode({
        x: d.x,
        y: d.y,
        text: "New card"
      });
      t.beginTextEdit(v.id);
    }
    function ae(e) {
      if (o.value.interaction.mode !== "editing-text") {
        if (e.key === "Escape") {
          t.clearSelection(), t.endInteraction();
          return;
        }
        (e.key === "Backspace" || e.key === "Delete") && o.value.selection.length > 0 && (e.preventDefault(), t.deleteSelected());
      }
    }
    return W(() => {
      M(), window.addEventListener("resize", M), f("ready", t);
    }), ve(() => {
      O(), window.removeEventListener("resize", M);
    }), a({
      engine: t,
      debugState: j
    }), (e, n) => (y(), S("div", {
      ref_key: "root",
      ref: r,
      class: N(["canvas-root", G.value]),
      "data-grid-minor": E.value["--grid-minor-size"],
      "data-grid-major": E.value["--grid-major-size"],
      tabindex: "0",
      onMousedown: Z,
      onAuxclick: ee,
      onPointerdown: Q,
      onPointermove: te,
      onPointerup: L,
      onPointercancel: L,
      onWheel: ne,
      onDblclick: oe,
      onKeydown: ae
    }, [
      n[0] || (n[0] = B("div", { class: "canvas-root__backdrop" }, null, -1)),
      B("div", {
        class: "canvas-root__grid",
        style: T(E.value)
      }, null, 4),
      xe(Ee, { "cull-margin": i.cullMargin }, null, 8, ["cull-margin"]),
      ye(e.$slots, "default", {
        engine: k(t),
        snapshot: o.value,
        debugState: j.value
      }, void 0, !0)
    ], 42, Me));
  }
}), Ne = /* @__PURE__ */ V(Pe, [["__scopeId", "data-v-ad652b27"]]);
export {
  ke as CanvasNodeCard,
  Ne as CanvasRoot,
  Ee as CanvasViewport,
  A as useCanvasEngine
};
