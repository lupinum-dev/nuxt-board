import { inject as J, defineComponent as z, useTemplateRef as Q, ref as v, computed as b, watch as k, nextTick as Z, onMounted as $, onUpdated as ee, openBlock as g, createElementBlock as x, normalizeStyle as V, normalizeClass as T, withDirectives as te, withKeys as S, withModifiers as E, vModelText as ne, toDisplayString as ae, Fragment as K, renderList as Y, createElementVNode as L, createCommentVNode as oe, createBlock as ie, unref as C, shallowRef as re, provide as le, onBeforeUnmount as se, createVNode as ce, renderSlot as de } from "vue";
import { getVisibleBounds as ue, createCanvasEngine as fe } from "@canvas/core";
const X = /* @__PURE__ */ Symbol("canvas-engine");
function H() {
  const a = J(X);
  if (!a)
    throw new Error("useCanvasEngine must be used under <CanvasRoot>.");
  return a;
}
const pe = ["data-node-id"], me = ["onKeydown"], ve = {
  key: 1,
  class: "canvas-node-card__content"
}, ge = ["data-resize"], ye = /* @__PURE__ */ z({
  __name: "CanvasNodeCard",
  props: {
    node: {},
    selected: { type: Boolean },
    editing: { type: Boolean }
  },
  setup(a) {
    const n = a, { engine: i, renderStats: f } = H(), p = Q("textarea"), r = v(n.node.text), t = ["n", "ne", "e", "se", "s", "sw", "w", "nw"], o = b(() => ({
      left: `${n.node.x}px`,
      top: `${n.node.y}px`,
      width: `${n.node.width}px`,
      height: `${n.node.height}px`,
      zIndex: String(n.node.zIndex)
    }));
    k(
      () => n.editing,
      async (m) => {
        if (!m) {
          r.value = n.node.text;
          return;
        }
        await Z(), p.value?.focus(), p.value?.select();
      },
      { immediate: !0 }
    ), k(
      () => n.node.text,
      (m) => {
        n.editing || (r.value = m);
      }
    );
    function s() {
      i.commitTextEdit(n.node.id, r.value);
    }
    function d() {
      r.value = n.node.text, i.endInteraction();
    }
    return $(f.incrementRenderCount), ee(f.incrementRenderCount), (m, y) => (g(), x("article", {
      class: T(["canvas-node-card", { "is-selected": a.selected, "is-editing": a.editing }]),
      style: V(o.value),
      "data-node-id": a.node.id
    }, [
      a.editing ? te((g(), x("textarea", {
        key: 0,
        ref_key: "textarea",
        ref: p,
        "onUpdate:modelValue": y[0] || (y[0] = (u) => r.value = u),
        class: "canvas-node-card__editor",
        "data-editor": "true",
        onBlur: s,
        onKeydown: [
          S(E(s, ["meta", "prevent"]), ["enter"]),
          S(E(s, ["ctrl", "prevent"]), ["enter"]),
          S(E(d, ["prevent"]), ["esc"])
        ]
      }, null, 40, me)), [
        [ne, r.value]
      ]) : (g(), x("div", ve, ae(a.node.text || "Double-click to edit"), 1)),
      a.selected && !a.editing ? (g(), x(K, { key: 2 }, Y(t, (u) => L("div", {
        key: u,
        class: T(["canvas-node-card__handle", `is-${u}`]),
        "data-resize": u
      }, null, 10, ge)), 64)) : oe("", !0)
    ], 14, pe));
  }
}), M = (a, n) => {
  const i = a.__vccOpts || a;
  for (const [f, p] of n)
    i[f] = p;
  return i;
}, xe = /* @__PURE__ */ M(ye, [["__scopeId", "data-v-d7d22ae7"]]), we = /* @__PURE__ */ z({
  __name: "CanvasViewport",
  props: {
    cullMargin: { default: 200 }
  },
  setup(a) {
    const n = a, { snapshot: i, viewportSize: f, renderStats: p } = H(), r = b(() => ({
      transform: `scale(${i.value.camera.z}) translate(${i.value.camera.x}px, ${i.value.camera.y}px)`
    })), t = b(() => {
      const o = ue(f.value.x, f.value.y, i.value.camera);
      return i.value.nodes.filter((s) => s.x + s.width > o.minX - n.cullMargin && s.x < o.maxX + n.cullMargin && s.y + s.height > o.minY - n.cullMargin && s.y < o.maxY + n.cullMargin);
    });
    return k(
      t,
      (o) => {
        p.setVisibleNodeCount(o.length);
      },
      { immediate: !0 }
    ), (o, s) => (g(), x("div", {
      class: "canvas-viewport",
      style: V(r.value)
    }, [
      (g(!0), x(K, null, Y(t.value, (d) => (g(), ie(xe, {
        key: d.id,
        node: d,
        selected: C(i).selection.includes(d.id),
        editing: C(i).interaction.mode === "editing-text" && C(i).interaction.nodeId === d.id
      }, null, 8, ["node", "selected", "editing"]))), 128))
    ], 4));
  }
}), he = /* @__PURE__ */ M(we, [["__scopeId", "data-v-3a489015"]]), Ce = /* @__PURE__ */ z({
  __name: "CanvasRoot",
  props: {
    engine: { default: void 0 },
    debug: { type: Boolean, default: !1 },
    cullMargin: { default: 200 }
  },
  emits: ["ready"],
  setup(a, { expose: n, emit: i }) {
    const f = a, p = i, r = v(null), t = f.engine ?? fe(), o = re(t.getSnapshot()), s = v({ x: 0, y: 0 }), d = v(0), m = v(0), y = v(null), u = v(null), _ = v([]), P = {
      visibleNodeCount: d,
      renderCount: m,
      lastPerformanceSample: y,
      lastInvariantFailure: u,
      incrementRenderCount() {
        m.value += 1;
      },
      setVisibleNodeCount(e) {
        d.value = e;
      },
      consumeEvent(e) {
        e.type === "performance:sample" && (y.value = e), e.type === "invariant:failed" && (u.value = e);
      }
    };
    le(X, {
      engine: t,
      snapshot: o,
      viewportSize: s,
      renderStats: P
    });
    const U = t.subscribe((e) => {
      P.consumeEvent(e), e.type === "state:changed" && (o.value = e.snapshot), _.value = [..._.value.slice(-19), e];
    }), B = b(() => ({
      camera: o.value.camera,
      selection: o.value.selection,
      interaction: o.value.interaction,
      visibleNodeCount: d.value,
      renderCount: m.value,
      lastPerformanceSample: y.value?.type === "performance:sample" ? y.value.sample : null,
      lastInvariantFailure: u.value?.type === "invariant:failed" ? u.value.failure.message : null,
      recentEvents: _.value
    }));
    function I() {
      const e = r.value;
      if (!e)
        return;
      const l = e.getBoundingClientRect();
      s.value = { x: l.width, y: l.height };
    }
    function h(e, l) {
      const c = r.value?.getBoundingClientRect();
      return {
        x: e - (c?.left ?? 0),
        y: l - (c?.top ?? 0)
      };
    }
    function N(e) {
      if (e instanceof HTMLElement)
        return e.closest("[data-node-id]")?.dataset.nodeId;
    }
    function D(e) {
      if (e instanceof HTMLElement)
        return e.closest("[data-resize]")?.dataset.resize;
    }
    function F(e) {
      return e instanceof HTMLElement && !!e.closest('[data-editor="true"]');
    }
    function W(e) {
      if (F(e.target))
        return;
      const l = h(e.clientX, e.clientY), c = N(e.target), w = D(e.target);
      w && c ? t.beginResize(c, w, e.pointerId, l) : c ? t.beginNodeDrag(c, e.pointerId, l) : (t.clearSelection(), t.beginPan(e.pointerId, l)), r.value?.setPointerCapture(e.pointerId), r.value?.focus();
    }
    function j(e) {
      t.updatePointer(e.pointerId, h(e.clientX, e.clientY));
    }
    function R(e) {
      t.endInteraction(e.pointerId), r.value?.hasPointerCapture(e.pointerId) && r.value.releasePointerCapture(e.pointerId);
    }
    function A(e) {
      e.preventDefault();
      const l = h(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        const c = Math.max(-10, Math.min(10, e.deltaY));
        t.zoomAtScreenPoint(l, c);
      } else
        t.panByScreenDelta(e.deltaX, e.deltaY);
    }
    function O(e) {
      if (D(e.target))
        return;
      const l = N(e.target);
      if (l) {
        t.beginTextEdit(l);
        return;
      }
      const c = h(e.clientX, e.clientY), w = t.screenToWorld(c), G = t.createNode({
        x: w.x,
        y: w.y,
        text: "New card"
      });
      t.beginTextEdit(G.id);
    }
    function q(e) {
      if (o.value.interaction.mode !== "editing-text") {
        if (e.key === "Escape") {
          t.clearSelection(), t.endInteraction();
          return;
        }
        (e.key === "Backspace" || e.key === "Delete") && o.value.selection.length > 0 && (e.preventDefault(), t.deleteSelected());
      }
    }
    return $(() => {
      I(), window.addEventListener("resize", I), p("ready", t);
    }), se(() => {
      U(), window.removeEventListener("resize", I);
    }), n({
      engine: t,
      debugState: B
    }), (e, l) => (g(), x("div", {
      ref_key: "root",
      ref: r,
      class: "canvas-root",
      tabindex: "0",
      onPointerdown: W,
      onPointermove: j,
      onPointerup: R,
      onPointercancel: R,
      onWheel: A,
      onDblclick: O,
      onKeydown: q
    }, [
      l[0] || (l[0] = L("div", { class: "canvas-root__backdrop" }, null, -1)),
      ce(he, { "cull-margin": a.cullMargin }, null, 8, ["cull-margin"]),
      de(e.$slots, "default", {
        engine: C(t),
        snapshot: o.value,
        debugState: B.value
      }, void 0, !0)
    ], 544));
  }
}), Ie = /* @__PURE__ */ M(Ce, [["__scopeId", "data-v-c2a141c4"]]);
export {
  xe as CanvasNodeCard,
  Ie as CanvasRoot,
  he as CanvasViewport,
  H as useCanvasEngine
};
