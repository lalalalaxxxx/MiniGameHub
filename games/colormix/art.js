/* Original SVG cut-paper props. All fills come from the same paint model as the bowl. */
window.ColorArt = (() => {
  const line = '#68594e';
  function friend(id, color) {
    const eyes = '<circle cx="84" cy="101" r="4"/><circle cx="116" cy="101" r="4"/><path d="M94 112 Q100 119 106 112" fill="none" stroke="' + line + '" stroke-width="3" stroke-linecap="round"/>';
    const blush = '<ellipse cx="72" cy="111" rx="9" ry="5" fill="#f6b3ad"/><ellipse cx="128" cy="111" rx="9" ry="5" fill="#f6b3ad"/>';
    const body = `<ellipse cx="100" cy="114" rx="55" ry="47" fill="${color}"/>`;
    let shape;
    if (id === 'green') shape = `<ellipse cx="63" cy="156" rx="24" ry="11" fill="${color}"/><ellipse cx="137" cy="156" rx="24" ry="11" fill="${color}"/>${body}<circle cx="72" cy="73" r="22" fill="${color}"/><circle cx="128" cy="73" r="22" fill="${color}"/><circle cx="72" cy="73" r="13" fill="#fffaf0"/><circle cx="128" cy="73" r="13" fill="#fffaf0"/><circle cx="75" cy="75" r="5"/><circle cx="125" cy="75" r="5"/><path d="M76 112 Q100 136 124 112" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"/>${blush}`;
    else if (id === 'blue' || id === 'light-blue') shape = `<path d="M150 115 Q172 92 185 85 Q185 123 156 135 Q128 172 73 151 Q36 137 44 104 Q55 69 100 77 Q137 75 150 115Z" fill="${color}"/><path d="M70 134 Q105 154 139 133 Q119 169 70 145Z" fill="#fff9eb"/><path d="M95 68 Q76 41 65 53 M95 68 Q104 32 116 47" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><path d="M107 137 Q124 151 129 128" fill="${color}"/>${eyes}${blush}`;
    else if (id === 'white') shape = `<path d="M40 143 C9 128 26 91 52 97 C41 49 101 33 116 75 C147 53 179 78 165 104 C200 112 182 151 155 149Z" fill="${color}" stroke="#e5ddcd" stroke-width="2"/>${eyes}${blush}`;
    else if (id === 'yellow') shape = `<ellipse cx="74" cy="70" rx="21" ry="31" fill="#fffaf0" stroke="#e6dfce" stroke-width="2" transform="rotate(-30 74 70)"/><ellipse cx="126" cy="70" rx="21" ry="31" fill="#fffaf0" stroke="#e6dfce" stroke-width="2" transform="rotate(30 126 70)"/>${body}<path d="M64 141 Q100 161 136 141 M56 125 Q100 147 144 125" fill="none" stroke="#a2884f" stroke-width="9"/><path d="M84 78 L76 58 M116 78 L124 58" stroke="${line}" stroke-width="3" stroke-linecap="round"/>${eyes}`;
    else if (id === 'light-yellow') shape = `${body}<path d="M85 72 Q76 49 90 53 Q99 50 99 70 Q107 45 117 55 Q122 65 109 75" fill="${color}"/><path d="M94 110 L100 119 L107 110Z" fill="#df9f52"/><circle cx="83" cy="101" r="4"/><circle cx="117" cy="101" r="4"/><path d="M79 157 V170 M121 157 V170" stroke="#df9f52" stroke-width="6" stroke-linecap="round"/>`;
    else if (id === 'light-green') shape = `<ellipse cx="67" cy="156" rx="20" ry="9" fill="${color}"/><ellipse cx="133" cy="156" rx="20" ry="9" fill="${color}"/><ellipse cx="100" cy="131" rx="57" ry="35" fill="${color}" stroke="#81ae83" stroke-width="3"/><path d="M100 103 L80 127 L92 154 M100 103 L124 127 L110 154 M80 127 H124" fill="none" stroke="#81ae83" stroke-width="3"/><circle cx="100" cy="86" r="28" fill="${color}"/><circle cx="89" cy="82" r="4"/><circle cx="111" cy="82" r="4"/><path d="M94 93 Q100 99 106 93" fill="none" stroke="${line}" stroke-width="2"/>`;
    else if (id === 'light-brown') shape = `<path d="M37 137 L25 118 L42 106 L30 85 L53 82 L50 59 L74 65 L84 43 L103 59 L123 43 L134 64 L155 58 L153 83 L176 87 L163 107 L180 128 L158 143Z" fill="${color}"/><ellipse cx="101" cy="119" rx="43" ry="33" fill="#fff5e4"/>${eyes}${blush}`;
    else if (id === 'light-purple') shape = `<path d="M54 108 Q9 61 22 136 Q31 158 56 137 M146 108 Q191 61 178 136 Q169 158 144 137" fill="#fffaf0" stroke="#d2bfdf" stroke-width="3"/>${body}<path d="M67 78 L100 29 L133 78Z" fill="${color}"/><path d="M100 37 l3 8 9 1-7 5 2 8-7-5-7 5 2-8-7-5 9-1Z" fill="#fff4c5"/>${eyes}${blush}`;
    else {
      let ears;
      if (id === 'light-red') ears = `<ellipse cx="77" cy="59" rx="15" ry="41" fill="${color}" transform="rotate(-12 77 59)"/><ellipse cx="123" cy="59" rx="15" ry="41" fill="${color}" transform="rotate(12 123 59)"/>`;
      else if (id === 'brown') ears = `<circle cx="61" cy="70" r="22" fill="${color}"/><circle cx="139" cy="70" r="22" fill="${color}"/><circle cx="61" cy="70" r="11" fill="#f2d1ac"/><circle cx="139" cy="70" r="11" fill="#f2d1ac"/>`;
      else ears = `<path d="M52 93 L42 37 Q74 42 86 81 M114 81 Q140 38 158 37 L148 93" fill="${color}"/>`;
      shape = ears + body;
      if (id === 'red') shape += '<path d="M50 96 Q75 94 100 120 Q124 93 150 96 Q146 149 100 150 Q54 149 50 96" fill="#fff6e7"/>';
      if (id === 'light-orange') shape = `<path d="M51 137 C-5 91 36 31 57 49 C82 72 37 75 60 111" fill="none" stroke="${color}" stroke-width="24" stroke-linecap="round"/>` + shape;
      shape += eyes + blush;
      if (id === 'orange') shape += `<path d="M67 113 L42 107 M67 120 L42 123 M133 113 L158 107 M133 120 L158 123" stroke="${line}" stroke-width="2" stroke-linecap="round"/>`;
      if (id === 'purple') shape += '<path d="M95 120 L99 128 L102 120" fill="#fffaf0"/>';
    }
    return `<ellipse cx="100" cy="174" rx="61" ry="8" fill="#504b46" opacity=".08"/>${shape}`;
  }
  function prop(kind, color = '#d8d9d1') {
    const face = '<circle cx="91" cy="92" r="3"/><circle cx="109" cy="92" r="3"/><path d="M95 102 Q100 107 105 102" fill="none" stroke="' + line + '" stroke-width="2.5" stroke-linecap="round"/>';
    let content;
    if (kind === 'balloon') content = `<path d="M100 123 Q128 147 100 167 Q86 180 107 192" fill="none" stroke="#9e9081" stroke-width="2"/><ellipse cx="100" cy="75" rx="52" ry="60" fill="${color}"/><path d="M96 130 l-7 11 h22 l-7-11" fill="${color}"/><ellipse cx="78" cy="49" rx="10" ry="17" fill="white" opacity=".45"/>${face}`;
    else if (kind === 'car') content = `<path d="M33 113 L50 67 Q53 57 71 57 H125 Q139 57 145 72 L160 110 Q179 111 180 130 V148 H22 V125 Q22 113 33 113" fill="${color}"/><path d="M61 70 H92 V108 H47 Z M104 70 H125 L145 108 H104Z" fill="#fffcf5" opacity=".8"/><rect x="30" y="123" width="18" height="10" rx="5" fill="#fff0bc"/><circle cx="57" cy="148" r="20" fill="${line}"/><circle cx="146" cy="148" r="20" fill="${line}"/><circle cx="57" cy="148" r="10" fill="#fffaf1"/><circle cx="146" cy="148" r="10" fill="#fffaf1"/>`;
    else if (kind === 'flower') content = `<path d="M100 91 V182 M100 155 Q55 155 63 131 Q92 127 100 155 M100 166 Q149 161 137 137 Q108 136 100 166" fill="#81ae83" stroke="#81ae83" stroke-width="7" stroke-linejoin="round"/>${[0,60,120,180,240,300].map(a => `<ellipse cx="100" cy="48" rx="23" ry="31" fill="${color}" transform="rotate(${a} 100 85)"/>`).join('')}<circle cx="100" cy="85" r="27" fill="#fff0be"/>${face}`;
    else if (kind === 'tree') content = `<path d="M89 91 H112 V185 H89Z" fill="#ba926c"/><circle cx="69" cy="88" r="38" fill="${color}"/><circle cx="130" cy="83" r="38" fill="${color}"/><circle cx="100" cy="51" r="39" fill="${color}"/><circle cx="101" cy="102" r="36" fill="${color}"/>${face}`;
    else if (kind === 'house') content = `<rect x="45" y="78" width="113" height="105" rx="10" fill="${color}"/><path d="M28 85 L101 22 L175 85Z" fill="${color}" stroke="#fffaf0" stroke-width="7" stroke-linejoin="round"/><rect x="88" y="125" width="28" height="58" rx="13" fill="#fff9eb"/><rect x="59" y="100" width="22" height="22" rx="5" fill="#fff9eb"/><rect x="125" y="100" width="22" height="22" rx="5" fill="#fff9eb"/>`;
    else if (kind === 'windmill') content = `<path d="M79 86 H119 L139 188 H59Z" fill="#eddac0"/><rect x="88" y="150" width="25" height="38" rx="12" fill="#b38d68"/><g class="blades" style="transform-origin:100px 84px">${[0,90,180,270].map(a => `<path d="M100 84 L93 15 L128 15 L116 72Z" fill="${color}" stroke="#fff9eb" stroke-width="3" transform="rotate(${a} 100 84)"/>`).join('')}<circle cx="100" cy="84" r="11" fill="#fff9eb"/></g>`;
    else content = friend(kind.replace('friend-', ''), color);
    return `<svg viewBox="0 0 200 200" aria-hidden="true" fill="${line}">${content}</svg>`;
  }
  function showcase(kind, color, won) {
    return `<div class="showcase ${won ? 'celebrate' : ''}"><span class="tiny-star star-one">✦</span><span class="tiny-star star-two">✧</span><div class="paper-prop">${prop(kind, color)}</div><div class="stage-shadow"></div><span class="stage-flower">✿</span></div>`;
  }
  return { prop, showcase };
})();
