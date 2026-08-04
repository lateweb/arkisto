// app/js/article-loader.js
(function() {
  'use strict';

  async function loadArticle() {
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
            bibEntries = window.parseBibtex(bibSource);
          }
        } catch (e) {
          console.warn('Bib-tiedostoa ei ladattu:', e);
        }
      }

      const html = window.latexToHTML(texSource, bibEntries);
      container.innerHTML = html;

      if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise([container]).catch(function (err) {
          console.error("MathJax virhe:", err.message);
        });
      }

      // Build TOC and bibliography after rendering
      window.buildTOC();
      window.renderBibliography(bibEntries);

      const titleEl = container.querySelector('.article-title');
      if (titleEl) {
        document.title = titleEl.textContent + ' – Laten arkisto';
      }
    } catch (error) {
      container.innerHTML = `<p>Virhe ladattaessa artikkelia: ${error.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Sidebar initialisation is handled in sidebar.js
    loadArticle();
  });
})();
