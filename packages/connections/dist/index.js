import { defineComponent as p, computed as x, shallowRef as $, watch as v, h as y } from "vue";
import { boundsIntersect as w } from "@canvas/core";
import { useCanvasEngine as E } from "@canvas/vue";
function z(e = {}) {
  const n = e.routing ?? "bezier";
  return {
    name: "connections",
    install(r) {
      const o = r, i = /* @__PURE__ */ new Map();
      let d = 1;
      o.createEdge = (t) => {
        const s = r.getSnapshot(), c = new Set(s.nodes.map((u) => u.id));
        if (!c.has(t.from))
          throw new Error(`Cannot create edge: source node "${t.from}" does not exist.`);
        if (!c.has(t.to))
          throw new Error(`Cannot create edge: target node "${t.to}" does not exist.`);
        const a = {
          id: t.id ?? crypto.randomUUID(),
          from: t.from,
          to: t.to,
          fromAnchor: t.fromAnchor,
          toAnchor: t.toAnchor,
          data: structuredClone(t.data ?? {}),
          zIndex: t.zIndex ?? d++
        };
        return d = Math.max(d, a.zIndex + 1), i.set(a.id, a), r.emit("edge:created", a), structuredClone(a);
      }, o.deleteEdge = (t) => {
        i.has(t) && (i.delete(t), r.emit("edge:deleted", t));
      }, o.getEdges = () => Array.from(i.values()).map((t) => structuredClone(t)), o.getEdgesFrom = (t) => o.getEdges().filter((s) => s.from === t), o.getEdgesTo = (t) => o.getEdges().filter((s) => s.to === t), o.getEdgesBetween = (t, s) => o.getEdges().filter((c) => c.from === t && c.to === s);
      const l = r.on("node:deleted", (t) => {
        const s = [...i.values()].filter((c) => c.from === t || c.to === t);
        for (const c of s)
          i.delete(c.id), r.emit("edge:deleted", c.id);
      });
      return o.__connectionRouting = n, () => {
        l();
      };
    }
  };
}
function f(e, n) {
  const r = n?.offset ?? 0.5;
  switch (n?.side ?? "right") {
    case "top":
      return { x: e.x + e.width * r, y: e.y };
    case "bottom":
      return { x: e.x + e.width * r, y: e.y + e.height };
    case "left":
      return { x: e.x, y: e.y + e.height * r };
    default:
      return { x: e.x + e.width, y: e.y + e.height * r };
  }
}
function b(e, n, r = "bezier") {
  if (r === "straight")
    return `M ${e.x} ${e.y} L ${n.x} ${n.y}`;
  if (r === "step") {
    const i = (e.x + n.x) / 2;
    return `M ${e.x} ${e.y} L ${i} ${e.y} L ${i} ${n.y} L ${n.x} ${n.y}`;
  }
  const o = Math.max(40, Math.abs(n.x - e.x) * 0.4);
  return `M ${e.x} ${e.y} C ${e.x + o} ${e.y}, ${n.x - o} ${n.y}, ${n.x} ${n.y}`;
}
function M(e, n) {
  return {
    minX: Math.min(e.x, n.x),
    minY: Math.min(e.y, n.y),
    maxX: Math.max(e.x, n.x),
    maxY: Math.max(e.y, n.y)
  };
}
function L(e, n) {
  const r = new Map(e.getSnapshot().nodes.map((o) => [o.id, o]));
  return e.getEdges().filter((o) => {
    const i = r.get(o.from), d = r.get(o.to);
    return !i || !d ? !1 : w(n, M(f(i, o.fromAnchor), f(d, o.toAnchor)));
  });
}
const P = p({
  name: "CanvasConnectionLayer",
  props: {
    engine: {
      type: Object,
      default: null
    },
    routing: {
      type: String,
      default: "bezier"
    }
  },
  setup(e, { slots: n }) {
    const r = E(), o = x(() => e.engine ?? r.engine), i = $(0);
    let d = !1;
    function l() {
      d || (d = !0, queueMicrotask(() => {
        i.value += 1, d = !1;
      }));
    }
    v(o, (s, c, a) => {
      const u = [
        s.on("edge:created", l),
        s.on("edge:deleted", l),
        s.on("command:after", l)
      ];
      a(() => {
        for (const h of u)
          h();
      });
    }, { immediate: !0 });
    const t = x(() => {
      i.value;
      const s = r.snapshot.value, c = new Map(s.nodes.map((a) => [a.id, a]));
      return o.value.getEdges().map((a) => {
        const u = c.get(a.from), h = c.get(a.to);
        if (!u || !h)
          return null;
        const g = f(u, a.fromAnchor), m = f(h, a.toAnchor);
        return {
          edge: a,
          from: g,
          to: m,
          path: b(g, m, e.routing)
        };
      }).filter((a) => !!a);
    });
    return () => y(
      "svg",
      {
        class: "canvas-connection-layer",
        style: {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "none"
        }
      },
      t.value.map(
        (s) => n.edge ? n.edge(s) : y("path", {
          d: s.path,
          stroke: "currentColor",
          fill: "none",
          "stroke-width": 2
        })
      )
    );
  }
});
export {
  P as CanvasConnectionLayer,
  z as connectionPlugin,
  M as getEdgeBounds,
  L as getVisibleEdges,
  f as resolveAnchorPoint,
  b as routeEdgePath
};
