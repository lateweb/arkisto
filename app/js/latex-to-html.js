// app/js/latex-to-html.js
(function(global) {
  'use strict';

  function extractTexMacro(src, macroName) {
    const regex = new RegExp('\\\\' + macroName + '\\s*\\{');
    const match = src.match(regex);
    if (!match) return '';
    let start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    return src.substring(start, i - 1).trim();
  }

  function cleanMetadata(text) {
    let clean = text.replace(/\\(?:textbf|textit|emph|underline)\{([^}]+)\}/g, '$1');
    let prev;
    do {
      prev = clean;
      clean = clean.replace(/\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])*(?:\s*\{[^{}]*\})*/g, '');
    } while (clean !== prev);
    clean = clean.replace(/\\([^a-zA-Z0-9])/g, '$1');
    return clean.trim();
  }

  // ----- Main conversion -----
  function latexToHTML(source, bibEntries) {
    let tempSrc = source.replace(/\\%/g, '___PCT___').replace(/%.*/g, '').replace(/___PCT___/g, '\\%');
    let title = cleanMetadata(extractTexMacro(tempSrc, 'title'));
    let author = cleanMetadata(extractTexMacro(tempSrc, 'author'));
    let date = cleanMetadata(extractTexMacro(tempSrc, 'date'));

    title = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    author = author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    date = date.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = source;

    // 1. Protect math
    const mathStore = [];
    html = html.replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, (_, formula) => {
      mathStore.push(`$$${formula.trim()}$$`);
      return `___MATH_${mathStore.length - 1}___`;
    });
    html = html.replace(/(\\\[([\s\S]*?)\\\])|(\$\$([\s\S]*?)\$\$)/g, (match, p1, p2, p3, p4) => {
      const formula = (p2 || p4 || '').trim();
      mathStore.push(`$$${formula}$$`);
      return `___MATH_${mathStore.length - 1}___`;
    });
    html = html.replace(/\$([^$]+)\$/g, (_, formula) => {
      mathStore.push(`$${formula.trim()}$`);
      return `___MATH_${mathStore.length - 1}___`;
    });

    // 2. Protect special chars
    html = html.replace(/\\&/g, '___ESC_AMP___');
    html = html.replace(/\\%/g, '___ESC_PCT___');
    html = html.replace(/\\\$/g, '___ESC_DOLLAR___');
    html = html.replace(/\\_/g, '___ESC_UNDERSCORE___');
    html = html.replace(/\\#/g, '___ESC_HASH___');
    html = html.replace(/\\\{/g, '___ESC_LBRACE___');
    html = html.replace(/\\\}/g, '___ESC_RBRACE___');

    // 3. Remove comments
    html = html.replace(/%.*/g, '');

    // 4. HTML escape
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 5. Typography & quotes
    html = html.replace(/---/g, '—');
    html = html.replace(/--/g, '–');
    html = html.replace(/``/g, '“');
    html = html.replace(/''/g, '”');

    // 6. Strip preamble
    const beginDoc = html.indexOf('\\begin{document}');
    const endDoc = html.indexOf('\\end{document}');
    if (beginDoc !== -1 && endDoc !== -1 && endDoc > beginDoc) {
      html = html.substring(beginDoc + '\\begin{document}'.length, endDoc);
    }

    // 7. LaTeX structures
    html = html.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (_, content) => {
      return `<div class="abstract">${content.trim()}</div>`;
    });

    let secNum = 0, subsecNum = 0, subsubsecNum = 0;
    html = html.replace(/\\(section|subsection|subsubsection)(\*?)\{([^}]+)\}/g, (match, level, star, titleContent) => {
      let numStr = "";
      if (!star) {
        if (level === 'section') {
          secNum++; subsecNum = 0; subsubsecNum = 0;
          numStr = `${secNum}. `;
        } else if (level === 'subsection') {
          subsecNum++; subsubsecNum = 0;
          numStr = `${secNum}.${subsecNum}. `;
        } else if (level === 'subsubsection') {
          subsubsecNum++;
          numStr = `${secNum}.${subsecNum}.${subsubsecNum}. `;
        }
      }
      const tag = level === 'section' ? 'h2' : (level === 'subsection' ? 'h3' : 'h4');
      return `<${tag}>${numStr}${titleContent}</${tag}>`;
    });

    html = html.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    html = html.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    html = html.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
    html = html.replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
    html = html.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');
    html = html.replace(/\\url\{([^}]+)\}/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '<a href="$1" target="_blank" rel="noopener">$2</a>');

    html = html.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, content) => {
      const items = content.replace(/\\item(?:\[[^\]]*\])?\s*/g, '</li><li>');
      return `<ul><li>${items}</li></ul>`;
    });
    html = html.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, content) => {
      const items = content.replace(/\\item(?:\[[^\]]*\])?\s*/g, '</li><li>');
      return `<ol><li>${items}</li></ol>`;
    });
    html = html.replace(/<li>\s*<\/li>/g, '');
    html = html.replace(/<(ul|ol)><li>/g, '<$1><li>');

    html = html.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, '<blockquote>$1</blockquote>');

    html = html.replace(/\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/g, (_, colSpec, content) => {
      const rows = content.trim().split('\\\\').filter(row => row.trim() !== '' && !row.includes('\\hline'));
      let table = '<table>';
      rows.forEach(row => {
        const cells = row.split(/&amp;/).map(cell => cell.trim());
        table += '<tr>';
        cells.forEach(cell => { table += `<td>${cell}</td>`; });
        table += '</tr>';
      });
      table += '</table>';
      return table;
    });

    html = html.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, '<img src="$1" alt="Kuva">');
    html = html.replace(/\\begin\{figure\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, '<div class="figure">$1</div>');
    html = html.replace(/\\caption\{([^}]+)\}/g, '<div class="caption"><em>$1</em></div>');
    html = html.replace(/\\centering/g, '');

    // ---------- CITATIONS (Harvard/APA) ----------
    function getLastName(authorStr) {
      if (authorStr.includes(',')) {
        return authorStr.split(',')[0].trim();
      } else {
        const parts = authorStr.trim().split(/\s+/);
        return parts[parts.length - 1];
      }
    }

    function getAuthorYear(key) {
      const entry = bibEntries.find(e => e.key === key);
      if (!entry) return { author: key, year: '' };
      let authorField = entry.fields.author || '';
      let authors = authorField.split(/\s+(?:and|\\and)\s+/i).map(a => a.trim());
      let authorStr = key;
      if (authors.length > 0 && authors[0] !== '') {
        if (authors.length === 1) {
          authorStr = getLastName(authors[0]);
        } else if (authors.length === 2) {
          authorStr = getLastName(authors[0]) + ' & ' + getLastName(authors[1]);
        } else {
          authorStr = getLastName(authors[0]) + ' et al.';
        }
      }
      return { author: authorStr, year: entry.fields.year || '' };
    }

    function makeCite(keys, type) {
      const keyArray = keys.split(',').map(k => k.trim());
      if (type === 'paren') {
        const inner = keyArray.map(key => {
          const { author, year } = getAuthorYear(key);
          const text = year ? `${author}, ${year}` : author;
          return `<a href="#bib-${key}" class="cite-link" data-cite="${key}">${text}</a>`;
        }).join('; ');
        return `(${inner})`;
      } else if (type === 'text') {
        return keyArray.map(key => {
          const { author, year } = getAuthorYear(key);
          if (year) {
            return `${author} (<a href="#bib-${key}" class="cite-link" data-cite="${key}">${year}</a>)`;
          } else {
            return `<a href="#bib-${key}" class="cite-link" data-cite="${key}">${author}</a>`;
          }
        }).join(' ja ');
      }
      return `[${keys}]`;
    }

    html = html.replace(/\\(?:pcite|parencite)\{([^}]+)\}/g, (_, keys) => makeCite(keys, 'paren'));
    html = html.replace(/\\(?:tcite|textcite)\{([^}]+)\}/g, (_, keys) => makeCite(keys, 'text'));
    html = html.replace(/\\cite\{([^}]+)\}/g, (_, keys) => makeCite(keys, 'paren'));

    // 8. Remove unknown commands
    html = html.replace(/\\\\/g, '<br>');
    let prevHtml;
    do {
      prevHtml = html;
      html = html.replace(/\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])*(?:\s*\{[^{}]*\})*/g, '');
    } while (html !== prevHtml);
    html = html.replace(/\\([^a-zA-Z0-9])/g, '$1');

    // 9. Paragraph wrapping
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(para => {
      let trimmed = para.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|table|div|img|figure|pre|blockquote)/i.test(trimmed)) {
        return trimmed;
      }
      trimmed = trimmed.replace(/\n/g, ' ');
      return `<p>${trimmed}</p>`;
    }).join('\n');

    // 10. Restore math
    html = html.replace(/___MATH_(\d+)___/g, (_, index) => {
      let math = mathStore[index];
      math = math.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (math.startsWith('$$')) {
        return `<div class="math-display">${math}</div>`;
      }
      return `<span class="math-inline">${math}</span>`;
    });

    // 11. Restore special characters
    html = html.replace(/___ESC_AMP___/g, '&amp;');
    html = html.replace(/___ESC_PCT___/g, '%');
    html = html.replace(/___ESC_DOLLAR___/g, '$');
    html = html.replace(/___ESC_UNDERSCORE___/g, '_');
    html = html.replace(/___ESC_HASH___/g, '#');
    html = html.replace(/___ESC_LBRACE___/g, '{');
    html = html.replace(/___ESC_RBRACE___/g, '}');

    // 12. Article header
    let headerHTML = '';
    if (title || author || date) {
      headerHTML += '<div class="article-header">';
      if (title) headerHTML += `<h1 class="article-title">${title}</h1>`;
      if (author) headerHTML += `<div class="article-author">${author}</div>`;
      if (date) headerHTML += `<div class="article-date">${date}</div>`;
      headerHTML += '</div>';
    }
    return headerHTML + html;
  }

  global.latexToHTML = latexToHTML;
})(window);
