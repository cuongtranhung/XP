import {
  o,
  r
} from "./chunk-SR3H62UN.js";
import {
  appendErrors
} from "./chunk-3FOT63JD.js";
import "./chunk-BQK4GRLU.js";
import "./chunk-WOOG5QLI.js";

// node_modules/@hookform/resolvers/yup/dist/yup.mjs
function o2(o3, n, a) {
  return void 0 === n && (n = {}), void 0 === a && (a = {}), function(s, i, c) {
    try {
      return Promise.resolve(function(t, r2) {
        try {
          var u = (n.context && true && console.warn("You should not used the yup options context. Please, use the 'useForm' context object instead"), Promise.resolve(o3["sync" === a.mode ? "validateSync" : "validate"](s, Object.assign({ abortEarly: false }, n, { context: i }))).then(function(t2) {
            return c.shouldUseNativeValidation && o({}, c), { values: a.raw ? s : t2, errors: {} };
          }));
        } catch (e) {
          return r2(e);
        }
        return u && u.then ? u.then(void 0, r2) : u;
      }(0, function(e) {
        if (!e.inner) throw e;
        return { values: {}, errors: r((o4 = e, n2 = !c.shouldUseNativeValidation && "all" === c.criteriaMode, (o4.inner || []).reduce(function(e2, t) {
          if (e2[t.path] || (e2[t.path] = { message: t.message, type: t.type }), n2) {
            var o5 = e2[t.path].types, a2 = o5 && o5[t.type];
            e2[t.path] = appendErrors(t.path, n2, e2, t.type, a2 ? [].concat(a2, t.message) : t.message);
          }
          return e2;
        }, {})), c) };
        var o4, n2;
      }));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}
export {
  o2 as yupResolver
};
//# sourceMappingURL=@hookform_resolvers_yup.js.map
