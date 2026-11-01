const { app, BrowserWindow } = require('electron');
const assert = require('assert');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  await win.loadURL('about:blank');

  const testResults = await win.webContents.executeJavaScript(`
    (() => {
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

      function isSafeUrl(urlStr) {
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

      function isSafeImageUrl(srcStr) {
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

      function sanitizeHtml(dirtyHtml) {
        if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirtyHtml, 'text/html');

        function cleanNode(node) {
          if (node.nodeType === Node.COMMENT_NODE) {
            node.parentNode?.removeChild(node);
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          const element = node;
          const tagName = element.tagName.toLowerCase();

          if (DANGEROUS_TAGS.has(tagName)) {
            element.parentNode?.removeChild(element);
            return;
          }

          if (!ALLOWED_TAGS.has(tagName)) {
            const parent = element.parentNode;
            if (parent) {
              while (element.firstChild) {
                cleanNode(element.firstChild);
                if (element.firstChild) parent.insertBefore(element.firstChild, element);
              }
              parent.removeChild(element);
            }
            return;
          }

          const attrNames = Array.from(element.getAttributeNames());
          for (const name of attrNames) {
            const lowerName = name.toLowerCase();
            if (lowerName.startsWith('on')) {
              element.removeAttribute(name);
              continue;
            }
            if (tagName === 'a') {
              if (lowerName === 'href') {
                if (!isSafeUrl(element.getAttribute(name) || '')) {
                  element.removeAttribute(name);
                }
              } else if (lowerName !== 'target' && lowerName !== 'rel' && lowerName !== 'class' && lowerName !== 'title') {
                element.removeAttribute(name);
              }
            } else if (tagName === 'img') {
              if (lowerName === 'src') {
                if (!isSafeImageUrl(element.getAttribute(name) || '')) {
                  element.removeAttribute(name);
                }
              } else if (!['alt', 'title', 'class', 'width', 'height'].includes(lowerName)) {
                element.removeAttribute(name);
              }
            } else if (tagName === 'input') {
              if (element.getAttribute('type')?.toLowerCase() !== 'checkbox') {
                element.parentNode?.removeChild(element);
                return;
              }
              if (!['type', 'checked', 'disabled', 'class'].includes(lowerName)) {
                element.removeAttribute(name);
              }
            } else if (lowerName === 'style') {
              const styleVal = element.getAttribute(name) || '';
              if (/javascript:|expression|behavior|url\\(/i.test(styleVal)) {
                element.removeAttribute(name);
              }
            } else if (lowerName !== 'class' && lowerName !== 'id') {
              element.removeAttribute(name);
            }
          }

          if (tagName === 'a' && element.hasAttribute('href')) {
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noopener noreferrer');
          }

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

      // Execute Test Vectors
      const results = {};

      // 1. Script injection
      const t1 = sanitizeHtml('<h1>Title</h1><script>alert("xss")</script><p>Text</p>');
      results.t1 = !t1.includes('script') && !t1.includes('alert') && t1.includes('<h1>Title</h1>');

      // 2. Onerror handler
      const t2 = sanitizeHtml('<img src="invalid.jpg" onerror="alert(document.cookie)" />');
      results.t2 = !t2.includes('onerror') && !t2.includes('cookie');

      // 3. Javascript: protocol link
      const t3 = sanitizeHtml('<a href="javascript:alert(1)">Click Me</a>');
      results.t3 = !t3.includes('javascript') && !t3.includes('alert') && t3.includes('Click Me');

      // 4. Safe external link
      const t4 = sanitizeHtml('<a href="https://example.com">Legit Link</a>');
      results.t4 = t4.includes('target="_blank"') && t4.includes('rel="noopener noreferrer"');

      // 5. Iframe injection
      const t5 = sanitizeHtml('<iframe src="https://evil.com"></iframe>');
      results.t5 = !t5.includes('iframe');

      // 6. SVG onload injection
      const t6 = sanitizeHtml('<svg onload="alert(1)"><circle r="10" /></svg>');
      results.t6 = !t6.includes('svg') && !t6.includes('onload');

      // 7. Legitimate note content with task checkbox and rich text
      const t7 = sanitizeHtml('<h2>Note</h2><ul><li><input type="checkbox" checked /> Task 1</li></ul>');
      results.t7 = t7.includes('<h2>Note</h2>') && t7.includes('checkbox') && t7.includes('checked');

      return results;
    })()
  `);

  console.log('Sanitizer Test Vector Results:', JSON.stringify(testResults, null, 2));
  for (const [test, passed] of Object.entries(testResults)) {
    assert(passed === true, `Test ${test} failed!`);
  }
  console.log('✓ All 7 XSS and HTML sanitization vectors passed successfully!');
  app.exit(0);
});
