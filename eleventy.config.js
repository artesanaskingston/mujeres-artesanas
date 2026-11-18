import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import Image from "@11ty/eleventy-img";
import sanitizeHtml from "sanitize-html";

// Read every .yml entry in a content folder (Pages CMS collections).
function readCollection(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort()
    .map((f) => ({ file: f, ...(loadYaml(fs.readFileSync(path.join(dir, f), "utf8")) || {}) }));
}

function readFile(file) {
  if (!fs.existsSync(file)) return {};
  return loadYaml(fs.readFileSync(file, "utf8")) || {};
}

export default function (eleventyConfig) {
  // Fixed design assets and scripts
  eleventyConfig.addPassthroughCopy({ "src/img": "img", "src/js": "js", "media/docs": "media/docs" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/pdfjs-dist/build/pdf.min.mjs": "js/pdfjs/pdf.min.mjs",
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs": "js/pdfjs/pdf.worker.min.mjs",
  });

  // Editable content
  eleventyConfig.addGlobalData("inicio", () => readFile("content/inicio.yml"));
  eleventyConfig.addGlobalData("encabezados", () => readFile("content/encabezados.yml"));
  // Reports for the flipbook: show the active one. If several are marked active,
  // the newest wins; if none is, the flipbook section is hidden.
  eleventyConfig.addGlobalData("informe", () => {
    const activos = readCollection("content/informes").filter((r) => r.activo && (r.pdf_es || r.pdf_en));
    return activos.length ? activos[activos.length - 1] : {};
  });
  // Newest first (Pages CMS names new entries by creation time)
  eleventyConfig.addGlobalData("galeria", () => readCollection("content/galeria").filter((g) => g.imagen).reverse());
  eleventyConfig.addGlobalData("testimonios", () => readCollection("content/testimonios").filter((t) => t.cita || t.quote).reverse());
  // Events: dated ones in date order, undated ("to be announced") last
  eleventyConfig.addGlobalData("talleres", () =>
    readCollection("content/talleres").sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return String(a.fecha).localeCompare(String(b.fecha));
    })
  );

  // Site-wide settings
  eleventyConfig.addGlobalData("site", { email: "mujeresartesanasdekingston@gmail.com" });

  // E-mail protection: escape the text, then turn every address into a link with no
  // readable address in the HTML (user and domain stored reversed, without the @).
  // A small script on the page turns it back into a normal mailto: link.
  const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rev = (t) => t.split("").reverse().join("");
  eleventyConfig.addFilter("emails", (text) =>
    esc(text).replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, user, domain) =>
      `<a class="em" href="#" data-u="${rev(user)}" data-d="${rev(domain)}">${user} (arroba / at) ${domain.replace(/\./g, " · ")}</a>`
    )
  );

  // Plain text that keeps the editor's line breaks (no other formatting)
  eleventyConfig.addFilter("lineas", (value) =>
    esc(String(value ?? "").trim())
      .replace(/\n+/g, "<br>")
      .replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, u, d) =>
        `<a class="em" href="#" data-u="${rev(u)}" data-d="${rev(d)}">${u} (arroba / at) ${d.replace(/\./g, " · ")}</a>`)
  );

  // Formatted text from the rich-text editor: keep simple formatting only,
  // then protect e-mail addresses (in links and in plain text) the same way.
  const emLink = (user, domain) =>
    `<a class="em" href="#" data-u="${rev(user)}" data-d="${rev(domain)}">${user} (arroba / at) ${domain.replace(/\./g, " · ")}</a>`;
  eleventyConfig.addFilter("richtext", (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (!/<[a-z]/i.test(text)) {
      // plain text: paragraphs from blank lines, line breaks kept
      return text.split(/\n\s*\n/).map((para) =>
        `<p>${esc(para).replace(/\n/g, "<br>").replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, u, d) => emLink(u, d))}</p>`
      ).join("");
    }
    let html = sanitizeHtml(text, {
      allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h4", "blockquote",
        "table", "thead", "tbody", "tr", "th", "td"],
      allowedAttributes: { a: ["href", "target", "rel"], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] },
      allowedSchemes: ["http", "https", "mailto"],
      // The editor's "/" menu offers Heading 1-3, Table, Quote, Code block:
      // all headings become one subheading size; a code block becomes a normal paragraph.
      transformTags: {
        h1: "h4", h2: "h4", h3: "h4", h5: "h4", h6: "h4",
        pre: "p",
        code: (tag, attribs) => ({ tagName: "span", attribs: {} }),
        a: (tag, attribs) => ({ tagName: "a", attribs: /^mailto:/i.test(attribs.href || "") ? attribs : { ...attribs, target: "_blank", rel: "noopener" } }),
      },
    });
    // mailto links -> protected links
    html = html.replace(/<a href="mailto:([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})[^"]*"[^>]*>[\s\S]*?<\/a>/gi, (m, u, d) => emLink(u, d));
    // plain addresses in the text (not inside tags)
    html = html.split(/(<[^>]+>)/).map((part) =>
      part.startsWith("<") ? part : part.replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, u, d) => emLink(u, d))
    ).join("");
    return html;
  });

  // Format an event date in Spanish or English, e.g. "sábado 6 de diciembre, 11:00"
  eleventyConfig.addFilter("fecha", (value, lang) => {
    if (!value) return lang === "en" ? "Date to be announced" : "Fecha por anunciar";
    const s = String(value);
    const d = new Date(s.length <= 10 ? s + "T12:00" : s);
    if (isNaN(d)) return s;
    const locale = lang === "en" ? "en-US" : "es-US";
    const day = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const hasTime = s.length > 10;
    const time = hasTime ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : "";
    return hasTime ? `${day}, ${time}` : day;
  });
  eleventyConfig.addFilter("iso", (value) => (value ? String(value) : ""));

  // Resize uploaded photos (phone photos can be huge) into web-friendly sizes.
  eleventyConfig.addAsyncShortcode("foto", async (src, alt = "", cls = "", sizes = "(max-width: 700px) 100vw, 50vw") => {
    if (!src) return "";
    const input = String(src).replace(/^\//, "");
    if (!fs.existsSync(input)) return `<!-- missing image: ${src} -->`;
    const meta = await Image(input, {
      widths: [480, 960, 1600],
      formats: ["webp", "jpeg"],
      outputDir: "_site/img/opt/",
      urlPath: "/img/opt/",
    });
    const full = meta.jpeg[meta.jpeg.length - 1].url;
    const attrs = { alt, sizes, loading: "lazy", decoding: "async" };
    if (cls) attrs.class = cls;
    const html = Image.generateHTML(meta, attrs);
    return html.replace("<img ", `<img data-full="${full}" `);
  });

  // Header photos: a resized version, returned as a CSS background value
  // (falls back to the given default when no photo is chosen).
  eleventyConfig.addAsyncShortcode("fondo", async (src, fallback) => {
    const input = src ? String(src).replace(/^\//, "") : "";
    if (!input || !fs.existsSync(input)) return fallback ? `url(${fallback})` : "none";
    const meta = await Image(input, { widths: [1000, 1800], formats: ["webp", "jpeg"], outputDir: "_site/img/opt/", urlPath: "/img/opt/" });
    const jpg = meta.jpeg.map((m) => m.url), webp = meta.webp.map((m) => m.url);
    // image-set lets the browser pick webp when it can
    return `url(${jpg[jpg.length - 1]}); background-image: image-set(url(${webp[webp.length - 1]}) type('image/webp'), url(${jpg[jpg.length - 1]}) type('image/jpeg'))`;
  });
  eleventyConfig.addFilter("posicion", (p) => ({ top: "center 15%", bottom: "center 85%" }[p] || "center"));

  return {
    dir: { input: "src", output: "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
