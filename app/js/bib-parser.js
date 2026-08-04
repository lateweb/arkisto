// app/js/bib-parser.js
(function(global) {
  'use strict';

  function parseBibtex(bibSource) {
    const entries = [];
    let safeSource = bibSource.replace(/\\%/g, '___ESC_PCT___');
    safeSource = safeSource.replace(/(^|\s)%.*/g, '');
    const cleaned = safeSource.replace(/___ESC_PCT___/g, '\\%');

    const blocks = cleaned.split(/@/).filter(block => block.trim().length > 0);

    blocks.forEach(block => {
      const typeMatch = block.match(/^(\w+)\s*\{/);
      if (!typeMatch) return;
      const type = typeMatch[1].toLowerCase();
      const keyMatch = block.match(/\{([^,]+),/);
      const key = keyMatch ? keyMatch[1].trim() : '';

      const fields = {};
      const fieldRegex = /(\w+)\s*=\s*[{"]([^}"]+)[}"]\s*,?\s*/g;
      let match;
      while ((match = fieldRegex.exec(block)) !== null) {
        fields[match[1].toLowerCase()] = match[2];
      }

      entries.push({ type, key, fields });
    });
    return entries;
  }

  function formatBibEntry(entry) {
    const f = entry.fields;
    let author = f.author || '';
    let title = f.title || '';
    let year = f.year || '';
    let journal = f.journal || f.booktitle || '';
    let volume = f.volume || '';
    let number = f.number || '';
    let pages = f.pages || '';
    let doi = f.doi || '';

    author = author.replace(/\s+and\s+/ig, ' & ');

    let formatted = '';
    if (author) formatted += `<strong>${author}</strong>. `;
    if (year) formatted += `(${year}). `;
    if (title) formatted += `<em>${title}</em>. `;
    if (journal) formatted += journal;
    if (volume) {
      formatted += `, ${volume}`;
      if (number) formatted += `(${number})`;
    }
    if (pages) formatted += `, ${pages}`;

    formatted = formatted.trim();
    if (!formatted.endsWith('.')) formatted += '.';

    if (doi) {
      doi = doi.replace(/\\url\{([^}]+)\}/g, '$1');
      formatted += ` DOI: <a href="https://doi.org/${doi}" target="_blank" rel="noopener">${doi}</a>`;
    }

    formatted = formatted.replace(/---/g, '—').replace(/--/g, '–');
    formatted = formatted.replace(/\\([&%$#_{}])/g, '$1');

    return formatted;
  }

  global.parseBibtex = parseBibtex;
  global.formatBibEntry = formatBibEntry;
})(window);
