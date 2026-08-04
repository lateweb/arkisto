// article.js

/* ---------- Teeman hallinta ---------- */
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('laten-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.setAttribute('data-theme', 'dark');
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('laten-theme', 'light');
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('laten-theme', 'dark');
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        }
    });
}

/* ---------- Sivupaneelien (Sidebar) logiikka – ilman overlaytä ---------- */
function initSidebars() {
    const tocSidebar = document.getElementById('toc-sidebar');
    const bibSidebar = document.getElementById('bib-sidebar');
    
    const btnOpenToc = document.getElementById('toc-toggle-fixed');
    const btnCloseToc = document.getElementById('close-toc-btn');
    const btnCloseBib = document.getElementById('close-bib-btn');

    function closeAll() {
        if(tocSidebar) tocSidebar.classList.remove('open');
        if(bibSidebar) bibSidebar.classList.remove('open');
    }

    if(btnOpenToc) {
        btnOpenToc.addEventListener('click', () => {
            if (tocSidebar.classList.contains('open')) {
                closeAll();
            } else {
                closeAll();
                tocSidebar.classList.add('open');
            }
        });
    }

    if(btnCloseToc) btnCloseToc.addEventListener('click', closeAll);
    if(btnCloseBib) btnCloseBib.addEventListener('click', closeAll);
}

/* ---------- Sisällysluettelo ---------- */
function buildTOC() {
    const container = document.getElementById('article-container');
    const tocContent = document.getElementById('toc-content');
    if (!container || !tocContent) return;

    const headers = container.querySelectorAll('h2, h3, h4');
    if (headers.length === 0) {
        tocContent.innerHTML = '<p class="toc-empty">Ei väliotsikoita.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'toc-list';

    headers.forEach((header, index) => {
        if (!header.id) {
            header.id = 'sec-' + index;
        }
        
        const li = document.createElement('li');
        li.className = `toc-item toc-${header.tagName.toLowerCase()}`;
        
        const a = document.createElement('a');
        a.href = '#' + header.id;
        a.textContent = header.textContent;
        a.className = 'toc-link';
        
        a.addEventListener('click', () => {
            document.getElementById('toc-sidebar').classList.remove('open');
        });

        li.appendChild(a);
        ul.appendChild(li);
    });

    tocContent.appendChild(ul);
}

/* ---------- BibTeX parser ---------- */
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

/* ---------- LaTeX → HTML – Harvard/APA citations ---------- */
function latexToHTML(source, bibEntries) {
    
    // -- 0. METADATAN POIMINTA --
    function extractTexMacro(src, macroName) {
        const regex = new RegExp('\\\\' + macroName + '\\s*\\{');
        const match = src.match(regex);
        if (!match) return '';
        let start = match.index + match[0].length;
        let depth = 1;
        let i = start;
        while (i < src.length && depth > 0) {
            if (src[i] === '\\') {
                i += 2;
                continue;
            }
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

    let tempSrc = source.replace(/\\%/g, '___PCT___').replace(/%.*/g, '').replace(/___PCT___/g, '\\%');
    let title = cleanMetadata(extractTexMacro(tempSrc, 'title'));
    let author = cleanMetadata(extractTexMacro(tempSrc, 'author'));
    let date = cleanMetadata(extractTexMacro(tempSrc, 'date'));

    title = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    author = author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    date = date.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = source;
    
    // 1. Suojataan matematiikka
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

    // 2. Suojataan yleiset LaTeX-erikoismerkit
    html = html.replace(/\\&/g, '___ESC_AMP___');
    html = html.replace(/\\%/g, '___ESC_PCT___');
    html = html.replace(/\\\$/g, '___ESC_DOLLAR___');
    html = html.replace(/\\_/g, '___ESC_UNDERSCORE___');
    html = html.replace(/\\#/g, '___ESC_HASH___');
    html = html.replace(/\\\{/g, '___ESC_LBRACE___');
    html = html.replace(/\\\}/g, '___ESC_RBRACE___');
    
    // 3. Poistetaan kommentit
    html = html.replace(/%.*/g, '');
    
    // 4. HTML-escape
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 5. Typografia & Lainausmerkit
    html = html.replace(/---/g, '—');
    html = html.replace(/--/g, '–');
    html = html.replace(/``/g, '“');
    html = html.replace(/''/g, '”');
    
    // 6. Preamble-ohitus
    const beginDoc = html.indexOf('\\begin{document}');
    const endDoc = html.indexOf('\\end{document}');
    if (beginDoc !== -1 && endDoc !== -1 && endDoc > beginDoc) {
        html = html.substring(beginDoc + '\\begin{document}'.length, endDoc);
    }

    // 7. LaTeX-rakenteet (Otsikoiden automaattinumerointi)
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

    // ---------- VIITTEET (Harvard/APA) ----------
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
    
    // 8. Tuntemattomat komennot pois
    html = html.replace(/\\\\/g, '<br>');
    let prevHtml;
    do {
        prevHtml = html;
        html = html.replace(/\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])*(?:\s*\{[^{}]*\})*/g, '');
    } while (html !== prevHtml);
    
    html = html.replace(/\\([^a-zA-Z0-9])/g, '$1');

    // 9. Kappale-jäsennys
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
    
    // 10. Palautetaan matematiikka
    html = html.replace(/___MATH_(\d+)___/g, (_, index) => {
        let math = mathStore[index];
        math = math.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (math.startsWith('$$')) {
            return `<div class="math-display">${math}</div>`;
        }
        return `<span class="math-inline">${math}</span>`;
    });

    // 11. Palautetaan erikoismerkit
    html = html.replace(/___ESC_AMP___/g, '&amp;');
    html = html.replace(/___ESC_PCT___/g, '%');
    html = html.replace(/___ESC_DOLLAR___/g, '$');
    html = html.replace(/___ESC_UNDERSCORE___/g, '_');
    html = html.replace(/___ESC_HASH___/g, '#');
    html = html.replace(/___ESC_LBRACE___/g, '{');
    html = html.replace(/___ESC_RBRACE___/g, '}');

    // 12. Artikkelin otsikkotiedot
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

/* ---------- Bibliografia (sivupaneeli) – aakkosjärjestys ---------- */
function renderBibliography(entries) {
    const bibContent = document.getElementById('bib-content');
    if (!bibContent) return;

    if (!entries || entries.length === 0) {
        bibContent.innerHTML = '<p class="toc-empty">Ei lähteitä määritelty.</p>';
        return;
    }

    function getSortKey(entry) {
        let author = entry.fields.author || '';
        let firstAuthor = author.split(/\s+(?:and|\\and)\s+/i)[0].trim();
        if (!firstAuthor) {
            return entry.key.toLowerCase();
        }
        let lastName = firstAuthor;
        if (firstAuthor.includes(',')) {
            lastName = firstAuthor.split(',')[0].trim();
        } else {
            const parts = firstAuthor.split(/\s+/);
            lastName = parts[parts.length - 1];
        }
        return lastName.toLowerCase();
    }

    const sorted = [...entries].sort((a, b) => {
        const keyA = getSortKey(a);
        const keyB = getSortKey(b);
        return keyA.localeCompare(keyB);
    });

    bibContent.innerHTML = '<ul class="bib-list">' +
        sorted.map(e => `<li id="bib-${e.key}">${formatBibEntry(e)}</li>`).join('') +
        '</ul>';
    
    document.querySelectorAll('.cite-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const key = link.getAttribute('data-cite');
            
            const bibSidebar = document.getElementById('bib-sidebar');
            document.getElementById('toc-sidebar').classList.remove('open');
            bibSidebar.classList.add('open');

            if (key) {
                const target = document.getElementById(`bib-${key}`);
                if (target) {
                    setTimeout(() => {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        target.classList.add('highlight-bib');
                        setTimeout(() => target.classList.remove('highlight-bib'), 2000);
                    }, 150);
                }
            }
        });
    });
}

/* ---------- Lataa artikkeli (vain LaTeX .tex) ---------- */
async function loadArticle() {
    initTheme();
    initSidebars();
    
    const params = new URLSearchParams(window.location.search);
    const texFile = params.get('tex');
    const bibFile = params.get('bib');
    const container = document.getElementById('article-container');
    
    if (!texFile) {
        container.innerHTML = '<p>Artikkelia ei löydy.</p>';
        return;
    }
    
    if (!texFile.endsWith('.tex')) {
        container.innerHTML = '<p>Virhe: vain LaTeX-tiedostot (.tex) ovat tuettuja.</p>';
        return;
    }
    
    try {
        const response = await fetch(texFile);
        if (!response.ok) throw new Error('Tiedostoa ei löydy');
        const texSource = await response.text();
        
        let bibEntries = [];
        if (bibFile) {
            try {
                const bibResponse = await fetch(bibFile);
                if (bibResponse.ok) {
                    const bibSource = await bibResponse.text();
                    bibEntries = parseBibtex(bibSource);
                }
            } catch (e) {
                console.warn('Bib-tiedostoa ei ladattu:', e);
            }
        }
        
        const html = latexToHTML(texSource, bibEntries);
        container.innerHTML = html;
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([container]).catch(function (err) {
                console.error("MathJax virhe:", err.message);
            });
        }
        
        buildTOC();
        renderBibliography(bibEntries);
        
        const titleEl = container.querySelector('.article-title');
        if (titleEl) {
            document.title = titleEl.textContent + ' – Laten arkisto';
        }
    } catch (error) {
        container.innerHTML = `<p>Virhe ladattaessa artikkelia: ${error.message}</p>`;
    }
}

window.addEventListener('DOMContentLoaded', loadArticle);
