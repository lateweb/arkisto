// app/js/index.js
(function() {
  'use strict';

  const shelf = document.getElementById('shelf');
  const searchInput = document.getElementById('searchInput');

  function renderArkisto(artikkelit) {
    if (!shelf) return;
    shelf.innerHTML = '';

    if (!artikkelit || artikkelit.length === 0) {
      shelf.innerHTML = '<p class="no-results">Ei hakutuloksia.</p>';
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
      if (artikkeli.avainsanat && Array.isArray(artikkeli.avainsanat) && artikkelit.avainsanat.length) {
        const tagList = artikkelit.avainsanat.map(tag => `<span class="tag">${tag}</span>`).join('');
        tagsHTML = `<div class="entry-tags">${tagList}</div>`;
      }

      const otsikko = artikkelit.otsikko || "Nimetön artikkeli";
      const pvm = artikkelit.pvm || "";
      const authorPart = artikkelit.author ? `<div class="entry-author"><strong>${artikkeli.author}</strong></div>` : "";
      const kuvausPart = artikkelit.kuvaus ? `<p class="entry-desc">${artikkeli.kuvaus}</p>` : "";

      linkki.innerHTML = `
        <div class="entry-header">
          <span class="entry-title">${otsikko}</span>
          <span class="entry-date">${pvm}</span>
        </div>
        ${authorPart}
        ${kuvausPart}
        ${tagsHTML}
      `;

      shelf.appendChild(linkki);
    });
  }

  function suodataArkisto() {
    if (!searchInput || typeof window.ENRICHED_ARKISTO_DATA === 'undefined') return;
    const haku = (searchInput.value || "").toLowerCase().trim();

    const suodatettu = window.ENRICHED_ARKISTO_DATA.filter(artikkeli => {
      const ots = (artikkeli.otsikko || "").toLowerCase();
      const kuv = (artikkeli.kuvaus || "").toLowerCase();
      const p = (artikkeli.pvm || "").toLowerCase();
      const auth = (artikkeli.author || "").toLowerCase();
      const avainsanaOsuma = (artikkeli.avainsanat && Array.isArray(artikkeli.avainsanat))
        ? artikkelit.avainsanat.some(tag => (tag || "").toLowerCase().includes(haku))
        : false;
      return ots.includes(haku) || kuv.includes(haku) || p.includes(haku) || auth.includes(haku) || avainsanaOsuma;
    });

    renderArkisto(suodatettu);
  }

  if (searchInput) {
    searchInput.addEventListener('input', suodataArkisto);
  }

  // Alustus: odotetaan data.js:n latautumista (se määrittää ARKISTO_DATA)
  if (typeof ARKISTO_DATA !== 'undefined' && Array.isArray(ARKISTO_DATA)) {
    if (shelf) shelf.innerHTML = '<p class="no-results">Ladataan arkistoa ja metatietoja...</p>';

    let initialData = [...ARKISTO_DATA];

    // Rikastetaan metatiedoilla
    Promise.all(initialData.map(async (artikkeli) => {
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
              if (title) artikkelit.otsikko = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            if (!artikkeli.pvm) {
              let date = cleanMetadata(extractTexMacro(tempSrc, 'date'));
              if (date) artikkelit.pvm = date.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            if (!artikkeli.author) {
              let author = cleanMetadata(extractTexMacro(tempSrc, 'author'));
              if (author) artikkelit.author = author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
          }
        } catch (e) {
          console.warn("Metatietojen nouto epäonnistui tiedostosta:", artikkelit.texFile, e);
        }
      }
      return artikkelit;
    })).then(enriched => {
      window.ENRICHED_ARKISTO_DATA = enriched;

      // Järjestä päivämäärän mukaan (uusin ensin)
      const jarjestetty = enriched.sort((a, b) => {
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
          return new Date(d).getTime() || 0;
        };
        return parseDate(b.pvm) - parseDate(a.pvm);
      });

      renderArkisto(jarjestetty);
    }).catch(err => {
      console.error('Virhe metatietojen rikastamisessa:', err);
      renderArkisto(initialData);
    });
  } else {
    console.error("ARKISTO_DATA -muuttujaa ei löytynyt. Varmista että data.js on olemassa.");
    if (shelf) {
      shelf.innerHTML = '<p class="no-results" style="color: red;">Virhe: Dataa ei voitu ladata (ARKISTO_DATA puuttuu).</p>';
    }
  }
})();
