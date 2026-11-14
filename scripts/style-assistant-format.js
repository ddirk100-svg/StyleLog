/**
 * AI 채팅 봇 메시지 — HTML 이스케이프 후 제한적 마크다운 (bold, list, heading)
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInline(s) {
    let t = escapeHtml(s);
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    t = t.replace(/`([^`\n]+)`/g, '<code class="sl-md-code">$1</code>');
    return t;
  }

  function parseOrdered(line) {
    const m = String(line).match(/^\s*(\d+)[.)]\s+(.+)$/);
    return m ? m[2] : null;
  }

  function parseBullet(line) {
    const m = String(line).match(/^\s*[-•]\s+(.+)$/);
    if (m) return m[1];
    const star = String(line).match(/^\s*\*\s+(.+)$/);
    if (star && !/^\*\*/.test(star[1])) return star[1];
    return null;
  }

  function parseHeading(line) {
    const m = String(line).match(/^\s*#{1,3}\s+(.+)$/);
    return m ? m[1] : null;
  }

  function renderBotMessage(text) {
    const raw = String(text ?? '');
    if (!raw.trim()) return '';

    const lines = raw.split('\n');
    const out = [];
    let listType = null;

    function closeList() {
      if (!listType) return;
      out.push(listType === 'ul' ? '</ul>' : '</ol>');
      listType = null;
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        continue;
      }

      const heading = parseHeading(line);
      if (heading) {
        closeList();
        out.push(`<p class="sl-md-heading">${formatInline(heading)}</p>`);
        continue;
      }

      const ordered = parseOrdered(line);
      if (ordered !== null) {
        if (listType !== 'ol') {
          closeList();
          out.push('<ol class="sl-md-list">');
          listType = 'ol';
        }
        out.push(`<li>${formatInline(ordered)}</li>`);
        continue;
      }

      const bullet = parseBullet(line);
      if (bullet !== null) {
        if (listType !== 'ul') {
          closeList();
          out.push('<ul class="sl-md-list">');
          listType = 'ul';
        }
        out.push(`<li>${formatInline(bullet)}</li>`);
        continue;
      }

      closeList();
      out.push(`<p class="sl-md-p">${formatInline(trimmed)}</p>`);
    }
    closeList();

    return `<div class="sl-md">${out.join('')}</div>`;
  }

  window.StyleLogAssistantFormat = { renderBotMessage };
})();