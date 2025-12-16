const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Diretório para salvar QR Codes temporários
const QR_DIR = path.join(__dirname, '../../temp');

// Criar diretório se não existir
if (!fs.existsSync(QR_DIR)) {
    fs.mkdirSync(QR_DIR, { recursive: true });
}

// Gerar QR Code do PIX
async function gerarQRCodePix(chavePix, valor, identificador) {
    try {
        // Criar payload do PIX (simplificado)
        const payload = `PIX:${chavePix}:${valor}`;
        
        // Nome do arquivo
        const filename = `qr_${identificador}_${Date.now()}.png`;
        const filepath = path.join(QR_DIR, filename);

        // Gerar QR Code
        await QRCode.toFile(filepath, payload, {
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300,
            margin: 2
        });

        return filepath;
    } catch (error) {
        console.error('[ERRO] Falha ao gerar QR Code:', error);
        return null;
    }
}

// Gerar QR Code como buffer (para enviar diretamente)
async function gerarQRCodeBuffer(chavePix) {
    try {
        const buffer = await QRCode.toBuffer(chavePix, {
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300,
            margin: 2
        });
        return buffer;
    } catch (error) {
        console.error('[ERRO] Falha ao gerar QR Code buffer:', error);
        return null;
    }
}

// Limpar QR Codes antigos (mais de 1 hora)
function limparQRCodesAntigos() {
    try {
        const files = fs.readdirSync(QR_DIR);
        const agora = Date.now();
        const umaHora = 60 * 60 * 1000;

        files.forEach(file => {
            const filepath = path.join(QR_DIR, file);
            const stats = fs.statSync(filepath);
            if (agora - stats.mtimeMs > umaHora) {
                fs.unlinkSync(filepath);
            }
        });
    } catch (error) {
        console.error('[ERRO] Falha ao limpar QR Codes:', error);
    }
}

// Deletar QR Code específico
function deletarQRCode(filepath) {
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    } catch (error) {
        console.error('[ERRO] Falha ao deletar QR Code:', error);
    }
}

module.exports = {
    gerarQRCodePix,
    gerarQRCodeBuffer,
    limparQRCodesAntigos,
    deletarQRCode
};
