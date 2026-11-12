/* Carga js/hero-glass.js (lente WebGL del hero) solo con mouse fino y sin reduced-motion, después de window load.
   En móvil / táctil no se baja: el logo queda como imagen. Es un archivo externo (no inline) para no depender
   del hash del CSP: usa el mismo ?v= con el que se cargó este script. */
(function () {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var me = document.currentScript, q = me && me.src.indexOf("?") > -1 ? me.src.slice(me.src.indexOf("?")) : "";
  function cargar() { var s = document.createElement("script"); s.src = "js/hero-glass.js" + q; document.body.appendChild(s); }
  if (document.readyState === "complete") cargar(); else addEventListener("load", cargar);
})();
