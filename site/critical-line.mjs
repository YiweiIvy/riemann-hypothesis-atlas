// The vertical position of each zero encodes its imaginary part, plotted on one scale.
export function criticalLine() {
  const zeros = [14.134725, 21.02204, 25.010858],
    bottom = 107,
    scale = 3.1;
  return (
    '<figure class="critical-line"><figcaption><b>Critical line</b><i>Re(ρ) = ½</i></figcaption><svg viewBox="0 0 238 132" role="img" aria-label="The first three positive imaginary zeta zeros, at real part one half"><rect x="56" y="12" width="131" height="95" fill="#7381f4" opacity=".055"/><g stroke="#37415d" stroke-dasharray="2 4"><path d="M56 13v94m131-94v94M29 76h180M29 45h180M29 14h180"/></g><path d="M29 107h180" stroke="#52617a"/><path d="M121.5 10v97" stroke="#b6a4ff" stroke-width="1.4"/><g fill="#8e9bb8" font-family="monospace" font-size="9"><text x="8" y="17">30i</text><text x="8" y="48">20i</text><text x="8" y="79">10i</text><text x="54" y="122">0</text><text x="118" y="122">½</text><text x="185" y="122">1</text></g>' +
    zeros
      .map(
        (t) =>
          '<circle cx="121.5" cy="' +
          (bottom - t * scale) +
          '" r="7" fill="#b09aff" opacity=".13"/><circle cx="121.5" cy="' +
          (bottom - t * scale) +
          '" r="2.9" fill="#e3d9ff"/><text x="135" y="' +
          (bottom - t * scale + 3) +
          '" fill="#c3cbe5" font-family="monospace" font-size="9">' +
          t.toFixed(3) +
          "</text>",
      )
      .join("") +
    "</svg></figure>"
  );
}
