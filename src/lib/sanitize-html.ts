import sanitize from 'sanitize-html'

/**
 * Clean model-authored newsletter HTML before it is ever stored, rendered, or
 * emailed.
 *
 * The business name, description and promotions are attacker-controlled and flow
 * into the prompt, so a hostile signup can make the model emit an
 * `<img onerror>` or `<script>` that would run on the app origin when the public
 * preview renders it, or embed a phishing link that goes out from a customer's
 * verified sending domain. Everything the agent legitimately produces is simple
 * inline-styled HTML, so a tight allowlist costs nothing and closes both holes.
 */
export function sanitizeNewsletterHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags: [
      'p', 'br', 'span', 'div', 'a', 'strong', 'b', 'em', 'i', 'u',
      'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr',
      'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'center', 'small',
    ],
    allowedAttributes: {
      '*': ['style', 'align', 'width', 'height', 'bgcolor', 'valign', 'colspan', 'rowspan'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
    },
    // Only real links and inline data images. No javascript:, no vbscript:.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    // Force safe rel on every link that opens a new tab.
    transformTags: {
      a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
    // Drop the tag AND its contents for these, rather than unwrapping them.
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed'],
  })
}
