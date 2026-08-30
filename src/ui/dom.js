/**
 * A ~60 line DOM builder.
 *
 * The v1 portal assembled every card with `innerHTML` and template literals,
 * which meant a saved prompt or a custom engine title containing markup was
 * injected straight into the page. Here text is always set through
 * `textContent`, so the whole UI is safe by construction rather than by
 * remembering to escape at each call site.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Apply one prop to an element. Exported for tests. */
export function applyProp(element, key, value) {
  if (value === null || value === undefined || value === false) return;

  if (key === 'class' || key === 'className') {
    element.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value));
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign(element.style, value);
  } else if (key === 'dataset' && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) {
      if (item !== null && item !== undefined && item !== false) element.dataset[name] = String(item);
    }
  } else if (key === 'ref' && typeof value === 'function') {
    value(element);
  } else if (key.startsWith('on') && typeof value === 'function') {
    element.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (key === 'html') {
    // Reserved for trusted module constants only (the icon sprite).
    element.innerHTML = value;
  } else if (value === true) {
    element.setAttribute(key, '');
  } else {
    element.setAttribute(key, String(value));
  }
}

/** Append any child shape: node, string, number, array, or nullish (skipped). */
export function append(parent, child) {
  if (child === null || child === undefined || child === false || child === true) return;
  if (Array.isArray(child)) {
    for (const item of child) append(parent, item);
  } else if (child instanceof Node) {
    parent.append(child);
  } else {
    parent.append(document.createTextNode(String(child)));
  }
}

/**
 * Create an element.
 * @example h('button', { class: 'btn', onClick: run }, 'שמור')
 */
export function h(tag, props = null, ...children) {
  const element = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) applyProp(element, key, value);
  }
  append(element, children);
  return element;
}

/** Same, for SVG elements, which need the namespace. */
export function svg(tag, props = null, ...children) {
  const element = document.createElementNS(SVG_NS, tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value !== null && value !== undefined && value !== false) element.setAttribute(key, String(value));
    }
  }
  append(element, children);
  return element;
}

/** A document fragment holding several children. */
export function fragment(...children) {
  const frag = document.createDocumentFragment();
  append(frag, children);
  return frag;
}

/** Replace everything inside a node. */
export function replace(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
  return parent;
}

/** Render highlighted search segments as text plus <mark> runs. */
export function highlighted(segments) {
  return fragment(
    ...segments.map((segment) => (segment.hit ? h('mark', { class: 'mark' }, segment.text) : segment.text)),
  );
}

/** Keep focus inside a container while it is open (modals, palette). */
export function trapFocus(container, event) {
  if (event.key !== 'Tab') return;
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
