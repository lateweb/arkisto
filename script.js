// script.js

// Kääritään kaikki DOMContentLoaded-tapahtumaan, jotta varmistetaan
// ettei scripti yritä hakea elementtejä ennen kuin sivu on täysin latautunut.
// Tämä estää "valkoisen sivun" jos HTML latautuu hitaammin kuin JS.
document.addEventListener('DOMContentLoaded', () => {
    
    // ---------- Teeman hallinta ----------
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');

    // Turvatarkastus: varmistetaan että napit oikeasti löytyvät DOMista
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
            
            // Suojaukset: Jos data.js -tiedostosta puuttuu jokin kenttä, sivu ei enää kaadu
            let tagsHTML = '';
            if (artikkeli.avainsanat && Array.isArray(artikkeli.avainsanat) && artikkeli.avainsanat.length > 0) {
                const tagList = artikkeli.avainsanat.map(tag => `<span class="tag">${tag}</span>`).join('');
                tagsHTML = `<div class="entry-tags">${tagList}</div>`;
            }

            const otsikko = artikkeli.otsikko || "Nimetön artikkeli";
            const pvm = artikkeli.pvm || "";
            const kuvaus = artikkeli.kuvaus || "";

            linkki.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title">${otsikko}</span>
                    <span class="entry-date">${pvm}</span>
                </div>
                <p class="entry-desc">${kuvaus}</p>
                ${tagsHTML}
            `;
            
            hylly.appendChild(linkki);
        });
    }

    function suodataArkisto() {
        if (!hakuKentta || typeof ARKISTO_DATA === 'undefined') return;
        
        const haku = (hakuKentta.value || "").toLowerCase().trim();
        
        const suodatettu = ARKISTO_DATA.filter(artikkeli => {
            // Suojataan .toLowerCase() kaatumiselta, jos kenttä sattuisi olemaan tyhjä
            const ots = (artikkeli.otsikko || "").toLowerCase();
            const kuv = (artikkeli.kuvaus || "").toLowerCase();
            const p = (artikkeli.pvm || "").toLowerCase();
            
            const avainsanaOsuma = (artikkeli.avainsanat && Array.isArray(artikkeli.avainsanat)) 
                ? artikkeli.avainsanat.some(tag => (tag || "").toLowerCase().includes(haku))
                : false;
                
            return ots.includes(haku) || 
                   kuv.includes(haku) ||
                   p.includes(haku) ||
                   avainsanaOsuma;
        });
        
        renderArkisto(suodatettu);
    }

    if (hakuKentta) {
        hakuKentta.addEventListener('input', suodataArkisto);
    }

    // ---------- Alustus ----------
    if (typeof ARKISTO_DATA !== 'undefined' && Array.isArray(ARKISTO_DATA)) {
        
        // Järjestetään arkisto. Suojattu päivämäärä-parseri joka ei kaadu virheelliseen dataan.
        const jarjestetty = [...ARKISTO_DATA].sort((a, b) => {
            const parseDate = (d) => {
                if (!d || typeof d !== 'string') return 0;
                const osat = d.split('.');
                if (osat.length === 3) {
                    // new Date(vuosi, kuukausi (0-11), päivä)
                    return new Date(osat[2], osat[1] - 1, osat[0]).getTime();
                }
                return new Date(d).getTime() || 0; // Fallback
            };
            return parseDate(b.pvm) - parseDate(a.pvm);
        });
        
        renderArkisto(jarjestetty);
        
    } else {
        // Jos data.js puuttuu, on välimuistissa tyhjänä tai kaatuu, näytetään virheilmoitus sivulla.
        console.error("ARKISTO_DATA -muuttujaa ei löytynyt. Varmista että data.js on olemassa ja virheetön.");
        if (hylly) {
            hylly.innerHTML = '<p class="no-results" style="color: red;">Virhe: Dataa ei voitu ladata (ARKISTO_DATA puuttuu). Jos olet juuri päivittänyt sivun, kokeile tyhjentää selaimen välimuisti (Ctrl + F5).</p>';
        }
    }
});
