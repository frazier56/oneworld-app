var Ec = { exports: {} }, Ci = {}, bc = { exports: {} }, N = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Zn = Symbol.for("react.element"), uf = Symbol.for("react.portal"), cf = Symbol.for("react.fragment"), hf = Symbol.for("react.strict_mode"), df = Symbol.for("react.profiler"), ff = Symbol.for("react.provider"), pf = Symbol.for("react.context"), gf = Symbol.for("react.forward_ref"), mf = Symbol.for("react.suspense"), vf = Symbol.for("react.memo"), yf = Symbol.for("react.lazy"), xl = Symbol.iterator;
function wf(t) {
  return t === null || typeof t != "object" ? null : (t = xl && t[xl] || t["@@iterator"], typeof t == "function" ? t : null);
}
var Tc = { isMounted: function() {
  return !1;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, Cc = Object.assign, Rc = {};
function Kr(t, e, r) {
  this.props = t, this.context = e, this.refs = Rc, this.updater = r || Tc;
}
Kr.prototype.isReactComponent = {};
Kr.prototype.setState = function(t, e) {
  if (typeof t != "object" && typeof t != "function" && t != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, t, e, "setState");
};
Kr.prototype.forceUpdate = function(t) {
  this.updater.enqueueForceUpdate(this, t, "forceUpdate");
};
function Oc() {
}
Oc.prototype = Kr.prototype;
function ja(t, e, r) {
  this.props = t, this.context = e, this.refs = Rc, this.updater = r || Tc;
}
var Ia = ja.prototype = new Oc();
Ia.constructor = ja;
Cc(Ia, Kr.prototype);
Ia.isPureReactComponent = !0;
var Al = Array.isArray, xc = Object.prototype.hasOwnProperty, Na = { current: null }, Ac = { key: !0, ref: !0, __self: !0, __source: !0 };
function Pc(t, e, r) {
  var n, s = {}, i = null, o = null;
  if (e != null) for (n in e.ref !== void 0 && (o = e.ref), e.key !== void 0 && (i = "" + e.key), e) xc.call(e, n) && !Ac.hasOwnProperty(n) && (s[n] = e[n]);
  var a = arguments.length - 2;
  if (a === 1) s.children = r;
  else if (1 < a) {
    for (var l = Array(a), u = 0; u < a; u++) l[u] = arguments[u + 2];
    s.children = l;
  }
  if (t && t.defaultProps) for (n in a = t.defaultProps, a) s[n] === void 0 && (s[n] = a[n]);
  return { $$typeof: Zn, type: t, key: i, ref: o, props: s, _owner: Na.current };
}
function _f(t, e) {
  return { $$typeof: Zn, type: t.type, key: e, ref: t.ref, props: t.props, _owner: t._owner };
}
function La(t) {
  return typeof t == "object" && t !== null && t.$$typeof === Zn;
}
function kf(t) {
  var e = { "=": "=0", ":": "=2" };
  return "$" + t.replace(/[=:]/g, function(r) {
    return e[r];
  });
}
var Pl = /\/+/g;
function Ji(t, e) {
  return typeof t == "object" && t !== null && t.key != null ? kf("" + t.key) : e.toString(36);
}
function Is(t, e, r, n, s) {
  var i = typeof t;
  (i === "undefined" || i === "boolean") && (t = null);
  var o = !1;
  if (t === null) o = !0;
  else switch (i) {
    case "string":
    case "number":
      o = !0;
      break;
    case "object":
      switch (t.$$typeof) {
        case Zn:
        case uf:
          o = !0;
      }
  }
  if (o) return o = t, s = s(o), t = n === "" ? "." + Ji(o, 0) : n, Al(s) ? (r = "", t != null && (r = t.replace(Pl, "$&/") + "/"), Is(s, e, r, "", function(u) {
    return u;
  })) : s != null && (La(s) && (s = _f(s, r + (!s.key || o && o.key === s.key ? "" : ("" + s.key).replace(Pl, "$&/") + "/") + t)), e.push(s)), 1;
  if (o = 0, n = n === "" ? "." : n + ":", Al(t)) for (var a = 0; a < t.length; a++) {
    i = t[a];
    var l = n + Ji(i, a);
    o += Is(i, e, r, l, s);
  }
  else if (l = wf(t), typeof l == "function") for (t = l.call(t), a = 0; !(i = t.next()).done; ) i = i.value, l = n + Ji(i, a++), o += Is(i, e, r, l, s);
  else if (i === "object") throw e = String(t), Error("Objects are not valid as a React child (found: " + (e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e) + "). If you meant to render a collection of children, use an array instead.");
  return o;
}
function as(t, e, r) {
  if (t == null) return t;
  var n = [], s = 0;
  return Is(t, n, "", "", function(i) {
    return e.call(r, i, s++);
  }), n;
}
function Sf(t) {
  if (t._status === -1) {
    var e = t._result;
    e = e(), e.then(function(r) {
      (t._status === 0 || t._status === -1) && (t._status = 1, t._result = r);
    }, function(r) {
      (t._status === 0 || t._status === -1) && (t._status = 2, t._result = r);
    }), t._status === -1 && (t._status = 0, t._result = e);
  }
  if (t._status === 1) return t._result.default;
  throw t._result;
}
var ve = { current: null }, Ns = { transition: null }, Ef = { ReactCurrentDispatcher: ve, ReactCurrentBatchConfig: Ns, ReactCurrentOwner: Na };
function jc() {
  throw Error("act(...) is not supported in production builds of React.");
}
N.Children = { map: as, forEach: function(t, e, r) {
  as(t, function() {
    e.apply(this, arguments);
  }, r);
}, count: function(t) {
  var e = 0;
  return as(t, function() {
    e++;
  }), e;
}, toArray: function(t) {
  return as(t, function(e) {
    return e;
  }) || [];
}, only: function(t) {
  if (!La(t)) throw Error("React.Children.only expected to receive a single React element child.");
  return t;
} };
N.Component = Kr;
N.Fragment = cf;
N.Profiler = df;
N.PureComponent = ja;
N.StrictMode = hf;
N.Suspense = mf;
N.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = Ef;
N.act = jc;
N.cloneElement = function(t, e, r) {
  if (t == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + t + ".");
  var n = Cc({}, t.props), s = t.key, i = t.ref, o = t._owner;
  if (e != null) {
    if (e.ref !== void 0 && (i = e.ref, o = Na.current), e.key !== void 0 && (s = "" + e.key), t.type && t.type.defaultProps) var a = t.type.defaultProps;
    for (l in e) xc.call(e, l) && !Ac.hasOwnProperty(l) && (n[l] = e[l] === void 0 && a !== void 0 ? a[l] : e[l]);
  }
  var l = arguments.length - 2;
  if (l === 1) n.children = r;
  else if (1 < l) {
    a = Array(l);
    for (var u = 0; u < l; u++) a[u] = arguments[u + 2];
    n.children = a;
  }
  return { $$typeof: Zn, type: t.type, key: s, ref: i, props: n, _owner: o };
};
N.createContext = function(t) {
  return t = { $$typeof: pf, _currentValue: t, _currentValue2: t, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, t.Provider = { $$typeof: ff, _context: t }, t.Consumer = t;
};
N.createElement = Pc;
N.createFactory = function(t) {
  var e = Pc.bind(null, t);
  return e.type = t, e;
};
N.createRef = function() {
  return { current: null };
};
N.forwardRef = function(t) {
  return { $$typeof: gf, render: t };
};
N.isValidElement = La;
N.lazy = function(t) {
  return { $$typeof: yf, _payload: { _status: -1, _result: t }, _init: Sf };
};
N.memo = function(t, e) {
  return { $$typeof: vf, type: t, compare: e === void 0 ? null : e };
};
N.startTransition = function(t) {
  var e = Ns.transition;
  Ns.transition = {};
  try {
    t();
  } finally {
    Ns.transition = e;
  }
};
N.unstable_act = jc;
N.useCallback = function(t, e) {
  return ve.current.useCallback(t, e);
};
N.useContext = function(t) {
  return ve.current.useContext(t);
};
N.useDebugValue = function() {
};
N.useDeferredValue = function(t) {
  return ve.current.useDeferredValue(t);
};
N.useEffect = function(t, e) {
  return ve.current.useEffect(t, e);
};
N.useId = function() {
  return ve.current.useId();
};
N.useImperativeHandle = function(t, e, r) {
  return ve.current.useImperativeHandle(t, e, r);
};
N.useInsertionEffect = function(t, e) {
  return ve.current.useInsertionEffect(t, e);
};
N.useLayoutEffect = function(t, e) {
  return ve.current.useLayoutEffect(t, e);
};
N.useMemo = function(t, e) {
  return ve.current.useMemo(t, e);
};
N.useReducer = function(t, e, r) {
  return ve.current.useReducer(t, e, r);
};
N.useRef = function(t) {
  return ve.current.useRef(t);
};
N.useState = function(t) {
  return ve.current.useState(t);
};
N.useSyncExternalStore = function(t, e, r) {
  return ve.current.useSyncExternalStore(t, e, r);
};
N.useTransition = function() {
  return ve.current.useTransition();
};
N.version = "18.3.1";
bc.exports = N;
var Z = bc.exports;
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var bf = Z, Tf = Symbol.for("react.element"), Cf = Symbol.for("react.fragment"), Rf = Object.prototype.hasOwnProperty, Of = bf.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, xf = { key: !0, ref: !0, __self: !0, __source: !0 };
function Ic(t, e, r) {
  var n, s = {}, i = null, o = null;
  r !== void 0 && (i = "" + r), e.key !== void 0 && (i = "" + e.key), e.ref !== void 0 && (o = e.ref);
  for (n in e) Rf.call(e, n) && !xf.hasOwnProperty(n) && (s[n] = e[n]);
  if (t && t.defaultProps) for (n in e = t.defaultProps, e) s[n] === void 0 && (s[n] = e[n]);
  return { $$typeof: Tf, type: t, key: i, ref: o, props: s, _owner: Of.current };
}
Ci.Fragment = Cf;
Ci.jsx = Ic;
Ci.jsxs = Ic;
Ec.exports = Ci;
var _ = Ec.exports, Nc = { exports: {} }, Pe = {}, Lc = { exports: {} }, $c = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(t) {
  function e(O, j) {
    var I = O.length;
    O.push(j);
    e: for (; 0 < I; ) {
      var J = I - 1 >>> 1, re = O[J];
      if (0 < s(re, j)) O[J] = j, O[I] = re, I = J;
      else break e;
    }
  }
  function r(O) {
    return O.length === 0 ? null : O[0];
  }
  function n(O) {
    if (O.length === 0) return null;
    var j = O[0], I = O.pop();
    if (I !== j) {
      O[0] = I;
      e: for (var J = 0, re = O.length, is = re >>> 1; J < is; ) {
        var Ht = 2 * (J + 1) - 1, Gi = O[Ht], Wt = Ht + 1, os = O[Wt];
        if (0 > s(Gi, I)) Wt < re && 0 > s(os, Gi) ? (O[J] = os, O[Wt] = I, J = Wt) : (O[J] = Gi, O[Ht] = I, J = Ht);
        else if (Wt < re && 0 > s(os, I)) O[J] = os, O[Wt] = I, J = Wt;
        else break e;
      }
    }
    return j;
  }
  function s(O, j) {
    var I = O.sortIndex - j.sortIndex;
    return I !== 0 ? I : O.id - j.id;
  }
  if (typeof performance == "object" && typeof performance.now == "function") {
    var i = performance;
    t.unstable_now = function() {
      return i.now();
    };
  } else {
    var o = Date, a = o.now();
    t.unstable_now = function() {
      return o.now() - a;
    };
  }
  var l = [], u = [], c = 1, h = null, d = 3, g = !1, v = !1, y = !1, k = typeof setTimeout == "function" ? setTimeout : null, f = typeof clearTimeout == "function" ? clearTimeout : null, p = typeof setImmediate < "u" ? setImmediate : null;
  typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function m(O) {
    for (var j = r(u); j !== null; ) {
      if (j.callback === null) n(u);
      else if (j.startTime <= O) n(u), j.sortIndex = j.expirationTime, e(l, j);
      else break;
      j = r(u);
    }
  }
  function w(O) {
    if (y = !1, m(O), !v) if (r(l) !== null) v = !0, Ki(T);
    else {
      var j = r(u);
      j !== null && qi(w, j.startTime - O);
    }
  }
  function T(O, j) {
    v = !1, y && (y = !1, f(A), A = -1), g = !0;
    var I = d;
    try {
      for (m(j), h = r(l); h !== null && (!(h.expirationTime > j) || O && !ze()); ) {
        var J = h.callback;
        if (typeof J == "function") {
          h.callback = null, d = h.priorityLevel;
          var re = J(h.expirationTime <= j);
          j = t.unstable_now(), typeof re == "function" ? h.callback = re : h === r(l) && n(l), m(j);
        } else n(l);
        h = r(l);
      }
      if (h !== null) var is = !0;
      else {
        var Ht = r(u);
        Ht !== null && qi(w, Ht.startTime - j), is = !1;
      }
      return is;
    } finally {
      h = null, d = I, g = !1;
    }
  }
  var E = !1, b = null, A = -1, U = 5, L = -1;
  function ze() {
    return !(t.unstable_now() - L < U);
  }
  function Qr() {
    if (b !== null) {
      var O = t.unstable_now();
      L = O;
      var j = !0;
      try {
        j = b(!0, O);
      } finally {
        j ? Yr() : (E = !1, b = null);
      }
    } else E = !1;
  }
  var Yr;
  if (typeof p == "function") Yr = function() {
    p(Qr);
  };
  else if (typeof MessageChannel < "u") {
    var Ol = new MessageChannel(), lf = Ol.port2;
    Ol.port1.onmessage = Qr, Yr = function() {
      lf.postMessage(null);
    };
  } else Yr = function() {
    k(Qr, 0);
  };
  function Ki(O) {
    b = O, E || (E = !0, Yr());
  }
  function qi(O, j) {
    A = k(function() {
      O(t.unstable_now());
    }, j);
  }
  t.unstable_IdlePriority = 5, t.unstable_ImmediatePriority = 1, t.unstable_LowPriority = 4, t.unstable_NormalPriority = 3, t.unstable_Profiling = null, t.unstable_UserBlockingPriority = 2, t.unstable_cancelCallback = function(O) {
    O.callback = null;
  }, t.unstable_continueExecution = function() {
    v || g || (v = !0, Ki(T));
  }, t.unstable_forceFrameRate = function(O) {
    0 > O || 125 < O ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : U = 0 < O ? Math.floor(1e3 / O) : 5;
  }, t.unstable_getCurrentPriorityLevel = function() {
    return d;
  }, t.unstable_getFirstCallbackNode = function() {
    return r(l);
  }, t.unstable_next = function(O) {
    switch (d) {
      case 1:
      case 2:
      case 3:
        var j = 3;
        break;
      default:
        j = d;
    }
    var I = d;
    d = j;
    try {
      return O();
    } finally {
      d = I;
    }
  }, t.unstable_pauseExecution = function() {
  }, t.unstable_requestPaint = function() {
  }, t.unstable_runWithPriority = function(O, j) {
    switch (O) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        O = 3;
    }
    var I = d;
    d = O;
    try {
      return j();
    } finally {
      d = I;
    }
  }, t.unstable_scheduleCallback = function(O, j, I) {
    var J = t.unstable_now();
    switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? J + I : J) : I = J, O) {
      case 1:
        var re = -1;
        break;
      case 2:
        re = 250;
        break;
      case 5:
        re = 1073741823;
        break;
      case 4:
        re = 1e4;
        break;
      default:
        re = 5e3;
    }
    return re = I + re, O = { id: c++, callback: j, priorityLevel: O, startTime: I, expirationTime: re, sortIndex: -1 }, I > J ? (O.sortIndex = I, e(u, O), r(l) === null && O === r(u) && (y ? (f(A), A = -1) : y = !0, qi(w, I - J))) : (O.sortIndex = re, e(l, O), v || g || (v = !0, Ki(T))), O;
  }, t.unstable_shouldYield = ze, t.unstable_wrapCallback = function(O) {
    var j = d;
    return function() {
      var I = d;
      d = j;
      try {
        return O.apply(this, arguments);
      } finally {
        d = I;
      }
    };
  };
})($c);
Lc.exports = $c;
var Af = Lc.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Pf = Z, Ae = Af;
function S(t) {
  for (var e = "https://reactjs.org/docs/error-decoder.html?invariant=" + t, r = 1; r < arguments.length; r++) e += "&args[]=" + encodeURIComponent(arguments[r]);
  return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
var Uc = /* @__PURE__ */ new Set(), Cn = {};
function lr(t, e) {
  Dr(t, e), Dr(t + "Capture", e);
}
function Dr(t, e) {
  for (Cn[t] = e, t = 0; t < e.length; t++) Uc.add(e[t]);
}
var mt = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), xo = Object.prototype.hasOwnProperty, jf = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, jl = {}, Il = {};
function If(t) {
  return xo.call(Il, t) ? !0 : xo.call(jl, t) ? !1 : jf.test(t) ? Il[t] = !0 : (jl[t] = !0, !1);
}
function Nf(t, e, r, n) {
  if (r !== null && r.type === 0) return !1;
  switch (typeof e) {
    case "function":
    case "symbol":
      return !0;
    case "boolean":
      return n ? !1 : r !== null ? !r.acceptsBooleans : (t = t.toLowerCase().slice(0, 5), t !== "data-" && t !== "aria-");
    default:
      return !1;
  }
}
function Lf(t, e, r, n) {
  if (e === null || typeof e > "u" || Nf(t, e, r, n)) return !0;
  if (n) return !1;
  if (r !== null) switch (r.type) {
    case 3:
      return !e;
    case 4:
      return e === !1;
    case 5:
      return isNaN(e);
    case 6:
      return isNaN(e) || 1 > e;
  }
  return !1;
}
function ye(t, e, r, n, s, i, o) {
  this.acceptsBooleans = e === 2 || e === 3 || e === 4, this.attributeName = n, this.attributeNamespace = s, this.mustUseProperty = r, this.propertyName = t, this.type = e, this.sanitizeURL = i, this.removeEmptyString = o;
}
var ue = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(t) {
  ue[t] = new ye(t, 0, !1, t, null, !1, !1);
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(t) {
  var e = t[0];
  ue[e] = new ye(e, 1, !1, t[1], null, !1, !1);
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(t) {
  ue[t] = new ye(t, 2, !1, t.toLowerCase(), null, !1, !1);
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(t) {
  ue[t] = new ye(t, 2, !1, t, null, !1, !1);
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(t) {
  ue[t] = new ye(t, 3, !1, t.toLowerCase(), null, !1, !1);
});
["checked", "multiple", "muted", "selected"].forEach(function(t) {
  ue[t] = new ye(t, 3, !0, t, null, !1, !1);
});
["capture", "download"].forEach(function(t) {
  ue[t] = new ye(t, 4, !1, t, null, !1, !1);
});
["cols", "rows", "size", "span"].forEach(function(t) {
  ue[t] = new ye(t, 6, !1, t, null, !1, !1);
});
["rowSpan", "start"].forEach(function(t) {
  ue[t] = new ye(t, 5, !1, t.toLowerCase(), null, !1, !1);
});
var $a = /[\-:]([a-z])/g;
function Ua(t) {
  return t[1].toUpperCase();
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(t) {
  var e = t.replace(
    $a,
    Ua
  );
  ue[e] = new ye(e, 1, !1, t, null, !1, !1);
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(t) {
  var e = t.replace($a, Ua);
  ue[e] = new ye(e, 1, !1, t, "http://www.w3.org/1999/xlink", !1, !1);
});
["xml:base", "xml:lang", "xml:space"].forEach(function(t) {
  var e = t.replace($a, Ua);
  ue[e] = new ye(e, 1, !1, t, "http://www.w3.org/XML/1998/namespace", !1, !1);
});
["tabIndex", "crossOrigin"].forEach(function(t) {
  ue[t] = new ye(t, 1, !1, t.toLowerCase(), null, !1, !1);
});
ue.xlinkHref = new ye("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1);
["src", "href", "action", "formAction"].forEach(function(t) {
  ue[t] = new ye(t, 1, !1, t.toLowerCase(), null, !0, !0);
});
function Da(t, e, r, n) {
  var s = ue.hasOwnProperty(e) ? ue[e] : null;
  (s !== null ? s.type !== 0 : n || !(2 < e.length) || e[0] !== "o" && e[0] !== "O" || e[1] !== "n" && e[1] !== "N") && (Lf(e, r, s, n) && (r = null), n || s === null ? If(e) && (r === null ? t.removeAttribute(e) : t.setAttribute(e, "" + r)) : s.mustUseProperty ? t[s.propertyName] = r === null ? s.type === 3 ? !1 : "" : r : (e = s.attributeName, n = s.attributeNamespace, r === null ? t.removeAttribute(e) : (s = s.type, r = s === 3 || s === 4 && r === !0 ? "" : "" + r, n ? t.setAttributeNS(n, e, r) : t.setAttribute(e, r))));
}
var _t = Pf.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, ls = Symbol.for("react.element"), vr = Symbol.for("react.portal"), yr = Symbol.for("react.fragment"), Ma = Symbol.for("react.strict_mode"), Ao = Symbol.for("react.profiler"), Dc = Symbol.for("react.provider"), Mc = Symbol.for("react.context"), za = Symbol.for("react.forward_ref"), Po = Symbol.for("react.suspense"), jo = Symbol.for("react.suspense_list"), Ba = Symbol.for("react.memo"), St = Symbol.for("react.lazy"), zc = Symbol.for("react.offscreen"), Nl = Symbol.iterator;
function Xr(t) {
  return t === null || typeof t != "object" ? null : (t = Nl && t[Nl] || t["@@iterator"], typeof t == "function" ? t : null);
}
var K = Object.assign, Qi;
function ln(t) {
  if (Qi === void 0) try {
    throw Error();
  } catch (r) {
    var e = r.stack.trim().match(/\n( *(at )?)/);
    Qi = e && e[1] || "";
  }
  return `
` + Qi + t;
}
var Yi = !1;
function Xi(t, e) {
  if (!t || Yi) return "";
  Yi = !0;
  var r = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (e) if (e = function() {
      throw Error();
    }, Object.defineProperty(e.prototype, "props", { set: function() {
      throw Error();
    } }), typeof Reflect == "object" && Reflect.construct) {
      try {
        Reflect.construct(e, []);
      } catch (u) {
        var n = u;
      }
      Reflect.construct(t, [], e);
    } else {
      try {
        e.call();
      } catch (u) {
        n = u;
      }
      t.call(e.prototype);
    }
    else {
      try {
        throw Error();
      } catch (u) {
        n = u;
      }
      t();
    }
  } catch (u) {
    if (u && n && typeof u.stack == "string") {
      for (var s = u.stack.split(`
`), i = n.stack.split(`
`), o = s.length - 1, a = i.length - 1; 1 <= o && 0 <= a && s[o] !== i[a]; ) a--;
      for (; 1 <= o && 0 <= a; o--, a--) if (s[o] !== i[a]) {
        if (o !== 1 || a !== 1)
          do
            if (o--, a--, 0 > a || s[o] !== i[a]) {
              var l = `
` + s[o].replace(" at new ", " at ");
              return t.displayName && l.includes("<anonymous>") && (l = l.replace("<anonymous>", t.displayName)), l;
            }
          while (1 <= o && 0 <= a);
        break;
      }
    }
  } finally {
    Yi = !1, Error.prepareStackTrace = r;
  }
  return (t = t ? t.displayName || t.name : "") ? ln(t) : "";
}
function $f(t) {
  switch (t.tag) {
    case 5:
      return ln(t.type);
    case 16:
      return ln("Lazy");
    case 13:
      return ln("Suspense");
    case 19:
      return ln("SuspenseList");
    case 0:
    case 2:
    case 15:
      return t = Xi(t.type, !1), t;
    case 11:
      return t = Xi(t.type.render, !1), t;
    case 1:
      return t = Xi(t.type, !0), t;
    default:
      return "";
  }
}
function Io(t) {
  if (t == null) return null;
  if (typeof t == "function") return t.displayName || t.name || null;
  if (typeof t == "string") return t;
  switch (t) {
    case yr:
      return "Fragment";
    case vr:
      return "Portal";
    case Ao:
      return "Profiler";
    case Ma:
      return "StrictMode";
    case Po:
      return "Suspense";
    case jo:
      return "SuspenseList";
  }
  if (typeof t == "object") switch (t.$$typeof) {
    case Mc:
      return (t.displayName || "Context") + ".Consumer";
    case Dc:
      return (t._context.displayName || "Context") + ".Provider";
    case za:
      var e = t.render;
      return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
    case Ba:
      return e = t.displayName || null, e !== null ? e : Io(t.type) || "Memo";
    case St:
      e = t._payload, t = t._init;
      try {
        return Io(t(e));
      } catch {
      }
  }
  return null;
}
function Uf(t) {
  var e = t.type;
  switch (t.tag) {
    case 24:
      return "Cache";
    case 9:
      return (e.displayName || "Context") + ".Consumer";
    case 10:
      return (e._context.displayName || "Context") + ".Provider";
    case 18:
      return "DehydratedFragment";
    case 11:
      return t = e.render, t = t.displayName || t.name || "", e.displayName || (t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 5:
      return e;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return Io(e);
    case 8:
      return e === Ma ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if (typeof e == "function") return e.displayName || e.name || null;
      if (typeof e == "string") return e;
  }
  return null;
}
function Dt(t) {
  switch (typeof t) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return t;
    case "object":
      return t;
    default:
      return "";
  }
}
function Bc(t) {
  var e = t.type;
  return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
}
function Df(t) {
  var e = Bc(t) ? "checked" : "value", r = Object.getOwnPropertyDescriptor(t.constructor.prototype, e), n = "" + t[e];
  if (!t.hasOwnProperty(e) && typeof r < "u" && typeof r.get == "function" && typeof r.set == "function") {
    var s = r.get, i = r.set;
    return Object.defineProperty(t, e, { configurable: !0, get: function() {
      return s.call(this);
    }, set: function(o) {
      n = "" + o, i.call(this, o);
    } }), Object.defineProperty(t, e, { enumerable: r.enumerable }), { getValue: function() {
      return n;
    }, setValue: function(o) {
      n = "" + o;
    }, stopTracking: function() {
      t._valueTracker = null, delete t[e];
    } };
  }
}
function us(t) {
  t._valueTracker || (t._valueTracker = Df(t));
}
function Fc(t) {
  if (!t) return !1;
  var e = t._valueTracker;
  if (!e) return !0;
  var r = e.getValue(), n = "";
  return t && (n = Bc(t) ? t.checked ? "true" : "false" : t.value), t = n, t !== r ? (e.setValue(t), !0) : !1;
}
function qs(t) {
  if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
  try {
    return t.activeElement || t.body;
  } catch {
    return t.body;
  }
}
function No(t, e) {
  var r = e.checked;
  return K({}, e, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: r ?? t._wrapperState.initialChecked });
}
function Ll(t, e) {
  var r = e.defaultValue == null ? "" : e.defaultValue, n = e.checked != null ? e.checked : e.defaultChecked;
  r = Dt(e.value != null ? e.value : r), t._wrapperState = { initialChecked: n, initialValue: r, controlled: e.type === "checkbox" || e.type === "radio" ? e.checked != null : e.value != null };
}
function Hc(t, e) {
  e = e.checked, e != null && Da(t, "checked", e, !1);
}
function Lo(t, e) {
  Hc(t, e);
  var r = Dt(e.value), n = e.type;
  if (r != null) n === "number" ? (r === 0 && t.value === "" || t.value != r) && (t.value = "" + r) : t.value !== "" + r && (t.value = "" + r);
  else if (n === "submit" || n === "reset") {
    t.removeAttribute("value");
    return;
  }
  e.hasOwnProperty("value") ? $o(t, e.type, r) : e.hasOwnProperty("defaultValue") && $o(t, e.type, Dt(e.defaultValue)), e.checked == null && e.defaultChecked != null && (t.defaultChecked = !!e.defaultChecked);
}
function $l(t, e, r) {
  if (e.hasOwnProperty("value") || e.hasOwnProperty("defaultValue")) {
    var n = e.type;
    if (!(n !== "submit" && n !== "reset" || e.value !== void 0 && e.value !== null)) return;
    e = "" + t._wrapperState.initialValue, r || e === t.value || (t.value = e), t.defaultValue = e;
  }
  r = t.name, r !== "" && (t.name = ""), t.defaultChecked = !!t._wrapperState.initialChecked, r !== "" && (t.name = r);
}
function $o(t, e, r) {
  (e !== "number" || qs(t.ownerDocument) !== t) && (r == null ? t.defaultValue = "" + t._wrapperState.initialValue : t.defaultValue !== "" + r && (t.defaultValue = "" + r));
}
var un = Array.isArray;
function Ar(t, e, r, n) {
  if (t = t.options, e) {
    e = {};
    for (var s = 0; s < r.length; s++) e["$" + r[s]] = !0;
    for (r = 0; r < t.length; r++) s = e.hasOwnProperty("$" + t[r].value), t[r].selected !== s && (t[r].selected = s), s && n && (t[r].defaultSelected = !0);
  } else {
    for (r = "" + Dt(r), e = null, s = 0; s < t.length; s++) {
      if (t[s].value === r) {
        t[s].selected = !0, n && (t[s].defaultSelected = !0);
        return;
      }
      e !== null || t[s].disabled || (e = t[s]);
    }
    e !== null && (e.selected = !0);
  }
}
function Uo(t, e) {
  if (e.dangerouslySetInnerHTML != null) throw Error(S(91));
  return K({}, e, { value: void 0, defaultValue: void 0, children: "" + t._wrapperState.initialValue });
}
function Ul(t, e) {
  var r = e.value;
  if (r == null) {
    if (r = e.children, e = e.defaultValue, r != null) {
      if (e != null) throw Error(S(92));
      if (un(r)) {
        if (1 < r.length) throw Error(S(93));
        r = r[0];
      }
      e = r;
    }
    e == null && (e = ""), r = e;
  }
  t._wrapperState = { initialValue: Dt(r) };
}
function Wc(t, e) {
  var r = Dt(e.value), n = Dt(e.defaultValue);
  r != null && (r = "" + r, r !== t.value && (t.value = r), e.defaultValue == null && t.defaultValue !== r && (t.defaultValue = r)), n != null && (t.defaultValue = "" + n);
}
function Dl(t) {
  var e = t.textContent;
  e === t._wrapperState.initialValue && e !== "" && e !== null && (t.value = e);
}
function Vc(t) {
  switch (t) {
    case "svg":
      return "http://www.w3.org/2000/svg";
    case "math":
      return "http://www.w3.org/1998/Math/MathML";
    default:
      return "http://www.w3.org/1999/xhtml";
  }
}
function Do(t, e) {
  return t == null || t === "http://www.w3.org/1999/xhtml" ? Vc(e) : t === "http://www.w3.org/2000/svg" && e === "foreignObject" ? "http://www.w3.org/1999/xhtml" : t;
}
var cs, Kc = function(t) {
  return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(e, r, n, s) {
    MSApp.execUnsafeLocalFunction(function() {
      return t(e, r, n, s);
    });
  } : t;
}(function(t, e) {
  if (t.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in t) t.innerHTML = e;
  else {
    for (cs = cs || document.createElement("div"), cs.innerHTML = "<svg>" + e.valueOf().toString() + "</svg>", e = cs.firstChild; t.firstChild; ) t.removeChild(t.firstChild);
    for (; e.firstChild; ) t.appendChild(e.firstChild);
  }
});
function Rn(t, e) {
  if (e) {
    var r = t.firstChild;
    if (r && r === t.lastChild && r.nodeType === 3) {
      r.nodeValue = e;
      return;
    }
  }
  t.textContent = e;
}
var gn = {
  animationIterationCount: !0,
  aspectRatio: !0,
  borderImageOutset: !0,
  borderImageSlice: !0,
  borderImageWidth: !0,
  boxFlex: !0,
  boxFlexGroup: !0,
  boxOrdinalGroup: !0,
  columnCount: !0,
  columns: !0,
  flex: !0,
  flexGrow: !0,
  flexPositive: !0,
  flexShrink: !0,
  flexNegative: !0,
  flexOrder: !0,
  gridArea: !0,
  gridRow: !0,
  gridRowEnd: !0,
  gridRowSpan: !0,
  gridRowStart: !0,
  gridColumn: !0,
  gridColumnEnd: !0,
  gridColumnSpan: !0,
  gridColumnStart: !0,
  fontWeight: !0,
  lineClamp: !0,
  lineHeight: !0,
  opacity: !0,
  order: !0,
  orphans: !0,
  tabSize: !0,
  widows: !0,
  zIndex: !0,
  zoom: !0,
  fillOpacity: !0,
  floodOpacity: !0,
  stopOpacity: !0,
  strokeDasharray: !0,
  strokeDashoffset: !0,
  strokeMiterlimit: !0,
  strokeOpacity: !0,
  strokeWidth: !0
}, Mf = ["Webkit", "ms", "Moz", "O"];
Object.keys(gn).forEach(function(t) {
  Mf.forEach(function(e) {
    e = e + t.charAt(0).toUpperCase() + t.substring(1), gn[e] = gn[t];
  });
});
function qc(t, e, r) {
  return e == null || typeof e == "boolean" || e === "" ? "" : r || typeof e != "number" || e === 0 || gn.hasOwnProperty(t) && gn[t] ? ("" + e).trim() : e + "px";
}
function Gc(t, e) {
  t = t.style;
  for (var r in e) if (e.hasOwnProperty(r)) {
    var n = r.indexOf("--") === 0, s = qc(r, e[r], n);
    r === "float" && (r = "cssFloat"), n ? t.setProperty(r, s) : t[r] = s;
  }
}
var zf = K({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
function Mo(t, e) {
  if (e) {
    if (zf[t] && (e.children != null || e.dangerouslySetInnerHTML != null)) throw Error(S(137, t));
    if (e.dangerouslySetInnerHTML != null) {
      if (e.children != null) throw Error(S(60));
      if (typeof e.dangerouslySetInnerHTML != "object" || !("__html" in e.dangerouslySetInnerHTML)) throw Error(S(61));
    }
    if (e.style != null && typeof e.style != "object") throw Error(S(62));
  }
}
function zo(t, e) {
  if (t.indexOf("-") === -1) return typeof e.is == "string";
  switch (t) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return !1;
    default:
      return !0;
  }
}
var Bo = null;
function Fa(t) {
  return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
}
var Fo = null, Pr = null, jr = null;
function Ml(t) {
  if (t = rs(t)) {
    if (typeof Fo != "function") throw Error(S(280));
    var e = t.stateNode;
    e && (e = Pi(e), Fo(t.stateNode, t.type, e));
  }
}
function Jc(t) {
  Pr ? jr ? jr.push(t) : jr = [t] : Pr = t;
}
function Qc() {
  if (Pr) {
    var t = Pr, e = jr;
    if (jr = Pr = null, Ml(t), e) for (t = 0; t < e.length; t++) Ml(e[t]);
  }
}
function Yc(t, e) {
  return t(e);
}
function Xc() {
}
var Zi = !1;
function Zc(t, e, r) {
  if (Zi) return t(e, r);
  Zi = !0;
  try {
    return Yc(t, e, r);
  } finally {
    Zi = !1, (Pr !== null || jr !== null) && (Xc(), Qc());
  }
}
function On(t, e) {
  var r = t.stateNode;
  if (r === null) return null;
  var n = Pi(r);
  if (n === null) return null;
  r = n[e];
  e: switch (e) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
    case "onMouseEnter":
      (n = !n.disabled) || (t = t.type, n = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !n;
      break e;
    default:
      t = !1;
  }
  if (t) return null;
  if (r && typeof r != "function") throw Error(S(231, e, typeof r));
  return r;
}
var Ho = !1;
if (mt) try {
  var Zr = {};
  Object.defineProperty(Zr, "passive", { get: function() {
    Ho = !0;
  } }), window.addEventListener("test", Zr, Zr), window.removeEventListener("test", Zr, Zr);
} catch {
  Ho = !1;
}
function Bf(t, e, r, n, s, i, o, a, l) {
  var u = Array.prototype.slice.call(arguments, 3);
  try {
    e.apply(r, u);
  } catch (c) {
    this.onError(c);
  }
}
var mn = !1, Gs = null, Js = !1, Wo = null, Ff = { onError: function(t) {
  mn = !0, Gs = t;
} };
function Hf(t, e, r, n, s, i, o, a, l) {
  mn = !1, Gs = null, Bf.apply(Ff, arguments);
}
function Wf(t, e, r, n, s, i, o, a, l) {
  if (Hf.apply(this, arguments), mn) {
    if (mn) {
      var u = Gs;
      mn = !1, Gs = null;
    } else throw Error(S(198));
    Js || (Js = !0, Wo = u);
  }
}
function ur(t) {
  var e = t, r = t;
  if (t.alternate) for (; e.return; ) e = e.return;
  else {
    t = e;
    do
      e = t, e.flags & 4098 && (r = e.return), t = e.return;
    while (t);
  }
  return e.tag === 3 ? r : null;
}
function eh(t) {
  if (t.tag === 13) {
    var e = t.memoizedState;
    if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
  }
  return null;
}
function zl(t) {
  if (ur(t) !== t) throw Error(S(188));
}
function Vf(t) {
  var e = t.alternate;
  if (!e) {
    if (e = ur(t), e === null) throw Error(S(188));
    return e !== t ? null : t;
  }
  for (var r = t, n = e; ; ) {
    var s = r.return;
    if (s === null) break;
    var i = s.alternate;
    if (i === null) {
      if (n = s.return, n !== null) {
        r = n;
        continue;
      }
      break;
    }
    if (s.child === i.child) {
      for (i = s.child; i; ) {
        if (i === r) return zl(s), t;
        if (i === n) return zl(s), e;
        i = i.sibling;
      }
      throw Error(S(188));
    }
    if (r.return !== n.return) r = s, n = i;
    else {
      for (var o = !1, a = s.child; a; ) {
        if (a === r) {
          o = !0, r = s, n = i;
          break;
        }
        if (a === n) {
          o = !0, n = s, r = i;
          break;
        }
        a = a.sibling;
      }
      if (!o) {
        for (a = i.child; a; ) {
          if (a === r) {
            o = !0, r = i, n = s;
            break;
          }
          if (a === n) {
            o = !0, n = i, r = s;
            break;
          }
          a = a.sibling;
        }
        if (!o) throw Error(S(189));
      }
    }
    if (r.alternate !== n) throw Error(S(190));
  }
  if (r.tag !== 3) throw Error(S(188));
  return r.stateNode.current === r ? t : e;
}
function th(t) {
  return t = Vf(t), t !== null ? rh(t) : null;
}
function rh(t) {
  if (t.tag === 5 || t.tag === 6) return t;
  for (t = t.child; t !== null; ) {
    var e = rh(t);
    if (e !== null) return e;
    t = t.sibling;
  }
  return null;
}
var nh = Ae.unstable_scheduleCallback, Bl = Ae.unstable_cancelCallback, Kf = Ae.unstable_shouldYield, qf = Ae.unstable_requestPaint, Q = Ae.unstable_now, Gf = Ae.unstable_getCurrentPriorityLevel, Ha = Ae.unstable_ImmediatePriority, sh = Ae.unstable_UserBlockingPriority, Qs = Ae.unstable_NormalPriority, Jf = Ae.unstable_LowPriority, ih = Ae.unstable_IdlePriority, Ri = null, nt = null;
function Qf(t) {
  if (nt && typeof nt.onCommitFiberRoot == "function") try {
    nt.onCommitFiberRoot(Ri, t, void 0, (t.current.flags & 128) === 128);
  } catch {
  }
}
var Je = Math.clz32 ? Math.clz32 : Zf, Yf = Math.log, Xf = Math.LN2;
function Zf(t) {
  return t >>>= 0, t === 0 ? 32 : 31 - (Yf(t) / Xf | 0) | 0;
}
var hs = 64, ds = 4194304;
function cn(t) {
  switch (t & -t) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return t & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return t & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return t;
  }
}
function Ys(t, e) {
  var r = t.pendingLanes;
  if (r === 0) return 0;
  var n = 0, s = t.suspendedLanes, i = t.pingedLanes, o = r & 268435455;
  if (o !== 0) {
    var a = o & ~s;
    a !== 0 ? n = cn(a) : (i &= o, i !== 0 && (n = cn(i)));
  } else o = r & ~s, o !== 0 ? n = cn(o) : i !== 0 && (n = cn(i));
  if (n === 0) return 0;
  if (e !== 0 && e !== n && !(e & s) && (s = n & -n, i = e & -e, s >= i || s === 16 && (i & 4194240) !== 0)) return e;
  if (n & 4 && (n |= r & 16), e = t.entangledLanes, e !== 0) for (t = t.entanglements, e &= n; 0 < e; ) r = 31 - Je(e), s = 1 << r, n |= t[r], e &= ~s;
  return n;
}
function ep(t, e) {
  switch (t) {
    case 1:
    case 2:
    case 4:
      return e + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return e + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function tp(t, e) {
  for (var r = t.suspendedLanes, n = t.pingedLanes, s = t.expirationTimes, i = t.pendingLanes; 0 < i; ) {
    var o = 31 - Je(i), a = 1 << o, l = s[o];
    l === -1 ? (!(a & r) || a & n) && (s[o] = ep(a, e)) : l <= e && (t.expiredLanes |= a), i &= ~a;
  }
}
function Vo(t) {
  return t = t.pendingLanes & -1073741825, t !== 0 ? t : t & 1073741824 ? 1073741824 : 0;
}
function oh() {
  var t = hs;
  return hs <<= 1, !(hs & 4194240) && (hs = 64), t;
}
function eo(t) {
  for (var e = [], r = 0; 31 > r; r++) e.push(t);
  return e;
}
function es(t, e, r) {
  t.pendingLanes |= e, e !== 536870912 && (t.suspendedLanes = 0, t.pingedLanes = 0), t = t.eventTimes, e = 31 - Je(e), t[e] = r;
}
function rp(t, e) {
  var r = t.pendingLanes & ~e;
  t.pendingLanes = e, t.suspendedLanes = 0, t.pingedLanes = 0, t.expiredLanes &= e, t.mutableReadLanes &= e, t.entangledLanes &= e, e = t.entanglements;
  var n = t.eventTimes;
  for (t = t.expirationTimes; 0 < r; ) {
    var s = 31 - Je(r), i = 1 << s;
    e[s] = 0, n[s] = -1, t[s] = -1, r &= ~i;
  }
}
function Wa(t, e) {
  var r = t.entangledLanes |= e;
  for (t = t.entanglements; r; ) {
    var n = 31 - Je(r), s = 1 << n;
    s & e | t[n] & e && (t[n] |= e), r &= ~s;
  }
}
var D = 0;
function ah(t) {
  return t &= -t, 1 < t ? 4 < t ? t & 268435455 ? 16 : 536870912 : 4 : 1;
}
var lh, Va, uh, ch, hh, Ko = !1, fs = [], At = null, Pt = null, jt = null, xn = /* @__PURE__ */ new Map(), An = /* @__PURE__ */ new Map(), bt = [], np = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function Fl(t, e) {
  switch (t) {
    case "focusin":
    case "focusout":
      At = null;
      break;
    case "dragenter":
    case "dragleave":
      Pt = null;
      break;
    case "mouseover":
    case "mouseout":
      jt = null;
      break;
    case "pointerover":
    case "pointerout":
      xn.delete(e.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      An.delete(e.pointerId);
  }
}
function en(t, e, r, n, s, i) {
  return t === null || t.nativeEvent !== i ? (t = { blockedOn: e, domEventName: r, eventSystemFlags: n, nativeEvent: i, targetContainers: [s] }, e !== null && (e = rs(e), e !== null && Va(e)), t) : (t.eventSystemFlags |= n, e = t.targetContainers, s !== null && e.indexOf(s) === -1 && e.push(s), t);
}
function sp(t, e, r, n, s) {
  switch (e) {
    case "focusin":
      return At = en(At, t, e, r, n, s), !0;
    case "dragenter":
      return Pt = en(Pt, t, e, r, n, s), !0;
    case "mouseover":
      return jt = en(jt, t, e, r, n, s), !0;
    case "pointerover":
      var i = s.pointerId;
      return xn.set(i, en(xn.get(i) || null, t, e, r, n, s)), !0;
    case "gotpointercapture":
      return i = s.pointerId, An.set(i, en(An.get(i) || null, t, e, r, n, s)), !0;
  }
  return !1;
}
function dh(t) {
  var e = Qt(t.target);
  if (e !== null) {
    var r = ur(e);
    if (r !== null) {
      if (e = r.tag, e === 13) {
        if (e = eh(r), e !== null) {
          t.blockedOn = e, hh(t.priority, function() {
            uh(r);
          });
          return;
        }
      } else if (e === 3 && r.stateNode.current.memoizedState.isDehydrated) {
        t.blockedOn = r.tag === 3 ? r.stateNode.containerInfo : null;
        return;
      }
    }
  }
  t.blockedOn = null;
}
function Ls(t) {
  if (t.blockedOn !== null) return !1;
  for (var e = t.targetContainers; 0 < e.length; ) {
    var r = qo(t.domEventName, t.eventSystemFlags, e[0], t.nativeEvent);
    if (r === null) {
      r = t.nativeEvent;
      var n = new r.constructor(r.type, r);
      Bo = n, r.target.dispatchEvent(n), Bo = null;
    } else return e = rs(r), e !== null && Va(e), t.blockedOn = r, !1;
    e.shift();
  }
  return !0;
}
function Hl(t, e, r) {
  Ls(t) && r.delete(e);
}
function ip() {
  Ko = !1, At !== null && Ls(At) && (At = null), Pt !== null && Ls(Pt) && (Pt = null), jt !== null && Ls(jt) && (jt = null), xn.forEach(Hl), An.forEach(Hl);
}
function tn(t, e) {
  t.blockedOn === e && (t.blockedOn = null, Ko || (Ko = !0, Ae.unstable_scheduleCallback(Ae.unstable_NormalPriority, ip)));
}
function Pn(t) {
  function e(s) {
    return tn(s, t);
  }
  if (0 < fs.length) {
    tn(fs[0], t);
    for (var r = 1; r < fs.length; r++) {
      var n = fs[r];
      n.blockedOn === t && (n.blockedOn = null);
    }
  }
  for (At !== null && tn(At, t), Pt !== null && tn(Pt, t), jt !== null && tn(jt, t), xn.forEach(e), An.forEach(e), r = 0; r < bt.length; r++) n = bt[r], n.blockedOn === t && (n.blockedOn = null);
  for (; 0 < bt.length && (r = bt[0], r.blockedOn === null); ) dh(r), r.blockedOn === null && bt.shift();
}
var Ir = _t.ReactCurrentBatchConfig, Xs = !0;
function op(t, e, r, n) {
  var s = D, i = Ir.transition;
  Ir.transition = null;
  try {
    D = 1, Ka(t, e, r, n);
  } finally {
    D = s, Ir.transition = i;
  }
}
function ap(t, e, r, n) {
  var s = D, i = Ir.transition;
  Ir.transition = null;
  try {
    D = 4, Ka(t, e, r, n);
  } finally {
    D = s, Ir.transition = i;
  }
}
function Ka(t, e, r, n) {
  if (Xs) {
    var s = qo(t, e, r, n);
    if (s === null) co(t, e, n, Zs, r), Fl(t, n);
    else if (sp(s, t, e, r, n)) n.stopPropagation();
    else if (Fl(t, n), e & 4 && -1 < np.indexOf(t)) {
      for (; s !== null; ) {
        var i = rs(s);
        if (i !== null && lh(i), i = qo(t, e, r, n), i === null && co(t, e, n, Zs, r), i === s) break;
        s = i;
      }
      s !== null && n.stopPropagation();
    } else co(t, e, n, null, r);
  }
}
var Zs = null;
function qo(t, e, r, n) {
  if (Zs = null, t = Fa(n), t = Qt(t), t !== null) if (e = ur(t), e === null) t = null;
  else if (r = e.tag, r === 13) {
    if (t = eh(e), t !== null) return t;
    t = null;
  } else if (r === 3) {
    if (e.stateNode.current.memoizedState.isDehydrated) return e.tag === 3 ? e.stateNode.containerInfo : null;
    t = null;
  } else e !== t && (t = null);
  return Zs = t, null;
}
function fh(t) {
  switch (t) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 4;
    case "message":
      switch (Gf()) {
        case Ha:
          return 1;
        case sh:
          return 4;
        case Qs:
        case Jf:
          return 16;
        case ih:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var Ot = null, qa = null, $s = null;
function ph() {
  if ($s) return $s;
  var t, e = qa, r = e.length, n, s = "value" in Ot ? Ot.value : Ot.textContent, i = s.length;
  for (t = 0; t < r && e[t] === s[t]; t++) ;
  var o = r - t;
  for (n = 1; n <= o && e[r - n] === s[i - n]; n++) ;
  return $s = s.slice(t, 1 < n ? 1 - n : void 0);
}
function Us(t) {
  var e = t.keyCode;
  return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
}
function ps() {
  return !0;
}
function Wl() {
  return !1;
}
function je(t) {
  function e(r, n, s, i, o) {
    this._reactName = r, this._targetInst = s, this.type = n, this.nativeEvent = i, this.target = o, this.currentTarget = null;
    for (var a in t) t.hasOwnProperty(a) && (r = t[a], this[a] = r ? r(i) : i[a]);
    return this.isDefaultPrevented = (i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1) ? ps : Wl, this.isPropagationStopped = Wl, this;
  }
  return K(e.prototype, { preventDefault: function() {
    this.defaultPrevented = !0;
    var r = this.nativeEvent;
    r && (r.preventDefault ? r.preventDefault() : typeof r.returnValue != "unknown" && (r.returnValue = !1), this.isDefaultPrevented = ps);
  }, stopPropagation: function() {
    var r = this.nativeEvent;
    r && (r.stopPropagation ? r.stopPropagation() : typeof r.cancelBubble != "unknown" && (r.cancelBubble = !0), this.isPropagationStopped = ps);
  }, persist: function() {
  }, isPersistent: ps }), e;
}
var qr = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(t) {
  return t.timeStamp || Date.now();
}, defaultPrevented: 0, isTrusted: 0 }, Ga = je(qr), ts = K({}, qr, { view: 0, detail: 0 }), lp = je(ts), to, ro, rn, Oi = K({}, ts, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: Ja, button: 0, buttons: 0, relatedTarget: function(t) {
  return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
}, movementX: function(t) {
  return "movementX" in t ? t.movementX : (t !== rn && (rn && t.type === "mousemove" ? (to = t.screenX - rn.screenX, ro = t.screenY - rn.screenY) : ro = to = 0, rn = t), to);
}, movementY: function(t) {
  return "movementY" in t ? t.movementY : ro;
} }), Vl = je(Oi), up = K({}, Oi, { dataTransfer: 0 }), cp = je(up), hp = K({}, ts, { relatedTarget: 0 }), no = je(hp), dp = K({}, qr, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), fp = je(dp), pp = K({}, qr, { clipboardData: function(t) {
  return "clipboardData" in t ? t.clipboardData : window.clipboardData;
} }), gp = je(pp), mp = K({}, qr, { data: 0 }), Kl = je(mp), vp = {
  Esc: "Escape",
  Spacebar: " ",
  Left: "ArrowLeft",
  Up: "ArrowUp",
  Right: "ArrowRight",
  Down: "ArrowDown",
  Del: "Delete",
  Win: "OS",
  Menu: "ContextMenu",
  Apps: "ContextMenu",
  Scroll: "ScrollLock",
  MozPrintableKey: "Unidentified"
}, yp = {
  8: "Backspace",
  9: "Tab",
  12: "Clear",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  19: "Pause",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
  112: "F1",
  113: "F2",
  114: "F3",
  115: "F4",
  116: "F5",
  117: "F6",
  118: "F7",
  119: "F8",
  120: "F9",
  121: "F10",
  122: "F11",
  123: "F12",
  144: "NumLock",
  145: "ScrollLock",
  224: "Meta"
}, wp = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
function _p(t) {
  var e = this.nativeEvent;
  return e.getModifierState ? e.getModifierState(t) : (t = wp[t]) ? !!e[t] : !1;
}
function Ja() {
  return _p;
}
var kp = K({}, ts, { key: function(t) {
  if (t.key) {
    var e = vp[t.key] || t.key;
    if (e !== "Unidentified") return e;
  }
  return t.type === "keypress" ? (t = Us(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? yp[t.keyCode] || "Unidentified" : "";
}, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: Ja, charCode: function(t) {
  return t.type === "keypress" ? Us(t) : 0;
}, keyCode: function(t) {
  return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
}, which: function(t) {
  return t.type === "keypress" ? Us(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
} }), Sp = je(kp), Ep = K({}, Oi, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), ql = je(Ep), bp = K({}, ts, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: Ja }), Tp = je(bp), Cp = K({}, qr, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), Rp = je(Cp), Op = K({}, Oi, {
  deltaX: function(t) {
    return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
  },
  deltaY: function(t) {
    return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
  },
  deltaZ: 0,
  deltaMode: 0
}), xp = je(Op), Ap = [9, 13, 27, 32], Qa = mt && "CompositionEvent" in window, vn = null;
mt && "documentMode" in document && (vn = document.documentMode);
var Pp = mt && "TextEvent" in window && !vn, gh = mt && (!Qa || vn && 8 < vn && 11 >= vn), Gl = " ", Jl = !1;
function mh(t, e) {
  switch (t) {
    case "keyup":
      return Ap.indexOf(e.keyCode) !== -1;
    case "keydown":
      return e.keyCode !== 229;
    case "keypress":
    case "mousedown":
    case "focusout":
      return !0;
    default:
      return !1;
  }
}
function vh(t) {
  return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
}
var wr = !1;
function jp(t, e) {
  switch (t) {
    case "compositionend":
      return vh(e);
    case "keypress":
      return e.which !== 32 ? null : (Jl = !0, Gl);
    case "textInput":
      return t = e.data, t === Gl && Jl ? null : t;
    default:
      return null;
  }
}
function Ip(t, e) {
  if (wr) return t === "compositionend" || !Qa && mh(t, e) ? (t = ph(), $s = qa = Ot = null, wr = !1, t) : null;
  switch (t) {
    case "paste":
      return null;
    case "keypress":
      if (!(e.ctrlKey || e.altKey || e.metaKey) || e.ctrlKey && e.altKey) {
        if (e.char && 1 < e.char.length) return e.char;
        if (e.which) return String.fromCharCode(e.which);
      }
      return null;
    case "compositionend":
      return gh && e.locale !== "ko" ? null : e.data;
    default:
      return null;
  }
}
var Np = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
function Ql(t) {
  var e = t && t.nodeName && t.nodeName.toLowerCase();
  return e === "input" ? !!Np[t.type] : e === "textarea";
}
function yh(t, e, r, n) {
  Jc(n), e = ei(e, "onChange"), 0 < e.length && (r = new Ga("onChange", "change", null, r, n), t.push({ event: r, listeners: e }));
}
var yn = null, jn = null;
function Lp(t) {
  xh(t, 0);
}
function xi(t) {
  var e = Sr(t);
  if (Fc(e)) return t;
}
function $p(t, e) {
  if (t === "change") return e;
}
var wh = !1;
if (mt) {
  var so;
  if (mt) {
    var io = "oninput" in document;
    if (!io) {
      var Yl = document.createElement("div");
      Yl.setAttribute("oninput", "return;"), io = typeof Yl.oninput == "function";
    }
    so = io;
  } else so = !1;
  wh = so && (!document.documentMode || 9 < document.documentMode);
}
function Xl() {
  yn && (yn.detachEvent("onpropertychange", _h), jn = yn = null);
}
function _h(t) {
  if (t.propertyName === "value" && xi(jn)) {
    var e = [];
    yh(e, jn, t, Fa(t)), Zc(Lp, e);
  }
}
function Up(t, e, r) {
  t === "focusin" ? (Xl(), yn = e, jn = r, yn.attachEvent("onpropertychange", _h)) : t === "focusout" && Xl();
}
function Dp(t) {
  if (t === "selectionchange" || t === "keyup" || t === "keydown") return xi(jn);
}
function Mp(t, e) {
  if (t === "click") return xi(e);
}
function zp(t, e) {
  if (t === "input" || t === "change") return xi(e);
}
function Bp(t, e) {
  return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
}
var Ye = typeof Object.is == "function" ? Object.is : Bp;
function In(t, e) {
  if (Ye(t, e)) return !0;
  if (typeof t != "object" || t === null || typeof e != "object" || e === null) return !1;
  var r = Object.keys(t), n = Object.keys(e);
  if (r.length !== n.length) return !1;
  for (n = 0; n < r.length; n++) {
    var s = r[n];
    if (!xo.call(e, s) || !Ye(t[s], e[s])) return !1;
  }
  return !0;
}
function Zl(t) {
  for (; t && t.firstChild; ) t = t.firstChild;
  return t;
}
function eu(t, e) {
  var r = Zl(t);
  t = 0;
  for (var n; r; ) {
    if (r.nodeType === 3) {
      if (n = t + r.textContent.length, t <= e && n >= e) return { node: r, offset: e - t };
      t = n;
    }
    e: {
      for (; r; ) {
        if (r.nextSibling) {
          r = r.nextSibling;
          break e;
        }
        r = r.parentNode;
      }
      r = void 0;
    }
    r = Zl(r);
  }
}
function kh(t, e) {
  return t && e ? t === e ? !0 : t && t.nodeType === 3 ? !1 : e && e.nodeType === 3 ? kh(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : !1 : !1;
}
function Sh() {
  for (var t = window, e = qs(); e instanceof t.HTMLIFrameElement; ) {
    try {
      var r = typeof e.contentWindow.location.href == "string";
    } catch {
      r = !1;
    }
    if (r) t = e.contentWindow;
    else break;
    e = qs(t.document);
  }
  return e;
}
function Ya(t) {
  var e = t && t.nodeName && t.nodeName.toLowerCase();
  return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
}
function Fp(t) {
  var e = Sh(), r = t.focusedElem, n = t.selectionRange;
  if (e !== r && r && r.ownerDocument && kh(r.ownerDocument.documentElement, r)) {
    if (n !== null && Ya(r)) {
      if (e = n.start, t = n.end, t === void 0 && (t = e), "selectionStart" in r) r.selectionStart = e, r.selectionEnd = Math.min(t, r.value.length);
      else if (t = (e = r.ownerDocument || document) && e.defaultView || window, t.getSelection) {
        t = t.getSelection();
        var s = r.textContent.length, i = Math.min(n.start, s);
        n = n.end === void 0 ? i : Math.min(n.end, s), !t.extend && i > n && (s = n, n = i, i = s), s = eu(r, i);
        var o = eu(
          r,
          n
        );
        s && o && (t.rangeCount !== 1 || t.anchorNode !== s.node || t.anchorOffset !== s.offset || t.focusNode !== o.node || t.focusOffset !== o.offset) && (e = e.createRange(), e.setStart(s.node, s.offset), t.removeAllRanges(), i > n ? (t.addRange(e), t.extend(o.node, o.offset)) : (e.setEnd(o.node, o.offset), t.addRange(e)));
      }
    }
    for (e = [], t = r; t = t.parentNode; ) t.nodeType === 1 && e.push({ element: t, left: t.scrollLeft, top: t.scrollTop });
    for (typeof r.focus == "function" && r.focus(), r = 0; r < e.length; r++) t = e[r], t.element.scrollLeft = t.left, t.element.scrollTop = t.top;
  }
}
var Hp = mt && "documentMode" in document && 11 >= document.documentMode, _r = null, Go = null, wn = null, Jo = !1;
function tu(t, e, r) {
  var n = r.window === r ? r.document : r.nodeType === 9 ? r : r.ownerDocument;
  Jo || _r == null || _r !== qs(n) || (n = _r, "selectionStart" in n && Ya(n) ? n = { start: n.selectionStart, end: n.selectionEnd } : (n = (n.ownerDocument && n.ownerDocument.defaultView || window).getSelection(), n = { anchorNode: n.anchorNode, anchorOffset: n.anchorOffset, focusNode: n.focusNode, focusOffset: n.focusOffset }), wn && In(wn, n) || (wn = n, n = ei(Go, "onSelect"), 0 < n.length && (e = new Ga("onSelect", "select", null, e, r), t.push({ event: e, listeners: n }), e.target = _r)));
}
function gs(t, e) {
  var r = {};
  return r[t.toLowerCase()] = e.toLowerCase(), r["Webkit" + t] = "webkit" + e, r["Moz" + t] = "moz" + e, r;
}
var kr = { animationend: gs("Animation", "AnimationEnd"), animationiteration: gs("Animation", "AnimationIteration"), animationstart: gs("Animation", "AnimationStart"), transitionend: gs("Transition", "TransitionEnd") }, oo = {}, Eh = {};
mt && (Eh = document.createElement("div").style, "AnimationEvent" in window || (delete kr.animationend.animation, delete kr.animationiteration.animation, delete kr.animationstart.animation), "TransitionEvent" in window || delete kr.transitionend.transition);
function Ai(t) {
  if (oo[t]) return oo[t];
  if (!kr[t]) return t;
  var e = kr[t], r;
  for (r in e) if (e.hasOwnProperty(r) && r in Eh) return oo[t] = e[r];
  return t;
}
var bh = Ai("animationend"), Th = Ai("animationiteration"), Ch = Ai("animationstart"), Rh = Ai("transitionend"), Oh = /* @__PURE__ */ new Map(), ru = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function zt(t, e) {
  Oh.set(t, e), lr(e, [t]);
}
for (var ao = 0; ao < ru.length; ao++) {
  var lo = ru[ao], Wp = lo.toLowerCase(), Vp = lo[0].toUpperCase() + lo.slice(1);
  zt(Wp, "on" + Vp);
}
zt(bh, "onAnimationEnd");
zt(Th, "onAnimationIteration");
zt(Ch, "onAnimationStart");
zt("dblclick", "onDoubleClick");
zt("focusin", "onFocus");
zt("focusout", "onBlur");
zt(Rh, "onTransitionEnd");
Dr("onMouseEnter", ["mouseout", "mouseover"]);
Dr("onMouseLeave", ["mouseout", "mouseover"]);
Dr("onPointerEnter", ["pointerout", "pointerover"]);
Dr("onPointerLeave", ["pointerout", "pointerover"]);
lr("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
lr("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
lr("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
lr("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
lr("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
lr("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var hn = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Kp = new Set("cancel close invalid load scroll toggle".split(" ").concat(hn));
function nu(t, e, r) {
  var n = t.type || "unknown-event";
  t.currentTarget = r, Wf(n, e, void 0, t), t.currentTarget = null;
}
function xh(t, e) {
  e = (e & 4) !== 0;
  for (var r = 0; r < t.length; r++) {
    var n = t[r], s = n.event;
    n = n.listeners;
    e: {
      var i = void 0;
      if (e) for (var o = n.length - 1; 0 <= o; o--) {
        var a = n[o], l = a.instance, u = a.currentTarget;
        if (a = a.listener, l !== i && s.isPropagationStopped()) break e;
        nu(s, a, u), i = l;
      }
      else for (o = 0; o < n.length; o++) {
        if (a = n[o], l = a.instance, u = a.currentTarget, a = a.listener, l !== i && s.isPropagationStopped()) break e;
        nu(s, a, u), i = l;
      }
    }
  }
  if (Js) throw t = Wo, Js = !1, Wo = null, t;
}
function B(t, e) {
  var r = e[ea];
  r === void 0 && (r = e[ea] = /* @__PURE__ */ new Set());
  var n = t + "__bubble";
  r.has(n) || (Ah(e, t, 2, !1), r.add(n));
}
function uo(t, e, r) {
  var n = 0;
  e && (n |= 4), Ah(r, t, n, e);
}
var ms = "_reactListening" + Math.random().toString(36).slice(2);
function Nn(t) {
  if (!t[ms]) {
    t[ms] = !0, Uc.forEach(function(r) {
      r !== "selectionchange" && (Kp.has(r) || uo(r, !1, t), uo(r, !0, t));
    });
    var e = t.nodeType === 9 ? t : t.ownerDocument;
    e === null || e[ms] || (e[ms] = !0, uo("selectionchange", !1, e));
  }
}
function Ah(t, e, r, n) {
  switch (fh(e)) {
    case 1:
      var s = op;
      break;
    case 4:
      s = ap;
      break;
    default:
      s = Ka;
  }
  r = s.bind(null, e, r, t), s = void 0, !Ho || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (s = !0), n ? s !== void 0 ? t.addEventListener(e, r, { capture: !0, passive: s }) : t.addEventListener(e, r, !0) : s !== void 0 ? t.addEventListener(e, r, { passive: s }) : t.addEventListener(e, r, !1);
}
function co(t, e, r, n, s) {
  var i = n;
  if (!(e & 1) && !(e & 2) && n !== null) e: for (; ; ) {
    if (n === null) return;
    var o = n.tag;
    if (o === 3 || o === 4) {
      var a = n.stateNode.containerInfo;
      if (a === s || a.nodeType === 8 && a.parentNode === s) break;
      if (o === 4) for (o = n.return; o !== null; ) {
        var l = o.tag;
        if ((l === 3 || l === 4) && (l = o.stateNode.containerInfo, l === s || l.nodeType === 8 && l.parentNode === s)) return;
        o = o.return;
      }
      for (; a !== null; ) {
        if (o = Qt(a), o === null) return;
        if (l = o.tag, l === 5 || l === 6) {
          n = i = o;
          continue e;
        }
        a = a.parentNode;
      }
    }
    n = n.return;
  }
  Zc(function() {
    var u = i, c = Fa(r), h = [];
    e: {
      var d = Oh.get(t);
      if (d !== void 0) {
        var g = Ga, v = t;
        switch (t) {
          case "keypress":
            if (Us(r) === 0) break e;
          case "keydown":
          case "keyup":
            g = Sp;
            break;
          case "focusin":
            v = "focus", g = no;
            break;
          case "focusout":
            v = "blur", g = no;
            break;
          case "beforeblur":
          case "afterblur":
            g = no;
            break;
          case "click":
            if (r.button === 2) break e;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            g = Vl;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            g = cp;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            g = Tp;
            break;
          case bh:
          case Th:
          case Ch:
            g = fp;
            break;
          case Rh:
            g = Rp;
            break;
          case "scroll":
            g = lp;
            break;
          case "wheel":
            g = xp;
            break;
          case "copy":
          case "cut":
          case "paste":
            g = gp;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            g = ql;
        }
        var y = (e & 4) !== 0, k = !y && t === "scroll", f = y ? d !== null ? d + "Capture" : null : d;
        y = [];
        for (var p = u, m; p !== null; ) {
          m = p;
          var w = m.stateNode;
          if (m.tag === 5 && w !== null && (m = w, f !== null && (w = On(p, f), w != null && y.push(Ln(p, w, m)))), k) break;
          p = p.return;
        }
        0 < y.length && (d = new g(d, v, null, r, c), h.push({ event: d, listeners: y }));
      }
    }
    if (!(e & 7)) {
      e: {
        if (d = t === "mouseover" || t === "pointerover", g = t === "mouseout" || t === "pointerout", d && r !== Bo && (v = r.relatedTarget || r.fromElement) && (Qt(v) || v[vt])) break e;
        if ((g || d) && (d = c.window === c ? c : (d = c.ownerDocument) ? d.defaultView || d.parentWindow : window, g ? (v = r.relatedTarget || r.toElement, g = u, v = v ? Qt(v) : null, v !== null && (k = ur(v), v !== k || v.tag !== 5 && v.tag !== 6) && (v = null)) : (g = null, v = u), g !== v)) {
          if (y = Vl, w = "onMouseLeave", f = "onMouseEnter", p = "mouse", (t === "pointerout" || t === "pointerover") && (y = ql, w = "onPointerLeave", f = "onPointerEnter", p = "pointer"), k = g == null ? d : Sr(g), m = v == null ? d : Sr(v), d = new y(w, p + "leave", g, r, c), d.target = k, d.relatedTarget = m, w = null, Qt(c) === u && (y = new y(f, p + "enter", v, r, c), y.target = m, y.relatedTarget = k, w = y), k = w, g && v) t: {
            for (y = g, f = v, p = 0, m = y; m; m = cr(m)) p++;
            for (m = 0, w = f; w; w = cr(w)) m++;
            for (; 0 < p - m; ) y = cr(y), p--;
            for (; 0 < m - p; ) f = cr(f), m--;
            for (; p--; ) {
              if (y === f || f !== null && y === f.alternate) break t;
              y = cr(y), f = cr(f);
            }
            y = null;
          }
          else y = null;
          g !== null && su(h, d, g, y, !1), v !== null && k !== null && su(h, k, v, y, !0);
        }
      }
      e: {
        if (d = u ? Sr(u) : window, g = d.nodeName && d.nodeName.toLowerCase(), g === "select" || g === "input" && d.type === "file") var T = $p;
        else if (Ql(d)) if (wh) T = zp;
        else {
          T = Dp;
          var E = Up;
        }
        else (g = d.nodeName) && g.toLowerCase() === "input" && (d.type === "checkbox" || d.type === "radio") && (T = Mp);
        if (T && (T = T(t, u))) {
          yh(h, T, r, c);
          break e;
        }
        E && E(t, d, u), t === "focusout" && (E = d._wrapperState) && E.controlled && d.type === "number" && $o(d, "number", d.value);
      }
      switch (E = u ? Sr(u) : window, t) {
        case "focusin":
          (Ql(E) || E.contentEditable === "true") && (_r = E, Go = u, wn = null);
          break;
        case "focusout":
          wn = Go = _r = null;
          break;
        case "mousedown":
          Jo = !0;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          Jo = !1, tu(h, r, c);
          break;
        case "selectionchange":
          if (Hp) break;
        case "keydown":
        case "keyup":
          tu(h, r, c);
      }
      var b;
      if (Qa) e: {
        switch (t) {
          case "compositionstart":
            var A = "onCompositionStart";
            break e;
          case "compositionend":
            A = "onCompositionEnd";
            break e;
          case "compositionupdate":
            A = "onCompositionUpdate";
            break e;
        }
        A = void 0;
      }
      else wr ? mh(t, r) && (A = "onCompositionEnd") : t === "keydown" && r.keyCode === 229 && (A = "onCompositionStart");
      A && (gh && r.locale !== "ko" && (wr || A !== "onCompositionStart" ? A === "onCompositionEnd" && wr && (b = ph()) : (Ot = c, qa = "value" in Ot ? Ot.value : Ot.textContent, wr = !0)), E = ei(u, A), 0 < E.length && (A = new Kl(A, t, null, r, c), h.push({ event: A, listeners: E }), b ? A.data = b : (b = vh(r), b !== null && (A.data = b)))), (b = Pp ? jp(t, r) : Ip(t, r)) && (u = ei(u, "onBeforeInput"), 0 < u.length && (c = new Kl("onBeforeInput", "beforeinput", null, r, c), h.push({ event: c, listeners: u }), c.data = b));
    }
    xh(h, e);
  });
}
function Ln(t, e, r) {
  return { instance: t, listener: e, currentTarget: r };
}
function ei(t, e) {
  for (var r = e + "Capture", n = []; t !== null; ) {
    var s = t, i = s.stateNode;
    s.tag === 5 && i !== null && (s = i, i = On(t, r), i != null && n.unshift(Ln(t, i, s)), i = On(t, e), i != null && n.push(Ln(t, i, s))), t = t.return;
  }
  return n;
}
function cr(t) {
  if (t === null) return null;
  do
    t = t.return;
  while (t && t.tag !== 5);
  return t || null;
}
function su(t, e, r, n, s) {
  for (var i = e._reactName, o = []; r !== null && r !== n; ) {
    var a = r, l = a.alternate, u = a.stateNode;
    if (l !== null && l === n) break;
    a.tag === 5 && u !== null && (a = u, s ? (l = On(r, i), l != null && o.unshift(Ln(r, l, a))) : s || (l = On(r, i), l != null && o.push(Ln(r, l, a)))), r = r.return;
  }
  o.length !== 0 && t.push({ event: e, listeners: o });
}
var qp = /\r\n?/g, Gp = /\u0000|\uFFFD/g;
function iu(t) {
  return (typeof t == "string" ? t : "" + t).replace(qp, `
`).replace(Gp, "");
}
function vs(t, e, r) {
  if (e = iu(e), iu(t) !== e && r) throw Error(S(425));
}
function ti() {
}
var Qo = null, Yo = null;
function Xo(t, e) {
  return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
}
var Zo = typeof setTimeout == "function" ? setTimeout : void 0, Jp = typeof clearTimeout == "function" ? clearTimeout : void 0, ou = typeof Promise == "function" ? Promise : void 0, Qp = typeof queueMicrotask == "function" ? queueMicrotask : typeof ou < "u" ? function(t) {
  return ou.resolve(null).then(t).catch(Yp);
} : Zo;
function Yp(t) {
  setTimeout(function() {
    throw t;
  });
}
function ho(t, e) {
  var r = e, n = 0;
  do {
    var s = r.nextSibling;
    if (t.removeChild(r), s && s.nodeType === 8) if (r = s.data, r === "/$") {
      if (n === 0) {
        t.removeChild(s), Pn(e);
        return;
      }
      n--;
    } else r !== "$" && r !== "$?" && r !== "$!" || n++;
    r = s;
  } while (r);
  Pn(e);
}
function It(t) {
  for (; t != null; t = t.nextSibling) {
    var e = t.nodeType;
    if (e === 1 || e === 3) break;
    if (e === 8) {
      if (e = t.data, e === "$" || e === "$!" || e === "$?") break;
      if (e === "/$") return null;
    }
  }
  return t;
}
function au(t) {
  t = t.previousSibling;
  for (var e = 0; t; ) {
    if (t.nodeType === 8) {
      var r = t.data;
      if (r === "$" || r === "$!" || r === "$?") {
        if (e === 0) return t;
        e--;
      } else r === "/$" && e++;
    }
    t = t.previousSibling;
  }
  return null;
}
var Gr = Math.random().toString(36).slice(2), rt = "__reactFiber$" + Gr, $n = "__reactProps$" + Gr, vt = "__reactContainer$" + Gr, ea = "__reactEvents$" + Gr, Xp = "__reactListeners$" + Gr, Zp = "__reactHandles$" + Gr;
function Qt(t) {
  var e = t[rt];
  if (e) return e;
  for (var r = t.parentNode; r; ) {
    if (e = r[vt] || r[rt]) {
      if (r = e.alternate, e.child !== null || r !== null && r.child !== null) for (t = au(t); t !== null; ) {
        if (r = t[rt]) return r;
        t = au(t);
      }
      return e;
    }
    t = r, r = t.parentNode;
  }
  return null;
}
function rs(t) {
  return t = t[rt] || t[vt], !t || t.tag !== 5 && t.tag !== 6 && t.tag !== 13 && t.tag !== 3 ? null : t;
}
function Sr(t) {
  if (t.tag === 5 || t.tag === 6) return t.stateNode;
  throw Error(S(33));
}
function Pi(t) {
  return t[$n] || null;
}
var ta = [], Er = -1;
function Bt(t) {
  return { current: t };
}
function F(t) {
  0 > Er || (t.current = ta[Er], ta[Er] = null, Er--);
}
function z(t, e) {
  Er++, ta[Er] = t.current, t.current = e;
}
var Mt = {}, pe = Bt(Mt), Ee = Bt(!1), nr = Mt;
function Mr(t, e) {
  var r = t.type.contextTypes;
  if (!r) return Mt;
  var n = t.stateNode;
  if (n && n.__reactInternalMemoizedUnmaskedChildContext === e) return n.__reactInternalMemoizedMaskedChildContext;
  var s = {}, i;
  for (i in r) s[i] = e[i];
  return n && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = e, t.__reactInternalMemoizedMaskedChildContext = s), s;
}
function be(t) {
  return t = t.childContextTypes, t != null;
}
function ri() {
  F(Ee), F(pe);
}
function lu(t, e, r) {
  if (pe.current !== Mt) throw Error(S(168));
  z(pe, e), z(Ee, r);
}
function Ph(t, e, r) {
  var n = t.stateNode;
  if (e = e.childContextTypes, typeof n.getChildContext != "function") return r;
  n = n.getChildContext();
  for (var s in n) if (!(s in e)) throw Error(S(108, Uf(t) || "Unknown", s));
  return K({}, r, n);
}
function ni(t) {
  return t = (t = t.stateNode) && t.__reactInternalMemoizedMergedChildContext || Mt, nr = pe.current, z(pe, t), z(Ee, Ee.current), !0;
}
function uu(t, e, r) {
  var n = t.stateNode;
  if (!n) throw Error(S(169));
  r ? (t = Ph(t, e, nr), n.__reactInternalMemoizedMergedChildContext = t, F(Ee), F(pe), z(pe, t)) : F(Ee), z(Ee, r);
}
var ht = null, ji = !1, fo = !1;
function jh(t) {
  ht === null ? ht = [t] : ht.push(t);
}
function eg(t) {
  ji = !0, jh(t);
}
function Ft() {
  if (!fo && ht !== null) {
    fo = !0;
    var t = 0, e = D;
    try {
      var r = ht;
      for (D = 1; t < r.length; t++) {
        var n = r[t];
        do
          n = n(!0);
        while (n !== null);
      }
      ht = null, ji = !1;
    } catch (s) {
      throw ht !== null && (ht = ht.slice(t + 1)), nh(Ha, Ft), s;
    } finally {
      D = e, fo = !1;
    }
  }
  return null;
}
var br = [], Tr = 0, si = null, ii = 0, Ne = [], Le = 0, sr = null, ft = 1, pt = "";
function qt(t, e) {
  br[Tr++] = ii, br[Tr++] = si, si = t, ii = e;
}
function Ih(t, e, r) {
  Ne[Le++] = ft, Ne[Le++] = pt, Ne[Le++] = sr, sr = t;
  var n = ft;
  t = pt;
  var s = 32 - Je(n) - 1;
  n &= ~(1 << s), r += 1;
  var i = 32 - Je(e) + s;
  if (30 < i) {
    var o = s - s % 5;
    i = (n & (1 << o) - 1).toString(32), n >>= o, s -= o, ft = 1 << 32 - Je(e) + s | r << s | n, pt = i + t;
  } else ft = 1 << i | r << s | n, pt = t;
}
function Xa(t) {
  t.return !== null && (qt(t, 1), Ih(t, 1, 0));
}
function Za(t) {
  for (; t === si; ) si = br[--Tr], br[Tr] = null, ii = br[--Tr], br[Tr] = null;
  for (; t === sr; ) sr = Ne[--Le], Ne[Le] = null, pt = Ne[--Le], Ne[Le] = null, ft = Ne[--Le], Ne[Le] = null;
}
var xe = null, Oe = null, H = !1, qe = null;
function Nh(t, e) {
  var r = $e(5, null, null, 0);
  r.elementType = "DELETED", r.stateNode = e, r.return = t, e = t.deletions, e === null ? (t.deletions = [r], t.flags |= 16) : e.push(r);
}
function cu(t, e) {
  switch (t.tag) {
    case 5:
      var r = t.type;
      return e = e.nodeType !== 1 || r.toLowerCase() !== e.nodeName.toLowerCase() ? null : e, e !== null ? (t.stateNode = e, xe = t, Oe = It(e.firstChild), !0) : !1;
    case 6:
      return e = t.pendingProps === "" || e.nodeType !== 3 ? null : e, e !== null ? (t.stateNode = e, xe = t, Oe = null, !0) : !1;
    case 13:
      return e = e.nodeType !== 8 ? null : e, e !== null ? (r = sr !== null ? { id: ft, overflow: pt } : null, t.memoizedState = { dehydrated: e, treeContext: r, retryLane: 1073741824 }, r = $e(18, null, null, 0), r.stateNode = e, r.return = t, t.child = r, xe = t, Oe = null, !0) : !1;
    default:
      return !1;
  }
}
function ra(t) {
  return (t.mode & 1) !== 0 && (t.flags & 128) === 0;
}
function na(t) {
  if (H) {
    var e = Oe;
    if (e) {
      var r = e;
      if (!cu(t, e)) {
        if (ra(t)) throw Error(S(418));
        e = It(r.nextSibling);
        var n = xe;
        e && cu(t, e) ? Nh(n, r) : (t.flags = t.flags & -4097 | 2, H = !1, xe = t);
      }
    } else {
      if (ra(t)) throw Error(S(418));
      t.flags = t.flags & -4097 | 2, H = !1, xe = t;
    }
  }
}
function hu(t) {
  for (t = t.return; t !== null && t.tag !== 5 && t.tag !== 3 && t.tag !== 13; ) t = t.return;
  xe = t;
}
function ys(t) {
  if (t !== xe) return !1;
  if (!H) return hu(t), H = !0, !1;
  var e;
  if ((e = t.tag !== 3) && !(e = t.tag !== 5) && (e = t.type, e = e !== "head" && e !== "body" && !Xo(t.type, t.memoizedProps)), e && (e = Oe)) {
    if (ra(t)) throw Lh(), Error(S(418));
    for (; e; ) Nh(t, e), e = It(e.nextSibling);
  }
  if (hu(t), t.tag === 13) {
    if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(S(317));
    e: {
      for (t = t.nextSibling, e = 0; t; ) {
        if (t.nodeType === 8) {
          var r = t.data;
          if (r === "/$") {
            if (e === 0) {
              Oe = It(t.nextSibling);
              break e;
            }
            e--;
          } else r !== "$" && r !== "$!" && r !== "$?" || e++;
        }
        t = t.nextSibling;
      }
      Oe = null;
    }
  } else Oe = xe ? It(t.stateNode.nextSibling) : null;
  return !0;
}
function Lh() {
  for (var t = Oe; t; ) t = It(t.nextSibling);
}
function zr() {
  Oe = xe = null, H = !1;
}
function el(t) {
  qe === null ? qe = [t] : qe.push(t);
}
var tg = _t.ReactCurrentBatchConfig;
function nn(t, e, r) {
  if (t = r.ref, t !== null && typeof t != "function" && typeof t != "object") {
    if (r._owner) {
      if (r = r._owner, r) {
        if (r.tag !== 1) throw Error(S(309));
        var n = r.stateNode;
      }
      if (!n) throw Error(S(147, t));
      var s = n, i = "" + t;
      return e !== null && e.ref !== null && typeof e.ref == "function" && e.ref._stringRef === i ? e.ref : (e = function(o) {
        var a = s.refs;
        o === null ? delete a[i] : a[i] = o;
      }, e._stringRef = i, e);
    }
    if (typeof t != "string") throw Error(S(284));
    if (!r._owner) throw Error(S(290, t));
  }
  return t;
}
function ws(t, e) {
  throw t = Object.prototype.toString.call(e), Error(S(31, t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t));
}
function du(t) {
  var e = t._init;
  return e(t._payload);
}
function $h(t) {
  function e(f, p) {
    if (t) {
      var m = f.deletions;
      m === null ? (f.deletions = [p], f.flags |= 16) : m.push(p);
    }
  }
  function r(f, p) {
    if (!t) return null;
    for (; p !== null; ) e(f, p), p = p.sibling;
    return null;
  }
  function n(f, p) {
    for (f = /* @__PURE__ */ new Map(); p !== null; ) p.key !== null ? f.set(p.key, p) : f.set(p.index, p), p = p.sibling;
    return f;
  }
  function s(f, p) {
    return f = Ut(f, p), f.index = 0, f.sibling = null, f;
  }
  function i(f, p, m) {
    return f.index = m, t ? (m = f.alternate, m !== null ? (m = m.index, m < p ? (f.flags |= 2, p) : m) : (f.flags |= 2, p)) : (f.flags |= 1048576, p);
  }
  function o(f) {
    return t && f.alternate === null && (f.flags |= 2), f;
  }
  function a(f, p, m, w) {
    return p === null || p.tag !== 6 ? (p = _o(m, f.mode, w), p.return = f, p) : (p = s(p, m), p.return = f, p);
  }
  function l(f, p, m, w) {
    var T = m.type;
    return T === yr ? c(f, p, m.props.children, w, m.key) : p !== null && (p.elementType === T || typeof T == "object" && T !== null && T.$$typeof === St && du(T) === p.type) ? (w = s(p, m.props), w.ref = nn(f, p, m), w.return = f, w) : (w = Ws(m.type, m.key, m.props, null, f.mode, w), w.ref = nn(f, p, m), w.return = f, w);
  }
  function u(f, p, m, w) {
    return p === null || p.tag !== 4 || p.stateNode.containerInfo !== m.containerInfo || p.stateNode.implementation !== m.implementation ? (p = ko(m, f.mode, w), p.return = f, p) : (p = s(p, m.children || []), p.return = f, p);
  }
  function c(f, p, m, w, T) {
    return p === null || p.tag !== 7 ? (p = rr(m, f.mode, w, T), p.return = f, p) : (p = s(p, m), p.return = f, p);
  }
  function h(f, p, m) {
    if (typeof p == "string" && p !== "" || typeof p == "number") return p = _o("" + p, f.mode, m), p.return = f, p;
    if (typeof p == "object" && p !== null) {
      switch (p.$$typeof) {
        case ls:
          return m = Ws(p.type, p.key, p.props, null, f.mode, m), m.ref = nn(f, null, p), m.return = f, m;
        case vr:
          return p = ko(p, f.mode, m), p.return = f, p;
        case St:
          var w = p._init;
          return h(f, w(p._payload), m);
      }
      if (un(p) || Xr(p)) return p = rr(p, f.mode, m, null), p.return = f, p;
      ws(f, p);
    }
    return null;
  }
  function d(f, p, m, w) {
    var T = p !== null ? p.key : null;
    if (typeof m == "string" && m !== "" || typeof m == "number") return T !== null ? null : a(f, p, "" + m, w);
    if (typeof m == "object" && m !== null) {
      switch (m.$$typeof) {
        case ls:
          return m.key === T ? l(f, p, m, w) : null;
        case vr:
          return m.key === T ? u(f, p, m, w) : null;
        case St:
          return T = m._init, d(
            f,
            p,
            T(m._payload),
            w
          );
      }
      if (un(m) || Xr(m)) return T !== null ? null : c(f, p, m, w, null);
      ws(f, m);
    }
    return null;
  }
  function g(f, p, m, w, T) {
    if (typeof w == "string" && w !== "" || typeof w == "number") return f = f.get(m) || null, a(p, f, "" + w, T);
    if (typeof w == "object" && w !== null) {
      switch (w.$$typeof) {
        case ls:
          return f = f.get(w.key === null ? m : w.key) || null, l(p, f, w, T);
        case vr:
          return f = f.get(w.key === null ? m : w.key) || null, u(p, f, w, T);
        case St:
          var E = w._init;
          return g(f, p, m, E(w._payload), T);
      }
      if (un(w) || Xr(w)) return f = f.get(m) || null, c(p, f, w, T, null);
      ws(p, w);
    }
    return null;
  }
  function v(f, p, m, w) {
    for (var T = null, E = null, b = p, A = p = 0, U = null; b !== null && A < m.length; A++) {
      b.index > A ? (U = b, b = null) : U = b.sibling;
      var L = d(f, b, m[A], w);
      if (L === null) {
        b === null && (b = U);
        break;
      }
      t && b && L.alternate === null && e(f, b), p = i(L, p, A), E === null ? T = L : E.sibling = L, E = L, b = U;
    }
    if (A === m.length) return r(f, b), H && qt(f, A), T;
    if (b === null) {
      for (; A < m.length; A++) b = h(f, m[A], w), b !== null && (p = i(b, p, A), E === null ? T = b : E.sibling = b, E = b);
      return H && qt(f, A), T;
    }
    for (b = n(f, b); A < m.length; A++) U = g(b, f, A, m[A], w), U !== null && (t && U.alternate !== null && b.delete(U.key === null ? A : U.key), p = i(U, p, A), E === null ? T = U : E.sibling = U, E = U);
    return t && b.forEach(function(ze) {
      return e(f, ze);
    }), H && qt(f, A), T;
  }
  function y(f, p, m, w) {
    var T = Xr(m);
    if (typeof T != "function") throw Error(S(150));
    if (m = T.call(m), m == null) throw Error(S(151));
    for (var E = T = null, b = p, A = p = 0, U = null, L = m.next(); b !== null && !L.done; A++, L = m.next()) {
      b.index > A ? (U = b, b = null) : U = b.sibling;
      var ze = d(f, b, L.value, w);
      if (ze === null) {
        b === null && (b = U);
        break;
      }
      t && b && ze.alternate === null && e(f, b), p = i(ze, p, A), E === null ? T = ze : E.sibling = ze, E = ze, b = U;
    }
    if (L.done) return r(
      f,
      b
    ), H && qt(f, A), T;
    if (b === null) {
      for (; !L.done; A++, L = m.next()) L = h(f, L.value, w), L !== null && (p = i(L, p, A), E === null ? T = L : E.sibling = L, E = L);
      return H && qt(f, A), T;
    }
    for (b = n(f, b); !L.done; A++, L = m.next()) L = g(b, f, A, L.value, w), L !== null && (t && L.alternate !== null && b.delete(L.key === null ? A : L.key), p = i(L, p, A), E === null ? T = L : E.sibling = L, E = L);
    return t && b.forEach(function(Qr) {
      return e(f, Qr);
    }), H && qt(f, A), T;
  }
  function k(f, p, m, w) {
    if (typeof m == "object" && m !== null && m.type === yr && m.key === null && (m = m.props.children), typeof m == "object" && m !== null) {
      switch (m.$$typeof) {
        case ls:
          e: {
            for (var T = m.key, E = p; E !== null; ) {
              if (E.key === T) {
                if (T = m.type, T === yr) {
                  if (E.tag === 7) {
                    r(f, E.sibling), p = s(E, m.props.children), p.return = f, f = p;
                    break e;
                  }
                } else if (E.elementType === T || typeof T == "object" && T !== null && T.$$typeof === St && du(T) === E.type) {
                  r(f, E.sibling), p = s(E, m.props), p.ref = nn(f, E, m), p.return = f, f = p;
                  break e;
                }
                r(f, E);
                break;
              } else e(f, E);
              E = E.sibling;
            }
            m.type === yr ? (p = rr(m.props.children, f.mode, w, m.key), p.return = f, f = p) : (w = Ws(m.type, m.key, m.props, null, f.mode, w), w.ref = nn(f, p, m), w.return = f, f = w);
          }
          return o(f);
        case vr:
          e: {
            for (E = m.key; p !== null; ) {
              if (p.key === E) if (p.tag === 4 && p.stateNode.containerInfo === m.containerInfo && p.stateNode.implementation === m.implementation) {
                r(f, p.sibling), p = s(p, m.children || []), p.return = f, f = p;
                break e;
              } else {
                r(f, p);
                break;
              }
              else e(f, p);
              p = p.sibling;
            }
            p = ko(m, f.mode, w), p.return = f, f = p;
          }
          return o(f);
        case St:
          return E = m._init, k(f, p, E(m._payload), w);
      }
      if (un(m)) return v(f, p, m, w);
      if (Xr(m)) return y(f, p, m, w);
      ws(f, m);
    }
    return typeof m == "string" && m !== "" || typeof m == "number" ? (m = "" + m, p !== null && p.tag === 6 ? (r(f, p.sibling), p = s(p, m), p.return = f, f = p) : (r(f, p), p = _o(m, f.mode, w), p.return = f, f = p), o(f)) : r(f, p);
  }
  return k;
}
var Br = $h(!0), Uh = $h(!1), oi = Bt(null), ai = null, Cr = null, tl = null;
function rl() {
  tl = Cr = ai = null;
}
function nl(t) {
  var e = oi.current;
  F(oi), t._currentValue = e;
}
function sa(t, e, r) {
  for (; t !== null; ) {
    var n = t.alternate;
    if ((t.childLanes & e) !== e ? (t.childLanes |= e, n !== null && (n.childLanes |= e)) : n !== null && (n.childLanes & e) !== e && (n.childLanes |= e), t === r) break;
    t = t.return;
  }
}
function Nr(t, e) {
  ai = t, tl = Cr = null, t = t.dependencies, t !== null && t.firstContext !== null && (t.lanes & e && (Se = !0), t.firstContext = null);
}
function De(t) {
  var e = t._currentValue;
  if (tl !== t) if (t = { context: t, memoizedValue: e, next: null }, Cr === null) {
    if (ai === null) throw Error(S(308));
    Cr = t, ai.dependencies = { lanes: 0, firstContext: t };
  } else Cr = Cr.next = t;
  return e;
}
var Yt = null;
function sl(t) {
  Yt === null ? Yt = [t] : Yt.push(t);
}
function Dh(t, e, r, n) {
  var s = e.interleaved;
  return s === null ? (r.next = r, sl(e)) : (r.next = s.next, s.next = r), e.interleaved = r, yt(t, n);
}
function yt(t, e) {
  t.lanes |= e;
  var r = t.alternate;
  for (r !== null && (r.lanes |= e), r = t, t = t.return; t !== null; ) t.childLanes |= e, r = t.alternate, r !== null && (r.childLanes |= e), r = t, t = t.return;
  return r.tag === 3 ? r.stateNode : null;
}
var Et = !1;
function il(t) {
  t.updateQueue = { baseState: t.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
}
function Mh(t, e) {
  t = t.updateQueue, e.updateQueue === t && (e.updateQueue = { baseState: t.baseState, firstBaseUpdate: t.firstBaseUpdate, lastBaseUpdate: t.lastBaseUpdate, shared: t.shared, effects: t.effects });
}
function gt(t, e) {
  return { eventTime: t, lane: e, tag: 0, payload: null, callback: null, next: null };
}
function Nt(t, e, r) {
  var n = t.updateQueue;
  if (n === null) return null;
  if (n = n.shared, $ & 2) {
    var s = n.pending;
    return s === null ? e.next = e : (e.next = s.next, s.next = e), n.pending = e, yt(t, r);
  }
  return s = n.interleaved, s === null ? (e.next = e, sl(n)) : (e.next = s.next, s.next = e), n.interleaved = e, yt(t, r);
}
function Ds(t, e, r) {
  if (e = e.updateQueue, e !== null && (e = e.shared, (r & 4194240) !== 0)) {
    var n = e.lanes;
    n &= t.pendingLanes, r |= n, e.lanes = r, Wa(t, r);
  }
}
function fu(t, e) {
  var r = t.updateQueue, n = t.alternate;
  if (n !== null && (n = n.updateQueue, r === n)) {
    var s = null, i = null;
    if (r = r.firstBaseUpdate, r !== null) {
      do {
        var o = { eventTime: r.eventTime, lane: r.lane, tag: r.tag, payload: r.payload, callback: r.callback, next: null };
        i === null ? s = i = o : i = i.next = o, r = r.next;
      } while (r !== null);
      i === null ? s = i = e : i = i.next = e;
    } else s = i = e;
    r = { baseState: n.baseState, firstBaseUpdate: s, lastBaseUpdate: i, shared: n.shared, effects: n.effects }, t.updateQueue = r;
    return;
  }
  t = r.lastBaseUpdate, t === null ? r.firstBaseUpdate = e : t.next = e, r.lastBaseUpdate = e;
}
function li(t, e, r, n) {
  var s = t.updateQueue;
  Et = !1;
  var i = s.firstBaseUpdate, o = s.lastBaseUpdate, a = s.shared.pending;
  if (a !== null) {
    s.shared.pending = null;
    var l = a, u = l.next;
    l.next = null, o === null ? i = u : o.next = u, o = l;
    var c = t.alternate;
    c !== null && (c = c.updateQueue, a = c.lastBaseUpdate, a !== o && (a === null ? c.firstBaseUpdate = u : a.next = u, c.lastBaseUpdate = l));
  }
  if (i !== null) {
    var h = s.baseState;
    o = 0, c = u = l = null, a = i;
    do {
      var d = a.lane, g = a.eventTime;
      if ((n & d) === d) {
        c !== null && (c = c.next = {
          eventTime: g,
          lane: 0,
          tag: a.tag,
          payload: a.payload,
          callback: a.callback,
          next: null
        });
        e: {
          var v = t, y = a;
          switch (d = e, g = r, y.tag) {
            case 1:
              if (v = y.payload, typeof v == "function") {
                h = v.call(g, h, d);
                break e;
              }
              h = v;
              break e;
            case 3:
              v.flags = v.flags & -65537 | 128;
            case 0:
              if (v = y.payload, d = typeof v == "function" ? v.call(g, h, d) : v, d == null) break e;
              h = K({}, h, d);
              break e;
            case 2:
              Et = !0;
          }
        }
        a.callback !== null && a.lane !== 0 && (t.flags |= 64, d = s.effects, d === null ? s.effects = [a] : d.push(a));
      } else g = { eventTime: g, lane: d, tag: a.tag, payload: a.payload, callback: a.callback, next: null }, c === null ? (u = c = g, l = h) : c = c.next = g, o |= d;
      if (a = a.next, a === null) {
        if (a = s.shared.pending, a === null) break;
        d = a, a = d.next, d.next = null, s.lastBaseUpdate = d, s.shared.pending = null;
      }
    } while (!0);
    if (c === null && (l = h), s.baseState = l, s.firstBaseUpdate = u, s.lastBaseUpdate = c, e = s.shared.interleaved, e !== null) {
      s = e;
      do
        o |= s.lane, s = s.next;
      while (s !== e);
    } else i === null && (s.shared.lanes = 0);
    or |= o, t.lanes = o, t.memoizedState = h;
  }
}
function pu(t, e, r) {
  if (t = e.effects, e.effects = null, t !== null) for (e = 0; e < t.length; e++) {
    var n = t[e], s = n.callback;
    if (s !== null) {
      if (n.callback = null, n = r, typeof s != "function") throw Error(S(191, s));
      s.call(n);
    }
  }
}
var ns = {}, st = Bt(ns), Un = Bt(ns), Dn = Bt(ns);
function Xt(t) {
  if (t === ns) throw Error(S(174));
  return t;
}
function ol(t, e) {
  switch (z(Dn, e), z(Un, t), z(st, ns), t = e.nodeType, t) {
    case 9:
    case 11:
      e = (e = e.documentElement) ? e.namespaceURI : Do(null, "");
      break;
    default:
      t = t === 8 ? e.parentNode : e, e = t.namespaceURI || null, t = t.tagName, e = Do(e, t);
  }
  F(st), z(st, e);
}
function Fr() {
  F(st), F(Un), F(Dn);
}
function zh(t) {
  Xt(Dn.current);
  var e = Xt(st.current), r = Do(e, t.type);
  e !== r && (z(Un, t), z(st, r));
}
function al(t) {
  Un.current === t && (F(st), F(Un));
}
var W = Bt(0);
function ui(t) {
  for (var e = t; e !== null; ) {
    if (e.tag === 13) {
      var r = e.memoizedState;
      if (r !== null && (r = r.dehydrated, r === null || r.data === "$?" || r.data === "$!")) return e;
    } else if (e.tag === 19 && e.memoizedProps.revealOrder !== void 0) {
      if (e.flags & 128) return e;
    } else if (e.child !== null) {
      e.child.return = e, e = e.child;
      continue;
    }
    if (e === t) break;
    for (; e.sibling === null; ) {
      if (e.return === null || e.return === t) return null;
      e = e.return;
    }
    e.sibling.return = e.return, e = e.sibling;
  }
  return null;
}
var po = [];
function ll() {
  for (var t = 0; t < po.length; t++) po[t]._workInProgressVersionPrimary = null;
  po.length = 0;
}
var Ms = _t.ReactCurrentDispatcher, go = _t.ReactCurrentBatchConfig, ir = 0, V = null, ee = null, se = null, ci = !1, _n = !1, Mn = 0, rg = 0;
function ce() {
  throw Error(S(321));
}
function ul(t, e) {
  if (e === null) return !1;
  for (var r = 0; r < e.length && r < t.length; r++) if (!Ye(t[r], e[r])) return !1;
  return !0;
}
function cl(t, e, r, n, s, i) {
  if (ir = i, V = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, Ms.current = t === null || t.memoizedState === null ? og : ag, t = r(n, s), _n) {
    i = 0;
    do {
      if (_n = !1, Mn = 0, 25 <= i) throw Error(S(301));
      i += 1, se = ee = null, e.updateQueue = null, Ms.current = lg, t = r(n, s);
    } while (_n);
  }
  if (Ms.current = hi, e = ee !== null && ee.next !== null, ir = 0, se = ee = V = null, ci = !1, e) throw Error(S(300));
  return t;
}
function hl() {
  var t = Mn !== 0;
  return Mn = 0, t;
}
function Ze() {
  var t = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  return se === null ? V.memoizedState = se = t : se = se.next = t, se;
}
function Me() {
  if (ee === null) {
    var t = V.alternate;
    t = t !== null ? t.memoizedState : null;
  } else t = ee.next;
  var e = se === null ? V.memoizedState : se.next;
  if (e !== null) se = e, ee = t;
  else {
    if (t === null) throw Error(S(310));
    ee = t, t = { memoizedState: ee.memoizedState, baseState: ee.baseState, baseQueue: ee.baseQueue, queue: ee.queue, next: null }, se === null ? V.memoizedState = se = t : se = se.next = t;
  }
  return se;
}
function zn(t, e) {
  return typeof e == "function" ? e(t) : e;
}
function mo(t) {
  var e = Me(), r = e.queue;
  if (r === null) throw Error(S(311));
  r.lastRenderedReducer = t;
  var n = ee, s = n.baseQueue, i = r.pending;
  if (i !== null) {
    if (s !== null) {
      var o = s.next;
      s.next = i.next, i.next = o;
    }
    n.baseQueue = s = i, r.pending = null;
  }
  if (s !== null) {
    i = s.next, n = n.baseState;
    var a = o = null, l = null, u = i;
    do {
      var c = u.lane;
      if ((ir & c) === c) l !== null && (l = l.next = { lane: 0, action: u.action, hasEagerState: u.hasEagerState, eagerState: u.eagerState, next: null }), n = u.hasEagerState ? u.eagerState : t(n, u.action);
      else {
        var h = {
          lane: c,
          action: u.action,
          hasEagerState: u.hasEagerState,
          eagerState: u.eagerState,
          next: null
        };
        l === null ? (a = l = h, o = n) : l = l.next = h, V.lanes |= c, or |= c;
      }
      u = u.next;
    } while (u !== null && u !== i);
    l === null ? o = n : l.next = a, Ye(n, e.memoizedState) || (Se = !0), e.memoizedState = n, e.baseState = o, e.baseQueue = l, r.lastRenderedState = n;
  }
  if (t = r.interleaved, t !== null) {
    s = t;
    do
      i = s.lane, V.lanes |= i, or |= i, s = s.next;
    while (s !== t);
  } else s === null && (r.lanes = 0);
  return [e.memoizedState, r.dispatch];
}
function vo(t) {
  var e = Me(), r = e.queue;
  if (r === null) throw Error(S(311));
  r.lastRenderedReducer = t;
  var n = r.dispatch, s = r.pending, i = e.memoizedState;
  if (s !== null) {
    r.pending = null;
    var o = s = s.next;
    do
      i = t(i, o.action), o = o.next;
    while (o !== s);
    Ye(i, e.memoizedState) || (Se = !0), e.memoizedState = i, e.baseQueue === null && (e.baseState = i), r.lastRenderedState = i;
  }
  return [i, n];
}
function Bh() {
}
function Fh(t, e) {
  var r = V, n = Me(), s = e(), i = !Ye(n.memoizedState, s);
  if (i && (n.memoizedState = s, Se = !0), n = n.queue, dl(Vh.bind(null, r, n, t), [t]), n.getSnapshot !== e || i || se !== null && se.memoizedState.tag & 1) {
    if (r.flags |= 2048, Bn(9, Wh.bind(null, r, n, s, e), void 0, null), ie === null) throw Error(S(349));
    ir & 30 || Hh(r, e, s);
  }
  return s;
}
function Hh(t, e, r) {
  t.flags |= 16384, t = { getSnapshot: e, value: r }, e = V.updateQueue, e === null ? (e = { lastEffect: null, stores: null }, V.updateQueue = e, e.stores = [t]) : (r = e.stores, r === null ? e.stores = [t] : r.push(t));
}
function Wh(t, e, r, n) {
  e.value = r, e.getSnapshot = n, Kh(e) && qh(t);
}
function Vh(t, e, r) {
  return r(function() {
    Kh(e) && qh(t);
  });
}
function Kh(t) {
  var e = t.getSnapshot;
  t = t.value;
  try {
    var r = e();
    return !Ye(t, r);
  } catch {
    return !0;
  }
}
function qh(t) {
  var e = yt(t, 1);
  e !== null && Qe(e, t, 1, -1);
}
function gu(t) {
  var e = Ze();
  return typeof t == "function" && (t = t()), e.memoizedState = e.baseState = t, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: zn, lastRenderedState: t }, e.queue = t, t = t.dispatch = ig.bind(null, V, t), [e.memoizedState, t];
}
function Bn(t, e, r, n) {
  return t = { tag: t, create: e, destroy: r, deps: n, next: null }, e = V.updateQueue, e === null ? (e = { lastEffect: null, stores: null }, V.updateQueue = e, e.lastEffect = t.next = t) : (r = e.lastEffect, r === null ? e.lastEffect = t.next = t : (n = r.next, r.next = t, t.next = n, e.lastEffect = t)), t;
}
function Gh() {
  return Me().memoizedState;
}
function zs(t, e, r, n) {
  var s = Ze();
  V.flags |= t, s.memoizedState = Bn(1 | e, r, void 0, n === void 0 ? null : n);
}
function Ii(t, e, r, n) {
  var s = Me();
  n = n === void 0 ? null : n;
  var i = void 0;
  if (ee !== null) {
    var o = ee.memoizedState;
    if (i = o.destroy, n !== null && ul(n, o.deps)) {
      s.memoizedState = Bn(e, r, i, n);
      return;
    }
  }
  V.flags |= t, s.memoizedState = Bn(1 | e, r, i, n);
}
function mu(t, e) {
  return zs(8390656, 8, t, e);
}
function dl(t, e) {
  return Ii(2048, 8, t, e);
}
function Jh(t, e) {
  return Ii(4, 2, t, e);
}
function Qh(t, e) {
  return Ii(4, 4, t, e);
}
function Yh(t, e) {
  if (typeof e == "function") return t = t(), e(t), function() {
    e(null);
  };
  if (e != null) return t = t(), e.current = t, function() {
    e.current = null;
  };
}
function Xh(t, e, r) {
  return r = r != null ? r.concat([t]) : null, Ii(4, 4, Yh.bind(null, e, t), r);
}
function fl() {
}
function Zh(t, e) {
  var r = Me();
  e = e === void 0 ? null : e;
  var n = r.memoizedState;
  return n !== null && e !== null && ul(e, n[1]) ? n[0] : (r.memoizedState = [t, e], t);
}
function ed(t, e) {
  var r = Me();
  e = e === void 0 ? null : e;
  var n = r.memoizedState;
  return n !== null && e !== null && ul(e, n[1]) ? n[0] : (t = t(), r.memoizedState = [t, e], t);
}
function td(t, e, r) {
  return ir & 21 ? (Ye(r, e) || (r = oh(), V.lanes |= r, or |= r, t.baseState = !0), e) : (t.baseState && (t.baseState = !1, Se = !0), t.memoizedState = r);
}
function ng(t, e) {
  var r = D;
  D = r !== 0 && 4 > r ? r : 4, t(!0);
  var n = go.transition;
  go.transition = {};
  try {
    t(!1), e();
  } finally {
    D = r, go.transition = n;
  }
}
function rd() {
  return Me().memoizedState;
}
function sg(t, e, r) {
  var n = $t(t);
  if (r = { lane: n, action: r, hasEagerState: !1, eagerState: null, next: null }, nd(t)) sd(e, r);
  else if (r = Dh(t, e, r, n), r !== null) {
    var s = me();
    Qe(r, t, n, s), id(r, e, n);
  }
}
function ig(t, e, r) {
  var n = $t(t), s = { lane: n, action: r, hasEagerState: !1, eagerState: null, next: null };
  if (nd(t)) sd(e, s);
  else {
    var i = t.alternate;
    if (t.lanes === 0 && (i === null || i.lanes === 0) && (i = e.lastRenderedReducer, i !== null)) try {
      var o = e.lastRenderedState, a = i(o, r);
      if (s.hasEagerState = !0, s.eagerState = a, Ye(a, o)) {
        var l = e.interleaved;
        l === null ? (s.next = s, sl(e)) : (s.next = l.next, l.next = s), e.interleaved = s;
        return;
      }
    } catch {
    } finally {
    }
    r = Dh(t, e, s, n), r !== null && (s = me(), Qe(r, t, n, s), id(r, e, n));
  }
}
function nd(t) {
  var e = t.alternate;
  return t === V || e !== null && e === V;
}
function sd(t, e) {
  _n = ci = !0;
  var r = t.pending;
  r === null ? e.next = e : (e.next = r.next, r.next = e), t.pending = e;
}
function id(t, e, r) {
  if (r & 4194240) {
    var n = e.lanes;
    n &= t.pendingLanes, r |= n, e.lanes = r, Wa(t, r);
  }
}
var hi = { readContext: De, useCallback: ce, useContext: ce, useEffect: ce, useImperativeHandle: ce, useInsertionEffect: ce, useLayoutEffect: ce, useMemo: ce, useReducer: ce, useRef: ce, useState: ce, useDebugValue: ce, useDeferredValue: ce, useTransition: ce, useMutableSource: ce, useSyncExternalStore: ce, useId: ce, unstable_isNewReconciler: !1 }, og = { readContext: De, useCallback: function(t, e) {
  return Ze().memoizedState = [t, e === void 0 ? null : e], t;
}, useContext: De, useEffect: mu, useImperativeHandle: function(t, e, r) {
  return r = r != null ? r.concat([t]) : null, zs(
    4194308,
    4,
    Yh.bind(null, e, t),
    r
  );
}, useLayoutEffect: function(t, e) {
  return zs(4194308, 4, t, e);
}, useInsertionEffect: function(t, e) {
  return zs(4, 2, t, e);
}, useMemo: function(t, e) {
  var r = Ze();
  return e = e === void 0 ? null : e, t = t(), r.memoizedState = [t, e], t;
}, useReducer: function(t, e, r) {
  var n = Ze();
  return e = r !== void 0 ? r(e) : e, n.memoizedState = n.baseState = e, t = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: t, lastRenderedState: e }, n.queue = t, t = t.dispatch = sg.bind(null, V, t), [n.memoizedState, t];
}, useRef: function(t) {
  var e = Ze();
  return t = { current: t }, e.memoizedState = t;
}, useState: gu, useDebugValue: fl, useDeferredValue: function(t) {
  return Ze().memoizedState = t;
}, useTransition: function() {
  var t = gu(!1), e = t[0];
  return t = ng.bind(null, t[1]), Ze().memoizedState = t, [e, t];
}, useMutableSource: function() {
}, useSyncExternalStore: function(t, e, r) {
  var n = V, s = Ze();
  if (H) {
    if (r === void 0) throw Error(S(407));
    r = r();
  } else {
    if (r = e(), ie === null) throw Error(S(349));
    ir & 30 || Hh(n, e, r);
  }
  s.memoizedState = r;
  var i = { value: r, getSnapshot: e };
  return s.queue = i, mu(Vh.bind(
    null,
    n,
    i,
    t
  ), [t]), n.flags |= 2048, Bn(9, Wh.bind(null, n, i, r, e), void 0, null), r;
}, useId: function() {
  var t = Ze(), e = ie.identifierPrefix;
  if (H) {
    var r = pt, n = ft;
    r = (n & ~(1 << 32 - Je(n) - 1)).toString(32) + r, e = ":" + e + "R" + r, r = Mn++, 0 < r && (e += "H" + r.toString(32)), e += ":";
  } else r = rg++, e = ":" + e + "r" + r.toString(32) + ":";
  return t.memoizedState = e;
}, unstable_isNewReconciler: !1 }, ag = {
  readContext: De,
  useCallback: Zh,
  useContext: De,
  useEffect: dl,
  useImperativeHandle: Xh,
  useInsertionEffect: Jh,
  useLayoutEffect: Qh,
  useMemo: ed,
  useReducer: mo,
  useRef: Gh,
  useState: function() {
    return mo(zn);
  },
  useDebugValue: fl,
  useDeferredValue: function(t) {
    var e = Me();
    return td(e, ee.memoizedState, t);
  },
  useTransition: function() {
    var t = mo(zn)[0], e = Me().memoizedState;
    return [t, e];
  },
  useMutableSource: Bh,
  useSyncExternalStore: Fh,
  useId: rd,
  unstable_isNewReconciler: !1
}, lg = { readContext: De, useCallback: Zh, useContext: De, useEffect: dl, useImperativeHandle: Xh, useInsertionEffect: Jh, useLayoutEffect: Qh, useMemo: ed, useReducer: vo, useRef: Gh, useState: function() {
  return vo(zn);
}, useDebugValue: fl, useDeferredValue: function(t) {
  var e = Me();
  return ee === null ? e.memoizedState = t : td(e, ee.memoizedState, t);
}, useTransition: function() {
  var t = vo(zn)[0], e = Me().memoizedState;
  return [t, e];
}, useMutableSource: Bh, useSyncExternalStore: Fh, useId: rd, unstable_isNewReconciler: !1 };
function We(t, e) {
  if (t && t.defaultProps) {
    e = K({}, e), t = t.defaultProps;
    for (var r in t) e[r] === void 0 && (e[r] = t[r]);
    return e;
  }
  return e;
}
function ia(t, e, r, n) {
  e = t.memoizedState, r = r(n, e), r = r == null ? e : K({}, e, r), t.memoizedState = r, t.lanes === 0 && (t.updateQueue.baseState = r);
}
var Ni = { isMounted: function(t) {
  return (t = t._reactInternals) ? ur(t) === t : !1;
}, enqueueSetState: function(t, e, r) {
  t = t._reactInternals;
  var n = me(), s = $t(t), i = gt(n, s);
  i.payload = e, r != null && (i.callback = r), e = Nt(t, i, s), e !== null && (Qe(e, t, s, n), Ds(e, t, s));
}, enqueueReplaceState: function(t, e, r) {
  t = t._reactInternals;
  var n = me(), s = $t(t), i = gt(n, s);
  i.tag = 1, i.payload = e, r != null && (i.callback = r), e = Nt(t, i, s), e !== null && (Qe(e, t, s, n), Ds(e, t, s));
}, enqueueForceUpdate: function(t, e) {
  t = t._reactInternals;
  var r = me(), n = $t(t), s = gt(r, n);
  s.tag = 2, e != null && (s.callback = e), e = Nt(t, s, n), e !== null && (Qe(e, t, n, r), Ds(e, t, n));
} };
function vu(t, e, r, n, s, i, o) {
  return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(n, i, o) : e.prototype && e.prototype.isPureReactComponent ? !In(r, n) || !In(s, i) : !0;
}
function od(t, e, r) {
  var n = !1, s = Mt, i = e.contextType;
  return typeof i == "object" && i !== null ? i = De(i) : (s = be(e) ? nr : pe.current, n = e.contextTypes, i = (n = n != null) ? Mr(t, s) : Mt), e = new e(r, i), t.memoizedState = e.state !== null && e.state !== void 0 ? e.state : null, e.updater = Ni, t.stateNode = e, e._reactInternals = t, n && (t = t.stateNode, t.__reactInternalMemoizedUnmaskedChildContext = s, t.__reactInternalMemoizedMaskedChildContext = i), e;
}
function yu(t, e, r, n) {
  t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(r, n), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(r, n), e.state !== t && Ni.enqueueReplaceState(e, e.state, null);
}
function oa(t, e, r, n) {
  var s = t.stateNode;
  s.props = r, s.state = t.memoizedState, s.refs = {}, il(t);
  var i = e.contextType;
  typeof i == "object" && i !== null ? s.context = De(i) : (i = be(e) ? nr : pe.current, s.context = Mr(t, i)), s.state = t.memoizedState, i = e.getDerivedStateFromProps, typeof i == "function" && (ia(t, e, i, r), s.state = t.memoizedState), typeof e.getDerivedStateFromProps == "function" || typeof s.getSnapshotBeforeUpdate == "function" || typeof s.UNSAFE_componentWillMount != "function" && typeof s.componentWillMount != "function" || (e = s.state, typeof s.componentWillMount == "function" && s.componentWillMount(), typeof s.UNSAFE_componentWillMount == "function" && s.UNSAFE_componentWillMount(), e !== s.state && Ni.enqueueReplaceState(s, s.state, null), li(t, r, s, n), s.state = t.memoizedState), typeof s.componentDidMount == "function" && (t.flags |= 4194308);
}
function Hr(t, e) {
  try {
    var r = "", n = e;
    do
      r += $f(n), n = n.return;
    while (n);
    var s = r;
  } catch (i) {
    s = `
Error generating stack: ` + i.message + `
` + i.stack;
  }
  return { value: t, source: e, stack: s, digest: null };
}
function yo(t, e, r) {
  return { value: t, source: null, stack: r ?? null, digest: e ?? null };
}
function aa(t, e) {
  try {
    console.error(e.value);
  } catch (r) {
    setTimeout(function() {
      throw r;
    });
  }
}
var ug = typeof WeakMap == "function" ? WeakMap : Map;
function ad(t, e, r) {
  r = gt(-1, r), r.tag = 3, r.payload = { element: null };
  var n = e.value;
  return r.callback = function() {
    fi || (fi = !0, va = n), aa(t, e);
  }, r;
}
function ld(t, e, r) {
  r = gt(-1, r), r.tag = 3;
  var n = t.type.getDerivedStateFromError;
  if (typeof n == "function") {
    var s = e.value;
    r.payload = function() {
      return n(s);
    }, r.callback = function() {
      aa(t, e);
    };
  }
  var i = t.stateNode;
  return i !== null && typeof i.componentDidCatch == "function" && (r.callback = function() {
    aa(t, e), typeof n != "function" && (Lt === null ? Lt = /* @__PURE__ */ new Set([this]) : Lt.add(this));
    var o = e.stack;
    this.componentDidCatch(e.value, { componentStack: o !== null ? o : "" });
  }), r;
}
function wu(t, e, r) {
  var n = t.pingCache;
  if (n === null) {
    n = t.pingCache = new ug();
    var s = /* @__PURE__ */ new Set();
    n.set(e, s);
  } else s = n.get(e), s === void 0 && (s = /* @__PURE__ */ new Set(), n.set(e, s));
  s.has(r) || (s.add(r), t = Eg.bind(null, t, e, r), e.then(t, t));
}
function _u(t) {
  do {
    var e;
    if ((e = t.tag === 13) && (e = t.memoizedState, e = e !== null ? e.dehydrated !== null : !0), e) return t;
    t = t.return;
  } while (t !== null);
  return null;
}
function ku(t, e, r, n, s) {
  return t.mode & 1 ? (t.flags |= 65536, t.lanes = s, t) : (t === e ? t.flags |= 65536 : (t.flags |= 128, r.flags |= 131072, r.flags &= -52805, r.tag === 1 && (r.alternate === null ? r.tag = 17 : (e = gt(-1, 1), e.tag = 2, Nt(r, e, 1))), r.lanes |= 1), t);
}
var cg = _t.ReactCurrentOwner, Se = !1;
function ge(t, e, r, n) {
  e.child = t === null ? Uh(e, null, r, n) : Br(e, t.child, r, n);
}
function Su(t, e, r, n, s) {
  r = r.render;
  var i = e.ref;
  return Nr(e, s), n = cl(t, e, r, n, i, s), r = hl(), t !== null && !Se ? (e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~s, wt(t, e, s)) : (H && r && Xa(e), e.flags |= 1, ge(t, e, n, s), e.child);
}
function Eu(t, e, r, n, s) {
  if (t === null) {
    var i = r.type;
    return typeof i == "function" && !kl(i) && i.defaultProps === void 0 && r.compare === null && r.defaultProps === void 0 ? (e.tag = 15, e.type = i, ud(t, e, i, n, s)) : (t = Ws(r.type, null, n, e, e.mode, s), t.ref = e.ref, t.return = e, e.child = t);
  }
  if (i = t.child, !(t.lanes & s)) {
    var o = i.memoizedProps;
    if (r = r.compare, r = r !== null ? r : In, r(o, n) && t.ref === e.ref) return wt(t, e, s);
  }
  return e.flags |= 1, t = Ut(i, n), t.ref = e.ref, t.return = e, e.child = t;
}
function ud(t, e, r, n, s) {
  if (t !== null) {
    var i = t.memoizedProps;
    if (In(i, n) && t.ref === e.ref) if (Se = !1, e.pendingProps = n = i, (t.lanes & s) !== 0) t.flags & 131072 && (Se = !0);
    else return e.lanes = t.lanes, wt(t, e, s);
  }
  return la(t, e, r, n, s);
}
function cd(t, e, r) {
  var n = e.pendingProps, s = n.children, i = t !== null ? t.memoizedState : null;
  if (n.mode === "hidden") if (!(e.mode & 1)) e.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, z(Or, Ce), Ce |= r;
  else {
    if (!(r & 1073741824)) return t = i !== null ? i.baseLanes | r : r, e.lanes = e.childLanes = 1073741824, e.memoizedState = { baseLanes: t, cachePool: null, transitions: null }, e.updateQueue = null, z(Or, Ce), Ce |= t, null;
    e.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, n = i !== null ? i.baseLanes : r, z(Or, Ce), Ce |= n;
  }
  else i !== null ? (n = i.baseLanes | r, e.memoizedState = null) : n = r, z(Or, Ce), Ce |= n;
  return ge(t, e, s, r), e.child;
}
function hd(t, e) {
  var r = e.ref;
  (t === null && r !== null || t !== null && t.ref !== r) && (e.flags |= 512, e.flags |= 2097152);
}
function la(t, e, r, n, s) {
  var i = be(r) ? nr : pe.current;
  return i = Mr(e, i), Nr(e, s), r = cl(t, e, r, n, i, s), n = hl(), t !== null && !Se ? (e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~s, wt(t, e, s)) : (H && n && Xa(e), e.flags |= 1, ge(t, e, r, s), e.child);
}
function bu(t, e, r, n, s) {
  if (be(r)) {
    var i = !0;
    ni(e);
  } else i = !1;
  if (Nr(e, s), e.stateNode === null) Bs(t, e), od(e, r, n), oa(e, r, n, s), n = !0;
  else if (t === null) {
    var o = e.stateNode, a = e.memoizedProps;
    o.props = a;
    var l = o.context, u = r.contextType;
    typeof u == "object" && u !== null ? u = De(u) : (u = be(r) ? nr : pe.current, u = Mr(e, u));
    var c = r.getDerivedStateFromProps, h = typeof c == "function" || typeof o.getSnapshotBeforeUpdate == "function";
    h || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (a !== n || l !== u) && yu(e, o, n, u), Et = !1;
    var d = e.memoizedState;
    o.state = d, li(e, n, o, s), l = e.memoizedState, a !== n || d !== l || Ee.current || Et ? (typeof c == "function" && (ia(e, r, c, n), l = e.memoizedState), (a = Et || vu(e, r, a, n, d, l, u)) ? (h || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = n, e.memoizedState = l), o.props = n, o.state = l, o.context = u, n = a) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), n = !1);
  } else {
    o = e.stateNode, Mh(t, e), a = e.memoizedProps, u = e.type === e.elementType ? a : We(e.type, a), o.props = u, h = e.pendingProps, d = o.context, l = r.contextType, typeof l == "object" && l !== null ? l = De(l) : (l = be(r) ? nr : pe.current, l = Mr(e, l));
    var g = r.getDerivedStateFromProps;
    (c = typeof g == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (a !== h || d !== l) && yu(e, o, n, l), Et = !1, d = e.memoizedState, o.state = d, li(e, n, o, s);
    var v = e.memoizedState;
    a !== h || d !== v || Ee.current || Et ? (typeof g == "function" && (ia(e, r, g, n), v = e.memoizedState), (u = Et || vu(e, r, u, n, d, v, l) || !1) ? (c || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(n, v, l), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(n, v, l)), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || a === t.memoizedProps && d === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || a === t.memoizedProps && d === t.memoizedState || (e.flags |= 1024), e.memoizedProps = n, e.memoizedState = v), o.props = n, o.state = v, o.context = l, n = u) : (typeof o.componentDidUpdate != "function" || a === t.memoizedProps && d === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || a === t.memoizedProps && d === t.memoizedState || (e.flags |= 1024), n = !1);
  }
  return ua(t, e, r, n, i, s);
}
function ua(t, e, r, n, s, i) {
  hd(t, e);
  var o = (e.flags & 128) !== 0;
  if (!n && !o) return s && uu(e, r, !1), wt(t, e, i);
  n = e.stateNode, cg.current = e;
  var a = o && typeof r.getDerivedStateFromError != "function" ? null : n.render();
  return e.flags |= 1, t !== null && o ? (e.child = Br(e, t.child, null, i), e.child = Br(e, null, a, i)) : ge(t, e, a, i), e.memoizedState = n.state, s && uu(e, r, !0), e.child;
}
function dd(t) {
  var e = t.stateNode;
  e.pendingContext ? lu(t, e.pendingContext, e.pendingContext !== e.context) : e.context && lu(t, e.context, !1), ol(t, e.containerInfo);
}
function Tu(t, e, r, n, s) {
  return zr(), el(s), e.flags |= 256, ge(t, e, r, n), e.child;
}
var ca = { dehydrated: null, treeContext: null, retryLane: 0 };
function ha(t) {
  return { baseLanes: t, cachePool: null, transitions: null };
}
function fd(t, e, r) {
  var n = e.pendingProps, s = W.current, i = !1, o = (e.flags & 128) !== 0, a;
  if ((a = o) || (a = t !== null && t.memoizedState === null ? !1 : (s & 2) !== 0), a ? (i = !0, e.flags &= -129) : (t === null || t.memoizedState !== null) && (s |= 1), z(W, s & 1), t === null)
    return na(e), t = e.memoizedState, t !== null && (t = t.dehydrated, t !== null) ? (e.mode & 1 ? t.data === "$!" ? e.lanes = 8 : e.lanes = 1073741824 : e.lanes = 1, null) : (o = n.children, t = n.fallback, i ? (n = e.mode, i = e.child, o = { mode: "hidden", children: o }, !(n & 1) && i !== null ? (i.childLanes = 0, i.pendingProps = o) : i = Ui(o, n, 0, null), t = rr(t, n, r, null), i.return = e, t.return = e, i.sibling = t, e.child = i, e.child.memoizedState = ha(r), e.memoizedState = ca, t) : pl(e, o));
  if (s = t.memoizedState, s !== null && (a = s.dehydrated, a !== null)) return hg(t, e, o, n, a, s, r);
  if (i) {
    i = n.fallback, o = e.mode, s = t.child, a = s.sibling;
    var l = { mode: "hidden", children: n.children };
    return !(o & 1) && e.child !== s ? (n = e.child, n.childLanes = 0, n.pendingProps = l, e.deletions = null) : (n = Ut(s, l), n.subtreeFlags = s.subtreeFlags & 14680064), a !== null ? i = Ut(a, i) : (i = rr(i, o, r, null), i.flags |= 2), i.return = e, n.return = e, n.sibling = i, e.child = n, n = i, i = e.child, o = t.child.memoizedState, o = o === null ? ha(r) : { baseLanes: o.baseLanes | r, cachePool: null, transitions: o.transitions }, i.memoizedState = o, i.childLanes = t.childLanes & ~r, e.memoizedState = ca, n;
  }
  return i = t.child, t = i.sibling, n = Ut(i, { mode: "visible", children: n.children }), !(e.mode & 1) && (n.lanes = r), n.return = e, n.sibling = null, t !== null && (r = e.deletions, r === null ? (e.deletions = [t], e.flags |= 16) : r.push(t)), e.child = n, e.memoizedState = null, n;
}
function pl(t, e) {
  return e = Ui({ mode: "visible", children: e }, t.mode, 0, null), e.return = t, t.child = e;
}
function _s(t, e, r, n) {
  return n !== null && el(n), Br(e, t.child, null, r), t = pl(e, e.pendingProps.children), t.flags |= 2, e.memoizedState = null, t;
}
function hg(t, e, r, n, s, i, o) {
  if (r)
    return e.flags & 256 ? (e.flags &= -257, n = yo(Error(S(422))), _s(t, e, o, n)) : e.memoizedState !== null ? (e.child = t.child, e.flags |= 128, null) : (i = n.fallback, s = e.mode, n = Ui({ mode: "visible", children: n.children }, s, 0, null), i = rr(i, s, o, null), i.flags |= 2, n.return = e, i.return = e, n.sibling = i, e.child = n, e.mode & 1 && Br(e, t.child, null, o), e.child.memoizedState = ha(o), e.memoizedState = ca, i);
  if (!(e.mode & 1)) return _s(t, e, o, null);
  if (s.data === "$!") {
    if (n = s.nextSibling && s.nextSibling.dataset, n) var a = n.dgst;
    return n = a, i = Error(S(419)), n = yo(i, n, void 0), _s(t, e, o, n);
  }
  if (a = (o & t.childLanes) !== 0, Se || a) {
    if (n = ie, n !== null) {
      switch (o & -o) {
        case 4:
          s = 2;
          break;
        case 16:
          s = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          s = 32;
          break;
        case 536870912:
          s = 268435456;
          break;
        default:
          s = 0;
      }
      s = s & (n.suspendedLanes | o) ? 0 : s, s !== 0 && s !== i.retryLane && (i.retryLane = s, yt(t, s), Qe(n, t, s, -1));
    }
    return _l(), n = yo(Error(S(421))), _s(t, e, o, n);
  }
  return s.data === "$?" ? (e.flags |= 128, e.child = t.child, e = bg.bind(null, t), s._reactRetry = e, null) : (t = i.treeContext, Oe = It(s.nextSibling), xe = e, H = !0, qe = null, t !== null && (Ne[Le++] = ft, Ne[Le++] = pt, Ne[Le++] = sr, ft = t.id, pt = t.overflow, sr = e), e = pl(e, n.children), e.flags |= 4096, e);
}
function Cu(t, e, r) {
  t.lanes |= e;
  var n = t.alternate;
  n !== null && (n.lanes |= e), sa(t.return, e, r);
}
function wo(t, e, r, n, s) {
  var i = t.memoizedState;
  i === null ? t.memoizedState = { isBackwards: e, rendering: null, renderingStartTime: 0, last: n, tail: r, tailMode: s } : (i.isBackwards = e, i.rendering = null, i.renderingStartTime = 0, i.last = n, i.tail = r, i.tailMode = s);
}
function pd(t, e, r) {
  var n = e.pendingProps, s = n.revealOrder, i = n.tail;
  if (ge(t, e, n.children, r), n = W.current, n & 2) n = n & 1 | 2, e.flags |= 128;
  else {
    if (t !== null && t.flags & 128) e: for (t = e.child; t !== null; ) {
      if (t.tag === 13) t.memoizedState !== null && Cu(t, r, e);
      else if (t.tag === 19) Cu(t, r, e);
      else if (t.child !== null) {
        t.child.return = t, t = t.child;
        continue;
      }
      if (t === e) break e;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) break e;
        t = t.return;
      }
      t.sibling.return = t.return, t = t.sibling;
    }
    n &= 1;
  }
  if (z(W, n), !(e.mode & 1)) e.memoizedState = null;
  else switch (s) {
    case "forwards":
      for (r = e.child, s = null; r !== null; ) t = r.alternate, t !== null && ui(t) === null && (s = r), r = r.sibling;
      r = s, r === null ? (s = e.child, e.child = null) : (s = r.sibling, r.sibling = null), wo(e, !1, s, r, i);
      break;
    case "backwards":
      for (r = null, s = e.child, e.child = null; s !== null; ) {
        if (t = s.alternate, t !== null && ui(t) === null) {
          e.child = s;
          break;
        }
        t = s.sibling, s.sibling = r, r = s, s = t;
      }
      wo(e, !0, r, null, i);
      break;
    case "together":
      wo(e, !1, null, null, void 0);
      break;
    default:
      e.memoizedState = null;
  }
  return e.child;
}
function Bs(t, e) {
  !(e.mode & 1) && t !== null && (t.alternate = null, e.alternate = null, e.flags |= 2);
}
function wt(t, e, r) {
  if (t !== null && (e.dependencies = t.dependencies), or |= e.lanes, !(r & e.childLanes)) return null;
  if (t !== null && e.child !== t.child) throw Error(S(153));
  if (e.child !== null) {
    for (t = e.child, r = Ut(t, t.pendingProps), e.child = r, r.return = e; t.sibling !== null; ) t = t.sibling, r = r.sibling = Ut(t, t.pendingProps), r.return = e;
    r.sibling = null;
  }
  return e.child;
}
function dg(t, e, r) {
  switch (e.tag) {
    case 3:
      dd(e), zr();
      break;
    case 5:
      zh(e);
      break;
    case 1:
      be(e.type) && ni(e);
      break;
    case 4:
      ol(e, e.stateNode.containerInfo);
      break;
    case 10:
      var n = e.type._context, s = e.memoizedProps.value;
      z(oi, n._currentValue), n._currentValue = s;
      break;
    case 13:
      if (n = e.memoizedState, n !== null)
        return n.dehydrated !== null ? (z(W, W.current & 1), e.flags |= 128, null) : r & e.child.childLanes ? fd(t, e, r) : (z(W, W.current & 1), t = wt(t, e, r), t !== null ? t.sibling : null);
      z(W, W.current & 1);
      break;
    case 19:
      if (n = (r & e.childLanes) !== 0, t.flags & 128) {
        if (n) return pd(t, e, r);
        e.flags |= 128;
      }
      if (s = e.memoizedState, s !== null && (s.rendering = null, s.tail = null, s.lastEffect = null), z(W, W.current), n) break;
      return null;
    case 22:
    case 23:
      return e.lanes = 0, cd(t, e, r);
  }
  return wt(t, e, r);
}
var gd, da, md, vd;
gd = function(t, e) {
  for (var r = e.child; r !== null; ) {
    if (r.tag === 5 || r.tag === 6) t.appendChild(r.stateNode);
    else if (r.tag !== 4 && r.child !== null) {
      r.child.return = r, r = r.child;
      continue;
    }
    if (r === e) break;
    for (; r.sibling === null; ) {
      if (r.return === null || r.return === e) return;
      r = r.return;
    }
    r.sibling.return = r.return, r = r.sibling;
  }
};
da = function() {
};
md = function(t, e, r, n) {
  var s = t.memoizedProps;
  if (s !== n) {
    t = e.stateNode, Xt(st.current);
    var i = null;
    switch (r) {
      case "input":
        s = No(t, s), n = No(t, n), i = [];
        break;
      case "select":
        s = K({}, s, { value: void 0 }), n = K({}, n, { value: void 0 }), i = [];
        break;
      case "textarea":
        s = Uo(t, s), n = Uo(t, n), i = [];
        break;
      default:
        typeof s.onClick != "function" && typeof n.onClick == "function" && (t.onclick = ti);
    }
    Mo(r, n);
    var o;
    r = null;
    for (u in s) if (!n.hasOwnProperty(u) && s.hasOwnProperty(u) && s[u] != null) if (u === "style") {
      var a = s[u];
      for (o in a) a.hasOwnProperty(o) && (r || (r = {}), r[o] = "");
    } else u !== "dangerouslySetInnerHTML" && u !== "children" && u !== "suppressContentEditableWarning" && u !== "suppressHydrationWarning" && u !== "autoFocus" && (Cn.hasOwnProperty(u) ? i || (i = []) : (i = i || []).push(u, null));
    for (u in n) {
      var l = n[u];
      if (a = s != null ? s[u] : void 0, n.hasOwnProperty(u) && l !== a && (l != null || a != null)) if (u === "style") if (a) {
        for (o in a) !a.hasOwnProperty(o) || l && l.hasOwnProperty(o) || (r || (r = {}), r[o] = "");
        for (o in l) l.hasOwnProperty(o) && a[o] !== l[o] && (r || (r = {}), r[o] = l[o]);
      } else r || (i || (i = []), i.push(
        u,
        r
      )), r = l;
      else u === "dangerouslySetInnerHTML" ? (l = l ? l.__html : void 0, a = a ? a.__html : void 0, l != null && a !== l && (i = i || []).push(u, l)) : u === "children" ? typeof l != "string" && typeof l != "number" || (i = i || []).push(u, "" + l) : u !== "suppressContentEditableWarning" && u !== "suppressHydrationWarning" && (Cn.hasOwnProperty(u) ? (l != null && u === "onScroll" && B("scroll", t), i || a === l || (i = [])) : (i = i || []).push(u, l));
    }
    r && (i = i || []).push("style", r);
    var u = i;
    (e.updateQueue = u) && (e.flags |= 4);
  }
};
vd = function(t, e, r, n) {
  r !== n && (e.flags |= 4);
};
function sn(t, e) {
  if (!H) switch (t.tailMode) {
    case "hidden":
      e = t.tail;
      for (var r = null; e !== null; ) e.alternate !== null && (r = e), e = e.sibling;
      r === null ? t.tail = null : r.sibling = null;
      break;
    case "collapsed":
      r = t.tail;
      for (var n = null; r !== null; ) r.alternate !== null && (n = r), r = r.sibling;
      n === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : n.sibling = null;
  }
}
function he(t) {
  var e = t.alternate !== null && t.alternate.child === t.child, r = 0, n = 0;
  if (e) for (var s = t.child; s !== null; ) r |= s.lanes | s.childLanes, n |= s.subtreeFlags & 14680064, n |= s.flags & 14680064, s.return = t, s = s.sibling;
  else for (s = t.child; s !== null; ) r |= s.lanes | s.childLanes, n |= s.subtreeFlags, n |= s.flags, s.return = t, s = s.sibling;
  return t.subtreeFlags |= n, t.childLanes = r, e;
}
function fg(t, e, r) {
  var n = e.pendingProps;
  switch (Za(e), e.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return he(e), null;
    case 1:
      return be(e.type) && ri(), he(e), null;
    case 3:
      return n = e.stateNode, Fr(), F(Ee), F(pe), ll(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (t === null || t.child === null) && (ys(e) ? e.flags |= 4 : t === null || t.memoizedState.isDehydrated && !(e.flags & 256) || (e.flags |= 1024, qe !== null && (_a(qe), qe = null))), da(t, e), he(e), null;
    case 5:
      al(e);
      var s = Xt(Dn.current);
      if (r = e.type, t !== null && e.stateNode != null) md(t, e, r, n, s), t.ref !== e.ref && (e.flags |= 512, e.flags |= 2097152);
      else {
        if (!n) {
          if (e.stateNode === null) throw Error(S(166));
          return he(e), null;
        }
        if (t = Xt(st.current), ys(e)) {
          n = e.stateNode, r = e.type;
          var i = e.memoizedProps;
          switch (n[rt] = e, n[$n] = i, t = (e.mode & 1) !== 0, r) {
            case "dialog":
              B("cancel", n), B("close", n);
              break;
            case "iframe":
            case "object":
            case "embed":
              B("load", n);
              break;
            case "video":
            case "audio":
              for (s = 0; s < hn.length; s++) B(hn[s], n);
              break;
            case "source":
              B("error", n);
              break;
            case "img":
            case "image":
            case "link":
              B(
                "error",
                n
              ), B("load", n);
              break;
            case "details":
              B("toggle", n);
              break;
            case "input":
              Ll(n, i), B("invalid", n);
              break;
            case "select":
              n._wrapperState = { wasMultiple: !!i.multiple }, B("invalid", n);
              break;
            case "textarea":
              Ul(n, i), B("invalid", n);
          }
          Mo(r, i), s = null;
          for (var o in i) if (i.hasOwnProperty(o)) {
            var a = i[o];
            o === "children" ? typeof a == "string" ? n.textContent !== a && (i.suppressHydrationWarning !== !0 && vs(n.textContent, a, t), s = ["children", a]) : typeof a == "number" && n.textContent !== "" + a && (i.suppressHydrationWarning !== !0 && vs(
              n.textContent,
              a,
              t
            ), s = ["children", "" + a]) : Cn.hasOwnProperty(o) && a != null && o === "onScroll" && B("scroll", n);
          }
          switch (r) {
            case "input":
              us(n), $l(n, i, !0);
              break;
            case "textarea":
              us(n), Dl(n);
              break;
            case "select":
            case "option":
              break;
            default:
              typeof i.onClick == "function" && (n.onclick = ti);
          }
          n = s, e.updateQueue = n, n !== null && (e.flags |= 4);
        } else {
          o = s.nodeType === 9 ? s : s.ownerDocument, t === "http://www.w3.org/1999/xhtml" && (t = Vc(r)), t === "http://www.w3.org/1999/xhtml" ? r === "script" ? (t = o.createElement("div"), t.innerHTML = "<script><\/script>", t = t.removeChild(t.firstChild)) : typeof n.is == "string" ? t = o.createElement(r, { is: n.is }) : (t = o.createElement(r), r === "select" && (o = t, n.multiple ? o.multiple = !0 : n.size && (o.size = n.size))) : t = o.createElementNS(t, r), t[rt] = e, t[$n] = n, gd(t, e, !1, !1), e.stateNode = t;
          e: {
            switch (o = zo(r, n), r) {
              case "dialog":
                B("cancel", t), B("close", t), s = n;
                break;
              case "iframe":
              case "object":
              case "embed":
                B("load", t), s = n;
                break;
              case "video":
              case "audio":
                for (s = 0; s < hn.length; s++) B(hn[s], t);
                s = n;
                break;
              case "source":
                B("error", t), s = n;
                break;
              case "img":
              case "image":
              case "link":
                B(
                  "error",
                  t
                ), B("load", t), s = n;
                break;
              case "details":
                B("toggle", t), s = n;
                break;
              case "input":
                Ll(t, n), s = No(t, n), B("invalid", t);
                break;
              case "option":
                s = n;
                break;
              case "select":
                t._wrapperState = { wasMultiple: !!n.multiple }, s = K({}, n, { value: void 0 }), B("invalid", t);
                break;
              case "textarea":
                Ul(t, n), s = Uo(t, n), B("invalid", t);
                break;
              default:
                s = n;
            }
            Mo(r, s), a = s;
            for (i in a) if (a.hasOwnProperty(i)) {
              var l = a[i];
              i === "style" ? Gc(t, l) : i === "dangerouslySetInnerHTML" ? (l = l ? l.__html : void 0, l != null && Kc(t, l)) : i === "children" ? typeof l == "string" ? (r !== "textarea" || l !== "") && Rn(t, l) : typeof l == "number" && Rn(t, "" + l) : i !== "suppressContentEditableWarning" && i !== "suppressHydrationWarning" && i !== "autoFocus" && (Cn.hasOwnProperty(i) ? l != null && i === "onScroll" && B("scroll", t) : l != null && Da(t, i, l, o));
            }
            switch (r) {
              case "input":
                us(t), $l(t, n, !1);
                break;
              case "textarea":
                us(t), Dl(t);
                break;
              case "option":
                n.value != null && t.setAttribute("value", "" + Dt(n.value));
                break;
              case "select":
                t.multiple = !!n.multiple, i = n.value, i != null ? Ar(t, !!n.multiple, i, !1) : n.defaultValue != null && Ar(
                  t,
                  !!n.multiple,
                  n.defaultValue,
                  !0
                );
                break;
              default:
                typeof s.onClick == "function" && (t.onclick = ti);
            }
            switch (r) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                n = !!n.autoFocus;
                break e;
              case "img":
                n = !0;
                break e;
              default:
                n = !1;
            }
          }
          n && (e.flags |= 4);
        }
        e.ref !== null && (e.flags |= 512, e.flags |= 2097152);
      }
      return he(e), null;
    case 6:
      if (t && e.stateNode != null) vd(t, e, t.memoizedProps, n);
      else {
        if (typeof n != "string" && e.stateNode === null) throw Error(S(166));
        if (r = Xt(Dn.current), Xt(st.current), ys(e)) {
          if (n = e.stateNode, r = e.memoizedProps, n[rt] = e, (i = n.nodeValue !== r) && (t = xe, t !== null)) switch (t.tag) {
            case 3:
              vs(n.nodeValue, r, (t.mode & 1) !== 0);
              break;
            case 5:
              t.memoizedProps.suppressHydrationWarning !== !0 && vs(n.nodeValue, r, (t.mode & 1) !== 0);
          }
          i && (e.flags |= 4);
        } else n = (r.nodeType === 9 ? r : r.ownerDocument).createTextNode(n), n[rt] = e, e.stateNode = n;
      }
      return he(e), null;
    case 13:
      if (F(W), n = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
        if (H && Oe !== null && e.mode & 1 && !(e.flags & 128)) Lh(), zr(), e.flags |= 98560, i = !1;
        else if (i = ys(e), n !== null && n.dehydrated !== null) {
          if (t === null) {
            if (!i) throw Error(S(318));
            if (i = e.memoizedState, i = i !== null ? i.dehydrated : null, !i) throw Error(S(317));
            i[rt] = e;
          } else zr(), !(e.flags & 128) && (e.memoizedState = null), e.flags |= 4;
          he(e), i = !1;
        } else qe !== null && (_a(qe), qe = null), i = !0;
        if (!i) return e.flags & 65536 ? e : null;
      }
      return e.flags & 128 ? (e.lanes = r, e) : (n = n !== null, n !== (t !== null && t.memoizedState !== null) && n && (e.child.flags |= 8192, e.mode & 1 && (t === null || W.current & 1 ? te === 0 && (te = 3) : _l())), e.updateQueue !== null && (e.flags |= 4), he(e), null);
    case 4:
      return Fr(), da(t, e), t === null && Nn(e.stateNode.containerInfo), he(e), null;
    case 10:
      return nl(e.type._context), he(e), null;
    case 17:
      return be(e.type) && ri(), he(e), null;
    case 19:
      if (F(W), i = e.memoizedState, i === null) return he(e), null;
      if (n = (e.flags & 128) !== 0, o = i.rendering, o === null) if (n) sn(i, !1);
      else {
        if (te !== 0 || t !== null && t.flags & 128) for (t = e.child; t !== null; ) {
          if (o = ui(t), o !== null) {
            for (e.flags |= 128, sn(i, !1), n = o.updateQueue, n !== null && (e.updateQueue = n, e.flags |= 4), e.subtreeFlags = 0, n = r, r = e.child; r !== null; ) i = r, t = n, i.flags &= 14680066, o = i.alternate, o === null ? (i.childLanes = 0, i.lanes = t, i.child = null, i.subtreeFlags = 0, i.memoizedProps = null, i.memoizedState = null, i.updateQueue = null, i.dependencies = null, i.stateNode = null) : (i.childLanes = o.childLanes, i.lanes = o.lanes, i.child = o.child, i.subtreeFlags = 0, i.deletions = null, i.memoizedProps = o.memoizedProps, i.memoizedState = o.memoizedState, i.updateQueue = o.updateQueue, i.type = o.type, t = o.dependencies, i.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }), r = r.sibling;
            return z(W, W.current & 1 | 2), e.child;
          }
          t = t.sibling;
        }
        i.tail !== null && Q() > Wr && (e.flags |= 128, n = !0, sn(i, !1), e.lanes = 4194304);
      }
      else {
        if (!n) if (t = ui(o), t !== null) {
          if (e.flags |= 128, n = !0, r = t.updateQueue, r !== null && (e.updateQueue = r, e.flags |= 4), sn(i, !0), i.tail === null && i.tailMode === "hidden" && !o.alternate && !H) return he(e), null;
        } else 2 * Q() - i.renderingStartTime > Wr && r !== 1073741824 && (e.flags |= 128, n = !0, sn(i, !1), e.lanes = 4194304);
        i.isBackwards ? (o.sibling = e.child, e.child = o) : (r = i.last, r !== null ? r.sibling = o : e.child = o, i.last = o);
      }
      return i.tail !== null ? (e = i.tail, i.rendering = e, i.tail = e.sibling, i.renderingStartTime = Q(), e.sibling = null, r = W.current, z(W, n ? r & 1 | 2 : r & 1), e) : (he(e), null);
    case 22:
    case 23:
      return wl(), n = e.memoizedState !== null, t !== null && t.memoizedState !== null !== n && (e.flags |= 8192), n && e.mode & 1 ? Ce & 1073741824 && (he(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : he(e), null;
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(S(156, e.tag));
}
function pg(t, e) {
  switch (Za(e), e.tag) {
    case 1:
      return be(e.type) && ri(), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
    case 3:
      return Fr(), F(Ee), F(pe), ll(), t = e.flags, t & 65536 && !(t & 128) ? (e.flags = t & -65537 | 128, e) : null;
    case 5:
      return al(e), null;
    case 13:
      if (F(W), t = e.memoizedState, t !== null && t.dehydrated !== null) {
        if (e.alternate === null) throw Error(S(340));
        zr();
      }
      return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
    case 19:
      return F(W), null;
    case 4:
      return Fr(), null;
    case 10:
      return nl(e.type._context), null;
    case 22:
    case 23:
      return wl(), null;
    case 24:
      return null;
    default:
      return null;
  }
}
var ks = !1, fe = !1, gg = typeof WeakSet == "function" ? WeakSet : Set, R = null;
function Rr(t, e) {
  var r = t.ref;
  if (r !== null) if (typeof r == "function") try {
    r(null);
  } catch (n) {
    G(t, e, n);
  }
  else r.current = null;
}
function fa(t, e, r) {
  try {
    r();
  } catch (n) {
    G(t, e, n);
  }
}
var Ru = !1;
function mg(t, e) {
  if (Qo = Xs, t = Sh(), Ya(t)) {
    if ("selectionStart" in t) var r = { start: t.selectionStart, end: t.selectionEnd };
    else e: {
      r = (r = t.ownerDocument) && r.defaultView || window;
      var n = r.getSelection && r.getSelection();
      if (n && n.rangeCount !== 0) {
        r = n.anchorNode;
        var s = n.anchorOffset, i = n.focusNode;
        n = n.focusOffset;
        try {
          r.nodeType, i.nodeType;
        } catch {
          r = null;
          break e;
        }
        var o = 0, a = -1, l = -1, u = 0, c = 0, h = t, d = null;
        t: for (; ; ) {
          for (var g; h !== r || s !== 0 && h.nodeType !== 3 || (a = o + s), h !== i || n !== 0 && h.nodeType !== 3 || (l = o + n), h.nodeType === 3 && (o += h.nodeValue.length), (g = h.firstChild) !== null; )
            d = h, h = g;
          for (; ; ) {
            if (h === t) break t;
            if (d === r && ++u === s && (a = o), d === i && ++c === n && (l = o), (g = h.nextSibling) !== null) break;
            h = d, d = h.parentNode;
          }
          h = g;
        }
        r = a === -1 || l === -1 ? null : { start: a, end: l };
      } else r = null;
    }
    r = r || { start: 0, end: 0 };
  } else r = null;
  for (Yo = { focusedElem: t, selectionRange: r }, Xs = !1, R = e; R !== null; ) if (e = R, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null) t.return = e, R = t;
  else for (; R !== null; ) {
    e = R;
    try {
      var v = e.alternate;
      if (e.flags & 1024) switch (e.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if (v !== null) {
            var y = v.memoizedProps, k = v.memoizedState, f = e.stateNode, p = f.getSnapshotBeforeUpdate(e.elementType === e.type ? y : We(e.type, y), k);
            f.__reactInternalSnapshotBeforeUpdate = p;
          }
          break;
        case 3:
          var m = e.stateNode.containerInfo;
          m.nodeType === 1 ? m.textContent = "" : m.nodeType === 9 && m.documentElement && m.removeChild(m.documentElement);
          break;
        case 5:
        case 6:
        case 4:
        case 17:
          break;
        default:
          throw Error(S(163));
      }
    } catch (w) {
      G(e, e.return, w);
    }
    if (t = e.sibling, t !== null) {
      t.return = e.return, R = t;
      break;
    }
    R = e.return;
  }
  return v = Ru, Ru = !1, v;
}
function kn(t, e, r) {
  var n = e.updateQueue;
  if (n = n !== null ? n.lastEffect : null, n !== null) {
    var s = n = n.next;
    do {
      if ((s.tag & t) === t) {
        var i = s.destroy;
        s.destroy = void 0, i !== void 0 && fa(e, r, i);
      }
      s = s.next;
    } while (s !== n);
  }
}
function Li(t, e) {
  if (e = e.updateQueue, e = e !== null ? e.lastEffect : null, e !== null) {
    var r = e = e.next;
    do {
      if ((r.tag & t) === t) {
        var n = r.create;
        r.destroy = n();
      }
      r = r.next;
    } while (r !== e);
  }
}
function pa(t) {
  var e = t.ref;
  if (e !== null) {
    var r = t.stateNode;
    switch (t.tag) {
      case 5:
        t = r;
        break;
      default:
        t = r;
    }
    typeof e == "function" ? e(t) : e.current = t;
  }
}
function yd(t) {
  var e = t.alternate;
  e !== null && (t.alternate = null, yd(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && (delete e[rt], delete e[$n], delete e[ea], delete e[Xp], delete e[Zp])), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
}
function wd(t) {
  return t.tag === 5 || t.tag === 3 || t.tag === 4;
}
function Ou(t) {
  e: for (; ; ) {
    for (; t.sibling === null; ) {
      if (t.return === null || wd(t.return)) return null;
      t = t.return;
    }
    for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
      if (t.flags & 2 || t.child === null || t.tag === 4) continue e;
      t.child.return = t, t = t.child;
    }
    if (!(t.flags & 2)) return t.stateNode;
  }
}
function ga(t, e, r) {
  var n = t.tag;
  if (n === 5 || n === 6) t = t.stateNode, e ? r.nodeType === 8 ? r.parentNode.insertBefore(t, e) : r.insertBefore(t, e) : (r.nodeType === 8 ? (e = r.parentNode, e.insertBefore(t, r)) : (e = r, e.appendChild(t)), r = r._reactRootContainer, r != null || e.onclick !== null || (e.onclick = ti));
  else if (n !== 4 && (t = t.child, t !== null)) for (ga(t, e, r), t = t.sibling; t !== null; ) ga(t, e, r), t = t.sibling;
}
function ma(t, e, r) {
  var n = t.tag;
  if (n === 5 || n === 6) t = t.stateNode, e ? r.insertBefore(t, e) : r.appendChild(t);
  else if (n !== 4 && (t = t.child, t !== null)) for (ma(t, e, r), t = t.sibling; t !== null; ) ma(t, e, r), t = t.sibling;
}
var ae = null, Ke = !1;
function kt(t, e, r) {
  for (r = r.child; r !== null; ) _d(t, e, r), r = r.sibling;
}
function _d(t, e, r) {
  if (nt && typeof nt.onCommitFiberUnmount == "function") try {
    nt.onCommitFiberUnmount(Ri, r);
  } catch {
  }
  switch (r.tag) {
    case 5:
      fe || Rr(r, e);
    case 6:
      var n = ae, s = Ke;
      ae = null, kt(t, e, r), ae = n, Ke = s, ae !== null && (Ke ? (t = ae, r = r.stateNode, t.nodeType === 8 ? t.parentNode.removeChild(r) : t.removeChild(r)) : ae.removeChild(r.stateNode));
      break;
    case 18:
      ae !== null && (Ke ? (t = ae, r = r.stateNode, t.nodeType === 8 ? ho(t.parentNode, r) : t.nodeType === 1 && ho(t, r), Pn(t)) : ho(ae, r.stateNode));
      break;
    case 4:
      n = ae, s = Ke, ae = r.stateNode.containerInfo, Ke = !0, kt(t, e, r), ae = n, Ke = s;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (!fe && (n = r.updateQueue, n !== null && (n = n.lastEffect, n !== null))) {
        s = n = n.next;
        do {
          var i = s, o = i.destroy;
          i = i.tag, o !== void 0 && (i & 2 || i & 4) && fa(r, e, o), s = s.next;
        } while (s !== n);
      }
      kt(t, e, r);
      break;
    case 1:
      if (!fe && (Rr(r, e), n = r.stateNode, typeof n.componentWillUnmount == "function")) try {
        n.props = r.memoizedProps, n.state = r.memoizedState, n.componentWillUnmount();
      } catch (a) {
        G(r, e, a);
      }
      kt(t, e, r);
      break;
    case 21:
      kt(t, e, r);
      break;
    case 22:
      r.mode & 1 ? (fe = (n = fe) || r.memoizedState !== null, kt(t, e, r), fe = n) : kt(t, e, r);
      break;
    default:
      kt(t, e, r);
  }
}
function xu(t) {
  var e = t.updateQueue;
  if (e !== null) {
    t.updateQueue = null;
    var r = t.stateNode;
    r === null && (r = t.stateNode = new gg()), e.forEach(function(n) {
      var s = Tg.bind(null, t, n);
      r.has(n) || (r.add(n), n.then(s, s));
    });
  }
}
function Be(t, e) {
  var r = e.deletions;
  if (r !== null) for (var n = 0; n < r.length; n++) {
    var s = r[n];
    try {
      var i = t, o = e, a = o;
      e: for (; a !== null; ) {
        switch (a.tag) {
          case 5:
            ae = a.stateNode, Ke = !1;
            break e;
          case 3:
            ae = a.stateNode.containerInfo, Ke = !0;
            break e;
          case 4:
            ae = a.stateNode.containerInfo, Ke = !0;
            break e;
        }
        a = a.return;
      }
      if (ae === null) throw Error(S(160));
      _d(i, o, s), ae = null, Ke = !1;
      var l = s.alternate;
      l !== null && (l.return = null), s.return = null;
    } catch (u) {
      G(s, e, u);
    }
  }
  if (e.subtreeFlags & 12854) for (e = e.child; e !== null; ) kd(e, t), e = e.sibling;
}
function kd(t, e) {
  var r = t.alternate, n = t.flags;
  switch (t.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      if (Be(e, t), Xe(t), n & 4) {
        try {
          kn(3, t, t.return), Li(3, t);
        } catch (y) {
          G(t, t.return, y);
        }
        try {
          kn(5, t, t.return);
        } catch (y) {
          G(t, t.return, y);
        }
      }
      break;
    case 1:
      Be(e, t), Xe(t), n & 512 && r !== null && Rr(r, r.return);
      break;
    case 5:
      if (Be(e, t), Xe(t), n & 512 && r !== null && Rr(r, r.return), t.flags & 32) {
        var s = t.stateNode;
        try {
          Rn(s, "");
        } catch (y) {
          G(t, t.return, y);
        }
      }
      if (n & 4 && (s = t.stateNode, s != null)) {
        var i = t.memoizedProps, o = r !== null ? r.memoizedProps : i, a = t.type, l = t.updateQueue;
        if (t.updateQueue = null, l !== null) try {
          a === "input" && i.type === "radio" && i.name != null && Hc(s, i), zo(a, o);
          var u = zo(a, i);
          for (o = 0; o < l.length; o += 2) {
            var c = l[o], h = l[o + 1];
            c === "style" ? Gc(s, h) : c === "dangerouslySetInnerHTML" ? Kc(s, h) : c === "children" ? Rn(s, h) : Da(s, c, h, u);
          }
          switch (a) {
            case "input":
              Lo(s, i);
              break;
            case "textarea":
              Wc(s, i);
              break;
            case "select":
              var d = s._wrapperState.wasMultiple;
              s._wrapperState.wasMultiple = !!i.multiple;
              var g = i.value;
              g != null ? Ar(s, !!i.multiple, g, !1) : d !== !!i.multiple && (i.defaultValue != null ? Ar(
                s,
                !!i.multiple,
                i.defaultValue,
                !0
              ) : Ar(s, !!i.multiple, i.multiple ? [] : "", !1));
          }
          s[$n] = i;
        } catch (y) {
          G(t, t.return, y);
        }
      }
      break;
    case 6:
      if (Be(e, t), Xe(t), n & 4) {
        if (t.stateNode === null) throw Error(S(162));
        s = t.stateNode, i = t.memoizedProps;
        try {
          s.nodeValue = i;
        } catch (y) {
          G(t, t.return, y);
        }
      }
      break;
    case 3:
      if (Be(e, t), Xe(t), n & 4 && r !== null && r.memoizedState.isDehydrated) try {
        Pn(e.containerInfo);
      } catch (y) {
        G(t, t.return, y);
      }
      break;
    case 4:
      Be(e, t), Xe(t);
      break;
    case 13:
      Be(e, t), Xe(t), s = t.child, s.flags & 8192 && (i = s.memoizedState !== null, s.stateNode.isHidden = i, !i || s.alternate !== null && s.alternate.memoizedState !== null || (vl = Q())), n & 4 && xu(t);
      break;
    case 22:
      if (c = r !== null && r.memoizedState !== null, t.mode & 1 ? (fe = (u = fe) || c, Be(e, t), fe = u) : Be(e, t), Xe(t), n & 8192) {
        if (u = t.memoizedState !== null, (t.stateNode.isHidden = u) && !c && t.mode & 1) for (R = t, c = t.child; c !== null; ) {
          for (h = R = c; R !== null; ) {
            switch (d = R, g = d.child, d.tag) {
              case 0:
              case 11:
              case 14:
              case 15:
                kn(4, d, d.return);
                break;
              case 1:
                Rr(d, d.return);
                var v = d.stateNode;
                if (typeof v.componentWillUnmount == "function") {
                  n = d, r = d.return;
                  try {
                    e = n, v.props = e.memoizedProps, v.state = e.memoizedState, v.componentWillUnmount();
                  } catch (y) {
                    G(n, r, y);
                  }
                }
                break;
              case 5:
                Rr(d, d.return);
                break;
              case 22:
                if (d.memoizedState !== null) {
                  Pu(h);
                  continue;
                }
            }
            g !== null ? (g.return = d, R = g) : Pu(h);
          }
          c = c.sibling;
        }
        e: for (c = null, h = t; ; ) {
          if (h.tag === 5) {
            if (c === null) {
              c = h;
              try {
                s = h.stateNode, u ? (i = s.style, typeof i.setProperty == "function" ? i.setProperty("display", "none", "important") : i.display = "none") : (a = h.stateNode, l = h.memoizedProps.style, o = l != null && l.hasOwnProperty("display") ? l.display : null, a.style.display = qc("display", o));
              } catch (y) {
                G(t, t.return, y);
              }
            }
          } else if (h.tag === 6) {
            if (c === null) try {
              h.stateNode.nodeValue = u ? "" : h.memoizedProps;
            } catch (y) {
              G(t, t.return, y);
            }
          } else if ((h.tag !== 22 && h.tag !== 23 || h.memoizedState === null || h === t) && h.child !== null) {
            h.child.return = h, h = h.child;
            continue;
          }
          if (h === t) break e;
          for (; h.sibling === null; ) {
            if (h.return === null || h.return === t) break e;
            c === h && (c = null), h = h.return;
          }
          c === h && (c = null), h.sibling.return = h.return, h = h.sibling;
        }
      }
      break;
    case 19:
      Be(e, t), Xe(t), n & 4 && xu(t);
      break;
    case 21:
      break;
    default:
      Be(
        e,
        t
      ), Xe(t);
  }
}
function Xe(t) {
  var e = t.flags;
  if (e & 2) {
    try {
      e: {
        for (var r = t.return; r !== null; ) {
          if (wd(r)) {
            var n = r;
            break e;
          }
          r = r.return;
        }
        throw Error(S(160));
      }
      switch (n.tag) {
        case 5:
          var s = n.stateNode;
          n.flags & 32 && (Rn(s, ""), n.flags &= -33);
          var i = Ou(t);
          ma(t, i, s);
          break;
        case 3:
        case 4:
          var o = n.stateNode.containerInfo, a = Ou(t);
          ga(t, a, o);
          break;
        default:
          throw Error(S(161));
      }
    } catch (l) {
      G(t, t.return, l);
    }
    t.flags &= -3;
  }
  e & 4096 && (t.flags &= -4097);
}
function vg(t, e, r) {
  R = t, Sd(t);
}
function Sd(t, e, r) {
  for (var n = (t.mode & 1) !== 0; R !== null; ) {
    var s = R, i = s.child;
    if (s.tag === 22 && n) {
      var o = s.memoizedState !== null || ks;
      if (!o) {
        var a = s.alternate, l = a !== null && a.memoizedState !== null || fe;
        a = ks;
        var u = fe;
        if (ks = o, (fe = l) && !u) for (R = s; R !== null; ) o = R, l = o.child, o.tag === 22 && o.memoizedState !== null ? ju(s) : l !== null ? (l.return = o, R = l) : ju(s);
        for (; i !== null; ) R = i, Sd(i), i = i.sibling;
        R = s, ks = a, fe = u;
      }
      Au(t);
    } else s.subtreeFlags & 8772 && i !== null ? (i.return = s, R = i) : Au(t);
  }
}
function Au(t) {
  for (; R !== null; ) {
    var e = R;
    if (e.flags & 8772) {
      var r = e.alternate;
      try {
        if (e.flags & 8772) switch (e.tag) {
          case 0:
          case 11:
          case 15:
            fe || Li(5, e);
            break;
          case 1:
            var n = e.stateNode;
            if (e.flags & 4 && !fe) if (r === null) n.componentDidMount();
            else {
              var s = e.elementType === e.type ? r.memoizedProps : We(e.type, r.memoizedProps);
              n.componentDidUpdate(s, r.memoizedState, n.__reactInternalSnapshotBeforeUpdate);
            }
            var i = e.updateQueue;
            i !== null && pu(e, i, n);
            break;
          case 3:
            var o = e.updateQueue;
            if (o !== null) {
              if (r = null, e.child !== null) switch (e.child.tag) {
                case 5:
                  r = e.child.stateNode;
                  break;
                case 1:
                  r = e.child.stateNode;
              }
              pu(e, o, r);
            }
            break;
          case 5:
            var a = e.stateNode;
            if (r === null && e.flags & 4) {
              r = a;
              var l = e.memoizedProps;
              switch (e.type) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  l.autoFocus && r.focus();
                  break;
                case "img":
                  l.src && (r.src = l.src);
              }
            }
            break;
          case 6:
            break;
          case 4:
            break;
          case 12:
            break;
          case 13:
            if (e.memoizedState === null) {
              var u = e.alternate;
              if (u !== null) {
                var c = u.memoizedState;
                if (c !== null) {
                  var h = c.dehydrated;
                  h !== null && Pn(h);
                }
              }
            }
            break;
          case 19:
          case 17:
          case 21:
          case 22:
          case 23:
          case 25:
            break;
          default:
            throw Error(S(163));
        }
        fe || e.flags & 512 && pa(e);
      } catch (d) {
        G(e, e.return, d);
      }
    }
    if (e === t) {
      R = null;
      break;
    }
    if (r = e.sibling, r !== null) {
      r.return = e.return, R = r;
      break;
    }
    R = e.return;
  }
}
function Pu(t) {
  for (; R !== null; ) {
    var e = R;
    if (e === t) {
      R = null;
      break;
    }
    var r = e.sibling;
    if (r !== null) {
      r.return = e.return, R = r;
      break;
    }
    R = e.return;
  }
}
function ju(t) {
  for (; R !== null; ) {
    var e = R;
    try {
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          var r = e.return;
          try {
            Li(4, e);
          } catch (l) {
            G(e, r, l);
          }
          break;
        case 1:
          var n = e.stateNode;
          if (typeof n.componentDidMount == "function") {
            var s = e.return;
            try {
              n.componentDidMount();
            } catch (l) {
              G(e, s, l);
            }
          }
          var i = e.return;
          try {
            pa(e);
          } catch (l) {
            G(e, i, l);
          }
          break;
        case 5:
          var o = e.return;
          try {
            pa(e);
          } catch (l) {
            G(e, o, l);
          }
      }
    } catch (l) {
      G(e, e.return, l);
    }
    if (e === t) {
      R = null;
      break;
    }
    var a = e.sibling;
    if (a !== null) {
      a.return = e.return, R = a;
      break;
    }
    R = e.return;
  }
}
var yg = Math.ceil, di = _t.ReactCurrentDispatcher, gl = _t.ReactCurrentOwner, Ue = _t.ReactCurrentBatchConfig, $ = 0, ie = null, X = null, le = 0, Ce = 0, Or = Bt(0), te = 0, Fn = null, or = 0, $i = 0, ml = 0, Sn = null, _e = null, vl = 0, Wr = 1 / 0, at = null, fi = !1, va = null, Lt = null, Ss = !1, xt = null, pi = 0, En = 0, ya = null, Fs = -1, Hs = 0;
function me() {
  return $ & 6 ? Q() : Fs !== -1 ? Fs : Fs = Q();
}
function $t(t) {
  return t.mode & 1 ? $ & 2 && le !== 0 ? le & -le : tg.transition !== null ? (Hs === 0 && (Hs = oh()), Hs) : (t = D, t !== 0 || (t = window.event, t = t === void 0 ? 16 : fh(t.type)), t) : 1;
}
function Qe(t, e, r, n) {
  if (50 < En) throw En = 0, ya = null, Error(S(185));
  es(t, r, n), (!($ & 2) || t !== ie) && (t === ie && (!($ & 2) && ($i |= r), te === 4 && Tt(t, le)), Te(t, n), r === 1 && $ === 0 && !(e.mode & 1) && (Wr = Q() + 500, ji && Ft()));
}
function Te(t, e) {
  var r = t.callbackNode;
  tp(t, e);
  var n = Ys(t, t === ie ? le : 0);
  if (n === 0) r !== null && Bl(r), t.callbackNode = null, t.callbackPriority = 0;
  else if (e = n & -n, t.callbackPriority !== e) {
    if (r != null && Bl(r), e === 1) t.tag === 0 ? eg(Iu.bind(null, t)) : jh(Iu.bind(null, t)), Qp(function() {
      !($ & 6) && Ft();
    }), r = null;
    else {
      switch (ah(n)) {
        case 1:
          r = Ha;
          break;
        case 4:
          r = sh;
          break;
        case 16:
          r = Qs;
          break;
        case 536870912:
          r = ih;
          break;
        default:
          r = Qs;
      }
      r = Ad(r, Ed.bind(null, t));
    }
    t.callbackPriority = e, t.callbackNode = r;
  }
}
function Ed(t, e) {
  if (Fs = -1, Hs = 0, $ & 6) throw Error(S(327));
  var r = t.callbackNode;
  if (Lr() && t.callbackNode !== r) return null;
  var n = Ys(t, t === ie ? le : 0);
  if (n === 0) return null;
  if (n & 30 || n & t.expiredLanes || e) e = gi(t, n);
  else {
    e = n;
    var s = $;
    $ |= 2;
    var i = Td();
    (ie !== t || le !== e) && (at = null, Wr = Q() + 500, tr(t, e));
    do
      try {
        kg();
        break;
      } catch (a) {
        bd(t, a);
      }
    while (!0);
    rl(), di.current = i, $ = s, X !== null ? e = 0 : (ie = null, le = 0, e = te);
  }
  if (e !== 0) {
    if (e === 2 && (s = Vo(t), s !== 0 && (n = s, e = wa(t, s))), e === 1) throw r = Fn, tr(t, 0), Tt(t, n), Te(t, Q()), r;
    if (e === 6) Tt(t, n);
    else {
      if (s = t.current.alternate, !(n & 30) && !wg(s) && (e = gi(t, n), e === 2 && (i = Vo(t), i !== 0 && (n = i, e = wa(t, i))), e === 1)) throw r = Fn, tr(t, 0), Tt(t, n), Te(t, Q()), r;
      switch (t.finishedWork = s, t.finishedLanes = n, e) {
        case 0:
        case 1:
          throw Error(S(345));
        case 2:
          Gt(t, _e, at);
          break;
        case 3:
          if (Tt(t, n), (n & 130023424) === n && (e = vl + 500 - Q(), 10 < e)) {
            if (Ys(t, 0) !== 0) break;
            if (s = t.suspendedLanes, (s & n) !== n) {
              me(), t.pingedLanes |= t.suspendedLanes & s;
              break;
            }
            t.timeoutHandle = Zo(Gt.bind(null, t, _e, at), e);
            break;
          }
          Gt(t, _e, at);
          break;
        case 4:
          if (Tt(t, n), (n & 4194240) === n) break;
          for (e = t.eventTimes, s = -1; 0 < n; ) {
            var o = 31 - Je(n);
            i = 1 << o, o = e[o], o > s && (s = o), n &= ~i;
          }
          if (n = s, n = Q() - n, n = (120 > n ? 120 : 480 > n ? 480 : 1080 > n ? 1080 : 1920 > n ? 1920 : 3e3 > n ? 3e3 : 4320 > n ? 4320 : 1960 * yg(n / 1960)) - n, 10 < n) {
            t.timeoutHandle = Zo(Gt.bind(null, t, _e, at), n);
            break;
          }
          Gt(t, _e, at);
          break;
        case 5:
          Gt(t, _e, at);
          break;
        default:
          throw Error(S(329));
      }
    }
  }
  return Te(t, Q()), t.callbackNode === r ? Ed.bind(null, t) : null;
}
function wa(t, e) {
  var r = Sn;
  return t.current.memoizedState.isDehydrated && (tr(t, e).flags |= 256), t = gi(t, e), t !== 2 && (e = _e, _e = r, e !== null && _a(e)), t;
}
function _a(t) {
  _e === null ? _e = t : _e.push.apply(_e, t);
}
function wg(t) {
  for (var e = t; ; ) {
    if (e.flags & 16384) {
      var r = e.updateQueue;
      if (r !== null && (r = r.stores, r !== null)) for (var n = 0; n < r.length; n++) {
        var s = r[n], i = s.getSnapshot;
        s = s.value;
        try {
          if (!Ye(i(), s)) return !1;
        } catch {
          return !1;
        }
      }
    }
    if (r = e.child, e.subtreeFlags & 16384 && r !== null) r.return = e, e = r;
    else {
      if (e === t) break;
      for (; e.sibling === null; ) {
        if (e.return === null || e.return === t) return !0;
        e = e.return;
      }
      e.sibling.return = e.return, e = e.sibling;
    }
  }
  return !0;
}
function Tt(t, e) {
  for (e &= ~ml, e &= ~$i, t.suspendedLanes |= e, t.pingedLanes &= ~e, t = t.expirationTimes; 0 < e; ) {
    var r = 31 - Je(e), n = 1 << r;
    t[r] = -1, e &= ~n;
  }
}
function Iu(t) {
  if ($ & 6) throw Error(S(327));
  Lr();
  var e = Ys(t, 0);
  if (!(e & 1)) return Te(t, Q()), null;
  var r = gi(t, e);
  if (t.tag !== 0 && r === 2) {
    var n = Vo(t);
    n !== 0 && (e = n, r = wa(t, n));
  }
  if (r === 1) throw r = Fn, tr(t, 0), Tt(t, e), Te(t, Q()), r;
  if (r === 6) throw Error(S(345));
  return t.finishedWork = t.current.alternate, t.finishedLanes = e, Gt(t, _e, at), Te(t, Q()), null;
}
function yl(t, e) {
  var r = $;
  $ |= 1;
  try {
    return t(e);
  } finally {
    $ = r, $ === 0 && (Wr = Q() + 500, ji && Ft());
  }
}
function ar(t) {
  xt !== null && xt.tag === 0 && !($ & 6) && Lr();
  var e = $;
  $ |= 1;
  var r = Ue.transition, n = D;
  try {
    if (Ue.transition = null, D = 1, t) return t();
  } finally {
    D = n, Ue.transition = r, $ = e, !($ & 6) && Ft();
  }
}
function wl() {
  Ce = Or.current, F(Or);
}
function tr(t, e) {
  t.finishedWork = null, t.finishedLanes = 0;
  var r = t.timeoutHandle;
  if (r !== -1 && (t.timeoutHandle = -1, Jp(r)), X !== null) for (r = X.return; r !== null; ) {
    var n = r;
    switch (Za(n), n.tag) {
      case 1:
        n = n.type.childContextTypes, n != null && ri();
        break;
      case 3:
        Fr(), F(Ee), F(pe), ll();
        break;
      case 5:
        al(n);
        break;
      case 4:
        Fr();
        break;
      case 13:
        F(W);
        break;
      case 19:
        F(W);
        break;
      case 10:
        nl(n.type._context);
        break;
      case 22:
      case 23:
        wl();
    }
    r = r.return;
  }
  if (ie = t, X = t = Ut(t.current, null), le = Ce = e, te = 0, Fn = null, ml = $i = or = 0, _e = Sn = null, Yt !== null) {
    for (e = 0; e < Yt.length; e++) if (r = Yt[e], n = r.interleaved, n !== null) {
      r.interleaved = null;
      var s = n.next, i = r.pending;
      if (i !== null) {
        var o = i.next;
        i.next = s, n.next = o;
      }
      r.pending = n;
    }
    Yt = null;
  }
  return t;
}
function bd(t, e) {
  do {
    var r = X;
    try {
      if (rl(), Ms.current = hi, ci) {
        for (var n = V.memoizedState; n !== null; ) {
          var s = n.queue;
          s !== null && (s.pending = null), n = n.next;
        }
        ci = !1;
      }
      if (ir = 0, se = ee = V = null, _n = !1, Mn = 0, gl.current = null, r === null || r.return === null) {
        te = 1, Fn = e, X = null;
        break;
      }
      e: {
        var i = t, o = r.return, a = r, l = e;
        if (e = le, a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          var u = l, c = a, h = c.tag;
          if (!(c.mode & 1) && (h === 0 || h === 11 || h === 15)) {
            var d = c.alternate;
            d ? (c.updateQueue = d.updateQueue, c.memoizedState = d.memoizedState, c.lanes = d.lanes) : (c.updateQueue = null, c.memoizedState = null);
          }
          var g = _u(o);
          if (g !== null) {
            g.flags &= -257, ku(g, o, a, i, e), g.mode & 1 && wu(i, u, e), e = g, l = u;
            var v = e.updateQueue;
            if (v === null) {
              var y = /* @__PURE__ */ new Set();
              y.add(l), e.updateQueue = y;
            } else v.add(l);
            break e;
          } else {
            if (!(e & 1)) {
              wu(i, u, e), _l();
              break e;
            }
            l = Error(S(426));
          }
        } else if (H && a.mode & 1) {
          var k = _u(o);
          if (k !== null) {
            !(k.flags & 65536) && (k.flags |= 256), ku(k, o, a, i, e), el(Hr(l, a));
            break e;
          }
        }
        i = l = Hr(l, a), te !== 4 && (te = 2), Sn === null ? Sn = [i] : Sn.push(i), i = o;
        do {
          switch (i.tag) {
            case 3:
              i.flags |= 65536, e &= -e, i.lanes |= e;
              var f = ad(i, l, e);
              fu(i, f);
              break e;
            case 1:
              a = l;
              var p = i.type, m = i.stateNode;
              if (!(i.flags & 128) && (typeof p.getDerivedStateFromError == "function" || m !== null && typeof m.componentDidCatch == "function" && (Lt === null || !Lt.has(m)))) {
                i.flags |= 65536, e &= -e, i.lanes |= e;
                var w = ld(i, a, e);
                fu(i, w);
                break e;
              }
          }
          i = i.return;
        } while (i !== null);
      }
      Rd(r);
    } catch (T) {
      e = T, X === r && r !== null && (X = r = r.return);
      continue;
    }
    break;
  } while (!0);
}
function Td() {
  var t = di.current;
  return di.current = hi, t === null ? hi : t;
}
function _l() {
  (te === 0 || te === 3 || te === 2) && (te = 4), ie === null || !(or & 268435455) && !($i & 268435455) || Tt(ie, le);
}
function gi(t, e) {
  var r = $;
  $ |= 2;
  var n = Td();
  (ie !== t || le !== e) && (at = null, tr(t, e));
  do
    try {
      _g();
      break;
    } catch (s) {
      bd(t, s);
    }
  while (!0);
  if (rl(), $ = r, di.current = n, X !== null) throw Error(S(261));
  return ie = null, le = 0, te;
}
function _g() {
  for (; X !== null; ) Cd(X);
}
function kg() {
  for (; X !== null && !Kf(); ) Cd(X);
}
function Cd(t) {
  var e = xd(t.alternate, t, Ce);
  t.memoizedProps = t.pendingProps, e === null ? Rd(t) : X = e, gl.current = null;
}
function Rd(t) {
  var e = t;
  do {
    var r = e.alternate;
    if (t = e.return, e.flags & 32768) {
      if (r = pg(r, e), r !== null) {
        r.flags &= 32767, X = r;
        return;
      }
      if (t !== null) t.flags |= 32768, t.subtreeFlags = 0, t.deletions = null;
      else {
        te = 6, X = null;
        return;
      }
    } else if (r = fg(r, e, Ce), r !== null) {
      X = r;
      return;
    }
    if (e = e.sibling, e !== null) {
      X = e;
      return;
    }
    X = e = t;
  } while (e !== null);
  te === 0 && (te = 5);
}
function Gt(t, e, r) {
  var n = D, s = Ue.transition;
  try {
    Ue.transition = null, D = 1, Sg(t, e, r, n);
  } finally {
    Ue.transition = s, D = n;
  }
  return null;
}
function Sg(t, e, r, n) {
  do
    Lr();
  while (xt !== null);
  if ($ & 6) throw Error(S(327));
  r = t.finishedWork;
  var s = t.finishedLanes;
  if (r === null) return null;
  if (t.finishedWork = null, t.finishedLanes = 0, r === t.current) throw Error(S(177));
  t.callbackNode = null, t.callbackPriority = 0;
  var i = r.lanes | r.childLanes;
  if (rp(t, i), t === ie && (X = ie = null, le = 0), !(r.subtreeFlags & 2064) && !(r.flags & 2064) || Ss || (Ss = !0, Ad(Qs, function() {
    return Lr(), null;
  })), i = (r.flags & 15990) !== 0, r.subtreeFlags & 15990 || i) {
    i = Ue.transition, Ue.transition = null;
    var o = D;
    D = 1;
    var a = $;
    $ |= 4, gl.current = null, mg(t, r), kd(r, t), Fp(Yo), Xs = !!Qo, Yo = Qo = null, t.current = r, vg(r), qf(), $ = a, D = o, Ue.transition = i;
  } else t.current = r;
  if (Ss && (Ss = !1, xt = t, pi = s), i = t.pendingLanes, i === 0 && (Lt = null), Qf(r.stateNode), Te(t, Q()), e !== null) for (n = t.onRecoverableError, r = 0; r < e.length; r++) s = e[r], n(s.value, { componentStack: s.stack, digest: s.digest });
  if (fi) throw fi = !1, t = va, va = null, t;
  return pi & 1 && t.tag !== 0 && Lr(), i = t.pendingLanes, i & 1 ? t === ya ? En++ : (En = 0, ya = t) : En = 0, Ft(), null;
}
function Lr() {
  if (xt !== null) {
    var t = ah(pi), e = Ue.transition, r = D;
    try {
      if (Ue.transition = null, D = 16 > t ? 16 : t, xt === null) var n = !1;
      else {
        if (t = xt, xt = null, pi = 0, $ & 6) throw Error(S(331));
        var s = $;
        for ($ |= 4, R = t.current; R !== null; ) {
          var i = R, o = i.child;
          if (R.flags & 16) {
            var a = i.deletions;
            if (a !== null) {
              for (var l = 0; l < a.length; l++) {
                var u = a[l];
                for (R = u; R !== null; ) {
                  var c = R;
                  switch (c.tag) {
                    case 0:
                    case 11:
                    case 15:
                      kn(8, c, i);
                  }
                  var h = c.child;
                  if (h !== null) h.return = c, R = h;
                  else for (; R !== null; ) {
                    c = R;
                    var d = c.sibling, g = c.return;
                    if (yd(c), c === u) {
                      R = null;
                      break;
                    }
                    if (d !== null) {
                      d.return = g, R = d;
                      break;
                    }
                    R = g;
                  }
                }
              }
              var v = i.alternate;
              if (v !== null) {
                var y = v.child;
                if (y !== null) {
                  v.child = null;
                  do {
                    var k = y.sibling;
                    y.sibling = null, y = k;
                  } while (y !== null);
                }
              }
              R = i;
            }
          }
          if (i.subtreeFlags & 2064 && o !== null) o.return = i, R = o;
          else e: for (; R !== null; ) {
            if (i = R, i.flags & 2048) switch (i.tag) {
              case 0:
              case 11:
              case 15:
                kn(9, i, i.return);
            }
            var f = i.sibling;
            if (f !== null) {
              f.return = i.return, R = f;
              break e;
            }
            R = i.return;
          }
        }
        var p = t.current;
        for (R = p; R !== null; ) {
          o = R;
          var m = o.child;
          if (o.subtreeFlags & 2064 && m !== null) m.return = o, R = m;
          else e: for (o = p; R !== null; ) {
            if (a = R, a.flags & 2048) try {
              switch (a.tag) {
                case 0:
                case 11:
                case 15:
                  Li(9, a);
              }
            } catch (T) {
              G(a, a.return, T);
            }
            if (a === o) {
              R = null;
              break e;
            }
            var w = a.sibling;
            if (w !== null) {
              w.return = a.return, R = w;
              break e;
            }
            R = a.return;
          }
        }
        if ($ = s, Ft(), nt && typeof nt.onPostCommitFiberRoot == "function") try {
          nt.onPostCommitFiberRoot(Ri, t);
        } catch {
        }
        n = !0;
      }
      return n;
    } finally {
      D = r, Ue.transition = e;
    }
  }
  return !1;
}
function Nu(t, e, r) {
  e = Hr(r, e), e = ad(t, e, 1), t = Nt(t, e, 1), e = me(), t !== null && (es(t, 1, e), Te(t, e));
}
function G(t, e, r) {
  if (t.tag === 3) Nu(t, t, r);
  else for (; e !== null; ) {
    if (e.tag === 3) {
      Nu(e, t, r);
      break;
    } else if (e.tag === 1) {
      var n = e.stateNode;
      if (typeof e.type.getDerivedStateFromError == "function" || typeof n.componentDidCatch == "function" && (Lt === null || !Lt.has(n))) {
        t = Hr(r, t), t = ld(e, t, 1), e = Nt(e, t, 1), t = me(), e !== null && (es(e, 1, t), Te(e, t));
        break;
      }
    }
    e = e.return;
  }
}
function Eg(t, e, r) {
  var n = t.pingCache;
  n !== null && n.delete(e), e = me(), t.pingedLanes |= t.suspendedLanes & r, ie === t && (le & r) === r && (te === 4 || te === 3 && (le & 130023424) === le && 500 > Q() - vl ? tr(t, 0) : ml |= r), Te(t, e);
}
function Od(t, e) {
  e === 0 && (t.mode & 1 ? (e = ds, ds <<= 1, !(ds & 130023424) && (ds = 4194304)) : e = 1);
  var r = me();
  t = yt(t, e), t !== null && (es(t, e, r), Te(t, r));
}
function bg(t) {
  var e = t.memoizedState, r = 0;
  e !== null && (r = e.retryLane), Od(t, r);
}
function Tg(t, e) {
  var r = 0;
  switch (t.tag) {
    case 13:
      var n = t.stateNode, s = t.memoizedState;
      s !== null && (r = s.retryLane);
      break;
    case 19:
      n = t.stateNode;
      break;
    default:
      throw Error(S(314));
  }
  n !== null && n.delete(e), Od(t, r);
}
var xd;
xd = function(t, e, r) {
  if (t !== null) if (t.memoizedProps !== e.pendingProps || Ee.current) Se = !0;
  else {
    if (!(t.lanes & r) && !(e.flags & 128)) return Se = !1, dg(t, e, r);
    Se = !!(t.flags & 131072);
  }
  else Se = !1, H && e.flags & 1048576 && Ih(e, ii, e.index);
  switch (e.lanes = 0, e.tag) {
    case 2:
      var n = e.type;
      Bs(t, e), t = e.pendingProps;
      var s = Mr(e, pe.current);
      Nr(e, r), s = cl(null, e, n, t, s, r);
      var i = hl();
      return e.flags |= 1, typeof s == "object" && s !== null && typeof s.render == "function" && s.$$typeof === void 0 ? (e.tag = 1, e.memoizedState = null, e.updateQueue = null, be(n) ? (i = !0, ni(e)) : i = !1, e.memoizedState = s.state !== null && s.state !== void 0 ? s.state : null, il(e), s.updater = Ni, e.stateNode = s, s._reactInternals = e, oa(e, n, t, r), e = ua(null, e, n, !0, i, r)) : (e.tag = 0, H && i && Xa(e), ge(null, e, s, r), e = e.child), e;
    case 16:
      n = e.elementType;
      e: {
        switch (Bs(t, e), t = e.pendingProps, s = n._init, n = s(n._payload), e.type = n, s = e.tag = Rg(n), t = We(n, t), s) {
          case 0:
            e = la(null, e, n, t, r);
            break e;
          case 1:
            e = bu(null, e, n, t, r);
            break e;
          case 11:
            e = Su(null, e, n, t, r);
            break e;
          case 14:
            e = Eu(null, e, n, We(n.type, t), r);
            break e;
        }
        throw Error(S(
          306,
          n,
          ""
        ));
      }
      return e;
    case 0:
      return n = e.type, s = e.pendingProps, s = e.elementType === n ? s : We(n, s), la(t, e, n, s, r);
    case 1:
      return n = e.type, s = e.pendingProps, s = e.elementType === n ? s : We(n, s), bu(t, e, n, s, r);
    case 3:
      e: {
        if (dd(e), t === null) throw Error(S(387));
        n = e.pendingProps, i = e.memoizedState, s = i.element, Mh(t, e), li(e, n, null, r);
        var o = e.memoizedState;
        if (n = o.element, i.isDehydrated) if (i = { element: n, isDehydrated: !1, cache: o.cache, pendingSuspenseBoundaries: o.pendingSuspenseBoundaries, transitions: o.transitions }, e.updateQueue.baseState = i, e.memoizedState = i, e.flags & 256) {
          s = Hr(Error(S(423)), e), e = Tu(t, e, n, r, s);
          break e;
        } else if (n !== s) {
          s = Hr(Error(S(424)), e), e = Tu(t, e, n, r, s);
          break e;
        } else for (Oe = It(e.stateNode.containerInfo.firstChild), xe = e, H = !0, qe = null, r = Uh(e, null, n, r), e.child = r; r; ) r.flags = r.flags & -3 | 4096, r = r.sibling;
        else {
          if (zr(), n === s) {
            e = wt(t, e, r);
            break e;
          }
          ge(t, e, n, r);
        }
        e = e.child;
      }
      return e;
    case 5:
      return zh(e), t === null && na(e), n = e.type, s = e.pendingProps, i = t !== null ? t.memoizedProps : null, o = s.children, Xo(n, s) ? o = null : i !== null && Xo(n, i) && (e.flags |= 32), hd(t, e), ge(t, e, o, r), e.child;
    case 6:
      return t === null && na(e), null;
    case 13:
      return fd(t, e, r);
    case 4:
      return ol(e, e.stateNode.containerInfo), n = e.pendingProps, t === null ? e.child = Br(e, null, n, r) : ge(t, e, n, r), e.child;
    case 11:
      return n = e.type, s = e.pendingProps, s = e.elementType === n ? s : We(n, s), Su(t, e, n, s, r);
    case 7:
      return ge(t, e, e.pendingProps, r), e.child;
    case 8:
      return ge(t, e, e.pendingProps.children, r), e.child;
    case 12:
      return ge(t, e, e.pendingProps.children, r), e.child;
    case 10:
      e: {
        if (n = e.type._context, s = e.pendingProps, i = e.memoizedProps, o = s.value, z(oi, n._currentValue), n._currentValue = o, i !== null) if (Ye(i.value, o)) {
          if (i.children === s.children && !Ee.current) {
            e = wt(t, e, r);
            break e;
          }
        } else for (i = e.child, i !== null && (i.return = e); i !== null; ) {
          var a = i.dependencies;
          if (a !== null) {
            o = i.child;
            for (var l = a.firstContext; l !== null; ) {
              if (l.context === n) {
                if (i.tag === 1) {
                  l = gt(-1, r & -r), l.tag = 2;
                  var u = i.updateQueue;
                  if (u !== null) {
                    u = u.shared;
                    var c = u.pending;
                    c === null ? l.next = l : (l.next = c.next, c.next = l), u.pending = l;
                  }
                }
                i.lanes |= r, l = i.alternate, l !== null && (l.lanes |= r), sa(
                  i.return,
                  r,
                  e
                ), a.lanes |= r;
                break;
              }
              l = l.next;
            }
          } else if (i.tag === 10) o = i.type === e.type ? null : i.child;
          else if (i.tag === 18) {
            if (o = i.return, o === null) throw Error(S(341));
            o.lanes |= r, a = o.alternate, a !== null && (a.lanes |= r), sa(o, r, e), o = i.sibling;
          } else o = i.child;
          if (o !== null) o.return = i;
          else for (o = i; o !== null; ) {
            if (o === e) {
              o = null;
              break;
            }
            if (i = o.sibling, i !== null) {
              i.return = o.return, o = i;
              break;
            }
            o = o.return;
          }
          i = o;
        }
        ge(t, e, s.children, r), e = e.child;
      }
      return e;
    case 9:
      return s = e.type, n = e.pendingProps.children, Nr(e, r), s = De(s), n = n(s), e.flags |= 1, ge(t, e, n, r), e.child;
    case 14:
      return n = e.type, s = We(n, e.pendingProps), s = We(n.type, s), Eu(t, e, n, s, r);
    case 15:
      return ud(t, e, e.type, e.pendingProps, r);
    case 17:
      return n = e.type, s = e.pendingProps, s = e.elementType === n ? s : We(n, s), Bs(t, e), e.tag = 1, be(n) ? (t = !0, ni(e)) : t = !1, Nr(e, r), od(e, n, s), oa(e, n, s, r), ua(null, e, n, !0, t, r);
    case 19:
      return pd(t, e, r);
    case 22:
      return cd(t, e, r);
  }
  throw Error(S(156, e.tag));
};
function Ad(t, e) {
  return nh(t, e);
}
function Cg(t, e, r, n) {
  this.tag = t, this.key = r, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = n, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
}
function $e(t, e, r, n) {
  return new Cg(t, e, r, n);
}
function kl(t) {
  return t = t.prototype, !(!t || !t.isReactComponent);
}
function Rg(t) {
  if (typeof t == "function") return kl(t) ? 1 : 0;
  if (t != null) {
    if (t = t.$$typeof, t === za) return 11;
    if (t === Ba) return 14;
  }
  return 2;
}
function Ut(t, e) {
  var r = t.alternate;
  return r === null ? (r = $e(t.tag, e, t.key, t.mode), r.elementType = t.elementType, r.type = t.type, r.stateNode = t.stateNode, r.alternate = t, t.alternate = r) : (r.pendingProps = e, r.type = t.type, r.flags = 0, r.subtreeFlags = 0, r.deletions = null), r.flags = t.flags & 14680064, r.childLanes = t.childLanes, r.lanes = t.lanes, r.child = t.child, r.memoizedProps = t.memoizedProps, r.memoizedState = t.memoizedState, r.updateQueue = t.updateQueue, e = t.dependencies, r.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }, r.sibling = t.sibling, r.index = t.index, r.ref = t.ref, r;
}
function Ws(t, e, r, n, s, i) {
  var o = 2;
  if (n = t, typeof t == "function") kl(t) && (o = 1);
  else if (typeof t == "string") o = 5;
  else e: switch (t) {
    case yr:
      return rr(r.children, s, i, e);
    case Ma:
      o = 8, s |= 8;
      break;
    case Ao:
      return t = $e(12, r, e, s | 2), t.elementType = Ao, t.lanes = i, t;
    case Po:
      return t = $e(13, r, e, s), t.elementType = Po, t.lanes = i, t;
    case jo:
      return t = $e(19, r, e, s), t.elementType = jo, t.lanes = i, t;
    case zc:
      return Ui(r, s, i, e);
    default:
      if (typeof t == "object" && t !== null) switch (t.$$typeof) {
        case Dc:
          o = 10;
          break e;
        case Mc:
          o = 9;
          break e;
        case za:
          o = 11;
          break e;
        case Ba:
          o = 14;
          break e;
        case St:
          o = 16, n = null;
          break e;
      }
      throw Error(S(130, t == null ? t : typeof t, ""));
  }
  return e = $e(o, r, e, s), e.elementType = t, e.type = n, e.lanes = i, e;
}
function rr(t, e, r, n) {
  return t = $e(7, t, n, e), t.lanes = r, t;
}
function Ui(t, e, r, n) {
  return t = $e(22, t, n, e), t.elementType = zc, t.lanes = r, t.stateNode = { isHidden: !1 }, t;
}
function _o(t, e, r) {
  return t = $e(6, t, null, e), t.lanes = r, t;
}
function ko(t, e, r) {
  return e = $e(4, t.children !== null ? t.children : [], t.key, e), e.lanes = r, e.stateNode = { containerInfo: t.containerInfo, pendingChildren: null, implementation: t.implementation }, e;
}
function Og(t, e, r, n, s) {
  this.tag = e, this.containerInfo = t, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = eo(0), this.expirationTimes = eo(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = eo(0), this.identifierPrefix = n, this.onRecoverableError = s, this.mutableSourceEagerHydrationData = null;
}
function Sl(t, e, r, n, s, i, o, a, l) {
  return t = new Og(t, e, r, a, l), e === 1 ? (e = 1, i === !0 && (e |= 8)) : e = 0, i = $e(3, null, null, e), t.current = i, i.stateNode = t, i.memoizedState = { element: n, isDehydrated: r, cache: null, transitions: null, pendingSuspenseBoundaries: null }, il(i), t;
}
function xg(t, e, r) {
  var n = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
  return { $$typeof: vr, key: n == null ? null : "" + n, children: t, containerInfo: e, implementation: r };
}
function Pd(t) {
  if (!t) return Mt;
  t = t._reactInternals;
  e: {
    if (ur(t) !== t || t.tag !== 1) throw Error(S(170));
    var e = t;
    do {
      switch (e.tag) {
        case 3:
          e = e.stateNode.context;
          break e;
        case 1:
          if (be(e.type)) {
            e = e.stateNode.__reactInternalMemoizedMergedChildContext;
            break e;
          }
      }
      e = e.return;
    } while (e !== null);
    throw Error(S(171));
  }
  if (t.tag === 1) {
    var r = t.type;
    if (be(r)) return Ph(t, r, e);
  }
  return e;
}
function jd(t, e, r, n, s, i, o, a, l) {
  return t = Sl(r, n, !0, t, s, i, o, a, l), t.context = Pd(null), r = t.current, n = me(), s = $t(r), i = gt(n, s), i.callback = e ?? null, Nt(r, i, s), t.current.lanes = s, es(t, s, n), Te(t, n), t;
}
function Di(t, e, r, n) {
  var s = e.current, i = me(), o = $t(s);
  return r = Pd(r), e.context === null ? e.context = r : e.pendingContext = r, e = gt(i, o), e.payload = { element: t }, n = n === void 0 ? null : n, n !== null && (e.callback = n), t = Nt(s, e, o), t !== null && (Qe(t, s, o, i), Ds(t, s, o)), o;
}
function mi(t) {
  if (t = t.current, !t.child) return null;
  switch (t.child.tag) {
    case 5:
      return t.child.stateNode;
    default:
      return t.child.stateNode;
  }
}
function Lu(t, e) {
  if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
    var r = t.retryLane;
    t.retryLane = r !== 0 && r < e ? r : e;
  }
}
function El(t, e) {
  Lu(t, e), (t = t.alternate) && Lu(t, e);
}
function Ag() {
  return null;
}
var Id = typeof reportError == "function" ? reportError : function(t) {
  console.error(t);
};
function bl(t) {
  this._internalRoot = t;
}
Mi.prototype.render = bl.prototype.render = function(t) {
  var e = this._internalRoot;
  if (e === null) throw Error(S(409));
  Di(t, e, null, null);
};
Mi.prototype.unmount = bl.prototype.unmount = function() {
  var t = this._internalRoot;
  if (t !== null) {
    this._internalRoot = null;
    var e = t.containerInfo;
    ar(function() {
      Di(null, t, null, null);
    }), e[vt] = null;
  }
};
function Mi(t) {
  this._internalRoot = t;
}
Mi.prototype.unstable_scheduleHydration = function(t) {
  if (t) {
    var e = ch();
    t = { blockedOn: null, target: t, priority: e };
    for (var r = 0; r < bt.length && e !== 0 && e < bt[r].priority; r++) ;
    bt.splice(r, 0, t), r === 0 && dh(t);
  }
};
function Tl(t) {
  return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
}
function zi(t) {
  return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11 && (t.nodeType !== 8 || t.nodeValue !== " react-mount-point-unstable "));
}
function $u() {
}
function Pg(t, e, r, n, s) {
  if (s) {
    if (typeof n == "function") {
      var i = n;
      n = function() {
        var u = mi(o);
        i.call(u);
      };
    }
    var o = jd(e, n, t, 0, null, !1, !1, "", $u);
    return t._reactRootContainer = o, t[vt] = o.current, Nn(t.nodeType === 8 ? t.parentNode : t), ar(), o;
  }
  for (; s = t.lastChild; ) t.removeChild(s);
  if (typeof n == "function") {
    var a = n;
    n = function() {
      var u = mi(l);
      a.call(u);
    };
  }
  var l = Sl(t, 0, !1, null, null, !1, !1, "", $u);
  return t._reactRootContainer = l, t[vt] = l.current, Nn(t.nodeType === 8 ? t.parentNode : t), ar(function() {
    Di(e, l, r, n);
  }), l;
}
function Bi(t, e, r, n, s) {
  var i = r._reactRootContainer;
  if (i) {
    var o = i;
    if (typeof s == "function") {
      var a = s;
      s = function() {
        var l = mi(o);
        a.call(l);
      };
    }
    Di(e, o, t, s);
  } else o = Pg(r, e, t, s, n);
  return mi(o);
}
lh = function(t) {
  switch (t.tag) {
    case 3:
      var e = t.stateNode;
      if (e.current.memoizedState.isDehydrated) {
        var r = cn(e.pendingLanes);
        r !== 0 && (Wa(e, r | 1), Te(e, Q()), !($ & 6) && (Wr = Q() + 500, Ft()));
      }
      break;
    case 13:
      ar(function() {
        var n = yt(t, 1);
        if (n !== null) {
          var s = me();
          Qe(n, t, 1, s);
        }
      }), El(t, 1);
  }
};
Va = function(t) {
  if (t.tag === 13) {
    var e = yt(t, 134217728);
    if (e !== null) {
      var r = me();
      Qe(e, t, 134217728, r);
    }
    El(t, 134217728);
  }
};
uh = function(t) {
  if (t.tag === 13) {
    var e = $t(t), r = yt(t, e);
    if (r !== null) {
      var n = me();
      Qe(r, t, e, n);
    }
    El(t, e);
  }
};
ch = function() {
  return D;
};
hh = function(t, e) {
  var r = D;
  try {
    return D = t, e();
  } finally {
    D = r;
  }
};
Fo = function(t, e, r) {
  switch (e) {
    case "input":
      if (Lo(t, r), e = r.name, r.type === "radio" && e != null) {
        for (r = t; r.parentNode; ) r = r.parentNode;
        for (r = r.querySelectorAll("input[name=" + JSON.stringify("" + e) + '][type="radio"]'), e = 0; e < r.length; e++) {
          var n = r[e];
          if (n !== t && n.form === t.form) {
            var s = Pi(n);
            if (!s) throw Error(S(90));
            Fc(n), Lo(n, s);
          }
        }
      }
      break;
    case "textarea":
      Wc(t, r);
      break;
    case "select":
      e = r.value, e != null && Ar(t, !!r.multiple, e, !1);
  }
};
Yc = yl;
Xc = ar;
var jg = { usingClientEntryPoint: !1, Events: [rs, Sr, Pi, Jc, Qc, yl] }, on = { findFiberByHostInstance: Qt, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" }, Ig = { bundleType: on.bundleType, version: on.version, rendererPackageName: on.rendererPackageName, rendererConfig: on.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: _t.ReactCurrentDispatcher, findHostInstanceByFiber: function(t) {
  return t = th(t), t === null ? null : t.stateNode;
}, findFiberByHostInstance: on.findFiberByHostInstance || Ag, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
  var Es = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!Es.isDisabled && Es.supportsFiber) try {
    Ri = Es.inject(Ig), nt = Es;
  } catch {
  }
}
Pe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = jg;
Pe.createPortal = function(t, e) {
  var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
  if (!Tl(e)) throw Error(S(200));
  return xg(t, e, null, r);
};
Pe.createRoot = function(t, e) {
  if (!Tl(t)) throw Error(S(299));
  var r = !1, n = "", s = Id;
  return e != null && (e.unstable_strictMode === !0 && (r = !0), e.identifierPrefix !== void 0 && (n = e.identifierPrefix), e.onRecoverableError !== void 0 && (s = e.onRecoverableError)), e = Sl(t, 1, !1, null, null, r, !1, n, s), t[vt] = e.current, Nn(t.nodeType === 8 ? t.parentNode : t), new bl(e);
};
Pe.findDOMNode = function(t) {
  if (t == null) return null;
  if (t.nodeType === 1) return t;
  var e = t._reactInternals;
  if (e === void 0)
    throw typeof t.render == "function" ? Error(S(188)) : (t = Object.keys(t).join(","), Error(S(268, t)));
  return t = th(e), t = t === null ? null : t.stateNode, t;
};
Pe.flushSync = function(t) {
  return ar(t);
};
Pe.hydrate = function(t, e, r) {
  if (!zi(e)) throw Error(S(200));
  return Bi(null, t, e, !0, r);
};
Pe.hydrateRoot = function(t, e, r) {
  if (!Tl(t)) throw Error(S(405));
  var n = r != null && r.hydratedSources || null, s = !1, i = "", o = Id;
  if (r != null && (r.unstable_strictMode === !0 && (s = !0), r.identifierPrefix !== void 0 && (i = r.identifierPrefix), r.onRecoverableError !== void 0 && (o = r.onRecoverableError)), e = jd(e, null, t, 1, r ?? null, s, !1, i, o), t[vt] = e.current, Nn(t), n) for (t = 0; t < n.length; t++) r = n[t], s = r._getVersion, s = s(r._source), e.mutableSourceEagerHydrationData == null ? e.mutableSourceEagerHydrationData = [r, s] : e.mutableSourceEagerHydrationData.push(
    r,
    s
  );
  return new Mi(e);
};
Pe.render = function(t, e, r) {
  if (!zi(e)) throw Error(S(200));
  return Bi(null, t, e, !1, r);
};
Pe.unmountComponentAtNode = function(t) {
  if (!zi(t)) throw Error(S(40));
  return t._reactRootContainer ? (ar(function() {
    Bi(null, null, t, !1, function() {
      t._reactRootContainer = null, t[vt] = null;
    });
  }), !0) : !1;
};
Pe.unstable_batchedUpdates = yl;
Pe.unstable_renderSubtreeIntoContainer = function(t, e, r, n) {
  if (!zi(r)) throw Error(S(200));
  if (t == null || t._reactInternals === void 0) throw Error(S(38));
  return Bi(t, e, r, !1, n);
};
Pe.version = "18.3.1-next-f1338f8080-20240426";
function Nd() {
  if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Nd);
    } catch (t) {
      console.error(t);
    }
}
Nd(), Nc.exports = Pe;
var Ng = Nc.exports, Ld, Uu = Ng;
Ld = Uu.createRoot, Uu.hydrateRoot;
function Fi(t, e) {
  var r = {};
  for (var n in t) Object.prototype.hasOwnProperty.call(t, n) && e.indexOf(n) < 0 && (r[n] = t[n]);
  if (t != null && typeof Object.getOwnPropertySymbols == "function")
    for (var s = 0, n = Object.getOwnPropertySymbols(t); s < n.length; s++)
      e.indexOf(n[s]) < 0 && Object.prototype.propertyIsEnumerable.call(t, n[s]) && (r[n[s]] = t[n[s]]);
  return r;
}
function Lg(t, e, r, n) {
  function s(i) {
    return i instanceof r ? i : new r(function(o) {
      o(i);
    });
  }
  return new (r || (r = Promise))(function(i, o) {
    function a(c) {
      try {
        u(n.next(c));
      } catch (h) {
        o(h);
      }
    }
    function l(c) {
      try {
        u(n.throw(c));
      } catch (h) {
        o(h);
      }
    }
    function u(c) {
      c.done ? i(c.value) : s(c.value).then(a, l);
    }
    u((n = n.apply(t, e || [])).next());
  });
}
const $g = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e);
class Cl extends Error {
  constructor(e, r = "FunctionsError", n) {
    super(e), this.name = r, this.context = n;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context
    };
  }
}
class Ug extends Cl {
  constructor(e) {
    super("Failed to send a request to the Edge Function", "FunctionsFetchError", e);
  }
}
class Du extends Cl {
  constructor(e) {
    super("Relay Error invoking the Edge Function", "FunctionsRelayError", e);
  }
}
class Mu extends Cl {
  constructor(e) {
    super("Edge Function returned a non-2xx status code", "FunctionsHttpError", e);
  }
}
var ka;
(function(t) {
  t.Any = "any", t.ApNortheast1 = "ap-northeast-1", t.ApNortheast2 = "ap-northeast-2", t.ApSouth1 = "ap-south-1", t.ApSoutheast1 = "ap-southeast-1", t.ApSoutheast2 = "ap-southeast-2", t.CaCentral1 = "ca-central-1", t.EuCentral1 = "eu-central-1", t.EuWest1 = "eu-west-1", t.EuWest2 = "eu-west-2", t.EuWest3 = "eu-west-3", t.SaEast1 = "sa-east-1", t.UsEast1 = "us-east-1", t.UsWest1 = "us-west-1", t.UsWest2 = "us-west-2";
})(ka || (ka = {}));
class Dg {
  /**
   * Creates a new Functions client bound to an Edge Functions URL.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const { data, error } = await supabase.functions.invoke('hello-world')
   * ```
   *
   * @category Edge Functions
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
   *
   * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
   *   headers: { apikey: 'your-publishable-key' },
   *   region: FunctionRegion.UsEast1,
   * })
   * ```
   */
  constructor(e, { headers: r = {}, customFetch: n, region: s = ka.Any } = {}) {
    this.url = e, this.headers = r, this.region = s, this.fetch = $g(n);
  }
  /**
   * Updates the authorization header
   * @param token - the new jwt token sent in the authorisation header
   *
   * @category Edge Functions
   *
   * @example Setting the authorization header
   * ```ts
   * functions.setAuth(session.access_token)
   * ```
   */
  setAuth(e) {
    this.headers.Authorization = `Bearer ${e}`;
  }
  /**
   * Invokes a function
   * @param functionName - The name of the Function to invoke.
   * @param options - Options for invoking the Function.
   * @example
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   *
   * @category Edge Functions
   *
   * @remarks
   * - The API key is sent in the `apikey` header. The `Authorization` header is reserved
   *   for the signed-in user's JWT (or a custom auth token) — when there is no session, a
   *   new-format API key (`sb_publishable_…` / `sb_secret_…`) is not sent as a Bearer token.
   * - Invoke params generally match the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) spec.
   * - When you pass in a body to your function, we automatically attach the Content-Type header for `Blob`, `ArrayBuffer`, `File`, `FormData` and `String`. If it doesn't match any of these types we assume the payload is `json`, serialize it and attach the `Content-Type` header as `application/json`. You can override this behavior by passing in a `Content-Type` header of your own.
   * - Responses are automatically parsed as `json`, `blob` and `form-data` depending on the `Content-Type` header sent by your function. Responses are parsed as `text` by default.
   *
   * @example Basic invocation
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   body: { foo: 'bar' }
   * })
   * ```
   *
   * @exampleDescription Error handling
   * A `FunctionsHttpError` error is returned if your function throws an error, `FunctionsRelayError` if the Supabase Relay has an error processing your function and `FunctionsFetchError` if there is a network error in calling your function. Log the full error object so fields like `name`, `context`, and any structured body aren't hidden.
   *
   * @example Error handling
   * ```js
   * import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";
   *
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' }
   * })
   *
   * if (error instanceof FunctionsHttpError) {
   *   const errorMessage = await error.context.json()
   *   console.error('Function returned an error', errorMessage)
   * } else if (error instanceof FunctionsRelayError) {
   *   console.error('Relay error:', error)
   * } else if (error instanceof FunctionsFetchError) {
   *   console.error('Fetch error:', error)
   * }
   * ```
   *
   * @exampleDescription Passing custom headers
   * You can pass custom headers to your function. Note: supabase-js automatically passes the `Authorization` header with the signed in user's JWT.
   *
   * @example Passing custom headers
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' }
   * })
   * ```
   *
   * @exampleDescription Calling with DELETE HTTP verb
   * You can also set the HTTP verb to `DELETE` when calling your Edge Function.
   *
   * @example Calling with DELETE HTTP verb
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   body: { foo: 'bar' },
   *   method: 'DELETE'
   * })
   * ```
   *
   * @exampleDescription Invoking a Function in the UsEast1 region
   * Here are the available regions:
   * - `FunctionRegion.Any`
   * - `FunctionRegion.ApNortheast1`
   * - `FunctionRegion.ApNortheast2`
   * - `FunctionRegion.ApSouth1`
   * - `FunctionRegion.ApSoutheast1`
   * - `FunctionRegion.ApSoutheast2`
   * - `FunctionRegion.CaCentral1`
   * - `FunctionRegion.EuCentral1`
   * - `FunctionRegion.EuWest1`
   * - `FunctionRegion.EuWest2`
   * - `FunctionRegion.EuWest3`
   * - `FunctionRegion.SaEast1`
   * - `FunctionRegion.UsEast1`
   * - `FunctionRegion.UsWest1`
   * - `FunctionRegion.UsWest2`
   *
   * @example Invoking a Function in the UsEast1 region
   * ```js
   * import { createClient, FunctionRegion } from '@supabase/supabase-js'
   *
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   body: { foo: 'bar' },
   *   region: FunctionRegion.UsEast1
   * })
   * ```
   *
   * @exampleDescription Calling with GET HTTP verb
   * You can also set the HTTP verb to `GET` when calling your Edge Function.
   *
   * @example Calling with GET HTTP verb
   * ```js
   * const { data, error } = await supabase.functions.invoke('hello', {
   *   headers: {
   *     "my-custom-header": 'my-custom-header-value'
   *   },
   *   method: 'GET'
   * })
   * ```
   *
   * @example Standalone client invoke
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   */
  invoke(e) {
    return Lg(this, arguments, void 0, function* (r, n = {}) {
      var s, i;
      let o, a, l;
      try {
        const { headers: u, method: c, body: h, signal: d, timeout: g } = n;
        let v = {}, { region: y } = n;
        y || (y = this.region);
        const k = new URL(`${this.url}/${r}`);
        y && y !== "any" && (v["x-region"] = y, k.searchParams.set("forceFunctionRegion", y));
        let f;
        const p = !!u && Object.keys(u).some((A) => A.toLowerCase() === "content-type");
        h && !p ? typeof Blob < "u" && h instanceof Blob || h instanceof ArrayBuffer ? (v["Content-Type"] = "application/octet-stream", f = h) : typeof h == "string" ? (v["Content-Type"] = "text/plain", f = h) : typeof FormData < "u" && h instanceof FormData ? f = h : (v["Content-Type"] = "application/json", f = JSON.stringify(h)) : h && typeof h != "string" && !(typeof Blob < "u" && h instanceof Blob) && !(h instanceof ArrayBuffer) && !(typeof FormData < "u" && h instanceof FormData) ? f = JSON.stringify(h) : f = h;
        let m = d;
        g && (a = new AbortController(), o = setTimeout(() => a.abort(), g), d ? (m = a.signal, l = () => a.abort(), d.addEventListener("abort", l)) : m = a.signal);
        const w = yield this.fetch(k.toString(), {
          method: c || "POST",
          // headers priority is (high to low):
          // 1. invoke-level headers
          // 2. client-level headers
          // 3. default Content-Type header
          headers: Object.assign(Object.assign(Object.assign({}, v), this.headers), u),
          body: f,
          signal: m
        }).catch((A) => {
          throw new Ug(A);
        }), T = w.headers.get("x-relay-error");
        if (T && T === "true")
          throw new Du(w);
        if (!w.ok)
          throw new Mu(w);
        let E = ((s = w.headers.get("Content-Type")) !== null && s !== void 0 ? s : "text/plain").split(";")[0].trim().toLowerCase(), b;
        return E === "application/json" ? b = yield w.json() : E === "application/octet-stream" || E === "application/pdf" ? b = yield w.blob() : E === "text/event-stream" ? b = w : E === "multipart/form-data" ? b = yield w.formData() : b = yield w.text(), { data: b, error: null, response: w };
      } catch (u) {
        return {
          data: null,
          error: u,
          response: u instanceof Mu || u instanceof Du ? u.context : void 0
        };
      } finally {
        o && clearTimeout(o), l && ((i = n.signal) === null || i === void 0 || i.removeEventListener("abort", l));
      }
    });
  }
}
const $d = 3, zu = (t) => Math.min(1e3 * 2 ** t, 3e4), Mg = [520, 503], Ud = [
  "GET",
  "HEAD",
  "OPTIONS"
];
var Bu = class extends Error {
  /**
  * @example
  * ```ts
  * import PostgrestError from '@supabase/postgrest-js'
  *
  * throw new PostgrestError({
  *   message: 'Row level security prevented the request',
  *   details: 'RLS denied the insert',
  *   hint: 'Check your policies',
  *   code: 'PGRST301',
  * })
  * ```
  */
  constructor(t) {
    super(t.message), this.name = "PostgrestError", this.details = t.details, this.hint = t.hint, this.code = t.code;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      hint: this.hint,
      code: this.code
    };
  }
};
function Fu(t, e) {
  return new Promise((r) => {
    if (e != null && e.aborted) {
      r();
      return;
    }
    const n = setTimeout(() => {
      e == null || e.removeEventListener("abort", s), r();
    }, t);
    function s() {
      clearTimeout(n), r();
    }
    e == null || e.addEventListener("abort", s);
  });
}
function zg(t, e, r, n) {
  return !(!n || r >= $d || !Ud.includes(t) || !Mg.includes(e));
}
var Bg = class {
  /**
  * Creates a builder configured for a specific PostgREST request.
  *
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * const { data, error } = await supabase.from('users').select('*')
  * ```
  *
  * @category Database
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
  *
  * const builder = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: new Headers({ apikey: 'your-publishable-key' }) }
  * )
  * ```
  */
  constructor(t) {
    var e, r, n, s, i;
    this.shouldThrowOnError = !1, this.retryEnabled = !0, this.method = t.method, this.url = t.url, this.headers = new Headers(t.headers), this.schema = t.schema, this.body = t.body, this.shouldThrowOnError = (e = t.shouldThrowOnError) !== null && e !== void 0 ? e : !1, this.signal = t.signal, this.isMaybeSingle = (r = t.isMaybeSingle) !== null && r !== void 0 ? r : !1, this.shouldStripNulls = (n = t.shouldStripNulls) !== null && n !== void 0 ? n : !1, this.urlLengthLimit = (s = t.urlLengthLimit) !== null && s !== void 0 ? s : 8e3, this.retryEnabled = (i = t.retry) !== null && i !== void 0 ? i : !0, t.fetch ? this.fetch = t.fetch : this.fetch = fetch;
  }
  /**
  * If there's an error with the query, throwOnError will reject the promise by
  * throwing the error instead of returning it as part of a successful response.
  *
  * {@link https://github.com/supabase/supabase-js/issues/92}
  *
  * @category Database
  * @subcategory Using modifiers
  */
  throwOnError() {
    return this.shouldThrowOnError = !0, this;
  }
  /**
  * Strip null values from the response data. Properties with `null` values
  * will be omitted from the returned JSON objects.
  *
  * Requires PostgREST 11.2.0+.
  *
  * {@link https://docs.postgrest.org/en/stable/references/api/resource_representation.html#stripped-nulls}
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .stripNulls()
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text, bio text);
  *
  * insert into
  *   characters (id, name, bio)
  * values
  *   (1, 'Luke', null),
  *   (2, 'Leia', 'Princess of Alderaan');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Leia",
  *       "bio": "Princess of Alderaan"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  stripNulls() {
    if (this.headers.get("Accept") === "text/csv") throw new Error("stripNulls() cannot be used with csv()");
    return this.shouldStripNulls = !0, this;
  }
  /**
  * Set an HTTP header on this single PostgREST request, overriding any header
  * with the same name set on the client.
  *
  * This is an advanced escape hatch for one-off needs (passing a custom
  * `Authorization` for a single query, attaching a tracing header, etc.).
  * Most callers do not need it: configure client-wide headers via the
  * `headers` option when constructing the client, and authentication via
  * Supabase Auth.
  *
  * @param name - HTTP header name
  * @param value - HTTP header value
  *
  * @category Database
  * @subcategory Using modifiers
  */
  setHeader(t, e) {
    return this.headers = new Headers(this.headers), this.headers.set(t, e), this;
  }
  /**
  * @category Database
  * @subcategory Using modifiers
  *
  * Configure retry behavior for this request.
  *
  * By default, retries are enabled for idempotent requests (GET, HEAD, OPTIONS)
  * that fail with network errors or specific HTTP status codes (503, 520).
  * Retries use exponential backoff (1s, 2s, 4s) with a maximum of 3 attempts.
  *
  * @param enabled - Whether to enable retries for this request
  *
  * @example
  * ```ts
  * // Disable retries for a specific query
  * const { data, error } = await supabase
  *   .from('users')
  *   .select()
  *   .retry(false)
  * ```
  */
  retry(t) {
    return this.retryEnabled = t, this;
  }
  then(t, e) {
    var r = this;
    if (this.schema === void 0 || (["GET", "HEAD"].includes(this.method) ? this.headers.set("Accept-Profile", this.schema) : this.headers.set("Content-Profile", this.schema)), this.method !== "GET" && this.method !== "HEAD" && this.headers.set("Content-Type", "application/json"), this.shouldStripNulls) {
      const o = this.headers.get("Accept");
      o === "application/vnd.pgrst.object+json" ? this.headers.set("Accept", "application/vnd.pgrst.object+json;nulls=stripped") : (!o || o === "application/json") && this.headers.set("Accept", "application/vnd.pgrst.array+json;nulls=stripped");
    }
    const n = this.fetch;
    let i = (async () => {
      let o = 0;
      for (; ; ) {
        const u = {};
        r.headers.forEach((h, d) => {
          u[d] = h;
        }), o > 0 && (u["X-Retry-Count"] = String(o));
        let c;
        try {
          c = await n(r.url.toString(), {
            method: r.method,
            headers: u,
            body: JSON.stringify(r.body, (h, d) => typeof d == "bigint" ? d.toString() : d),
            signal: r.signal
          });
        } catch (h) {
          if ((h == null ? void 0 : h.name) === "AbortError" || (h == null ? void 0 : h.code) === "ABORT_ERR" || !Ud.includes(r.method)) throw h;
          if (r.retryEnabled && o < $d) {
            const d = zu(o);
            o++, await Fu(d, r.signal);
            continue;
          }
          throw h;
        }
        if (zg(r.method, c.status, o, r.retryEnabled)) {
          var a, l;
          const h = (a = (l = c.headers) === null || l === void 0 ? void 0 : l.get("Retry-After")) !== null && a !== void 0 ? a : null, d = h !== null ? Math.max(0, parseInt(h, 10) || 0) * 1e3 : zu(o);
          await c.text(), o++, await Fu(d, r.signal);
          continue;
        }
        return await r.processResponse(c);
      }
    })();
    return this.shouldThrowOnError || (i = i.catch((o) => {
      var a;
      let l = "", u = "", c = "";
      const h = o == null ? void 0 : o.cause;
      if (h) {
        var d, g, v, y;
        const p = (d = h == null ? void 0 : h.message) !== null && d !== void 0 ? d : "", m = (g = h == null ? void 0 : h.code) !== null && g !== void 0 ? g : "";
        l = `${(v = o == null ? void 0 : o.name) !== null && v !== void 0 ? v : "FetchError"}: ${o == null ? void 0 : o.message}`, l += `

Caused by: ${(y = h == null ? void 0 : h.name) !== null && y !== void 0 ? y : "Error"}: ${p}`, m && (l += ` (${m})`), h != null && h.stack && (l += `
${h.stack}`);
      } else {
        var k;
        l = (k = o == null ? void 0 : o.stack) !== null && k !== void 0 ? k : "";
      }
      const f = this.url.toString().length;
      return (o == null ? void 0 : o.name) === "AbortError" || (o == null ? void 0 : o.code) === "ABORT_ERR" ? (c = "", u = "Request was aborted (timeout or manual cancellation)", f > this.urlLengthLimit && (u += `. Note: Your request URL is ${f} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)) : ((h == null ? void 0 : h.name) === "HeadersOverflowError" || (h == null ? void 0 : h.code) === "UND_ERR_HEADERS_OVERFLOW") && (c = "", u = "HTTP headers exceeded server limits (typically 16KB)", f > this.urlLengthLimit && (u += `. Your request URL is ${f} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)), {
        success: !1,
        error: {
          message: `${(a = o == null ? void 0 : o.name) !== null && a !== void 0 ? a : "FetchError"}: ${o == null ? void 0 : o.message}`,
          details: l,
          hint: u,
          code: c
        },
        data: null,
        count: null,
        status: 0,
        statusText: ""
      };
    })), i.then(t, e);
  }
  /**
  * Process a fetch response and return the standardized postgrest response.
  */
  async processResponse(t) {
    var e = this;
    let r = null, n = null, s = null, i = t.status, o = t.statusText;
    if (t.ok) {
      var a, l;
      if (e.method !== "HEAD") {
        var u;
        const d = await t.text();
        if (d !== "") if (e.headers.get("Accept") === "text/csv") n = d;
        else if (e.headers.get("Accept") && (!((u = e.headers.get("Accept")) === null || u === void 0) && u.includes("application/vnd.pgrst.plan+text"))) n = d;
        else try {
          n = JSON.parse(d);
        } catch {
          if (r = { message: d }, n = null, e.shouldThrowOnError) throw new Bu({
            message: d,
            details: "",
            hint: "",
            code: ""
          });
        }
      }
      const c = (a = e.headers.get("Prefer")) === null || a === void 0 ? void 0 : a.match(/count=(exact|planned|estimated)/), h = (l = t.headers.get("content-range")) === null || l === void 0 ? void 0 : l.split("/");
      c && h && h.length > 1 && (s = parseInt(h[1])), e.isMaybeSingle && Array.isArray(n) && (n.length > 1 ? (r = {
        code: "PGRST116",
        details: `Results contain ${n.length} rows, application/vnd.pgrst.object+json requires 1 row`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned"
      }, n = null, s = null, i = 406, o = "Not Acceptable") : n.length === 1 ? n = n[0] : n = null);
    } else {
      const c = await t.text();
      try {
        r = JSON.parse(c), Array.isArray(r) && t.status === 404 && (n = [], r = null, i = 200, o = "OK");
      } catch {
        t.status === 404 && c === "" ? (i = 204, o = "No Content") : r = { message: c };
      }
      if (r && e.shouldThrowOnError) throw new Bu(r);
    }
    return {
      success: r === null,
      error: r,
      data: n,
      count: s,
      status: i,
      statusText: o
    };
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  *
  * @category Database
  * @subcategory Using modifiers
  */
  returns() {
    return this;
  }
  /**
  * Override the type of the returned `data` field in the response.
  *
  * @typeParam NewResult - The new type to cast the response data to
  * @typeParam Options - Optional type configuration (defaults to { merge: true })
  * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
  * @example
  * ```typescript
  * // Merge with existing types (default behavior)
  * const query = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ custom_field: string }>()
  *
  * // Replace existing types completely
  * const replaceQuery = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
  * ```
  * @returns A PostgrestBuilder instance with the new type
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example Complete Override type of successful response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .overrideTypes<Array<MyType>, { merge: false }>()
  * ```
  *
  * @exampleResponse Complete Override type of successful response
  * ```ts
  * let x: typeof data // MyType[]
  * ```
  *
  * @example Complete Override type of object response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .maybeSingle()
  *   .overrideTypes<MyType, { merge: false }>()
  * ```
  *
  * @exampleResponse Complete Override type of object response
  * ```ts
  * let x: typeof data // MyType | null
  * ```
  *
  * @example Partial Override type of successful response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .overrideTypes<Array<{ status: "A" | "B" }>>()
  * ```
  *
  * @exampleResponse Partial Override type of successful response
  * ```ts
  * let x: typeof data // Array<CountryRowProperties & { status: "A" | "B" }>
  * ```
  *
  * @example Partial Override type of object response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .maybeSingle()
  *   .overrideTypes<{ status: "A" | "B" }>()
  * ```
  *
  * @exampleResponse Partial Override type of object response
  * ```ts
  * let x: typeof data // CountryRowProperties & { status: "A" | "B" } | null
  * ```
  *
  * @example Merge vs replace existing types
  * ```typescript
  * // Merge with existing types (default behavior)
  * const query = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ custom_field: string }>()
  *
  * // Replace existing types completely
  * const replaceQuery = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
  * ```
  */
  overrideTypes() {
    return this;
  }
}, Fg = class extends Bg {
  throwOnError() {
    return super.throwOnError();
  }
  /**
  * Perform a SELECT on the query result.
  *
  * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
  * return modified rows. By calling this method, modified rows are returned in
  * `data`.
  *
  * @param columns - The columns to retrieve, separated by commas
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `upsert()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .upsert({ id: 1, name: 'Han Solo' })
  *   .select()
  * ```
  *
  * @exampleSql With `upsert()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Han');
  * ```
  *
  * @exampleResponse With `upsert()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Han Solo"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  */
  select(t) {
    let e = !1;
    const r = (t ?? "*").split("").map((n) => /\s/.test(n) && !e ? "" : (n === '"' && (e = !e), n)).join("");
    return this.url.searchParams.set("select", r), this.headers.append("Prefer", "return=representation"), this;
  }
  /**
  * Order the query result by `column`.
  *
  * You can call this method multiple times to order by multiple columns.
  *
  * You can order referenced tables, but it only affects the ordering of the
  * parent table if you use `!inner` in the query.
  *
  * @param column - The column to order by
  * @param options - Named parameters
  * @param options.ascending - If `true`, the result will be in ascending order
  * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
  * `null`s appear last.
  * @param options.referencedTable - Set this to order a referenced table by
  * its columns
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('id, name')
  *   .order('id', { ascending: false })
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     },
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription On a referenced table
  * Ordering with `referencedTable` doesn't affect the ordering of the
  * parent table.
  *
  * @example On a referenced table
  * ```ts
  *   const { data, error } = await supabase
  *     .from('orchestral_sections')
  *     .select(`
  *       name,
  *       instruments (
  *         name
  *       )
  *     `)
  *     .order('name', { referencedTable: 'instruments', ascending: false })
  *
  * ```
  *
  * @exampleSql On a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 1, 'harp'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse On a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         },
  *         {
  *           "name": "harp"
  *         }
  *       ]
  *     },
  *     {
  *       "name": "woodwinds",
  *       "instruments": []
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Order parent table by a referenced table
  * Ordering with `referenced_table(col)` affects the ordering of the
  * parent table.
  *
  * @example Order parent table by a referenced table
  * ```ts
  *   const { data, error } = await supabase
  *     .from('instruments')
  *     .select(`
  *       name,
  *       section:orchestral_sections (
  *         name
  *       )
  *     `)
  *     .order('section(name)', { ascending: true })
  *
  * ```
  *
  * @exampleSql Order parent table by a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Order parent table by a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "violin",
  *       "orchestral_sections": {"name": "strings"}
  *     },
  *     {
  *       "name": "flute",
  *       "orchestral_sections": {"name": "woodwinds"}
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  order(t, { ascending: e = !0, nullsFirst: r, foreignTable: n, referencedTable: s = n } = {}) {
    const i = s ? `${s}.order` : "order", o = this.url.searchParams.get(i);
    return this.url.searchParams.set(i, `${o ? `${o},` : ""}${t}.${e ? "asc" : "desc"}${r === void 0 ? "" : r ? ".nullsfirst" : ".nullslast"}`), this;
  }
  /**
  * Limit the query result by `rows`.
  *
  * @param rows - The maximum number of rows to return
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .limit(1)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example On a referenced table
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments (
  *       name
  *     )
  *   `)
  *   .limit(1, { referencedTable: 'instruments' })
  * ```
  *
  * @exampleSql On a referenced table
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 1, 'harp'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse On a referenced table
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  limit(t, { foreignTable: e, referencedTable: r = e } = {}) {
    const n = typeof r > "u" ? "limit" : `${r}.limit`;
    return this.url.searchParams.set(n, `${t}`), this;
  }
  /**
  * Limit the query result by starting at an offset `from` and ending at the offset `to`.
  * Only records within this range are returned.
  * This respects the query order and if there is no order clause the range could behave unexpectedly.
  * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
  * and fourth rows of the query.
  *
  * @param from - The starting index from which to limit the result
  * @param to - The last index to which to limit the result
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .range(0, 1)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Luke"
  *     },
  *     {
  *       "name": "Leia"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  range(t, e, { foreignTable: r, referencedTable: n = r } = {}) {
    const s = typeof n > "u" ? "offset" : `${n}.offset`, i = typeof n > "u" ? "limit" : `${n}.limit`;
    return this.url.searchParams.set(s, `${t}`), this.url.searchParams.set(i, `${e - t + 1}`), this;
  }
  /**
  * Set the AbortSignal for the fetch request.
  *
  * @param signal - The AbortSignal to use for the fetch request
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @remarks
  * You can use this to set a timeout for the request.
  *
  * @exampleDescription Aborting requests in-flight
  * You can use an [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) to abort requests.
  * Note that `status` and `statusText` don't mean anything for aborted requests as the request wasn't fulfilled.
  *
  * @example Aborting requests in-flight
  * ```ts
  * const ac = new AbortController()
  *
  * const { data, error } = await supabase
  *   .from('very_big_table')
  *   .select()
  *   .abortSignal(ac.signal)
  *
  * // Abort the request after 100 ms
  * setTimeout(() => ac.abort(), 100)
  * ```
  *
  * @exampleResponse Aborting requests in-flight
  * ```json
  *   {
  *     "error": {
  *       "message": "AbortError: The user aborted a request.",
  *       "details": "",
  *       "hint": "The request was aborted locally via the provided AbortSignal.",
  *       "code": ""
  *     },
  *     "status": 0,
  *     "statusText": ""
  *   }
  *
  * ```
  *
  * @example Set a timeout
  * ```ts
  * const { data, error } = await supabase
  *   .from('very_big_table')
  *   .select()
  *   .abortSignal(AbortSignal.timeout(1000 /* ms *\/))
  * ```
  *
  * @exampleResponse Set a timeout
  * ```json
  *   {
  *     "error": {
  *       "message": "FetchError: The user aborted a request.",
  *       "details": "",
  *       "hint": "",
  *       "code": ""
  *     },
  *     "status": 400,
  *     "statusText": "Bad Request"
  *   }
  *
  * ```
  */
  abortSignal(t) {
    return this.signal = t, this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be one row (e.g. using `.limit(1)`), otherwise this
  * returns an error.
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .limit(1)
  *   .single()
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": {
  *     "name": "Luke"
  *   },
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  single() {
    return this.headers.set("Accept", "application/vnd.pgrst.object+json"), this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
  * this returns an error.
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .eq('name', 'Katniss')
  *   .maybeSingle()
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  maybeSingle() {
    return this.isMaybeSingle = !0, this;
  }
  /**
  * Return `data` as a string in CSV format.
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @exampleDescription Return data as CSV
  * By default, the data is returned in JSON format, but can also be returned as Comma Separated Values.
  *
  * @example Return data as CSV
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .csv()
  * ```
  *
  * @exampleSql Return data as CSV
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Return data as CSV
  * ```json
  * {
  *   "data": "id,name\n1,Luke\n2,Leia\n3,Han",
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  csv() {
    return this.headers.set("Accept", "text/csv"), this;
  }
  /**
  * Return `data` as an object in [GeoJSON](https://geojson.org) format.
  *
  * @category Database
  * @subcategory Using modifiers
  */
  geojson() {
    return this.headers.set("Accept", "application/geo+json"), this;
  }
  /**
  * Return `data` as the EXPLAIN plan for the query.
  *
  * You need to enable the
  * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
  * setting before using this method.
  *
  * @param options - Named parameters
  *
  * @param options.analyze - If `true`, the query will be executed and the
  * actual run time will be returned
  *
  * @param options.verbose - If `true`, the query identifier will be returned
  * and `data` will include the output columns of the query
  *
  * @param options.settings - If `true`, include information on configuration
  * parameters that affect query planning
  *
  * @param options.buffers - If `true`, include information on buffer usage
  *
  * @param options.wal - If `true`, include information on WAL record generation
  *
  * @param options.format - The format of the output, can be `"text"` (default)
  * or `"json"`
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @exampleDescription Get the execution plan
  * By default, the data is returned in TEXT format, but can also be returned as JSON by using the `format` parameter.
  *
  * @example Get the execution plan
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .explain()
  * ```
  *
  * @exampleSql Get the execution plan
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Get the execution plan
  * ```js
  * Aggregate  (cost=33.34..33.36 rows=1 width=112)
  *   ->  Limit  (cost=0.00..18.33 rows=1000 width=40)
  *         ->  Seq Scan on characters  (cost=0.00..22.00 rows=1200 width=40)
  * ```
  *
  * @exampleDescription Get the execution plan with analyze and verbose
  * By default, the data is returned in TEXT format, but can also be returned as JSON by using the `format` parameter.
  *
  * @example Get the execution plan with analyze and verbose
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .explain({analyze:true,verbose:true})
  * ```
  *
  * @exampleSql Get the execution plan with analyze and verbose
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Get the execution plan with analyze and verbose
  * ```js
  * Aggregate  (cost=33.34..33.36 rows=1 width=112) (actual time=0.041..0.041 rows=1 loops=1)
  *   Output: NULL::bigint, count(ROW(characters.id, characters.name)), COALESCE(json_agg(ROW(characters.id, characters.name)), '[]'::json), NULLIF(current_setting('response.headers'::text, true), ''::text), NULLIF(current_setting('response.status'::text, true), ''::text)
  *   ->  Limit  (cost=0.00..18.33 rows=1000 width=40) (actual time=0.005..0.006 rows=3 loops=1)
  *         Output: characters.id, characters.name
  *         ->  Seq Scan on public.characters  (cost=0.00..22.00 rows=1200 width=40) (actual time=0.004..0.005 rows=3 loops=1)
  *               Output: characters.id, characters.name
  * Query Identifier: -4730654291623321173
  * Planning Time: 0.407 ms
  * Execution Time: 0.119 ms
  * ```
  */
  explain({ analyze: t = !1, verbose: e = !1, settings: r = !1, buffers: n = !1, wal: s = !1, format: i = "text" } = {}) {
    var o;
    const a = [
      t ? "analyze" : null,
      e ? "verbose" : null,
      r ? "settings" : null,
      n ? "buffers" : null,
      s ? "wal" : null
    ].filter(Boolean).join("|"), l = (o = this.headers.get("Accept")) !== null && o !== void 0 ? o : "application/json";
    return this.headers.set("Accept", `application/vnd.pgrst.plan+${i}; for="${l}"; options=${a};`), i === "json" ? this : this;
  }
  /**
  * Dry-run this request: execute the query but discard the changes.
  *
  * Server-side, PostgREST runs the query inside a transaction and rolls it back
  * instead of committing. The response still contains the data that *would* have
  * been returned — `RETURNING` clauses execute and RLS, triggers, and constraints
  * are all evaluated — but no row is actually inserted, updated, or deleted.
  *
  * This affects only the single request it is chained to. The JS caller has no
  * handle on the transaction: supabase-js does not group multiple queries into
  * one transaction. For multi-statement transactional logic, use a database
  * function (`supabase.rpc(...)`).
  *
  * Sets the `Prefer: tx=rollback` header. See PostgREST's docs on transaction
  * preferences for the underlying mechanism.
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @example Validate an insert without persisting
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .insert({ name: 'France' })
  *   .select()
  *   .rollback()
  * // `data` shows what would have been inserted; nothing is saved.
  * ```
  */
  rollback() {
    return this.headers.append("Prefer", "tx=rollback"), this;
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  *
  * @category Database
  * @subcategory Using modifiers
  *
  * @remarks
  * - Deprecated: use overrideTypes method instead
  *
  * @example Override type of successful response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .returns<Array<MyType>>()
  * ```
  *
  * @exampleResponse Override type of successful response
  * ```js
  * let x: typeof data // MyType[]
  * ```
  *
  * @example Override type of object response
  * ```ts
  * const { data } = await supabase
  *   .from('countries')
  *   .select()
  *   .maybeSingle()
  *   .returns<MyType>()
  * ```
  *
  * @exampleResponse Override type of object response
  * ```js
  * let x: typeof data // MyType | null
  * ```
  */
  returns() {
    return this;
  }
  /**
  * Set the maximum number of rows that can be affected by the query.
  * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
  *
  * @param rows - The maximum number of rows that can be affected
  *
  * @category Database
  * @subcategory Using modifiers
  */
  maxAffected(t) {
    return this.headers.append("Prefer", "handling=strict"), this.headers.append("Prefer", `max-affected=${t}`), this;
  }
};
const Hu = /* @__PURE__ */ new RegExp("[,()]");
var gr = class extends Fg {
  throwOnError() {
    return super.throwOnError();
  }
  /**
  * Match only rows where `column` is equal to `value`.
  *
  * To check if the value of `column` is NULL, you should use `.is()` instead.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  * @subcategory Using filters
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .eq('name', 'Leia')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  eq(t, e) {
    return this.url.searchParams.append(t, `eq.${e}`), this;
  }
  /**
  * Match only rows where `column` is not equal to `value`.
  *
  * This filter does not include rows where `column` is `NULL`. To match null
  * values, use `.is(column, null)` instead.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  *
  * @category Database
  * @subcategory Using filters
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .neq('name', 'Leia')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Luke"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  neq(t, e) {
    return this.url.searchParams.append(t, `neq.${e}`), this;
  }
  gt(t, e) {
    return this.url.searchParams.append(t, `gt.${e}`), this;
  }
  gte(t, e) {
    return this.url.searchParams.append(t, `gte.${e}`), this;
  }
  lt(t, e) {
    return this.url.searchParams.append(t, `lt.${e}`), this;
  }
  lte(t, e) {
    return this.url.searchParams.append(t, `lte.${e}`), this;
  }
  like(t, e) {
    return this.url.searchParams.append(t, `like.${e}`), this;
  }
  likeAllOf(t, e) {
    return this.url.searchParams.append(t, `like(all).{${e.join(",")}}`), this;
  }
  likeAnyOf(t, e) {
    return this.url.searchParams.append(t, `like(any).{${e.join(",")}}`), this;
  }
  ilike(t, e) {
    return this.url.searchParams.append(t, `ilike.${e}`), this;
  }
  ilikeAllOf(t, e) {
    return this.url.searchParams.append(t, `ilike(all).{${e.join(",")}}`), this;
  }
  ilikeAnyOf(t, e) {
    return this.url.searchParams.append(t, `ilike(any).{${e.join(",")}}`), this;
  }
  regexMatch(t, e) {
    return this.url.searchParams.append(t, `match.${e}`), this;
  }
  regexIMatch(t, e) {
    return this.url.searchParams.append(t, `imatch.${e}`), this;
  }
  is(t, e) {
    return this.url.searchParams.append(t, `is.${e}`), this;
  }
  /**
  * Match only rows where `column` IS DISTINCT FROM `value`.
  *
  * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
  * are considered equal (not distinct), and comparing `NULL` with any non-NULL
  * value returns true (distinct).
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  isDistinct(t, e) {
    return this.url.searchParams.append(t, `isdistinct.${e}`), this;
  }
  /**
  * Match only rows where `column` is included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  *
  * @category Database
  * @subcategory Using filters
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  *   .in('name', ['Leia', 'Han'])
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 2,
  *       "name": "Leia"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  in(t, e) {
    const r = Array.from(new Set(e)).map((n) => typeof n == "string" && Hu.test(n) ? `"${n}"` : `${n}`).join(",");
    return this.url.searchParams.append(t, `in.(${r})`), this;
  }
  /**
  * Match only rows where `column` is NOT included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  */
  notIn(t, e) {
    const r = Array.from(new Set(e)).map((n) => typeof n == "string" && Hu.test(n) ? `"${n}"` : `${n}`).join(",");
    return this.url.searchParams.append(t, `not.in.(${r})`), this;
  }
  contains(t, e) {
    return typeof e == "string" ? this.url.searchParams.append(t, `cs.${e}`) : Array.isArray(e) ? this.url.searchParams.append(t, `cs.{${e.join(",")}}`) : this.url.searchParams.append(t, `cs.${JSON.stringify(e)}`), this;
  }
  containedBy(t, e) {
    return typeof e == "string" ? this.url.searchParams.append(t, `cd.${e}`) : Array.isArray(e) ? this.url.searchParams.append(t, `cd.{${e.join(",")}}`) : this.url.searchParams.append(t, `cd.${JSON.stringify(e)}`), this;
  }
  rangeGt(t, e) {
    return this.url.searchParams.append(t, `sr.${e}`), this;
  }
  rangeGte(t, e) {
    return this.url.searchParams.append(t, `nxl.${e}`), this;
  }
  rangeLt(t, e) {
    return this.url.searchParams.append(t, `sl.${e}`), this;
  }
  rangeLte(t, e) {
    return this.url.searchParams.append(t, `nxr.${e}`), this;
  }
  rangeAdjacent(t, e) {
    return this.url.searchParams.append(t, `adj.${e}`), this;
  }
  overlaps(t, e) {
    return typeof e == "string" ? this.url.searchParams.append(t, `ov.${e}`) : this.url.searchParams.append(t, `ov.{${e.join(",")}}`), this;
  }
  textSearch(t, e, { config: r, type: n } = {}) {
    let s = "";
    n === "plain" ? s = "pl" : n === "phrase" ? s = "ph" : n === "websearch" && (s = "w");
    const i = r === void 0 ? "" : `(${r})`;
    return this.url.searchParams.append(t, `${s}fts${i}.${e}`), this;
  }
  match(t) {
    return Object.entries(t).filter(([e, r]) => r !== void 0).forEach(([e, r]) => {
      this.url.searchParams.append(e, `eq.${r}`);
    }), this;
  }
  /**
  * Match only rows which doesn't satisfy the filter.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to be negated to filter with, following
  * PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  *
  * @category Database
  * @subcategory Using filters
  *
  * @remarks
  * not() expects you to use the raw PostgREST syntax for the filter values.
  *
  * ```ts
  * .not('id', 'in', '(5,6,7)')  // Use `()` for `in` filter
  * .not('arraycol', 'cs', '{"a","b"}')  // Use `cs` for `contains()`, `{}` for array values
  * ```
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .select()
  *   .not('name', 'is', null)
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'null'),
  *   (2, null);
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  *   {
  *     "data": [
  *       {
  *         "id": 1,
  *         "name": "null"
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  */
  not(t, e, r) {
    return this.url.searchParams.append(t, `not.${e}.${r}`), this;
  }
  /**
  * Match only rows which satisfy at least one of the filters.
  *
  * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure it's properly sanitized.
  *
  * It's currently not possible to do an `.or()` filter across multiple tables.
  *
  * @param filters - The filters to use, following PostgREST syntax
  * @param options - Named parameters
  * @param options.referencedTable - Set this to filter on referenced tables
  * instead of the parent table
  * @param options.foreignTable - Deprecated, use `referencedTable` instead
  *
  * @category Database
  * @subcategory Using filters
  *
  * @remarks
  * or() expects you to use the raw PostgREST syntax for the filter names and values.
  *
  * ```ts
  * .or('id.in.(5,6,7), arraycol.cs.{"a","b"}')  // Use `()` for `in` filter, `{}` for array values and `cs` for `contains()`.
  * .or('id.in.(5,6,7), arraycol.cd.{"a","b"}')  // Use `cd` for `containedBy()`
  * ```
  *
  * @example With `select()`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .or('id.eq.2,name.eq.Han')
  * ```
  *
  * @exampleSql With `select()`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse With `select()`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Leia"
  *     },
  *     {
  *       "name": "Han"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Use `or` with `and`
  * ```ts
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  *   .or('id.gt.3,and(id.eq.1,name.eq.Luke)')
  * ```
  *
  * @exampleSql Use `or` with `and`
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Use `or` with `and`
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Luke"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Use `or` on referenced tables
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments!inner (
  *       name
  *     )
  *   `)
  *   .or('section_id.eq.1,name.eq.guzheng', { referencedTable: 'instruments' })
  * ```
  *
  * @exampleSql Use `or` on referenced tables
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Use `or` on referenced tables
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  or(t, { foreignTable: e, referencedTable: r = e } = {}) {
    const n = r ? `${r}.or` : "or";
    return this.url.searchParams.append(n, `(${t})`), this;
  }
  filter(t, e, r) {
    return this.url.searchParams.append(t, `${e}.${r}`), this;
  }
}, Hg = class {
  /**
  * Creates a query builder scoped to a Postgres table or view.
  *
  * @category Database
  *
  * @param url - The URL for the query
  * @param options - Named parameters
  * @param options.headers - Custom headers
  * @param options.schema - Postgres schema to use
  * @param options.fetch - Custom fetch implementation
  * @param options.urlLengthLimit - Maximum URL length before warning
  * @param options.retry - Enable automatic retries for transient errors (default: true)
  *
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * const { data, error } = await supabase.from('users').select('*')
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
  *
  * const query = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: { apikey: 'your-publishable-key' }, retry: true }
  * )
  * ```
  */
  constructor(t, { headers: e = {}, schema: r, fetch: n, urlLengthLimit: s = 8e3, retry: i }) {
    this.url = t, this.headers = new Headers(e), this.schema = r, this.fetch = n, this.urlLengthLimit = s, this.retry = i;
  }
  /**
  * Clone URL and headers to prevent shared state between operations.
  */
  cloneRequestState() {
    return {
      url: new URL(this.url.toString()),
      headers: new Headers(this.headers)
    };
  }
  /**
  * Perform a SELECT query on the table or view.
  *
  * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
  *
  * @param options - Named parameters
  *
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  *
  * @param options.count - Count algorithm to use to count rows in the table or view.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @remarks
  * When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows
  * that match your filters, not the number of rows in the current page. Use this to build pagination UI.
  
  * - By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in your project's [API settings](/dashboard/project/_/settings/api). It's recommended that you keep it low to limit the payload size of accidental or malicious requests. You can use `range()` queries to paginate through your data.
  * - `select()` can be combined with [Filters](/docs/reference/javascript/using-filters)
  * - `select()` can be combined with [Modifiers](/docs/reference/javascript/using-modifiers)
  * - `apikey` is a reserved keyword if you're using the [Supabase Platform](/docs/guides/platform) and [should be avoided as a column name](https://github.com/supabase/supabase/issues/5465). *
  * @category Database
  *
  * @example Getting your data
  * ```js
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select()
  * ```
  *
  * @exampleSql Getting your data
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Harry'),
  *   (2, 'Frodo'),
  *   (3, 'Katniss');
  * ```
  *
  * @exampleResponse Getting your data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Harry"
  *     },
  *     {
  *       "id": 2,
  *       "name": "Frodo"
  *     },
  *     {
  *       "id": 3,
  *       "name": "Katniss"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Handling errors
  * The most useful field on a Postgres error is usually `hint` — when the database knows the fix, it puts the literal SQL there. For example, a permission-denied error (`code: '42501'`) arrives with a `hint` like `"Grant the required privileges to the current role with: GRANT SELECT ON public.characters TO anon;"`. Log the full `error` object so the hint isn't hidden behind `error.message`.
  *
  * @example Handling errors
  * ```js
  * const { data, error } = await supabase.from('characters').select()
  * if (error) {
  *   // Logs the full error: message, code, details, and hint.
  *   console.error(error)
  *   return
  * }
  * ```
  *
  * @exampleResponse Handling errors
  * ```json
  * {
  *   "error": {
  *     "code": "42501",
  *     "details": null,
  *     "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.characters TO anon;",
  *     "message": "permission denied for table characters"
  *   },
  *   "status": 401,
  *   "statusText": "Unauthorized"
  * }
  * ```
  *
  * @example Selecting specific columns
  * ```js
  * const { data, error } = await supabase
  *   .from('characters')
  *   .select('name')
  * ```
  *
  * @exampleSql Selecting specific columns
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Frodo'),
  *   (2, 'Harry'),
  *   (3, 'Katniss');
  * ```
  *
  * @exampleResponse Selecting specific columns
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "Frodo"
  *     },
  *     {
  *       "name": "Harry"
  *     },
  *     {
  *       "name": "Katniss"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query referenced tables
  * If your database has foreign key relationships, you can query related tables too.
  *
  * @example Query referenced tables
  * ```js
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`
  *     name,
  *     instruments (
  *       name
  *     )
  *   `)
  * ```
  *
  * @exampleSql Query referenced tables
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Query referenced tables
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     },
  *     {
  *       "name": "woodwinds",
  *       "instruments": [
  *         {
  *           "name": "flute"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query referenced tables with spaces in their names
  * If your table name contains spaces, you must use double quotes in the `select` statement to reference the table.
  *
  * @example Query referenced tables with spaces in their names
  * ```js
  * const { data, error } = await supabase
  *   .from('orchestral sections')
  *   .select(`
  *     name,
  *     "musical instruments" (
  *       name
  *     )
  *   `)
  * ```
  *
  * @exampleSql Query referenced tables with spaces in their names
  * ```sql
  * create table
  *   "orchestral sections" (id int8 primary key, name text);
  * create table
  *   "musical instruments" (
  *     id int8 primary key,
  *     section_id int8 not null references "orchestral sections",
  *     name text
  *   );
  *
  * insert into
  *   "orchestral sections" (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   "musical instruments" (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Query referenced tables with spaces in their names
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "strings",
  *       "musical instruments": [
  *         {
  *           "name": "violin"
  *         }
  *       ]
  *     },
  *     {
  *       "name": "woodwinds",
  *       "musical instruments": [
  *         {
  *           "name": "flute"
  *         }
  *       ]
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query referenced tables through a join table
  * If you're in a situation where your tables are **NOT** directly
  * related, but instead are joined by a _join table_, you can still use
  * the `select()` method to query the related data. The join table needs
  * to have the foreign keys as part of its composite primary key.
  *
  * @example Query referenced tables through a join table
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .select(`
  *     name,
  *     teams (
  *       name
  *     )
  *   `)
  *   
  * ```
  *
  * @exampleSql Query referenced tables through a join table
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text
  *   );
  * create table
  *   teams (
  *     id int8 primary key,
  *     name text
  *   );
  * -- join table
  * create table
  *   users_teams (
  *     user_id int8 not null references users,
  *     team_id int8 not null references teams,
  *     -- both foreign keys must be part of a composite primary key
  *     primary key (user_id, team_id)
  *   );
  *
  * insert into
  *   users (id, name)
  * values
  *   (1, 'Kiran'),
  *   (2, 'Evan');
  * insert into
  *   teams (id, name)
  * values
  *   (1, 'Green'),
  *   (2, 'Blue');
  * insert into
  *   users_teams (user_id, team_id)
  * values
  *   (1, 1),
  *   (1, 2),
  *   (2, 2);
  * ```
  *
  * @exampleResponse Query referenced tables through a join table
  * ```json
  *   {
  *     "data": [
  *       {
  *         "name": "Kiran",
  *         "teams": [
  *           {
  *             "name": "Green"
  *           },
  *           {
  *             "name": "Blue"
  *           }
  *         ]
  *       },
  *       {
  *         "name": "Evan",
  *         "teams": [
  *           {
  *             "name": "Blue"
  *           }
  *         ]
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *   
  * ```
  *
  * @exampleDescription Query the same referenced table multiple times
  * If you need to query the same referenced table twice, use the name of the
  * joined column to identify which join to use. You can also give each
  * column an alias.
  *
  * @example Query the same referenced table multiple times
  * ```ts
  * const { data, error } = await supabase
  *   .from('messages')
  *   .select(`
  *     content,
  *     from:sender_id(name),
  *     to:receiver_id(name)
  *   `)
  *
  * // To infer types, use the name of the table (in this case `users`) and
  * // the name of the foreign key constraint.
  * const { data, error } = await supabase
  *   .from('messages')
  *   .select(`
  *     content,
  *     from:users!messages_sender_id_fkey(name),
  *     to:users!messages_receiver_id_fkey(name)
  *   `)
  * ```
  *
  * @exampleSql Query the same referenced table multiple times
  * ```sql
  *  create table
  *  users (id int8 primary key, name text);
  *
  *  create table
  *    messages (
  *      sender_id int8 not null references users,
  *      receiver_id int8 not null references users,
  *      content text
  *    );
  *
  *  insert into
  *    users (id, name)
  *  values
  *    (1, 'Kiran'),
  *    (2, 'Evan');
  *
  *  insert into
  *    messages (sender_id, receiver_id, content)
  *  values
  *    (1, 2, '👋');
  *  ```
  * ```
  *
  * @exampleResponse Query the same referenced table multiple times
  * ```json
  * {
  *   "data": [
  *     {
  *       "content": "👋",
  *       "from": {
  *         "name": "Kiran"
  *       },
  *       "to": {
  *         "name": "Evan"
  *       }
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Query nested foreign tables through a join table
  * You can use the result of a joined table to gather data in
  * another foreign table. With multiple references to the same foreign
  * table you must specify the column on which to conduct the join.
  *
  * @example Query nested foreign tables through a join table
  * ```ts
  *   const { data, error } = await supabase
  *     .from('games')
  *     .select(`
  *       game_id:id,
  *       away_team:teams!games_away_team_fkey (
  *         users (
  *           id,
  *           name
  *         )
  *       )
  *     `)
  *   
  * ```
  *
  * @exampleSql Query nested foreign tables through a join table
  * ```sql
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text
  *   );
  * create table
  *   teams (
  *     id int8 primary key,
  *     name text
  *   );
  * -- join table
  * create table
  *   users_teams (
  *     user_id int8 not null references users,
  *     team_id int8 not null references teams,
  *
  *     primary key (user_id, team_id)
  *   );
  * create table
  *   games (
  *     id int8 primary key,
  *     home_team int8 not null references teams,
  *     away_team int8 not null references teams,
  *     name text
  *   );
  *
  * insert into users (id, name)
  * values
  *   (1, 'Kiran'),
  *   (2, 'Evan');
  * insert into
  *   teams (id, name)
  * values
  *   (1, 'Green'),
  *   (2, 'Blue');
  * insert into
  *   users_teams (user_id, team_id)
  * values
  *   (1, 1),
  *   (1, 2),
  *   (2, 2);
  * insert into
  *   games (id, home_team, away_team, name)
  * values
  *   (1, 1, 2, 'Green vs Blue'),
  *   (2, 2, 1, 'Blue vs Green');
  * ```
  *
  * @exampleResponse Query nested foreign tables through a join table
  * ```json
  *   {
  *     "data": [
  *       {
  *         "game_id": 1,
  *         "away_team": {
  *           "users": [
  *             {
  *               "id": 1,
  *               "name": "Kiran"
  *             },
  *             {
  *               "id": 2,
  *               "name": "Evan"
  *             }
  *           ]
  *         }
  *       },
  *       {
  *         "game_id": 2,
  *         "away_team": {
  *           "users": [
  *             {
  *               "id": 1,
  *               "name": "Kiran"
  *             }
  *           ]
  *         }
  *       }
  *     ],
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *   
  * ```
  *
  * @exampleDescription Filtering through referenced tables
  * If the filter on a referenced table's column is not satisfied, the referenced
  * table returns `[]` or `null` but the parent table is not filtered out.
  * If you want to filter out the parent table rows, use the `!inner` hint
  *
  * @example Filtering through referenced tables
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .select('name, orchestral_sections(*)')
  *   .eq('orchestral_sections.name', 'percussion')
  * ```
  *
  * @exampleSql Filtering through referenced tables
  * ```sql
  * create table
  *   orchestral_sections (id int8 primary key, name text);
  * create table
  *   instruments (
  *     id int8 primary key,
  *     section_id int8 not null references orchestral_sections,
  *     name text
  *   );
  *
  * insert into
  *   orchestral_sections (id, name)
  * values
  *   (1, 'strings'),
  *   (2, 'woodwinds');
  * insert into
  *   instruments (id, section_id, name)
  * values
  *   (1, 2, 'flute'),
  *   (2, 1, 'violin');
  * ```
  *
  * @exampleResponse Filtering through referenced tables
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "flute",
  *       "orchestral_sections": null
  *     },
  *     {
  *       "name": "violin",
  *       "orchestral_sections": null
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Querying referenced table with count
  * You can get the number of rows in a related table by using the
  * **count** property.
  *
  * @example Querying referenced table with count
  * ```ts
  * const { data, error } = await supabase
  *   .from('orchestral_sections')
  *   .select(`*, instruments(count)`)
  * ```
  *
  * @exampleSql Querying referenced table with count
  * ```sql
  * create table orchestral_sections (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text
  * );
  *
  * create table characters (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text,
  *   "section_id" "uuid" references public.orchestral_sections on delete cascade
  * );
  *
  * with section as (
  *   insert into orchestral_sections (name)
  *   values ('strings') returning id
  * )
  * insert into instruments (name, section_id) values
  * ('violin', (select id from section)),
  * ('viola', (select id from section)),
  * ('cello', (select id from section)),
  * ('double bass', (select id from section));
  * ```
  *
  * @exampleResponse Querying referenced table with count
  * ```json
  * [
  *   {
  *     "id": "693694e7-d993-4360-a6d7-6294e325d9b6",
  *     "name": "strings",
  *     "instruments": [
  *       {
  *         "count": 4
  *       }
  *     ]
  *   }
  * ]
  * ```
  *
  * @exampleDescription Querying with count option
  * You can get the number of rows by using the
  * [count](/docs/reference/javascript/select#parameters) option.
  *
  * @example Querying with count option
  * ```ts
  * const { count, error } = await supabase
  *   .from('characters')
  *   .select('*', { count: 'exact', head: true })
  * ```
  *
  * @exampleSql Querying with count option
  * ```sql
  * create table
  *   characters (id int8 primary key, name text);
  *
  * insert into
  *   characters (id, name)
  * values
  *   (1, 'Luke'),
  *   (2, 'Leia'),
  *   (3, 'Han');
  * ```
  *
  * @exampleResponse Querying with count option
  * ```json
  * {
  *   "count": 3,
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Querying JSON data
  * You can select and filter data inside of
  * [JSON](/docs/guides/database/json) columns. Postgres offers some
  * [operators](/docs/guides/database/json#query-the-jsonb-data) for
  * querying JSON data.
  *
  * @example Querying JSON data
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .select(`
  *     id, name,
  *     address->city
  *   `)
  * ```
  *
  * @exampleSql Querying JSON data
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text,
  *     address jsonb
  *   );
  *
  * insert into
  *   users (id, name, address)
  * values
  *   (1, 'Frodo', '{"city":"Hobbiton"}');
  * ```
  *
  * @exampleResponse Querying JSON data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Frodo",
  *       "city": "Hobbiton"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Querying referenced table with inner join
  * If you don't want to return the referenced table contents, you can leave the parenthesis empty.
  * Like `.select('name, orchestral_sections!inner()')`.
  *
  * @example Querying referenced table with inner join
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .select('name, orchestral_sections!inner(name)')
  *   .eq('orchestral_sections.name', 'woodwinds')
  *   .limit(1)
  * ```
  *
  * @exampleSql Querying referenced table with inner join
  * ```sql
  * create table orchestral_sections (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text
  * );
  *
  * create table instruments (
  *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
  *   "name" text,
  *   "section_id" "uuid" references public.orchestral_sections on delete cascade
  * );
  *
  * with section as (
  *   insert into orchestral_sections (name)
  *   values ('woodwinds') returning id
  * )
  * insert into instruments (name, section_id) values
  * ('flute', (select id from section)),
  * ('clarinet', (select id from section)),
  * ('bassoon', (select id from section)),
  * ('piccolo', (select id from section));
  * ```
  *
  * @exampleResponse Querying referenced table with inner join
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "flute",
  *       "orchestral_sections": {"name": "woodwinds"}
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Switching schemas per query
  * In addition to setting the schema during initialization, you can also switch schemas on a per-query basis.
  * Make sure you've set up your [database privileges and API settings](/docs/guides/api/using-custom-schemas).
  *
  * @example Switching schemas per query
  * ```ts
  * const { data, error } = await supabase
  *   .schema('myschema')
  *   .from('mytable')
  *   .select()
  * ```
  *
  * @exampleSql Switching schemas per query
  * ```sql
  * create schema myschema;
  *
  * create table myschema.mytable (
  *   id uuid primary key default gen_random_uuid(),
  *   data text
  * );
  *
  * insert into myschema.mytable (data) values ('mydata');
  * ```
  *
  * @exampleResponse Switching schemas per query
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": "4162e008-27b0-4c0f-82dc-ccaeee9a624d",
  *       "data": "mydata"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  select(t, e) {
    const { head: r = !1, count: n } = e ?? {}, s = r ? "HEAD" : "GET";
    let i = !1;
    const o = (t ?? "*").split("").map((u) => /\s/.test(u) && !i ? "" : (u === '"' && (i = !i), u)).join(""), { url: a, headers: l } = this.cloneRequestState();
    return a.searchParams.set("select", o), n && l.append("Prefer", `count=${n}`), new gr({
      method: s,
      url: a,
      headers: l,
      schema: this.schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform an INSERT into the table or view.
  *
  * By default, inserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to insert. Pass an object to insert a single row
  * or an array to insert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count inserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. Only applies for bulk
  * inserts.
  *
  * @category Database
  *
  * @example Create a record
  * ```ts
  * const { error } = await supabase
  *   .from('countries')
  *   .insert({ id: 1, name: 'Mordor' })
  * ```
  *
  * @exampleSql Create a record
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  * ```
  *
  * @exampleResponse Create a record
  * ```json
  * {
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @exampleDescription Handling errors
  * `error.hint` from Postgres often contains the actionable fix (e.g. `"Grant the required privileges to the current role with: GRANT INSERT ON public.countries TO anon;"` for a `42501` permission-denied error). Log the full `error` object so it isn't hidden behind `error.message`.
  *
  * @example Handling errors
  * ```js
  * const { error } = await supabase.from('countries').insert({ id: 1, name: 'Mordor' })
  * if (error) console.error(error)
  * ```
  *
  * @example Create a record and return it
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .insert({ id: 1, name: 'Mordor' })
  *   .select()
  * ```
  *
  * @exampleSql Create a record and return it
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  * ```
  *
  * @exampleResponse Create a record and return it
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Mordor"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @exampleDescription Bulk create
  * A bulk create operation is handled in a single transaction.
  * If any of the inserts fail, none of the rows are inserted.
  *
  * @example Bulk create
  * ```ts
  * const { error } = await supabase
  *   .from('countries')
  *   .insert([
  *     { id: 1, name: 'Mordor' },
  *     { id: 1, name: 'The Shire' },
  *   ])
  * ```
  *
  * @exampleSql Bulk create
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  * ```
  *
  * @exampleResponse Bulk create
  * ```json
  * {
  *   "error": {
  *     "code": "23505",
  *     "details": "Key (id)=(1) already exists.",
  *     "hint": null,
  *     "message": "duplicate key value violates unique constraint \"countries_pkey\""
  *   },
  *   "status": 409,
  *   "statusText": "Conflict"
  * }
  * ```
  */
  insert(t, { count: e, defaultToNull: r = !0 } = {}) {
    var n;
    const s = "POST", { url: i, headers: o } = this.cloneRequestState();
    if (e && o.append("Prefer", `count=${e}`), r || o.append("Prefer", "missing=default"), Array.isArray(t)) {
      const a = t.reduce((l, u) => l.concat(Object.keys(u)), []);
      if (a.length > 0) {
        const l = [...new Set(a)].map((u) => `"${u}"`);
        i.searchParams.set("columns", l.join(","));
      }
    }
    return new gr({
      method: s,
      url: i,
      headers: o,
      schema: this.schema,
      body: t,
      fetch: (n = this.fetch) !== null && n !== void 0 ? n : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform an UPSERT on the table or view. Depending on the column(s) passed
  * to `onConflict`, `.upsert()` allows you to perform the equivalent of
  * `.insert()` if a row with the corresponding `onConflict` columns doesn't
  * exist, or if it does exist, perform an alternative action depending on
  * `ignoreDuplicates`.
  *
  * By default, upserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to upsert with. Pass an object to upsert a
  * single row or an array to upsert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
  * duplicate rows are determined. Two rows are duplicates if all the
  * `onConflict` columns are equal.
  *
  * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
  * `false`, duplicate rows are merged with existing rows.
  *
  * @param options.count - Count algorithm to use to count upserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. This only applies when
  * inserting new rows, not when merging with existing rows under
  * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
  *
  * @example Upsert a single row using a unique key
  * ```ts
  * // Upserting a single row, overwriting based on the 'username' unique column
  * const { data, error } = await supabase
  *   .from('users')
  *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
  *
  * // Example response:
  * // {
  * //   data: [
  * //     { id: 4, message: 'bar', username: 'supabot' }
  * //   ],
  * //   error: null
  * // }
  * ```
  *
  * @example Upsert with conflict resolution and exact row counting
  * ```ts
  * // Upserting and returning exact count
  * const { data, error, count } = await supabase
  *   .from('users')
  *   .upsert(
  *     {
  *       id: 3,
  *       message: 'foo',
  *       username: 'supabot'
  *     },
  *     {
  *       onConflict: 'username',
  *       count: 'exact'
  *     }
  *   )
  *
  * // Example response:
  * // {
  * //   data: [
  * //     {
  * //       id: 42,
  * //       handle: "saoirse",
  * //       display_name: "Saoirse"
  * //     }
  * //   ],
  * //   count: 1,
  * //   error: null
  * // }
  * ```
  *
  * @category Database
  *
  * @remarks
  * - Primary keys must be included in `values` to use upsert.
  *
  * @example Upsert your data
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .upsert({ id: 1, name: 'piano' })
  *   .select()
  * ```
  *
  * @exampleSql Upsert your data
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Upsert your data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "piano"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @exampleDescription Handling errors
  * `error.hint` from Postgres often contains the actionable fix (e.g. `"Grant the required privileges to the current role with: GRANT INSERT, UPDATE ON public.instruments TO anon;"` for a `42501` permission-denied error). Log the full `error` object so it isn't hidden behind `error.message`.
  *
  * @example Handling errors
  * ```js
  * const { data, error } = await supabase.from('instruments').upsert({ id: 1, name: 'piano' }).select()
  * if (error) console.error(error)
  * ```
  *
  * @example Bulk Upsert your data
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .upsert([
  *     { id: 1, name: 'piano' },
  *     { id: 2, name: 'harp' },
  *   ])
  *   .select()
  * ```
  *
  * @exampleSql Bulk Upsert your data
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Bulk Upsert your data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "piano"
  *     },
  *     {
  *       "id": 2,
  *       "name": "harp"
  *     }
  *   ],
  *   "status": 201,
  *   "statusText": "Created"
  * }
  * ```
  *
  * @exampleDescription Upserting into tables with constraints
  * In the following query, `upsert()` implicitly uses the `id`
  * (primary key) column to determine conflicts. If there is no existing
  * row with the same `id`, `upsert()` inserts a new row, which
  * will fail in this case as there is already a row with `handle` `"saoirse"`.
  * Using the `onConflict` option, you can instruct `upsert()` to use
  * another column with a unique constraint to determine conflicts.
  *
  * @example Upserting into tables with constraints
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .upsert({ id: 42, handle: 'saoirse', display_name: 'Saoirse' })
  *   .select()
  * ```
  *
  * @exampleSql Upserting into tables with constraints
  * ```sql
  * create table
  *   users (
  *     id int8 generated by default as identity primary key,
  *     handle text not null unique,
  *     display_name text
  *   );
  *
  * insert into
  *   users (id, handle, display_name)
  * values
  *   (1, 'saoirse', null);
  * ```
  *
  * @exampleResponse Upserting into tables with constraints
  * ```json
  * {
  *   "error": {
  *     "code": "23505",
  *     "details": "Key (handle)=(saoirse) already exists.",
  *     "hint": null,
  *     "message": "duplicate key value violates unique constraint \"users_handle_key\""
  *   },
  *   "status": 409,
  *   "statusText": "Conflict"
  * }
  * ```
  */
  upsert(t, { onConflict: e, ignoreDuplicates: r = !1, count: n, defaultToNull: s = !0 } = {}) {
    var i;
    const o = "POST", { url: a, headers: l } = this.cloneRequestState();
    if (l.append("Prefer", `resolution=${r ? "ignore" : "merge"}-duplicates`), e !== void 0 && a.searchParams.set("on_conflict", e), n && l.append("Prefer", `count=${n}`), s || l.append("Prefer", "missing=default"), Array.isArray(t)) {
      const u = t.reduce((c, h) => c.concat(Object.keys(h)), []);
      if (u.length > 0) {
        const c = [...new Set(u)].map((h) => `"${h}"`);
        a.searchParams.set("columns", c.join(","));
      }
    }
    return new gr({
      method: o,
      url: a,
      headers: l,
      schema: this.schema,
      body: t,
      fetch: (i = this.fetch) !== null && i !== void 0 ? i : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform an UPDATE on the table or view.
  *
  * By default, updated rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param values - The values to update with
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count updated rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @category Database
  *
  * @remarks
  * - `update()` should always be combined with [Filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to update.
  *
  * @example Updating your data
  * ```ts
  * const { error } = await supabase
  *   .from('instruments')
  *   .update({ name: 'piano' })
  *   .eq('id', 1)
  * ```
  *
  * @exampleSql Updating your data
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Updating your data
  * ```json
  * {
  *   "status": 204,
  *   "statusText": "No Content"
  * }
  * ```
  *
  * @exampleDescription Handling errors
  * `error.hint` from Postgres often contains the actionable fix (e.g. `"Grant the required privileges to the current role with: GRANT UPDATE ON public.instruments TO anon;"` for a `42501` permission-denied error). Log the full `error` object so it isn't hidden behind `error.message`.
  *
  * @example Handling errors
  * ```js
  * const { error } = await supabase.from('instruments').update({ name: 'piano' }).eq('id', 1)
  * if (error) console.error(error)
  * ```
  *
  * @example Update a record and return it
  * ```ts
  * const { data, error } = await supabase
  *   .from('instruments')
  *   .update({ name: 'piano' })
  *   .eq('id', 1)
  *   .select()
  * ```
  *
  * @exampleSql Update a record and return it
  * ```sql
  * create table
  *   instruments (id int8 primary key, name text);
  *
  * insert into
  *   instruments (id, name)
  * values
  *   (1, 'harpsichord');
  * ```
  *
  * @exampleResponse Update a record and return it
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "piano"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Updating JSON data
  * Postgres offers some
  * [operators](/docs/guides/database/json#query-the-jsonb-data) for
  * working with JSON data. Currently, it is only possible to update the entire JSON document.
  *
  * @example Updating JSON data
  * ```ts
  * const { data, error } = await supabase
  *   .from('users')
  *   .update({
  *     address: {
  *       street: 'Melrose Place',
  *       postcode: 90210
  *     }
  *   })
  *   .eq('address->postcode', 90210)
  *   .select()
  * ```
  *
  * @exampleSql Updating JSON data
  * ```sql
  * create table
  *   users (
  *     id int8 primary key,
  *     name text,
  *     address jsonb
  *   );
  *
  * insert into
  *   users (id, name, address)
  * values
  *   (1, 'Michael', '{ "postcode": 90210 }');
  * ```
  *
  * @exampleResponse Updating JSON data
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Michael",
  *       "address": {
  *         "street": "Melrose Place",
  *         "postcode": 90210
  *       }
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  update(t, { count: e } = {}) {
    var r;
    const n = "PATCH", { url: s, headers: i } = this.cloneRequestState();
    return e && i.append("Prefer", `count=${e}`), new gr({
      method: n,
      url: s,
      headers: i,
      schema: this.schema,
      body: t,
      fetch: (r = this.fetch) !== null && r !== void 0 ? r : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform a DELETE on the table or view.
  *
  * By default, deleted rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count deleted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @category Database
  *
  * @remarks
  * - `delete()` should always be combined with [filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to delete.
  * - If you use `delete()` with filters and you have
  *   [RLS](/docs/learn/auth-deep-dive/auth-row-level-security) enabled, only
  *   rows visible through `SELECT` policies are deleted. Note that by default
  *   no rows are visible, so you need at least one `SELECT`/`ALL` policy that
  *   makes the rows visible.
  * - When using `delete().in()`, specify an array of values to target multiple rows with a single query. This is particularly useful for batch deleting entries that share common criteria, such as deleting users by their IDs. Ensure that the array you provide accurately represents all records you intend to delete to avoid unintended data removal.
  *
  * @example Delete a single record
  * ```ts
  * const response = await supabase
  *   .from('countries')
  *   .delete()
  *   .eq('id', 1)
  * ```
  *
  * @exampleSql Delete a single record
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Mordor');
  * ```
  *
  * @exampleResponse Delete a single record
  * ```json
  * {
  *   "status": 204,
  *   "statusText": "No Content"
  * }
  * ```
  *
  * @exampleDescription Handling errors
  * `error.hint` from Postgres often contains the actionable fix (e.g. `"Grant the required privileges to the current role with: GRANT DELETE ON public.countries TO anon;"` for a `42501` permission-denied error). Log the full `error` object so it isn't hidden behind `error.message`.
  *
  * @example Handling errors
  * ```js
  * const { error } = await supabase.from('countries').delete().eq('id', 1)
  * if (error) console.error(error)
  * ```
  *
  * @example Delete a record and return it
  * ```ts
  * const { data, error } = await supabase
  *   .from('countries')
  *   .delete()
  *   .eq('id', 1)
  *   .select()
  * ```
  *
  * @exampleSql Delete a record and return it
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Mordor');
  * ```
  *
  * @exampleResponse Delete a record and return it
  * ```json
  * {
  *   "data": [
  *     {
  *       "id": 1,
  *       "name": "Mordor"
  *     }
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Delete multiple records
  * ```ts
  * const response = await supabase
  *   .from('countries')
  *   .delete()
  *   .in('id', [1, 2, 3])
  * ```
  *
  * @exampleSql Delete multiple records
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Rohan'), (2, 'The Shire'), (3, 'Mordor');
  * ```
  *
  * @exampleResponse Delete multiple records
  * ```json
  * {
  *   "status": 204,
  *   "statusText": "No Content"
  * }
  * ```
  */
  delete({ count: t } = {}) {
    var e;
    const r = "DELETE", { url: n, headers: s } = this.cloneRequestState();
    return t && s.append("Prefer", `count=${t}`), new gr({
      method: r,
      url: n,
      headers: s,
      schema: this.schema,
      fetch: (e = this.fetch) !== null && e !== void 0 ? e : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
};
function Hn(t) {
  "@babel/helpers - typeof";
  return Hn = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
    return typeof e;
  } : function(e) {
    return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
  }, Hn(t);
}
function Wg(t, e) {
  if (Hn(t) != "object" || !t) return t;
  var r = t[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(t, e);
    if (Hn(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function Vg(t) {
  var e = Wg(t, "string");
  return Hn(e) == "symbol" ? e : e + "";
}
function Kg(t, e, r) {
  return (e = Vg(e)) in t ? Object.defineProperty(t, e, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : t[e] = r, t;
}
function Wu(t, e) {
  var r = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(t);
    e && (n = n.filter(function(s) {
      return Object.getOwnPropertyDescriptor(t, s).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function bs(t) {
  for (var e = 1; e < arguments.length; e++) {
    var r = arguments[e] != null ? arguments[e] : {};
    e % 2 ? Wu(Object(r), !0).forEach(function(n) {
      Kg(t, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : Wu(Object(r)).forEach(function(n) {
      Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return t;
}
var qg = class Dd {
  /**
  * Creates a PostgREST client.
  *
  * @param url - URL of the PostgREST endpoint
  * @param options - Named parameters
  * @param options.headers - Custom headers
  * @param options.schema - Postgres schema to switch to
  * @param options.fetch - Custom fetch
  * @param options.timeout - Optional timeout in milliseconds for all requests. When set, requests will automatically abort after this duration to prevent indefinite hangs.
  * @param options.urlLengthLimit - Maximum URL length in characters before warnings/errors are triggered. Defaults to 8000.
  * @param options.retry - Enable or disable automatic retries for transient errors.
  *   When enabled, idempotent requests (GET, HEAD, OPTIONS) that fail with network
  *   errors or HTTP 503/520 responses will be automatically retried up to 3 times
  *   with exponential backoff (1s, 2s, 4s). Defaults to `true`.
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * const { data, error } = await supabase.from('profiles').select('*')
  * ```
  *
  * @category Database
  *
  * @remarks
  * - A `timeout` option (in milliseconds) can be set to automatically abort requests that take too long.
  * - A `urlLengthLimit` option (default: 8000) can be set to control when URL length warnings are included in error messages for aborted requests.
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { PostgrestClient } from '@supabase/postgrest-js'
  *
  * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
  *   headers: { apikey: 'your-publishable-key' },
  *   schema: 'public',
  *   timeout: 30000, // 30 second timeout
  * })
  * ```
  */
  constructor(e, { headers: r = {}, schema: n, fetch: s, timeout: i, urlLengthLimit: o = 8e3, retry: a } = {}) {
    this.url = e, this.headers = new Headers(r), this.schemaName = n, this.urlLengthLimit = o;
    const l = s ?? globalThis.fetch;
    i !== void 0 && i > 0 ? this.fetch = (u, c) => {
      const h = new AbortController(), d = setTimeout(() => h.abort(), i), g = c == null ? void 0 : c.signal;
      if (g) {
        if (g.aborted)
          return clearTimeout(d), l(u, c);
        const v = () => {
          clearTimeout(d), h.abort();
        };
        return g.addEventListener("abort", v, { once: !0 }), l(u, bs(bs({}, c), {}, { signal: h.signal })).finally(() => {
          clearTimeout(d), g.removeEventListener("abort", v);
        });
      }
      return l(u, bs(bs({}, c), {}, { signal: h.signal })).finally(() => clearTimeout(d));
    } : this.fetch = l, this.retry = a;
  }
  from(e) {
    if (!e || typeof e != "string" || e.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
    return new Hg(new URL(`${this.url}/${e}`), {
      headers: new Headers(this.headers),
      schema: this.schemaName,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  *
  * @category Database
  */
  schema(e) {
    return new Dd(this.url, {
      headers: this.headers,
      schema: e,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @example
  * ```ts
  * // For cross-schema functions where type inference fails, use overrideTypes:
  * const { data } = await supabase
  *   .schema('schema_b')
  *   .rpc('function_a', {})
  *   .overrideTypes<{ id: string; user_id: string }[]>()
  * ```
  *
  * @category Database
  *
  * @example Call a Postgres function without arguments
  * ```ts
  * const { data, error } = await supabase.rpc('hello_world')
  * ```
  *
  * @exampleSql Call a Postgres function without arguments
  * ```sql
  * create function hello_world() returns text as $$
  *   select 'Hello world';
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a Postgres function without arguments
  * ```json
  * {
  *   "data": "Hello world",
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Call a Postgres function with arguments
  * ```ts
  * const { data, error } = await supabase.rpc('echo', { say: '👋' })
  * ```
  *
  * @exampleSql Call a Postgres function with arguments
  * ```sql
  * create function echo(say text) returns text as $$
  *   select say;
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a Postgres function with arguments
  * ```json
  *   {
  *     "data": "👋",
  *     "status": 200,
  *     "statusText": "OK"
  *   }
  *
  * ```
  *
  * @exampleDescription Bulk processing
  * You can process large payloads by passing in an array as an argument.
  *
  * @example Bulk processing
  * ```ts
  * const { data, error } = await supabase.rpc('add_one_each', { arr: [1, 2, 3] })
  * ```
  *
  * @exampleSql Bulk processing
  * ```sql
  * create function add_one_each(arr int[]) returns int[] as $$
  *   select array_agg(n + 1) from unnest(arr) as n;
  * $$ language sql;
  * ```
  *
  * @exampleResponse Bulk processing
  * ```json
  * {
  *   "data": [
  *     2,
  *     3,
  *     4
  *   ],
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @exampleDescription Call a Postgres function with filters
  * Postgres functions that return tables can also be combined with [Filters](/docs/reference/javascript/using-filters) and [Modifiers](/docs/reference/javascript/using-modifiers).
  *
  * @example Call a Postgres function with filters
  * ```ts
  * const { data, error } = await supabase
  *   .rpc('list_stored_countries')
  *   .eq('id', 1)
  *   .single()
  * ```
  *
  * @exampleSql Call a Postgres function with filters
  * ```sql
  * create table
  *   countries (id int8 primary key, name text);
  *
  * insert into
  *   countries (id, name)
  * values
  *   (1, 'Rohan'),
  *   (2, 'The Shire');
  *
  * create function list_stored_countries() returns setof countries as $$
  *   select * from countries;
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a Postgres function with filters
  * ```json
  * {
  *   "data": {
  *     "id": 1,
  *     "name": "Rohan"
  *   },
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  *
  * @example Call a read-only Postgres function
  * ```ts
  * const { data, error } = await supabase.rpc('hello_world', undefined, { get: true })
  * ```
  *
  * @exampleSql Call a read-only Postgres function
  * ```sql
  * create function hello_world() returns text as $$
  *   select 'Hello world';
  * $$ language sql;
  * ```
  *
  * @exampleResponse Call a read-only Postgres function
  * ```json
  * {
  *   "data": "Hello world",
  *   "status": 200,
  *   "statusText": "OK"
  * }
  * ```
  */
  rpc(e, r = {}, { head: n = !1, get: s = !1, count: i } = {}) {
    var o;
    let a;
    const l = new URL(`${this.url}/rpc/${e}`);
    let u;
    const c = (g) => g !== null && typeof g == "object" && (!Array.isArray(g) || g.some(c)), h = n && Object.values(r).some(c);
    h ? (a = "POST", u = r) : n || s ? (a = n ? "HEAD" : "GET", Object.entries(r).filter(([g, v]) => v !== void 0).map(([g, v]) => [g, Array.isArray(v) ? `{${v.join(",")}}` : `${v}`]).forEach(([g, v]) => {
      l.searchParams.append(g, v);
    })) : (a = "POST", u = r);
    const d = new Headers(this.headers);
    return h ? d.set("Prefer", i ? `count=${i},return=minimal` : "return=minimal") : i && d.set("Prefer", `count=${i}`), new gr({
      method: a,
      url: l,
      headers: d,
      schema: this.schemaName,
      body: u,
      fetch: (o = this.fetch) !== null && o !== void 0 ? o : fetch,
      urlLengthLimit: this.urlLengthLimit,
      retry: this.retry
    });
  }
};
class Gg {
  /**
   * Static-only utility – prevent instantiation.
   */
  constructor() {
  }
  static detectEnvironment() {
    var e;
    if (typeof WebSocket < "u")
      return { type: "native", wsConstructor: WebSocket };
    const r = globalThis;
    if (typeof globalThis < "u" && typeof r.WebSocket < "u")
      return { type: "native", wsConstructor: r.WebSocket };
    const n = typeof global < "u" ? global : void 0;
    if (n && typeof n.WebSocket < "u")
      return { type: "native", wsConstructor: n.WebSocket };
    if (typeof globalThis < "u" && typeof r.WebSocketPair < "u" && typeof globalThis.WebSocket > "u")
      return {
        type: "cloudflare",
        error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
        workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
      };
    if (typeof globalThis < "u" && r.EdgeRuntime || typeof navigator < "u" && (!((e = navigator.userAgent) === null || e === void 0) && e.includes("Vercel-Edge")))
      return {
        type: "unsupported",
        error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
        workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
      };
    const s = globalThis.process;
    if (s) {
      const i = s.versions;
      if (i && i.node)
        return {
          type: "unsupported",
          error: "Node.js detected but native WebSocket not found.",
          workaround: "Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option."
        };
    }
    return {
      type: "unsupported",
      error: "Unknown JavaScript runtime without WebSocket support.",
      workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
    };
  }
  /**
   * Returns the best available WebSocket constructor for the current runtime.
   *
   * @category Realtime
   *
   * @example Example with error handling
   * ```ts
   * try {
   *   const WS = WebSocketFactory.getWebSocketConstructor()
   *   const socket = new WS('wss://example.com/socket')
   * } catch (error) {
   *   console.error('WebSocket not available in this environment.', error)
   * }
   * ```
   */
  static getWebSocketConstructor() {
    const e = this.detectEnvironment();
    if (e.wsConstructor)
      return e.wsConstructor;
    let r = e.error || "WebSocket not supported in this environment.";
    throw e.workaround && (r += `

Suggested solution: ${e.workaround}`), new Error(r);
  }
  /**
   * Detects whether the runtime can establish WebSocket connections.
   *
   * @category Realtime
   *
   * @example Example in a Node.js script
   * ```ts
   * if (!WebSocketFactory.isWebSocketSupported()) {
   *   console.error('WebSockets are required for this script.')
   *   process.exitCode = 1
   * }
   * ```
   */
  static isWebSocketSupported() {
    try {
      return this.detectEnvironment().type === "native";
    } catch {
      return !1;
    }
  }
}
const Jg = "2.111.0", Qg = `realtime-js/${Jg}`, Yg = "1.0.0", Md = "2.0.0", Xg = Md, Zg = 1e4, em = 100, Ct = {
  closed: "closed",
  errored: "errored",
  joined: "joined",
  joining: "joining",
  leaving: "leaving"
}, zd = {
  close: "phx_close",
  error: "phx_error",
  join: "phx_join",
  leave: "phx_leave",
  access_token: "access_token"
}, Sa = {
  connecting: "connecting",
  closing: "closing",
  closed: "closed"
};
class tm {
  constructor(e) {
    this.HEADER_LENGTH = 1, this.USER_BROADCAST_PUSH_META_LENGTH = 6, this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 }, this.BINARY_ENCODING = 0, this.JSON_ENCODING = 1, this.BROADCAST_EVENT = "broadcast", this.allowedMetadataKeys = [], this.allowedMetadataKeys = e ?? [];
  }
  encode(e, r) {
    if (e.event === this.BROADCAST_EVENT && !(e.payload instanceof ArrayBuffer) && typeof e.payload.event == "string")
      return r(this._binaryEncodeUserBroadcastPush(e));
    let n = [e.join_ref, e.ref, e.topic, e.event, e.payload];
    return r(JSON.stringify(n));
  }
  _binaryEncodeUserBroadcastPush(e) {
    var r;
    return this._isArrayBuffer((r = e.payload) === null || r === void 0 ? void 0 : r.payload) ? this._encodeBinaryUserBroadcastPush(e) : this._encodeJsonUserBroadcastPush(e);
  }
  _encodeBinaryUserBroadcastPush(e) {
    var r, n;
    const s = (n = (r = e.payload) === null || r === void 0 ? void 0 : r.payload) !== null && n !== void 0 ? n : new ArrayBuffer(0);
    return this._encodeUserBroadcastPush(e, this.BINARY_ENCODING, s);
  }
  _encodeJsonUserBroadcastPush(e) {
    var r, n;
    const s = (n = (r = e.payload) === null || r === void 0 ? void 0 : r.payload) !== null && n !== void 0 ? n : {}, o = new TextEncoder().encode(JSON.stringify(s)).buffer;
    return this._encodeUserBroadcastPush(e, this.JSON_ENCODING, o);
  }
  _encodeUserBroadcastPush(e, r, n) {
    var s, i;
    const o = new TextEncoder(), a = o.encode(e.topic), l = o.encode((s = e.ref) !== null && s !== void 0 ? s : ""), u = o.encode((i = e.join_ref) !== null && i !== void 0 ? i : ""), c = o.encode(e.payload.event), h = this.allowedMetadataKeys ? this._pick(e.payload, this.allowedMetadataKeys) : {}, d = o.encode(Object.keys(h).length === 0 ? "" : JSON.stringify(h));
    if (u.length > 255)
      throw new Error(`joinRef length ${u.length} exceeds maximum of 255`);
    if (l.length > 255)
      throw new Error(`ref length ${l.length} exceeds maximum of 255`);
    if (a.length > 255)
      throw new Error(`topic length ${a.length} exceeds maximum of 255`);
    if (c.length > 255)
      throw new Error(`userEvent length ${c.length} exceeds maximum of 255`);
    if (d.length > 255)
      throw new Error(`metadata length ${d.length} exceeds maximum of 255`);
    const g = this.USER_BROADCAST_PUSH_META_LENGTH + u.length + l.length + a.length + c.length + d.length, v = new ArrayBuffer(this.HEADER_LENGTH + g), y = new DataView(v), k = new Uint8Array(v);
    let f = 0;
    y.setUint8(f++, this.KINDS.userBroadcastPush), y.setUint8(f++, u.length), y.setUint8(f++, l.length), y.setUint8(f++, a.length), y.setUint8(f++, c.length), y.setUint8(f++, d.length), y.setUint8(f++, r), k.set(u, f), f += u.length, k.set(l, f), f += l.length, k.set(a, f), f += a.length, k.set(c, f), f += c.length, k.set(d, f), f += d.length;
    var p = new Uint8Array(v.byteLength + n.byteLength);
    return p.set(new Uint8Array(v), 0), p.set(new Uint8Array(n), v.byteLength), p.buffer;
  }
  decode(e, r) {
    if (this._isArrayBuffer(e)) {
      let n = this._binaryDecode(e);
      return r(n);
    }
    if (typeof e == "string") {
      const n = JSON.parse(e), [s, i, o, a, l] = n;
      return r({ join_ref: s, ref: i, topic: o, event: a, payload: l });
    }
    return r({});
  }
  _binaryDecode(e) {
    const r = new DataView(e), n = r.getUint8(0), s = new TextDecoder();
    switch (n) {
      case this.KINDS.userBroadcast:
        return this._decodeUserBroadcast(e, r, s);
    }
  }
  _decodeUserBroadcast(e, r, n) {
    const s = r.getUint8(1), i = r.getUint8(2), o = r.getUint8(3), a = r.getUint8(4);
    let l = this.HEADER_LENGTH + 4;
    const u = n.decode(e.slice(l, l + s));
    l = l + s;
    const c = n.decode(e.slice(l, l + i));
    l = l + i;
    const h = n.decode(e.slice(l, l + o));
    l = l + o;
    const d = e.slice(l, e.byteLength), g = a === this.JSON_ENCODING ? JSON.parse(n.decode(d)) : d, v = {
      type: this.BROADCAST_EVENT,
      event: c,
      payload: g
    };
    return o > 0 && (v.meta = JSON.parse(h)), { join_ref: null, ref: null, topic: u, event: this.BROADCAST_EVENT, payload: v };
  }
  _isArrayBuffer(e) {
    var r;
    return e instanceof ArrayBuffer || ((r = e == null ? void 0 : e.constructor) === null || r === void 0 ? void 0 : r.name) === "ArrayBuffer";
  }
  _pick(e, r) {
    return !e || typeof e != "object" ? {} : Object.fromEntries(Object.entries(e).filter(([n]) => r.includes(n)));
  }
}
var M;
(function(t) {
  t.abstime = "abstime", t.bool = "bool", t.date = "date", t.daterange = "daterange", t.float4 = "float4", t.float8 = "float8", t.int2 = "int2", t.int4 = "int4", t.int4range = "int4range", t.int8 = "int8", t.int8range = "int8range", t.json = "json", t.jsonb = "jsonb", t.money = "money", t.numeric = "numeric", t.oid = "oid", t.reltime = "reltime", t.text = "text", t.time = "time", t.timestamp = "timestamp", t.timestamptz = "timestamptz", t.timetz = "timetz", t.tsrange = "tsrange", t.tstzrange = "tstzrange";
})(M || (M = {}));
const Vu = (t, e, r = {}) => {
  var n;
  const s = (n = r.skipTypes) !== null && n !== void 0 ? n : [];
  return e ? Object.keys(e).reduce((i, o) => (i[o] = rm(o, t, e, s), i), {}) : {};
}, rm = (t, e, r, n) => {
  const s = e.find((a) => a.name === t), i = s == null ? void 0 : s.type, o = r[t];
  return i && !n.includes(i) ? Bd(i, o) : Ea(o);
}, Bd = (t, e) => {
  if (t.charAt(0) === "_") {
    const r = t.slice(1, t.length);
    return om(e, r);
  }
  switch (t) {
    case M.bool:
      return nm(e);
    case M.float4:
    case M.float8:
    case M.int2:
    case M.int4:
    case M.int8:
    case M.numeric:
    case M.oid:
      return sm(e);
    case M.json:
    case M.jsonb:
      return im(e);
    case M.timestamp:
      return am(e);
    case M.abstime:
    case M.date:
    case M.daterange:
    case M.int4range:
    case M.int8range:
    case M.money:
    case M.reltime:
    case M.text:
    case M.time:
    case M.timestamptz:
    case M.timetz:
    case M.tsrange:
    case M.tstzrange:
      return Ea(e);
    default:
      return Ea(e);
  }
}, Ea = (t) => t, nm = (t) => {
  switch (t) {
    case "t":
      return !0;
    case "f":
      return !1;
    default:
      return t;
  }
}, sm = (t) => {
  if (typeof t == "string") {
    const e = parseFloat(t);
    if (!Number.isNaN(e))
      return e;
  }
  return t;
}, im = (t) => {
  if (typeof t == "string")
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  return t;
}, om = (t, e) => {
  if (typeof t != "string")
    return t;
  const r = t.length - 1, n = t[r];
  if (t[0] === "{" && n === "}") {
    let i;
    const o = t.slice(1, r);
    try {
      i = JSON.parse("[" + o + "]");
    } catch {
      i = o ? o.split(",") : [];
    }
    return i.map((a) => Bd(e, a));
  }
  return t;
}, am = (t) => typeof t == "string" ? t.replace(" ", "T") : t, Fd = (t) => {
  const e = new URL(t);
  return e.protocol = e.protocol.replace(/^ws/i, "http"), e.pathname = e.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, ""), e.pathname === "" || e.pathname === "/" ? e.pathname = "/api/broadcast" : e.pathname = e.pathname + "/api/broadcast", e.href;
};
var $r = (t) => typeof t == "function" ? (
  /** @type {() => T} */
  t
) : function() {
  return t;
}, lm = typeof self < "u" ? self : null, mr = typeof window < "u" ? window : null, et = lm || mr || globalThis, um = "2.0.0", cm = 1e4, hm = 1e3, dm = 100, tt = (
  /** @type {const} */
  { connecting: 0, open: 1, closing: 2, closed: 3 }
), we = (
  /** @type {const} */
  {
    closed: "closed",
    errored: "errored",
    joined: "joined",
    joining: "joining",
    leaving: "leaving"
  }
), lt = (
  /** @type {const} */
  {
    close: "phx_close",
    error: "phx_error",
    join: "phx_join",
    reply: "phx_reply",
    leave: "phx_leave"
  }
), ba = (
  /** @type {const} */
  {
    longpoll: "longpoll",
    websocket: "websocket"
  }
), fm = (
  /** @type {const} */
  {
    complete: 4
  }
), Ta = "base64url.bearer.phx.", Ts = class {
  /**
   * Initializes the Push
   * @param {Channel} channel - The Channel
   * @param {ChannelEvent} event - The event, for example `"phx_join"`
   * @param {() => Record<string, unknown>} payload - The payload, for example `{user_id: 123}`
   * @param {number} timeout - The push timeout in milliseconds
   */
  constructor(t, e, r, n) {
    this.channel = t, this.event = e, this.payload = r || function() {
      return {};
    }, this.receivedResp = null, this.timeout = n, this.timeoutTimer = null, this.recHooks = [], this.sent = !1, this.ref = void 0;
  }
  /**
   *
   * @param {number} timeout
   */
  resend(t) {
    this.timeout = t, this.reset(), this.send();
  }
  /**
   *
   */
  send() {
    this.hasReceived("timeout") || (this.startTimeout(), this.sent = !0, this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload(),
      ref: this.ref,
      join_ref: this.channel.joinRef()
    }));
  }
  /**
   *
   * @param {string} status
   * @param {(response: any) => void} callback
   */
  receive(t, e) {
    return this.hasReceived(t) && e(this.receivedResp.response), this.recHooks.push({ status: t, callback: e }), this;
  }
  reset() {
    this.cancelRefEvent(), this.ref = null, this.refEvent = null, this.receivedResp = null, this.sent = !1;
  }
  destroy() {
    this.cancelRefEvent(), this.cancelTimeout();
  }
  /**
   * @private
   */
  matchReceive({ status: t, response: e, _ref: r }) {
    this.recHooks.filter((n) => n.status === t).forEach((n) => n.callback(e));
  }
  /**
   * @private
   */
  cancelRefEvent() {
    this.refEvent && this.channel.off(this.refEvent);
  }
  cancelTimeout() {
    clearTimeout(this.timeoutTimer), this.timeoutTimer = null;
  }
  startTimeout() {
    this.timeoutTimer && this.cancelTimeout(), this.ref = this.channel.socket.makeRef(), this.refEvent = this.channel.replyEventName(this.ref), this.channel.on(this.refEvent, (t) => {
      this.cancelRefEvent(), this.cancelTimeout(), this.receivedResp = t, this.matchReceive(t);
    }), this.timeoutTimer = setTimeout(() => {
      this.trigger("timeout", {});
    }, this.timeout);
  }
  /**
   * @private
   */
  hasReceived(t) {
    return this.receivedResp && this.receivedResp.status === t;
  }
  trigger(t, e) {
    this.channel.trigger(this.refEvent, { status: t, response: e });
  }
}, Hd = class {
  /**
  * @param {() => void} callback
  * @param {(tries: number) => number} timerCalc
  */
  constructor(t, e) {
    this.callback = t, this.timerCalc = e, this.timer = void 0, this.tries = 0;
  }
  reset() {
    this.tries = 0, clearTimeout(this.timer);
  }
  /**
   * Cancels any previous scheduleTimeout and schedules callback
   */
  scheduleTimeout() {
    clearTimeout(this.timer), this.timer = setTimeout(() => {
      this.tries = this.tries + 1, this.callback();
    }, this.timerCalc(this.tries + 1));
  }
}, pm = class {
  /**
   * @param {string} topic
   * @param {Params | (() => Params)} params
   * @param {Socket} socket
   */
  constructor(t, e, r) {
    this.state = we.closed, this.topic = t, this.params = $r(e || {}), this.socket = r, this.bindings = [], this.bindingRef = 0, this.timeout = this.socket.timeout, this.joinedOnce = !1, this.joinPush = new Ts(this, lt.join, this.params, this.timeout), this.pushBuffer = [], this.stateChangeRefs = [], this.rejoinTimer = new Hd(() => {
      this.socket.isConnected() && this.rejoin();
    }, this.socket.rejoinAfterMs), this.stateChangeRefs.push(this.socket.onError(() => this.rejoinTimer.reset())), this.stateChangeRefs.push(
      this.socket.onOpen(() => {
        this.rejoinTimer.reset(), this.isErrored() && this.rejoin();
      })
    ), this.joinPush.receive("ok", () => {
      this.state = we.joined, this.rejoinTimer.reset(), this.pushBuffer.forEach((n) => n.send()), this.pushBuffer = [];
    }), this.joinPush.receive("error", (n) => {
      this.state = we.errored, this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, n), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.onClose(() => {
      this.rejoinTimer.reset(), this.socket.hasLogger() && this.socket.log("channel", `close ${this.topic}`), this.state = we.closed, this.socket.remove(this);
    }), this.onError((n) => {
      this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, n), this.isJoining() && this.joinPush.reset(), this.state = we.errored, this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.joinPush.receive("timeout", () => {
      this.socket.hasLogger() && this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout), new Ts(this, lt.leave, $r({}), this.timeout).send(), this.state = we.errored, this.joinPush.reset(), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.on(lt.reply, (n, s) => {
      this.trigger(this.replyEventName(s), n);
    });
  }
  /**
   * Join the channel
   * @param {number} timeout
   * @returns {Push}
   */
  join(t = this.timeout) {
    if (this.joinedOnce)
      throw new Error("tried to join multiple times. 'join' can only be called a single time per channel instance");
    return this.timeout = t, this.joinedOnce = !0, this.rejoin(), this.joinPush;
  }
  /**
   * Teardown the channel.
   *
   * Destroys and stops related timers.
   */
  teardown() {
    this.pushBuffer.forEach((t) => t.destroy()), this.pushBuffer = [], this.rejoinTimer.reset(), this.joinPush.destroy(), this.state = we.closed, this.bindings = [];
  }
  /**
   * Hook into channel close
   * @param {ChannelBindingCallback} callback
   */
  onClose(t) {
    this.on(lt.close, t);
  }
  /**
   * Hook into channel errors
   * @param {ChannelOnErrorCallback} callback
   * @return {number}
   */
  onError(t) {
    return this.on(lt.error, (e) => t(e));
  }
  /**
   * Subscribes on channel events
   *
   * Subscription returns a ref counter, which can be used later to
   * unsubscribe the exact event listener
   *
   * @example
   * const ref1 = channel.on("event", do_stuff)
   * const ref2 = channel.on("event", do_other_stuff)
   * channel.off("event", ref1)
   * // Since unsubscription, do_stuff won't fire,
   * // while do_other_stuff will keep firing on the "event"
   *
   * @param {string} event
   * @param {ChannelBindingCallback} callback
   * @returns {number} ref
   */
  on(t, e) {
    let r = this.bindingRef++;
    return this.bindings.push({ event: t, ref: r, callback: e }), r;
  }
  /**
   * Unsubscribes off of channel events
   *
   * Use the ref returned from a channel.on() to unsubscribe one
   * handler, or pass nothing for the ref to unsubscribe all
   * handlers for the given event.
   *
   * @example
   * // Unsubscribe the do_stuff handler
   * const ref1 = channel.on("event", do_stuff)
   * channel.off("event", ref1)
   *
   * // Unsubscribe all handlers from event
   * channel.off("event")
   *
   * @param {string} event
   * @param {number} [ref]
   */
  off(t, e) {
    this.bindings = this.bindings.filter((r) => !(r.event === t && (typeof e > "u" || e === r.ref)));
  }
  /**
   * @private
   */
  canPush() {
    return this.socket.isConnected() && this.isJoined();
  }
  /**
   * Sends a message `event` to phoenix with the payload `payload`.
   * Phoenix receives this in the `handle_in(event, payload, socket)`
   * function. if phoenix replies or it times out (default 10000ms),
   * then optionally the reply can be received.
   *
   * @example
   * channel.push("event")
   *   .receive("ok", payload => console.log("phoenix replied:", payload))
   *   .receive("error", err => console.log("phoenix errored", err))
   *   .receive("timeout", () => console.log("timed out pushing"))
   * @param {string} event
   * @param {Object} payload
   * @param {number} [timeout]
   * @returns {Push}
   */
  push(t, e, r = this.timeout) {
    if (e = e || {}, !this.joinedOnce)
      throw new Error(`tried to push '${t}' to '${this.topic}' before joining. Use channel.join() before pushing events`);
    let n = new Ts(this, t, function() {
      return e;
    }, r);
    return this.canPush() ? n.send() : (n.startTimeout(), this.pushBuffer.push(n)), n;
  }
  /** Leaves the channel
   *
   * Unsubscribes from server events, and
   * instructs channel to terminate on server
   *
   * Triggers onClose() hooks
   *
   * To receive leave acknowledgements, use the `receive`
   * hook to bind to the server ack, ie:
   *
   * @example
   * channel.leave().receive("ok", () => alert("left!") )
   *
   * @param {number} timeout
   * @returns {Push}
   */
  leave(t = this.timeout) {
    this.rejoinTimer.reset(), this.joinPush.cancelTimeout(), this.state = we.leaving;
    let e = () => {
      this.socket.hasLogger() && this.socket.log("channel", `leave ${this.topic}`), this.trigger(lt.close, "leave");
    }, r = new Ts(this, lt.leave, $r({}), t);
    return r.receive("ok", () => e()).receive("timeout", () => e()), r.send(), this.canPush() || r.trigger("ok", {}), r;
  }
  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling
   * before dispatching to the channel callbacks.
   *
   * Must return the payload, modified or unmodified
   * @type{ChannelOnMessage}
   */
  onMessage(t, e, r) {
    return e;
  }
  /**
   * Overridable filter hook
   *
   * If this function returns `true`, `binding`'s callback will be called.
   *
   * @type{ChannelFilterBindings}
   */
  filterBindings(t, e, r) {
    return !0;
  }
  isMember(t, e, r, n) {
    return this.topic !== t ? !1 : n && n !== this.joinRef() ? (this.socket.hasLogger() && this.socket.log("channel", "dropping outdated message", { topic: t, event: e, payload: r, joinRef: n }), !1) : !0;
  }
  joinRef() {
    return this.joinPush.ref;
  }
  /**
   * @private
   */
  rejoin(t = this.timeout) {
    this.isLeaving() || (this.socket.leaveOpenTopic(this.topic), this.state = we.joining, this.joinPush.resend(t));
  }
  /**
   * @param {string} event
   * @param {unknown} [payload]
   * @param {?string} [ref]
   * @param {?string} [joinRef]
   */
  trigger(t, e, r, n) {
    let s = this.onMessage(t, e, r, n);
    if (e && !s)
      throw new Error("channel onMessage callbacks must return the payload, modified or unmodified");
    let i = this.bindings.filter((o) => o.event === t && this.filterBindings(o, e, r));
    for (let o = 0; o < i.length; o++)
      i[o].callback(s, r, n || this.joinRef());
  }
  /**
  * @param {string} ref
  */
  replyEventName(t) {
    return `chan_reply_${t}`;
  }
  isClosed() {
    return this.state === we.closed;
  }
  isErrored() {
    return this.state === we.errored;
  }
  isJoined() {
    return this.state === we.joined;
  }
  isJoining() {
    return this.state === we.joining;
  }
  isLeaving() {
    return this.state === we.leaving;
  }
}, vi = class {
  static request(t, e, r, n, s, i, o) {
    if (et.XDomainRequest) {
      let a = new et.XDomainRequest();
      return this.xdomainRequest(a, t, e, n, s, i, o);
    } else if (et.XMLHttpRequest) {
      let a = new et.XMLHttpRequest();
      return this.xhrRequest(a, t, e, r, n, s, i, o);
    } else {
      if (et.fetch && et.AbortController)
        return this.fetchRequest(t, e, r, n, s, i, o);
      throw new Error("No suitable XMLHttpRequest implementation found");
    }
  }
  static fetchRequest(t, e, r, n, s, i, o) {
    let a = {
      method: t,
      headers: r,
      body: n
    }, l = null;
    return s && (l = new AbortController(), setTimeout(() => l.abort(), s), a.signal = l.signal), et.fetch(e, a).then((u) => u.text()).then((u) => this.parseJSON(u)).then((u) => o && o(u)).catch((u) => {
      u.name === "AbortError" && i ? i() : o && o(null);
    }), l;
  }
  static xdomainRequest(t, e, r, n, s, i, o) {
    return t.timeout = s, t.open(e, r), t.onload = () => {
      let a = this.parseJSON(t.responseText);
      o && o(a);
    }, i && (t.ontimeout = i), t.onprogress = () => {
    }, t.send(n), t;
  }
  static xhrRequest(t, e, r, n, s, i, o, a) {
    t.open(e, r, !0), t.timeout = i;
    for (let [l, u] of Object.entries(n))
      t.setRequestHeader(l, u);
    return t.onerror = () => a && a(null), t.onreadystatechange = () => {
      if (t.readyState === fm.complete && a) {
        let l = this.parseJSON(t.responseText);
        a(l);
      }
    }, o && (t.ontimeout = o), t.send(s), t;
  }
  static parseJSON(t) {
    if (!t || t === "")
      return null;
    try {
      return JSON.parse(t);
    } catch {
      return console && console.log("failed to parse JSON response", t), null;
    }
  }
  static serialize(t, e) {
    let r = [];
    for (var n in t) {
      if (!Object.prototype.hasOwnProperty.call(t, n))
        continue;
      let s = e ? `${e}[${n}]` : n, i = t[n];
      typeof i == "object" ? r.push(this.serialize(i, s)) : r.push(encodeURIComponent(s) + "=" + encodeURIComponent(i));
    }
    return r.join("&");
  }
  static appendParams(t, e) {
    if (Object.keys(e).length === 0)
      return t;
    let r = t.match(/\?/) ? "&" : "?";
    return `${t}${r}${this.serialize(e)}`;
  }
}, gm = (t) => {
  let e = "", r = new Uint8Array(t), n = r.byteLength;
  for (let s = 0; s < n; s++)
    e += String.fromCharCode(r[s]);
  return btoa(e);
}, hr = class {
  constructor(t, e) {
    e && e.length === 2 && e[1].startsWith(Ta) && (this.authToken = atob(e[1].slice(Ta.length))), this.endPoint = null, this.token = null, this.skipHeartbeat = !0, this.reqs = /* @__PURE__ */ new Set(), this.awaitingBatchAck = !1, this.currentBatch = null, this.currentBatchTimer = null, this.batchBuffer = [], this.onopen = function() {
    }, this.onerror = function() {
    }, this.onmessage = function() {
    }, this.onclose = function() {
    }, this.pollEndpoint = this.normalizeEndpoint(t), this.readyState = tt.connecting, setTimeout(() => this.poll(), 0);
  }
  normalizeEndpoint(t) {
    return t.replace("ws://", "http://").replace("wss://", "https://").replace(new RegExp("(.*)/" + ba.websocket), "$1/" + ba.longpoll);
  }
  endpointURL() {
    return vi.appendParams(this.pollEndpoint, { token: this.token });
  }
  closeAndRetry(t, e, r) {
    this.close(t, e, r), this.readyState = tt.connecting;
  }
  ontimeout() {
    this.onerror("timeout"), this.closeAndRetry(1005, "timeout", !1);
  }
  isActive() {
    return this.readyState === tt.open || this.readyState === tt.connecting;
  }
  poll() {
    const t = { Accept: "application/json" };
    this.authToken && (t["X-Phoenix-AuthToken"] = this.authToken), this.ajax("GET", t, null, () => this.ontimeout(), (e) => {
      if (e) {
        var { status: r, token: n, messages: s } = e;
        if (r === 410 && this.token !== null) {
          this.onerror(410), this.closeAndRetry(3410, "session_gone", !1);
          return;
        }
        this.token = n;
      } else
        r = 0;
      switch (r) {
        case 200:
          s.forEach((i) => {
            setTimeout(() => this.onmessage({ data: i }), 0);
          }), this.poll();
          break;
        case 204:
          this.poll();
          break;
        case 410:
          this.readyState = tt.open, this.onopen({}), this.poll();
          break;
        case 403:
          this.onerror(403), this.close(1008, "forbidden", !1);
          break;
        case 0:
        case 500:
          this.onerror(500), this.closeAndRetry(1011, "internal server error", 500);
          break;
        default:
          throw new Error(`unhandled poll status ${r}`);
      }
    });
  }
  // we collect all pushes within the current event loop by
  // setTimeout 0, which optimizes back-to-back procedural
  // pushes against an empty buffer
  send(t) {
    typeof t != "string" && (t = gm(t)), this.currentBatch ? this.currentBatch.push(t) : this.awaitingBatchAck ? this.batchBuffer.push(t) : (this.currentBatch = [t], this.currentBatchTimer = setTimeout(() => {
      this.batchSend(this.currentBatch), this.currentBatch = null;
    }, 0));
  }
  batchSend(t, e = 0) {
    this.awaitingBatchAck = !0;
    const r = e + dm, n = t.slice(e, r);
    this.ajax("POST", { "Content-Type": "application/x-ndjson" }, n.join(`
`), () => this.onerror("timeout"), (s) => {
      !s || s.status !== 200 ? (this.awaitingBatchAck = !1, this.onerror(s && s.status), this.closeAndRetry(1011, "internal server error", !1)) : r < t.length ? this.batchSend(t, r) : this.batchBuffer.length > 0 ? (this.batchSend(this.batchBuffer), this.batchBuffer = []) : this.awaitingBatchAck = !1;
    });
  }
  close(t, e, r) {
    for (let s of this.reqs)
      s.abort();
    this.readyState = tt.closed;
    let n = Object.assign({ code: 1e3, reason: void 0, wasClean: !0 }, { code: t, reason: e, wasClean: r });
    this.batchBuffer = [], clearTimeout(this.currentBatchTimer), this.currentBatchTimer = null, typeof CloseEvent < "u" ? this.onclose(new CloseEvent("close", n)) : this.onclose(n);
  }
  ajax(t, e, r, n, s) {
    let i, o = () => {
      this.reqs.delete(i), n();
    };
    i = vi.request(t, this.endpointURL(), e, r, this.timeout, o, (a) => {
      this.reqs.delete(i), this.isActive() && s(a);
    }), this.reqs.add(i);
  }
}, mm = class dn {
  /**
   * Initializes the Presence
   * @param {Channel} channel - The Channel
   * @param {PresenceOptions} [opts] - The options, for example `{events: {state: "state", diff: "diff"}}`
   */
  constructor(e, r = {}) {
    let n = r.events || /** @type {PresenceEvents} */
    { state: "presence_state", diff: "presence_diff" };
    this.state = /* @__PURE__ */ Object.create(null), this.pendingDiffs = [], this.channel = e, this.joinRef = null, this.caller = {
      onJoin: function() {
      },
      onLeave: function() {
      },
      onSync: function() {
      }
    }, this.channel.on(n.state, (s) => {
      let { onJoin: i, onLeave: o, onSync: a } = this.caller;
      this.joinRef = this.channel.joinRef(), this.state = dn.syncState(this.state, s, i, o), this.pendingDiffs.forEach((l) => {
        this.state = dn.syncDiff(this.state, l, i, o);
      }), this.pendingDiffs = [], a();
    }), this.channel.on(n.diff, (s) => {
      let { onJoin: i, onLeave: o, onSync: a } = this.caller;
      this.inPendingSyncState() ? this.pendingDiffs.push(s) : (this.state = dn.syncDiff(this.state, s, i, o), a());
    });
  }
  /**
   * @param {PresenceOnJoin} callback
   */
  onJoin(e) {
    this.caller.onJoin = e;
  }
  /**
   * @param {PresenceOnLeave} callback
   */
  onLeave(e) {
    this.caller.onLeave = e;
  }
  /**
   * @param {PresenceOnSync} callback
   */
  onSync(e) {
    this.caller.onSync = e;
  }
  /**
   * Returns the array of presences, with selected metadata.
   *
   * @template [T=PresenceState]
   * @param {((key: string, obj: PresenceState) => T)} [by]
   *
   * @returns {T[]}
   */
  list(e) {
    return dn.list(this.state, e);
  }
  inPendingSyncState() {
    return !this.joinRef || this.joinRef !== this.channel.joinRef();
  }
  // lower-level public static API
  /**
   * Used to sync the list of presences on the server
   * with the client's state. An optional `onJoin` and `onLeave` callback can
   * be provided to react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   *
   * @param {Record<string, PresenceState>} currentState
   * @param {Record<string, PresenceState>} newState
   * @param {PresenceOnJoin} onJoin
   * @param {PresenceOnLeave} onLeave
   *
   * @returns {Record<string, PresenceState>}
   */
  static syncState(e, r, n, s) {
    let i = this.toNullProtoObj(this.clone(e));
    r = this.toNullProtoObj(r);
    let o = /* @__PURE__ */ Object.create(null), a = /* @__PURE__ */ Object.create(null);
    return this.map(i, (l, u) => {
      r[l] || (a[l] = u);
    }), this.map(r, (l, u) => {
      let c = i[l];
      if (c) {
        let h = u.metas.map((y) => y.phx_ref), d = c.metas.map((y) => y.phx_ref), g = u.metas.filter((y) => d.indexOf(y.phx_ref) < 0), v = c.metas.filter((y) => h.indexOf(y.phx_ref) < 0);
        g.length > 0 && (o[l] = u, o[l].metas = g), v.length > 0 && (a[l] = this.clone(c), a[l].metas = v);
      } else
        o[l] = u;
    }), this.syncDiff(i, { joins: o, leaves: a }, n, s);
  }
  /**
   *
   * Used to sync a diff of presence join and leave
   * events from the server, as they happen. Like `syncState`, `syncDiff`
   * accepts optional `onJoin` and `onLeave` callbacks to react to a user
   * joining or leaving from a device.
   *
   * @param {Record<string, PresenceState>} state
   * @param {PresenceDiff} diff
   * @param {PresenceOnJoin} onJoin
   * @param {PresenceOnLeave} onLeave
   *
   * @returns {Record<string, PresenceState>}
   */
  static syncDiff(e, r, n, s) {
    e = this.toNullProtoObj(e);
    let { joins: i, leaves: o } = this.clone(r);
    return n || (n = function() {
    }), s || (s = function() {
    }), this.map(i, (a, l) => {
      let u = e[a];
      if (e[a] = this.clone(l), u) {
        let c = e[a].metas.map((d) => d.phx_ref), h = u.metas.filter((d) => c.indexOf(d.phx_ref) < 0);
        e[a].metas.unshift(...h);
      }
      n(a, u, l);
    }), this.map(o, (a, l) => {
      let u = e[a];
      if (!u)
        return;
      let c = l.metas.map((h) => h.phx_ref);
      u.metas = u.metas.filter((h) => c.indexOf(h.phx_ref) < 0), s(a, u, l), u.metas.length === 0 && delete e[a];
    }), e;
  }
  /**
   * Returns the array of presences, with selected metadata.
   *
   * @template [T=PresenceState]
   * @param {Record<string, PresenceState>} presences
   * @param {((key: string, obj: PresenceState) => T)} [chooser]
   *
   * @returns {T[]}
   */
  static list(e, r) {
    return r || (r = function(n, s) {
      return s;
    }), this.map(e, (n, s) => r(n, s));
  }
  // private
  /**
  * @template T
  * @param {Record<string, PresenceState>} obj
  * @param {(key: string, obj: PresenceState) => T} func
  */
  static map(e, r) {
    return Object.getOwnPropertyNames(e).map((n) => r(n, e[n]));
  }
  // Presence keys are chosen on the server and may collide with
  // Object.prototype properties ("__proto__", "constructor", ...), so any
  // object indexed by presence key must not have a prototype chain
  //
  // TODO: replace the null-prototype objects with Maps in Phoenix 2.0
  // (breaking change for the lower-level static API)
  static toNullProtoObj(e) {
    if (Object.getPrototypeOf(e) === null)
      return e;
    let r = /* @__PURE__ */ Object.create(null);
    return Object.getOwnPropertyNames(e).forEach((n) => {
      r[n] = e[n];
    }), r;
  }
  /**
  * @template T
  * @param {T} obj
  * @returns {T}
  */
  static clone(e) {
    return JSON.parse(JSON.stringify(e));
  }
}, Cs = {
  HEADER_LENGTH: 1,
  META_LENGTH: 4,
  KINDS: { push: 0, reply: 1, broadcast: 2 },
  /**
  * @template T
  * @param {Message<Record<string, any>>} msg
  * @param {(msg: ArrayBuffer | string) => T} callback
  * @returns {T}
  */
  encode(t, e) {
    if (t.payload.constructor === ArrayBuffer)
      return e(this.binaryEncode(t));
    {
      let r = [t.join_ref, t.ref, t.topic, t.event, t.payload];
      return e(JSON.stringify(r));
    }
  },
  /**
  * @template T
  * @param {ArrayBuffer | string} rawPayload
  * @param {(msg: Message<unknown>) => T} callback
  * @returns {T}
  */
  decode(t, e) {
    if (t.constructor === ArrayBuffer)
      return e(this.binaryDecode(t));
    {
      let [r, n, s, i, o] = JSON.parse(t);
      return e({ join_ref: r, ref: n, topic: s, event: i, payload: o });
    }
  },
  /** @private */
  binaryEncode(t) {
    let { join_ref: e, ref: r, event: n, topic: s, payload: i } = t, o = new TextEncoder(), a = o.encode(e), l = o.encode(r), u = o.encode(s), c = o.encode(n);
    this.assertFieldSize(a.byteLength, "join_ref"), this.assertFieldSize(l.byteLength, "ref"), this.assertFieldSize(u.byteLength, "topic"), this.assertFieldSize(c.byteLength, "event");
    let h = this.META_LENGTH + a.byteLength + l.byteLength + u.byteLength + c.byteLength, d = new ArrayBuffer(this.HEADER_LENGTH + h), g = new Uint8Array(d), v = new DataView(d), y = 0;
    v.setUint8(y++, this.KINDS.push), v.setUint8(y++, a.byteLength), v.setUint8(y++, l.byteLength), v.setUint8(y++, u.byteLength), v.setUint8(y++, c.byteLength), g.set(a, y), y += a.byteLength, g.set(l, y), y += l.byteLength, g.set(u, y), y += u.byteLength, g.set(c, y), y += c.byteLength;
    var k = new Uint8Array(d.byteLength + i.byteLength);
    return k.set(g, 0), k.set(new Uint8Array(i), d.byteLength), k.buffer;
  },
  assertFieldSize(t, e) {
    if (t > 255)
      throw new Error(`unable to convert ${e} to binary: must be less than or equal to 255 bytes, but is ${t} bytes`);
  },
  /**
  * @private
  */
  binaryDecode(t) {
    let e = new DataView(t), r = e.getUint8(0), n = new TextDecoder();
    switch (r) {
      case this.KINDS.push:
        return this.decodePush(t, e, n);
      case this.KINDS.reply:
        return this.decodeReply(t, e, n);
      case this.KINDS.broadcast:
        return this.decodeBroadcast(t, e, n);
    }
  },
  /** @private */
  decodePush(t, e, r) {
    let n = e.getUint8(1), s = e.getUint8(2), i = e.getUint8(3), o = this.HEADER_LENGTH + this.META_LENGTH - 1, a = r.decode(t.slice(o, o + n));
    o = o + n;
    let l = r.decode(t.slice(o, o + s));
    o = o + s;
    let u = r.decode(t.slice(o, o + i));
    o = o + i;
    let c = t.slice(o, t.byteLength);
    return { join_ref: a, ref: null, topic: l, event: u, payload: c };
  },
  /** @private */
  decodeReply(t, e, r) {
    let n = e.getUint8(1), s = e.getUint8(2), i = e.getUint8(3), o = e.getUint8(4), a = this.HEADER_LENGTH + this.META_LENGTH, l = r.decode(t.slice(a, a + n));
    a = a + n;
    let u = r.decode(t.slice(a, a + s));
    a = a + s;
    let c = r.decode(t.slice(a, a + i));
    a = a + i;
    let h = r.decode(t.slice(a, a + o));
    a = a + o;
    let d = t.slice(a, t.byteLength), g = { status: h, response: d };
    return { join_ref: l, ref: u, topic: c, event: lt.reply, payload: g };
  },
  /** @private */
  decodeBroadcast(t, e, r) {
    let n = e.getUint8(1), s = e.getUint8(2), i = this.HEADER_LENGTH + 2, o = r.decode(t.slice(i, i + n));
    i = i + n;
    let a = r.decode(t.slice(i, i + s));
    i = i + s;
    let l = t.slice(i, t.byteLength);
    return { join_ref: null, ref: null, topic: o, event: a, payload: l };
  }
}, vm = class {
  /** Initializes the Socket *
   *
   * For IE8 support use an ES5-shim (https://github.com/es-shims/es5-shim)
   *
   * @constructor
   * @param {string} endPoint - The string WebSocket endpoint, ie, `"ws://example.com/socket"`,
   *                                               `"wss://example.com"`
   *                                               `"/socket"` (inherited host & protocol)
   * @param {SocketOptions} [opts] - Optional configuration
   */
  constructor(t, e = {}) {
    this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] }, this.channels = [], this.sendBuffer = [], this.ref = 0, this.fallbackRef = null, this.timeout = e.timeout || cm, this.transport = e.transport || et.WebSocket || hr, this.conn = void 0, this.primaryPassedHealthCheck = !1, this.longPollFallbackMs = e.longPollFallbackMs, this.fallbackTimer = null;
    let r = null;
    try {
      r = et && et.sessionStorage;
    } catch {
    }
    this.sessionStore = e.sessionStorage || r, this.establishedConnections = 0, this.defaultEncoder = Cs.encode.bind(Cs), this.defaultDecoder = Cs.decode.bind(Cs), this.closeWasClean = !0, this.disconnecting = !1, this.binaryType = e.binaryType || "arraybuffer", this.connectClock = 1, this.pageHidden = !1, this.encode = void 0, this.decode = void 0, this.transport !== hr ? (this.encode = e.encode || this.defaultEncoder, this.decode = e.decode || this.defaultDecoder) : (this.encode = this.defaultEncoder, this.decode = this.defaultDecoder);
    let n = null;
    mr && mr.addEventListener && (mr.addEventListener("pagehide", (s) => {
      this.conn && (this.disconnect(), n = this.connectClock);
    }), mr.addEventListener("pageshow", (s) => {
      n === this.connectClock && (n = null, this.connect());
    }), mr.addEventListener("visibilitychange", () => {
      document.visibilityState === "hidden" ? this.pageHidden = !0 : (this.pageHidden = !1, !this.isConnected() && !this.closeWasClean && this.teardown(() => this.connect()));
    })), this.heartbeatIntervalMs = e.heartbeatIntervalMs || 3e4, this.autoSendHeartbeat = e.autoSendHeartbeat ?? !0, this.heartbeatCallback = e.heartbeatCallback ?? (() => {
    }), this.rejoinAfterMs = (s) => e.rejoinAfterMs ? e.rejoinAfterMs(s) : [1e3, 2e3, 5e3][s - 1] || 1e4, this.reconnectAfterMs = (s) => e.reconnectAfterMs ? e.reconnectAfterMs(s) : [10, 50, 100, 150, 200, 250, 500, 1e3, 2e3][s - 1] || 5e3, this.logger = e.logger || null, !this.logger && e.debug && (this.logger = (s, i, o) => {
      console.log(`${s}: ${i}`, o);
    }), this.longpollerTimeout = e.longpollerTimeout || 2e4, this.params = $r(e.params || {}), this.endPoint = `${t}/${ba.websocket}`, this.vsn = e.vsn || um, this.heartbeatTimeoutTimer = null, this.heartbeatTimer = null, this.heartbeatSentAt = null, this.pendingHeartbeatRef = null, this.reconnectTimer = new Hd(() => {
      if (this.pageHidden) {
        this.log("Not reconnecting as page is hidden!"), this.teardown();
        return;
      }
      this.teardown(async () => {
        e.beforeReconnect && await e.beforeReconnect(), this.connect();
      });
    }, this.reconnectAfterMs), this.authToken = e.authToken && $r(e.authToken);
  }
  /**
   * Returns the LongPoll transport reference
   */
  getLongPollTransport() {
    return hr;
  }
  /**
   * Disconnects and replaces the active transport
   *
   * @param {SocketTransport} newTransport - The new transport class to instantiate
   *
   */
  replaceTransport(t) {
    this.connectClock++, this.closeWasClean = !0, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.conn && (this.conn.close(), this.conn = null), this.transport = t;
  }
  /**
   * Returns the socket protocol
   *
   * @returns {"wss" | "ws"}
   */
  protocol() {
    return location.protocol.match(/^https/) ? "wss" : "ws";
  }
  /**
   * The fully qualified socket url
   *
   * @returns {string}
   */
  endPointURL() {
    let t = vi.appendParams(
      vi.appendParams(this.endPoint, this.params()),
      { vsn: this.vsn }
    );
    return t.charAt(0) !== "/" ? t : t.charAt(1) === "/" ? `${this.protocol()}:${t}` : `${this.protocol()}://${location.host}${t}`;
  }
  /**
   * Disconnects the socket
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes for valid status codes.
   *
   * @param {() => void} [callback] - Optional callback which is called after socket is disconnected.
   * @param {number} [code] - A status code for disconnection (Optional).
   * @param {string} [reason] - A textual description of the reason to disconnect. (Optional)
   */
  disconnect(t, e, r) {
    this.connectClock++, this.disconnecting = !0, this.closeWasClean = !0, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.teardown(() => {
      this.disconnecting = !1, t && t();
    }, e, r);
  }
  /**
   * @param {Params} [params] - [DEPRECATED] The params to send when connecting, for example `{user_id: userToken}`
   *
   * Passing params to connect is deprecated; pass them in the Socket constructor instead:
   * `new Socket("/socket", {params: {user_id: userToken}})`.
   */
  connect(t) {
    t && (console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor"), this.params = $r(t)), !(this.conn && !this.disconnecting) && (this.longPollFallbackMs && this.transport !== hr ? this.connectWithFallback(hr, this.longPollFallbackMs) : this.transportConnect());
  }
  /**
   * Logs the message. Override `this.logger` for specialized logging. noops by default
   * @param {string} kind
   * @param {string} msg
   * @param {Object} data
   */
  log(t, e, r) {
    this.logger && this.logger(t, e, r);
  }
  /**
   * Returns true if a logger has been set on this socket.
   */
  hasLogger() {
    return this.logger !== null;
  }
  /**
   * Registers callbacks for connection open events
   *
   * @example socket.onOpen(function(){ console.info("the socket was opened") })
   *
   * @param {SocketOnOpen} callback
   */
  onOpen(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.open.push([e, t]), e;
  }
  /**
   * Registers callbacks for connection close events
   * @param {SocketOnClose} callback
   * @returns {string}
   */
  onClose(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.close.push([e, t]), e;
  }
  /**
   * Registers callbacks for connection error events
   *
   * @example socket.onError(function(error){ alert("An error occurred") })
   *
   * @param {SocketOnError} callback
   * @returns {string}
   */
  onError(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.error.push([e, t]), e;
  }
  /**
   * Registers callbacks for connection message events
   * @param {SocketOnMessage} callback
   * @returns {string}
   */
  onMessage(t) {
    let e = this.makeRef();
    return this.stateChangeCallbacks.message.push([e, t]), e;
  }
  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
   * @param {HeartbeatCallback} callback
   */
  onHeartbeat(t) {
    this.heartbeatCallback = t;
  }
  /**
   * Pings the server and invokes the callback with the RTT in milliseconds
   * @param {(timeDelta: number) => void} callback
   *
   * Returns true if the ping was pushed or false if unable to be pushed.
   */
  ping(t) {
    if (!this.isConnected())
      return !1;
    let e = this.makeRef(), r = Date.now();
    this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: e });
    let n = this.onMessage((s) => {
      s.ref === e && (this.off([n]), t(Date.now() - r));
    });
    return !0;
  }
  /**
   * @private
   *
   * @param {Function}
   */
  transportName(t) {
    switch (t) {
      case hr:
        return "LongPoll";
      default:
        return t.name;
    }
  }
  /**
   * @private
   */
  transportConnect() {
    this.connectClock++, this.closeWasClean = !1;
    let t;
    this.authToken && (t = ["phoenix", `${Ta}${btoa(this.authToken()).replace(/=/g, "")}`]), this.conn = new this.transport(this.endPointURL(), t), this.conn.binaryType = this.binaryType, this.conn.timeout = this.longpollerTimeout, this.conn.onopen = () => this.onConnOpen(), this.conn.onerror = (e) => this.onConnError(e), this.conn.onmessage = (e) => this.onConnMessage(e), this.conn.onclose = (e) => this.onConnClose(e);
  }
  getSession(t) {
    return this.sessionStore && this.sessionStore.getItem(t);
  }
  storeSession(t, e) {
    this.sessionStore && this.sessionStore.setItem(t, e);
  }
  connectWithFallback(t, e = 2500) {
    clearTimeout(this.fallbackTimer);
    let r = !1, n = !0, s, i, o = this.transportName(t), a = (l) => {
      this.log("transport", `falling back to ${o}...`, l), this.off([s, i]), n = !1, this.replaceTransport(t), this.transportConnect();
    };
    if (this.getSession(`phx:fallback:${o}`))
      return a("memorized");
    this.fallbackTimer = setTimeout(a, e), i = this.onError((l) => {
      this.log("transport", "error", l), n && !r && (clearTimeout(this.fallbackTimer), a(l));
    }), this.fallbackRef && this.off([this.fallbackRef]), this.fallbackRef = this.onOpen(() => {
      if (r = !0, !n) {
        let l = this.transportName(t);
        return this.primaryPassedHealthCheck || this.storeSession(`phx:fallback:${l}`, "true"), this.log("transport", `established ${l} fallback`);
      }
      clearTimeout(this.fallbackTimer), this.fallbackTimer = setTimeout(a, e), this.ping((l) => {
        this.log("transport", "connected to primary after", l), this.primaryPassedHealthCheck = !0, clearTimeout(this.fallbackTimer);
      });
    }), this.transportConnect();
  }
  clearHeartbeats() {
    clearTimeout(this.heartbeatTimer), clearTimeout(this.heartbeatTimeoutTimer);
  }
  onConnOpen() {
    this.hasLogger() && this.log("transport", `connected to ${this.endPointURL()}`), this.closeWasClean = !1, this.disconnecting = !1, this.establishedConnections++, this.flushSendBuffer(), this.reconnectTimer.reset(), this.autoSendHeartbeat && this.resetHeartbeat(), this.triggerStateCallbacks("open");
  }
  /**
   * @private
   */
  heartbeatTimeout() {
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.hasLogger() && this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
      try {
        this.heartbeatCallback("timeout");
      } catch (t) {
        this.log("error", "error in heartbeat callback", t);
      }
      this.triggerChanError(new Error("heartbeat timeout")), this.closeWasClean = !1, this.teardown(() => this.reconnectTimer.scheduleTimeout(), hm, "heartbeat timeout");
    }
  }
  resetHeartbeat() {
    this.conn && this.conn.skipHeartbeat || (this.pendingHeartbeatRef = null, this.clearHeartbeats(), this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
  }
  teardown(t, e, r) {
    if (!this.conn)
      return t && t();
    const n = this.conn;
    this.waitForBufferDone(n, () => {
      e ? n.close(e, r || "") : n.close(), this.waitForSocketClosed(n, () => {
        this.conn === n && (this.conn.onopen = function() {
        }, this.conn.onerror = function() {
        }, this.conn.onmessage = function() {
        }, this.conn.onclose = function() {
        }, this.conn = null), t && t();
      });
    });
  }
  waitForBufferDone(t, e, r = 1) {
    if (r === 5 || !t.bufferedAmount) {
      e();
      return;
    }
    setTimeout(() => {
      this.waitForBufferDone(t, e, r + 1);
    }, 150 * r);
  }
  waitForSocketClosed(t, e, r = 1) {
    if (r === 5 || t.readyState === tt.closed) {
      e();
      return;
    }
    setTimeout(() => {
      this.waitForSocketClosed(t, e, r + 1);
    }, 150 * r);
  }
  /**
  * @param {CloseEvent} event
  */
  onConnClose(t) {
    this.conn && (this.conn.onclose = () => {
    }), this.hasLogger() && this.log("transport", "close", t), this.triggerChanError(t), this.clearHeartbeats(), this.closeWasClean || this.reconnectTimer.scheduleTimeout(), this.triggerStateCallbacks("close", t);
  }
  /**
   * @private
   * @param {Event} error
   */
  onConnError(t) {
    this.hasLogger() && this.log("transport", "error", t);
    let e = this.transport, r = this.establishedConnections;
    this.triggerStateCallbacks("error", t, e, r), (e === this.transport || r > 0) && this.triggerChanError(t);
  }
  /**
   * @private
   * @param {unknown} [reason] underlying close/error event forwarded to channel error listeners
   */
  triggerChanError(t) {
    this.channels.forEach((e) => {
      e.isErrored() || e.isLeaving() || e.isClosed() || e.trigger(lt.error, t);
    });
  }
  /**
   * @returns {string}
   */
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case tt.connecting:
        return "connecting";
      case tt.open:
        return "open";
      case tt.closing:
        return "closing";
      default:
        return "closed";
    }
  }
  /**
   * @returns {boolean}
   */
  isConnected() {
    return this.connectionState() === "open";
  }
  /**
   *
   * @param {Channel} channel
   */
  remove(t) {
    this.off(t.stateChangeRefs), this.channels = this.channels.filter((e) => e !== t);
  }
  /**
   * Removes `onOpen`, `onClose`, `onError,` and `onMessage` registrations.
   *
   * @param {string[]} refs - list of refs returned by calls to
   *                 `onOpen`, `onClose`, `onError,` and `onMessage`
   */
  off(t) {
    for (let e in this.stateChangeCallbacks)
      this.stateChangeCallbacks[e] = this.stateChangeCallbacks[e].filter(([r]) => t.indexOf(r) === -1);
  }
  /**
   * Initiates a new channel for the given topic
   *
   * @param {string} topic
   * @param {Params | (() => Params)} [chanParams]- Parameters for the channel
   * @returns {Channel}
   */
  channel(t, e = {}) {
    let r = new pm(t, e, this);
    return this.channels.push(r), r;
  }
  /**
   * @param {Message<Record<string, any>>} data
   */
  push(t) {
    if (this.hasLogger()) {
      let { topic: e, event: r, payload: n, ref: s, join_ref: i } = t;
      this.log("push", `${e} ${r} (${i}, ${s})`, n);
    }
    this.isConnected() ? this.encode(t, (e) => this.conn.send(e)) : this.sendBuffer.push(() => this.encode(t, (e) => this.conn.send(e)));
  }
  /**
   * Return the next message ref, accounting for overflows
   * @returns {string}
   */
  makeRef() {
    let t = this.ref + 1;
    return t === this.ref ? this.ref = 0 : this.ref = t, this.ref.toString();
  }
  sendHeartbeat() {
    if (!this.isConnected()) {
      try {
        this.heartbeatCallback("disconnected");
      } catch (t) {
        this.log("error", "error in heartbeat callback", t);
      }
      return;
    }
    if (this.pendingHeartbeatRef) {
      this.heartbeatTimeout();
      return;
    }
    this.pendingHeartbeatRef = this.makeRef(), this.heartbeatSentAt = Date.now(), this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: this.pendingHeartbeatRef });
    try {
      this.heartbeatCallback("sent");
    } catch (t) {
      this.log("error", "error in heartbeat callback", t);
    }
    this.heartbeatTimeoutTimer = setTimeout(() => this.heartbeatTimeout(), this.heartbeatIntervalMs);
  }
  flushSendBuffer() {
    this.isConnected() && this.sendBuffer.length > 0 && (this.sendBuffer.forEach((t) => t()), this.sendBuffer = []);
  }
  /**
  * @param {MessageEvent<any>} rawMessage
  */
  onConnMessage(t) {
    this.decode(t.data, (e) => {
      let { topic: r, event: n, payload: s, ref: i, join_ref: o } = e;
      if (i && i === this.pendingHeartbeatRef) {
        const a = this.heartbeatSentAt ? Date.now() - this.heartbeatSentAt : void 0;
        this.clearHeartbeats();
        try {
          this.heartbeatCallback(s.status === "ok" ? "ok" : "error", a);
        } catch (l) {
          this.log("error", "error in heartbeat callback", l);
        }
        this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.autoSendHeartbeat && (this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
      }
      this.hasLogger() && this.log("receive", `${s.status || ""} ${r} ${n} ${i && "(" + i + ")" || ""}`.trim(), s);
      for (let a = 0; a < this.channels.length; a++) {
        const l = this.channels[a];
        l.isMember(r, n, s, o) && l.trigger(n, s, i, o);
      }
      this.triggerStateCallbacks("message", e);
    });
  }
  /**
   * @private
   * @template {keyof SocketStateChangeCallbacks} K
   * @param {K} event
   * @param {...Parameters<SocketStateChangeCallbacks[K][number][1]>} args
   * @returns {void}
   */
  triggerStateCallbacks(t, ...e) {
    try {
      this.stateChangeCallbacks[t].forEach(([r, n]) => {
        try {
          n(...e);
        } catch (s) {
          this.log("error", `error in ${t} callback`, s);
        }
      });
    } catch (r) {
      this.log("error", `error triggering ${t} callbacks`, r);
    }
  }
  leaveOpenTopic(t) {
    let e = this.channels.find((r) => r.topic === t && (r.isJoined() || r.isJoining()));
    e && (this.hasLogger() && this.log("transport", `leaving duplicate topic "${t}"`), e.leave());
  }
};
class bn {
  constructor(e, r) {
    const n = wm(r);
    this.presence = new mm(e.getChannel(), n), this.presence.onJoin((s, i, o) => {
      const a = bn.onJoinPayload(s, i, o);
      e.getChannel().trigger("presence", a);
    }), this.presence.onLeave((s, i, o) => {
      const a = bn.onLeavePayload(s, i, o);
      e.getChannel().trigger("presence", a);
    }), this.presence.onSync(() => {
      e.getChannel().trigger("presence", { event: "sync" });
    });
  }
  get state() {
    return bn.transformState(this.presence.state);
  }
  /**
   * @private
   * Remove 'metas' key
   * Change 'phx_ref' to 'presence_ref'
   * Remove 'phx_ref' and 'phx_ref_prev'
   *
   * @example Transform state
   * // returns {
   *  abc123: [
   *    { presence_ref: '2', user_id: 1 },
   *    { presence_ref: '3', user_id: 2 }
   *  ]
   * }
   * RealtimePresence.transformState({
   *  abc123: {
   *    metas: [
   *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
   *      { phx_ref: '3', user_id: 2 }
   *    ]
   *  }
   * })
   *
   */
  static transformState(e) {
    return e = ym(e), Object.getOwnPropertyNames(e).reduce((r, n) => {
      const s = e[n];
      return r[n] = Vs(s), r;
    }, {});
  }
  static onJoinPayload(e, r, n) {
    const s = Ku(r), i = Vs(n);
    return {
      event: "join",
      key: e,
      currentPresences: s,
      newPresences: i
    };
  }
  static onLeavePayload(e, r, n) {
    const s = Ku(r), i = Vs(n);
    return {
      event: "leave",
      key: e,
      currentPresences: s,
      leftPresences: i
    };
  }
}
function Vs(t) {
  return t.metas.map((e) => {
    const r = Object.getOwnPropertyDescriptors(e), n = Object.defineProperties({}, r);
    return n.presence_ref = n.phx_ref, delete n.phx_ref, delete n.phx_ref_prev, n;
  });
}
function ym(t) {
  return JSON.parse(JSON.stringify(t));
}
function wm(t) {
  return (t == null ? void 0 : t.events) && { events: t.events };
}
function Ku(t) {
  return t != null && t.metas ? Vs(t) : [];
}
var qu;
(function(t) {
  t.SYNC = "sync", t.JOIN = "join", t.LEAVE = "leave";
})(qu || (qu = {}));
class _m {
  get state() {
    return this.presenceAdapter.state;
  }
  /**
   * Creates a Presence helper that keeps the local presence state in sync with the server.
   *
   * @param channel - The realtime channel to bind to.
   * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
   *
   * @category Realtime
   *
   * @example Example for a presence channel
   * ```ts
   * const presence = new RealtimePresence(channel)
   *
   * channel.on('presence', ({ event, key }) => {
   *   console.log(`Presence ${event} on ${key}`)
   * })
   * ```
   */
  constructor(e, r) {
    this.channel = e, this.presenceAdapter = new bn(this.channel.channelAdapter, r);
  }
}
function km(t) {
  if (t instanceof Error)
    return t;
  if (typeof t == "string")
    return new Error(t);
  if (t && typeof t == "object") {
    const e = t;
    if (typeof e.code == "number") {
      const r = typeof e.reason == "string" && e.reason ? ` (${e.reason})` : "";
      return new Error(`socket closed: ${e.code}${r}`, { cause: t });
    }
    return new Error("channel error: transport failure", { cause: t });
  }
  return new Error("channel error: connection lost");
}
class Sm {
  constructor(e, r, n) {
    const s = Em(n);
    this.channel = e.getSocket().channel(r, s), this.socket = e;
  }
  get state() {
    return this.channel.state;
  }
  set state(e) {
    this.channel.state = e;
  }
  get joinedOnce() {
    return this.channel.joinedOnce;
  }
  get joinPush() {
    return this.channel.joinPush;
  }
  get rejoinTimer() {
    return this.channel.rejoinTimer;
  }
  on(e, r) {
    return this.channel.on(e, r);
  }
  off(e, r) {
    this.channel.off(e, r);
  }
  subscribe(e) {
    return this.channel.join(e);
  }
  unsubscribe(e) {
    return this.channel.leave(e);
  }
  teardown() {
    this.channel.teardown();
  }
  onClose(e) {
    this.channel.onClose(e);
  }
  onError(e) {
    return this.channel.onError(e);
  }
  push(e, r, n) {
    let s;
    try {
      s = this.channel.push(e, r, n);
    } catch {
      throw new Error(`tried to push '${e}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`);
    }
    if (this.channel.pushBuffer.length > em) {
      const i = this.channel.pushBuffer.shift();
      i.cancelTimeout(), this.socket.log("channel", `discarded push due to buffer overflow: ${i.event}`, i.payload());
    }
    return s;
  }
  updateJoinPayload(e) {
    const r = this.channel.joinPush.payload();
    this.channel.joinPush.payload = () => Object.assign(Object.assign({}, r), e);
  }
  canPush() {
    return this.socket.isConnected() && this.state === Ct.joined;
  }
  isJoined() {
    return this.state === Ct.joined;
  }
  isJoining() {
    return this.state === Ct.joining;
  }
  isClosed() {
    return this.state === Ct.closed;
  }
  isLeaving() {
    return this.state === Ct.leaving;
  }
  updateFilterBindings(e) {
    this.channel.filterBindings = e;
  }
  updatePayloadTransform(e) {
    this.channel.onMessage = e;
  }
  /**
   * @internal
   */
  getChannel() {
    return this.channel;
  }
}
function Em(t) {
  return {
    config: Object.assign({
      broadcast: { ack: !1, self: !1 },
      presence: { key: "", enabled: !1 },
      private: !1
    }, t.config)
  };
}
const bm = /[,()"\\]/, Tm = (t) => bm.test(t) || t !== t.trim(), Cm = (t) => `"${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`, Gu = (t) => {
  const e = t === null ? "null" : String(t);
  return Tm(e) ? Cm(e) : e;
}, Rm = (t) => t === null ? "null" : String(t), Om = (t, e) => {
  if (t === "in") {
    const r = Array.isArray(e) ? e : [e];
    if (r.length === 0)
      throw new Error("Realtime `in` filter requires at least one value.");
    return `in.(${Array.from(new Set(r)).map((s) => Gu(s)).join(",")})`;
  }
  return t === "is" ? `is.${Rm(e)}` : `${t}.${Gu(e)}`;
};
class xm {
  constructor() {
    this.filters = [];
  }
  add(e, r, n, s = !1) {
    const i = s ? "not." : "";
    return this.filters.push(`${e}=${i}${Om(r, n)}`), this;
  }
  /** Match rows where `column` equals `value` (`column=eq.value`). */
  eq(e, r) {
    return this.add(e, "eq", r);
  }
  /** Match rows where `column` does not equal `value` (`column=neq.value`). */
  neq(e, r) {
    return this.add(e, "neq", r);
  }
  /** Match rows where `column` is greater than `value` (`column=gt.value`). */
  gt(e, r) {
    return this.add(e, "gt", r);
  }
  /** Match rows where `column` is greater than or equal to `value` (`column=gte.value`). */
  gte(e, r) {
    return this.add(e, "gte", r);
  }
  /** Match rows where `column` is less than `value` (`column=lt.value`). */
  lt(e, r) {
    return this.add(e, "lt", r);
  }
  /** Match rows where `column` is less than or equal to `value` (`column=lte.value`). */
  lte(e, r) {
    return this.add(e, "lte", r);
  }
  /**
   * Match rows where `column` is one of `values` (`column=in.(a,b,c)`).
   * Requires at least one value; duplicates are removed. An element containing a
   * reserved character is double-quoted (`in.("a,b",c)`), so commas inside an
   * element are preserved. `null` is intentionally not accepted (`IN (null)`
   * never matches in SQL) — use `is`/`not('col','is',null)` for null checks.
   */
  in(e, r) {
    return this.add(e, "in", r);
  }
  /** Match rows where `column` matches the case-sensitive `pattern` (`column=like.pattern`). */
  like(e, r) {
    return this.add(e, "like", r);
  }
  /** Match rows where `column` matches the case-insensitive `pattern` (`column=ilike.pattern`). */
  ilike(e, r) {
    return this.add(e, "ilike", r);
  }
  /** Match rows where `column` matches the POSIX regex `pattern` (`column=match.pattern`). */
  match(e, r) {
    return this.add(e, "match", r);
  }
  /** Match rows where `column` matches the case-insensitive POSIX regex `pattern` (`column=imatch.pattern`). */
  imatch(e, r) {
    return this.add(e, "imatch", r);
  }
  /**
   * Match rows where `column` `IS` the given value (`column=is.null`).
   * Accepts `null`, a boolean, or the keywords `'null' | 'true' | 'false' | 'unknown'`.
   */
  is(e, r) {
    return this.add(e, "is", r);
  }
  /** Match rows where `column` is distinct from `value` (`column=isdistinct.value`). NULL-safe inequality. */
  isDistinct(e, r) {
    return this.add(e, "isdistinct", r);
  }
  not(e, r, n) {
    return this.add(e, r, n, !0);
  }
  /**
   * Serialize all conditions into the comma-separated (AND) filter string.
   *
   * Conditions are joined by commas, which the server applies as `AND`. A scalar
   * value (or single `in` element) that contains a reserved character — `,`,
   * `(`, `)`, `"`, `\` — or surrounding whitespace is double-quoted and escaped
   * the way PostgREST does, so commas inside a value are preserved rather than
   * read as a condition boundary.
   */
  build() {
    return this.filters.join(",");
  }
  /** Alias for {@link build}; lets the builder be used wherever a string is expected. */
  toString() {
    return this.build();
  }
}
var Ju;
(function(t) {
  t.ALL = "*", t.INSERT = "INSERT", t.UPDATE = "UPDATE", t.DELETE = "DELETE";
})(Ju || (Ju = {}));
var xr;
(function(t) {
  t.BROADCAST = "broadcast", t.PRESENCE = "presence", t.POSTGRES_CHANGES = "postgres_changes", t.SYSTEM = "system";
})(xr || (xr = {}));
var ut;
(function(t) {
  t.SUBSCRIBED = "SUBSCRIBED", t.TIMED_OUT = "TIMED_OUT", t.CLOSED = "CLOSED", t.CHANNEL_ERROR = "CHANNEL_ERROR";
})(ut || (ut = {}));
class Tn {
  get state() {
    return this.channelAdapter.state;
  }
  set state(e) {
    this.channelAdapter.state = e;
  }
  get joinedOnce() {
    return this.channelAdapter.joinedOnce;
  }
  get timeout() {
    return this.socket.timeout;
  }
  get joinPush() {
    return this.channelAdapter.joinPush;
  }
  get rejoinTimer() {
    return this.channelAdapter.rejoinTimer;
  }
  /**
   * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
   *
   * The topic determines which realtime stream you are subscribing to. Config options let you
   * enable acknowledgement for broadcasts, presence tracking, or private channels.
   *
   * @category Realtime
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const channel = supabase.channel('room1')
   * channel
   *   .on('broadcast', { event: 'cursor-pos' }, (payload) => console.log(payload))
   *   .subscribe()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'your-publishable-key' },
   * })
   * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
   * ```
   */
  constructor(e, r = { config: {} }, n) {
    var s, i;
    if (this.topic = e, this.params = r, this.socket = n, this.bindings = {}, this.subTopic = e.replace(/^realtime:/i, ""), this.params.config = Object.assign({
      broadcast: { ack: !1, self: !1 },
      presence: { key: "", enabled: !1 },
      private: !1
    }, r.config), this.channelAdapter = new Sm(this.socket.socketAdapter, e, this.params), this.presence = new _m(this), this._onClose(() => {
      this.socket._remove(this);
    }), this._updateFilterTransform(), this.broadcastEndpointURL = Fd(this.socket.socketAdapter.endPointURL()), this.private = this.params.config.private || !1, !this.private && (!((i = (s = this.params.config) === null || s === void 0 ? void 0 : s.broadcast) === null || i === void 0) && i.replay))
      throw new Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`);
  }
  /**
   * Subscribe registers your client with the server.
   *
   * The optional `callback` receives a `status` and, on failure, an `err` argument.
   * Log the full `err` so its `cause`, `name`, and any structured fields aren't hidden
   * behind `err.message`.
   *
   * @category Realtime
   *
   * @example Handling errors
   * ```js
   * supabase.channel('room1').subscribe((status, err) => {
   *   if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
   *     // Log the full error: its `cause` often holds the underlying reason.
   *     console.error(status, err)
   *   }
   * })
   * ```
   */
  subscribe(e, r = this.timeout) {
    var n, s, i;
    if (this.socket.isConnected() || this.socket.connect(), this.channelAdapter.isClosed()) {
      const { config: { broadcast: o, presence: a, private: l } } = this.params, u = (s = (n = this.bindings.postgres_changes) === null || n === void 0 ? void 0 : n.map((g) => g.filter)) !== null && s !== void 0 ? s : [], c = !!this.bindings[xr.PRESENCE] && this.bindings[xr.PRESENCE].length > 0 || ((i = this.params.config.presence) === null || i === void 0 ? void 0 : i.enabled) === !0, h = {}, d = {
        broadcast: o,
        presence: Object.assign(Object.assign({}, a), { enabled: c }),
        postgres_changes: u,
        private: l
      };
      this.socket.accessTokenValue && (h.access_token = this.socket.accessTokenValue), this._onError((g) => {
        e == null || e(ut.CHANNEL_ERROR, km(g));
      }), this._onClose(() => e == null ? void 0 : e(ut.CLOSED)), this.updateJoinPayload(Object.assign({ config: d }, h)), this._updateFilterMessage(), this.channelAdapter.subscribe(r).receive("ok", async ({ postgres_changes: g }) => {
        if (this.socket._isManualToken() || this.socket.setAuth(), g === void 0) {
          e == null || e(ut.SUBSCRIBED);
          return;
        }
        this._updatePostgresBindings(g, e);
      }).receive("error", (g) => {
        this.state = Ct.errored;
        const v = Object.values(g).join(", ") || "error";
        e == null || e(ut.CHANNEL_ERROR, new Error(v, { cause: g }));
      }).receive("timeout", () => {
        e == null || e(ut.TIMED_OUT);
      });
    }
    return this;
  }
  _updatePostgresBindings(e, r) {
    var n;
    const s = this.bindings.postgres_changes, i = (n = s == null ? void 0 : s.length) !== null && n !== void 0 ? n : 0, o = [];
    for (let a = 0; a < i; a++) {
      const l = s[a], { filter: { event: u, schema: c, table: h, filter: d } } = l, g = e && e[a];
      if (g && g.event === u && Tn.isFilterValueEqual(g.schema, c) && Tn.isFilterValueEqual(g.table, h) && Tn.isFilterValueEqual(g.filter, d))
        o.push(Object.assign(Object.assign({}, l), { id: g.id }));
      else {
        this.unsubscribe(), this.state = Ct.errored, r == null || r(ut.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
        return;
      }
    }
    this.bindings.postgres_changes = o, this.state != Ct.errored && r && r(ut.SUBSCRIBED);
  }
  /**
   * Returns the current presence state for this channel.
   *
   * The shape is a map keyed by presence key (for example a user id) where each entry contains the
   * tracked metadata for that user.
   *
   * @category Realtime
   */
  presenceState() {
    return this.presence.state;
  }
  /**
   * Sends the supplied payload to the presence tracker so other subscribers can see that this
   * client is online. Use `untrack` to stop broadcasting presence for the same key.
   *
   * Tracking makes this client visible to other subscribers immediately, regardless of this
   * channel's `config.presence.enabled` setting or whether it has a `presence` listener — that
   * flag only affects whether *this* client receives presence updates from others (and, on
   * RLS-protected channels, whether it's authorized to do so).
   *
   * @category Realtime
   */
  async track(e, r = {}) {
    return await this.send({
      type: "presence",
      event: "track",
      payload: e
    }, r);
  }
  /**
   * Removes the current presence state for this client.
   *
   * @category Realtime
   */
  async untrack(e = {}) {
    return await this.send({
      type: "presence",
      event: "untrack"
    }, e);
  }
  /**
   * Listen to realtime events on this channel.
   * @category Realtime
   *
   * @remarks
   * - By default, Broadcast and Presence are enabled for all projects.
   * - By default, listening to database changes is disabled for new projects due to database performance and security concerns. You can turn it on by managing Realtime's [replication](/docs/guides/api#realtime-api-overview).
   * - You can receive the "previous" data for updates and deletes by setting the table's `REPLICA IDENTITY` to `FULL` (e.g., `ALTER TABLE your_table REPLICA IDENTITY FULL;`).
   * - Row level security is not applied to delete statements. When RLS is enabled and replica identity is set to full, only the primary key is sent to clients.
   *
   * @example Listen to broadcast messages
   * ```js
   * const channel = supabase.channel("room1")
   *
   * channel.on("broadcast", { event: "cursor-pos" }, (payload) => {
   *   console.log("Cursor position received!", payload);
   * }).subscribe((status) => {
   *   if (status === "SUBSCRIBED") {
   *     channel.send({
   *       type: "broadcast",
   *       event: "cursor-pos",
   *       payload: { x: Math.random(), y: Math.random() },
   *     });
   *   }
   * });
   * ```
   *
   * @example Listen to presence sync
   * ```js
   * const channel = supabase.channel('room1')
   * channel
   *   .on('presence', { event: 'sync' }, () => {
   *     console.log('Synced presence state: ', channel.presenceState())
   *   })
   *   .subscribe(async (status) => {
   *     if (status === 'SUBSCRIBED') {
   *       await channel.track({ online_at: new Date().toISOString() })
   *     }
   *   })
   * ```
   *
   * @example Listen to presence join
   * ```js
   * const channel = supabase.channel('room1')
   * channel
   *   .on('presence', { event: 'join' }, ({ newPresences }) => {
   *     console.log('Newly joined presences: ', newPresences)
   *   })
   *   .subscribe(async (status) => {
   *     if (status === 'SUBSCRIBED') {
   *       await channel.track({ online_at: new Date().toISOString() })
   *     }
   *   })
   * ```
   *
   * @example Listen to presence leave
   * ```js
   * const channel = supabase.channel('room1')
   * channel
   *   .on('presence', { event: 'leave' }, ({ leftPresences }) => {
   *     console.log('Newly left presences: ', leftPresences)
   *   })
   *   .subscribe(async (status) => {
   *     if (status === 'SUBSCRIBED') {
   *       await channel.track({ online_at: new Date().toISOString() })
   *       await channel.untrack()
   *     }
   *   })
   * ```
   *
   * @example Listen to all database changes
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: '*', schema: '*' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @example Listen to a specific table
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: '*', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @example Listen to inserts
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to updates
   * By default, Supabase will send only the updated record. If you want to receive the previous values as well you can
   * enable full replication for the table you are listening to:
   *
   * ```sql
   * alter table "your_table" replica identity full;
   * ```
   *
   * @example Listen to updates
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to deletes
   * By default, Supabase does not send deleted records. If you want to receive the deleted record you can
   * enable full replication for the table you are listening to:
   *
   * ```sql
   * alter table "your_table" replica identity full;
   * ```
   *
   * @example Listen to deletes
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'countries' }, payload => {
   *     console.log('Change received!', payload)
   *   })
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to multiple events
   * You can chain listeners if you want to listen to multiple events for each table.
   *
   * @example Listen to multiple events
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'countries' }, handleRecordInserted)
   *   .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'countries' }, handleRecordDeleted)
   *   .subscribe()
   * ```
   *
   * @exampleDescription Listen to row level changes
   * You can listen to individual rows using the format `{table}:{col}=eq.{val}` - where `{col}` is the column name, and `{val}` is the value which you want to match.
   *
   * @example Listen to row level changes
   * ```js
   * supabase
   *   .channel('room1')
   *   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'countries', filter: 'id=eq.200' }, handleRecordUpdated)
   *   .subscribe()
   * ```
   */
  on(e, r, n) {
    const s = this.channelAdapter.isJoined() || this.channelAdapter.isJoining(), i = e === xr.PRESENCE || e === xr.POSTGRES_CHANGES;
    if (s && i)
      throw this.socket.log("channel", `cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`), new Error(`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`);
    return this._on(e, r, n);
  }
  /**
   * Sends a broadcast message explicitly via REST API.
   *
   * This method always uses the REST API endpoint regardless of WebSocket connection state.
   * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
   *
   * Payloads that are `ArrayBuffer` or `ArrayBufferView` (e.g. `Uint8Array`) are sent as
   * `application/octet-stream`; all other payloads are JSON-encoded.
   *
   * @param event The name of the broadcast event
   * @param payload Payload to be sent (required)
   * @param opts Options including timeout
   * @returns Promise resolving to object with success status, and error details if failed
   *
   * @category Realtime
   */
  async httpSend(e, r, n = {}) {
    var s;
    if (r == null)
      return Promise.reject(new Error("Payload is required for httpSend()"));
    const i = r instanceof ArrayBuffer || ArrayBuffer.isView(r), o = {
      apikey: this.socket.apiKey ? this.socket.apiKey : "",
      "Content-Type": i ? "application/octet-stream" : "application/json"
    };
    this.socket.accessTokenValue && (o.Authorization = `Bearer ${this.socket.accessTokenValue}`);
    const a = new URL(this.broadcastEndpointURL);
    a.pathname += `/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(e)}`, this.private && a.searchParams.set("private", "true");
    const l = {
      method: "POST",
      headers: o,
      body: i ? r : JSON.stringify(r)
    }, u = await this._fetchWithTimeout(a.toString(), l, (s = n.timeout) !== null && s !== void 0 ? s : this.timeout);
    if (u.status === 202)
      return { success: !0 };
    if (u.status === 404)
      return Promise.reject(new Error("httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404. Update your Supabase CLI to a recent version, or upgrade the Realtime server in your self-hosted setup. See https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/migrations/httpsend-server-version.md"));
    let c = u.statusText;
    try {
      const h = await u.json();
      c = h.error || h.message || c;
    } catch {
    }
    return Promise.reject(new Error(c));
  }
  /**
   * Sends a message into the channel.
   *
   * @param args Arguments to send to channel
   * @param args.type The type of event to send
   * @param args.event The name of the event being sent
   * @param args.payload Payload to be sent
   * @param opts Options to be used during the send process
   *
   * @category Realtime
   *
   * @remarks
   * - When using REST you don't need to subscribe to the channel
   * - REST calls are only available from 2.37.0 onwards
   * - If you create a channel only to send a REST broadcast, remove it from
   *   the client when the send completes
   *
   * @example Send a message via websocket
   * ```js
   * const channel = supabase.channel('room1')
   *
   * channel.subscribe((status) => {
   *   if (status === 'SUBSCRIBED') {
   *     channel.send({
   *       type: 'broadcast',
   *       event: 'cursor-pos',
   *       payload: { x: Math.random(), y: Math.random() },
   *     })
   *   }
   * })
   * ```
   *
   * @exampleResponse Send a message via websocket
   * ```js
   * ok | timed out | error
   * ```
   *
   * @example Send a message via REST
   * ```js
   * const channel = supabase.channel('room1')
   *
   * try {
   *   await channel.httpSend('cursor-pos', { x: Math.random(), y: Math.random() })
   * } finally {
   *   await supabase.removeChannel(channel)
   * }
   * ```
   */
  async send(e, r = {}) {
    var n, s;
    if (!this.channelAdapter.canPush() && e.type === "broadcast") {
      console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
      const { event: i, payload: o } = e, a = {
        apikey: this.socket.apiKey ? this.socket.apiKey : "",
        "Content-Type": "application/json"
      };
      this.socket.accessTokenValue && (a.Authorization = `Bearer ${this.socket.accessTokenValue}`);
      const l = {
        method: "POST",
        headers: a,
        body: JSON.stringify({
          messages: [
            {
              topic: this.subTopic,
              event: i,
              payload: o,
              private: this.private
            }
          ]
        })
      };
      try {
        const u = await this._fetchWithTimeout(this.broadcastEndpointURL, l, (n = r.timeout) !== null && n !== void 0 ? n : this.timeout);
        return await ((s = u.body) === null || s === void 0 ? void 0 : s.cancel()), u.ok ? "ok" : "error";
      } catch (u) {
        return u instanceof Error && u.name === "AbortError" ? "timed out" : "error";
      }
    } else
      return new Promise((i) => {
        var o, a, l;
        const u = this.channelAdapter.push(e.type, e, r.timeout || this.timeout);
        e.type === "broadcast" && !(!((l = (a = (o = this.params) === null || o === void 0 ? void 0 : o.config) === null || a === void 0 ? void 0 : a.broadcast) === null || l === void 0) && l.ack) && i("ok"), u.receive("ok", () => i("ok")), u.receive("error", () => i("error")), u.receive("timeout", () => i("timed out"));
      });
  }
  /**
   * Updates the payload that will be sent the next time the channel joins (reconnects).
   * Useful for rotating access tokens or updating config without re-creating the channel.
   *
   * @category Realtime
   */
  updateJoinPayload(e) {
    this.channelAdapter.updateJoinPayload(e);
  }
  /**
   * Leaves the channel.
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   *
   * @category Realtime
   */
  async unsubscribe(e = this.timeout) {
    return new Promise((r) => {
      this.channelAdapter.unsubscribe(e).receive("ok", () => r("ok")).receive("timeout", () => r("timed out")).receive("error", () => r("error"));
    });
  }
  /**
   * Destroys and stops related timers.
   *
   * @category Realtime
   */
  teardown() {
    this.channelAdapter.teardown();
  }
  /** @internal */
  async _fetchWithTimeout(e, r, n) {
    const s = new AbortController(), i = setTimeout(() => s.abort(), n), o = await this.socket.fetch(e, Object.assign(Object.assign({}, r), { signal: s.signal }));
    return clearTimeout(i), o;
  }
  /** @internal */
  _on(e, r, n) {
    const s = e.toLocaleLowerCase(), i = r == null ? void 0 : r.filter;
    (i instanceof xm || typeof i == "object" && i !== null && typeof i.build == "function") && (r = Object.assign(Object.assign({}, r), { filter: i.build() }));
    const o = this.channelAdapter.on(e, n), a = {
      type: s,
      filter: r,
      callback: n,
      ref: o
    };
    return this.bindings[s] ? this.bindings[s].push(a) : this.bindings[s] = [a], this._updateFilterMessage(), this;
  }
  /**
   * Registers a callback that will be executed when the channel closes.
   *
   * @internal
   */
  _onClose(e) {
    this.channelAdapter.onClose(e);
  }
  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   *
   * @internal
   */
  _onError(e) {
    this.channelAdapter.onError(e);
  }
  /** @internal */
  _updateFilterMessage() {
    this.channelAdapter.updateFilterBindings((e, r, n) => {
      var s, i, o, a, l, u, c;
      const h = e.event.toLocaleLowerCase();
      if (this._notThisChannelEvent(h, n))
        return !1;
      const d = (s = this.bindings[h]) === null || s === void 0 ? void 0 : s.find((g) => g.ref === e.ref);
      if (!d)
        return !0;
      if (["broadcast", "presence", "postgres_changes"].includes(h))
        if ("id" in d) {
          const g = d.id, v = (i = d.filter) === null || i === void 0 ? void 0 : i.event;
          return g && ((o = r.ids) === null || o === void 0 ? void 0 : o.includes(g)) && (v === "*" || (v == null ? void 0 : v.toLocaleLowerCase()) === ((a = r.data) === null || a === void 0 ? void 0 : a.type.toLocaleLowerCase()));
        } else {
          const g = (u = (l = d == null ? void 0 : d.filter) === null || l === void 0 ? void 0 : l.event) === null || u === void 0 ? void 0 : u.toLocaleLowerCase();
          return g === "*" || g === ((c = r == null ? void 0 : r.event) === null || c === void 0 ? void 0 : c.toLocaleLowerCase());
        }
      else
        return d.type.toLocaleLowerCase() === h;
    });
  }
  /** @internal */
  _notThisChannelEvent(e, r) {
    const { close: n, error: s, leave: i, join: o } = zd;
    return r && [n, s, i, o].includes(e) && r !== this.joinPush.ref;
  }
  /** @internal */
  _updateFilterTransform() {
    this.channelAdapter.updatePayloadTransform((e, r, n) => {
      if (typeof r == "object" && "ids" in r) {
        const s = r.data, { schema: i, table: o, commit_timestamp: a, type: l, errors: u } = s;
        return Object.assign(Object.assign({}, {
          schema: i,
          table: o,
          commit_timestamp: a,
          eventType: l,
          new: {},
          old: {},
          errors: u
        }), this._getPayloadRecords(s));
      }
      return r;
    });
  }
  copyBindings(e) {
    if (this.joinedOnce)
      throw new Error("cannot copy bindings into joined channel");
    for (const r in e.bindings)
      for (const n of e.bindings[r])
        this._on(n.type, n.filter, n.callback);
  }
  /**
   * Compares two optional filter values for equality.
   * Treats undefined, null, and empty string as equivalent empty values.
   * @internal
   */
  static isFilterValueEqual(e, r) {
    return (e ?? void 0) === (r ?? void 0);
  }
  /** @internal */
  _getPayloadRecords(e) {
    const r = {
      new: {},
      old: {}
    };
    return (e.type === "INSERT" || e.type === "UPDATE") && (r.new = Vu(e.columns, e.record)), (e.type === "UPDATE" || e.type === "DELETE") && (r.old = Vu(e.columns, e.old_record)), r;
  }
}
class Am {
  constructor(e, r) {
    this.socket = new vm(e, r);
  }
  get timeout() {
    return this.socket.timeout;
  }
  get endPoint() {
    return this.socket.endPoint;
  }
  get transport() {
    return this.socket.transport;
  }
  get heartbeatIntervalMs() {
    return this.socket.heartbeatIntervalMs;
  }
  get heartbeatCallback() {
    return this.socket.heartbeatCallback;
  }
  set heartbeatCallback(e) {
    this.socket.heartbeatCallback = e;
  }
  get heartbeatTimer() {
    return this.socket.heartbeatTimer;
  }
  get pendingHeartbeatRef() {
    return this.socket.pendingHeartbeatRef;
  }
  get reconnectTimer() {
    return this.socket.reconnectTimer;
  }
  get vsn() {
    return this.socket.vsn;
  }
  get encode() {
    return this.socket.encode;
  }
  get decode() {
    return this.socket.decode;
  }
  get reconnectAfterMs() {
    return this.socket.reconnectAfterMs;
  }
  get sendBuffer() {
    return this.socket.sendBuffer;
  }
  get stateChangeCallbacks() {
    return this.socket.stateChangeCallbacks;
  }
  connect() {
    this.socket.connect();
  }
  disconnect(e, r, n, s = 1e4) {
    return new Promise((i) => {
      setTimeout(() => i("timeout"), s), this.socket.disconnect(() => {
        e(), i("ok");
      }, r, n);
    });
  }
  push(e) {
    this.socket.push(e);
  }
  log(e, r, n) {
    this.socket.log(e, r, n);
  }
  makeRef() {
    return this.socket.makeRef();
  }
  onOpen(e) {
    this.socket.onOpen(e);
  }
  onClose(e) {
    this.socket.onClose(e);
  }
  onError(e) {
    this.socket.onError(e);
  }
  onMessage(e) {
    this.socket.onMessage(e);
  }
  isConnected() {
    return this.socket.isConnected();
  }
  isConnecting() {
    return this.socket.connectionState() == Sa.connecting;
  }
  isDisconnecting() {
    return this.socket.connectionState() == Sa.closing;
  }
  connectionState() {
    return this.socket.connectionState();
  }
  endPointURL() {
    return this.socket.endPointURL();
  }
  sendHeartbeat() {
    this.socket.sendHeartbeat();
  }
  /**
   * @internal
   */
  getSocket() {
    return this.socket;
  }
}
const Qu = {
  HEARTBEAT_INTERVAL: 25e3
}, Pm = [1e3, 2e3, 5e3, 1e4], jm = 1e4;
function Im() {
  const t = /* @__PURE__ */ new Map();
  return {
    get length() {
      return t.size;
    },
    clear() {
      t.clear();
    },
    getItem(e) {
      return t.has(e) ? t.get(e) : null;
    },
    key(e) {
      var r;
      return (r = Array.from(t.keys())[e]) !== null && r !== void 0 ? r : null;
    },
    removeItem(e) {
      t.delete(e);
    },
    setItem(e, r) {
      t.set(e, String(r));
    }
  };
}
function Nm() {
  try {
    if (typeof globalThis < "u" && globalThis.sessionStorage)
      return globalThis.sessionStorage;
  } catch {
  }
  return Im();
}
const Lm = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
class $m {
  get endPoint() {
    return this.socketAdapter.endPoint;
  }
  get timeout() {
    return this.socketAdapter.timeout;
  }
  get transport() {
    return this.socketAdapter.transport;
  }
  get heartbeatCallback() {
    return this.socketAdapter.heartbeatCallback;
  }
  get heartbeatIntervalMs() {
    return this.socketAdapter.heartbeatIntervalMs;
  }
  get heartbeatTimer() {
    return this.worker ? this._workerHeartbeatTimer : this.socketAdapter.heartbeatTimer;
  }
  get pendingHeartbeatRef() {
    return this.worker ? this._pendingWorkerHeartbeatRef : this.socketAdapter.pendingHeartbeatRef;
  }
  get reconnectTimer() {
    return this.socketAdapter.reconnectTimer;
  }
  get vsn() {
    return this.socketAdapter.vsn;
  }
  get encode() {
    return this.socketAdapter.encode;
  }
  get decode() {
    return this.socketAdapter.decode;
  }
  get reconnectAfterMs() {
    return this.socketAdapter.reconnectAfterMs;
  }
  get sendBuffer() {
    return this.socketAdapter.sendBuffer;
  }
  get stateChangeCallbacks() {
    return this.socketAdapter.stateChangeCallbacks;
  }
  /**
   * Initializes the Socket.
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.logLevel Sets the log level for Realtime
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   * @param options.worker Use Web Worker to set a side flow. Defaults to false.
   * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
   * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
   *
   * @category Realtime
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const channel = supabase.channel('room1')
   * channel
   *   .on('broadcast', { event: 'cursor-pos' }, (payload) => console.log(payload))
   *   .subscribe()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'your-publishable-key' },
   * })
   * client.connect()
   * ```
   */
  constructor(e, r) {
    var n;
    if (this.channels = new Array(), this.accessTokenValue = null, this.accessToken = null, this.apiKey = null, this.httpEndpoint = "", this.headers = {}, this.params = {}, this.ref = 0, this.serializer = new tm(), this._manuallySetToken = !1, this._authPromise = null, this._workerHeartbeatTimer = void 0, this._pendingWorkerHeartbeatRef = null, this._pendingDisconnectTimer = null, this._disconnectOnEmptyChannelsAfterMs = 0, this._resolveFetch = (i) => i ? (...o) => i(...o) : (...o) => fetch(...o), !(!((n = r == null ? void 0 : r.params) === null || n === void 0) && n.apikey))
      throw new Error("API key is required to connect to Realtime");
    this.apiKey = r.params.apikey;
    const s = this._initializeOptions(r);
    this.socketAdapter = new Am(e, s), this.httpEndpoint = Fd(e), this.fetch = this._resolveFetch(r == null ? void 0 : r.fetch);
  }
  /**
   * Connects the socket, unless already connected.
   *
   * @category Realtime
   */
  connect() {
    if (!(this.isConnecting() || this.isDisconnecting() || this.isConnected())) {
      this.accessToken && !this._authPromise && this._setAuthSafely("connect"), this._setupConnectionHandlers();
      try {
        this.socketAdapter.connect();
      } catch (e) {
        const r = e.message;
        throw new Error(`WebSocket not available: ${r}`);
      }
      this._handleNodeJsRaceCondition();
    }
  }
  /**
   * Returns the URL of the websocket.
   * @returns string The URL of the websocket.
   *
   * @category Realtime
   */
  endpointURL() {
    return this.socketAdapter.endPointURL();
  }
  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   *
   * @category Realtime
   */
  async disconnect(e, r) {
    return this._cancelPendingDisconnect(), this.isDisconnecting() ? "ok" : await this.socketAdapter.disconnect(() => {
      clearInterval(this._workerHeartbeatTimer), this._terminateWorker();
    }, e, r);
  }
  /**
   * Returns all created channels
   *
   * @category Realtime
   */
  getChannels() {
    return this.channels;
  }
  /**
   * Unsubscribes, removes and tears down a single channel
   * @param channel A RealtimeChannel instance
   *
   * @category Realtime
   */
  async removeChannel(e) {
    const r = await e.unsubscribe();
    return r === "ok" && e.teardown(), r;
  }
  /**
   * Unsubscribes, removes and tears down all channels
   *
   * @category Realtime
   */
  async removeAllChannels() {
    const e = this.channels.map(async (n) => {
      const s = await n.unsubscribe();
      return n.teardown(), s;
    }), r = await Promise.all(e);
    return await this.disconnect(), r;
  }
  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden in Client constructor.
   *
   * @category Realtime
   */
  log(e, r, n) {
    this.socketAdapter.log(e, r, n);
  }
  /**
   * Returns the current state of the socket.
   *
   * @category Realtime
   */
  connectionState() {
    return this.socketAdapter.connectionState() || Sa.closed;
  }
  /**
   * Returns `true` is the connection is open.
   *
   * @category Realtime
   */
  isConnected() {
    return this.socketAdapter.isConnected();
  }
  /**
   * Returns `true` if the connection is currently connecting.
   *
   * @category Realtime
   */
  isConnecting() {
    return this.socketAdapter.isConnecting();
  }
  /**
   * Returns `true` if the connection is currently disconnecting.
   *
   * @category Realtime
   */
  isDisconnecting() {
    return this.socketAdapter.isDisconnecting();
  }
  /**
   * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
   *
   * Topics are automatically prefixed with `realtime:` to match the Realtime service.
   * If a channel with the same topic already exists it will be returned instead of creating
   * a duplicate connection.
   *
   * @category Realtime
   */
  channel(e, r = { config: {} }) {
    const n = `realtime:${e}`, s = this.getChannels().find((i) => i.topic === n);
    if (s)
      return s;
    {
      const i = new Tn(`realtime:${e}`, r, this);
      return this._cancelPendingDisconnect(), this.channels.push(i), i;
    }
  }
  /**
   * Push out a message if the socket is connected.
   *
   * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
   *
   * @category Realtime
   */
  push(e) {
    this.socketAdapter.push(e);
  }
  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * If param is null it will use the `accessToken` callback function or the token set on the client.
   *
   * On callback used, it will set the value of the token internal to the client.
   *
   * When a token is explicitly provided, it will be preserved across channel operations
   * (including removeChannel and resubscribe). The `accessToken` callback will not be
   * invoked until `setAuth()` is called without arguments.
   *
   * @param token A JWT string to override the token set on the client.
   *
   * @example Setting the authorization header
   * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
   * client.realtime.setAuth('my-custom-jwt')
   *
   * // Switch back to using the accessToken callback
   * client.realtime.setAuth()
   *
   * @category Realtime
   */
  async setAuth(e = null) {
    this._authPromise = this._performAuth(e);
    try {
      await this._authPromise;
    } finally {
      this._authPromise = null;
    }
  }
  /**
   * Returns true if the current access token was explicitly set via setAuth(token),
   * false if it was obtained via the accessToken callback.
   * @internal
   */
  _isManualToken() {
    return this._manuallySetToken;
  }
  /**
   * Sends a heartbeat message if the socket is connected.
   *
   * @category Realtime
   */
  async sendHeartbeat() {
    this.socketAdapter.sendHeartbeat();
  }
  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout).
   *
   * @category Realtime
   */
  onHeartbeat(e) {
    this.socketAdapter.heartbeatCallback = this._wrapHeartbeatCallback(e);
  }
  /**
   * Return the next message ref, accounting for overflows
   *
   * @internal
   */
  _makeRef() {
    return this.socketAdapter.makeRef();
  }
  /**
   * Removes a channel from RealtimeClient
   *
   * @param channel An open subscription.
   *
   * @internal
   */
  _remove(e) {
    this.channels = this.channels.filter((r) => r.topic !== e.topic), this.channels.length === 0 && (this.log("transport", "no channels remaining, scheduling disconnect"), this._schedulePendingDisconnect());
  }
  /** @internal */
  _schedulePendingDisconnect() {
    if (this._cancelPendingDisconnect(), this._disconnectOnEmptyChannelsAfterMs === 0) {
      this.log("transport", "disconnecting immediately - no channels"), this.disconnect();
      return;
    }
    this._pendingDisconnectTimer = setTimeout(() => {
      this._pendingDisconnectTimer = null, this.channels.length === 0 && (this.log("transport", "deferred disconnect fired - no channels, disconnecting"), this.disconnect());
    }, this._disconnectOnEmptyChannelsAfterMs), this.log("transport", `deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`);
  }
  /** @internal */
  _cancelPendingDisconnect() {
    this._pendingDisconnectTimer !== null && (this.log("transport", "pending disconnect cancelled - channel activity detected"), clearTimeout(this._pendingDisconnectTimer), this._pendingDisconnectTimer = null);
  }
  /**
   * Perform the actual auth operation
   * @internal
   */
  async _performAuth(e = null) {
    let r, n = !1;
    if (e)
      r = e, n = !0;
    else if (this.accessToken)
      try {
        r = await this.accessToken();
      } catch (s) {
        this.log("error", "Error fetching access token from callback", s), r = this.accessTokenValue;
      }
    else
      r = this.accessTokenValue;
    n ? this._manuallySetToken = !0 : this.accessToken && (this._manuallySetToken = !1), this.accessTokenValue != r && (this.accessTokenValue = r, this.channels.forEach((s) => {
      const i = {
        access_token: r,
        version: Qg
      };
      r && s.updateJoinPayload(i), s.joinedOnce && s.channelAdapter.isJoined() && s.channelAdapter.push(zd.access_token, {
        access_token: r
      });
    }));
  }
  /**
   * Wait for any in-flight auth operations to complete
   * @internal
   */
  async _waitForAuthIfNeeded() {
    this._authPromise && await this._authPromise;
  }
  /**
   * Safely call setAuth with standardized error handling
   * @internal
   */
  _setAuthSafely(e = "general") {
    this._isManualToken() || this.setAuth().catch((r) => {
      this.log("error", `Error setting auth in ${e}`, r);
    });
  }
  /** @internal */
  _setupConnectionHandlers() {
    this.socketAdapter.onOpen(() => {
      (this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve())).catch((r) => {
        this.log("error", "error waiting for auth on connect", r);
      }), this.worker && !this.workerRef && this._startWorkerHeartbeat();
    }), this.socketAdapter.onClose(() => {
      this.worker && this.workerRef && this._terminateWorker();
    }), this.socketAdapter.onMessage((e) => {
      e.ref && e.ref === this._pendingWorkerHeartbeatRef && (this._pendingWorkerHeartbeatRef = null);
    });
  }
  /** @internal */
  _handleNodeJsRaceCondition() {
    this.socketAdapter.isConnected() && this.socketAdapter.getSocket().onConnOpen();
  }
  /** @internal */
  _wrapHeartbeatCallback(e) {
    return (r, n) => {
      r !== "disconnected" && (r == "sent" && this._setAuthSafely(), e && e(r, n));
    };
  }
  /** @internal */
  _startWorkerHeartbeat() {
    this.workerUrl ? this.log("worker", `starting worker for from ${this.workerUrl}`) : this.log("worker", "starting default worker");
    const e = this._workerObjectUrl(this.workerUrl);
    this.workerRef = new Worker(e), this.workerRef.onerror = (r) => {
      this.log("worker", "worker error", r.message), this._terminateWorker(), this.disconnect();
    }, this.workerRef.onmessage = (r) => {
      r.data.event === "keepAlive" && this.sendHeartbeat();
    }, this.workerRef.postMessage({
      event: "start",
      interval: this.heartbeatIntervalMs
    });
  }
  /**
   * Terminate the Web Worker and clear the reference
   * @internal
   */
  _terminateWorker() {
    this.workerRef && (this.log("worker", "terminating worker"), this.workerRef.terminate(), this.workerRef = void 0);
  }
  /** @internal */
  _workerObjectUrl(e) {
    let r;
    if (e)
      r = e;
    else {
      const n = new Blob([Lm], { type: "application/javascript" });
      r = URL.createObjectURL(n);
    }
    return r;
  }
  /**
   * Initialize socket options with defaults
   * @internal
   */
  _initializeOptions(e) {
    var r, n, s, i, o, a, l, u, c, h, d, g;
    this.worker = (r = e == null ? void 0 : e.worker) !== null && r !== void 0 ? r : !1, this.accessToken = (n = e == null ? void 0 : e.accessToken) !== null && n !== void 0 ? n : null;
    const v = {};
    v.timeout = (s = e == null ? void 0 : e.timeout) !== null && s !== void 0 ? s : Zg, v.heartbeatIntervalMs = (i = e == null ? void 0 : e.heartbeatIntervalMs) !== null && i !== void 0 ? i : Qu.HEARTBEAT_INTERVAL, this._disconnectOnEmptyChannelsAfterMs = (o = e == null ? void 0 : e.disconnectOnEmptyChannelsAfterMs) !== null && o !== void 0 ? o : 2 * ((a = e == null ? void 0 : e.heartbeatIntervalMs) !== null && a !== void 0 ? a : Qu.HEARTBEAT_INTERVAL), v.transport = (l = e == null ? void 0 : e.transport) !== null && l !== void 0 ? l : Gg.getWebSocketConstructor(), v.params = e == null ? void 0 : e.params, v.logger = e == null ? void 0 : e.logger, v.heartbeatCallback = this._wrapHeartbeatCallback(e == null ? void 0 : e.heartbeatCallback), v.sessionStorage = (u = e == null ? void 0 : e.sessionStorage) !== null && u !== void 0 ? u : Nm(), v.reconnectAfterMs = (c = e == null ? void 0 : e.reconnectAfterMs) !== null && c !== void 0 ? c : (p) => Pm[p - 1] || jm;
    let y, k;
    const f = (h = e == null ? void 0 : e.vsn) !== null && h !== void 0 ? h : Xg;
    switch (f) {
      case Yg:
        y = (p, m) => m(JSON.stringify(p)), k = (p, m) => m(JSON.parse(p));
        break;
      case Md:
        y = this.serializer.encode.bind(this.serializer), k = this.serializer.decode.bind(this.serializer);
        break;
      default:
        throw new Error(`Unsupported serializer version: ${v.vsn}`);
    }
    if (v.vsn = f, v.encode = (d = e == null ? void 0 : e.encode) !== null && d !== void 0 ? d : y, v.decode = (g = e == null ? void 0 : e.decode) !== null && g !== void 0 ? g : k, v.beforeReconnect = this._reconnectAuth.bind(this), (e != null && e.logLevel || e != null && e.log_level) && (this.logLevel = e.logLevel || e.log_level, v.params = Object.assign(Object.assign({}, v.params), { log_level: this.logLevel })), this.worker) {
      if (typeof window < "u" && !window.Worker)
        throw new Error("Web Worker is not supported");
      this.workerUrl = e == null ? void 0 : e.workerUrl, v.autoSendHeartbeat = !this.worker;
    }
    return v;
  }
  /** @internal */
  async _reconnectAuth() {
    await this._waitForAuthIfNeeded(), this.isConnected() || this.connect();
  }
}
var Wn = class extends Error {
  constructor(t, e) {
    var r;
    super(t), this.name = "IcebergError", this.status = e.status, this.icebergType = e.icebergType, this.icebergCode = e.icebergCode, this.details = e.details, this.isCommitStateUnknown = e.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(e.status) && ((r = e.icebergType) == null ? void 0 : r.includes("CommitState")) === !0;
  }
  /**
   * Returns true if the error is a 404 Not Found error.
   */
  isNotFound() {
    return this.status === 404;
  }
  /**
   * Returns true if the error is a 409 Conflict error.
   */
  isConflict() {
    return this.status === 409;
  }
  /**
   * Returns true if the error is a 419 Authentication Timeout error.
   */
  isAuthenticationTimeout() {
    return this.status === 419;
  }
};
function Um(t, e, r) {
  const n = new URL(e, t);
  if (r)
    for (const [s, i] of Object.entries(r))
      i !== void 0 && n.searchParams.set(s, i);
  return n.toString();
}
async function Dm(t) {
  return !t || t.type === "none" ? {} : t.type === "bearer" ? { Authorization: `Bearer ${t.token}` } : t.type === "header" ? { [t.name]: t.value } : t.type === "custom" ? await t.getHeaders() : {};
}
function Mm(t) {
  const e = t.fetchImpl ?? globalThis.fetch;
  return {
    async request({
      method: r,
      path: n,
      query: s,
      body: i,
      headers: o
    }) {
      const a = Um(t.baseUrl, n, s), l = await Dm(t.auth), u = await e(a, {
        method: r,
        headers: {
          ...i ? { "Content-Type": "application/json" } : {},
          ...l,
          ...o
        },
        body: i ? JSON.stringify(i) : void 0
      }), c = await u.text(), h = (u.headers.get("content-type") || "").includes("application/json"), d = h && c ? JSON.parse(c) : c;
      if (!u.ok) {
        const g = h ? d : void 0, v = g == null ? void 0 : g.error;
        throw new Wn(
          (v == null ? void 0 : v.message) ?? `Request failed with status ${u.status}`,
          {
            status: u.status,
            icebergType: v == null ? void 0 : v.type,
            icebergCode: v == null ? void 0 : v.code,
            details: g
          }
        );
      }
      return { status: u.status, headers: u.headers, data: d };
    }
  };
}
function Rs(t) {
  return t.join("");
}
var zm = class {
  constructor(t, e = "") {
    this.client = t, this.prefix = e;
  }
  async listNamespaces(t) {
    const e = t ? { parent: Rs(t.namespace) } : void 0;
    return (await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces`,
      query: e
    })).data.namespaces.map((n) => ({ namespace: n }));
  }
  async createNamespace(t, e) {
    const r = {
      namespace: t.namespace,
      properties: e == null ? void 0 : e.properties
    };
    return (await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces`,
      body: r
    })).data;
  }
  async dropNamespace(t) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${Rs(t.namespace)}`
    });
  }
  async loadNamespaceMetadata(t) {
    return {
      properties: (await this.client.request({
        method: "GET",
        path: `${this.prefix}/namespaces/${Rs(t.namespace)}`
      })).data.properties
    };
  }
  async namespaceExists(t) {
    try {
      return await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${Rs(t.namespace)}`
      }), !0;
    } catch (e) {
      if (e instanceof Wn && e.status === 404)
        return !1;
      throw e;
    }
  }
  async createNamespaceIfNotExists(t, e) {
    try {
      return await this.createNamespace(t, e);
    } catch (r) {
      if (r instanceof Wn && r.status === 409)
        return;
      throw r;
    }
  }
};
function dr(t) {
  return t.join("");
}
var Bm = class {
  constructor(t, e = "", r) {
    this.client = t, this.prefix = e, this.accessDelegation = r;
  }
  async listTables(t) {
    return (await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${dr(t.namespace)}/tables`
    })).data.identifiers;
  }
  async createTable(t, e) {
    const r = {};
    return this.accessDelegation && (r["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${dr(t.namespace)}/tables`,
      body: e,
      headers: r
    })).data.metadata;
  }
  async updateTable(t, e) {
    const r = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${dr(t.namespace)}/tables/${t.name}`,
      body: e
    });
    return {
      "metadata-location": r.data["metadata-location"],
      metadata: r.data.metadata
    };
  }
  async dropTable(t, e) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${dr(t.namespace)}/tables/${t.name}`,
      query: { purgeRequested: String((e == null ? void 0 : e.purge) ?? !1) }
    });
  }
  async loadTable(t) {
    const e = {};
    return this.accessDelegation && (e["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${dr(t.namespace)}/tables/${t.name}`,
      headers: e
    })).data.metadata;
  }
  async tableExists(t) {
    const e = {};
    this.accessDelegation && (e["X-Iceberg-Access-Delegation"] = this.accessDelegation);
    try {
      return await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${dr(t.namespace)}/tables/${t.name}`,
        headers: e
      }), !0;
    } catch (r) {
      if (r instanceof Wn && r.status === 404)
        return !1;
      throw r;
    }
  }
  async createTableIfNotExists(t, e) {
    try {
      return await this.createTable(t, e);
    } catch (r) {
      if (r instanceof Wn && r.status === 409)
        return await this.loadTable({ namespace: t.namespace, name: e.name });
      throw r;
    }
  }
}, Fm = class {
  /**
   * Creates a new Iceberg REST Catalog client.
   *
   * @param options - Configuration options for the catalog client
   */
  constructor(t) {
    var n;
    let e = "v1";
    t.catalogName && (e += `/${t.catalogName}`);
    const r = t.baseUrl.endsWith("/") ? t.baseUrl : `${t.baseUrl}/`;
    this.client = Mm({
      baseUrl: r,
      auth: t.auth,
      fetchImpl: t.fetch
    }), this.accessDelegation = (n = t.accessDelegation) == null ? void 0 : n.join(","), this.namespaceOps = new zm(this.client, e), this.tableOps = new Bm(this.client, e, this.accessDelegation);
  }
  /**
   * Lists all namespaces in the catalog.
   *
   * @param parent - Optional parent namespace to list children under
   * @returns Array of namespace identifiers
   *
   * @example
   * ```typescript
   * // List all top-level namespaces
   * const namespaces = await catalog.listNamespaces();
   *
   * // List namespaces under a parent
   * const children = await catalog.listNamespaces({ namespace: ['analytics'] });
   * ```
   */
  async listNamespaces(t) {
    return this.namespaceOps.listNamespaces(t);
  }
  /**
   * Creates a new namespace in the catalog.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespace(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * console.log(response.namespace); // ['analytics']
   * console.log(response.properties); // { owner: 'data-team', ... }
   * ```
   */
  async createNamespace(t, e) {
    return this.namespaceOps.createNamespace(t, e);
  }
  /**
   * Drops a namespace from the catalog.
   *
   * The namespace must be empty (contain no tables) before it can be dropped.
   *
   * @param id - Namespace identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropNamespace({ namespace: ['analytics'] });
   * ```
   */
  async dropNamespace(t) {
    await this.namespaceOps.dropNamespace(t);
  }
  /**
   * Loads metadata for a namespace.
   *
   * @param id - Namespace identifier to load
   * @returns Namespace metadata including properties
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadNamespaceMetadata({ namespace: ['analytics'] });
   * console.log(metadata.properties);
   * ```
   */
  async loadNamespaceMetadata(t) {
    return this.namespaceOps.loadNamespaceMetadata(t);
  }
  /**
   * Lists all tables in a namespace.
   *
   * @param namespace - Namespace identifier to list tables from
   * @returns Array of table identifiers
   *
   * @example
   * ```typescript
   * const tables = await catalog.listTables({ namespace: ['analytics'] });
   * console.log(tables); // [{ namespace: ['analytics'], name: 'events' }, ...]
   * ```
   */
  async listTables(t) {
    return this.tableOps.listTables(t);
  }
  /**
   * Creates a new table in the catalog.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTable(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     },
   *     'partition-spec': {
   *       'spec-id': 0,
   *       fields: [
   *         { source_id: 2, field_id: 1000, name: 'ts_day', transform: 'day' }
   *       ]
   *     }
   *   }
   * );
   * ```
   */
  async createTable(t, e) {
    return this.tableOps.createTable(t, e);
  }
  /**
   * Updates an existing table's metadata.
   *
   * Can update the schema, partition spec, or properties of a table.
   *
   * @param id - Table identifier to update
   * @param request - Update request with fields to modify
   * @returns Response containing the metadata location and updated table metadata
   *
   * @example
   * ```typescript
   * const response = await catalog.updateTable(
   *   { namespace: ['analytics'], name: 'events' },
   *   {
   *     properties: { 'read.split.target-size': '134217728' }
   *   }
   * );
   * console.log(response['metadata-location']); // s3://...
   * console.log(response.metadata); // TableMetadata object
   * ```
   */
  async updateTable(t, e) {
    return this.tableOps.updateTable(t, e);
  }
  /**
   * Drops a table from the catalog.
   *
   * @param id - Table identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropTable({ namespace: ['analytics'], name: 'events' });
   * ```
   */
  async dropTable(t, e) {
    await this.tableOps.dropTable(t, e);
  }
  /**
   * Loads metadata for a table.
   *
   * @param id - Table identifier to load
   * @returns Table metadata including schema, partition spec, location, etc.
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadTable({ namespace: ['analytics'], name: 'events' });
   * console.log(metadata.schema);
   * console.log(metadata.location);
   * ```
   */
  async loadTable(t) {
    return this.tableOps.loadTable(t);
  }
  /**
   * Checks if a namespace exists in the catalog.
   *
   * @param id - Namespace identifier to check
   * @returns True if the namespace exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.namespaceExists({ namespace: ['analytics'] });
   * console.log(exists); // true or false
   * ```
   */
  async namespaceExists(t) {
    return this.namespaceOps.namespaceExists(t);
  }
  /**
   * Checks if a table exists in the catalog.
   *
   * @param id - Table identifier to check
   * @returns True if the table exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.tableExists({ namespace: ['analytics'], name: 'events' });
   * console.log(exists); // true or false
   * ```
   */
  async tableExists(t) {
    return this.tableOps.tableExists(t);
  }
  /**
   * Creates a namespace if it does not exist.
   *
   * If the namespace already exists, returns void. If created, returns the response.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties, or void if it already exists
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespaceIfNotExists(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * if (response) {
   *   console.log('Created:', response.namespace);
   * } else {
   *   console.log('Already exists');
   * }
   * ```
   */
  async createNamespaceIfNotExists(t, e) {
    return this.namespaceOps.createNamespaceIfNotExists(t, e);
  }
  /**
   * Creates a table if it does not exist.
   *
   * If the table already exists, returns its metadata instead.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created or existing table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTableIfNotExists(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     }
   *   }
   * );
   * ```
   */
  async createTableIfNotExists(t, e) {
    return this.tableOps.createTableIfNotExists(t, e);
  }
};
function Vn(t) {
  "@babel/helpers - typeof";
  return Vn = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
    return typeof e;
  } : function(e) {
    return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
  }, Vn(t);
}
function Hm(t, e) {
  if (Vn(t) != "object" || !t) return t;
  var r = t[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(t, e);
    if (Vn(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function Wm(t) {
  var e = Hm(t, "string");
  return Vn(e) == "symbol" ? e : e + "";
}
function Vm(t, e, r) {
  return (e = Wm(e)) in t ? Object.defineProperty(t, e, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : t[e] = r, t;
}
function Yu(t, e) {
  var r = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(t);
    e && (n = n.filter(function(s) {
      return Object.getOwnPropertyDescriptor(t, s).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function P(t) {
  for (var e = 1; e < arguments.length; e++) {
    var r = arguments[e] != null ? arguments[e] : {};
    e % 2 ? Yu(Object(r), !0).forEach(function(n) {
      Vm(t, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : Yu(Object(r)).forEach(function(n) {
      Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return t;
}
var Hi = class extends Error {
  constructor(t, e = "storage", r, n) {
    super(t), this.__isStorageError = !0, this.namespace = e, this.name = e === "vectors" ? "StorageVectorsError" : "StorageError", this.status = r, this.statusCode = n;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode
    };
  }
};
function Wi(t) {
  return typeof t == "object" && t !== null && "__isStorageError" in t;
}
var Ca = class extends Hi {
  constructor(t, e, r, n = "storage") {
    super(t, n, e, r), this.name = n === "vectors" ? "StorageVectorsApiError" : "StorageApiError", this.status = e, this.statusCode = r;
  }
  toJSON() {
    return P({}, super.toJSON());
  }
}, Wd = class extends Hi {
  constructor(t, e, r = "storage") {
    super(t, r), this.name = r === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError", this.originalError = e;
  }
};
function yi(t, e, r) {
  const n = P({}, t), s = e.toLowerCase();
  for (const i of Object.keys(n)) i.toLowerCase() === s && delete n[i];
  return n[s] = r, n;
}
function Km(t) {
  const e = {};
  for (const [r, n] of Object.entries(t)) e[r.toLowerCase()] = n;
  return e;
}
const qm = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e), Gm = (t) => {
  if (typeof t != "object" || t === null) return !1;
  const e = Object.getPrototypeOf(t);
  return (e === null || e === Object.prototype || Object.getPrototypeOf(e) === null) && !(Symbol.toStringTag in t) && !(Symbol.iterator in t);
}, Ra = (t) => {
  if (Array.isArray(t)) return t.map((r) => Ra(r));
  if (typeof t == "function" || t !== Object(t)) return t;
  const e = {};
  return Object.entries(t).forEach(([r, n]) => {
    const s = r.replace(/([-_][a-z])/gi, (i) => i.toUpperCase().replace(/[-_]/g, ""));
    e[s] = Ra(n);
  }), e;
}, Jm = (t) => !t || typeof t != "string" || t.length === 0 || t.length > 100 || t.trim() !== t || t.includes("/") || t.includes("\\") ? !1 : /^[\w!.\*'() &$@=;:+,?-]+$/.test(t), Vd = (t) => t.split("/").map(encodeURIComponent).join("/"), Xu = (t) => {
  if (typeof t == "object" && t !== null) {
    const e = t;
    if (typeof e.msg == "string") return e.msg;
    if (typeof e.message == "string") return e.message;
    if (typeof e.error_description == "string") return e.error_description;
    if (typeof e.error == "string") return e.error;
    if (typeof e.error == "object" && e.error !== null) {
      const r = e.error;
      if (typeof r.message == "string") return r.message;
    }
  }
  return JSON.stringify(t);
}, Qm = async (t, e, r, n) => {
  if (t !== null && typeof t == "object" && "json" in t && typeof t.json == "function") {
    const s = t;
    let i = parseInt(String(s.status), 10);
    Number.isFinite(i) || (i = 500), s.json().then((o) => {
      const a = (o == null ? void 0 : o.statusCode) || (o == null ? void 0 : o.code) || i + "";
      e(new Ca(Xu(o), i, a, n));
    }).catch(() => {
      const o = i + "";
      e(new Ca(s.statusText || `HTTP ${i} error`, i, o, n));
    });
  } else e(new Wd(Xu(t), t, n));
}, Ym = (t, e, r, n) => {
  const s = {
    method: t,
    headers: (e == null ? void 0 : e.headers) || {}
  };
  if (t === "GET" || t === "HEAD" || !n) return P(P({}, s), r);
  if (Gm(n)) {
    var i;
    const o = (e == null ? void 0 : e.headers) || {};
    let a;
    for (const [l, u] of Object.entries(o)) l.toLowerCase() === "content-type" && (a = u);
    s.headers = yi(o, "Content-Type", (i = a) !== null && i !== void 0 ? i : "application/json"), s.body = JSON.stringify(n);
  } else s.body = n;
  return e != null && e.duplex && (s.duplex = e.duplex), P(P({}, s), r);
};
async function an(t, e, r, n, s, i, o) {
  return new Promise((a, l) => {
    t(r, Ym(e, n, s, i)).then((u) => {
      if (!u.ok) throw u;
      if (n != null && n.noResolveJson) return u;
      if (o === "vectors") {
        const c = u.headers.get("content-type");
        if (u.headers.get("content-length") === "0" || u.status === 204) return {};
        if (!c || !c.includes("application/json")) return {};
      }
      return u.json();
    }).then((u) => a(u)).catch((u) => Qm(u, l, n, o));
  });
}
function Kd(t = "storage") {
  return {
    get: async (e, r, n, s) => an(e, "GET", r, n, s, void 0, t),
    post: async (e, r, n, s, i) => an(e, "POST", r, s, i, n, t),
    put: async (e, r, n, s, i) => an(e, "PUT", r, s, i, n, t),
    head: async (e, r, n, s) => an(e, "HEAD", r, P(P({}, n), {}, { noResolveJson: !0 }), s, void 0, t),
    remove: async (e, r, n, s, i) => an(e, "DELETE", r, s, i, n, t)
  };
}
const Xm = Kd("storage"), { get: Kn, post: Ve, put: Oa, head: Zm, remove: qn } = Xm, Re = Kd("vectors");
var Jr = class {
  /**
  * Creates a new BaseApiClient instance
  * @param url - Base URL for API requests
  * @param headers - Default headers for API requests
  * @param fetch - Optional custom fetch implementation
  * @param namespace - Error namespace ('storage' or 'vectors')
  */
  constructor(t, e = {}, r, n = "storage") {
    this.shouldThrowOnError = !1, this.url = t, this.headers = Km(e), this.fetch = qm(r), this.namespace = n;
  }
  /**
  * Enable throwing errors instead of returning them.
  * When enabled, errors are thrown instead of returned in { data, error } format.
  *
  * @returns this - For method chaining
  */
  throwOnError() {
    return this.shouldThrowOnError = !0, this;
  }
  /**
  * Set an HTTP header for the request.
  * Creates a shallow copy of headers to avoid mutating shared state.
  *
  * @param name - Header name
  * @param value - Header value
  * @returns this - For method chaining
  */
  setHeader(t, e) {
    return this.headers = yi(this.headers, t, e), this;
  }
  /**
  * Handles API operation with standardized error handling
  * Eliminates repetitive try-catch blocks across all API methods
  *
  * This wrapper:
  * 1. Executes the operation
  * 2. Returns { data, error: null } on success
  * 3. Returns { data: null, error } on failure (if shouldThrowOnError is false)
  * 4. Throws error on failure (if shouldThrowOnError is true)
  *
  * @typeParam T - The expected data type from the operation
  * @param operation - Async function that performs the API call
  * @returns Promise with { data, error } tuple
  *
  * @example Handling an operation
  * ```typescript
  * async listBuckets() {
  *   return this.handleOperation(async () => {
  *     return await get(this.fetch, `${this.url}/bucket`, {
  *       headers: this.headers,
  *     })
  *   })
  * }
  * ```
  */
  async handleOperation(t) {
    var e = this;
    try {
      return {
        data: await t(),
        error: null
      };
    } catch (r) {
      if (e.shouldThrowOnError) throw r;
      if (Wi(r)) return {
        data: null,
        error: r
      };
      throw r;
    }
  }
};
let qd;
qd = Symbol.toStringTag;
var ev = class {
  constructor(t, e) {
    this.downloadFn = t, this.shouldThrowOnError = e, this[qd] = "StreamDownloadBuilder", this.promise = null;
  }
  then(t, e) {
    return this.getPromise().then(t, e);
  }
  catch(t) {
    return this.getPromise().catch(t);
  }
  finally(t) {
    return this.getPromise().finally(t);
  }
  getPromise() {
    return this.promise || (this.promise = this.execute()), this.promise;
  }
  async execute() {
    var t = this;
    try {
      return {
        data: (await t.downloadFn()).body,
        error: null
      };
    } catch (e) {
      if (t.shouldThrowOnError) throw e;
      if (Wi(e)) return {
        data: null,
        error: e
      };
      throw e;
    }
  }
};
let Gd;
Gd = Symbol.toStringTag;
var tv = class {
  constructor(t, e) {
    this.downloadFn = t, this.shouldThrowOnError = e, this[Gd] = "BlobDownloadBuilder", this.promise = null;
  }
  asStream() {
    return new ev(this.downloadFn, this.shouldThrowOnError);
  }
  then(t, e) {
    return this.getPromise().then(t, e);
  }
  catch(t) {
    return this.getPromise().catch(t);
  }
  finally(t) {
    return this.getPromise().finally(t);
  }
  getPromise() {
    return this.promise || (this.promise = this.execute()), this.promise;
  }
  async execute() {
    var t = this;
    try {
      return {
        data: await (await t.downloadFn()).blob(),
        error: null
      };
    } catch (e) {
      if (t.shouldThrowOnError) throw e;
      if (Wi(e)) return {
        data: null,
        error: e
      };
      throw e;
    }
  }
};
const So = {
  limit: 100,
  offset: 0,
  sortBy: {
    column: "name",
    order: "asc"
  }
}, Zu = {
  cacheControl: "3600",
  contentType: "text/plain;charset=UTF-8",
  upsert: !1
};
var rv = class extends Jr {
  constructor(t, e = {}, r, n) {
    super(t, e, n, "storage"), this.bucketId = r;
  }
  /**
  * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
  *
  * @param method HTTP method.
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  */
  async uploadOrUpdate(t, e, r, n) {
    var s = this;
    return s.handleOperation(async () => {
      let i;
      const o = P(P({}, Zu), n);
      let a = P(P({}, s.headers), t === "POST" && { "x-upsert": String(o.upsert) });
      const l = o.metadata;
      if (typeof Blob < "u" && r instanceof Blob ? (i = new FormData(), i.append("cacheControl", o.cacheControl), l && i.append("metadata", s.encodeMetadata(l)), i.append("", r)) : typeof FormData < "u" && r instanceof FormData ? (i = r, i.has("cacheControl") || i.append("cacheControl", o.cacheControl), l && !i.has("metadata") && i.append("metadata", s.encodeMetadata(l))) : (i = r, a["cache-control"] = `max-age=${o.cacheControl}`, a["content-type"] = o.contentType, l && (a["x-metadata"] = s.toBase64(s.encodeMetadata(l))), (typeof ReadableStream < "u" && i instanceof ReadableStream || i && typeof i == "object" && "pipe" in i && typeof i.pipe == "function") && !o.duplex && (o.duplex = "half")), n != null && n.headers) for (const [d, g] of Object.entries(n.headers)) a = yi(a, d, g);
      const u = s._removeEmptyFolders(e), c = s._getFinalPath(u), h = await (t == "PUT" ? Oa : Ve)(s.fetch, `${s.url}/object/${c}`, i, P({ headers: a }, o != null && o.duplex ? { duplex: o.duplex } : {}));
      return {
        path: u,
        id: h.Id,
        fullPath: h.Key
      };
    });
  }
  /**
  * Uploads a file to an existing bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Upload file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: false
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Upload file using `ArrayBuffer` from base64 file data
  * ```js
  * import { decode } from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  *
  * @example Handling errors
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', avatarFile)
  *
  * if (error) {
  *   // Log the full error so fields like `statusCode` and `error` (the
  *   // Storage error name, e.g. "Duplicate") aren't hidden behind `error.message`.
  *   console.error(error)
  *   return
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: only `insert` when you are uploading new files and `select`, `insert` and `update` when you are upserting files
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  * - For React Native, using either `Blob`, `File` or `FormData` does not work as intended. Upload file using `ArrayBuffer` from base64 file data instead, see example below.
  */
  async upload(t, e, r) {
    return this.uploadOrUpdate("POST", t, e, r);
  }
  /**
  * Upload a file with a token generated from `createSignedUploadUrl`.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param token The token generated from `createSignedUploadUrl`
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions HTTP headers (cacheControl, contentType, etc.).
  * **Note:** The `upsert` option has no effect here. To enable upsert behavior,
  * pass `{ upsert: true }` when calling `createSignedUploadUrl()` instead.
  * @returns Promise with response containing file path and fullPath or error
  *
  * @example Upload to a signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .uploadToSignedUrl('folder/cat.jpg', 'token-from-createSignedUploadUrl', file)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "folder/cat.jpg",
  *     "fullPath": "avatars/folder/cat.jpg"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async uploadToSignedUrl(t, e, r, n) {
    var s = this;
    const i = s._removeEmptyFolders(t), o = s._getFinalPath(i), a = new URL(s.url + `/object/upload/sign/${o}`);
    return a.searchParams.set("token", e), s.handleOperation(async () => {
      let l;
      const u = P(P({}, Zu), n);
      let c = P(P({}, s.headers), { "x-upsert": String(u.upsert) });
      const h = u.metadata;
      if (typeof Blob < "u" && r instanceof Blob ? (l = new FormData(), l.append("cacheControl", u.cacheControl), h && l.append("metadata", s.encodeMetadata(h)), l.append("", r)) : typeof FormData < "u" && r instanceof FormData ? (l = r, l.has("cacheControl") || l.append("cacheControl", u.cacheControl), h && !l.has("metadata") && l.append("metadata", s.encodeMetadata(h))) : (l = r, c["cache-control"] = `max-age=${u.cacheControl}`, c["content-type"] = u.contentType, h && (c["x-metadata"] = s.toBase64(s.encodeMetadata(h))), (typeof ReadableStream < "u" && l instanceof ReadableStream || l && typeof l == "object" && "pipe" in l && typeof l.pipe == "function") && !u.duplex && (u.duplex = "half")), n != null && n.headers) for (const [d, g] of Object.entries(n.headers)) c = yi(c, d, g);
      return {
        path: i,
        fullPath: (await Oa(s.fetch, a.toString(), l, P({ headers: c }, u != null && u.duplex ? { duplex: u.duplex } : {}))).Key
      };
    });
  }
  /**
  * Creates a signed upload URL.
  * Signed upload URLs can be used to upload files to the bucket without further authentication.
  * They are valid for 2 hours.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param options.upsert If set to true, allows the file to be overwritten if it already exists.
  * @returns Promise with response containing signed upload URL, token, and path or error
  *
  * @example Create Signed Upload URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUploadUrl('folder/cat.jpg')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/upload/sign/avatars/folder/cat.jpg?token=<TOKEN>",
  *     "path": "folder/cat.jpg",
  *     "token": "<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `insert`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createSignedUploadUrl(t, e) {
    var r = this;
    return r.handleOperation(async () => {
      let n = r._getFinalPath(t);
      const s = P({}, r.headers);
      e != null && e.upsert && (s["x-upsert"] = "true");
      const i = await Ve(r.fetch, `${r.url}/object/upload/sign/${n}`, {}, { headers: s }), o = new URL(r.url + i.url), a = o.searchParams.get("token");
      if (!a) throw new Hi("No token returned by API");
      return {
        signedUrl: o.toString(),
        path: t,
        token: a
      };
    });
  }
  /**
  * Replaces an existing file at the specified path with a new one.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, and metadata.
  * **Note:** The `upsert` option has no effect here. `update()` always replaces the
  * file at the given path, so the `x-upsert` header is not sent. To control upsert
  * behavior, use `upload()` instead.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Update file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600'
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Update file using `ArrayBuffer` from base64 file data
  * ```js
  * import {decode} from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `update` and `select`
  * - `update()` always replaces the file at the given path regardless of the `upsert` option.
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  * - For React Native, using either `Blob`, `File` or `FormData` does not work as intended. Update file using `ArrayBuffer` from base64 file data instead, see example below.
  */
  async update(t, e, r) {
    return this.uploadOrUpdate("PUT", t, e, r);
  }
  /**
  * Moves an existing file to a new path in the same bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
  * @param options The destination options.
  * @returns Promise with response containing success message or error
  *
  * @example Move file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .move('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully moved"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `update` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async move(t, e, r) {
    var n = this;
    return n.handleOperation(async () => await Ve(n.fetch, `${n.url}/object/move`, {
      bucketId: n.bucketId,
      sourceKey: t,
      destinationKey: e,
      destinationBucket: r == null ? void 0 : r.destinationBucket
    }, { headers: n.headers }));
  }
  /**
  * Copies an existing file to a new path in the same bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
  * @param options The destination options.
  * @returns Promise with response containing copied file path or error
  *
  * @example Copy file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .copy('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "avatars/private/avatar2.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `insert` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async copy(t, e, r) {
    var n = this;
    return n.handleOperation(async () => ({ path: (await Ve(n.fetch, `${n.url}/object/copy`, {
      bucketId: n.bucketId,
      sourceKey: t,
      destinationKey: e,
      destinationBucket: r == null ? void 0 : r.destinationBucket
    }, { headers: n.headers })).Key }));
  }
  /**
  * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @returns Promise with response containing signed URL or error
  *
  * @example Create Signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Create a signed URL for an asset with transformations
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Create a signed URL which triggers the download of the asset
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     download: true,
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createSignedUrl(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      let s = n._getFinalPath(t);
      const i = typeof (r == null ? void 0 : r.transform) == "object" && r.transform !== null && Object.keys(r.transform).length > 0;
      let o = await Ve(n.fetch, `${n.url}/object/sign/${s}`, P({ expiresIn: e }, i ? { transform: r.transform } : {}), { headers: n.headers });
      const a = new URLSearchParams();
      r != null && r.download && a.set("download", r.download === !0 ? "" : r.download), (r == null ? void 0 : r.cacheNonce) != null && a.set("cacheNonce", String(r.cacheNonce));
      const l = a.toString();
      return { signedUrl: encodeURI(`${n.url}${o.signedURL}${l ? `&${l}` : ""}`) };
    });
  }
  /**
  * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
  * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @returns Promise with response containing array of objects with signedUrl, path, and error or error
  *
  * @example Create Signed URLs
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrls(['folder/avatar1.png', 'folder/avatar2.png'], 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "error": null,
  *       "path": "folder/avatar1.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar1.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *     },
  *     {
  *       "error": null,
  *       "path": "folder/avatar2.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar2.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar2.png?token=<TOKEN>"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createSignedUrls(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      const s = await Ve(n.fetch, `${n.url}/object/sign/${n.bucketId}`, {
        expiresIn: e,
        paths: t
      }, { headers: n.headers }), i = new URLSearchParams();
      r != null && r.download && i.set("download", r.download === !0 ? "" : r.download), (r == null ? void 0 : r.cacheNonce) != null && i.set("cacheNonce", String(r.cacheNonce));
      const o = i.toString();
      return s.map((a) => P(P({}, a), {}, { signedUrl: a.signedURL ? encodeURI(`${n.url}${a.signedURL}${o ? `&${o}` : ""}`) : null }));
    });
  }
  /**
  * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
  * @param options Optional settings: `transform` to transform the asset before serving it to the client, and `cacheNonce` to append a cache nonce parameter to the URL to invalidate the cache.
  * @param parameters Additional fetch parameters like signal for cancellation. Supports standard fetch options including cache control.
  * @returns BlobDownloadBuilder instance for downloading the file
  *
  * @example Download file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": <BLOB>,
  *   "error": null
  * }
  * ```
  *
  * @example Download file with transformations
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *       quality: 80
  *     }
  *   })
  * ```
  *
  * @example Download with cache control (useful in Edge Functions)
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { cache: 'no-store' })
  * ```
  *
  * @example Download with abort signal
  * ```js
  * const controller = new AbortController()
  * setTimeout(() => controller.abort(), 5000)
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { signal: controller.signal })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  download(t, e, r) {
    const n = typeof (e == null ? void 0 : e.transform) == "object" && e.transform !== null && Object.keys(e.transform).length > 0 ? "render/image/authenticated" : "object", s = new URLSearchParams();
    e != null && e.transform && this.applyTransformOptsToQuery(s, e.transform), (e == null ? void 0 : e.cacheNonce) != null && s.set("cacheNonce", String(e.cacheNonce));
    const i = s.toString(), o = this._getFinalPath(t), a = () => Kn(this.fetch, `${this.url}/${n}/${o}${i ? `?${i}` : ""}`, {
      headers: this.headers,
      noResolveJson: !0
    }, r);
    return new tv(a, this.shouldThrowOnError);
  }
  /**
  * Retrieves the details of an existing file.
  *
  * Returns detailed file metadata including size, content type, and timestamps.
  * Note: The API returns `last_modified` field, not `updated_at`.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing file metadata or error
  *
  * @example Get file info
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .info('folder/avatar1.png')
  *
  * if (data) {
  *   console.log('Last modified:', data.lastModified)
  *   console.log('Size:', data.size)
  * }
  * ```
  */
  async info(t) {
    var e = this;
    const r = e._getFinalPath(t);
    return e.handleOperation(async () => Ra(await Kn(e.fetch, `${e.url}/object/info/${r}`, { headers: e.headers })));
  }
  /**
  * Checks the existence of a file.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing boolean indicating file existence or error
  *
  * @example Check file existence
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .exists('folder/avatar1.png')
  * ```
  */
  async exists(t) {
    var e = this;
    const r = e._getFinalPath(t);
    try {
      return await Zm(e.fetch, `${e.url}/object/${r}`, { headers: e.headers }), {
        data: !0,
        error: null
      };
    } catch (s) {
      if (e.shouldThrowOnError) throw s;
      if (Wi(s)) {
        var n;
        const i = s instanceof Ca ? s.status : s instanceof Wd ? (n = s.originalError) === null || n === void 0 ? void 0 : n.status : void 0;
        if (i !== void 0 && [400, 404].includes(i)) return {
          data: !1,
          error: s
        };
      }
      throw s;
    }
  }
  /**
  * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
  * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
  * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @param options.cacheNonce Append a cache nonce parameter to the URL to invalidate the cache.
  * @returns Object with public URL
  *
  * @example Returns the URL for an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "publicUrl": "https://example.supabase.co/storage/v1/object/public/public-bucket/folder/avatar1.png"
  *   }
  * }
  * ```
  *
  * @example Returns the URL for an asset in a public bucket with transformations
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Returns the URL which triggers the download of an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     download: true,
  *   })
  * ```
  *
  * @remarks
  * - The bucket needs to be set to public, either via [updateBucket()](/docs/reference/javascript/storage-updatebucket) or by going to Storage on [supabase.com/dashboard](https://supabase.com/dashboard), clicking the overflow menu on a bucket and choosing "Make public"
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  getPublicUrl(t, e) {
    const r = this._getFinalPath(t), n = new URLSearchParams();
    e != null && e.download && n.set("download", e.download === !0 ? "" : e.download), e != null && e.transform && this.applyTransformOptsToQuery(n, e.transform), (e == null ? void 0 : e.cacheNonce) != null && n.set("cacheNonce", String(e.cacheNonce));
    const s = n.toString(), i = typeof (e == null ? void 0 : e.transform) == "object" && e.transform !== null && Object.keys(e.transform).length > 0 ? "render/image" : "object";
    return { data: { publicUrl: encodeURI(`${this.url}/${i}/public/${r}`) + (s ? `?${s}` : "") } };
  }
  /**
  * Deletes files within the same bucket
  *
  * Returns an array of FileObject entries for the deleted files. Note that deprecated
  * fields like `bucket_id` may or may not be present in the response - do not rely on them.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
  * @returns Promise with response containing array of deleted file objects or error
  *
  * @example Delete file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .remove(['folder/avatar1.png'])
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [],
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `delete` and `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async remove(t) {
    var e = this;
    return e.handleOperation(async () => await qn(e.fetch, `${e.url}/object/${e.bucketId}`, { prefixes: t }, { headers: e.headers }));
  }
  /**
  * Purges the CDN cache for a single object in this bucket.
  *
  * Maps to `DELETE /cdn/{bucket}/{path}` on the Storage API. The server
  * issues a CDN invalidation for the object and returns `{ message: 'success' }`.
  *
  * **Requires the `service_role` key.** The underlying endpoint enforces
  * `service_role` JWT — calls made with the anon key or a user JWT will be
  * rejected by the server.
  *
  * **Hosted CDN feature.** On self-hosted Supabase, the Storage service must
  * have `CDN_PURGE_ENDPOINT_URL` configured and the `purgeCache` tenant
  * feature enabled, otherwise the server returns an error.
  *
  * Operates on a single object path. There is no wildcard or recursion: pass
  * the exact path of the object you want invalidated.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The path (relative to the bucket) of the object to purge, e.g. `folder/avatar.png`.
  * @param options Optional purge cache options.
  * @param options.transformations If true, purges only transformations (resized/formatted variants), leaving the original cached file intact.
  * @param parameters Optional fetch parameters such as an `AbortController` signal.
  * @returns Promise with `{ data: { message }, error: null }` on success or `{ data: null, error }` on failure.
  *
  * @example Purge a single cached object
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .purgeCache('folder/avatar1.png')
  * ```
  *
  * @example Purge only transformations for a single object
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .purgeCache('folder/avatar1.png', { transformations: true })
  * ```
  */
  async purgeCache(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      const s = Vd(n._getFinalPath(t)), i = new URLSearchParams();
      e != null && e.transformations && i.set("transformations", "true");
      const o = i.toString();
      return await qn(n.fetch, `${n.url}/cdn/${s}${o ? `?${o}` : ""}`, {}, { headers: n.headers }, r);
    });
  }
  /**
  * Get file metadata
  * @param id the file id to retrieve metadata
  */
  /**
  * Update file metadata
  * @param id the file id to update metadata
  * @param meta the new file metadata
  */
  /**
  * Lists all the files and folders within a path of the bucket.
  *
  * **Important:** For folder entries, fields like `id`, `updated_at`, `created_at`,
  * `last_accessed_at`, and `metadata` will be `null`. Only files have these fields populated.
  * Additionally, deprecated fields like `bucket_id`, `owner`, and `buckets` are NOT returned
  * by this method.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param path The folder path.
  * @param options Search options including limit (defaults to 100), offset, sortBy, and search
  * @param parameters Optional fetch parameters including signal for cancellation
  * @returns Promise with response containing array of files/folders or error
  *
  * @example List files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *   })
  *
  * // Handle files vs folders
  * data?.forEach(item => {
  *   if (item.id !== null) {
  *     // It's a file
  *     console.log('File:', item.name, 'Size:', item.metadata?.size)
  *   } else {
  *     // It's a folder
  *     console.log('Folder:', item.name)
  *   }
  * })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "avatar1.png",
  *       "id": "e668cf7f-821b-4a2f-9dce-7dfa5dd1cfd2",
  *       "updated_at": "2024-05-22T23:06:05.580Z",
  *       "created_at": "2024-05-22T23:04:34.443Z",
  *       "last_accessed_at": "2024-05-22T23:04:34.443Z",
  *       "metadata": {
  *         "eTag": "\"c5e8c553235d9af30ef4f6e280790b92\"",
  *         "size": 32175,
  *         "mimetype": "image/png",
  *         "cacheControl": "max-age=3600",
  *         "lastModified": "2024-05-22T23:06:05.574Z",
  *         "contentLength": 32175,
  *         "httpStatusCode": 200
  *       }
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @example Search files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *     search: 'jon'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: none
  *   - `objects` table permissions: `select`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async list(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      const s = e != null && e.sortBy ? P(P({}, So.sortBy), e.sortBy) : So.sortBy, i = P(P(P({}, So), e), {}, {
        sortBy: s,
        prefix: t || ""
      });
      return await Ve(n.fetch, `${n.url}/object/list/${n.bucketId}`, i, { headers: n.headers }, r);
    });
  }
  /**
  * Lists all the files and folders within a bucket using the V2 API with pagination support.
  *
  * **Important:** Folder entries in the `folders` array only contain `name` and optionally `key` —
  * they have no `id`, timestamps, or `metadata` fields. Full file metadata is only available
  * on entries in the `objects` array.
  *
  * @experimental this method signature might change in the future
  *
  * @category Storage
  * @subcategory File Buckets
  * @param options Search options including prefix, cursor for pagination, limit, with_delimiter
  * @param parameters Optional fetch parameters including signal for cancellation
  * @returns Promise with response containing folders/objects arrays with pagination info or error
  *
  * @example List files with pagination
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .listV2({
  *     prefix: 'folder/',
  *     limit: 100,
  *   })
  *
  * // Handle pagination
  * if (data?.hasNext) {
  *   const nextPage = await supabase
  *     .storage
  *     .from('avatars')
  *     .listV2({
  *       prefix: 'folder/',
  *       cursor: data.nextCursor,
  *     })
  * }
  *
  * // Handle files vs folders
  * data?.objects.forEach(file => {
  *   if (file.id !== null) {
  *     console.log('File:', file.name, 'Size:', file.metadata?.size)
  *   }
  * })
  * data?.folders.forEach(folder => {
  *   console.log('Folder:', folder.name)
  * })
  * ```
  */
  async listV2(t, e) {
    var r = this;
    return r.handleOperation(async () => {
      const n = P({}, t);
      return await Ve(r.fetch, `${r.url}/object/list-v2/${r.bucketId}`, n, { headers: r.headers }, e);
    });
  }
  encodeMetadata(t) {
    return JSON.stringify(t);
  }
  toBase64(t) {
    return typeof Buffer < "u" ? Buffer.from(t).toString("base64") : btoa(t);
  }
  _getFinalPath(t) {
    return `${this.bucketId}/${t.replace(/^\/+/, "")}`;
  }
  _removeEmptyFolders(t) {
    return t.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
  }
  /** Modifies the `query`, appending values the from `transform` */
  applyTransformOptsToQuery(t, e) {
    return e.width && t.set("width", e.width.toString()), e.height && t.set("height", e.height.toString()), e.resize && t.set("resize", e.resize), e.format && t.set("format", e.format), e.quality && t.set("quality", e.quality.toString()), t;
  }
};
const nv = "2.111.0", ss = { "X-Client-Info": `storage-js/${nv}` };
var sv = class extends Jr {
  constructor(t, e = {}, r, n) {
    const s = new URL(t);
    n != null && n.useNewHostname && /supabase\.(co|in|red)$/.test(s.hostname) && !s.hostname.includes("storage.supabase.") && (s.hostname = s.hostname.replace("supabase.", "storage.supabase."));
    const i = s.href.replace(/\/$/, ""), o = P(P({}, ss), e);
    super(i, o, r, "storage");
  }
  /**
  * Retrieves the details of all Storage buckets within an existing project.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of buckets or error
  *
  * @example List buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets()
  * ```
  *
  * @example List buckets with options
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc',
  *     search: 'prod'
  *   })
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async listBuckets(t) {
    var e = this;
    return e.handleOperation(async () => {
      const r = e.listBucketOptionsToQueryString(t);
      return await Kn(e.fetch, `${e.url}/bucket${r}`, { headers: e.headers });
    });
  }
  /**
  * Retrieves the details of an existing Storage bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param id The unique identifier of the bucket you would like to retrieve.
  * @returns Promise with response containing bucket details or error
  *
  * @example Get bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .getBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "id": "avatars",
  *     "name": "avatars",
  *     "owner": "",
  *     "public": false,
  *     "file_size_limit": 1024,
  *     "allowed_mime_types": [
  *       "image/png"
  *     ],
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async getBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Kn(e.fetch, `${e.url}/bucket/${t}`, { headers: e.headers }));
  }
  /**
  * Creates a new Storage bucket
  *
  * @category Storage
  * @subcategory File Buckets
  * @param id A unique identifier for the bucket you are creating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
  *   - default bucket type is `STANDARD`
  * @returns Promise with response containing newly created bucket name or error
  *
  * @example Create bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .createBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "avatars"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `insert`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async createBucket(t, e = { public: !1 }) {
    var r = this;
    return r.handleOperation(async () => await Ve(r.fetch, `${r.url}/bucket`, {
      id: t,
      name: t,
      type: e.type,
      public: e.public,
      file_size_limit: e.fileSizeLimit,
      allowed_mime_types: e.allowedMimeTypes
    }, { headers: r.headers }));
  }
  /**
  * Updates a Storage bucket
  *
  * @category Storage
  * @subcategory File Buckets
  * @param id A unique identifier for the bucket you are updating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @returns Promise with response containing success message or error
  *
  * @example Update bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .updateBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully updated"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select` and `update`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async updateBucket(t, e) {
    var r = this;
    return r.handleOperation(async () => await Oa(r.fetch, `${r.url}/bucket/${t}`, {
      id: t,
      name: t,
      public: e.public,
      file_size_limit: e.fileSizeLimit,
      allowed_mime_types: e.allowedMimeTypes
    }, { headers: r.headers }));
  }
  /**
  * Removes all objects inside a single bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param id The unique identifier of the bucket you would like to empty.
  * @returns Promise with success message or error
  *
  * @example Empty bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .emptyBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully emptied"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select`
  *   - `objects` table permissions: `select` and `delete`
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async emptyBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Ve(e.fetch, `${e.url}/bucket/${t}/empty`, {}, { headers: e.headers }));
  }
  /**
  * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
  * You must first `empty()` the bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param id The unique identifier of the bucket you would like to delete.
  * @returns Promise with success message or error
  *
  * @example Delete bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .deleteBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - RLS policy permissions required:
  *   - `buckets` table permissions: `select` and `delete`
  *   - `objects` table permissions: none
  * - Refer to the [Storage guide](/docs/guides/storage/security/access-control) on how access control works
  */
  async deleteBucket(t) {
    var e = this;
    return e.handleOperation(async () => await qn(e.fetch, `${e.url}/bucket/${t}`, {}, { headers: e.headers }));
  }
  /**
  * Purges the CDN cache for an entire bucket.
  *
  * Maps to `DELETE /cdn/{bucket}` on the Storage API. The server
  * issues a CDN invalidation for the bucket and returns `{ message: 'success' }`.
  *
  * **Requires the `service_role` key.** The underlying endpoint enforces
  * `service_role` JWT — calls made with the anon key or a user JWT will be
  * rejected by the server.
  *
  * **Hosted CDN feature.** On self-hosted Supabase, the Storage service must
  * have `CDN_PURGE_ENDPOINT_URL` configured and the `purgeCache` tenant
  * feature enabled, otherwise the server returns an error.
  *
  * @category Storage
  * @subcategory File Buckets
  * @param id The unique identifier of the bucket you would like to purge from cache.
  * @param options Optional purge cache options.
  * @param options.transformations If true, purges only transformations (resized/formatted variants), leaving original cached files intact.
  * @param parameters Optional fetch parameters such as an `AbortController` signal.
  * @returns Promise with `{ data: { message }, error: null }` on success or `{ data: null, error }` on failure.
  *
  * @example Purge cache for an entire bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .purgeBucketCache('avatars')
  * ```
  *
  * @example Purge only transformations for an entire bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .purgeBucketCache('avatars', { transformations: true })
  * ```
  */
  async purgeBucketCache(t, e, r) {
    var n = this;
    return n.handleOperation(async () => {
      const s = new URLSearchParams();
      e != null && e.transformations && s.set("transformations", "true");
      const i = s.toString();
      return await qn(n.fetch, `${n.url}/cdn/${Vd(t)}${i ? `?${i}` : ""}`, {}, { headers: n.headers }, r);
    });
  }
  listBucketOptionsToQueryString(t) {
    const e = {};
    return t && ("limit" in t && (e.limit = String(t.limit)), "offset" in t && (e.offset = String(t.offset)), t.search && (e.search = t.search), t.sortColumn && (e.sortColumn = t.sortColumn), t.sortOrder && (e.sortOrder = t.sortOrder)), Object.keys(e).length > 0 ? "?" + new URLSearchParams(e).toString() : "";
  }
}, iv = class extends Jr {
  /**
  * @alpha
  *
  * Creates a new StorageAnalyticsClient instance
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Analytics Buckets
  * @param url - The base URL for the storage API
  * @param headers - HTTP headers to include in requests
  * @param fetch - Optional custom fetch implementation
  *
  * @example Using supabase-js (recommended)
  * ```typescript
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * const { data, error } = await supabase.storage.analytics.listBuckets()
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```typescript
  * import { StorageAnalyticsClient } from '@supabase/storage-js'
  *
  * const client = new StorageAnalyticsClient(url, headers)
  * ```
  */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = P(P({}, ss), e);
    super(n, s, r, "storage");
  }
  /**
  * @alpha
  *
  * Creates a new analytics bucket using Iceberg tables
  * Analytics buckets are optimized for analytical queries and data processing
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Analytics Buckets
  * @param name A unique name for the bucket you are creating
  * @returns Promise with response containing newly created analytics bucket or error
  *
  * @example Create analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "analytics-data",
  *     "type": "ANALYTICS",
  *     "format": "iceberg",
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - Creates a new analytics bucket using Iceberg tables
  * - Analytics buckets are optimized for analytical queries and data processing
  */
  async createBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Ve(e.fetch, `${e.url}/bucket`, { name: t }, { headers: e.headers }));
  }
  /**
  * @alpha
  *
  * Retrieves the details of all Analytics Storage buckets within an existing project
  * Only returns buckets of type 'ANALYTICS'
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Analytics Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of analytics buckets or error
  *
  * @example List analytics buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc'
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "analytics-data",
  *       "type": "ANALYTICS",
  *       "format": "iceberg",
  *       "created_at": "2024-05-22T22:26:05.100Z",
  *       "updated_at": "2024-05-22T22:26:05.100Z"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - Retrieves the details of all Analytics Storage buckets within an existing project
  * - Only returns buckets of type 'ANALYTICS'
  */
  async listBuckets(t) {
    var e = this;
    return e.handleOperation(async () => {
      const r = new URLSearchParams();
      (t == null ? void 0 : t.limit) !== void 0 && r.set("limit", t.limit.toString()), (t == null ? void 0 : t.offset) !== void 0 && r.set("offset", t.offset.toString()), t != null && t.sortColumn && r.set("sortColumn", t.sortColumn), t != null && t.sortOrder && r.set("sortOrder", t.sortOrder), t != null && t.search && r.set("search", t.search);
      const n = r.toString(), s = n ? `${e.url}/bucket?${n}` : `${e.url}/bucket`;
      return await Kn(e.fetch, s, { headers: e.headers });
    });
  }
  /**
  * @alpha
  *
  * Deletes an existing analytics bucket
  * A bucket can't be deleted with existing objects inside it
  * You must first empty the bucket before deletion
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Analytics Buckets
  * @param bucketName The unique identifier of the bucket you would like to delete
  * @returns Promise with response containing success message or error
  *
  * @example Delete analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .deleteBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @remarks
  * - Deletes an analytics bucket
  */
  async deleteBucket(t) {
    var e = this;
    return e.handleOperation(async () => await qn(e.fetch, `${e.url}/bucket/${t}`, {}, { headers: e.headers }));
  }
  /**
  * @alpha
  *
  * Get an Iceberg REST Catalog client configured for a specific analytics bucket
  * Use this to perform advanced table and namespace operations within the bucket
  * The returned client provides full access to the Apache Iceberg REST Catalog API
  * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Analytics Buckets
  * @param bucketName - The name of the analytics bucket (warehouse) to connect to
  * @returns The wrapped Iceberg catalog client
  * @throws {StorageError} If the bucket name is invalid
  *
  * @example Get catalog and create table
  * ```js
  * // First, create an analytics bucket
  * const { data: bucket, error: bucketError } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  *
  * // Get the Iceberg catalog for that bucket
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Create a namespace
  * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
  *
  * // Create a table with schema
  * const { data: tableMetadata, error: tableError } = await catalog.createTable(
  *   { namespace: ['default'] },
  *   {
  *     name: 'events',
  *     schema: {
  *       type: 'struct',
  *       fields: [
  *         { id: 1, name: 'id', type: 'long', required: true },
  *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
  *         { id: 3, name: 'user_id', type: 'string', required: false }
  *       ],
  *       'schema-id': 0,
  *       'identifier-field-ids': [1]
  *     },
  *     'partition-spec': {
  *       'spec-id': 0,
  *       fields: []
  *     },
  *     'write-order': {
  *       'order-id': 0,
  *       fields: []
  *     },
  *     properties: {
  *       'write.format.default': 'parquet'
  *     }
  *   }
  * )
  * ```
  *
  * @example List tables in namespace
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all tables in the default namespace
  * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
  * if (listError) {
  *   if (listError.isNotFound()) {
  *     console.log('Namespace not found')
  *   }
  *   return
  * }
  * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
  * ```
  *
  * @example Working with namespaces
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all namespaces
  * const { data: namespaces } = await catalog.listNamespaces()
  *
  * // Create namespace with properties
  * await catalog.createNamespace(
  *   { namespace: ['production'] },
  *   { properties: { owner: 'data-team', env: 'prod' } }
  * )
  * ```
  *
  * @example Cleanup operations
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Drop table with purge option (removes all data)
  * const { error: dropError } = await catalog.dropTable(
  *   { namespace: ['default'], name: 'events' },
  *   { purge: true }
  * )
  *
  * if (dropError?.isNotFound()) {
  *   console.log('Table does not exist')
  * }
  *
  * // Drop namespace (must be empty)
  * await catalog.dropNamespace({ namespace: ['default'] })
  * ```
  *
  * @remarks
  * This method provides a bridge between Supabase's bucket management and the standard
  * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
  * All authentication and configuration is handled automatically using your Supabase credentials.
  *
  * **Error Handling**: Invalid bucket names throw immediately. All catalog
  * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
  * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
  * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
  *
  * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
  * deletes all table data. Without it, the table is marked as deleted but data remains.
  *
  * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
  * For complete API documentation and advanced usage, refer to the
  * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
  */
  from(t) {
    var e = this;
    if (!Jm(t)) throw new Hi("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
    const r = new Fm({
      baseUrl: this.url,
      catalogName: t,
      auth: {
        type: "custom",
        getHeaders: async () => e.headers
      },
      fetch: this.fetch
    }), n = this.shouldThrowOnError;
    return new Proxy(r, { get(s, i) {
      const o = s[i];
      return typeof o != "function" ? o : async (...a) => {
        try {
          return {
            data: await o.apply(s, a),
            error: null
          };
        } catch (l) {
          if (n) throw l;
          return {
            data: null,
            error: l
          };
        }
      };
    } });
  }
}, ov = class extends Jr {
  /** Creates a new VectorIndexApi instance */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = P(P({}, ss), {}, { "Content-Type": "application/json" }, e);
    super(n, s, r, "vectors");
  }
  /** Creates a new vector index within a bucket */
  async createIndex(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/CreateIndex`, t, { headers: e.headers }) || {});
  }
  /** Retrieves metadata for a specific vector index */
  async getIndex(t, e) {
    var r = this;
    return r.handleOperation(async () => await Re.post(r.fetch, `${r.url}/GetIndex`, {
      vectorBucketName: t,
      indexName: e
    }, { headers: r.headers }));
  }
  /** Lists vector indexes within a bucket with optional filtering and pagination */
  async listIndexes(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/ListIndexes`, t, { headers: e.headers }));
  }
  /** Deletes a vector index and all its data */
  async deleteIndex(t, e) {
    var r = this;
    return r.handleOperation(async () => await Re.post(r.fetch, `${r.url}/DeleteIndex`, {
      vectorBucketName: t,
      indexName: e
    }, { headers: r.headers }) || {});
  }
}, av = class extends Jr {
  /** Creates a new VectorDataApi instance */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = P(P({}, ss), {}, { "Content-Type": "application/json" }, e);
    super(n, s, r, "vectors");
  }
  /** Inserts or updates vectors in batch (1-500 per request) */
  async putVectors(t) {
    var e = this;
    if (t.vectors.length < 1 || t.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/PutVectors`, t, { headers: e.headers }) || {});
  }
  /** Retrieves vectors by their keys in batch */
  async getVectors(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/GetVectors`, t, { headers: e.headers }));
  }
  /** Lists vectors in an index with pagination */
  async listVectors(t) {
    var e = this;
    if (t.segmentCount !== void 0) {
      if (t.segmentCount < 1 || t.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
      if (t.segmentIndex !== void 0 && (t.segmentIndex < 0 || t.segmentIndex >= t.segmentCount))
        throw new Error(`segmentIndex must be between 0 and ${t.segmentCount - 1}`);
    }
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/ListVectors`, t, { headers: e.headers }));
  }
  /** Queries for similar vectors using approximate nearest neighbor search */
  async queryVectors(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/QueryVectors`, t, { headers: e.headers }));
  }
  /** Deletes vectors by their keys in batch (1-500 per request) */
  async deleteVectors(t) {
    var e = this;
    if (t.keys.length < 1 || t.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/DeleteVectors`, t, { headers: e.headers }) || {});
  }
}, lv = class extends Jr {
  /** Creates a new VectorBucketApi instance */
  constructor(t, e = {}, r) {
    const n = t.replace(/\/$/, ""), s = P(P({}, ss), {}, { "Content-Type": "application/json" }, e);
    super(n, s, r, "vectors");
  }
  /** Creates a new vector bucket */
  async createBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/CreateVectorBucket`, { vectorBucketName: t }, { headers: e.headers }) || {});
  }
  /** Retrieves metadata for a specific vector bucket */
  async getBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/GetVectorBucket`, { vectorBucketName: t }, { headers: e.headers }));
  }
  /** Lists vector buckets with optional filtering and pagination */
  async listBuckets(t = {}) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/ListVectorBuckets`, t, { headers: e.headers }));
  }
  /** Deletes a vector bucket (must be empty first) */
  async deleteBucket(t) {
    var e = this;
    return e.handleOperation(async () => await Re.post(e.fetch, `${e.url}/DeleteVectorBucket`, { vectorBucketName: t }, { headers: e.headers }) || {});
  }
}, uv = class extends lv {
  /**
  * @alpha
  *
  * Creates a StorageVectorsClient that can manage buckets, indexes, and vectors.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param url - Base URL of the Storage Vectors REST API.
  * @param options.headers - Optional headers (for example `Authorization`) applied to every request.
  * @param options.fetch - Optional custom `fetch` implementation for non-browser runtimes.
  *
  * @example Using supabase-js (recommended)
  * ```typescript
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```typescript
  * import { StorageVectorsClient } from '@supabase/storage-js'
  *
  * const client = new StorageVectorsClient(url, options)
  * ```
  */
  constructor(t, e = {}) {
    super(t, e.headers || {}, e.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific vector bucket
  * Returns a scoped client for index and vector operations within the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Bucket-scoped client with index and vector operations
  *
  * @example Accessing a vector bucket
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  from(t) {
    return new cv(this.url, this.headers, t, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector bucket
  * Vector buckets are containers for vector indexes and their data
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param vectorBucketName - Unique name for the vector bucket
  * @returns Promise with empty response on success or error
  *
  * @example Creating a vector bucket
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .createBucket('embeddings-prod')
  * ```
  */
  async createBucket(t) {
    var e = () => super.createBucket, r = this;
    return e().call(r, t);
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific vector bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Promise with bucket metadata or error
  *
  * @example Get bucket metadata
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .getBucket('embeddings-prod')
  *
  * console.log('Bucket created:', data?.vectorBucket.creationTime)
  * ```
  */
  async getBucket(t) {
    var e = () => super.getBucket, r = this;
    return e().call(r, t);
  }
  /**
  *
  * @alpha
  *
  * Lists all vector buckets with optional filtering and pagination
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Optional filters (prefix, maxResults, nextToken)
  * @returns Promise with list of buckets or error
  *
  * @example List vector buckets
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .listBuckets({ prefix: 'embeddings-' })
  *
  * data?.vectorBuckets.forEach(bucket => {
  *   console.log(bucket.vectorBucketName)
  * })
  * ```
  */
  async listBuckets(t = {}) {
    var e = () => super.listBuckets, r = this;
    return e().call(r, t);
  }
  /**
  *
  * @alpha
  *
  * Deletes a vector bucket (bucket must be empty)
  * All indexes must be deleted before deleting the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param vectorBucketName - Name of the vector bucket to delete
  * @returns Promise with empty response on success or error
  *
  * @example Delete a vector bucket
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .deleteBucket('embeddings-old')
  * ```
  */
  async deleteBucket(t) {
    var e = () => super.deleteBucket, r = this;
    return e().call(r, t);
  }
}, cv = class extends ov {
  /**
  * @alpha
  *
  * Creates a helper that automatically scopes all index operations to the provided bucket.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @example Creating a vector bucket scope
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  constructor(t, e, r, n) {
    super(t, e, n), this.vectorBucketName = r;
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Index configuration (vectorBucketName is automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example Creating a vector index
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.createIndex({
  *   indexName: 'documents-openai',
  *   dataType: 'float32',
  *   dimension: 1536,
  *   distanceMetric: 'cosine',
  *   metadataConfiguration: {
  *     nonFilterableMetadataKeys: ['raw_text']
  *   }
  * })
  * ```
  */
  async createIndex(t) {
    var e = () => super.createIndex, r = this;
    return e().call(r, P(P({}, t), {}, { vectorBucketName: r.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Lists indexes in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Listing options (vectorBucketName is automatically set)
  * @returns Promise with response containing indexes array and pagination token or error
  *
  * @example List indexes
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
  * ```
  */
  async listIndexes(t = {}) {
    var e = () => super.listIndexes, r = this;
    return e().call(r, P(P({}, t), {}, { vectorBucketName: r.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param indexName - Name of the index to retrieve
  * @returns Promise with index metadata or error
  *
  * @example Get index metadata
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.getIndex('documents-openai')
  * console.log('Dimension:', data?.index.dimension)
  * ```
  */
  async getIndex(t) {
    var e = () => super.getIndex, r = this;
    return e().call(r, r.vectorBucketName, t);
  }
  /**
  *
  * @alpha
  *
  * Deletes an index from this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param indexName - Name of the index to delete
  * @returns Promise with empty response on success or error
  *
  * @example Delete an index
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.deleteIndex('old-index')
  * ```
  */
  async deleteIndex(t) {
    var e = () => super.deleteIndex, r = this;
    return e().call(r, r.vectorBucketName, t);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific index within this bucket
  * Returns a scoped client for vector data operations
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param indexName - Name of the index
  * @returns Index-scoped client with vector data operations
  *
  * @example Accessing an index
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  *
  * // Insert vectors
  * await index.putVectors({
  *   vectors: [
  *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
  *   ]
  * })
  *
  * // Query similar vectors
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [...] },
  *   topK: 5
  * })
  * ```
  */
  index(t) {
    return new hv(this.url, this.headers, this.vectorBucketName, t, this.fetch);
  }
}, hv = class extends av {
  /**
  *
  * @alpha
  *
  * Creates a helper that automatically scopes all vector operations to the provided bucket/index names.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @example Creating a vector index scope
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * ```
  */
  constructor(t, e, r, n, s) {
    super(t, e, s), this.vectorBucketName = r, this.indexName = n;
  }
  /**
  *
  * @alpha
  *
  * Inserts or updates vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Vector insertion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example Insert vectors into an index
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.putVectors({
  *   vectors: [
  *     {
  *       key: 'doc-1',
  *       data: { float32: [0.1, 0.2, ...] },
  *       metadata: { title: 'Introduction', page: 1 }
  *     }
  *   ]
  * })
  * ```
  */
  async putVectors(t) {
    var e = () => super.putVectors, r = this;
    return e().call(r, P(P({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Vector retrieval options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array or error
  *
  * @example Get vectors by keys
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.getVectors({
  *   keys: ['doc-1', 'doc-2'],
  *   returnMetadata: true
  * })
  * ```
  */
  async getVectors(t) {
    var e = () => super.getVectors, r = this;
    return e().call(r, P(P({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Lists vectors in this index with pagination
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Listing options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array and pagination token or error
  *
  * @example List vectors with pagination
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.listVectors({
  *   maxResults: 500,
  *   returnMetadata: true
  * })
  * ```
  */
  async listVectors(t = {}) {
    var e = () => super.listVectors, r = this;
    return e().call(r, P(P({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Queries for similar vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Query options (bucket and index names automatically set)
  * @returns Promise with response containing matches array of similar vectors ordered by distance or error
  *
  * @example Query similar vectors
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [0.1, 0.2, ...] },
  *   topK: 5,
  *   filter: { category: 'technical' },
  *   returnDistance: true,
  *   returnMetadata: true
  * })
  * ```
  */
  async queryVectors(t) {
    var e = () => super.queryVectors, r = this;
    return e().call(r, P(P({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Deletes vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  * @param options - Deletion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example Delete vectors by keys
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.deleteVectors({
  *   keys: ['doc-1', 'doc-2', 'doc-3']
  * })
  * ```
  */
  async deleteVectors(t) {
    var e = () => super.deleteVectors, r = this;
    return e().call(r, P(P({}, t), {}, {
      vectorBucketName: r.vectorBucketName,
      indexName: r.indexName
    }));
  }
}, dv = class extends sv {
  /**
  * Creates a client for Storage buckets, files, analytics, and vectors.
  *
  * @category Storage
  * @subcategory File Buckets
  *
  * @example Using supabase-js (recommended)
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * const avatars = supabase.storage.from('avatars')
  * ```
  *
  * @example Standalone import for bundle-sensitive environments
  * ```ts
  * import { StorageClient } from '@supabase/storage-js'
  *
  * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
  *   apikey: 'your-publishable-key',
  * })
  * const avatars = storage.from('avatars')
  * ```
  */
  constructor(t, e = {}, r, n) {
    super(t, e, r, n);
  }
  /**
  * Perform file operation in a bucket.
  *
  * @category Storage
  * @subcategory File Buckets
  *
  * @param id The bucket id to operate on.
  *
  * @example Accessing a bucket
  * ```typescript
  * const avatars = supabase.storage.from('avatars')
  * ```
  */
  from(t) {
    return new rv(this.url, this.headers, t, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access vector storage operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Vector Buckets
  *
  * @returns A StorageVectorsClient instance configured with the current storage settings.
  */
  get vectors() {
    return new uv(this.url + "/vector", {
      headers: this.headers,
      fetch: this.fetch
    });
  }
  /**
  *
  * @alpha
  *
  * Access analytics storage operations using Iceberg tables.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Storage
  * @subcategory Analytics Buckets
  *
  * @returns A StorageAnalyticsClient instance configured with the current storage settings.
  */
  get analytics() {
    return new iv(this.url + "/iceberg", this.headers, this.fetch);
  }
};
const Jd = "2.111.0", ct = 30 * 1e3, fn = 3, Eo = fn * ct, fv = 2 * ct, pv = "http://localhost:9999", gv = "supabase.auth.token", mv = { "X-Client-Info": `gotrue-js/${Jd}` }, xa = "X-Supabase-Api-Version", Qd = {
  "2024-01-01": {
    timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
    name: "2024-01-01"
  }
}, vv = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i, Zt = "sb_flow_id", yv = 5, wv = 10 * 60 * 1e3;
class Gn extends Error {
  constructor(e, r, n) {
    super(e), this.__isAuthError = !0, this.name = "AuthError", this.status = r, this.code = n;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code
    };
  }
}
function C(t) {
  return typeof t == "object" && t !== null && "__isAuthError" in t;
}
class _v extends Gn {
  constructor(e, r, n) {
    super(e, r, n), this.name = "AuthApiError", this.status = r, this.code = n;
  }
}
function ec(t) {
  return C(t) && t.name === "AuthApiError";
}
class Ge extends Gn {
  constructor(e, r) {
    super(e), this.name = "AuthUnknownError", this.originalError = r;
  }
}
class it extends Gn {
  constructor(e, r, n, s) {
    super(e, n, s), this.name = r, this.status = n;
  }
}
class ne extends it {
  constructor() {
    super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
  }
}
function Os(t) {
  return C(t) && t.name === "AuthSessionMissingError";
}
class fr extends it {
  constructor() {
    super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
  }
}
class xs extends it {
  constructor(e) {
    super(e, "AuthInvalidCredentialsError", 400, void 0);
  }
}
class As extends it {
  constructor(e, r = null) {
    super(e, "AuthImplicitGrantRedirectError", 500, void 0), this.details = null, this.details = r;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
  }
}
function kv(t) {
  return C(t) && t.name === "AuthImplicitGrantRedirectError";
}
class tc extends it {
  constructor(e, r = null) {
    super(e, "AuthPKCEGrantCodeExchangeError", 500, void 0), this.details = null, this.details = r;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
  }
}
class Sv extends it {
  constructor() {
    super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
  }
}
class Aa extends it {
  constructor(e, r) {
    super(e, "AuthRetryableFetchError", r, void 0);
  }
}
function Ps(t) {
  return C(t) && t.name === "AuthRetryableFetchError";
}
class rc extends it {
  constructor(e = "Refresh result discarded: session state changed mid-flight (e.g., concurrent signOut)") {
    super(e, "AuthRefreshDiscardedError", 409, void 0);
  }
}
function Ev(t) {
  return C(t) && t.name === "AuthRefreshDiscardedError";
}
class nc extends it {
  constructor(e, r, n) {
    super(e, "AuthWeakPasswordError", r, "weak_password"), this.reasons = n;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { reasons: this.reasons });
  }
}
class wi extends it {
  constructor(e) {
    super(e, "AuthInvalidJwtError", 400, "invalid_jwt");
  }
}
const _i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split(""), sc = ` 	
\r=`.split(""), bv = (() => {
  const t = new Array(128);
  for (let e = 0; e < t.length; e += 1)
    t[e] = -1;
  for (let e = 0; e < sc.length; e += 1)
    t[sc[e].charCodeAt(0)] = -2;
  for (let e = 0; e < _i.length; e += 1)
    t[_i[e].charCodeAt(0)] = e;
  return t;
})();
function ic(t, e, r) {
  if (t !== null)
    for (e.queue = e.queue << 8 | t, e.queuedBits += 8; e.queuedBits >= 6; ) {
      const n = e.queue >> e.queuedBits - 6 & 63;
      r(_i[n]), e.queuedBits -= 6;
    }
  else if (e.queuedBits > 0)
    for (e.queue = e.queue << 6 - e.queuedBits, e.queuedBits = 6; e.queuedBits >= 6; ) {
      const n = e.queue >> e.queuedBits - 6 & 63;
      r(_i[n]), e.queuedBits -= 6;
    }
}
function Yd(t, e, r) {
  const n = bv[t];
  if (n > -1)
    for (e.queue = e.queue << 6 | n, e.queuedBits += 6; e.queuedBits >= 8; )
      r(e.queue >> e.queuedBits - 8 & 255), e.queuedBits -= 8;
  else {
    if (n === -2)
      return;
    throw new Error(`Invalid Base64-URL character "${String.fromCharCode(t)}"`);
  }
}
function oc(t) {
  const e = [], r = (o) => {
    e.push(String.fromCodePoint(o));
  }, n = {
    utf8seq: 0,
    codepoint: 0
  }, s = { queue: 0, queuedBits: 0 }, i = (o) => {
    Rv(o, n, r);
  };
  for (let o = 0; o < t.length; o += 1)
    Yd(t.charCodeAt(o), s, i);
  return e.join("");
}
function Tv(t, e) {
  if (t <= 127) {
    e(t);
    return;
  } else if (t <= 2047) {
    e(192 | t >> 6), e(128 | t & 63);
    return;
  } else if (t <= 65535) {
    e(224 | t >> 12), e(128 | t >> 6 & 63), e(128 | t & 63);
    return;
  } else if (t <= 1114111) {
    e(240 | t >> 18), e(128 | t >> 12 & 63), e(128 | t >> 6 & 63), e(128 | t & 63);
    return;
  }
  throw new Error(`Unrecognized Unicode codepoint: ${t.toString(16)}`);
}
function Cv(t, e) {
  for (let r = 0; r < t.length; r += 1) {
    let n = t.charCodeAt(r);
    if (n > 55295 && n <= 56319) {
      const s = (n - 55296) * 1024 & 65535;
      n = (t.charCodeAt(r + 1) - 56320 & 65535 | s) + 65536, r += 1;
    }
    Tv(n, e);
  }
}
function Rv(t, e, r) {
  if (e.utf8seq === 0) {
    if (t <= 127) {
      r(t);
      return;
    }
    for (let n = 1; n < 6; n += 1)
      if (!(t >> 7 - n & 1)) {
        e.utf8seq = n;
        break;
      }
    if (e.utf8seq === 2)
      e.codepoint = t & 31;
    else if (e.utf8seq === 3)
      e.codepoint = t & 15;
    else if (e.utf8seq === 4)
      e.codepoint = t & 7;
    else
      throw new Error("Invalid UTF-8 sequence");
    e.utf8seq -= 1;
  } else if (e.utf8seq > 0) {
    if (t <= 127)
      throw new Error("Invalid UTF-8 sequence");
    e.codepoint = e.codepoint << 6 | t & 63, e.utf8seq -= 1, e.utf8seq === 0 && r(e.codepoint);
  }
}
function Ur(t) {
  const e = [], r = { queue: 0, queuedBits: 0 }, n = (s) => {
    e.push(s);
  };
  for (let s = 0; s < t.length; s += 1)
    Yd(t.charCodeAt(s), r, n);
  return new Uint8Array(e);
}
function Ov(t) {
  const e = [];
  return Cv(t, (r) => e.push(r)), new Uint8Array(e);
}
function er(t) {
  const e = [], r = { queue: 0, queuedBits: 0 }, n = (s) => {
    e.push(s);
  };
  return t.forEach((s) => ic(s, r, n)), ic(null, r, n), e.join("");
}
function xv(t) {
  return Math.round(Date.now() / 1e3) + t;
}
function Av() {
  return Symbol("auth-callback");
}
const oe = () => typeof window < "u" && typeof document < "u", Vt = {
  tested: !1,
  writable: !1
}, Xd = () => {
  if (!oe())
    return !1;
  try {
    if (typeof globalThis.localStorage != "object")
      return !1;
  } catch {
    return !1;
  }
  if (Vt.tested)
    return Vt.writable;
  const t = `lswt-${Math.random()}${Math.random()}`;
  try {
    globalThis.localStorage.setItem(t, t), globalThis.localStorage.removeItem(t), Vt.tested = !0, Vt.writable = !0;
  } catch {
    Vt.tested = !0, Vt.writable = !1;
  }
  return Vt.writable;
};
function ac(t) {
  const e = {}, r = new URL(t);
  if (r.hash && r.hash[0] === "#")
    try {
      new URLSearchParams(r.hash.substring(1)).forEach((s, i) => {
        e[i] = s;
      });
    } catch {
    }
  return r.searchParams.forEach((n, s) => {
    e[s] = n;
  }), e;
}
const Zd = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e), Pv = (t) => typeof t == "object" && t !== null && "status" in t && "ok" in t && "json" in t && typeof t.json == "function", dt = async (t, e, r) => {
  await t.setItem(e, JSON.stringify(r));
}, de = async (t, e) => {
  const r = await t.getItem(e);
  if (!r)
    return null;
  try {
    return JSON.parse(r);
  } catch {
    return null;
  }
}, ke = async (t, e) => {
  await t.removeItem(e);
};
class Vi {
  constructor() {
    this.promise = new Vi.promiseConstructor((e, r) => {
      this.resolve = e, this.reject = r;
    });
  }
}
Vi.promiseConstructor = Promise;
function js(t) {
  const e = t.split(".");
  if (e.length !== 3)
    throw new wi("Invalid JWT structure");
  for (let n = 0; n < e.length; n++)
    if (!vv.test(e[n]))
      throw new wi("JWT not in base64url format");
  return {
    // using base64url lib
    header: JSON.parse(oc(e[0])),
    payload: JSON.parse(oc(e[1])),
    signature: Ur(e[2]),
    raw: {
      header: e[0],
      payload: e[1]
    }
  };
}
async function jv(t) {
  return await new Promise((e) => {
    setTimeout(() => e(null), t);
  });
}
function Iv(t, e) {
  return new Promise((n, s) => {
    (async () => {
      for (let i = 0; i < 1 / 0; i++)
        try {
          const o = await t(i);
          if (!e(i, null, o)) {
            n(o);
            return;
          }
        } catch (o) {
          if (!e(i, o)) {
            s(o);
            return;
          }
        }
    })();
  });
}
function ef(t) {
  return ("0" + t.toString(16)).substr(-2);
}
function Nv() {
  const e = new Uint32Array(56);
  if (typeof crypto > "u") {
    const r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~", n = r.length;
    let s = "";
    for (let i = 0; i < 56; i++)
      s += r.charAt(Math.floor(Math.random() * n));
    return s;
  }
  return crypto.getRandomValues(e), Array.from(e, ef).join("");
}
async function Lv(t) {
  const r = new TextEncoder().encode(t), n = await crypto.subtle.digest("SHA-256", r), s = new Uint8Array(n);
  return Array.from(s).map((i) => String.fromCharCode(i)).join("");
}
async function $v(t) {
  if (!(typeof crypto < "u" && typeof crypto.subtle < "u" && typeof TextEncoder < "u"))
    return console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256."), t;
  const r = await Lv(t);
  return btoa(r).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const Uv = /^[a-zA-Z0-9_-]{8,64}$/;
function Ks(t) {
  return typeof t == "string" && Uv.test(t) ? t : null;
}
function Dv() {
  if (typeof crypto < "u" && typeof crypto.getRandomValues == "function") {
    const e = new Uint8Array(16);
    return crypto.getRandomValues(e), Array.from(e, ef).join("");
  }
  let t = "";
  for (let e = 0; e < 32; e++)
    t += Math.floor(Math.random() * 16).toString(16);
  return t;
}
const Vr = (t, e) => `${t}-flow-${e}-code-verifier`, Jn = (t) => `${t}-flows-code-verifier`;
async function Rl(t, e) {
  const r = await de(t, Jn(e));
  return Array.isArray(r) ? r.filter((n) => Ks(n) !== null) : [];
}
async function Mv(t, e, r, n, s) {
  await dt(t, Vr(e, r), n);
  const i = (await Rl(t, e)).filter((o) => o !== r);
  for (i.push(r); i.length > yv; ) {
    const o = i.shift();
    await ke(t, Vr(e, o)), s == null || s(o);
  }
  await dt(t, Jn(e), i), await dt(t, `${e}-code-verifier`, n);
}
async function zv(t, e, r) {
  if (r) {
    const s = await de(t, Vr(e, r));
    return { verifier: typeof s == "string" ? s : null, flowId: r };
  }
  const n = await de(t, `${e}-code-verifier`);
  return { verifier: typeof n == "string" ? n : null, flowId: null };
}
async function Fe(t, e, r) {
  const n = `${e}-code-verifier`;
  if (!r) {
    await ke(t, n);
    return;
  }
  const s = Vr(e, r), i = await de(t, s);
  await ke(t, s);
  const o = await Rl(t, e), a = o.filter((l) => l !== r);
  a.length !== o.length && (a.length > 0 ? await dt(t, Jn(e), a) : await ke(t, Jn(e))), i != null && i === await de(t, n) && await ke(t, n);
}
async function Bv(t, e) {
  const r = await Rl(t, e);
  for (const n of r)
    await ke(t, Vr(e, n));
  await ke(t, Jn(e)), await ke(t, `${e}-code-verifier`);
}
function Fv(t, e) {
  const r = t.indexOf("#");
  let n = r === -1 ? t : t.slice(0, r);
  const s = r === -1 ? "" : t.slice(r), i = n.indexOf("?");
  if (i !== -1) {
    const a = n.slice(0, i), l = n.slice(i + 1).split("&").filter((u) => u !== "" && u !== Zt && !u.startsWith(`${Zt}=`));
    n = l.length > 0 ? `${a}?${l.join("&")}` : a;
  }
  const o = n.includes("?") ? "&" : "?";
  return `${n}${o}${Zt}=${encodeURIComponent(e)}${s}`;
}
async function Hv(t, e, r = !1, n) {
  const s = Nv();
  let i = s;
  r && (i += "/recovery");
  const o = Dv();
  await Mv(t, e, o, i, n);
  const a = await $v(s);
  return [a, s === a ? "plain" : "s256", o];
}
const Wv = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function Vv(t) {
  const e = t.headers.get(xa);
  if (!e || !e.match(Wv))
    return null;
  try {
    return /* @__PURE__ */ new Date(`${e}T00:00:00.0Z`);
  } catch {
    return null;
  }
}
function Kv(t) {
  if (!t)
    throw new Error("Missing exp claim");
  const e = Math.floor(Date.now() / 1e3);
  if (t <= e)
    throw new Error("JWT has expired");
}
function qv(t) {
  switch (t) {
    case "RS256":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      };
    case "ES256":
      return {
        name: "ECDSA",
        namedCurve: "P-256",
        hash: { name: "SHA-256" }
      };
    default:
      throw new Error("Invalid alg claim");
  }
}
const Gv = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function ot(t) {
  if (!Gv.test(t))
    throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
}
function He(t) {
  if (!t.passkey)
    throw new Error("@supabase/auth-js: the passkey API is experimental and disabled by default. Enable it by passing `auth: { experimental: { passkey: true } }` to createClient (or to the GoTrueClient constructor).");
}
function bo() {
  const t = {};
  return new Proxy(t, {
    get: (e, r) => {
      if (r === "__isUserNotAvailableProxy")
        return !0;
      if (typeof r == "symbol") {
        const n = r.toString();
        if (n === "Symbol(Symbol.toPrimitive)" || n === "Symbol(Symbol.toStringTag)" || n === "Symbol(util.inspect.custom)")
          return;
      }
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${r}" property of the session object is not supported. Please use getUser() instead.`);
    },
    set: (e, r) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${r}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    },
    deleteProperty: (e, r) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${r}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    }
  });
}
function Jv(t, e) {
  return new Proxy(t, {
    get: (r, n, s) => {
      if (n === "__isInsecureUserWarningProxy")
        return !0;
      if (typeof n == "symbol") {
        const i = n.toString();
        if (i === "Symbol(Symbol.toPrimitive)" || i === "Symbol(Symbol.toStringTag)" || i === "Symbol(util.inspect.custom)" || i === "Symbol(nodejs.util.inspect.custom)")
          return Reflect.get(r, n, s);
      }
      return !e.value && typeof n == "string" && (console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server."), e.value = !0), Reflect.get(r, n, s);
    }
  });
}
function lc(t) {
  return JSON.parse(JSON.stringify(t));
}
const Jt = (t) => {
  if (typeof t == "object" && t !== null) {
    const e = t;
    if (typeof e.msg == "string")
      return e.msg;
    if (typeof e.message == "string")
      return e.message;
    if (typeof e.error_description == "string")
      return e.error_description;
    if (typeof e.error == "string")
      return e.error;
  }
  return JSON.stringify(t);
}, Qv = [
  500,
  501,
  502,
  503,
  504,
  520,
  521,
  522,
  523,
  524,
  525,
  526,
  527,
  528,
  529,
  530
];
async function uc(t) {
  var e;
  if (!Pv(t))
    throw new Aa(Jt(t), 0);
  if (Qv.includes(t.status))
    throw new Aa(Jt(t), t.status);
  let r;
  try {
    r = await t.json();
  } catch (i) {
    throw new Ge(Jt(i), i);
  }
  let n;
  const s = Vv(t);
  if (s && s.getTime() >= Qd["2024-01-01"].timestamp && typeof r == "object" && r && typeof r.code == "string" ? n = r.code : typeof r == "object" && r && typeof r.error_code == "string" && (n = r.error_code), n) {
    if (n === "weak_password")
      throw new nc(Jt(r), t.status, ((e = r.weak_password) === null || e === void 0 ? void 0 : e.reasons) || []);
    if (n === "session_not_found")
      throw new ne();
  } else if (typeof r == "object" && r && typeof r.weak_password == "object" && r.weak_password && Array.isArray(r.weak_password.reasons) && r.weak_password.reasons.length && r.weak_password.reasons.reduce((i, o) => i && typeof o == "string", !0))
    throw new nc(Jt(r), t.status, r.weak_password.reasons);
  throw new _v(Jt(r), t.status || 500, n);
}
const Yv = (t, e, r, n) => {
  const s = { method: t, headers: (e == null ? void 0 : e.headers) || {} };
  return t === "GET" ? s : (s.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, e == null ? void 0 : e.headers), s.body = JSON.stringify(n), Object.assign(Object.assign({}, s), r));
};
async function x(t, e, r, n) {
  var s;
  const i = Object.assign({}, n == null ? void 0 : n.headers);
  i[xa] || (i[xa] = Qd["2024-01-01"].name), n != null && n.jwt && (i.Authorization = `Bearer ${n.jwt}`);
  const o = (s = n == null ? void 0 : n.query) !== null && s !== void 0 ? s : {};
  n != null && n.redirectTo && (o.redirect_to = n.redirectTo);
  const a = Object.keys(o).length ? "?" + new URLSearchParams(o).toString() : "", l = await Xv(t, e, r + a, {
    headers: i,
    noResolveJson: n == null ? void 0 : n.noResolveJson
  }, {}, n == null ? void 0 : n.body);
  return n != null && n.xform ? n == null ? void 0 : n.xform(l) : { data: Object.assign({}, l), error: null };
}
async function Xv(t, e, r, n, s, i) {
  const o = Yv(e, n, s, i);
  let a;
  try {
    a = await t(r, Object.assign({}, o));
  } catch (l) {
    throw new Aa(Jt(l), 0);
  }
  if (a.ok || await uc(a), n != null && n.noResolveJson)
    return a;
  try {
    return await a.json();
  } catch (l) {
    await uc(l);
  }
}
function Ie(t) {
  var e;
  let r = null;
  ty(t) && (r = Object.assign({}, t), t.expires_at || (r.expires_at = xv(t.expires_in)));
  const n = (e = t.user) !== null && e !== void 0 ? e : typeof (t == null ? void 0 : t.id) == "string" ? t : null;
  return { data: { session: r, user: n }, error: null };
}
function cc(t) {
  const e = Ie(t);
  return !e.error && t.weak_password && typeof t.weak_password == "object" && Array.isArray(t.weak_password.reasons) && t.weak_password.reasons.length && t.weak_password.message && typeof t.weak_password.message == "string" && t.weak_password.reasons.reduce((r, n) => r && typeof n == "string", !0) && (e.data.weak_password = t.weak_password), e;
}
function Rt(t) {
  var e;
  return { data: { user: (e = t.user) !== null && e !== void 0 ? e : t }, error: null };
}
function Zv(t) {
  return { data: t, error: null };
}
function ey(t) {
  const { action_link: e, email_otp: r, hashed_token: n, redirect_to: s, verification_type: i } = t, o = Fi(t, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]), a = {
    action_link: e,
    email_otp: r,
    hashed_token: n,
    redirect_to: s,
    verification_type: i
  }, l = Object.assign({}, o);
  return {
    data: {
      properties: a,
      user: l
    },
    error: null
  };
}
function hc(t) {
  return t;
}
function ty(t) {
  return !!t.access_token && !!t.refresh_token && !!t.expires_in;
}
const To = ["global", "local", "others"];
class ry {
  /**
   * Creates an admin API client that can be used to manage users and OAuth clients.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-secret-key')
   * const { data, error } = await supabase.auth.admin.listUsers()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { GoTrueAdminApi } from '@supabase/auth-js'
   *
   * const admin = new GoTrueAdminApi({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` },
   * })
   * ```
   */
  constructor({ url: e = "", headers: r = {}, fetch: n, experimental: s }) {
    this.url = e, this.headers = r, this.fetch = Zd(n), this.experimental = s ?? {}, this.mfa = {
      listFactors: this._listFactors.bind(this),
      deleteFactor: this._deleteFactor.bind(this)
    }, this.oauth = {
      listClients: this._listOAuthClients.bind(this),
      createClient: this._createOAuthClient.bind(this),
      getClient: this._getOAuthClient.bind(this),
      updateClient: this._updateOAuthClient.bind(this),
      deleteClient: this._deleteOAuthClient.bind(this),
      regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
    }, this.customProviders = {
      listProviders: this._listCustomProviders.bind(this),
      createProvider: this._createCustomProvider.bind(this),
      getProvider: this._getCustomProvider.bind(this),
      updateProvider: this._updateCustomProvider.bind(this),
      deleteProvider: this._deleteCustomProvider.bind(this)
    }, this.passkey = {
      listPasskeys: this._adminListPasskeys.bind(this),
      deletePasskey: this._adminDeletePasskey.bind(this)
    };
  }
  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   * @param scope The logout sope.
   *
   * @category Auth
   * @subcategory Auth Admin
   */
  async signOut(e, r = To[0]) {
    if (To.indexOf(r) < 0)
      throw new Error(`@supabase/auth-js: Parameter scope must be one of ${To.join(", ")}`);
    try {
      return await x(this.fetch, "POST", `${this.url}/logout?scope=${r}`, {
        headers: this.headers,
        jwt: e,
        noResolveJson: !0
      }), { data: null, error: null };
    } catch (n) {
      if (C(n))
        return { data: null, error: n };
      throw n;
    }
  }
  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param options Additional options to be included when inviting.
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @remarks
   * - Sends an invite link to the user's email address.
   * - The `inviteUserByEmail()` method is typically used by administrators to invite users to join the application.
   * - Note that PKCE is not supported when using `inviteUserByEmail`. This is because the browser initiating the invite is often different from the browser accepting the invite which makes it difficult to provide the security guarantees required of the PKCE flow.
   *
   * @example Invite a user
   * ```js
   * const { data, error } = await supabase.auth.admin.inviteUserByEmail('email@example.com')
   * ```
   *
   * @exampleResponse Invite a user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "invited_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmation_sent_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async inviteUserByEmail(e, r = {}) {
    try {
      return await x(this.fetch, "POST", `${this.url}/invite`, {
        body: { email: e, data: r.data },
        headers: this.headers,
        redirectTo: r.redirectTo,
        xform: Rt
      });
    } catch (n) {
      if (C(n))
        return { data: { user: null }, error: n };
      throw n;
    }
  }
  /**
   * Generates email links and OTPs to be sent via a custom email provider.
   * @param params The parameters for generating the link, including the link `type`, the user's `email`, and type-specific options such as `password`, `data`, and `redirectTo`.
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @remarks
   * - The following types can be passed into `generateLink()`: `signup`, `magiclink`, `invite`, `recovery`, `email_change_current`, `email_change_new`, `phone_change`.
   * - `generateLink()` only generates the email link for `email_change_email` if the **Secure email change** is enabled in your project's [email auth provider settings](/dashboard/project/_/auth/providers).
   * - `generateLink()` handles the creation of the user for `signup`, `invite` and `magiclink`.
   *
   * @example Generate a signup link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'signup',
   *   email: 'email@example.com',
   *   password: 'secret'
   * })
   * ```
   *
   * @exampleResponse Generate a signup link
   * ```json
   * {
   *   "data": {
   *     "properties": {
   *       "action_link": "<LINK_TO_SEND_TO_USER>",
   *       "email_otp": "999999",
   *       "hashed_token": "<HASHED_TOKEN",
   *       "redirect_to": "<REDIRECT_URL>",
   *       "verification_type": "signup"
   *     },
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "email@example.com",
   *       "phone": "",
   *       "confirmation_sent_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "email@example.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Generate an invite link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'invite',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @example Generate a magic link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'magiclink',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @example Generate a recovery link
   * ```js
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'recovery',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @example Generate links to change current email address
   * ```js
   * // generate an email change link to be sent to the current email address
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'email_change_current',
   *   email: 'current.email@example.com',
   *   newEmail: 'new.email@example.com'
   * })
   *
   * // generate an email change link to be sent to the new email address
   * const { data, error } = await supabase.auth.admin.generateLink({
   *   type: 'email_change_new',
   *   email: 'current.email@example.com',
   *   newEmail: 'new.email@example.com'
   * })
   * ```
   */
  async generateLink(e) {
    try {
      const { options: r } = e, n = Fi(e, ["options"]), s = Object.assign(Object.assign({}, n), r);
      return "newEmail" in n && (s.new_email = n == null ? void 0 : n.newEmail, delete s.newEmail), await x(this.fetch, "POST", `${this.url}/admin/generate_link`, {
        body: s,
        headers: this.headers,
        xform: ey,
        redirectTo: r == null ? void 0 : r.redirectTo
      });
    } catch (r) {
      if (C(r))
        return {
          data: {
            properties: null,
            user: null
          },
          error: r
        };
      throw r;
    }
  }
  // User Admin API
  /**
   * Creates a new user.
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @remarks
   * - To confirm the user's email address or phone number, set `email_confirm` or `phone_confirm` to true. Both arguments default to false.
   * - `createUser()` will not send a confirmation email to the user. You can use [`inviteUserByEmail()`](/docs/reference/javascript/auth-admin-inviteuserbyemail) if you want to send them an email invite instead.
   * - If you are sure that the created user's email or phone number is legitimate and verified, you can set the `email_confirm` or `phone_confirm` param to `true`.
   *
   * @example With custom user metadata
   * ```js
   * const { data, error } = await supabase.auth.admin.createUser({
   *   email: 'user@email.com',
   *   password: 'password',
   *   user_metadata: { name: 'Yoda' }
   * })
   * ```
   *
   * @exampleResponse With custom user metadata
   * ```json
   * {
   *   data: {
   *     user: {
   *       id: '1',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {},
   *       user_metadata: {},
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "1",
   *           "user_id": "1",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "phone_verified": false,
   *             "sub": "1"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false,
   *     }
   *   }
   *   error: null
   * }
   * ```
   *
   * @example Auto-confirm the user's email
   * ```js
   * const { data, error } = await supabase.auth.admin.createUser({
   *   email: 'user@email.com',
   *   email_confirm: true
   * })
   * ```
   *
   * @example Auto-confirm the user's phone number
   * ```js
   * const { data, error } = await supabase.auth.admin.createUser({
   *   phone: '1234567890',
   *   phone_confirm: true
   * })
   * ```
   */
  async createUser(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/users`, {
        body: e,
        headers: this.headers,
        xform: Rt
      });
    } catch (r) {
      if (C(r))
        return { data: { user: null }, error: r };
      throw r;
    }
  }
  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @remarks
   * - Defaults to return 50 users per page.
   *
   * @example Get a page of users
   * ```js
   * const { data: { users }, error } = await supabase.auth.admin.listUsers()
   * ```
   *
   * @example Paginated list of users
   * ```js
   * const { data: { users }, error } = await supabase.auth.admin.listUsers({
   *   page: 1,
   *   perPage: 1000
   * })
   * ```
   */
  async listUsers(e) {
    var r, n, s, i, o, a, l;
    try {
      const u = { nextPage: null, lastPage: 0, total: 0 }, c = await x(this.fetch, "GET", `${this.url}/admin/users`, {
        headers: this.headers,
        noResolveJson: !0,
        query: {
          page: (n = (r = e == null ? void 0 : e.page) === null || r === void 0 ? void 0 : r.toString()) !== null && n !== void 0 ? n : "",
          per_page: (i = (s = e == null ? void 0 : e.perPage) === null || s === void 0 ? void 0 : s.toString()) !== null && i !== void 0 ? i : ""
        },
        xform: hc
      });
      if (c.error)
        throw c.error;
      const h = await c.json(), d = (o = c.headers.get("x-total-count")) !== null && o !== void 0 ? o : 0, g = (l = (a = c.headers.get("link")) === null || a === void 0 ? void 0 : a.split(",")) !== null && l !== void 0 ? l : [];
      return g.length > 0 && (g.forEach((v) => {
        const y = parseInt(v.split(";")[0].split("=")[1].substring(0, 1)), k = JSON.parse(v.split(";")[1].split("=")[1]);
        u[`${k}Page`] = y;
      }), u.total = parseInt(d)), { data: Object.assign(Object.assign({}, h), u), error: null };
    } catch (u) {
      if (C(u))
        return { data: { users: [] }, error: u };
      throw u;
    }
  }
  /**
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @remarks
   * - Fetches the user object from the database based on the user's id.
   * - The `getUserById()` method requires the user's id which maps to the `auth.users.id` column.
   *
   * @example Fetch the user object using the access_token jwt
   * ```js
   * const { data, error } = await supabase.auth.admin.getUserById(1)
   * ```
   *
   * @exampleResponse Fetch the user object using the access_token jwt
   * ```json
   * {
   *   data: {
   *     user: {
   *       id: '1',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {},
   *       user_metadata: {},
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "1",
   *           "user_id": "1",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "phone_verified": false,
   *             "sub": "1"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false,
   *     }
   *   }
   *   error: null
   * }
   * ```
   */
  async getUserById(e) {
    ot(e);
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/users/${e}`, {
        headers: this.headers,
        xform: Rt
      });
    } catch (r) {
      if (C(r))
        return { data: { user: null }, error: r };
      throw r;
    }
  }
  /**
   * Updates the user data. Changes are applied directly without confirmation flows.
   *
   * @param uid The user's unique identifier
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @remarks
   * **Important:** This is a server-side operation and does **not** trigger client-side
   * `onAuthStateChange` listeners. The admin API has no connection to client state.
   *
   * To sync changes to the client after calling this method:
   * 1. On the client, call `supabase.auth.refreshSession()` to fetch the updated user data
   * 2. This will trigger the `TOKEN_REFRESHED` event and notify all listeners
   *
   * @example
   * ```typescript
   * // Server-side (Edge Function)
   * const { data, error } = await supabase.auth.admin.updateUserById(
   *   userId,
   *   { user_metadata: { preferences: { theme: 'dark' } } }
   * )
   *
   * // Client-side (to sync the changes)
   * const { data, error } = await supabase.auth.refreshSession()
   * // onAuthStateChange listeners will now be notified with updated user
   * ```
   *
   * @see {@link GoTrueClient.refreshSession} for syncing admin changes to the client
   * @see {@link GoTrueClient.updateUser} for client-side user updates (triggers listeners automatically)
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @example Updates a user's email
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '11111111-1111-1111-1111-111111111111',
   *   { email: 'new@email.com' }
   * )
   * ```
   *
   * @exampleResponse Updates a user's email
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "new@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "recovery_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Updates a user's password
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { password: 'new_password' }
   * )
   * ```
   *
   * @example Updates a user's metadata
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { user_metadata: { hello: 'world' } }
   * )
   * ```
   *
   * @example Updates a user's app_metadata
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { app_metadata: { plan: 'trial' } }
   * )
   * ```
   *
   * @example Confirms a user's email address
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { email_confirm: true }
   * )
   * ```
   *
   * @example Confirms a user's phone number
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { phone_confirm: true }
   * )
   * ```
   *
   * @example Ban a user for 100 years
   * ```js
   * const { data: user, error } = await supabase.auth.admin.updateUserById(
   *   '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4',
   *   { ban_duration: '876000h' }
   * )
   * ```
   */
  async updateUserById(e, r) {
    ot(e);
    try {
      return await x(this.fetch, "PUT", `${this.url}/admin/users/${e}`, {
        body: r,
        headers: this.headers,
        xform: Rt
      });
    } catch (n) {
      if (C(n))
        return { data: { user: null }, error: n };
      throw n;
    }
  }
  /**
   * Delete a user. Requires a `service_role` key.
   *
   * @param id The user id you want to remove.
   * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
   * Defaults to false for backward compatibility.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @category Auth
   * @subcategory Auth Admin
   *
   * @remarks
   * - The `deleteUser()` method requires the user's ID, which maps to the `auth.users.id` column.
   *
   * @example Removes a user
   * ```js
   * const { data, error } = await supabase.auth.admin.deleteUser(
   *   '715ed5db-f090-4b8c-a067-640ecee36aa0'
   * )
   * ```
   *
   * @exampleResponse Removes a user
   * ```json
   * {
   *   "data": {
   *     "user": {}
   *   },
   *   "error": null
   * }
   * ```
   */
  async deleteUser(e, r = !1) {
    ot(e);
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/users/${e}`, {
        headers: this.headers,
        body: {
          should_soft_delete: r
        },
        xform: Rt
      });
    } catch (n) {
      if (C(n))
        return { data: { user: null }, error: n };
      throw n;
    }
  }
  async _listFactors(e) {
    ot(e.userId);
    try {
      const { data: r, error: n } = await x(this.fetch, "GET", `${this.url}/admin/users/${e.userId}/factors`, {
        headers: this.headers,
        xform: (s) => ({ data: { factors: s }, error: null })
      });
      return { data: r, error: n };
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  async _deleteFactor(e) {
    ot(e.userId), ot(e.id);
    try {
      return { data: await x(this.fetch, "DELETE", `${this.url}/admin/users/${e.userId}/factors/${e.id}`, {
        headers: this.headers
      }), error: null };
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Lists all OAuth clients with optional pagination.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _listOAuthClients(e) {
    var r, n, s, i, o, a, l;
    try {
      const u = { nextPage: null, lastPage: 0, total: 0 }, c = await x(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
        headers: this.headers,
        noResolveJson: !0,
        query: {
          page: (n = (r = e == null ? void 0 : e.page) === null || r === void 0 ? void 0 : r.toString()) !== null && n !== void 0 ? n : "",
          per_page: (i = (s = e == null ? void 0 : e.perPage) === null || s === void 0 ? void 0 : s.toString()) !== null && i !== void 0 ? i : ""
        },
        xform: hc
      });
      if (c.error)
        throw c.error;
      const h = await c.json(), d = (o = c.headers.get("x-total-count")) !== null && o !== void 0 ? o : 0, g = (l = (a = c.headers.get("link")) === null || a === void 0 ? void 0 : a.split(",")) !== null && l !== void 0 ? l : [];
      return g.length > 0 && (g.forEach((v) => {
        const y = parseInt(v.split(";")[0].split("=")[1].substring(0, 1)), k = JSON.parse(v.split(";")[1].split("=")[1]);
        u[`${k}Page`] = y;
      }), u.total = parseInt(d)), { data: Object.assign(Object.assign({}, h), u), error: null };
    } catch (u) {
      if (C(u))
        return { data: { clients: [] }, error: u };
      throw u;
    }
  }
  /**
   * Creates a new OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _createOAuthClient(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
        body: e,
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Gets details of a specific OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _getOAuthClient(e) {
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/oauth/clients/${e}`, {
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Updates an existing OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _updateOAuthClient(e, r) {
    try {
      return await x(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${e}`, {
        body: r,
        headers: this.headers,
        xform: (n) => ({ data: n, error: null })
      });
    } catch (n) {
      if (C(n))
        return { data: null, error: n };
      throw n;
    }
  }
  /**
   * Deletes an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _deleteOAuthClient(e) {
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${e}`, {
        headers: this.headers,
        noResolveJson: !0
      }), { data: null, error: null };
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Regenerates the secret for an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _regenerateOAuthClientSecret(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/oauth/clients/${e}/regenerate_secret`, {
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Lists all custom providers with optional type filter.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _listCustomProviders(e) {
    try {
      const r = {};
      return e != null && e.type && (r.type = e.type), await x(this.fetch, "GET", `${this.url}/admin/custom-providers`, {
        headers: this.headers,
        query: r,
        xform: (n) => {
          var s;
          return { data: { providers: (s = n == null ? void 0 : n.providers) !== null && s !== void 0 ? s : [] }, error: null };
        }
      });
    } catch (r) {
      if (C(r))
        return { data: { providers: [] }, error: r };
      throw r;
    }
  }
  /**
   * Creates a new custom OIDC/OAuth provider.
   *
   * For OIDC providers, the server fetches and validates the OpenID Connect discovery document
   * from the issuer's well-known endpoint (or the provided `discovery_url`) at creation time.
   * This may return a validation error (`error_code: "validation_failed"`) if the discovery
   * document is unreachable, not valid JSON, missing required fields, or if the issuer
   * in the document does not match the expected issuer.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _createCustomProvider(e) {
    try {
      return await x(this.fetch, "POST", `${this.url}/admin/custom-providers`, {
        body: e,
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Gets details of a specific custom provider by identifier.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _getCustomProvider(e) {
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/custom-providers/${e}`, {
        headers: this.headers,
        xform: (r) => ({ data: r, error: null })
      });
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Updates an existing custom provider.
   *
   * When `issuer` or `discovery_url` is changed on an OIDC provider, the server re-fetches and
   * validates the discovery document before persisting. This may return a validation error
   * (`error_code: "validation_failed"`) if the discovery document is unreachable, invalid, or
   * the issuer does not match.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _updateCustomProvider(e, r) {
    try {
      return await x(this.fetch, "PUT", `${this.url}/admin/custom-providers/${e}`, {
        body: r,
        headers: this.headers,
        xform: (n) => ({ data: n, error: null })
      });
    } catch (n) {
      if (C(n))
        return { data: null, error: n };
      throw n;
    }
  }
  /**
   * Deletes a custom provider.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _deleteCustomProvider(e) {
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/custom-providers/${e}`, {
        headers: this.headers,
        noResolveJson: !0
      }), { data: null, error: null };
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Lists all passkeys for a user.
   *
   * This function should only be called on a server. Never expose your secret key in the browser.
   *
   * Requires `auth.experimental.passkey: true`.
   */
  async _adminListPasskeys(e) {
    He(this.experimental), ot(e.userId);
    try {
      return await x(this.fetch, "GET", `${this.url}/admin/users/${e.userId}/passkeys`, { headers: this.headers, xform: (r) => ({ data: r, error: null }) });
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
  /**
   * Deletes a user's passkey.
   *
   * This function should only be called on a server. Never expose your secret key in the browser.
   *
   * Requires `auth.experimental.passkey: true`.
   */
  async _adminDeletePasskey(e) {
    He(this.experimental), ot(e.userId), ot(e.passkeyId);
    try {
      return await x(this.fetch, "DELETE", `${this.url}/admin/users/${e.userId}/passkeys/${e.passkeyId}`, { headers: this.headers, noResolveJson: !0 }), { data: null, error: null };
    } catch (r) {
      if (C(r))
        return { data: null, error: r };
      throw r;
    }
  }
}
function dc(t = {}) {
  return {
    getItem: (e) => t[e] || null,
    setItem: (e, r) => {
      t[e] = r;
    },
    removeItem: (e) => {
      delete t[e];
    }
  };
}
globalThis && Xd() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug");
class ny extends Error {
  constructor(e) {
    super(e), this.isAcquireTimeout = !0;
  }
}
function sy() {
  if (typeof globalThis != "object")
    try {
      Object.defineProperty(Object.prototype, "__magic__", {
        get: function() {
          return this;
        },
        configurable: !0
      }), __magic__.globalThis = __magic__, delete Object.prototype.__magic__;
    } catch {
      typeof self < "u" && (self.globalThis = self);
    }
}
function tf(t) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(t))
    throw new Error(`@supabase/auth-js: Address "${t}" is invalid.`);
  return t.toLowerCase();
}
function iy(t) {
  return parseInt(t, 16);
}
function oy(t) {
  const e = new TextEncoder().encode(t);
  return "0x" + Array.from(e, (n) => n.toString(16).padStart(2, "0")).join("");
}
function ay(t) {
  var e;
  const { chainId: r, domain: n, expirationTime: s, issuedAt: i = /* @__PURE__ */ new Date(), nonce: o, notBefore: a, requestId: l, resources: u, scheme: c, uri: h, version: d } = t;
  {
    if (!Number.isInteger(r))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${r}`);
    if (!n)
      throw new Error('@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.');
    if (o && o.length < 8)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${o}`);
    if (!h)
      throw new Error('@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.');
    if (d !== "1")
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${d}`);
    if (!((e = t.statement) === null || e === void 0) && e.includes(`
`))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${t.statement}`);
  }
  const g = tf(t.address), v = c ? `${c}://${n}` : n, y = t.statement ? `${t.statement}
` : "", k = `${v} wants you to sign in with your Ethereum account:
${g}

${y}`;
  let f = `URI: ${h}
Version: ${d}
Chain ID: ${r}${o ? `
Nonce: ${o}` : ""}
Issued At: ${i.toISOString()}`;
  if (s && (f += `
Expiration Time: ${s.toISOString()}`), a && (f += `
Not Before: ${a.toISOString()}`), l && (f += `
Request ID: ${l}`), u) {
    let p = `
Resources:`;
    for (const m of u) {
      if (!m || typeof m != "string")
        throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${m}`);
      p += `
- ${m}`;
    }
    f += p;
  }
  return `${k}
${f}`;
}
class Y extends Error {
  constructor({ message: e, code: r, cause: n, name: s }) {
    var i;
    super(e, { cause: n }), this.__isWebAuthnError = !0, this.name = (i = s ?? (n instanceof Error ? n.name : void 0)) !== null && i !== void 0 ? i : "Unknown Error", this.code = r;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code
    };
  }
}
class ki extends Y {
  constructor(e, r) {
    super({
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: r,
      message: e
    }), this.name = "WebAuthnUnknownError", this.originalError = r;
  }
}
function ly({ error: t, options: e }) {
  var r, n, s;
  const { publicKey: i } = e;
  if (!i)
    throw Error("options was missing required publicKey property");
  if (t.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new Y({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: t
      });
  } else if (t.name === "ConstraintError") {
    if (((r = i.authenticatorSelection) === null || r === void 0 ? void 0 : r.requireResidentKey) === !0)
      return new Y({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: t
      });
    if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      e.mediation === "conditional" && ((n = i.authenticatorSelection) === null || n === void 0 ? void 0 : n.userVerification) === "required"
    )
      return new Y({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: t
      });
    if (((s = i.authenticatorSelection) === null || s === void 0 ? void 0 : s.userVerification) === "required")
      return new Y({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: t
      });
  } else {
    if (t.name === "InvalidStateError")
      return new Y({
        message: "The authenticator was previously registered",
        code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        cause: t
      });
    if (t.name === "NotAllowedError")
      return new Y({
        message: t.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: t
      });
    if (t.name === "NotSupportedError")
      return i.pubKeyCredParams.filter((a) => a.type === "public-key").length === 0 ? new Y({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: t
      }) : new Y({
        message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
        code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
        cause: t
      });
    if (t.name === "SecurityError") {
      const o = window.location.hostname;
      if (rf(o)) {
        if (i.rp.id !== o)
          return new Y({
            message: `The RP ID "${i.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: t
          });
      } else return new Y({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: t
      });
    } else if (t.name === "TypeError") {
      if (i.user.id.byteLength < 1 || i.user.id.byteLength > 64)
        return new Y({
          message: "User ID was not between 1 and 64 characters",
          code: "ERROR_INVALID_USER_ID_LENGTH",
          cause: t
        });
    } else if (t.name === "UnknownError")
      return new Y({
        message: "The authenticator was unable to process the specified options, or could not create a new credential",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: t
      });
  }
  return new Y({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: t
  });
}
function uy({ error: t, options: e }) {
  const { publicKey: r } = e;
  if (!r)
    throw Error("options was missing required publicKey property");
  if (t.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new Y({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: t
      });
  } else {
    if (t.name === "NotAllowedError")
      return new Y({
        message: t.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: t
      });
    if (t.name === "SecurityError") {
      const n = window.location.hostname;
      if (rf(n)) {
        if (r.rpId !== n)
          return new Y({
            message: `The RP ID "${r.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: t
          });
      } else return new Y({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: t
      });
    } else if (t.name === "UnknownError")
      return new Y({
        message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: t
      });
  }
  return new Y({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: t
  });
}
class cy {
  /**
   * Create an abort signal for a new WebAuthn operation.
   * Automatically cancels any existing operation.
   *
   * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
   */
  createNewAbortSignal() {
    if (this.controller) {
      const r = new Error("Cancelling existing WebAuthn API call for new one");
      r.name = "AbortError", this.controller.abort(r);
    }
    const e = new AbortController();
    return this.controller = e, e.signal;
  }
  /**
   * Manually cancel the current WebAuthn operation.
   * Useful for cleaning up when user cancels or navigates away.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
   */
  cancelCeremony() {
    if (this.controller) {
      const e = new Error("Manually cancelling existing WebAuthn API call");
      e.name = "AbortError", this.controller.abort(e), this.controller = void 0;
    }
  }
}
const Pa = new cy();
function fc(t) {
  if (!t)
    throw new Error("Credential creation options are required");
  if (typeof PublicKeyCredential < "u" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON == "function")
    return PublicKeyCredential.parseCreationOptionsFromJSON(
      /** we assert the options here as typescript still doesn't know about future webauthn types */
      t
    );
  const { challenge: e, user: r, excludeCredentials: n } = t, s = Fi(
    t,
    ["challenge", "user", "excludeCredentials"]
  ), i = Ur(e).buffer, o = Object.assign(Object.assign({}, r), { id: Ur(r.id).buffer }), a = Object.assign(Object.assign({}, s), {
    challenge: i,
    user: o
  });
  if (n && n.length > 0) {
    a.excludeCredentials = new Array(n.length);
    for (let l = 0; l < n.length; l++) {
      const u = n[l];
      a.excludeCredentials[l] = Object.assign(Object.assign({}, u), {
        id: Ur(u.id).buffer,
        type: u.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: u.transports
      });
    }
  }
  return a;
}
function pc(t) {
  if (!t)
    throw new Error("Credential request options are required");
  if (typeof PublicKeyCredential < "u" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON == "function")
    return PublicKeyCredential.parseRequestOptionsFromJSON(t);
  const { challenge: e, allowCredentials: r } = t, n = Fi(
    t,
    ["challenge", "allowCredentials"]
  ), s = Ur(e).buffer, i = Object.assign(Object.assign({}, n), { challenge: s });
  if (r && r.length > 0) {
    i.allowCredentials = new Array(r.length);
    for (let o = 0; o < r.length; o++) {
      const a = r[o];
      i.allowCredentials[o] = Object.assign(Object.assign({}, a), {
        id: Ur(a.id).buffer,
        type: a.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: a.transports
      });
    }
  }
  return i;
}
function gc(t) {
  var e;
  if ("toJSON" in t && typeof t.toJSON == "function")
    return t.toJSON();
  const r = t;
  return {
    id: t.id,
    rawId: t.id,
    response: {
      attestationObject: er(new Uint8Array(t.response.attestationObject)),
      clientDataJSON: er(new Uint8Array(t.response.clientDataJSON))
    },
    type: "public-key",
    clientExtensionResults: t.getClientExtensionResults(),
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (e = r.authenticatorAttachment) !== null && e !== void 0 ? e : void 0
  };
}
function mc(t) {
  var e;
  if ("toJSON" in t && typeof t.toJSON == "function")
    return t.toJSON();
  const r = t, n = t.getClientExtensionResults(), s = t.response;
  return {
    id: t.id,
    rawId: t.id,
    // W3C spec expects rawId to match id for JSON format
    response: {
      authenticatorData: er(new Uint8Array(s.authenticatorData)),
      clientDataJSON: er(new Uint8Array(s.clientDataJSON)),
      signature: er(new Uint8Array(s.signature)),
      userHandle: s.userHandle ? er(new Uint8Array(s.userHandle)) : void 0
    },
    type: "public-key",
    clientExtensionResults: n,
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (e = r.authenticatorAttachment) !== null && e !== void 0 ? e : void 0
  };
}
function rf(t) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    t === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(t)
  );
}
function Si() {
  var t, e;
  return !!(oe() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((t = navigator == null ? void 0 : navigator.credentials) === null || t === void 0 ? void 0 : t.create) == "function" && typeof ((e = navigator == null ? void 0 : navigator.credentials) === null || e === void 0 ? void 0 : e.get) == "function");
}
async function nf(t) {
  try {
    const e = await navigator.credentials.create(
      /** we assert the type here until typescript types are updated */
      t
    );
    return e ? e instanceof PublicKeyCredential ? { data: e, error: null } : {
      data: null,
      error: new ki("Browser returned unexpected credential type", e)
    } : {
      data: null,
      error: new ki("Empty credential response", e)
    };
  } catch (e) {
    return {
      data: null,
      error: ly({
        error: e,
        options: t
      })
    };
  }
}
async function sf(t) {
  try {
    const e = await navigator.credentials.get(
      /** we assert the type here until typescript types are updated */
      t
    );
    return e ? e instanceof PublicKeyCredential ? { data: e, error: null } : {
      data: null,
      error: new ki("Browser returned unexpected credential type", e)
    } : {
      data: null,
      error: new ki("Empty credential response", e)
    };
  } catch (e) {
    return {
      data: null,
      error: uy({
        error: e,
        options: t
      })
    };
  }
}
const hy = {
  hints: ["security-key"],
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform",
    requireResidentKey: !1,
    /** set to preferred because older yubikeys don't have PIN/Biometric */
    userVerification: "preferred",
    residentKey: "discouraged"
  },
  attestation: "direct"
}, dy = {
  /** set to preferred because older yubikeys don't have PIN/Biometric */
  userVerification: "preferred",
  hints: ["security-key"],
  attestation: "direct"
};
function Ei(...t) {
  const e = (s) => s !== null && typeof s == "object" && !Array.isArray(s), r = (s) => s instanceof ArrayBuffer || ArrayBuffer.isView(s), n = {};
  for (const s of t)
    if (s)
      for (const i in s) {
        const o = s[i];
        if (o !== void 0)
          if (Array.isArray(o))
            n[i] = o;
          else if (r(o))
            n[i] = o;
          else if (e(o)) {
            const a = n[i];
            e(a) ? n[i] = Ei(a, o) : n[i] = Ei(o);
          } else
            n[i] = o;
      }
  return n;
}
function fy(t, e) {
  return Ei(hy, t, e || {});
}
function py(t, e) {
  return Ei(dy, t, e || {});
}
class gy {
  constructor(e) {
    this.client = e, this.enroll = this._enroll.bind(this), this.challenge = this._challenge.bind(this), this.verify = this._verify.bind(this), this.authenticate = this._authenticate.bind(this), this.register = this._register.bind(this);
  }
  /**
   * Enroll a new WebAuthn factor.
   * Creates an unverified WebAuthn factor that must be verified with a credential.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
   * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
   */
  async _enroll(e) {
    return this.client.mfa.enroll(Object.assign(Object.assign({}, e), { factorType: "webauthn" }));
  }
  /**
   * Challenge for WebAuthn credential creation or authentication.
   * Combines server challenge with browser credential operations.
   * Handles both registration (create) and authentication (request) flows.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
   * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
   * @returns {Promise<RequestResult>} Challenge response with credential or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
   */
  async _challenge({ factorId: e, webauthn: r, friendlyName: n, signal: s }, i) {
    var o;
    try {
      const { data: a, error: l } = await this.client.mfa.challenge({
        factorId: e,
        webauthn: r
      });
      if (!a)
        return { data: null, error: l };
      const u = s ?? Pa.createNewAbortSignal();
      if (a.webauthn.type === "create") {
        const { user: c } = a.webauthn.credential_options.publicKey;
        if (!c.name) {
          const h = n;
          if (h)
            c.name = `${c.id}:${h}`;
          else {
            const g = (await this.client.getUser()).data.user, v = ((o = g == null ? void 0 : g.user_metadata) === null || o === void 0 ? void 0 : o.name) || (g == null ? void 0 : g.email) || (g == null ? void 0 : g.id) || "User";
            c.name = `${c.id}:${v}`;
          }
        }
        c.displayName || (c.displayName = c.name);
      }
      switch (a.webauthn.type) {
        case "create": {
          const c = fy(a.webauthn.credential_options.publicKey, i == null ? void 0 : i.create), { data: h, error: d } = await nf({
            publicKey: c,
            signal: u
          });
          return h ? {
            data: {
              factorId: e,
              challengeId: a.id,
              webauthn: {
                type: a.webauthn.type,
                credential_response: h
              }
            },
            error: null
          } : { data: null, error: d };
        }
        case "request": {
          const c = py(a.webauthn.credential_options.publicKey, i == null ? void 0 : i.request), { data: h, error: d } = await sf(Object.assign(Object.assign({}, a.webauthn.credential_options), { publicKey: c, signal: u }));
          return h ? {
            data: {
              factorId: e,
              challengeId: a.id,
              webauthn: {
                type: a.webauthn.type,
                credential_response: h
              }
            },
            error: null
          } : { data: null, error: d };
        }
      }
    } catch (a) {
      return C(a) ? { data: null, error: a } : {
        data: null,
        error: new Ge("Unexpected error in challenge", a)
      };
    }
  }
  /**
   * Verify a WebAuthn credential with the server.
   * Completes the WebAuthn ceremony by sending the credential to the server for verification.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Verification parameters
   * @param {string} params.challengeId - ID of the challenge being verified
   * @param {string} params.factorId - ID of the WebAuthn factor
   * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
   * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
   * */
  async _verify({ challengeId: e, factorId: r, webauthn: n }) {
    return this.client.mfa.verify({
      factorId: r,
      challengeId: e,
      webauthn: n
    });
  }
  /**
   * Complete WebAuthn authentication flow.
   * Performs challenge and verification in a single operation for existing credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Authentication parameters
   * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
   * @param {Object} params.webauthn - WebAuthn configuration
   * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.webauthn.signal - Optional abort signal
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
   * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
   */
  async _authenticate({ factorId: e, webauthn: { rpId: r = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: n = typeof window < "u" ? [window.location.origin] : void 0, signal: s } = {} }, i) {
    if (!r)
      return {
        data: null,
        error: new Gn("rpId is required for WebAuthn authentication")
      };
    try {
      if (!Si())
        return {
          data: null,
          error: new Ge("Browser does not support WebAuthn", null)
        };
      const { data: o, error: a } = await this.challenge({
        factorId: e,
        webauthn: { rpId: r, rpOrigins: n },
        signal: s
      }, { request: i });
      if (!o)
        return { data: null, error: a };
      const { webauthn: l } = o;
      return this._verify({
        factorId: e,
        challengeId: o.challengeId,
        webauthn: {
          type: l.type,
          rpId: r,
          rpOrigins: n,
          credential_response: l.credential_response
        }
      });
    } catch (o) {
      return C(o) ? { data: null, error: o } : {
        data: null,
        error: new Ge("Unexpected error in authenticate", o)
      };
    }
  }
  /**
   * Complete WebAuthn registration flow.
   * Performs enrollment, challenge, and verification in a single operation for new credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Registration parameters
   * @param {string} params.friendlyName - User-friendly name for the credential
   * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.signal - Optional abort signal
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
   */
  async _register({ friendlyName: e, webauthn: { rpId: r = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: n = typeof window < "u" ? [window.location.origin] : void 0, signal: s } = {} }, i) {
    if (!r)
      return {
        data: null,
        error: new Gn("rpId is required for WebAuthn registration")
      };
    try {
      if (!Si())
        return {
          data: null,
          error: new Ge("Browser does not support WebAuthn", null)
        };
      const { data: o, error: a } = await this._enroll({
        friendlyName: e
      });
      if (!o)
        return await this.client.mfa.listFactors().then((c) => {
          var h;
          return (h = c.data) === null || h === void 0 ? void 0 : h.all.find((d) => d.factor_type === "webauthn" && d.friendly_name === e && d.status !== "unverified");
        }).then((c) => c ? this.client.mfa.unenroll({ factorId: c == null ? void 0 : c.id }) : void 0), { data: null, error: a };
      const { data: l, error: u } = await this._challenge({
        factorId: o.id,
        friendlyName: o.friendly_name,
        webauthn: { rpId: r, rpOrigins: n },
        signal: s
      }, {
        create: i
      });
      return l ? this._verify({
        factorId: o.id,
        challengeId: l.challengeId,
        webauthn: {
          rpId: r,
          rpOrigins: n,
          type: l.webauthn.type,
          credential_response: l.webauthn.credential_response
        }
      }) : { data: null, error: u };
    } catch (o) {
      return C(o) ? { data: null, error: o } : {
        data: null,
        error: new Ge("Unexpected error in register", o)
      };
    }
  }
}
sy();
const my = {
  url: pv,
  storageKey: gv,
  autoRefreshToken: !0,
  persistSession: !0,
  detectSessionInUrl: !0,
  headers: mv,
  flowType: "implicit",
  debug: !1,
  hasCustomAuthorizationHeader: !1,
  throwOnError: !1,
  lockAcquireTimeout: 5e3,
  // 5 seconds. Only used when a custom `lock` is supplied. TODO(v3): remove.
  skipAutoInitialize: !1,
  experimental: {}
}, pr = {};
class Qn {
  /**
   * The JWKS used for verifying asymmetric JWTs
   */
  get jwks() {
    var e, r;
    return (r = (e = pr[this.storageKey]) === null || e === void 0 ? void 0 : e.jwks) !== null && r !== void 0 ? r : { keys: [] };
  }
  set jwks(e) {
    pr[this.storageKey] = Object.assign(Object.assign({}, pr[this.storageKey]), { jwks: e });
  }
  get jwks_cached_at() {
    var e, r;
    return (r = (e = pr[this.storageKey]) === null || e === void 0 ? void 0 : e.cachedAt) !== null && r !== void 0 ? r : Number.MIN_SAFE_INTEGER;
  }
  set jwks_cached_at(e) {
    pr[this.storageKey] = Object.assign(Object.assign({}, pr[this.storageKey]), { cachedAt: e });
  }
  /**
   * Create a new client for use in the browser.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const { data, error } = await supabase.auth.getUser()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { GoTrueClient } from '@supabase/auth-js'
   *
   * const auth = new GoTrueClient({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { apikey: 'your-publishable-key' },
   *   storageKey: 'supabase-auth',
   * })
   * ```
   */
  constructor(e) {
    var r, n, s;
    this.userStorage = null, this.memoryStorage = null, this.stateChangeEmitters = /* @__PURE__ */ new Map(), this.autoRefreshTicker = null, this.autoRefreshTickTimeout = null, this.visibilityChangedCallback = null, this.refreshingDeferred = null, this.lastRefreshFailure = null, this._sessionRemovalEpoch = 0, this.initializePromise = null, this._pendingInitNotifications = null, this.detectSessionInUrl = !0, this.hasCustomAuthorizationHeader = !1, this.suppressGetSessionWarning = !1, this.lock = null, this.lockAcquired = !1, this.pendingInLock = [], this.broadcastChannel = null, this.logger = console.log;
    const i = Object.assign(Object.assign({}, my), e);
    if (this.storageKey = i.storageKey, this.instanceID = (r = Qn.nextInstanceID[this.storageKey]) !== null && r !== void 0 ? r : 0, Qn.nextInstanceID[this.storageKey] = this.instanceID + 1, this.logDebugMessages = !!i.debug, typeof i.debug == "function" && (this.logger = i.debug), this.instanceID > 0 && oe()) {
      const o = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
      console.warn(o), this.logDebugMessages && console.trace(o);
    }
    if (this.persistSession = i.persistSession, this.autoRefreshToken = i.autoRefreshToken, this.experimental = (n = i.experimental) !== null && n !== void 0 ? n : {}, this.admin = new ry({
      url: i.url,
      headers: i.headers,
      fetch: i.fetch,
      experimental: this.experimental
    }), this.url = i.url, this.headers = i.headers, this.fetch = Zd(i.fetch), this.detectSessionInUrl = i.detectSessionInUrl, this.flowType = i.flowType, this.hasCustomAuthorizationHeader = i.hasCustomAuthorizationHeader, this.throwOnError = i.throwOnError, this.lockAcquireTimeout = i.lockAcquireTimeout, i.lock != null && (this.lock = i.lock), this.jwks || (this.jwks = { keys: [] }, this.jwks_cached_at = Number.MIN_SAFE_INTEGER), this.mfa = {
      verify: this._verify.bind(this),
      enroll: this._enroll.bind(this),
      unenroll: this._unenroll.bind(this),
      challenge: this._challenge.bind(this),
      listFactors: this._listFactors.bind(this),
      challengeAndVerify: this._challengeAndVerify.bind(this),
      getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
      webauthn: new gy(this)
    }, this.oauth = {
      getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
      approveAuthorization: this._approveAuthorization.bind(this),
      denyAuthorization: this._denyAuthorization.bind(this),
      listGrants: this._listOAuthGrants.bind(this),
      revokeGrant: this._revokeOAuthGrant.bind(this)
    }, this.passkey = {
      startRegistration: this._startPasskeyRegistration.bind(this),
      verifyRegistration: this._verifyPasskeyRegistration.bind(this),
      startAuthentication: this._startPasskeyAuthentication.bind(this),
      verifyAuthentication: this._verifyPasskeyAuthentication.bind(this),
      list: this._listPasskeys.bind(this),
      update: this._updatePasskey.bind(this),
      delete: this._deletePasskey.bind(this)
    }, this.persistSession ? (i.storage ? this.storage = i.storage : Xd() ? this.storage = globalThis.localStorage : (this.memoryStorage = {}, this.storage = dc(this.memoryStorage)), i.userStorage && (this.userStorage = i.userStorage)) : (this.memoryStorage = {}, this.storage = dc(this.memoryStorage)), oe() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
      try {
        this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
      } catch (o) {
        console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", o);
      }
      (s = this.broadcastChannel) === null || s === void 0 || s.addEventListener("message", async (o) => {
        this._debug("received broadcast notification from other tab or client", o), (o.data.event === "TOKEN_REFRESHED" || o.data.event === "SIGNED_IN") && (this.lastRefreshFailure = null);
        try {
          await this._notifyAllSubscribers(o.data.event, o.data.session, !1);
        } catch (a) {
          this._debug("#broadcastChannel", "error", a);
        }
      });
    }
    i.skipAutoInitialize || this.initialize().catch((o) => {
      this._debug("#initialize()", "error", o);
    });
  }
  /**
   * Returns whether error throwing mode is enabled for this client.
   */
  isThrowOnErrorEnabled() {
    return this.throwOnError;
  }
  /**
   * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
   * and the provided result contains a non-nullish error, the error is thrown instead of
   * being returned. This ensures consistent behavior across all public API methods.
   */
  _returnResult(e) {
    if (this.throwOnError && e && e.error)
      throw e.error;
    return e;
  }
  _logPrefix() {
    return `GoTrueClient@${this.storageKey}:${this.instanceID} (${Jd}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  _debug(...e) {
    return this.logDebugMessages && this.logger(this._logPrefix(), ...e), this;
  }
  /**
   * Initialize the auth client by loading the session from storage or
   * detecting it from the URL after an OAuth, magic-link, or password-recovery
   * redirect.
   *
   * **Most callers do not need to invoke this directly.** The client calls it
   * automatically during construction, and to react to sign-in events (including
   * post-redirect events) you should subscribe to `onAuthStateChange` rather
   * than awaiting `initialize()`.
   *
   * You only need to call it manually when you have opted out of the automatic
   * call by passing `skipAutoInitialize: true` — for example, in an SSR context
   * where you need to control initialization timing. In that case, awaiting
   * `initialize()` returns the resolved session result (or any error encountered
   * while detecting it from the URL).
   *
   * @category Auth
   */
  async initialize() {
    var e;
    if (this.initializePromise)
      return await this.initializePromise;
    this._pendingInitNotifications = [], this.initializePromise = (async () => this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => await this._initialize()) : await this._initialize())();
    const r = await this.initializePromise, n = (e = this._pendingInitNotifications) !== null && e !== void 0 ? e : [];
    this._pendingInitNotifications = null;
    for (const s of n)
      await this._notifyAllSubscribers(s.event, s.session, s.broadcast);
    return r;
  }
  /**
   * IMPORTANT:
   * 1. Never throw in this method, as it is called from the constructor
   * 2. Never return a session from this method as it would be cached over
   *    the whole lifetime of the client
   */
  async _initialize() {
    var e;
    try {
      let r = {}, n = "none";
      if (oe() && (r = ac(window.location.href), this._isImplicitGrantCallback(r) ? n = "implicit" : await this._isPKCECallback(r) && (n = "pkce")), oe() && this.detectSessionInUrl && n !== "none") {
        const { data: s, error: i } = await this._getSessionFromURL(r, n);
        if (i) {
          if (this._debug("#_initialize()", "error detecting session from URL", i), kv(i)) {
            const l = (e = i.details) === null || e === void 0 ? void 0 : e.code;
            if (l === "identity_already_exists" || l === "identity_not_found" || l === "single_identity_not_deletable")
              return { error: i };
          }
          return { error: i };
        }
        const { session: o, redirectType: a } = s;
        return this._debug("#_initialize()", "detected session in URL", o, "redirect type", a), await this._saveSession(o), setTimeout(async () => {
          a === "recovery" ? await this._notifyAllSubscribers("PASSWORD_RECOVERY", o) : await this._notifyAllSubscribers("SIGNED_IN", o);
        }, 0), { error: null };
      }
      return await this._recoverAndRefresh(), { error: null };
    } catch (r) {
      return C(r) ? this._returnResult({ error: r }) : this._returnResult({
        error: new Ge("Unexpected error during initialization", r)
      });
    } finally {
      await this._handleVisibilityChange(), this._debug("#_initialize()", "end");
    }
  }
  /**
   * Creates a new anonymous user.
   *
   * @returns A session where the is_anonymous claim in the access token JWT set to true
   *
   * @category Auth
   *
   * @remarks
   * - Returns an anonymous user
   * - It is recommended to set up captcha for anonymous sign-ins to prevent abuse. You can pass in the captcha token in the `options` param.
   *
   * @example Create an anonymous user
   * ```js
   * const { data, error } = await supabase.auth.signInAnonymously({
   *   options: {
   *     captchaToken
   *   }
   * });
   * ```
   *
   * @exampleResponse Create an anonymous user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {},
   *       "user_metadata": {},
   *       "identities": [],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": true
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {},
   *         "user_metadata": {},
   *         "identities": [],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": true
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Create an anonymous user with custom user metadata
   * ```js
   * const { data, error } = await supabase.auth.signInAnonymously({
   *   options: {
   *     data
   *   }
   * })
   * ```
   */
  async signInAnonymously(e) {
    var r, n, s;
    try {
      const i = await x(this.fetch, "POST", `${this.url}/signup`, {
        headers: this.headers,
        body: {
          data: (n = (r = e == null ? void 0 : e.options) === null || r === void 0 ? void 0 : r.data) !== null && n !== void 0 ? n : {},
          gotrue_meta_security: { captcha_token: (s = e == null ? void 0 : e.options) === null || s === void 0 ? void 0 : s.captchaToken }
        },
        xform: Ie
      }), { data: o, error: a } = i;
      if (a || !o)
        return this._returnResult({ data: { user: null, session: null }, error: a });
      const l = o.session, u = o.user;
      return o.session && (await this._saveSession(o.session), await this._notifyAllSubscribers("SIGNED_IN", l)), this._returnResult({ data: { user: u, session: l }, error: null });
    } catch (i) {
      if (C(i))
        return this._returnResult({ data: { user: null, session: null }, error: i });
      throw i;
    }
  }
  /**
   * Creates a new user.
   *
   * Be aware that if a user account exists in the system you may get back an
   * error message that attempts to hide this information from the user.
   * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   *
   * @category Auth
   *
   * @remarks
   * - By default, the user needs to verify their email address before logging in. To turn this off, disable **Confirm email** in [your project](/dashboard/project/_/auth/providers).
   * - **Confirm email** determines if users need to confirm their email address after signing up.
   *   - If **Confirm email** is enabled, a `user` is returned but `session` is null.
   *   - If **Confirm email** is disabled, both a `user` and a `session` are returned.
   * - When the user confirms their email address, they are redirected to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) by default. You can modify your `SITE_URL` or add additional redirect URLs in [your project](/dashboard/project/_/auth/url-configuration).
   * - If signUp() is called for an existing confirmed user:
   *   - When both **Confirm email** and **Confirm phone** (even when phone provider is disabled) are enabled in [your project](/dashboard/project/_/auth/providers), an obfuscated/fake user object is returned.
   *   - When either **Confirm email** or **Confirm phone** (even when phone provider is disabled) is disabled, the error message, `User already registered` is returned.
   * - To fetch the currently logged-in user, refer to [`getUser()`](/docs/reference/javascript/auth-getuser).
   *
   * @example Sign up with an email and password
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * ```
   *
   * @exampleResponse Sign up with an email and password
   * ```json
   * // Some fields may be null if "confirm email" is enabled.
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z"
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {},
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z"
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Sign up with a phone number and password (SMS)
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   phone: '123456789',
   *   password: 'example-password',
   *   options: {
   *     channel: 'sms'
   *   }
   * })
   * ```
   *
   * @exampleDescription Sign up with a phone number and password (whatsapp)
   * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
   *
   * @example Sign up with a phone number and password (whatsapp)
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   phone: '123456789',
   *   password: 'example-password',
   *   options: {
   *     channel: 'whatsapp'
   *   }
   * })
   * ```
   *
   * @example Sign up with additional user metadata
   * ```js
   * const { data, error } = await supabase.auth.signUp(
   *   {
   *     email: 'example@email.com',
   *     password: 'example-password',
   *     options: {
   *       data: {
   *         first_name: 'John',
   *         age: 27,
   *       }
   *     }
   *   }
   * )
   * ```
   *
   * @exampleDescription Sign up with a redirect URL
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   *
   * @example Sign up with a redirect URL
   * ```js
   * const { data, error } = await supabase.auth.signUp(
   *   {
   *     email: 'example@email.com',
   *     password: 'example-password',
   *     options: {
   *       emailRedirectTo: 'https://example.com/welcome'
   *     }
   *   }
   * )
   * ```
   */
  async signUp(e) {
    var r, n, s;
    let i = null;
    try {
      let o;
      if ("email" in e) {
        const { email: h, password: d, options: g } = e;
        let v = null, y = null;
        this.flowType === "pkce" && ([v, y, i] = await this._getCodeChallengeAndMethod()), o = await x(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          redirectTo: this._maybeAppendFlowIdToRedirect(g == null ? void 0 : g.emailRedirectTo, i),
          body: {
            email: h,
            password: d,
            data: (r = g == null ? void 0 : g.data) !== null && r !== void 0 ? r : {},
            gotrue_meta_security: { captcha_token: g == null ? void 0 : g.captchaToken },
            code_challenge: v,
            code_challenge_method: y
          },
          xform: Ie
        });
      } else if ("phone" in e) {
        const { phone: h, password: d, options: g } = e;
        o = await x(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          body: {
            phone: h,
            password: d,
            data: (n = g == null ? void 0 : g.data) !== null && n !== void 0 ? n : {},
            channel: (s = g == null ? void 0 : g.channel) !== null && s !== void 0 ? s : "sms",
            gotrue_meta_security: { captcha_token: g == null ? void 0 : g.captchaToken }
          },
          xform: Ie
        });
      } else
        throw new xs("You must provide either an email or phone number and a password");
      const { data: a, error: l } = o;
      if (l || !a)
        return await Fe(this.storage, this.storageKey, i), this._returnResult({ data: { user: null, session: null }, error: l });
      const u = a.session, c = a.user;
      return a.session && (await this._saveSession(a.session), await this._notifyAllSubscribers("SIGNED_IN", u)), this._returnResult({ data: { user: c, session: u }, error: null });
    } catch (o) {
      if (await Fe(this.storage, this.storageKey, i), C(o))
        return this._returnResult({ data: { user: null, session: null }, error: o });
      throw o;
    }
  }
  /**
   * Log in an existing user with an email and password or phone and password.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or that the
   * email/phone and password combination is wrong or that the account can only
   * be accessed via social login.
   *
   * @category Auth
   *
   * @remarks
   * - Requires either an email and password or a phone number and password.
   *
   * @example Sign in with email and password
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * ```
   *
   * @exampleResponse Sign in with email and password
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z"
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {},
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z"
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Sign in with phone and password
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   phone: '+13334445555',
   *   password: 'some-password',
   * })
   * ```
   *
   * @exampleDescription Handling errors
   * Log the full `error` object so fields like `code`, `status`, and `name` aren't hidden. The `error.code` (e.g. `'invalid_credentials'`, `'email_not_confirmed'`) is often more useful for branching than `error.message`, and the full object surfaces both.
   *
   * @example Handling errors
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * if (error) {
   *   console.error(error)
   *   return
   * }
   * ```
   */
  async signInWithPassword(e) {
    try {
      let r;
      if ("email" in e) {
        const { email: i, password: o, options: a } = e;
        r = await x(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            email: i,
            password: o,
            gotrue_meta_security: { captcha_token: a == null ? void 0 : a.captchaToken }
          },
          xform: cc
        });
      } else if ("phone" in e) {
        const { phone: i, password: o, options: a } = e;
        r = await x(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            phone: i,
            password: o,
            gotrue_meta_security: { captcha_token: a == null ? void 0 : a.captchaToken }
          },
          xform: cc
        });
      } else
        throw new xs("You must provide either an email or phone number and a password");
      const { data: n, error: s } = r;
      if (s)
        return this._returnResult({ data: { user: null, session: null }, error: s });
      if (!n || !n.session || !n.user) {
        const i = new fr();
        return this._returnResult({ data: { user: null, session: null }, error: i });
      }
      return n.session && (await this._saveSession(n.session), await this._notifyAllSubscribers("SIGNED_IN", n.session)), this._returnResult({
        data: Object.assign({ user: n.user, session: n.session }, n.weak_password ? { weakPassword: n.weak_password } : null),
        error: s
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Log in an existing user via a third-party provider.
   * This method supports the PKCE flow.
   *
   * @category Auth
   *
   * @remarks
   * - This method is used for signing in using [Social Login (OAuth) providers](/docs/guides/auth#configure-third-party-providers).
   * - It works by redirecting your application to the provider's authorization screen, before bringing back the user to your app.
   *
   * @example Sign in using a third-party provider
   * ```js
   * const { data, error } = await supabase.auth.signInWithOAuth({
   *   provider: 'github'
   * })
   * ```
   *
   * @exampleResponse Sign in using a third-party provider
   * ```json
   * {
   *   data: {
   *     provider: 'github',
   *     url: <PROVIDER_URL_TO_REDIRECT_TO>,
   *     flowId: <PKCE_FLOW_ID_OR_NULL>
   *   },
   *   error: null
   * }
   * ```
   *
   * @exampleDescription Sign in using a third-party provider with redirect
   * - When the OAuth provider successfully authenticates the user, they are redirected to the URL specified in the `redirectTo` parameter. This parameter defaults to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls). It does not redirect the user immediately after invoking this method.
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   *
   * @example Sign in using a third-party provider with redirect
   * ```js
   * const { data, error } = await supabase.auth.signInWithOAuth({
   *   provider: 'github',
   *   options: {
   *     redirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleDescription Sign in with scopes and access provider tokens
   * If you need additional access from an OAuth provider, in order to access provider specific APIs in the name of the user, you can do this by passing in the scopes the user should authorize for your application. Note that the `scopes` option takes in **a space-separated list** of scopes.
   *
   * Because OAuth sign-in often includes redirects, you should register an `onAuthStateChange` callback immediately after you create the Supabase client. This callback will listen for the presence of `provider_token` and `provider_refresh_token` properties on the `session` object and store them in local storage. The client library will emit these values **only once** immediately after the user signs in. You can then access them by looking them up in local storage, or send them to your backend servers for further processing.
   *
   * Finally, make sure you remove them from local storage on the `SIGNED_OUT` event. If the OAuth provider supports token revocation, make sure you call those APIs either from the frontend or schedule them to be called on the backend.
   *
   * @example Sign in with scopes and access provider tokens
   * ```js
   * // Register this immediately after calling createClient!
   * // Because signInWithOAuth causes a redirect, you need to fetch the
   * // provider tokens from the callback.
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (session && session.provider_token) {
   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)
   *   }
   *
   *   if (session && session.provider_refresh_token) {
   *     window.localStorage.setItem('oauth_provider_refresh_token', session.provider_refresh_token)
   *   }
   *
   *   if (event === 'SIGNED_OUT') {
   *     window.localStorage.removeItem('oauth_provider_token')
   *     window.localStorage.removeItem('oauth_provider_refresh_token')
   *   }
   * })
   *
   * // Call this on your Sign in with GitHub button to initiate OAuth
   * // with GitHub with the requested elevated scopes.
   * await supabase.auth.signInWithOAuth({
   *   provider: 'github',
   *   options: {
   *     scopes: 'repo gist notifications'
   *   }
   * })
   * ```
   */
  async signInWithOAuth(e) {
    var r, n, s, i;
    return await this._handleProviderSignIn(e.provider, {
      redirectTo: (r = e.options) === null || r === void 0 ? void 0 : r.redirectTo,
      scopes: (n = e.options) === null || n === void 0 ? void 0 : n.scopes,
      queryParams: (s = e.options) === null || s === void 0 ? void 0 : s.queryParams,
      skipBrowserRedirect: (i = e.options) === null || i === void 0 ? void 0 : i.skipBrowserRedirect
    });
  }
  /**
   * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
   *
   * @category Auth
   *
   * @remarks
   * - Used when `flowType` is set to `pkce` in client options.
   * - When several PKCE flows are in flight at once, pass `options.flowId` so
   *   the code is exchanged with the verifier created by that specific flow.
   *   The flow id is returned by `signInWithOAuth`, and with
   *   `experimental.appendPkceFlowIdToRedirects` enabled it also arrives on
   *   your callback URL as the reserved `sb_flow_id` query parameter (read
   *   automatically in a browser).
   * - When a flow id is present but its stored verifier is gone (evicted,
   *   already used, or from another device), the call fails with a verifier
   *   missing error instead of trying another flow's verifier — a mismatched
   *   verifier would consume the single-use code. Without any flow id the
   *   most recently stored verifier is used, as before.
   *
   * @example Exchange Auth Code
   * ```js
   * supabase.auth.exchangeCodeForSession('34e770dd-9ff9-416c-87fa-43b31d7ef225')
   * ```
   *
   * @example Exchange Auth Code for a specific flow (e.g. in a server-side callback handler)
   * ```js
   * const flowId = requestUrl.searchParams.get('sb_flow_id')
   * supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
   * ```
   *
   * @exampleResponse Exchange Auth Code
   * ```json
   * {
   *   "data": {
   *     session: {
   *       access_token: '<ACCESS_TOKEN>',
   *       token_type: 'bearer',
   *       expires_in: 3600,
   *       expires_at: 1700000000,
   *       refresh_token: '<REFRESH_TOKEN>',
   *       user: {
   *         id: '11111111-1111-1111-1111-111111111111',
   *         aud: 'authenticated',
   *         role: 'authenticated',
   *         email: 'example@email.com'
   *         email_confirmed_at: '2024-01-01T00:00:00Z',
   *         phone: '',
   *         confirmation_sent_at: '2024-01-01T00:00:00Z',
   *         confirmed_at: '2024-01-01T00:00:00Z',
   *         last_sign_in_at: '2024-01-01T00:00:00Z',
   *         app_metadata: {
   *           "provider": "email",
   *           "providers": [
   *             "email",
   *             "<OTHER_PROVIDER>"
   *           ]
   *         },
   *         user_metadata: {
   *           email: 'email@email.com',
   *           email_verified: true,
   *           full_name: 'User Name',
   *           iss: '<ISS>',
   *           name: 'User Name',
   *           phone_verified: false,
   *           provider_id: '<PROVIDER_ID>',
   *           sub: '<SUB>'
   *         },
   *         identities: [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "email@example.com"
   *           },
   *           {
   *             "identity_id": "33333333-3333-3333-3333-333333333333",
   *             "id": "<ID>",
   *             "user_id": "<USER_ID>",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": true,
   *               "full_name": "User Name",
   *               "iss": "<ISS>",
   *               "name": "User Name",
   *               "phone_verified": false,
   *               "provider_id": "<PROVIDER_ID>",
   *               "sub": "<SUB>"
   *             },
   *             "provider": "<PROVIDER>",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         created_at: '2024-01-01T00:00:00Z',
   *         updated_at: '2024-01-01T00:00:00Z',
   *         is_anonymous: false
   *       },
   *       provider_token: '<PROVIDER_TOKEN>',
   *       provider_refresh_token: '<PROVIDER_REFRESH_TOKEN>'
   *     },
   *     user: {
   *       id: '11111111-1111-1111-1111-111111111111',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {
   *         provider: 'email',
   *         providers: [
   *           "email",
   *           "<OTHER_PROVIDER>"
   *         ]
   *       },
   *       user_metadata: {
   *         email: 'email@email.com',
   *         email_verified: true,
   *         full_name: 'User Name',
   *         iss: '<ISS>',
   *         name: 'User Name',
   *         phone_verified: false,
   *         provider_id: '<PROVIDER_ID>',
   *         sub: '<SUB>'
   *       },
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *         {
   *           "identity_id": "33333333-3333-3333-3333-333333333333",
   *           "id": "<ID>",
   *           "user_id": "<USER_ID>",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "full_name": "User Name",
   *             "iss": "<ISS>",
   *             "name": "User Name",
   *             "phone_verified": false,
   *             "provider_id": "<PROVIDER_ID>",
   *             "sub": "<SUB>"
   *           },
   *           "provider": "<PROVIDER>",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false
   *     },
   *     redirectType: null
   *   },
   *   "error": null
   * }
   * ```
   */
  async exchangeCodeForSession(e, r) {
    return await this.initializePromise, this.lock != null ? this._acquireLock(this.lockAcquireTimeout, async () => this._exchangeCodeForSession(e, r)) : this._exchangeCodeForSession(e, r);
  }
  /**
   * Signs in a user by verifying a message signed by the user's private key.
   * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
   * both of which derive from the EIP-4361 standard
   * With slight variation on Solana's side.
   * @reference https://eips.ethereum.org/EIPS/eip-4361
   *
   * @category Auth
   *
   * @remarks
   * - Uses a Web3 (Ethereum, Solana) wallet to sign a user in.
   * - Read up on the [potential for abuse](/docs/guides/auth/auth-web3#potential-for-abuse) before using it.
   *
   * @example Sign in with Solana or Ethereum (Window API)
   * ```js
   *   // uses window.ethereum for the wallet
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'ethereum',
   *     statement: 'I accept the Terms of Service at https://example.com/tos'
   *   })
   *
   *   // uses window.solana for the wallet
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'solana',
   *     statement: 'I accept the Terms of Service at https://example.com/tos'
   *   })
   * ```
   *
   * @example Sign in with Ethereum (Message and Signature)
   * ```js
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'ethereum',
   *     message: '<sign in with ethereum message>',
   *     signature: '<hex of the ethereum signature over the message>',
   *   })
   * ```
   *
   * @example Sign in with Solana (Brave)
   * ```js
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'solana',
   *     statement: 'I accept the Terms of Service at https://example.com/tos',
   *     wallet: window.braveSolana
   *   })
   * ```
   *
   * @example Sign in with Solana (Wallet Adapter)
   * ```jsx
   *   function SignInButton() {
   *   const wallet = useWallet()
   *
   *   return (
   *     <>
   *       {wallet.connected ? (
   *         <button
   *           onClick={() => {
   *             supabase.auth.signInWithWeb3({
   *               chain: 'solana',
   *               statement: 'I accept the Terms of Service at https://example.com/tos',
   *               wallet,
   *             })
   *           }}
   *         >
   *           Sign in with Solana
   *         </button>
   *       ) : (
   *         <WalletMultiButton />
   *       )}
   *     </>
   *   )
   * }
   *
   * function App() {
   *   const endpoint = clusterApiUrl('devnet')
   *   const wallets = useMemo(() => [], [])
   *
   *   return (
   *     <ConnectionProvider endpoint={endpoint}>
   *       <WalletProvider wallets={wallets}>
   *         <WalletModalProvider>
   *           <SignInButton />
   *         </WalletModalProvider>
   *       </WalletProvider>
   *     </ConnectionProvider>
   *   )
   * }
   * ```
   */
  async signInWithWeb3(e) {
    const { chain: r } = e;
    switch (r) {
      case "ethereum":
        return await this.signInWithEthereum(e);
      case "solana":
        return await this.signInWithSolana(e);
      default:
        throw new Error(`@supabase/auth-js: Unsupported chain "${r}"`);
    }
  }
  async signInWithEthereum(e) {
    var r, n, s, i, o, a, l, u, c, h, d;
    let g, v;
    if ("message" in e)
      g = e.message, v = e.signature;
    else {
      const { chain: y, wallet: k, statement: f, options: p } = e;
      let m;
      if (oe())
        if (typeof k == "object")
          m = k;
        else {
          const U = window;
          if ("ethereum" in U && typeof U.ethereum == "object" && "request" in U.ethereum && typeof U.ethereum.request == "function")
            m = U.ethereum;
          else
            throw new Error("@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.");
        }
      else {
        if (typeof k != "object" || !(p != null && p.url))
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        m = k;
      }
      const w = new URL((r = p == null ? void 0 : p.url) !== null && r !== void 0 ? r : window.location.href), T = await m.request({
        method: "eth_requestAccounts"
      }).then((U) => U).catch(() => {
        throw new Error("@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid");
      });
      if (!T || T.length === 0)
        throw new Error("@supabase/auth-js: No accounts available. Please ensure the wallet is connected.");
      const E = tf(T[0]);
      let b = (n = p == null ? void 0 : p.signInWithEthereum) === null || n === void 0 ? void 0 : n.chainId;
      if (!b) {
        const U = await m.request({
          method: "eth_chainId"
        });
        b = iy(U);
      }
      const A = {
        domain: w.host,
        address: E,
        statement: f,
        uri: w.href,
        version: "1",
        chainId: b,
        nonce: (s = p == null ? void 0 : p.signInWithEthereum) === null || s === void 0 ? void 0 : s.nonce,
        issuedAt: (o = (i = p == null ? void 0 : p.signInWithEthereum) === null || i === void 0 ? void 0 : i.issuedAt) !== null && o !== void 0 ? o : /* @__PURE__ */ new Date(),
        expirationTime: (a = p == null ? void 0 : p.signInWithEthereum) === null || a === void 0 ? void 0 : a.expirationTime,
        notBefore: (l = p == null ? void 0 : p.signInWithEthereum) === null || l === void 0 ? void 0 : l.notBefore,
        requestId: (u = p == null ? void 0 : p.signInWithEthereum) === null || u === void 0 ? void 0 : u.requestId,
        resources: (c = p == null ? void 0 : p.signInWithEthereum) === null || c === void 0 ? void 0 : c.resources
      };
      g = ay(A), v = await m.request({
        method: "personal_sign",
        params: [oy(g), E]
      });
    }
    try {
      const { data: y, error: k } = await x(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({
          chain: "ethereum",
          message: g,
          signature: v
        }, !((h = e.options) === null || h === void 0) && h.captchaToken ? { gotrue_meta_security: { captcha_token: (d = e.options) === null || d === void 0 ? void 0 : d.captchaToken } } : null),
        xform: Ie
      });
      if (k)
        throw k;
      if (!y || !y.session || !y.user) {
        const f = new fr();
        return this._returnResult({ data: { user: null, session: null }, error: f });
      }
      return y.session && (await this._saveSession(y.session), await this._notifyAllSubscribers("SIGNED_IN", y.session)), this._returnResult({ data: Object.assign({}, y), error: k });
    } catch (y) {
      if (C(y))
        return this._returnResult({ data: { user: null, session: null }, error: y });
      throw y;
    }
  }
  async signInWithSolana(e) {
    var r, n, s, i, o, a, l, u, c, h, d, g;
    let v, y;
    if ("message" in e)
      v = e.message, y = e.signature;
    else {
      const { chain: k, wallet: f, statement: p, options: m } = e;
      let w;
      if (oe())
        if (typeof f == "object")
          w = f;
        else {
          const E = window;
          if ("solana" in E && typeof E.solana == "object" && ("signIn" in E.solana && typeof E.solana.signIn == "function" || "signMessage" in E.solana && typeof E.solana.signMessage == "function"))
            w = E.solana;
          else
            throw new Error("@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.");
        }
      else {
        if (typeof f != "object" || !(m != null && m.url))
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        w = f;
      }
      const T = new URL((r = m == null ? void 0 : m.url) !== null && r !== void 0 ? r : window.location.href);
      if ("signIn" in w && w.signIn) {
        const E = await w.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, m == null ? void 0 : m.signInWithSolana), {
          // non-overridable properties
          version: "1",
          domain: T.host,
          uri: T.href
        }), p ? { statement: p } : null));
        let b;
        if (Array.isArray(E) && E[0] && typeof E[0] == "object")
          b = E[0];
        else if (E && typeof E == "object" && "signedMessage" in E && "signature" in E)
          b = E;
        else
          throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
        if ("signedMessage" in b && "signature" in b && (typeof b.signedMessage == "string" || b.signedMessage instanceof Uint8Array) && b.signature instanceof Uint8Array)
          v = typeof b.signedMessage == "string" ? b.signedMessage : new TextDecoder().decode(b.signedMessage), y = b.signature;
        else
          throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
      } else {
        if (!("signMessage" in w) || typeof w.signMessage != "function" || !("publicKey" in w) || typeof w != "object" || !w.publicKey || !("toBase58" in w.publicKey) || typeof w.publicKey.toBase58 != "function")
          throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
        v = [
          `${T.host} wants you to sign in with your Solana account:`,
          w.publicKey.toBase58(),
          ...p ? ["", p, ""] : [""],
          "Version: 1",
          `URI: ${T.href}`,
          `Issued At: ${(s = (n = m == null ? void 0 : m.signInWithSolana) === null || n === void 0 ? void 0 : n.issuedAt) !== null && s !== void 0 ? s : (/* @__PURE__ */ new Date()).toISOString()}`,
          ...!((i = m == null ? void 0 : m.signInWithSolana) === null || i === void 0) && i.notBefore ? [`Not Before: ${m.signInWithSolana.notBefore}`] : [],
          ...!((o = m == null ? void 0 : m.signInWithSolana) === null || o === void 0) && o.expirationTime ? [`Expiration Time: ${m.signInWithSolana.expirationTime}`] : [],
          ...!((a = m == null ? void 0 : m.signInWithSolana) === null || a === void 0) && a.chainId ? [`Chain ID: ${m.signInWithSolana.chainId}`] : [],
          ...!((l = m == null ? void 0 : m.signInWithSolana) === null || l === void 0) && l.nonce ? [`Nonce: ${m.signInWithSolana.nonce}`] : [],
          ...!((u = m == null ? void 0 : m.signInWithSolana) === null || u === void 0) && u.requestId ? [`Request ID: ${m.signInWithSolana.requestId}`] : [],
          ...!((h = (c = m == null ? void 0 : m.signInWithSolana) === null || c === void 0 ? void 0 : c.resources) === null || h === void 0) && h.length ? [
            "Resources",
            ...m.signInWithSolana.resources.map((b) => `- ${b}`)
          ] : []
        ].join(`
`);
        const E = await w.signMessage(new TextEncoder().encode(v), "utf8");
        if (!E || !(E instanceof Uint8Array))
          throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
        y = E;
      }
    }
    try {
      const { data: k, error: f } = await x(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({ chain: "solana", message: v, signature: er(y) }, !((d = e.options) === null || d === void 0) && d.captchaToken ? { gotrue_meta_security: { captcha_token: (g = e.options) === null || g === void 0 ? void 0 : g.captchaToken } } : null),
        xform: Ie
      });
      if (f)
        throw f;
      if (!k || !k.session || !k.user) {
        const p = new fr();
        return this._returnResult({ data: { user: null, session: null }, error: p });
      }
      return k.session && (await this._saveSession(k.session), await this._notifyAllSubscribers("SIGNED_IN", k.session)), this._returnResult({ data: Object.assign({}, k), error: f });
    } catch (k) {
      if (C(k))
        return this._returnResult({ data: { user: null, session: null }, error: k });
      throw k;
    }
  }
  async _exchangeCodeForSession(e, r) {
    const n = (r == null ? void 0 : r.flowId) != null, s = n ? Ks(r == null ? void 0 : r.flowId) : oe() ? Ks(ac(window.location.href)[Zt]) : null;
    n && !s && this._debug("#_exchangeCodeForSession()", "provided flowId is not a valid flow id", r == null ? void 0 : r.flowId);
    const { verifier: i, flowId: o } = n && !s ? { verifier: null, flowId: null } : await zv(this.storage, this.storageKey, s), [a, l] = (i ?? "").split("/");
    try {
      if (!a && this.flowType === "pkce")
        throw new Sv();
      const { data: u, error: c } = await x(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
        headers: this.headers,
        body: {
          auth_code: e,
          code_verifier: a
        },
        xform: Ie
      });
      if (await Fe(this.storage, this.storageKey, o), c)
        throw c;
      if (!u || !u.session || !u.user) {
        const h = new fr();
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: h
        });
      }
      return u.session && (await this._saveSession(u.session), await this._notifyAllSubscribers(l === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", u.session)), this._returnResult({ data: Object.assign(Object.assign({}, u), { redirectType: l ?? null }), error: c });
    } catch (u) {
      if (await Fe(this.storage, this.storageKey, o), C(u))
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: u
        });
      throw u;
    }
  }
  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
   *
   * @category Auth
   *
   * @remarks
   * - Use an ID token to sign in.
   * - Especially useful when implementing sign in using native platform dialogs in mobile or desktop apps using Sign in with Apple or Sign in with Google on iOS and Android.
   * - You can also use Google's [One Tap](https://developers.google.com/identity/gsi/web/guides/display-google-one-tap) and [Automatic sign-in](https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out) via this API.
   *
   * @example Sign In using ID Token
   * ```js
   * const { data, error } = await supabase.auth.signInWithIdToken({
   *   provider: 'google',
   *   token: 'your-id-token'
   * })
   * ```
   *
   * @exampleResponse Sign In using ID Token
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         ...
   *       },
   *       "user_metadata": {
   *         ...
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "provider": "google",
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           ...
   *         },
   *         "user_metadata": {
   *           ...
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "provider": "google",
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async signInWithIdToken(e) {
    try {
      const { options: r, provider: n, token: s, access_token: i, nonce: o } = e, a = await x(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
        headers: this.headers,
        body: {
          provider: n,
          id_token: s,
          access_token: i,
          nonce: o,
          gotrue_meta_security: { captcha_token: r == null ? void 0 : r.captchaToken }
        },
        xform: Ie
      }), { data: l, error: u } = a;
      if (u)
        return this._returnResult({ data: { user: null, session: null }, error: u });
      if (!l || !l.session || !l.user) {
        const c = new fr();
        return this._returnResult({ data: { user: null, session: null }, error: c });
      }
      return l.session && (await this._saveSession(l.session), await this._notifyAllSubscribers("SIGNED_IN", l.session)), this._returnResult({ data: l, error: u });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Log in a user using magiclink or a one-time password (OTP).
   *
   * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
   * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
   * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or, that the account
   * can only be accessed via social login.
   *
   * Do note that you will need to configure a Whatsapp sender on Twilio
   * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
   * channel is not supported on other providers
   * at this time.
   * This method supports PKCE when an email is passed.
   *
   * @category Auth
   *
   * @remarks
   * - Requires either an email or phone number.
   * - This method is used for passwordless sign-ins where a OTP is sent to the user's email or phone number.
   * - If the user doesn't exist, `signInWithOtp()` will signup the user instead. To restrict this behavior, you can set `shouldCreateUser` in `SignInWithPasswordlessCredentials.options` to `false`.
   * - If you're using an email, you can configure whether you want the user to receive a magiclink or a OTP.
   * - If you're using phone, you can configure whether you want the user to receive a OTP.
   * - The magic link's destination URL is determined by the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls).
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   * - Magic links and OTPs share the same implementation. To send users a one-time code instead of a magic link, [modify the magic link email template](/dashboard/project/_/auth/templates) to include `{{ .Token }}` instead of `{{ .ConfirmationURL }}`.
   * - See our [Twilio Phone Auth Guide](/docs/guides/auth/phone-login?showSMSProvider=Twilio) for details about configuring WhatsApp sign in.
   *
   * @exampleDescription Sign in with email
   * The user will be sent an email which contains either a magiclink or a OTP or both. By default, a given user can only request a OTP once every 60 seconds.
   *
   * @example Sign in with email
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   email: 'example@email.com',
   *   options: {
   *     emailRedirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleResponse Sign in with email
   * ```json
   * {
   *   "data": {
   *     "user": null,
   *     "session": null
   *   },
   *   "error": null
   * }
   * ```
   *
   * @exampleDescription Sign in with SMS OTP
   * The user will be sent a SMS which contains a OTP. By default, a given user can only request a OTP once every 60 seconds.
   *
   * @example Sign in with SMS OTP
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   phone: '+13334445555',
   * })
   * ```
   *
   * @exampleDescription Sign in with WhatsApp OTP
   * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
   *
   * @example Sign in with WhatsApp OTP
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   phone: '+13334445555',
   *   options: {
   *     channel:'whatsapp',
   *   }
   * })
   * ```
   */
  async signInWithOtp(e) {
    var r, n, s, i, o;
    let a = null;
    try {
      if ("email" in e) {
        const { email: l, options: u } = e;
        let c = null, h = null;
        this.flowType === "pkce" && ([c, h, a] = await this._getCodeChallengeAndMethod());
        const { error: d } = await x(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            email: l,
            data: (r = u == null ? void 0 : u.data) !== null && r !== void 0 ? r : {},
            create_user: (n = u == null ? void 0 : u.shouldCreateUser) !== null && n !== void 0 ? n : !0,
            gotrue_meta_security: { captcha_token: u == null ? void 0 : u.captchaToken },
            code_challenge: c,
            code_challenge_method: h
          },
          redirectTo: this._maybeAppendFlowIdToRedirect(u == null ? void 0 : u.emailRedirectTo, a)
        });
        return this._returnResult({ data: { user: null, session: null }, error: d });
      }
      if ("phone" in e) {
        const { phone: l, options: u } = e, { data: c, error: h } = await x(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            phone: l,
            data: (s = u == null ? void 0 : u.data) !== null && s !== void 0 ? s : {},
            create_user: (i = u == null ? void 0 : u.shouldCreateUser) !== null && i !== void 0 ? i : !0,
            gotrue_meta_security: { captcha_token: u == null ? void 0 : u.captchaToken },
            channel: (o = u == null ? void 0 : u.channel) !== null && o !== void 0 ? o : "sms"
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: c == null ? void 0 : c.message_id },
          error: h
        });
      }
      throw new xs("You must provide either an email or phone number.");
    } catch (l) {
      if (await Fe(this.storage, this.storageKey, a), C(l))
        return this._returnResult({ data: { user: null, session: null }, error: l });
      throw l;
    }
  }
  /**
   * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
   *
   * @category Auth
   *
   * @remarks
   * - The `verifyOtp` method takes in different verification types.
   * - If a phone number is used, the type can either be:
   *   1. `sms` – Used when verifying a one-time password (OTP) sent via SMS during sign-up or sign-in.
   *   2. `phone_change` – Used when verifying an OTP sent to a new phone number during a phone number update process.
   * - If an email address is used, the type can be one of the following (note: `signup` and `magiclink` types are deprecated):
   *   1. `email` – Used when verifying an OTP sent to the user's email during sign-up or sign-in.
   *   2. `recovery` – Used when verifying an OTP sent for account recovery, typically after a password reset request.
   *   3. `invite` – Used when verifying an OTP sent as part of an invitation to join a project or organization.
   *   4. `email_change` – Used when verifying an OTP sent to a new email address during an email update process.
   * - The verification type used should be determined based on the corresponding auth method called before `verifyOtp` to sign up / sign-in a user.
   * - The `TokenHash` is contained in the [email templates](/docs/guides/auth/auth-email-templates) and can be used to sign in.  You may wish to use the hash for the PKCE flow for Server Side Auth. Read [the Password-based Auth guide](/docs/guides/auth/passwords) for more details.
   *
   * @example Verify Signup One-Time Password (OTP)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email'})
   * ```
   *
   * @exampleResponse Verify Signup One-Time Password (OTP)
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "recovery_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "recovery_sent_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Verify SMS One-Time Password (OTP)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms'})
   * ```
   *
   * @example Verify Email Auth (Token Hash)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email'})
   * ```
   */
  async verifyOtp(e) {
    var r, n;
    try {
      let s, i;
      "options" in e && (s = (r = e.options) === null || r === void 0 ? void 0 : r.redirectTo, i = (n = e.options) === null || n === void 0 ? void 0 : n.captchaToken);
      const { data: o, error: a } = await x(this.fetch, "POST", `${this.url}/verify`, {
        headers: this.headers,
        body: Object.assign(Object.assign({}, e), { gotrue_meta_security: { captcha_token: i } }),
        redirectTo: s,
        xform: Ie
      });
      if (a)
        throw a;
      if (!o)
        throw new Error("An error occurred on token verification.");
      const l = o.session, u = o.user;
      return l != null && l.access_token && (await this._saveSession(l), await this._notifyAllSubscribers(e.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", l)), this._returnResult({ data: { user: u, session: l }, error: null });
    } catch (s) {
      if (C(s))
        return this._returnResult({ data: { user: null, session: null }, error: s });
      throw s;
    }
  }
  /**
   * Attempts a single-sign on using an enterprise Identity Provider. A
   * successful SSO attempt will redirect the current page to the identity
   * provider authorization page. The redirect URL is implementation and SSO
   * protocol specific.
   *
   * You can use it by providing a SSO domain. Typically you can extract this
   * domain by asking users for their email address. If this domain is
   * registered on the Auth instance the redirect will use that organization's
   * currently active SSO Identity Provider for the login.
   *
   * If you have built an organization-specific login page, you can use the
   * organization's SSO Identity Provider UUID directly instead.
   *
   * @category Auth
   *
   * @remarks
   * - Before you can call this method you need to [establish a connection](/docs/guides/auth/sso/auth-sso-saml#managing-saml-20-connections) to an identity provider. Use the [CLI commands](/docs/reference/cli/supabase-sso) to do this.
   * - If you've associated an email domain to the identity provider, you can use the `domain` property to start a sign-in flow.
   * - In case you need to use a different way to start the authentication flow with an identity provider, you can use the `providerId` property. For example:
   *     - Mapping specific user email addresses with an identity provider.
   *     - Using different hints to identity the identity provider to be used by the user, like a company-specific page, IP address or other tracking information.
   *
   * @example Sign in with email domain
   * ```js
   *   // You can extract the user's email domain and use it to trigger the
   *   // authentication flow with the correct identity provider.
   *
   *   const { data, error } = await supabase.auth.signInWithSSO({
   *     domain: 'company.com'
   *   })
   *
   *   if (data?.url) {
   *     // redirect the user to the identity provider's authentication flow
   *     window.location.href = data.url
   *   }
   * ```
   *
   * @example Sign in with provider UUID
   * ```js
   *   // Useful when you need to map a user's sign in request according
   *   // to different rules that can't use email domains.
   *
   *   const { data, error } = await supabase.auth.signInWithSSO({
   *     providerId: '21648a9d-8d5a-4555-a9d1-d6375dc14e92'
   *   })
   *
   *   if (data?.url) {
   *     // redirect the user to the identity provider's authentication flow
   *     window.location.href = data.url
   *   }
   * ```
   */
  async signInWithSSO(e) {
    var r, n, s, i;
    let o = null;
    try {
      let a = null, l = null;
      this.flowType === "pkce" && ([a, l, o] = await this._getCodeChallengeAndMethod());
      const u = await x(this.fetch, "POST", `${this.url}/sso`, {
        body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in e ? { provider_id: e.providerId } : null), "domain" in e ? { domain: e.domain } : null), { redirect_to: this._maybeAppendFlowIdToRedirect((r = e.options) === null || r === void 0 ? void 0 : r.redirectTo, o) }), !((n = e == null ? void 0 : e.options) === null || n === void 0) && n.captchaToken ? { gotrue_meta_security: { captcha_token: e.options.captchaToken } } : null), { skip_http_redirect: !0, code_challenge: a, code_challenge_method: l }),
        headers: this.headers,
        xform: Zv
      });
      return !((s = u.data) === null || s === void 0) && s.url && oe() && !(!((i = e.options) === null || i === void 0) && i.skipBrowserRedirect) && window.location.assign(u.data.url), this._returnResult(u);
    } catch (a) {
      if (await Fe(this.storage, this.storageKey, o), C(a))
        return this._returnResult({ data: null, error: a });
      throw a;
    }
  }
  /**
   * Sends a reauthentication OTP to the user's email or phone number.
   * Requires the user to be signed-in.
   *
   * @category Auth
   *
   * @remarks
   * - This method is used together with `updateUser()` when a user's password needs to be updated.
   * - If you require your user to reauthenticate before updating their password, you need to enable the **Secure password change** option in your [project's email provider settings](/dashboard/project/_/auth/providers).
   * - A user is only require to reauthenticate before updating their password if **Secure password change** is enabled and the user **hasn't recently signed in**. A user is deemed recently signed in if the session was created in the last 24 hours.
   * - This method will send a nonce to the user's email. If the user doesn't have a confirmed email address, the method will send the nonce to the user's confirmed phone number instead.
   * - After receiving the OTP, include it as the `nonce` in your `updateUser()` call to finalize the password change.
   *
   * @exampleDescription Send reauthentication nonce
   * Sends a reauthentication nonce to the user's email or phone number.
   *
   * @example Send reauthentication nonce
   * ```js
   * const { error } = await supabase.auth.reauthenticate()
   * ```
   */
  async reauthenticate() {
    return await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => await this._reauthenticate()) : await this._reauthenticate();
  }
  async _reauthenticate() {
    try {
      return await this._useSession(async (e) => {
        const { data: { session: r }, error: n } = e;
        if (n)
          throw n;
        if (!r)
          throw new ne();
        const { error: s } = await x(this.fetch, "GET", `${this.url}/reauthenticate`, {
          headers: this.headers,
          jwt: r.access_token
        });
        return this._returnResult({ data: { user: null, session: null }, error: s });
      });
    } catch (e) {
      if (C(e))
        return this._returnResult({ data: { user: null, session: null }, error: e });
      throw e;
    }
  }
  /**
   * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
   *
   * @category Auth
   *
   * @remarks
   * - Resends a signup confirmation, email change or phone change email to the user.
   * - Passwordless sign-ins can be resent by calling the `signInWithOtp()` method again.
   * - Password recovery emails can be resent by calling the `resetPasswordForEmail()` method again.
   * - This method will only resend an email or phone OTP to the user if there was an initial signup, email change or phone change request being made(note: For existing users signing in with OTP, you should use `signInWithOtp()` again to resend the OTP).
   * - You can specify a redirect url when you resend an email link using the `emailRedirectTo` option.
   *
   * @exampleDescription Resend an email signup confirmation
   * Resends the email signup confirmation to the user
   *
   * @example Resend an email signup confirmation
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'signup',
   *   email: 'email@example.com',
   *   options: {
   *     emailRedirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleDescription Resend a phone signup confirmation
   * Resends the phone signup confirmation email to the user
   *
   * @example Resend a phone signup confirmation
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'sms',
   *   phone: '1234567890'
   * })
   * ```
   *
   * @exampleDescription Resend email change email
   * Resends the email change email to the user
   *
   * @example Resend email change email
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'email_change',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @exampleDescription Resend phone change OTP
   * Resends the phone change OTP to the user
   *
   * @example Resend phone change OTP
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'phone_change',
   *   phone: '1234567890'
   * })
   * ```
   */
  async resend(e) {
    let r = null;
    try {
      const n = `${this.url}/resend`;
      if ("email" in e) {
        const { email: s, type: i, options: o } = e;
        let a = null, l = null;
        this.flowType === "pkce" && ([a, l, r] = await this._getCodeChallengeAndMethod());
        const { error: u } = await x(this.fetch, "POST", n, {
          headers: this.headers,
          body: {
            email: s,
            type: i,
            gotrue_meta_security: { captcha_token: o == null ? void 0 : o.captchaToken },
            code_challenge: a,
            code_challenge_method: l
          },
          redirectTo: this._maybeAppendFlowIdToRedirect(o == null ? void 0 : o.emailRedirectTo, r)
        });
        return u && await Fe(this.storage, this.storageKey, r), this._returnResult({ data: { user: null, session: null }, error: u });
      } else if ("phone" in e) {
        const { phone: s, type: i, options: o } = e, { data: a, error: l } = await x(this.fetch, "POST", n, {
          headers: this.headers,
          body: {
            phone: s,
            type: i,
            gotrue_meta_security: { captcha_token: o == null ? void 0 : o.captchaToken }
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: a == null ? void 0 : a.message_id },
          error: l
        });
      }
      throw new xs("You must provide either an email or phone number and a type");
    } catch (n) {
      if (await Fe(this.storage, this.storageKey, r), C(n))
        return this._returnResult({ data: { user: null, session: null }, error: n });
      throw n;
    }
  }
  /**
   * Returns the session, refreshing it if necessary.
   *
   * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
   *
   * **IMPORTANT:** This method loads values directly from the storage attached
   * to the client. If that storage is based on request cookies for example,
   * the values in it may not be authentic and therefore it's strongly advised
   * against using this method and its results in such circumstances. A warning
   * will be emitted if this is detected. Use {@link GoTrueClient.getUser} instead.
   *
   * @category Auth
   *
   * @remarks
   * - Since the introduction of [asymmetric JWT signing keys](/docs/guides/auth/signing-keys), this method is considered low-level and we encourage you to use `getClaims()` or `getUser()` instead.
   * - Retrieves the current [user session](/docs/guides/auth/sessions) from the storage medium (local storage, cookies).
   * - The session contains an access token (signed JWT), a refresh token and the user object.
   * - If the session's access token is expired or is about to expire, this method will use the refresh token to refresh the session.
   * - When using in a browser, or you've called `startAutoRefresh()` in your environment (React Native, etc.) this function always returns a valid access token without refreshing the session itself, as this is done in the background. This function returns very fast.
   * - **IMPORTANT SECURITY NOTICE:** If using an insecure storage medium, such as cookies or request headers, the user object returned by this function **must not be trusted**. Always verify the JWT using `getClaims()` or your own JWT verification library to securely establish the user's identity and access. You can also use `getUser()` to fetch the user object directly from the Auth server for this purpose.
   * - Cross-tab refresh races are handled by the GoTrue server (the rotated token from the first tab is returned to subsequent tabs via the parent-of-active mechanism), so no client-side serialization is needed.
   *
   * @example Get the session data
   * ```js
   * const { data, error } = await supabase.auth.getSession()
   * ```
   *
   * @exampleResponse Get the session data
   * ```json
   * {
   *   "data": {
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async getSession() {
    return await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => this._useSession(async (e) => e)) : await this._useSession(async (e) => e);
  }
  /**
   * Acquires a global lock based on the storage key.
   *
   * TODO(v3): remove along with the legacy lock path. Only called when
   * `this.lock` is non-null (custom lock supplied via constructor). The
   * default lockless path bypasses this entirely.
   */
  async _acquireLock(e, r) {
    this._debug("#_acquireLock", "begin", e);
    try {
      if (this.lockAcquired) {
        const n = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve(), s = (async () => (await n, await r()))();
        return this.pendingInLock.push((async () => {
          try {
            await s;
          } catch {
          }
        })()), s;
      }
      return await this.lock(`lock:${this.storageKey}`, e, async () => {
        this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
        try {
          this.lockAcquired = !0;
          const n = r();
          for (this.pendingInLock.push((async () => {
            try {
              await n;
            } catch {
            }
          })()), await n; this.pendingInLock.length; ) {
            const s = [...this.pendingInLock];
            await Promise.all(s), this.pendingInLock.splice(0, s.length);
          }
          return await n;
        } finally {
          this._debug("#_acquireLock", "lock released for storage key", this.storageKey), this.lockAcquired = !1;
        }
      });
    } finally {
      this._debug("#_acquireLock", "end");
    }
  }
  /**
   * Use instead of {@link GoTrueClient.getSession} inside the library. Loads the session
   * via `__loadSession` (which may trigger a refresh if the access token is
   * within the expiry margin) and runs `fn` with the result.
   */
  async _useSession(e) {
    this._debug("#_useSession", "begin");
    try {
      const r = await this.__loadSession();
      return await e(r);
    } finally {
      this._debug("#_useSession", "end");
    }
  }
  /**
   * NEVER USE DIRECTLY!
   *
   * Always use `_useSession`.
   */
  async __loadSession() {
    this._debug("#__loadSession()", "begin"), this.lock != null && !this.lockAcquired && this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
    try {
      let e = null;
      const r = await de(this.storage, this.storageKey);
      if (this._debug("#getSession()", "session from storage", r), r !== null && (this._isValidSession(r) ? e = r : (this._debug("#getSession()", "session from storage is not valid"), await this._removeSession())), !e)
        return { data: { session: null }, error: null };
      const n = e.expires_at ? e.expires_at * 1e3 - Date.now() < Eo : !1;
      if (this._debug("#__loadSession()", `session has${n ? "" : " not"} expired`, "expires_at", e.expires_at), !n) {
        if (this.userStorage) {
          const o = await de(this.userStorage, this.storageKey + "-user");
          o != null && o.user ? e.user = o.user : e.user = bo();
        }
        if (this.storage.isServer && e.user && !e.user.__isUserNotAvailableProxy) {
          const o = { value: this.suppressGetSessionWarning };
          e.user = Jv(e.user, o), o.value && (this.suppressGetSessionWarning = !0);
        }
        return { data: { session: e }, error: null };
      }
      const { data: s, error: i } = await this._callRefreshToken(e.refresh_token);
      if (i) {
        if (!!(e.expires_at && e.expires_at * 1e3 > Date.now())) {
          const a = await de(this.storage, this.storageKey);
          if (a && a.refresh_token === e.refresh_token)
            return this._returnResult({ data: { session: e }, error: null });
        }
        return this._returnResult({ data: { session: null }, error: i });
      }
      return this._returnResult({ data: { session: s }, error: null });
    } finally {
      this._debug("#__loadSession()", "end");
    }
  }
  /**
   * Gets the current user details if there is an existing session. This method
   * performs a network request to the Supabase Auth server, so the returned
   * value is authentic and can be used to base authorization rules on.
   *
   * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
   *
   * @category Auth
   *
   * @remarks
   * - This method fetches the user object from the database instead of local session.
   * - This method is useful for checking if the user is authorized because it validates the user's access token JWT on the server.
   * - Should always be used when checking for user authorization on the server. On the client, you can instead use `getSession().session.user` for faster results. `getSession` is insecure on the server.
   *
   * @example Get the logged in user with the current existing session
   * ```js
   * const { data: { user } } = await supabase.auth.getUser()
   * ```
   *
   * @exampleResponse Get the logged in user with the current existing session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Get the logged in user with a custom access token jwt
   * ```js
   * const { data: { user } } = await supabase.auth.getUser(jwt)
   * ```
   */
  async getUser(e) {
    if (e)
      return await this._getUser(e);
    await this.initializePromise;
    let r;
    return this.lock != null ? r = await this._acquireLock(this.lockAcquireTimeout, async () => await this._getUser()) : r = await this._getUser(), r.data.user && (this.suppressGetSessionWarning = !0), r;
  }
  async _getUser(e) {
    try {
      return e ? await x(this.fetch, "GET", `${this.url}/user`, {
        headers: this.headers,
        jwt: e,
        xform: Rt
      }) : await this._useSession(async (r) => {
        var n, s, i;
        const { data: o, error: a } = r;
        if (a)
          throw a;
        return !(!((n = o.session) === null || n === void 0) && n.access_token) && !this.hasCustomAuthorizationHeader ? { data: { user: null }, error: new ne() } : await x(this.fetch, "GET", `${this.url}/user`, {
          headers: this.headers,
          jwt: (i = (s = o.session) === null || s === void 0 ? void 0 : s.access_token) !== null && i !== void 0 ? i : void 0,
          xform: Rt
        });
      });
    } catch (r) {
      if (C(r))
        return Os(r) && await this._removeSession(), this._returnResult({ data: { user: null }, error: r });
      throw r;
    }
  }
  /**
   * Updates user data for a logged in user.
   *
   * @category Auth
   *
   * @remarks
   * - In order to use the `updateUser()` method, the user needs to be signed in first.
   * - By default, email updates sends a confirmation link to both the user's current and new email.
   * To only send a confirmation link to the user's new email, disable **Secure email change** in your project's [email auth provider settings](/dashboard/project/_/auth/providers).
   *
   * @exampleDescription Update the email for an authenticated user
   * Sends a "Confirm Email Change" email to the new address. If **Secure Email Change** is enabled (default), confirmation is also required from the **old email** before the change is applied. To skip dual confirmation and apply the change after only the new email is verified, disable **Secure Email Change** in the [Email Auth Provider settings](/dashboard/project/_/auth/providers?provider=Email).
   *
   * @example Update the email for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   email: 'new@email.com'
   * })
   * ```
   *
   * @exampleResponse Update the email for an authenticated user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "new_email": "new@email.com",
   *       "email_change_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @exampleDescription Update the phone number for an authenticated user
   * Sends a one-time password (OTP) to the new phone number.
   *
   * @example Update the phone number for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   phone: '123456789'
   * })
   * ```
   *
   * @example Update the password for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: 'new password'
   * })
   * ```
   *
   * @exampleDescription Update the user's metadata
   * Updates the user's custom metadata.
   *
   * **Note**: The `data` field maps to the `auth.users.raw_user_meta_data` column in your Supabase database. When calling `getUser()`, the data will be available as `user.user_metadata`.
   *
   * @example Update the user's metadata
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   data: { hello: 'world' }
   * })
   * ```
   *
   * @exampleDescription Update the user's password with a nonce
   * If **Secure password change** is enabled in your [project's email provider settings](/dashboard/project/_/auth/providers), updating the user's password would require a nonce if the user **hasn't recently signed in**. The nonce is sent to the user's email or phone number. A user is deemed recently signed in if the session was created in the last 24 hours.
   *
   * @example Update the user's password with a nonce
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: 'new password',
   *   nonce: '123456'
   * })
   * ```
   */
  async updateUser(e, r = {}) {
    return await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => await this._updateUser(e, r)) : await this._updateUser(e, r);
  }
  async _updateUser(e, r = {}) {
    let n = null;
    try {
      return await this._useSession(async (s) => {
        const { data: i, error: o } = s;
        if (o)
          throw o;
        if (!i.session)
          throw new ne();
        const a = i.session;
        let l = null, u = null;
        this.flowType === "pkce" && e.email != null && ([l, u, n] = await this._getCodeChallengeAndMethod());
        const { data: c, error: h } = await x(this.fetch, "PUT", `${this.url}/user`, {
          headers: this.headers,
          redirectTo: this._maybeAppendFlowIdToRedirect(r == null ? void 0 : r.emailRedirectTo, n),
          body: Object.assign(Object.assign({}, e), { code_challenge: l, code_challenge_method: u }),
          jwt: a.access_token,
          xform: Rt
        });
        if (h)
          throw h;
        return a.user = c.user, await this._saveSession(a), await this._notifyAllSubscribers("USER_UPDATED", a), this._returnResult({ data: { user: a.user }, error: null });
      });
    } catch (s) {
      if (await Fe(this.storage, this.storageKey, n), C(s))
        return this._returnResult({ data: { user: null }, error: s });
      throw s;
    }
  }
  /**
   * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
   * If the refresh token or access token in the current session is invalid, an error will be thrown.
   * @param currentSession The current session that minimally contains an access token and refresh token.
   *
   * @category Auth
   *
   * @remarks
   * - This method sets the session using an `access_token` and `refresh_token`.
   * - If successful, a `SIGNED_IN` event is emitted.
   *
   * @exampleDescription Set the session
   * Sets the session data from an access_token and refresh_token, then returns an auth response or error.
   *
   * @example Set the session
   * ```js
   *   const { data, error } = await supabase.auth.setSession({
   *     access_token,
   *     refresh_token
   *   })
   * ```
   *
   * @exampleResponse Set the session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "11111111-1111-1111-1111-111111111111",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "2024-01-01T00:00:00Z",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       },
   *       "token_type": "bearer",
   *       "expires_in": 3500,
   *       "expires_at": 1700000000
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async setSession(e) {
    return await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => await this._setSession(e)) : await this._setSession(e);
  }
  async _setSession(e) {
    try {
      if (!e.access_token || !e.refresh_token)
        throw new ne();
      const r = Date.now() / 1e3;
      let n = r, s = !0, i = null;
      const { payload: o } = js(e.access_token);
      if (o.exp && (n = o.exp, s = n <= r), s) {
        const { data: a, error: l } = await this._callRefreshToken(e.refresh_token);
        if (l)
          return this._returnResult({ data: { user: null, session: null }, error: l });
        if (!a)
          return { data: { user: null, session: null }, error: null };
        i = a;
      } else {
        const { data: a, error: l } = await this._getUser(e.access_token);
        if (l)
          return this._returnResult({ data: { user: null, session: null }, error: l });
        i = {
          access_token: e.access_token,
          refresh_token: e.refresh_token,
          user: a.user,
          token_type: "bearer",
          expires_in: n - r,
          expires_at: n
        }, await this._saveSession(i), await this._notifyAllSubscribers("SIGNED_IN", i);
      }
      return this._returnResult({ data: { user: i.user, session: i }, error: null });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: { session: null, user: null }, error: r });
      throw r;
    }
  }
  /**
   * Returns a new session, regardless of expiry status.
   * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
   * If the current session's refresh token is invalid, an error will be thrown.
   * @param currentSession The current session. If passed in, it must contain a refresh token.
   *
   * @category Auth
   *
   * @remarks
   * - This method will refresh and return a new session whether the current one is expired or not.
   *
   * @example Refresh session using the current session
   * ```js
   * const { data, error } = await supabase.auth.refreshSession()
   * const { session, user } = data
   * ```
   *
   * @exampleResponse Refresh session using the current session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Refresh session using a refresh token
   * ```js
   * const { data, error } = await supabase.auth.refreshSession({ refresh_token })
   * const { session, user } = data
   * ```
   */
  async refreshSession(e) {
    return await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => await this._refreshSession(e)) : await this._refreshSession(e);
  }
  async _refreshSession(e) {
    try {
      return await this._useSession(async (r) => {
        var n;
        if (!e) {
          const { data: o, error: a } = r;
          if (a)
            throw a;
          e = (n = o.session) !== null && n !== void 0 ? n : void 0;
        }
        if (!(e != null && e.refresh_token))
          throw new ne();
        const { data: s, error: i } = await this._callRefreshToken(e.refresh_token);
        return i ? this._returnResult({ data: { user: null, session: null }, error: i }) : s ? this._returnResult({ data: { user: s.user, session: s }, error: null }) : this._returnResult({ data: { user: null, session: null }, error: null });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  /**
   * Gets the session data from a URL string
   */
  async _getSessionFromURL(e, r) {
    var n;
    try {
      if (!oe())
        throw new As("No browser detected.");
      if (e.error || e.error_description || e.error_code)
        throw new As(e.error_description || "Error in URL with unspecified error_description", {
          error: e.error || "unspecified_error",
          code: e.error_code || "unspecified_code"
        });
      switch (r) {
        case "implicit":
          if (this.flowType === "pkce")
            throw new tc("Not a valid PKCE flow url.");
          break;
        case "pkce":
          if (this.flowType === "implicit")
            throw new As("Not a valid implicit grant flow url.");
          break;
        default:
      }
      if (r === "pkce") {
        if (this._debug("#_initialize()", "begin", "is PKCE flow", !0), !e.code)
          throw new tc("No code detected.");
        const { data: m, error: w } = await this._exchangeCodeForSession(e.code, {
          flowId: e[Zt]
        });
        if (w)
          throw w;
        const T = new URL(window.location.href);
        return T.searchParams.delete("code"), T.searchParams.delete(Zt), window.history.replaceState(window.history.state, "", T.toString()), {
          data: { session: m.session, redirectType: (n = m.redirectType) !== null && n !== void 0 ? n : null },
          error: null
        };
      }
      const { provider_token: s, provider_refresh_token: i, access_token: o, refresh_token: a, expires_in: l, expires_at: u, token_type: c } = e;
      if (!o || !l || !a || !c)
        throw new As("No session defined in URL");
      const h = Math.round(Date.now() / 1e3), d = parseInt(l);
      let g = h + d;
      u && (g = parseInt(u));
      const v = g - h;
      v * 1e3 <= ct && console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${v}s, should have been closer to ${d}s`);
      const y = g - d;
      h - y >= 120 ? console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", y, g, h) : h - y < 0 && console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", y, g, h);
      const { data: k, error: f } = await this._getUser(o);
      if (f)
        throw f;
      const p = {
        provider_token: s,
        provider_refresh_token: i,
        access_token: o,
        expires_in: d,
        expires_at: g,
        refresh_token: a,
        token_type: c,
        user: k.user
      };
      return window.location.hash = "", this._debug("#_getSessionFromURL()", "clearing window.location.hash"), this._returnResult({ data: { session: p, redirectType: e.type }, error: null });
    } catch (s) {
      if (C(s))
        return this._returnResult({ data: { session: null, redirectType: null }, error: s });
      throw s;
    }
  }
  /**
   * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
   *
   * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
   * if the URL should be processed as a Supabase auth callback. This allows users to exclude
   * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
   */
  _isImplicitGrantCallback(e) {
    return typeof this.detectSessionInUrl == "function" ? this.detectSessionInUrl(new URL(window.location.href), e) : !!(e.access_token || e.error || e.error_description || e.error_code);
  }
  /**
   * Checks if the current URL and backing storage contain parameters given by a PKCE flow
   */
  async _isPKCECallback(e) {
    if (!e.code)
      return !1;
    const r = Ks(e[Zt]);
    return r && await de(this.storage, Vr(this.storageKey, r)) ? !0 : !!await de(this.storage, `${this.storageKey}-code-verifier`);
  }
  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
   * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
   *
   * If using `others` scope, no `SIGNED_OUT` event is fired!
   *
   * **Warning:** the default `scope` is `'global'`. This signs the user out of
   * **every device they are currently signed in on**, not just the current
   * tab/session. If you only want to sign the user out of the current session
   * (the behavior most other auth libraries default to), pass
   * `{ scope: 'local' }` explicitly.
   *
   * @category Auth
   *
   * @remarks
   * - In order to use the `signOut()` method, the user needs to be signed in first.
   * - By default, `signOut()` uses the **global** scope, which signs out the user
   *   on every device they are signed in on (not just the current one). Pass
   *   `{ scope: 'local' }` to only sign out the current session. This is
   *   usually what apps want on a "Sign out" button, especially when users
   *   sign in from multiple devices and do not expect signing out of one to
   *   terminate the others.
   * - Since Supabase Auth uses JWTs for authentication, the access token JWT will be valid until it's expired. When the user signs out, Supabase revokes the refresh token and deletes the JWT from the client-side. This does not revoke the JWT and it will still be valid until it expires.
   *
   * @example Sign out of every device (global – default)
   * ```js
   * const { error } = await supabase.auth.signOut()
   * ```
   *
   * @example Sign out only the current session (recommended for most apps)
   * ```js
   * const { error } = await supabase.auth.signOut({ scope: 'local' })
   * ```
   *
   * @example Sign out of all other sessions, keep the current one
   * ```js
   * const { error } = await supabase.auth.signOut({ scope: 'others' })
   * ```
   */
  async signOut(e = { scope: "global" }) {
    return await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => await this._signOut(e)) : await this._signOut(e);
  }
  async _signOut({ scope: e } = { scope: "global" }) {
    return await this._useSession(async (r) => {
      var n;
      const s = async () => {
        await this._removeSession();
      }, { data: i, error: o } = r;
      if (o && !Os(o))
        return this._returnResult({ error: o });
      const a = (n = i.session) === null || n === void 0 ? void 0 : n.access_token;
      if (a) {
        const { error: l } = await this.admin.signOut(a, e);
        if (l && !(ec(l) && (l.status === 404 || l.status === 401 || l.status === 403) || Os(l)))
          return e !== "others" && await s(), this._returnResult({ error: l });
      }
      return e !== "others" && await s(), this._returnResult({ error: null });
    });
  }
  /**  *
   * @category Auth
   *
   * @remarks
   * - Subscribes to important events occurring on the user's session.
   * - Use on the frontend/client. It is less useful on the server.
   * - Events are emitted across tabs to keep your application's UI up-to-date. Some events can fire very frequently, based on the number of tabs open. Use a quick and efficient callback function, and defer or debounce as many operations as you can to be performed outside of the callback.
   * - Callbacks can be `async` and can safely call other Supabase auth methods (`getUser`, `setSession`, etc.) from inside the callback.
   * - Keep callbacks quick. Events are awaited in order, so a slow callback delays subsequent events to subscribers in this tab.
   * - Emitted events:
   *   - `INITIAL_SESSION`
   *     - Emitted right after the Supabase client is constructed and the initial session from storage is loaded.
   *   - `SIGNED_IN`
   *     - Emitted each time a user session is confirmed or re-established, including on user sign in and when refocusing a tab.
   *     - Avoid making assumptions as to when this event is fired, this may occur even when the user is already signed in. Instead, check the user object attached to the event to see if a new user has signed in and update your application's UI.
   *     - This event can fire very frequently depending on the number of tabs open in your application.
   *   - `SIGNED_OUT`
   *     - Emitted when the user signs out. This can be after:
   *       - A call to `supabase.auth.signOut()`.
   *       - After the user's session has expired for any reason:
   *         - User has signed out on another device.
   *         - The session has reached its timebox limit or inactivity timeout.
   *         - User has signed in on another device with single session per user enabled.
   *         - Check the [User Sessions](/docs/guides/auth/sessions) docs for more information.
   *     - Use this to clean up any local storage your application has associated with the user.
   *   - `TOKEN_REFRESHED`
   *     - Emitted each time a new access and refresh token are fetched for the signed in user.
   *     - It's best practice and highly recommended to extract the access token (JWT) and store it in memory for further use in your application.
   *       - Avoid frequent calls to `supabase.auth.getSession()` for the same purpose.
   *     - There is a background process that keeps track of when the session should be refreshed so you will always receive valid tokens by listening to this event.
   *     - The frequency of this event is related to the JWT expiry limit configured on your project.
   *   - `USER_UPDATED`
   *     - Emitted each time the `supabase.auth.updateUser()` method finishes successfully. Listen to it to update your application's UI based on new profile information.
   *   - `PASSWORD_RECOVERY`
   *     - Emitted instead of the `SIGNED_IN` event when the user lands on a page that includes a password recovery link in the URL.
   *     - Use it to show a UI to the user where they can [reset their password](/docs/guides/auth/passwords#resetting-a-users-password-forgot-password).
   *
   * @example Listen to auth changes
   * ```js
   * const { data } = supabase.auth.onAuthStateChange((event, session) => {
   *   console.log(event, session)
   *
   *   if (event === 'INITIAL_SESSION') {
   *     // handle initial session
   *   } else if (event === 'SIGNED_IN') {
   *     // handle sign in event
   *   } else if (event === 'SIGNED_OUT') {
   *     // handle sign out event
   *   } else if (event === 'PASSWORD_RECOVERY') {
   *     // handle password recovery event
   *   } else if (event === 'TOKEN_REFRESHED') {
   *     // handle token refreshed event
   *   } else if (event === 'USER_UPDATED') {
   *     // handle user updated event
   *   }
   * })
   *
   * // call unsubscribe to remove the callback
   * data.subscription.unsubscribe()
   * ```
   *
   * @exampleDescription Listen to sign out
   * Make sure you clear out any local data, such as local and session storage, after the client library has detected the user's sign out.
   *
   * @example Listen to sign out
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_OUT') {
   *     console.log('SIGNED_OUT', session)
   *
   *     // clear local and session storage
   *     [
   *       window.localStorage,
   *       window.sessionStorage,
   *     ].forEach((storage) => {
   *       Object.entries(storage)
   *         .forEach(([key]) => {
   *           storage.removeItem(key)
   *         })
   *     })
   *   }
   * })
   * ```
   *
   * @exampleDescription Store OAuth provider tokens on sign in
   * When using [OAuth (Social Login)](/docs/guides/auth/social-login) you sometimes wish to get access to the provider's access token and refresh token, in order to call provider APIs in the name of the user.
   *
   * For example, if you are using [Sign in with Google](/docs/guides/auth/social-login/auth-google) you may want to use the provider token to call Google APIs on behalf of the user. Supabase Auth does not keep track of the provider access and refresh token, but does return them for you once, immediately after sign in. You can use the `onAuthStateChange` method to listen for the presence of the provider tokens and store them in local storage. You can further send them to your server's APIs for use on the backend.
   *
   * Finally, make sure you remove them from local storage on the `SIGNED_OUT` event. If the OAuth provider supports token revocation, make sure you call those APIs either from the frontend or schedule them to be called on the backend.
   *
   * @example Store OAuth provider tokens on sign in
   * ```js
   * // Register this immediately after calling createClient!
   * // Because signInWithOAuth causes a redirect, you need to fetch the
   * // provider tokens from the callback.
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (session && session.provider_token) {
   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)
   *   }
   *
   *   if (session && session.provider_refresh_token) {
   *     window.localStorage.setItem('oauth_provider_refresh_token', session.provider_refresh_token)
   *   }
   *
   *   if (event === 'SIGNED_OUT') {
   *     window.localStorage.removeItem('oauth_provider_token')
   *     window.localStorage.removeItem('oauth_provider_refresh_token')
   *   }
   * })
   * ```
   *
   * @exampleDescription Use React Context for the User's session
   * Instead of relying on `supabase.auth.getSession()` within your React components, you can use a [React Context](https://react.dev/reference/react/createContext) to store the latest session information from the `onAuthStateChange` callback and access it that way.
   *
   * @example Use React Context for the User's session
   * ```js
   * const SessionContext = React.createContext(null)
   *
   * function main() {
   *   const [session, setSession] = React.useState(null)
   *
   *   React.useEffect(() => {
   *     const {data: { subscription }} = supabase.auth.onAuthStateChange(
   *       (event, session) => {
   *         if (event === 'SIGNED_OUT') {
   *           setSession(null)
   *         } else if (session) {
   *           setSession(session)
   *         }
   *       })
   *
   *     return () => {
   *       subscription.unsubscribe()
   *     }
   *   }, [])
   *
   *   return (
   *     <SessionContext.Provider value={session}>
   *       <App />
   *     </SessionContext.Provider>
   *   )
   * }
   * ```
   *
   * @example Listen to password recovery events
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'PASSWORD_RECOVERY') {
   *     console.log('PASSWORD_RECOVERY', session)
   *     // show screen to update user's password
   *     showPasswordResetScreen(true)
   *   }
   * })
   * ```
   *
   * @example Listen to sign in
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_IN') console.log('SIGNED_IN', session)
   * })
   * ```
   *
   * @example Listen to token refresh
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'TOKEN_REFRESHED') console.log('TOKEN_REFRESHED', session)
   * })
   * ```
   *
   * @example Listen to user updates
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'USER_UPDATED') console.log('USER_UPDATED', session)
   * })
   * ```
   */
  onAuthStateChange(e) {
    const r = Av(), n = {
      id: r,
      callback: e,
      unsubscribe: () => {
        this._debug("#unsubscribe()", "state change callback with id removed", r), this.stateChangeEmitters.delete(r);
      }
    };
    return this._debug("#onAuthStateChange()", "registered callback with id", r), this.stateChangeEmitters.set(r, n), (async () => (await this.initializePromise, this.lock != null ? await this._acquireLock(this.lockAcquireTimeout, async () => {
      this._emitInitialSession(r);
    }) : await this._emitInitialSession(r)))(), { data: { subscription: n } };
  }
  async _emitInitialSession(e) {
    return await this._useSession(async (r) => {
      var n, s;
      try {
        const { data: { session: i }, error: o } = r;
        if (o)
          throw o;
        await ((n = this.stateChangeEmitters.get(e)) === null || n === void 0 ? void 0 : n.callback("INITIAL_SESSION", i)), this._debug("INITIAL_SESSION", "callback id", e, "session", i);
      } catch (i) {
        await ((s = this.stateChangeEmitters.get(e)) === null || s === void 0 ? void 0 : s.callback("INITIAL_SESSION", null)), this._debug("INITIAL_SESSION", "callback id", e, "error", i), Os(i) || Ps(i) || ec(i) && (i.code === "refresh_token_not_found" || i.code === "refresh_token_already_used" || i.code === "session_expired") ? console.warn(i) : console.error(i);
      }
    });
  }
  /**
   * Sends a password reset request to an email address. This method supports the PKCE flow.
   *
   * @param email The email address of the user.
   * @param options.redirectTo The URL to send the user to after they click the password reset link.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   *
   * @category Auth
   *
   * @remarks
   * - The password reset flow consist of 2 broad steps: (i) Allow the user to login via the password reset link; (ii) Update the user's password.
   * - The `resetPasswordForEmail()` only sends a password reset link to the user's email.
   * To update the user's password, see [`updateUser()`](/docs/reference/javascript/auth-updateuser).
   * - A `PASSWORD_RECOVERY` event will be emitted when the password recovery link is clicked.
   * You can use [`onAuthStateChange()`](/docs/reference/javascript/auth-onauthstatechange) to listen and invoke a callback function on these events.
   * - When the user clicks the reset link in the email they are redirected back to your application.
   * You can configure the URL that the user is redirected to with the `redirectTo` parameter.
   * See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   * - After the user has been redirected successfully, prompt them for a new password and call `updateUser()`:
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: new_password
   * })
   * ```
   *
   * @example Reset password
   * ```js
   * const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
   *   redirectTo: 'https://example.com/update-password',
   * })
   * ```
   *
   * @exampleResponse Reset password
   * ```json
   * {
   *   data: {}
   *   error: null
   * }
   * ```
   *
   * @example Reset password (React)
   * ```js
   * /**
   *  * Step 1: Send the user an email to get a password reset token.
   *  * This email contains a link which sends the user back to your application.
   *  *\/
   * const { data, error } = await supabase.auth
   *   .resetPasswordForEmail('user@email.com')
   *
   * /**
   *  * Step 2: Once the user is redirected back to your application,
   *  * ask the user to reset their password.
   *  *\/
   *  useEffect(() => {
   *    supabase.auth.onAuthStateChange(async (event, session) => {
   *      if (event == "PASSWORD_RECOVERY") {
   *        const newPassword = prompt("What would you like your new password to be?");
   *        const { data, error } = await supabase.auth
   *          .updateUser({ password: newPassword })
   *
   *        if (data) alert("Password updated successfully!")
   *        if (error) alert("There was an error updating your password.")
   *      }
   *    })
   *  }, [])
   * ```
   */
  async resetPasswordForEmail(e, r = {}) {
    let n = null, s = null, i = null;
    this.flowType === "pkce" && ([n, s, i] = await this._getCodeChallengeAndMethod(
      !0
      // isPasswordRecovery
    ));
    try {
      return await x(this.fetch, "POST", `${this.url}/recover`, {
        body: {
          email: e,
          code_challenge: n,
          code_challenge_method: s,
          gotrue_meta_security: { captcha_token: r.captchaToken }
        },
        headers: this.headers,
        redirectTo: this._maybeAppendFlowIdToRedirect(r.redirectTo, i)
      });
    } catch (o) {
      if (await Fe(this.storage, this.storageKey, i), C(o))
        return this._returnResult({ data: null, error: o });
      throw o;
    }
  }
  /**
   * Gets all the identities linked to a user.
   *
   * @category Auth
   *
   * @remarks
   * - The user needs to be signed in to call `getUserIdentities()`.
   *
   * @example Returns a list of identities linked to the user
   * ```js
   * const { data, error } = await supabase.auth.getUserIdentities()
   * ```
   *
   * @exampleResponse Returns a list of identities linked to the user
   * ```json
   * {
   *   "data": {
   *     "identities": [
   *       {
   *         "identity_id": "22222222-2222-2222-2222-222222222222",
   *         "id": "2024-01-01T00:00:00Z",
   *         "user_id": "2024-01-01T00:00:00Z",
   *         "identity_data": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "provider": "email",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "email": "example@email.com"
   *       }
   *     ]
   *   },
   *   "error": null
   * }
   * ```
   */
  async getUserIdentities() {
    var e;
    try {
      const { data: r, error: n } = await this.getUser();
      if (n)
        throw n;
      return this._returnResult({ data: { identities: (e = r.user.identities) !== null && e !== void 0 ? e : [] }, error: null });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**  *
   * @category Auth
   *
   * @remarks
   * - The **Enable Manual Linking** option must be enabled from your [project's authentication settings](/dashboard/project/_/auth/providers).
   * - The user needs to be signed in to call `linkIdentity()`.
   * - If the candidate identity is already linked to the existing user or another user, `linkIdentity()` will fail.
   * - If `linkIdentity` is run in the browser, the user is automatically redirected to the returned URL. On the server, you should handle the redirect.
   *
   * @example Link an identity to a user
   * ```js
   * const { data, error } = await supabase.auth.linkIdentity({
   *   provider: 'github'
   * })
   * ```
   *
   * @exampleResponse Link an identity to a user
   * ```json
   * {
   *   data: {
   *     provider: 'github',
   *     url: <PROVIDER_URL_TO_REDIRECT_TO>,
   *     flowId: <PKCE_FLOW_ID_OR_NULL>
   *   },
   *   error: null
   * }
   * ```
   */
  async linkIdentity(e) {
    return "token" in e ? this.linkIdentityIdToken(e) : this.linkIdentityOAuth(e);
  }
  async linkIdentityOAuth(e) {
    var r;
    let n = null;
    try {
      const { data: s, error: i } = await this._useSession(async (o) => {
        var a, l, u, c, h;
        const { data: d, error: g } = o;
        if (g)
          throw g;
        const { url: v, flowId: y } = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, e.provider, {
          redirectTo: (a = e.options) === null || a === void 0 ? void 0 : a.redirectTo,
          scopes: (l = e.options) === null || l === void 0 ? void 0 : l.scopes,
          queryParams: (u = e.options) === null || u === void 0 ? void 0 : u.queryParams,
          skipBrowserRedirect: !0
        });
        return n = y, await x(this.fetch, "GET", v, {
          headers: this.headers,
          jwt: (h = (c = d.session) === null || c === void 0 ? void 0 : c.access_token) !== null && h !== void 0 ? h : void 0
        });
      });
      if (i)
        throw i;
      return oe() && !(!((r = e.options) === null || r === void 0) && r.skipBrowserRedirect) && window.location.assign(s == null ? void 0 : s.url), this._returnResult({
        data: { provider: e.provider, url: s == null ? void 0 : s.url, flowId: n },
        error: null
      });
    } catch (s) {
      if (C(s))
        return this._returnResult({
          data: { provider: e.provider, url: null, flowId: n },
          error: s
        });
      throw s;
    }
  }
  async linkIdentityIdToken(e) {
    return await this._useSession(async (r) => {
      var n;
      try {
        const { error: s, data: { session: i } } = r;
        if (s)
          throw s;
        const { options: o, provider: a, token: l, access_token: u, nonce: c } = e, h = await x(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
          headers: this.headers,
          jwt: (n = i == null ? void 0 : i.access_token) !== null && n !== void 0 ? n : void 0,
          body: {
            provider: a,
            id_token: l,
            access_token: u,
            nonce: c,
            link_identity: !0,
            gotrue_meta_security: { captcha_token: o == null ? void 0 : o.captchaToken }
          },
          xform: Ie
        }), { data: d, error: g } = h;
        return g ? this._returnResult({ data: { user: null, session: null }, error: g }) : !d || !d.session || !d.user ? this._returnResult({
          data: { user: null, session: null },
          error: new fr()
        }) : (d.session && (await this._saveSession(d.session), await this._notifyAllSubscribers("USER_UPDATED", d.session)), this._returnResult({ data: d, error: g }));
      } catch (s) {
        if (await Fe(this.storage, this.storageKey, null), C(s))
          return this._returnResult({ data: { user: null, session: null }, error: s });
        throw s;
      }
    });
  }
  /**
   * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
   *
   * @category Auth
   *
   * @remarks
   * - The **Enable Manual Linking** option must be enabled from your [project's authentication settings](/dashboard/project/_/auth/providers).
   * - The user needs to be signed in to call `unlinkIdentity()`.
   * - The user must have at least 2 identities in order to unlink an identity.
   * - The identity to be unlinked must belong to the user.
   *
   * @example Unlink an identity
   * ```js
   * // retrieve all identities linked to a user
   * const identities = await supabase.auth.getUserIdentities()
   *
   * // find the google identity
   * const googleIdentity = identities.find(
   *   identity => identity.provider === 'google'
   * )
   *
   * // unlink the google identity
   * const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
   * ```
   */
  async unlinkIdentity(e) {
    try {
      return await this._useSession(async (r) => {
        var n, s;
        const { data: i, error: o } = r;
        if (o)
          throw o;
        return await x(this.fetch, "DELETE", `${this.url}/user/identities/${e.identity_id}`, {
          headers: this.headers,
          jwt: (s = (n = i.session) === null || n === void 0 ? void 0 : n.access_token) !== null && s !== void 0 ? s : void 0
        });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async _refreshAccessToken(e) {
    const r = "#_refreshAccessToken()";
    this._debug(r, "begin");
    try {
      const n = Date.now();
      return await Iv(async (s) => (s > 0 && await jv(200 * Math.pow(2, s - 1)), this._debug(r, "refreshing attempt", s), await x(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
        body: { refresh_token: e },
        headers: this.headers,
        xform: Ie
      })), (s, i) => {
        const o = 200 * Math.pow(2, s);
        return i && Ps(i) && // retryable only if the request can be sent before the backoff overflows the tick duration
        Date.now() + o - n < ct;
      });
    } catch (n) {
      if (this._debug(r, "error", n), C(n))
        return this._returnResult({ data: { session: null, user: null }, error: n });
      throw n;
    } finally {
      this._debug(r, "end");
    }
  }
  _isValidSession(e) {
    return typeof e == "object" && e !== null && "access_token" in e && "refresh_token" in e && "expires_at" in e;
  }
  async _handleProviderSignIn(e, r) {
    const { url: n, flowId: s } = await this._getUrlForProvider(`${this.url}/authorize`, e, {
      redirectTo: r.redirectTo,
      scopes: r.scopes,
      queryParams: r.queryParams
    });
    return this._debug("#_handleProviderSignIn()", "provider", e, "options", r, "url", n), oe() && !r.skipBrowserRedirect && window.location.assign(n), { data: { provider: e, url: n, flowId: s }, error: null };
  }
  /**
   * Recovers the session from LocalStorage and refreshes the token
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  async _recoverAndRefresh() {
    var e, r;
    const n = "#_recoverAndRefresh()";
    this._debug(n, "begin");
    try {
      const s = await de(this.storage, this.storageKey);
      if (s && this.userStorage) {
        let o = await de(this.userStorage, this.storageKey + "-user");
        !this.storage.isServer && Object.is(this.storage, this.userStorage) && !o && (o = { user: s.user }, await dt(this.userStorage, this.storageKey + "-user", o)), s.user = (e = o == null ? void 0 : o.user) !== null && e !== void 0 ? e : bo();
      } else if (s && !s.user && !s.user) {
        const o = await de(this.storage, this.storageKey + "-user");
        o && (o != null && o.user) ? (s.user = o.user, await ke(this.storage, this.storageKey + "-user"), await dt(this.storage, this.storageKey, s)) : s.user = bo();
      }
      if (this._debug(n, "session from storage", s), !this._isValidSession(s)) {
        this._debug(n, "session is not valid"), s !== null && await this._removeSession();
        return;
      }
      const i = ((r = s.expires_at) !== null && r !== void 0 ? r : 1 / 0) * 1e3 - Date.now() < Eo;
      if (this._debug(n, `session has${i ? "" : " not"} expired with margin of ${Eo}s`), i) {
        if (this.autoRefreshToken && s.refresh_token) {
          const { error: o } = await this._callRefreshToken(s.refresh_token);
          o && (Ev(o) ? this._debug(n, "refresh discarded by commit guard", o) : this._debug(n, "refresh failed", o));
        }
      } else if (s.user && s.user.__isUserNotAvailableProxy === !0)
        try {
          const { data: o, error: a } = await this._getUser(s.access_token);
          !a && (o != null && o.user) ? (s.user = o.user, await this._saveSession(s), await this._notifyAllSubscribers("SIGNED_IN", s)) : this._debug(n, "could not get user data, skipping SIGNED_IN notification");
        } catch (o) {
          console.error("Error getting user data:", o), this._debug(n, "error getting user data, skipping SIGNED_IN notification", o);
        }
      else
        await this._notifyAllSubscribers("SIGNED_IN", s);
    } catch (s) {
      this._debug(n, "error", s), Ps(s) ? console.warn(s) : console.error(s);
      return;
    } finally {
      this._debug(n, "end");
    }
  }
  async _callRefreshToken(e) {
    var r, n;
    if (!e)
      throw new ne();
    if (this.refreshingDeferred)
      return this.refreshingDeferred.promise;
    if (this.lastRefreshFailure && this.lastRefreshFailure.refreshToken === e && Date.now() < this.lastRefreshFailure.expiresAt)
      return this._debug("#_callRefreshToken()", "returning cached failure (cooldown active)"), this.lastRefreshFailure.result;
    const s = "#_callRefreshToken()";
    this._debug(s, "begin");
    try {
      this.refreshingDeferred = new Vi();
      const i = await de(this.storage, this.storageKey), { data: o, error: a } = await this._refreshAccessToken(e);
      if (a)
        throw a;
      if (!o.session)
        throw new ne();
      const l = await de(this.storage, this.storageKey);
      if (i !== null && (l === null || l.refresh_token !== i.refresh_token)) {
        this._debug(s, "commit guard: storage changed since refresh started, discarding rotated tokens", {
          // Presence indicators only — never log refresh token fragments,
          // even partial. Logs may be forwarded to third-party services.
          startedWith: "present",
          nowHolds: l ? "replaced" : "cleared"
        });
        const d = {
          data: null,
          error: new rc()
        };
        return this.refreshingDeferred.resolve(d), d;
      }
      const c = this._sessionRemovalEpoch;
      if (await this._saveSession(o.session), this._sessionRemovalEpoch !== c) {
        this._debug(s, "commit guard (post-save): _removeSession ran during _saveSession, undoing write"), await ke(this.storage, this.storageKey), this.userStorage && await ke(this.userStorage, this.storageKey + "-user");
        const d = {
          data: null,
          error: new rc()
        };
        return this.refreshingDeferred.resolve(d), d;
      }
      await this._notifyAllSubscribers("TOKEN_REFRESHED", o.session);
      const h = { data: o.session, error: null };
      return this.lastRefreshFailure = null, this.refreshingDeferred.resolve(h), h;
    } catch (i) {
      if (this._debug(s, "error", i), C(i)) {
        const o = { data: null, error: i };
        if (!Ps(i)) {
          const a = await de(this.storage, this.storageKey);
          !!(a != null && a.expires_at && a.expires_at * 1e3 > Date.now()) ? this._debug(s, "proactive refresh failed, access token still valid — preserving session") : await this._removeSession();
        }
        return this.lastRefreshFailure = {
          refreshToken: e,
          result: o,
          expiresAt: Date.now() + fv
        }, (r = this.refreshingDeferred) === null || r === void 0 || r.resolve(o), o;
      }
      throw (n = this.refreshingDeferred) === null || n === void 0 || n.reject(i), i;
    } finally {
      this.refreshingDeferred = null, this._debug(s, "end");
    }
  }
  async _notifyAllSubscribers(e, r, n = !0) {
    if (this._pendingInitNotifications !== null && n) {
      this._pendingInitNotifications.push({ event: e, session: r, broadcast: n });
      return;
    }
    const s = `#_notifyAllSubscribers(${e})`;
    this._debug(s, "begin", r, `broadcast = ${n}`);
    try {
      this.broadcastChannel && n && this.broadcastChannel.postMessage({ event: e, session: r });
      const i = [], o = Array.from(this.stateChangeEmitters.values()).map(async (a) => {
        try {
          await a.callback(e, r);
        } catch (l) {
          i.push(l);
        }
      });
      if (await Promise.all(o), i.length > 0) {
        for (let a = 0; a < i.length; a += 1)
          console.error(i[a]);
        throw i[0];
      }
    } finally {
      this._debug(s, "end");
    }
  }
  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  async _saveSession(e) {
    this._debug("#_saveSession()", e), this.suppressGetSessionWarning = !0;
    const r = Object.assign({}, e), n = r.user && r.user.__isUserNotAvailableProxy === !0;
    if (this.userStorage) {
      !n && r.user && await dt(this.userStorage, this.storageKey + "-user", {
        user: r.user
      });
      const s = Object.assign({}, r);
      delete s.user;
      const i = lc(s);
      await dt(this.storage, this.storageKey, i);
    } else {
      const s = lc(r);
      await dt(this.storage, this.storageKey, s);
    }
  }
  async _removeSession() {
    this._sessionRemovalEpoch += 1, this._debug("#_removeSession()"), this.lastRefreshFailure = null, this.suppressGetSessionWarning = !1, await ke(this.storage, this.storageKey), await Bv(this.storage, this.storageKey), await ke(this.storage, this.storageKey + "-user"), this.userStorage && await ke(this.userStorage, this.storageKey + "-user"), await this._notifyAllSubscribers("SIGNED_OUT", null);
  }
  /**
   * Removes any registered visibilitychange callback.
   *
   * {@link GoTrueClient.startAutoRefresh}
   * {@link GoTrueClient.stopAutoRefresh}
   */
  _removeVisibilityChangedCallback() {
    this._debug("#_removeVisibilityChangedCallback()");
    const e = this.visibilityChangedCallback;
    this.visibilityChangedCallback = null;
    try {
      e && oe() && (window != null && window.removeEventListener) && window.removeEventListener("visibilitychange", e);
    } catch (r) {
      console.error("removing visibilitychange callback failed", r);
    }
  }
  /**
   * This is the private implementation of {@link GoTrueClient.startAutoRefresh}. Use this
   * within the library.
   */
  async _startAutoRefresh() {
    await this._stopAutoRefresh(), this._debug("#_startAutoRefresh()");
    const e = setInterval(() => this._autoRefreshTokenTick(), ct);
    this.autoRefreshTicker = e, e && typeof e == "object" && typeof e.unref == "function" ? e.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(e);
    const r = setTimeout(async () => {
      await this.initializePromise, await this._autoRefreshTokenTick();
    }, 0);
    this.autoRefreshTickTimeout = r, r && typeof r == "object" && typeof r.unref == "function" ? r.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(r);
  }
  /**
   * This is the private implementation of {@link GoTrueClient.stopAutoRefresh}. Use this
   * within the library.
   */
  async _stopAutoRefresh() {
    this._debug("#_stopAutoRefresh()");
    const e = this.autoRefreshTicker;
    this.autoRefreshTicker = null, e && clearInterval(e);
    const r = this.autoRefreshTickTimeout;
    this.autoRefreshTickTimeout = null, r && clearTimeout(r);
  }
  /**
   * Starts an auto-refresh process in the background. The session is checked
   * every few seconds. Close to the time of expiration a process is started to
   * refresh the session. If refreshing fails it will be retried for as long as
   * necessary.
   *
   * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
   * to call this function, it will be called for you.
   *
   * On browsers the refresh process works only when the tab/window is in the
   * foreground to conserve resources as well as prevent race conditions and
   * flooding auth with requests. If you call this method any managed
   * visibility change callback will be removed and you must manage visibility
   * changes on your own.
   *
   * On non-browser platforms the refresh process works *continuously* in the
   * background, which may not be desirable. You should hook into your
   * platform's foreground indication mechanism and call these methods
   * appropriately to conserve resources.
   *
   * {@link GoTrueClient.stopAutoRefresh}
   *
   * @category Auth
   *
   * @remarks
   * - Only useful in non-browser environments such as React Native or Electron.
   * - The Supabase Auth library automatically starts and stops proactively refreshing the session when a tab is focused or not.
   * - On non-browser platforms, such as mobile or desktop apps built with web technologies, the library is not able to effectively determine whether the application is _focused_ or not.
   * - To give this hint to the application, you should be calling this method when the app is in focus and calling `supabase.auth.stopAutoRefresh()` when it's out of focus.
   *
   * @example Start and stop auto refresh in React Native
   * ```js
   * import { AppState } from 'react-native'
   *
   * // make sure you register this only once!
   * AppState.addEventListener('change', (state) => {
   *   if (state === 'active') {
   *     supabase.auth.startAutoRefresh()
   *   } else {
   *     supabase.auth.stopAutoRefresh()
   *   }
   * })
   * ```
   */
  async startAutoRefresh() {
    this._removeVisibilityChangedCallback(), await this._startAutoRefresh();
  }
  /**
   * Stops an active auto refresh process running in the background (if any).
   *
   * If you call this method any managed visibility change callback will be
   * removed and you must manage visibility changes on your own.
   *
   * See {@link GoTrueClient.startAutoRefresh} for more details.
   *
   * @category Auth
   *
   * @remarks
   * - Only useful in non-browser environments such as React Native or Electron.
   * - The Supabase Auth library automatically starts and stops proactively refreshing the session when a tab is focused or not.
   * - On non-browser platforms, such as mobile or desktop apps built with web technologies, the library is not able to effectively determine whether the application is _focused_ or not.
   * - When your application goes in the background or out of focus, call this method to stop the proactive refreshing of the session.
   *
   * @example Start and stop auto refresh in React Native
   * ```js
   * import { AppState } from 'react-native'
   *
   * // make sure you register this only once!
   * AppState.addEventListener('change', (state) => {
   *   if (state === 'active') {
   *     supabase.auth.startAutoRefresh()
   *   } else {
   *     supabase.auth.stopAutoRefresh()
   *   }
   * })
   * ```
   */
  async stopAutoRefresh() {
    this._removeVisibilityChangedCallback(), await this._stopAutoRefresh();
  }
  /**
   * Tears down the client's background work: stops the auto-refresh interval,
   * removes the `visibilitychange` listener, closes the cross-tab
   * `BroadcastChannel`, and clears registered `onAuthStateChange` subscribers.
   *
   * Call this from cleanup hooks when the client is being replaced before
   * its JS realm is destroyed. React Strict Mode and HMR are the common
   * cases. Any in-flight `fetch` calls continue to completion and may still
   * write to storage; dispose doesn't abort them or erase storage.
   *
   * Lifecycle caveat: because in-flight refreshes are not aborted, a
   * disposed instance can still persist a rotated session to storage after
   * `dispose()` returns. A subsequent `createClient` against the same
   * `storageKey` will pick up that session on its next read. If you need
   * strict isolation between client lifecycles, await any pending auth
   * operation before calling `dispose()` (or change the `storageKey` for
   * the replacement client).
   *
   * Safe to call repeatedly.
   *
   * @category Auth
   *
   * @example Cleanup on React unmount
   * ```ts
   * useEffect(() => {
   *   const client = createClient(...)
   *   return () => { client.auth.dispose() }
   * }, [])
   * ```
   */
  async dispose() {
    var e;
    this._removeVisibilityChangedCallback(), await this._stopAutoRefresh(), (e = this.broadcastChannel) === null || e === void 0 || e.close(), this.broadcastChannel = null, this.stateChangeEmitters.clear();
  }
  /**
   * Runs the auto refresh token tick.
   */
  async _autoRefreshTokenTick() {
    if (this._debug("#_autoRefreshTokenTick()", "begin"), this.lock != null) {
      try {
        await this._acquireLock(0, async () => {
          try {
            const e = Date.now();
            try {
              return await this._useSession(async (r) => {
                const { data: { session: n } } = r;
                if (!n || !n.refresh_token || !n.expires_at) {
                  this._debug("#_autoRefreshTokenTick()", "no session");
                  return;
                }
                const s = Math.floor((n.expires_at * 1e3 - e) / ct);
                this._debug("#_autoRefreshTokenTick()", `access token expires in ${s} ticks, a tick lasts ${ct}ms, refresh threshold is ${fn} ticks`), s <= fn && await this._callRefreshToken(n.refresh_token);
              });
            } catch (r) {
              console.error("Auto refresh tick failed with error. This is likely a transient error.", r);
            }
          } finally {
            this._debug("#_autoRefreshTokenTick()", "end");
          }
        });
      } catch (e) {
        if (e instanceof ny)
          this._debug("auto refresh token tick lock not available");
        else
          throw e;
      }
      return;
    }
    if (this.refreshingDeferred !== null) {
      this._debug("#_autoRefreshTokenTick()", "refresh already in flight, skipping");
      return;
    }
    try {
      const e = Date.now();
      try {
        await this._useSession(async (r) => {
          const { data: { session: n } } = r;
          if (!n || !n.refresh_token || !n.expires_at) {
            this._debug("#_autoRefreshTokenTick()", "no session");
            return;
          }
          const s = Math.floor((n.expires_at * 1e3 - e) / ct);
          this._debug("#_autoRefreshTokenTick()", `access token expires in ${s} ticks, a tick lasts ${ct}ms, refresh threshold is ${fn} ticks`), s <= fn && await this._callRefreshToken(n.refresh_token);
        });
      } catch (r) {
        console.error("Auto refresh tick failed with error. This is likely a transient error.", r);
      }
    } finally {
      this._debug("#_autoRefreshTokenTick()", "end");
    }
  }
  /**
   * Registers callbacks on the browser / platform, which in-turn run
   * algorithms when the browser window/tab are in foreground. On non-browser
   * platforms it assumes always foreground.
   */
  async _handleVisibilityChange() {
    if (this._debug("#_handleVisibilityChange()"), !oe() || !(window != null && window.addEventListener))
      return this.autoRefreshToken && this.startAutoRefresh(), !1;
    try {
      this.visibilityChangedCallback = async () => {
        try {
          await this._onVisibilityChanged(!1);
        } catch (e) {
          this._debug("#visibilityChangedCallback", "error", e);
        }
      }, window == null || window.addEventListener("visibilitychange", this.visibilityChangedCallback), await this._onVisibilityChanged(!0);
    } catch (e) {
      console.error("_handleVisibilityChange", e);
    }
  }
  /**
   * Callback registered with `window.addEventListener('visibilitychange')`.
   */
  async _onVisibilityChanged(e) {
    const r = `#_onVisibilityChanged(${e})`;
    if (this._debug(r, "visibilityState", document.visibilityState), document.visibilityState === "visible") {
      if (this.autoRefreshToken && this._startAutoRefresh(), !e)
        if (await this.initializePromise, this.lock != null)
          await this._acquireLock(this.lockAcquireTimeout, async () => {
            if (document.visibilityState !== "visible") {
              this._debug(r, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
              return;
            }
            await this._recoverAndRefresh();
          });
        else {
          if (document.visibilityState !== "visible") {
            this._debug(r, "visibilityState is no longer visible, skipping recovery");
            return;
          }
          await this._recoverAndRefresh();
        }
    } else document.visibilityState === "hidden" && this.autoRefreshToken && this._stopAutoRefresh();
  }
  /**
   * Generates the relevant login URL for a third-party provider.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
   */
  async _getUrlForProvider(e, r, n) {
    let s = n == null ? void 0 : n.redirectTo, i = null, o = null, a = null;
    this.flowType === "pkce" && ([i, o, a] = await this._getCodeChallengeAndMethod(), s = this._maybeAppendFlowIdToRedirect(s, a));
    const l = [`provider=${encodeURIComponent(r)}`];
    if (s && l.push(`redirect_to=${encodeURIComponent(s)}`), n != null && n.scopes && l.push(`scopes=${encodeURIComponent(n.scopes)}`), i != null && o != null) {
      const u = new URLSearchParams({
        code_challenge: `${encodeURIComponent(i)}`,
        code_challenge_method: `${encodeURIComponent(o)}`
      });
      l.push(u.toString());
    }
    if (n != null && n.queryParams) {
      const u = new URLSearchParams(n.queryParams);
      l.push(u.toString());
    }
    return n != null && n.skipBrowserRedirect && l.push(`skip_http_redirect=${n.skipBrowserRedirect}`), { url: `${e}?${l.join("&")}`, flowId: a };
  }
  /**
   * Appends the reserved flow id parameter to a redirect URL so the callback
   * can be matched to the verifier stored for its flow. Opt-in via
   * `experimental.appendPkceFlowIdToRedirects`: redirect URLs are validated
   * against the project's allow list including the query string, so an extra
   * parameter can stop exact (non-wildcard) entries from matching.
   */
  _maybeAppendFlowIdToRedirect(e, r) {
    return !e || !r || !this.experimental.appendPkceFlowIdToRedirects ? e ?? void 0 : Fv(e, r);
  }
  /**
   * Generates and stores a PKCE challenge/verifier pair for a new flow,
   * logging any pending verifier the bounded slot ring evicts.
   */
  async _getCodeChallengeAndMethod(e = !1) {
    return Hv(this.storage, this.storageKey, e, (r) => this._debug("#_getCodeChallengeAndMethod()", "evicted oldest pending PKCE verifier slot", r));
  }
  async _unenroll(e) {
    try {
      return await this._useSession(async (r) => {
        var n;
        const { data: s, error: i } = r;
        return i ? this._returnResult({ data: null, error: i }) : await x(this.fetch, "DELETE", `${this.url}/factors/${e.factorId}`, {
          headers: this.headers,
          jwt: (n = s == null ? void 0 : s.session) === null || n === void 0 ? void 0 : n.access_token
        });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _enroll(e) {
    try {
      return await this._useSession(async (r) => {
        var n, s;
        const { data: i, error: o } = r;
        if (o)
          return this._returnResult({ data: null, error: o });
        const a = Object.assign({ friendly_name: e.friendlyName, factor_type: e.factorType }, e.factorType === "phone" ? { phone: e.phone } : e.factorType === "totp" ? { issuer: e.issuer } : {}), { data: l, error: u } = await x(this.fetch, "POST", `${this.url}/factors`, {
          body: a,
          headers: this.headers,
          jwt: (n = i == null ? void 0 : i.session) === null || n === void 0 ? void 0 : n.access_token
        });
        return u ? this._returnResult({ data: null, error: u }) : (e.factorType === "totp" && l.type === "totp" && (!((s = l == null ? void 0 : l.totp) === null || s === void 0) && s.qr_code) && (l.totp.qr_code = `data:image/svg+xml;utf-8,${l.totp.qr_code}`), this._returnResult({ data: l, error: null }));
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _verify(e) {
    const r = async () => {
      try {
        return await this._useSession(async (n) => {
          var s;
          const { data: i, error: o } = n;
          if (o)
            return this._returnResult({ data: null, error: o });
          const a = Object.assign({ challenge_id: e.challengeId }, "webauthn" in e ? {
            webauthn: Object.assign(Object.assign({}, e.webauthn), { credential_response: e.webauthn.type === "create" ? gc(e.webauthn.credential_response) : mc(e.webauthn.credential_response) })
          } : { code: e.code }), { data: l, error: u } = await x(this.fetch, "POST", `${this.url}/factors/${e.factorId}/verify`, {
            body: a,
            headers: this.headers,
            jwt: (s = i == null ? void 0 : i.session) === null || s === void 0 ? void 0 : s.access_token
          });
          return u ? this._returnResult({ data: null, error: u }) : (await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + l.expires_in }, l)), await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", l), this._returnResult({ data: l, error: u }));
        });
      } catch (n) {
        if (C(n))
          return this._returnResult({ data: null, error: n });
        throw n;
      }
    };
    return this.lock != null ? this._acquireLock(this.lockAcquireTimeout, r) : r();
  }
  async _challenge(e) {
    const r = async () => {
      try {
        return await this._useSession(async (n) => {
          var s;
          const { data: i, error: o } = n;
          if (o)
            return this._returnResult({ data: null, error: o });
          const a = await x(this.fetch, "POST", `${this.url}/factors/${e.factorId}/challenge`, {
            body: e,
            headers: this.headers,
            jwt: (s = i == null ? void 0 : i.session) === null || s === void 0 ? void 0 : s.access_token
          });
          if (a.error)
            return a;
          const { data: l } = a;
          if (l.type !== "webauthn")
            return { data: l, error: null };
          switch (l.webauthn.type) {
            case "create":
              return {
                data: Object.assign(Object.assign({}, l), { webauthn: Object.assign(Object.assign({}, l.webauthn), { credential_options: Object.assign(Object.assign({}, l.webauthn.credential_options), { publicKey: fc(l.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
            case "request":
              return {
                data: Object.assign(Object.assign({}, l), { webauthn: Object.assign(Object.assign({}, l.webauthn), { credential_options: Object.assign(Object.assign({}, l.webauthn.credential_options), { publicKey: pc(l.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
          }
        });
      } catch (n) {
        if (C(n))
          return this._returnResult({ data: null, error: n });
        throw n;
      }
    };
    return this.lock != null ? this._acquireLock(this.lockAcquireTimeout, r) : r();
  }
  /**
   * {@link GoTrueMFAApi#challengeAndVerify}
   */
  async _challengeAndVerify(e) {
    const { data: r, error: n } = await this._challenge({
      factorId: e.factorId
    });
    return n ? this._returnResult({ data: null, error: n }) : await this._verify({
      factorId: e.factorId,
      challengeId: r.id,
      code: e.code
    });
  }
  /**
   * {@link GoTrueMFAApi#listFactors}
   */
  async _listFactors() {
    var e;
    const { data: { user: r }, error: n } = await this.getUser();
    if (n)
      return { data: null, error: n };
    const s = {
      all: [],
      phone: [],
      totp: [],
      webauthn: []
    };
    for (const i of (e = r == null ? void 0 : r.factors) !== null && e !== void 0 ? e : [])
      s.all.push(i), i.status === "verified" && s[i.factor_type].push(i);
    return {
      data: s,
      error: null
    };
  }
  /**
   * {@link GoTrueMFAApi#getAuthenticatorAssuranceLevel}
   */
  async _getAuthenticatorAssuranceLevel(e) {
    var r, n, s, i;
    if (e)
      try {
        const { payload: g } = js(e);
        let v = null;
        g.aal && (v = g.aal);
        let y = v;
        const { data: { user: k }, error: f } = await this.getUser(e);
        if (f)
          return this._returnResult({ data: null, error: f });
        ((n = (r = k == null ? void 0 : k.factors) === null || r === void 0 ? void 0 : r.filter((w) => w.status === "verified")) !== null && n !== void 0 ? n : []).length > 0 && (y = "aal2");
        const m = g.amr || [];
        return { data: { currentLevel: v, nextLevel: y, currentAuthenticationMethods: m }, error: null };
      } catch (g) {
        if (C(g))
          return this._returnResult({ data: null, error: g });
        throw g;
      }
    const { data: { session: o }, error: a } = await this.getSession();
    if (a)
      return this._returnResult({ data: null, error: a });
    if (!o)
      return {
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: null
      };
    const { payload: l } = js(o.access_token);
    let u = null;
    l.aal && (u = l.aal);
    let c = u;
    ((i = (s = o.user.factors) === null || s === void 0 ? void 0 : s.filter((g) => g.status === "verified")) !== null && i !== void 0 ? i : []).length > 0 && (c = "aal2");
    const d = l.amr || [];
    return { data: { currentLevel: u, nextLevel: c, currentAuthenticationMethods: d }, error: null };
  }
  /**
   * Retrieves details about an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * Returns authorization details including client info, scopes, and user information.
   * If the response includes only a redirect_url field, it means consent was already given - the caller
   * should handle the redirect manually if needed.
   */
  async _getAuthorizationDetails(e) {
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        return s ? this._returnResult({ data: null, error: s }) : n ? await x(this.fetch, "GET", `${this.url}/oauth/authorizations/${e}`, {
          headers: this.headers,
          jwt: n.access_token,
          xform: (i) => ({ data: i, error: null })
        }) : this._returnResult({ data: null, error: new ne() });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * Approves an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _approveAuthorization(e, r) {
    try {
      return await this._useSession(async (n) => {
        const { data: { session: s }, error: i } = n;
        if (i)
          return this._returnResult({ data: null, error: i });
        if (!s)
          return this._returnResult({ data: null, error: new ne() });
        const o = await x(this.fetch, "POST", `${this.url}/oauth/authorizations/${e}/consent`, {
          headers: this.headers,
          jwt: s.access_token,
          body: { action: "approve" },
          xform: (a) => ({ data: a, error: null })
        });
        return o.data && o.data.redirect_url && oe() && !(r != null && r.skipBrowserRedirect) && window.location.assign(o.data.redirect_url), o;
      });
    } catch (n) {
      if (C(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  /**
   * Denies an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _denyAuthorization(e, r) {
    try {
      return await this._useSession(async (n) => {
        const { data: { session: s }, error: i } = n;
        if (i)
          return this._returnResult({ data: null, error: i });
        if (!s)
          return this._returnResult({ data: null, error: new ne() });
        const o = await x(this.fetch, "POST", `${this.url}/oauth/authorizations/${e}/consent`, {
          headers: this.headers,
          jwt: s.access_token,
          body: { action: "deny" },
          xform: (a) => ({ data: a, error: null })
        });
        return o.data && o.data.redirect_url && oe() && !(r != null && r.skipBrowserRedirect) && window.location.assign(o.data.redirect_url), o;
      });
    } catch (n) {
      if (C(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  /**
   * Lists all OAuth grants that the authenticated user has authorized.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _listOAuthGrants() {
    try {
      return await this._useSession(async (e) => {
        const { data: { session: r }, error: n } = e;
        return n ? this._returnResult({ data: null, error: n }) : r ? await x(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: r.access_token,
          xform: (s) => ({ data: s, error: null })
        }) : this._returnResult({ data: null, error: new ne() });
      });
    } catch (e) {
      if (C(e))
        return this._returnResult({ data: null, error: e });
      throw e;
    }
  }
  /**
   * Revokes a user's OAuth grant for a specific client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _revokeOAuthGrant(e) {
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        return s ? this._returnResult({ data: null, error: s }) : n ? (await x(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: n.access_token,
          query: { client_id: e.clientId },
          noResolveJson: !0
        }), { data: {}, error: null }) : this._returnResult({ data: null, error: new ne() });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async fetchJwk(e, r = { keys: [] }) {
    let n = r.keys.find((a) => a.kid === e);
    if (n)
      return n;
    const s = Date.now();
    if (n = this.jwks.keys.find((a) => a.kid === e), n && this.jwks_cached_at + wv > s)
      return n;
    const { data: i, error: o } = await x(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, {
      headers: this.headers
    });
    if (o)
      throw o;
    return !i.keys || i.keys.length === 0 || (this.jwks = i, this.jwks_cached_at = s, n = i.keys.find((a) => a.kid === e), !n) ? null : n;
  }
  /**
   * Extracts the JWT claims present in the access token by first verifying the
   * JWT against the server's JSON Web Key Set endpoint
   * `/.well-known/jwks.json` which is often cached, resulting in significantly
   * faster responses. Prefer this method over {@link GoTrueClient.getUser} which always
   * sends a request to the Auth server for each JWT.
   *
   * If the project is not using an asymmetric JWT signing key (like ECC or
   * RSA) it always sends a request to the Auth server (similar to
   * {@link GoTrueClient.getUser}) to verify the JWT.
   *
   * @param jwt An optional specific JWT you wish to verify, not the one you
   *            can obtain from {@link GoTrueClient.getSession}.
   * @param options Various additional options that allow you to customize the
   *                behavior of this method.
   *
   * @category Auth
   *
   * @remarks
   * - Parses the user's [access token](/docs/guides/auth/sessions#access-token-jwt-claims) as a [JSON Web Token (JWT)](/docs/guides/auth/jwts) and returns its components if valid and not expired.
   * - If your project is using asymmetric JWT signing keys, then the verification is done locally usually without a network request using the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
   * - A network request is sent to your project's JWT signing key discovery endpoint `https://project-id.supabase.co/auth/v1/.well-known/jwks.json`, which is cached locally. If your environment is ephemeral, such as a Lambda function that is destroyed after every request, a network request will be sent for each new invocation. Supabase provides a network-edge cache providing fast responses for these situations.
   * - If the user's access token is about to expire when calling this function, the user's session will first be refreshed before validating the JWT.
   * - If your project is using a symmetric secret to sign the JWT, it always sends a request similar to `getUser()` to validate the JWT at the server before returning the decoded token. This is also used if the WebCrypto API is not available in the environment. Make sure you polyfill it in such situations.
   * - The returned claims can be customized per project using the [Custom Access Token Hook](/docs/guides/auth/auth-hooks/custom-access-token-hook).
   *
   * @example Get JWT claims, header and signature
   * ```js
   * const { data, error } = await supabase.auth.getClaims()
   * ```
   *
   * @exampleResponse Get JWT claims, header and signature
   * ```json
   * {
   *   "data": {
   *     "claims": {
   *       "aal": "aal1",
   *       "amr": [{
   *         "method": "email",
   *         "timestamp": 1715766000
   *       }],
   *       "app_metadata": {},
   *       "aud": "authenticated",
   *       "email": "example@email.com",
   *       "exp": 1715769600,
   *       "iat": 1715766000,
   *       "is_anonymous": false,
   *       "iss": "https://project-id.supabase.co/auth/v1",
   *       "phone": "+13334445555",
   *       "role": "authenticated",
   *       "session_id": "11111111-1111-1111-1111-111111111111",
   *       "sub": "11111111-1111-1111-1111-111111111111",
   *       "user_metadata": {}
   *     },
   *     "header": {
   *       "alg": "RS256",
   *       "typ": "JWT",
   *       "kid": "11111111-1111-1111-1111-111111111111"
   *     },
   *     "signature": [/** Uint8Array *\/],
   *   },
   *   "error": null
   * }
   * ```
   */
  async getClaims(e, r = {}) {
    try {
      let n = e;
      if (!n) {
        const { data: g, error: v } = await this.getSession();
        if (v || !g.session)
          return this._returnResult({ data: null, error: v });
        n = g.session.access_token;
      }
      const { header: s, payload: i, signature: o, raw: { header: a, payload: l } } = js(n);
      if (!(r != null && r.allowExpired))
        try {
          Kv(i.exp);
        } catch (g) {
          throw new wi(g instanceof Error ? g.message : "JWT validation failed");
        }
      const u = !s.alg || s.alg.startsWith("HS") || !s.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(s.kid, r != null && r.keys ? { keys: r.keys } : r == null ? void 0 : r.jwks);
      if (!u) {
        const { error: g } = await this.getUser(n);
        if (g)
          throw g;
        return {
          data: {
            claims: i,
            header: s,
            signature: o
          },
          error: null
        };
      }
      const c = qv(s.alg), h = await crypto.subtle.importKey("jwk", u, c, !0, [
        "verify"
      ]);
      if (!await crypto.subtle.verify(c, h, o, Ov(`${a}.${l}`)))
        throw new wi("Invalid JWT signature");
      return {
        data: {
          claims: i,
          header: s,
          signature: o
        },
        error: null
      };
    } catch (n) {
      if (C(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  // --- Passkey Methods ---
  /**
   * Sign in with a passkey. Handles the full WebAuthn ceremony:
   * 1. Fetches authentication challenge from server
   * 2. Prompts user via navigator.credentials.get()
   * 3. Verifies credential with server and creates session
   *
   * Requires `auth.experimental.passkey: true`.
   *
   * @category Auth
   */
  async signInWithPasskey(e) {
    var r, n, s;
    He(this.experimental);
    try {
      if (!Si())
        return this._returnResult({
          data: null,
          error: new Ge("Browser does not support WebAuthn", null)
        });
      const { data: i, error: o } = await this._startPasskeyAuthentication({
        options: { captchaToken: (r = e == null ? void 0 : e.options) === null || r === void 0 ? void 0 : r.captchaToken }
      });
      if (o || !i)
        return this._returnResult({ data: null, error: o });
      const a = pc(i.options), l = (s = (n = e == null ? void 0 : e.options) === null || n === void 0 ? void 0 : n.signal) !== null && s !== void 0 ? s : Pa.createNewAbortSignal(), { data: u, error: c } = await sf({
        publicKey: a,
        signal: l
      });
      if (c || !u)
        return this._returnResult({
          data: null,
          error: c ?? new Ge("WebAuthn ceremony failed", null)
        });
      const h = mc(u);
      return this._verifyPasskeyAuthentication({
        challengeId: i.challenge_id,
        credential: h
      });
    } catch (i) {
      if (C(i))
        return this._returnResult({ data: null, error: i });
      throw i;
    }
  }
  /**
   * Register a passkey for the current authenticated user. Handles the full WebAuthn ceremony:
   * 1. Fetches registration challenge from server
   * 2. Prompts user via navigator.credentials.create()
   * 3. Verifies credential with server
   *
   * Requires an active session. Requires `auth.experimental.passkey: true`.
   *
   * @category Auth
   */
  async registerPasskey(e) {
    var r, n;
    He(this.experimental);
    try {
      if (!Si())
        return this._returnResult({
          data: null,
          error: new Ge("Browser does not support WebAuthn", null)
        });
      const { data: s, error: i } = await this._startPasskeyRegistration();
      if (i || !s)
        return this._returnResult({ data: null, error: i });
      const o = fc(s.options), a = (n = (r = e == null ? void 0 : e.options) === null || r === void 0 ? void 0 : r.signal) !== null && n !== void 0 ? n : Pa.createNewAbortSignal(), { data: l, error: u } = await nf({
        publicKey: o,
        signal: a
      });
      if (u || !l)
        return this._returnResult({
          data: null,
          error: u ?? new Ge("WebAuthn ceremony failed", null)
        });
      const c = gc(l);
      return this._verifyPasskeyRegistration({
        challengeId: s.challenge_id,
        credential: c
      });
    } catch (s) {
      if (C(s))
        return this._returnResult({ data: null, error: s });
      throw s;
    }
  }
  /**
   * Start passkey registration for the current authenticated user.
   * Returns WebAuthn credential creation options to pass to navigator.credentials.create().
   */
  async _startPasskeyRegistration() {
    He(this.experimental);
    try {
      return await this._useSession(async (e) => {
        const { data: { session: r }, error: n } = e;
        if (n)
          return this._returnResult({ data: null, error: n });
        if (!r)
          return this._returnResult({ data: null, error: new ne() });
        const { data: s, error: i } = await x(this.fetch, "POST", `${this.url}/passkeys/registration/options`, {
          headers: this.headers,
          jwt: r.access_token,
          body: {}
        });
        return i ? this._returnResult({ data: null, error: i }) : this._returnResult({ data: s, error: null });
      });
    } catch (e) {
      if (C(e))
        return this._returnResult({ data: null, error: e });
      throw e;
    }
  }
  /**
   * Verify passkey registration with the credential response.
   * The credentialResponse should be the serialized output of navigator.credentials.create().
   */
  async _verifyPasskeyRegistration(e) {
    He(this.experimental);
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        if (s)
          return this._returnResult({ data: null, error: s });
        if (!n)
          return this._returnResult({ data: null, error: new ne() });
        const { data: i, error: o } = await x(this.fetch, "POST", `${this.url}/passkeys/registration/verify`, {
          headers: this.headers,
          jwt: n.access_token,
          body: {
            challenge_id: e.challengeId,
            credential: e.credential
          }
        });
        return o ? this._returnResult({ data: null, error: o }) : this._returnResult({ data: i, error: null });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * Start passkey authentication.
   * Returns WebAuthn credential request options to pass to navigator.credentials.get().
   */
  async _startPasskeyAuthentication(e) {
    var r;
    He(this.experimental);
    try {
      const { data: n, error: s } = await x(this.fetch, "POST", `${this.url}/passkeys/authentication/options`, {
        headers: this.headers,
        body: {
          gotrue_meta_security: { captcha_token: (r = e == null ? void 0 : e.options) === null || r === void 0 ? void 0 : r.captchaToken }
        }
      });
      return s ? this._returnResult({ data: null, error: s }) : this._returnResult({ data: n, error: null });
    } catch (n) {
      if (C(n))
        return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  /**
   * Verify passkey authentication and create a session.
   * The credential should be the serialized output of navigator.credentials.get().
   */
  async _verifyPasskeyAuthentication(e) {
    He(this.experimental);
    try {
      const { data: r, error: n } = await x(this.fetch, "POST", `${this.url}/passkeys/authentication/verify`, {
        headers: this.headers,
        body: {
          challenge_id: e.challengeId,
          credential: e.credential
        },
        xform: Ie
      });
      return n ? this._returnResult({ data: null, error: n }) : (r.session && (await this._saveSession(r.session), await this._notifyAllSubscribers("SIGNED_IN", r.session)), this._returnResult({ data: r, error: null }));
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * List all passkeys for the current user.
   */
  async _listPasskeys() {
    He(this.experimental);
    try {
      return await this._useSession(async (e) => {
        const { data: { session: r }, error: n } = e;
        if (n)
          return this._returnResult({ data: null, error: n });
        if (!r)
          return this._returnResult({ data: null, error: new ne() });
        const { data: s, error: i } = await x(this.fetch, "GET", `${this.url}/passkeys`, {
          headers: this.headers,
          jwt: r.access_token,
          xform: (o) => ({ data: o, error: null })
        });
        return i ? this._returnResult({ data: null, error: i }) : this._returnResult({ data: s, error: null });
      });
    } catch (e) {
      if (C(e))
        return this._returnResult({ data: null, error: e });
      throw e;
    }
  }
  /**
   * Update a passkey.
   */
  async _updatePasskey(e) {
    He(this.experimental);
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        if (s)
          return this._returnResult({ data: null, error: s });
        if (!n)
          return this._returnResult({ data: null, error: new ne() });
        const { data: i, error: o } = await x(this.fetch, "PATCH", `${this.url}/passkeys/${e.passkeyId}`, {
          headers: this.headers,
          jwt: n.access_token,
          body: { friendly_name: e.friendlyName }
        });
        return o ? this._returnResult({ data: null, error: o }) : this._returnResult({ data: i, error: null });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  /**
   * Delete a passkey.
   */
  async _deletePasskey(e) {
    He(this.experimental);
    try {
      return await this._useSession(async (r) => {
        const { data: { session: n }, error: s } = r;
        if (s)
          return this._returnResult({ data: null, error: s });
        if (!n)
          return this._returnResult({ data: null, error: new ne() });
        const { error: i } = await x(this.fetch, "DELETE", `${this.url}/passkeys/${e.passkeyId}`, {
          headers: this.headers,
          jwt: n.access_token,
          noResolveJson: !0
        });
        return i ? this._returnResult({ data: null, error: i }) : this._returnResult({ data: null, error: null });
      });
    } catch (r) {
      if (C(r))
        return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
}
Qn.nextInstanceID = {};
const vy = Qn, yy = "2.111.0";
let pn = "", bi;
if (typeof Deno < "u") {
  var Co;
  pn = "deno", bi = (Co = Deno.version) === null || Co === void 0 ? void 0 : Co.deno;
} else if (typeof document < "u") pn = "web";
else if (typeof navigator < "u" && navigator.product === "ReactNative") pn = "react-native";
else {
  var Ro;
  pn = "node";
  const t = globalThis.process;
  bi = t == null || (Ro = t.version) === null || Ro === void 0 ? void 0 : Ro.replace(/^v/, "");
}
const of = [`runtime=${pn}`];
bi && of.push(`runtime-version=${bi}`);
const wy = { "X-Client-Info": `supabase-js/${yy}; ${of.join("; ")}` }, _y = { headers: wy }, ky = { schema: "public" }, Sy = {
  autoRefreshToken: !0,
  persistSession: !0,
  detectSessionInUrl: !0,
  flowType: "implicit"
}, Ey = {}, by = {
  enabled: !1,
  respectSamplingDecision: !0
};
function Ty(t, e, r, n) {
  function s(i) {
    return i instanceof r ? i : new r(function(o) {
      o(i);
    });
  }
  return new (r || (r = Promise))(function(i, o) {
    function a(c) {
      try {
        u(n.next(c));
      } catch (h) {
        o(h);
      }
    }
    function l(c) {
      try {
        u(n.throw(c));
      } catch (h) {
        o(h);
      }
    }
    function u(c) {
      c.done ? i(c.value) : s(c.value).then(a, l);
    }
    u((n = n.apply(t, [])).next());
  });
}
let Oo = null;
const Cy = "@opentelemetry/api";
function Ry() {
  return Oo === null && (Oo = import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    /* @vite-ignore */
    Cy
  ).catch(() => null)), Oo;
}
function Oy() {
  return Ty(this, void 0, void 0, function* () {
    try {
      const t = yield Ry();
      if (!t || !t.propagation || !t.context) return null;
      const e = {};
      t.propagation.inject(t.context.active(), e);
      const r = e.traceparent;
      return r ? {
        traceparent: r,
        tracestate: e.tracestate,
        baggage: e.baggage
      } : null;
    } catch {
      return null;
    }
  });
}
function xy(t) {
  if (!t || typeof t != "string") return null;
  const e = t.split("-");
  if (e.length !== 4) return null;
  const [r, n, s, i] = e;
  if (r.length !== 2 || n.length !== 32 || s.length !== 16 || i.length !== 2) return null;
  const o = /^[0-9a-f]+$/i;
  return !o.test(r) || !o.test(n) || !o.test(s) || !o.test(i) || n === "00000000000000000000000000000000" || s === "0000000000000000" ? null : {
    version: r,
    traceId: n,
    parentId: s,
    traceFlags: i,
    isSampled: (parseInt(i, 16) & 1) === 1
  };
}
function Ay(t, e) {
  if (!t || !e || e.length === 0) return !1;
  let r;
  if (t instanceof URL) r = t;
  else try {
    r = new URL(t);
  } catch {
    return !1;
  }
  for (const n of e) try {
    if (typeof n == "string") {
      if (Py(r.hostname, n)) return !0;
    } else if (n instanceof RegExp) {
      if (n.test(r.hostname)) return !0;
    } else if (typeof n == "function" && n(r))
      return !0;
  } catch {
    continue;
  }
  return !1;
}
function Py(t, e) {
  if (e === t) return !0;
  if (e.startsWith("*.")) {
    const r = e.slice(2);
    if (t.endsWith(r) && (t === r || t.endsWith("." + r)))
      return !0;
  }
  return !1;
}
function jy(t) {
  const e = [];
  try {
    const r = new URL(t);
    e.push(r.hostname);
  } catch {
  }
  return e.push("*.supabase.co", "*.supabase.in"), e.push("localhost", "127.0.0.1", "[::1]"), e;
}
function Yn(t) {
  "@babel/helpers - typeof";
  return Yn = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
    return typeof e;
  } : function(e) {
    return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
  }, Yn(t);
}
function Iy(t, e) {
  if (Yn(t) != "object" || !t) return t;
  var r = t[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(t, e);
    if (Yn(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function Ny(t) {
  var e = Iy(t, "string");
  return Yn(e) == "symbol" ? e : e + "";
}
function Ly(t, e, r) {
  return (e = Ny(e)) in t ? Object.defineProperty(t, e, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : t[e] = r, t;
}
function vc(t, e) {
  var r = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(t);
    e && (n = n.filter(function(s) {
      return Object.getOwnPropertyDescriptor(t, s).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function q(t) {
  for (var e = 1; e < arguments.length; e++) {
    var r = arguments[e] != null ? arguments[e] : {};
    e % 2 ? vc(Object(r), !0).forEach(function(n) {
      Ly(t, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : vc(Object(r)).forEach(function(n) {
      Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return t;
}
const $y = (t) => t ? (...e) => t(...e) : (...e) => fetch(...e), Uy = () => Headers, af = (t) => t.startsWith("sb_publishable_") || t.startsWith("sb_secret_"), Dy = "sb_temp_", yc = /* @__PURE__ */ new Set(), My = (t) => {
  var e, r;
  if (!t.startsWith("sb_") || af(t) || t.startsWith(Dy)) return;
  const n = (e = (r = t.match(/^sb_[a-zA-Z0-9]+_/)) === null || r === void 0 ? void 0 : r[0]) !== null && e !== void 0 ? e : "unknown";
  yc.has(n) || (yc.add(n), console.warn("@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed and send this key as-is; if you see authentication errors you may need to upgrade @supabase/supabase-js to a version that recognizes this key type."));
}, wc = (t, e, r, n, s, i) => {
  const o = $y(n), a = Uy(), l = (s == null ? void 0 : s.enabled) === !0, u = (s == null ? void 0 : s.respectSamplingDecision) !== !1, c = l ? jy(e) : null, h = !(i != null && i.omitApiKeyAsBearer && af(t));
  return async (d, g) => {
    const v = await r();
    let y = new a(g == null ? void 0 : g.headers);
    if (y.has("apikey") || y.set("apikey", t), !y.has("Authorization")) {
      const k = v ?? (h ? t : null);
      k && y.set("Authorization", `Bearer ${k}`);
    }
    if (c) {
      const k = await zy(d, c, u);
      k && (k.traceparent && !y.has("traceparent") && y.set("traceparent", k.traceparent), k.tracestate && !y.has("tracestate") && y.set("tracestate", k.tracestate), k.baggage && !y.has("baggage") && y.set("baggage", k.baggage));
    }
    return o(d, q(q({}, g), {}, { headers: y }));
  };
};
async function zy(t, e, r) {
  if (!Ay(typeof t == "string" || t instanceof URL ? t : t.url, e)) return null;
  const n = await Oy();
  if (!n || !n.traceparent) return null;
  if (r) {
    const s = xy(n.traceparent);
    if (s && !s.isSampled) return null;
  }
  return n;
}
function _c(t) {
  return typeof t == "boolean" ? { enabled: t } : t;
}
function By(t) {
  return t.endsWith("/") ? t : t + "/";
}
function Fy(t, e) {
  var r, n, s, i, o, a;
  const { db: l, auth: u, realtime: c, global: h } = t, { db: d, auth: g, realtime: v, global: y } = e, k = _c(t.tracePropagation), f = _c(e.tracePropagation), p = {
    db: q(q({}, d), l),
    auth: q(q({}, g), u),
    realtime: q(q({}, v), c),
    storage: {},
    global: q(q(q({}, y), h), {}, { headers: q(q({}, (r = y == null ? void 0 : y.headers) !== null && r !== void 0 ? r : {}), (n = h == null ? void 0 : h.headers) !== null && n !== void 0 ? n : {}) }),
    tracePropagation: {
      enabled: (s = (i = k == null ? void 0 : k.enabled) !== null && i !== void 0 ? i : f == null ? void 0 : f.enabled) !== null && s !== void 0 ? s : !1,
      respectSamplingDecision: (o = (a = k == null ? void 0 : k.respectSamplingDecision) !== null && a !== void 0 ? a : f == null ? void 0 : f.respectSamplingDecision) !== null && o !== void 0 ? o : !0
    },
    accessToken: async () => ""
  };
  return t.accessToken ? p.accessToken = t.accessToken : delete p.accessToken, p;
}
function Hy(t) {
  const e = t == null ? void 0 : t.trim();
  if (!e) throw new Error("supabaseUrl is required.");
  if (!e.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
  try {
    return new URL(By(e));
  } catch {
    throw Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
}
var Wy = class extends vy {
  constructor(t) {
    super(t);
  }
}, Vy = class {
  /**
  * Create a new client for use in the browser.
  *
  * @category Initializing
  *
  * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
  * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
  * @param options Optional configuration for the client:
  * - `db.schema` — You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
  * - `auth.autoRefreshToken` — Set to `true` if you want to automatically refresh the token before expiring.
  * - `auth.persistSession` — Set to `true` if you want to automatically save the user session into local storage.
  * - `auth.detectSessionInUrl` — Set to `true` if you want to automatically detect OAuth grants in the URL and sign in the user.
  * - `realtime` — Options passed along to the realtime-js constructor.
  * - `storage` — Options passed along to the storage-js constructor.
  * - `global.fetch` — A custom fetch implementation.
  * - `global.headers` — Any additional headers to send with each network request.
  *
  * @example Creating a client
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * // Create a single supabase client for interacting with your database
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  * ```
  *
  * @example With a custom domain
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * // Use a custom domain as the supabase URL
  * const supabase = createClient('https://my-custom-domain.com', 'your-publishable-key')
  * ```
  *
  * @example With additional parameters
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * const options = {
  *   db: {
  *     schema: 'public',
  *   },
  *   auth: {
  *     autoRefreshToken: true,
  *     persistSession: true,
  *     detectSessionInUrl: true
  *   },
  *   global: {
  *     headers: { 'x-my-custom-header': 'my-app-name' },
  *   },
  * }
  * const supabase = createClient("https://xyzcompany.supabase.co", "your-publishable-key", options)
  * ```
  *
  * @exampleDescription With custom schemas
  * By default the API server points to the `public` schema. You can enable other database schemas within the Dashboard.
  * Go to [Settings > API > Exposed schemas](/dashboard/project/_/settings/api) and add the schema which you want to expose to the API.
  *
  * Note: each client connection can only access a single schema, so the code above can access the `other_schema` schema but cannot access the `public` schema.
  *
  * @example With custom schemas
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
  *   // Provide a custom schema. Defaults to "public".
  *   db: { schema: 'other_schema' }
  * })
  * ```
  *
  * @exampleDescription Custom fetch implementation
  * `supabase-js` uses the runtime's global `fetch` to make HTTP requests,
  * but an alternative `fetch` implementation can be provided as an option.
  * This is useful in environments where the global `fetch` is unavailable or where you want to customize request behavior.
  *
  * @example Custom fetch implementation
  * ```js
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
  *   global: { fetch: fetch.bind(globalThis) }
  * })
  * ```
  *
  * @exampleDescription React Native options with AsyncStorage
  * For React Native we recommend using `AsyncStorage` as the storage implementation for Supabase Auth.
  *
  * @example React Native options with AsyncStorage
  * ```js
  * import 'react-native-url-polyfill/auto'
  * import { createClient } from '@supabase/supabase-js'
  * import AsyncStorage from "@react-native-async-storage/async-storage";
  *
  * const supabase = createClient("https://xyzcompany.supabase.co", "your-publishable-key", {
  *   auth: {
  *     storage: AsyncStorage,
  *     autoRefreshToken: true,
  *     persistSession: true,
  *     detectSessionInUrl: false,
  *   },
  * });
  * ```
  *
  * @exampleDescription React Native options with Expo SecureStore
  * If you wish to encrypt the user's session information, you can use `aes-js` and store the encryption key in Expo SecureStore.
  * The `aes-js` library, a reputable JavaScript-only implementation of the AES encryption algorithm in CTR mode.
  * A new 256-bit encryption key is generated using the `react-native-get-random-values` library.
  * This key is stored inside Expo's SecureStore, while the value is encrypted and placed inside AsyncStorage.
  *
  * Please make sure that:
  * - You keep the `expo-secure-store`, `aes-js` and `react-native-get-random-values` libraries up-to-date.
  * - Choose the correct [`SecureStoreOptions`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestoreoptions) for your app's needs.
  *   E.g. [`SecureStore.WHEN_UNLOCKED`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestorewhen_unlocked) regulates when the data can be accessed.
  * - Carefully consider optimizations or other modifications to the above example, as those can lead to introducing subtle security vulnerabilities.
  *
  * @example React Native options with Expo SecureStore
  * ```ts
  * import 'react-native-url-polyfill/auto'
  * import { createClient } from '@supabase/supabase-js'
  * import AsyncStorage from '@react-native-async-storage/async-storage';
  * import * as SecureStore from 'expo-secure-store';
  * import * as aesjs from 'aes-js';
  * import 'react-native-get-random-values';
  *
  * // As Expo's SecureStore does not support values larger than 2048
  * // bytes, an AES-256 key is generated and stored in SecureStore, while
  * // it is used to encrypt/decrypt values stored in AsyncStorage.
  * class LargeSecureStore {
  *   private async _encrypt(key: string, value: string) {
  *     const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
  *
  *     const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  *     const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  *
  *     await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
  *
  *     return aesjs.utils.hex.fromBytes(encryptedBytes);
  *   }
  *
  *   private async _decrypt(key: string, value: string) {
  *     const encryptionKeyHex = await SecureStore.getItemAsync(key);
  *     if (!encryptionKeyHex) {
  *       return encryptionKeyHex;
  *     }
  *
  *     const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
  *     const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
  *
  *     return aesjs.utils.utf8.fromBytes(decryptedBytes);
  *   }
  *
  *   async getItem(key: string) {
  *     const encrypted = await AsyncStorage.getItem(key);
  *     if (!encrypted) { return encrypted; }
  *
  *     return await this._decrypt(key, encrypted);
  *   }
  *
  *   async removeItem(key: string) {
  *     await AsyncStorage.removeItem(key);
  *     await SecureStore.deleteItemAsync(key);
  *   }
  *
  *   async setItem(key: string, value: string) {
  *     const encrypted = await this._encrypt(key, value);
  *
  *     await AsyncStorage.setItem(key, encrypted);
  *   }
  * }
  *
  * const supabase = createClient("https://xyzcompany.supabase.co", "your-publishable-key", {
  *   auth: {
  *     storage: new LargeSecureStore(),
  *     autoRefreshToken: true,
  *     persistSession: true,
  *     detectSessionInUrl: false,
  *   },
  * });
  * ```
  *
  * @example With a database query
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
  *
  * const { data } = await supabase.from('profiles').select('*')
  * ```
  *
  * @exampleDescription With OpenTelemetry tracing
  * Opt in to W3C trace context propagation so the `trace_id` from your
  * client-side spans is attached to Supabase requests and appears in API
  * Gateway and Edge Function logs. Requires `@opentelemetry/api` to be
  * installed in your application. See [Tracing with the JS SDK](https://supabase.com/docs/guides/telemetry/client-side-tracing).
  *
  * @example With OpenTelemetry tracing
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  * import { trace } from '@opentelemetry/api'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
  *   tracePropagation: true,
  * })
  *
  * const tracer = trace.getTracer('my-app')
  *
  * await tracer.startActiveSpan('fetch-users', async (span) => {
  *   // Outgoing request carries the active trace context.
  *   const { data, error } = await supabase.from('users').select('*')
  *   span.end()
  * })
  * ```
  */
  constructor(t, e, r) {
    var n, s;
    this.supabaseUrl = t, this.supabaseKey = e;
    const i = Hy(t);
    if (!e) throw new Error("supabaseKey is required.");
    My(e), this.realtimeUrl = new URL("realtime/v1", i), this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws"), this.authUrl = new URL("auth/v1", i), this.storageUrl = new URL("storage/v1", i), this.functionsUrl = new URL("functions/v1", i);
    const o = `sb-${i.hostname.split(".")[0]}-auth-token`, a = {
      db: ky,
      realtime: Ey,
      auth: q(q({}, Sy), {}, { storageKey: o }),
      global: _y,
      tracePropagation: by
    }, l = Fy(r ?? {}, a);
    if (this.settings = l, this.storageKey = (n = l.auth.storageKey) !== null && n !== void 0 ? n : "", this.headers = (s = l.global.headers) !== null && s !== void 0 ? s : {}, l.accessToken)
      this.accessToken = l.accessToken, this.auth = new Proxy({}, { get: (c, h) => {
        throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(h)} is not possible`);
      } });
    else {
      var u;
      this.auth = this._initSupabaseAuthClient((u = l.auth) !== null && u !== void 0 ? u : {}, this.headers, l.global.fetch);
    }
    this.fetch = wc(e, t, this._getSessionToken.bind(this), l.global.fetch, l.tracePropagation), this.functionsFetch = wc(e, t, this._getSessionToken.bind(this), l.global.fetch, l.tracePropagation, { omitApiKeyAsBearer: !0 }), this.realtime = this._initRealtimeClient(q({
      headers: this.headers,
      accessToken: this._getAccessToken.bind(this),
      fetch: this.fetch
    }, l.realtime)), this.accessToken && Promise.resolve(this.accessToken()).then((c) => this.realtime.setAuth(c)).catch((c) => console.warn("Failed to set initial Realtime auth token:", c)), this.rest = new qg(new URL("rest/v1", i).href, {
      headers: this.headers,
      schema: l.db.schema,
      fetch: this.fetch,
      timeout: l.db.timeout,
      urlLengthLimit: l.db.urlLengthLimit
    }), this.storage = new dv(this.storageUrl.href, this.headers, this.fetch, r == null ? void 0 : r.storage), l.accessToken || this._listenForAuthEvents();
  }
  /**
  * Supabase Functions allows you to deploy and invoke edge functions.
  */
  get functions() {
    return new Dg(this.functionsUrl.href, {
      headers: this.headers,
      customFetch: this.functionsFetch
    });
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  */
  from(t) {
    return this.rest.from(t);
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  */
  schema(t) {
    return this.rest.schema(t);
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  rpc(t, e = {}, r = {
    head: !1,
    get: !1,
    count: void 0
  }) {
    return this.rest.rpc(t, e, r);
  }
  /**
  * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
  *
  * @param {string} name - The name of the Realtime channel.
  * @param {Object} opts - The options to pass to the Realtime channel.
  *
  * @category Realtime
  */
  channel(t, e = { config: {} }) {
    return this.realtime.channel(t, e);
  }
  /**
  * Returns all Realtime channels.
  *
  * @category Realtime
  *
  * @example Get all channels
  * ```js
  * const channels = supabase.getChannels()
  * ```
  */
  getChannels() {
    return this.realtime.getChannels();
  }
  /**
  * Unsubscribes and removes Realtime channel from Realtime client.
  *
  * @param {RealtimeChannel} channel - The name of the Realtime channel.
  *
  *
  * @category Realtime
  *
  * @remarks
  * - Removing a channel is a great way to maintain the performance of your project's Realtime service as well as your database if you're listening to Postgres changes. Supabase will automatically handle cleanup 30 seconds after a client is disconnected, but unused channels may cause degradation as more clients are simultaneously subscribed.
  *
  * @example Removes a channel
  * ```js
  * supabase.removeChannel(myChannel)
  * ```
  */
  removeChannel(t) {
    return this.realtime.removeChannel(t);
  }
  /**
  * Unsubscribes and removes all Realtime channels from Realtime client.
  *
  * @category Realtime
  *
  * @remarks
  * - Removing channels is a great way to maintain the performance of your project's Realtime service as well as your database if you're listening to Postgres changes. Supabase will automatically handle cleanup 30 seconds after a client is disconnected, but unused channels may cause degradation as more clients are simultaneously subscribed.
  *
  * @example Remove all channels
  * ```js
  * supabase.removeAllChannels()
  * ```
  */
  removeAllChannels() {
    return this.realtime.removeAllChannels();
  }
  /**
  * The raw session token — the custom `accessToken` result or the signed-in user's JWT —
  * or `null` when there is no session. Unlike {@link _getAccessToken} it does not fall back
  * to `supabaseKey`, so callers can distinguish "no session" from "has session".
  */
  async _getSessionToken() {
    var t = this, e, r;
    if (t.accessToken) return await t.accessToken();
    const { data: n } = await t.auth.getSession();
    return (e = (r = n.session) === null || r === void 0 ? void 0 : r.access_token) !== null && e !== void 0 ? e : null;
  }
  async _getAccessToken() {
    var t = this, e;
    return (e = await t._getSessionToken()) !== null && e !== void 0 ? e : t.supabaseKey;
  }
  _initSupabaseAuthClient({ autoRefreshToken: t, persistSession: e, detectSessionInUrl: r, storage: n, userStorage: s, storageKey: i, flowType: o, lock: a, debug: l, throwOnError: u, experimental: c, lockAcquireTimeout: h, skipAutoInitialize: d }, g, v) {
    const y = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`
    };
    return new Wy({
      url: this.authUrl.href,
      headers: q(q({}, y), g),
      storageKey: i,
      autoRefreshToken: t,
      persistSession: e,
      detectSessionInUrl: r,
      storage: n,
      userStorage: s,
      flowType: o,
      lock: a,
      debug: l,
      throwOnError: u,
      experimental: c,
      fetch: v,
      lockAcquireTimeout: h,
      skipAutoInitialize: d,
      hasCustomAuthorizationHeader: Object.keys(this.headers).some((k) => k.toLowerCase() === "authorization")
    });
  }
  _initRealtimeClient(t) {
    return new $m(this.realtimeUrl.href, q(q({}, t), {}, { params: q(q({}, { apikey: this.supabaseKey }), t == null ? void 0 : t.params) }));
  }
  _listenForAuthEvents() {
    return this.auth.onAuthStateChange((t, e) => {
      this._handleTokenChanged(t, "CLIENT", e == null ? void 0 : e.access_token);
    });
  }
  _handleTokenChanged(t, e, r) {
    (t === "TOKEN_REFRESHED" || t === "SIGNED_IN" || t === "INITIAL_SESSION") && this.changedAccessToken !== r ? (this.changedAccessToken = r, this.realtime.setAuth(r)) : t === "SIGNED_OUT" && (this.realtime.setAuth(), e == "STORAGE" && this.auth.signOut(), this.changedAccessToken = void 0);
  }
};
const Ky = (t, e, r) => new Vy(t, e, r);
function qy() {
  if (typeof window < "u" || globalThis.Deno !== void 0) return !1;
  const t = globalThis.process;
  if (!t) return !1;
  const e = t.version;
  if (e == null) return !1;
  const r = e.match(/^v(\d+)\./);
  return r ? parseInt(r[1], 10) <= 20 : !1;
}
qy() && console.warn("⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715");
const Gy = "https://wseblryyqxawvbjmylbo.supabase.co", Jy = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM", Ti = Ky(Gy, Jy, { auth: { storageKey: "sb-wseblryyqxawvbjmylbo-auth-token", persistSession: !0, autoRefreshToken: !0 } }), Xn = (t) => new Intl.NumberFormat().format(Number(t || 0)), Qy = (t) => t != null && t.previous ? `${Math.round((t.current - t.previous) / t.previous * 100) > 0 ? "+" : ""}${Math.round((t.current - t.previous) / t.previous * 100)}%` : t != null && t.current ? "+100%" : "—", kc = (t) => t ? new Date(t).toLocaleDateString(void 0, { month: "short", day: "numeric", year: "2-digit" }) : "—";
function Kt({ title: t, rows: e = [] }) {
  const r = Math.max(1, ...e.map((n) => Number(n.value || 0)));
  return /* @__PURE__ */ _.jsxs("section", { className: "owal-card owal-break", children: [
    /* @__PURE__ */ _.jsx("h3", { children: t }),
    !e.length && /* @__PURE__ */ _.jsx("p", { className: "owal-empty", children: "No data yet" }),
    e.slice(0, 8).map((n) => /* @__PURE__ */ _.jsxs("div", { className: "owal-bar", children: [
      /* @__PURE__ */ _.jsxs("div", { children: [
        /* @__PURE__ */ _.jsx("span", { children: n.label }),
        /* @__PURE__ */ _.jsx("b", { children: Xn(n.value) })
      ] }),
      /* @__PURE__ */ _.jsx("i", { children: /* @__PURE__ */ _.jsx("em", { style: { width: `${Math.max(4, n.value / r * 100)}%` } }) })
    ] }, n.label))
  ] });
}
function Yy({ overview: t }) {
  const e = [["visitors", "Visitors"], ["visits", "Visits"], ["signups", "Signups"], ["onboarded", "Onboarded"], ["product_actions", "Product actions"]];
  return /* @__PURE__ */ _.jsx("div", { className: "owal-metrics", children: e.map(([r, n]) => {
    const s = t.kpis[r], i = Qy(s);
    return /* @__PURE__ */ _.jsxs("article", { className: "owal-card", children: [
      /* @__PURE__ */ _.jsx("small", { children: n }),
      /* @__PURE__ */ _.jsxs("div", { children: [
        /* @__PURE__ */ _.jsx("strong", { children: Xn(s.current) }),
        /* @__PURE__ */ _.jsx("mark", { className: i.startsWith("+") ? "up" : "", children: i })
      ] }),
      /* @__PURE__ */ _.jsxs("p", { children: [
        "Previous: ",
        Xn(s.previous)
      ] })
    ] }, r);
  }) });
}
function Xy({ rows: t = [] }) {
  const e = t.map((s) => Number(s.visitors || 0)), r = Math.max(1, ...e), n = e.map((s, i) => `${i / Math.max(1, e.length - 1) * 100},${38 - s / r * 32}`).join(" ");
  return /* @__PURE__ */ _.jsxs("section", { className: "owal-card owal-trend", children: [
    /* @__PURE__ */ _.jsxs("div", { children: [
      /* @__PURE__ */ _.jsx("h3", { children: "Audience trend" }),
      /* @__PURE__ */ _.jsx("p", { children: "Unique visitors per day" })
    ] }),
    n ? /* @__PURE__ */ _.jsx("svg", { viewBox: "0 0 100 42", preserveAspectRatio: "none", "aria-label": "Daily visitors trend", children: /* @__PURE__ */ _.jsx("polyline", { points: n }) }) : /* @__PURE__ */ _.jsx("p", { className: "owal-empty", children: "Collection is ready; history begins with this release." })
  ] });
}
function Zy({ data: t }) {
  const e = [
    ["OneEvent", [["Events", t.oneevent.events], ["Applications", t.oneevent.applications], ["Registrations", t.oneevent.registrations], ["Pending approvals", t.oneevent.pending_approvals, !0], ["Payment attention", t.oneevent.payment_attention, !0]]],
    ["OneHome", [["Rental listings", t.onehome.rental_listings], ["Rental requests", t.onehome.rental_requests], ["Active contracts", t.onehome.active_contracts], ["Sale listings", t.onehome.sale_listings], ["Sale deals", t.onehome.sale_deals]]],
    ["Operations health", [["Open alerts", t.health.open_alerts, !0], ["Onboarding incomplete", t.health.onboarding_incomplete, !0], ["Email failures", t.health.email_failures, !0]]]
  ];
  return /* @__PURE__ */ _.jsx("div", { className: "owal-ops", children: e.map(([r, n]) => /* @__PURE__ */ _.jsxs("section", { className: "owal-card", children: [
    /* @__PURE__ */ _.jsx("h3", { children: r }),
    /* @__PURE__ */ _.jsx("dl", { children: n.map(([s, i, o]) => /* @__PURE__ */ _.jsxs("div", { children: [
      /* @__PURE__ */ _.jsx("dt", { children: s }),
      /* @__PURE__ */ _.jsx("dd", { className: o && i ? "attention" : "", children: Xn(i) })
    ] }, s)) })
  ] }, r)) });
}
function ew() {
  const [t, e] = Z.useState(30), [r, n] = Z.useState(""), [s, i] = Z.useState("human"), [o, a] = Z.useState(null), [l, u] = Z.useState("");
  return Z.useEffect(() => {
    let c = !0;
    return a(null), Ti.rpc("admin_analytics_overview", { p_days: t, p_product: r || null, p_traffic: s }).then(({ data: h, error: d }) => {
      c && (d ? u(d.message) : (u(""), a(h)));
    }), () => {
      c = !1;
    };
  }, [t, r, s]), /* @__PURE__ */ _.jsxs("div", { className: "owal-stack", children: [
    /* @__PURE__ */ _.jsxs("div", { className: "owal-card owal-filters", children: [
      /* @__PURE__ */ _.jsxs("select", { value: t, onChange: (c) => e(Number(c.target.value)), children: [
        /* @__PURE__ */ _.jsx("option", { value: "7", children: "Last 7 days" }),
        /* @__PURE__ */ _.jsx("option", { value: "30", children: "Last 30 days" }),
        /* @__PURE__ */ _.jsx("option", { value: "90", children: "Last 90 days" })
      ] }),
      /* @__PURE__ */ _.jsxs("select", { value: r, onChange: (c) => n(c.target.value), children: [
        /* @__PURE__ */ _.jsx("option", { value: "", children: "All products" }),
        /* @__PURE__ */ _.jsx("option", { value: "onejob", children: "OneJob" }),
        /* @__PURE__ */ _.jsx("option", { value: "oneevent", children: "OneEvent" }),
        /* @__PURE__ */ _.jsx("option", { value: "onehome", children: "OneHome" }),
        /* @__PURE__ */ _.jsx("option", { value: "onesocial", children: "OneSocial" }),
        /* @__PURE__ */ _.jsx("option", { value: "onescore", children: "OneScore" })
      ] }),
      /* @__PURE__ */ _.jsxs("select", { value: s, onChange: (c) => i(c.target.value), children: [
        /* @__PURE__ */ _.jsx("option", { value: "human", children: "Human traffic" }),
        /* @__PURE__ */ _.jsx("option", { value: "bot", children: "Bot traffic" }),
        /* @__PURE__ */ _.jsx("option", { value: "all", children: "All traffic" })
      ] })
    ] }),
    l && /* @__PURE__ */ _.jsxs("div", { className: "owal-card owal-warn", children: [
      /* @__PURE__ */ _.jsx("b", { children: "Dashboard data is unavailable." }),
      /* @__PURE__ */ _.jsx("p", { children: l })
    ] }),
    !o && !l && /* @__PURE__ */ _.jsx("div", { className: "owal-card owal-loading", children: "Loading live dashboard…" }),
    o && /* @__PURE__ */ _.jsxs(_.Fragment, { children: [
      /* @__PURE__ */ _.jsx(Yy, { overview: o }),
      /* @__PURE__ */ _.jsx(Xy, { rows: o.daily }),
      /* @__PURE__ */ _.jsxs("div", { className: "owal-grid", children: [
        /* @__PURE__ */ _.jsx(Kt, { title: "Traffic sources", rows: o.referrers }),
        /* @__PURE__ */ _.jsx(Kt, { title: "Devices", rows: o.devices }),
        /* @__PURE__ */ _.jsx(Kt, { title: "Products connected", rows: o.products }),
        /* @__PURE__ */ _.jsx(Kt, { title: "Countries", rows: o.countries }),
        /* @__PURE__ */ _.jsx(Kt, { title: "Cities", rows: o.cities }),
        /* @__PURE__ */ _.jsx(Kt, { title: "Landing pages", rows: o.landing_pages }),
        s !== "human" && /* @__PURE__ */ _.jsx(Kt, { title: "Search & discovery crawlers", rows: o.bots })
      ] }),
      /* @__PURE__ */ _.jsx(Zy, { data: o.operations })
    ] })
  ] });
}
function Sc({ compact: t = !1, viewAll: e }) {
  const [r, n] = Z.useState(""), [s, i] = Z.useState(""), [o, a] = Z.useState(""), [l, u] = Z.useState(""), [c, h] = Z.useState(null), [d, g] = Z.useState(null), [v, y] = Z.useState("");
  Z.useEffect(() => {
    const f = setTimeout(() => i(r.trim()), 250);
    return () => clearTimeout(f);
  }, [r]), Z.useEffect(() => {
    let f = !0;
    return Ti.rpc("admin_user_directory", { p_search: s || null, p_product: o || null, p_status: l || null, p_limit: t ? 6 : 100, p_offset: 0 }).then(({ data: p, error: m }) => {
      f && (m ? y(m.message) : (y(""), h(p)));
    }), () => {
      f = !1;
    };
  }, [s, o, l, t]);
  const k = Z.useMemo(() => [["", "All products"], ["onejob", "OneJob"], ["oneevent", "OneEvent"], ["onehome", "OneHome"], ["onesocial", "OneSocial"], ["onescore", "OneScore"]], []);
  return /* @__PURE__ */ _.jsxs("section", { className: "owal-stack", children: [
    t ? /* @__PURE__ */ _.jsxs("div", { className: "owal-section-title", children: [
      /* @__PURE__ */ _.jsxs("div", { children: [
        /* @__PURE__ */ _.jsx("h2", { children: "Members" }),
        /* @__PURE__ */ _.jsx("p", { children: "One ID, claim state and connected products" })
      ] }),
      /* @__PURE__ */ _.jsx("button", { onClick: e, children: "View all" })
    ] }) : /* @__PURE__ */ _.jsxs("div", { className: "owal-card owal-people-filters", children: [
      /* @__PURE__ */ _.jsx("input", { value: r, onChange: (f) => n(f.target.value), placeholder: "Name, email or phone" }),
      /* @__PURE__ */ _.jsx("select", { value: o, onChange: (f) => a(f.target.value), children: k.map(([f, p]) => /* @__PURE__ */ _.jsx("option", { value: f, children: p }, f)) }),
      /* @__PURE__ */ _.jsxs("select", { value: l, onChange: (f) => u(f.target.value), children: [
        /* @__PURE__ */ _.jsx("option", { value: "", children: "All account states" }),
        /* @__PURE__ */ _.jsx("option", { value: "claimed", children: "Claimed" }),
        /* @__PURE__ */ _.jsx("option", { value: "invited", children: "Invited" }),
        /* @__PURE__ */ _.jsx("option", { value: "migrated", children: "Migrated" }),
        /* @__PURE__ */ _.jsx("option", { value: "onboarding", children: "Onboarding incomplete" })
      ] })
    ] }),
    /* @__PURE__ */ _.jsxs("div", { className: "owal-meta", children: [
      /* @__PURE__ */ _.jsx("span", { children: c ? `${Xn(c.total)} people` : "Loading people…" }),
      /* @__PURE__ */ _.jsx("span", { children: "PII access audited" })
    ] }),
    v && /* @__PURE__ */ _.jsx("div", { className: "owal-card owal-warn", children: v }),
    /* @__PURE__ */ _.jsx("div", { className: "owal-people", children: c == null ? void 0 : c.rows.map((f) => {
      const p = d === f.user_id;
      return /* @__PURE__ */ _.jsxs("article", { className: "owal-card", children: [
        /* @__PURE__ */ _.jsxs("button", { className: "owal-person", onClick: () => g(p ? null : f.user_id), children: [
          /* @__PURE__ */ _.jsx("span", { className: "owal-avatar", children: (f.full_name || "?").slice(0, 1).toUpperCase() }),
          /* @__PURE__ */ _.jsxs("span", { children: [
            /* @__PURE__ */ _.jsx("b", { children: f.full_name || "No name" }),
            /* @__PURE__ */ _.jsx("small", { children: f.email || "—" })
          ] }),
          /* @__PURE__ */ _.jsx("mark", { children: f.membership }),
          /* @__PURE__ */ _.jsxs("strong", { children: [
            f.score == null ? "—" : Math.round(f.score),
            /* @__PURE__ */ _.jsx("small", { children: "score" })
          ] })
        ] }),
        p && /* @__PURE__ */ _.jsxs("div", { className: "owal-detail", children: [
          /* @__PURE__ */ _.jsx("dl", { children: [["Phone", f.phone || "—"], ["Profession", f.profession || "—"], ["Location", f.location || "—"], ["Last sign-in", kc(f.last_sign_in_at)], ["Joined", kc(f.created_at)], ["Profile", f.is_public ? "Public" : "Private"]].map(([m, w]) => /* @__PURE__ */ _.jsxs("div", { children: [
            /* @__PURE__ */ _.jsx("dt", { children: m }),
            /* @__PURE__ */ _.jsx("dd", { children: w })
          ] }, m)) }),
          /* @__PURE__ */ _.jsx("div", { className: "owal-products", children: (f.products || []).filter((m) => m.status === "active").map((m) => /* @__PURE__ */ _.jsxs("span", { children: [
            m.product.replace(/^one/, "One"),
            m.plan ? ` · ${m.plan}` : ""
          ] }, m.product)) }),
          f.onboarding_incomplete && /* @__PURE__ */ _.jsx("p", { className: "owal-note", children: "Onboarding is incomplete" })
        ] })
      ] }, f.user_id);
    }) })
  ] });
}
function tw() {
  const [t, e] = Z.useState("overview");
  return /* @__PURE__ */ _.jsxs("div", { className: "ow-admin-live", children: [
    /* @__PURE__ */ _.jsxs("header", { children: [
      /* @__PURE__ */ _.jsx("h1", { children: /* @__PURE__ */ _.jsx("span", { children: "Admin Dashboard" }) }),
      /* @__PURE__ */ _.jsx("p", { children: "Growth · People · Money · Ops" })
    ] }),
    /* @__PURE__ */ _.jsx("nav", { "aria-label": "Admin sections", children: ["Overview", "Growth", "People", "Money", "Ops"].map((r) => {
      const n = r === "Overview" || r === "People", s = t === r.toLowerCase();
      return /* @__PURE__ */ _.jsx("button", { disabled: !n, "aria-current": s ? "page" : void 0, onClick: () => n && e(r.toLowerCase()), children: r }, r);
    }) }),
    t === "overview" ? /* @__PURE__ */ _.jsxs(_.Fragment, { children: [
      /* @__PURE__ */ _.jsx(Sc, { compact: !0, viewAll: () => e("people") }),
      /* @__PURE__ */ _.jsx(ew, {})
    ] }) : /* @__PURE__ */ _.jsx(Sc, {}),
    /* @__PURE__ */ _.jsx("footer", { children: "Read-only · Server-authorized · Sensitive views are audited" })
  ] });
}
async function rw() {
  if (window.location.pathname.replace(/\/$/, "") !== "/admin") return;
  const { data: { session: t } } = await Ti.auth.getSession();
  if (!t) return;
  const { data: e, error: r } = await Ti.rpc("is_platform_admin");
  if (r || e !== !0) return;
  let n = null;
  for (let s = 0; s < 80 && !n; s++)
    n = document.querySelector("#root main"), n || await new Promise((i) => setTimeout(i, 50));
  n && (n.replaceChildren(), n.classList.add("owal-host"), Ld(n).render(/* @__PURE__ */ _.jsx(tw, {})));
}
rw();
