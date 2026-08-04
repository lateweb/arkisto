// script.js

// Kääritään kaikki DOMContentLoaded-tapahtumaan, jotta varmistetaan
// ettei scripti yritä hakea elementtejä ennen kuin sivu on täysin latautunut.
document.addEventListener('DOMContentLoaded', async () => {
    
    // ---------- Teeman hallinta ----------
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');

    if (themeToggle && moonIcon && sunIcon) {
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

    // ---------- Arkiston renderöinti ja haku ----------
    const hylly = document.getElementById('hylly');
    const hakuKentta = document.getElementById('hakukentta');

    function renderArkisto(artikkelit) {
        if (!hylly) return;
        hylly.innerHTML = '';
        
        if (!artikkelit || artikkelit.length === 0) {
            hylly.innerHTML = '<p class="no-results">Ei hakutuloksia.</p>';
            return;
        }
        
        artikkelit.forEach(artikkeli => {
            const linkki = document.createElement('a');
            const params = new URLSearchParams();
            
            if (artikkeli.texFile) params.set('tex', artikkeli.texFile);
            if (artikkeli.bibFile) params.set('bib', artikkeli.bibFile);
            
            linkki.href = `article.html?${params.toString()}`;
            linkki.className = 'entry';
            
            let tagsHTML = '';
            if (artikkeli.avainsanat && Array.isArray(artikkeli.avainsanat) && artikkeli.avainsanat.length > 0) {
                const tagList = artikkeli.avainsanat.map(tag => `<span class="tag">${tag}</span>`).join('');
                tagsHTML = `<div class="entry-tags">${tagList}</div>`;
            }

            const otsikko = artikkeli.otsikko || "Nimetön artikkeli";
            const pvm = artikkeli.pvm || "";
            
            // Poistettu yhden rivin em-dash-rakenne, tekijä ja kuvaus omille riveilleen
            const authorPart = artikkeli.author ? `<div class="entry-author"><strong>${artikkeli.author}</strong></div>` : "";
            const kuvausPart = artikkeli.kuvaus ? `<p class="entry-desc">${artikkeli.kuvaus}</p>` : "";

            linkki.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title">${otsikko}</span>
                    <span class="entry-date">${pvm}</span>
                </div>
                ${authorPart}
                ${kuvausPart}
                ${tagsHTML}
            `;
            
            hylly.appendChild(linkki);
        });
    }

    function suodataArkisto() {
        if (!hakuKentta || typeof window.ENRICHED_ARKISTO_DATA === 'undefined') return;
        
        const haku = (hakuKentta.value || "").toLowerCase().trim();
        
        const suodatettu = window.ENRICHED_ARKISTO_DATA.filter(artikkeli => {
            const ots = (artikkeli.otsikko || "").toLowerCase();
            const kuv = (artikkeli.kuvaus || "").toLowerCase();
            const p = (artikkeli.pvm || "").toLowerCase();
            const auth = (artikkeli.author || "").toLowerCase();
            
            const avainsanaOsuma = (artikkeli.avainsanat && Array.isArray(artikkeli.avainsanat)) 
                ? artikkeli.avainsanat.some(tag => (tag || "").toLowerCase().includes(haku))
                : false;
                
            return ots.includes(haku) || 
                   kuv.includes(haku) ||
                   p.includes(haku) ||
                   auth.includes(haku) ||
                   avainsanaOsuma;
        });
        
        renderArkisto(suodatettu);
    }

    if (hakuKentta) {
        hakuKentta.addEventListener('input', suodataArkisto);
    }

    // ---------- Alustus & Automaattinen parsinta ----------
    if (typeof ARKISTO_DATA !== 'undefined' && Array.isArray(ARKISTO_DATA)) {
        
        if (hylly) {
            hylly.innerHTML = '<p class="no-results">Ladataan arkistoa ja metatietoja...</p>';
        }
        
        let initialData = [...ARKISTO_DATA];
        
        const enrichedData = await Promise.all(initialData.map(async (artikkeli) => {
            if (artikkeli.texFile && (!artikkeli.otsikko || !artikkeli.pvm || !artikkeli.author)) {
                try {
                    const response = await fetch(artikkeli.texFile);
                    if (response.ok) {
                        const tex = await response.text();
                        
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

                        let tempSrc = tex.replace(/\\%/g, '___PCT___').replace(/%.*/g, '').replace(/___PCT___/g, '\\%');
                        
                        if (!artikkeli.otsikko) {
                            let title = cleanMetadata(extractTexMacro(tempSrc, 'title'));
                            if (title) artikkeli.otsikko = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        }
                        if (!artikkeli.pvm) {
                            let date = cleanMetadata(extractTexMacro(tempSrc, 'date'));
                            if (date) artikkeli.pvm = date.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        }
                        if (!artikkeli.author) {
                            let author = cleanMetadata(extractTexMacro(tempSrc, 'author'));
                            if (author) artikkeli.author = author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        }
                    }
                } catch (e) {
                    console.warn("Metatietojen nouto epäonnistui tiedostosta:", artikkeli.texFile, e);
                }
            }
            return artikkeli;
        }));

        window.ENRICHED_ARKISTO_DATA = enrichedData;
        
        const jarjestetty = enrichedData.sort((a, b) => {
            const parseDate = (d) => {
                if (!d || typeof d !== 'string') return 0;
                
                const osat = d.split('.');
                if (osat.length === 3 && !isNaN(parseInt(osat[0])) && !isNaN(parseInt(osat[1])) && !isNaN(parseInt(osat[2]))) {
                    return new Date(osat[2], osat[1] - 1, osat[0]).getTime();
                }
                
                const lowerD = d.toLowerCase();
                const kuukaudet = ["tammi", "helmi", "maalis", "huhti", "touko", "kesä", "heinä", "elo", "syys", "loka", "marras", "joulu"];
                let monthIndex = -1;
                for (let i = 0; i < kuukaudet.length; i++) {
                    if (lowerD.includes(kuukaudet[i] + "kuu")) {
                        monthIndex = i;
                        break;
                    }
                }
                if (monthIndex !== -1) {
                    const dayMatch = lowerD.match(/(\d+)\.?/);
                    const day = dayMatch ? parseInt(dayMatch[1]) : 1;
                    const yearMatch = lowerD.match(/\b(19\d\d|20\d\d)\b/);
                    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
                    return new Date(year, monthIndex, day).getTime();
                }
                
                return new Date(d).getTime() || 0; // Fallback
            };
            return parseDate(b.pvm) - parseDate(a.pvm);
        });
        
        renderArkisto(jarjestetty);
        
    } else {
        console.error("ARKISTO_DATA -muuttujaa ei löytynyt. Varmista että data.js on olemassa ja virheetön.");
        if (hylly) {
            hylly.innerHTML = '<p class="no-results" style="color: red;">Virhe: Dataa ei voitu ladata (ARKISTO_DATA puuttuu).</p>';
        }
    }
});
