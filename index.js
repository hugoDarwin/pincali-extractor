const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const AGENT_URL = 'https://www.pincali.com/inmobiliarios/jose-antonio62';
const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK;
const SECRET_TOKEN = "QualityPrime2026_Secure!";

// Limpieza agresiva de emojis y saltos de línea
function cleanText(str) {
    if (!str) return '';
    return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
              .replace(/\s+/g, ' ').trim();
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => delay(Math.floor(Math.random() * 2000) + 1500);

async function run() {
    console.log("🚀 Iniciando Bot...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto(AGENT_URL, { waitUntil: 'networkidle', timeout: 60000 });
        const propertyUrls = await page.$$eval('a.property__content', links => Array.from(new Set(links.map(a => a.href))));
        
        let resultados = [];

        for (let i = 0; i < propertyUrls.length; i++) {
            console.log(`[${i + 1}/${propertyUrls.length}] Leyendo...`);
            await page.goto(propertyUrls[i], { waitUntil: 'domcontentloaded' });
            
            const data = await page.evaluate(() => {
                let id = document.querySelector('.listing-id span')?.innerText.replace('ID:', '').trim() || 'N/A';
                let titulo = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || 'N/A';
                let precio = document.querySelector('.listing__price .price')?.innerText || 'N/A';
                let ubicacion = document.querySelector('h2.location')?.innerText || 'N/A';
                let descripcion = document.querySelector('.listing__description .text-description')?.innerText || 
                                  document.querySelector('#description-modal .modal-body')?.innerText || '';
                
                let caracteristicas = Array.from(document.querySelectorAll('.listing__features .feature-icon'))
                                    .map(el => el.innerText.trim()).join(' | ');

                let imagenes = Array.from(document.querySelectorAll('.swiper-zoom-container img'))
                                  .map(el => (el.getAttribute('src') || el.getAttribute('data-src')).split('?')[0]);
                if (imagenes.length === 0) {
                    let mainImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
                    if (mainImg) imagenes.push(mainImg.split('?')[0]);
                }

                return { ID: id, Titulo: titulo, Precio: precio, Ubicacion: ubicacion, Caracteristicas: caracteristicas, Descripcion: descripcion, Fecha_Publicacion: document.querySelector('.publication-date span')?.getAttribute('data-publication-date') || 'N/A', Imagenes: imagenes };
            });

            // Ensamblar objeto final (limpio y con columnas dinámicas para imágenes)
            let item = {
                ID: data.ID,
                Titulo: cleanText(data.Titulo),
                Precio: cleanText(data.Precio),
                Ubicacion: cleanText(data.Ubicacion),
                Caracteristicas: cleanText(data.Caracteristicas),
                Descripcion: cleanText(data.Descripcion),
                Fecha_Publicacion: data.Fecha_Publicacion !== 'N/A' ? (JSON.parse(data.Fecha_Publicacion).date || data.Fecha_Publicacion) : 'N/A',
                Total_Imagenes: data.Imagenes.length,
                URL_Propiedad: propertyUrls[i]
            };

            // Magia: Convertimos el array de imágenes en claves individuales (Imagen_1, Imagen_2...)
            data.Imagenes.forEach((imgUrl, idx) => {
                item[`Imagen_${idx + 1}`] = imgUrl;
            });

            resultados.push(item);
            await randomDelay();
        }
        
        console.log(`📤 Enviando datos...`);
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: SECRET_TOKEN, data: resultados })
        });
        console.log("✅", await response.json());

    } catch (error) {
        console.error("🔴 Error:", error);
    } finally {
        await browser.close();
    }
}
run();
