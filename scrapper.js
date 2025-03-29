const puppeteer = require('puppeteer');
const { create } = require('xmlbuilder2');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});
const fs = require('fs').promises; // Use fs.promises para async/await

async function scrapeAndGenerateXML(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Função para extrair todos os links (sub-URLs) da página
        const subUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links.map(link => link.href).filter(href => href.startsWith(window.location.origin));
        });

        // Função para extrair todos os arquivos (ex: pdf, jpg, etc.) da página
        const files = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links.map(link => link.href).filter(href => {
                const fileExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx', '.zip'];
                return fileExtensions.some(ext => href.toLowerCase().endsWith(ext));
            });
        });

        // Remover URLs duplicadas
        const uniqueSubUrls = [...new Set(subUrls)];
        const uniqueFiles = [...new Set(files)];

        // Criar o objeto XML
        const root = create({ version: '1.0', encoding: 'UTF-8' })
            .ele('urlData')
            .ele('url', { name: url });

        uniqueSubUrls.forEach(subUrl => {
            const subUrlNode = root.ele('subUrl', { name: subUrl });
            uniqueFiles.forEach(file => {
                if (file.startsWith(subUrl)) {
                    subUrlNode.ele('file', { name: file.split('/').pop() });
                }
            });
        });

        root.up();

        // Converter para string XML
        const xmlString = root.end({ prettyPrint: true });

        return xmlString;

    } catch (error) {
        console.error('Erro ao fazer scraping:', error);
        return null; // Retorna null em caso de erro
    } finally {
        await browser.close();
    }
}

// Função para salvar os dados em um arquivo
async function saveToFile(data, filename) {
    try {
        await fs.writeFile(filename, data, 'utf8');
        console.log(`Dados salvos em ${filename}`);
    } catch (error) {
        console.error('Erro ao salvar o arquivo:', error);
    }
}

// Função para obter a URL do usuário
function askForURL() {
    return new Promise((resolve) => {
        readline.question('Digite a URL para fazer scraping: ', (url) => {
            resolve(url);
        });
    });
}

// Função para obter o nome do arquivo do usuário
function askForFilename() {
    return new Promise((resolve) => {
        readline.question('Digite o nome do arquivo para salvar os resultados (ex: data.xml ou data.txt): ', (filename) => {
            resolve(filename);
            readline.close();
        });
    });
}

// Função principal para iniciar o processo
async function main() {
    const targetUrl = await askForURL();
    const filename = await askForFilename();
    const xmlData = await scrapeAndGenerateXML(targetUrl);

    if (xmlData) {
        await saveToFile(xmlData, filename);
    } else {
        console.log('Não foi possível obter os dados para salvar.');
    }
}

main();
