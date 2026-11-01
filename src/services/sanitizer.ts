/**
 * HTML Sanitization Module for Gemini Notes
 * Protects against Stored, Reflected, and DOM-based Cross-Site Scripting (XSS).
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr',
  'span', 'div', 'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'input',
]);

const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'style', 'link', 'meta',
  'base', 'form', 'button', 'select', 'textarea', 'svg', 'math',
  'applet', 'portal', 'frame', 'frameset',
]);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  const trimmed = urlStr.trim().toLowerCase();
  if (trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(urlStr, window.location.href);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeImageUrl(srcStr: string): boolean {
  if (!srcStr) return false;
  const trimmed = srcStr.trim().toLowerCase();
  if (
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/jpeg;base64,') ||
    trimmed.startsWith('data:image/jpg;base64,') ||
    trimmed.startsWith('data:image/gif;base64,') ||
    trimmed.startsWith('data:image/webp;base64,')
  ) {
    return true;
  }
  return isSafeUrl(srcStr);
}

/**
 * Sanitizes an HTML string using DOMParser in a detached DOM tree.
 * Strips dangerous tags, removes all inline event handlers (on*),
 * sanitizes URL schemes, and secures external anchors.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  if (typeof window === 'undefined' || !window.DOMParser) {
    return dirtyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(dirtyHtml, 'text/html');

  function cleanNode(node: Node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    // Remove explicitly dangerous elements and their subtree
    if (DANGEROUS_TAGS.has(tagName)) {
      element.parentNode?.removeChild(element);
      return;
    }

    // If tag is not explicitly allowed, unwrap children to preserve safe text
    if (!ALLOWED_TAGS.has(tagName)) {
      const parent = element.parentNode;
      if (parent) {
        while (element.firstChild) {
          cleanNode(element.firstChild);
          if (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
        }
        parent.removeChild(element);
      }
      return;
    }

    // Clean attributes
    const attrNames = Array.from(element.getAttributeNames());
    for (const name of attrNames) {
      const lowerName = name.toLowerCase();

      // Block all event handlers (onclick, onerror, onload, onmouseover, etc.)
      if (lowerName.startsWith('on')) {
        element.removeAttribute(name);
        continue;
      }

      if (tagName === 'a') {
        if (lowerName === 'href') {
          const hrefVal = element.getAttribute(name) || '';
          if (!isSafeUrl(hrefVal)) {
            element.removeAttribute(name);
          }
        } else if (lowerName === 'target' || lowerName === 'rel') {
          // Handled below
        } else if (lowerName !== 'class' && lowerName !== 'title') {
          element.removeAttribute(name);
        }
      } else if (tagName === 'img') {
        if (lowerName === 'src') {
          const srcVal = element.getAttribute(name) || '';
          if (!isSafeImageUrl(srcVal)) {
            element.removeAttribute(name);
          }
        } else if (
          lowerName !== 'alt' &&
          lowerName !== 'title' &&
          lowerName !== 'class' &&
          lowerName !== 'width' &&
          lowerName !== 'height'
        ) {
          element.removeAttribute(name);
        }
      } else if (tagName === 'input') {
        const type = element.getAttribute('type')?.toLowerCase();
        if (type !== 'checkbox') {
          element.parentNode?.removeChild(element);
          return;
        }
        if (
          lowerName !== 'type' &&
          lowerName !== 'checked' &&
          lowerName !== 'disabled' &&
          lowerName !== 'class'
        ) {
          element.removeAttribute(name);
        }
      } else if (lowerName === 'style') {
        const styleVal = element.getAttribute(name) || '';
        if (/javascript:|expression|behavior|url\(/i.test(styleVal)) {
          element.removeAttribute(name);
        }
      } else if (lowerName !== 'class' && lowerName !== 'id') {
        element.removeAttribute(name);
      }
    }

    // Enforce safe link behavior
    if (tagName === 'a' && element.hasAttribute('href')) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }

    // Clean all child nodes
    const children = Array.from(element.childNodes);
    for (const child of children) {
      cleanNode(child);
    }
  }

  const rootNodes = Array.from(doc.body.childNodes);
  for (const node of rootNodes) {
    cleanNode(node);
  }

  return doc.body.innerHTML;
}
