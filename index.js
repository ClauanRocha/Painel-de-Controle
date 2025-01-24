const fs = require('fs'); // Importa o módulo fs para ler os certificados
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { sql, poolPromise } = require('./db');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const app = express();
const port = 6060;

// Caminho para seus certificados SSL
const httpsOptions = {
    key: fs.readFileSync('D:/Pneunet/server.key'),
    cert: fs.readFileSync('D:/Pneunet/star_autoamerica_com_br.crt'),
    ca: [
      fs.readFileSync('D:/Pneunet/DigiCertCA.crt'),
      fs.readFileSync('D:/Pneunet/My_CA_Bundle.crt'),
    ],
  };

// Configuração do Axios com Timeout
const axiosInstance = axios.create({
    baseURL: process.env.API_URL,
    timeout: 15000, // Timeout de 10 segundos
});

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Página Inicial (Gráficos)
app.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`
                SELECT DISTINCT 
                    SB2.B2_FILIAL AS FILIAL,
                    SB2.B2_COD AS CODPROD,
                    SUBSTRING(SB1.B1_DESC, 6, LEN(SB1.B1_DESC)) AS DESCRICAO, -- Remove os 5 primeiros caracteres
                    SB2.B2_QATU AS QUANTIDADE,
                    SB2.B2_LOCAL AS LOCAL,
                    SB1.B1_ATIVO AS ATIVO
                FROM SB2010 SB2
                LEFT JOIN SB1010 SB1 
                    ON SB2.B2_COD = SB1.B1_COD 
                    AND SUBSTRING(SB2.B2_FILIAL, 1, 2) = SB1.B1_FILIAL 
                WHERE SB2.D_E_L_E_T_ = ''
                    AND SB2.B2_LOCAL = '06'
                    AND SB2.B2_QATU > 0;
            `);

        const totalProducts = result.recordset.length;
        const activeProducts = result.recordset.filter(product => product.ATIVO === 'S').length;
        const totalStock = result.recordset.reduce((sum, product) => sum + product.QUANTIDADE, 0);

        const productsByLocation = {};
        result.recordset.forEach(product => {
            if (!productsByLocation[product.LOCAL]) productsByLocation[product.LOCAL] = 0;
            productsByLocation[product.LOCAL] += product.QUANTIDADE;
        });

        // Top 10 Produtos com Maior Estoque
        const topProducts = result.recordset
            .filter(product => product.QUANTIDADE > 0)
            .sort((a, b) => b.QUANTIDADE - a.QUANTIDADE)
            .slice(0, 10);

        // Top 10 Produtos com Menor Estoque
        const lowStockProducts = result.recordset
            .filter(product => product.QUANTIDADE > 0)
            .sort((a, b) => a.QUANTIDADE - b.QUANTIDADE)
            .slice(0, 10);

        res.render('index', {
            totalProducts,
            activeProducts,
            totalStock,
            productsByLocation,
            topProducts,
            lowStockProducts
        });
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        res.status(500).send('Erro ao buscar dados');
    }
});

// Página de Relatórios (Tabela)
app.get('/report', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`
             SELECT DISTINCT 
                    SB2.B2_FILIAL AS FILIAL,
                    SB2.B2_COD AS CODPROD,
                    SB1.B1_DESC AS DESCRICAO,
                    SB2.B2_QATU AS QUANTIDADE,
                    SB2.B2_LOCAL AS LOCAL,
                    SB1.B1_ATIVO AS ATIVO
                FROM SB2010 SB2
                LEFT JOIN SB1010 SB1 
                    ON SB2.B2_COD = SB1.B1_COD 
                    AND SUBSTRING(SB2.B2_FILIAL, 1, 2) = SB1.B1_FILIAL 
                WHERE SB2.D_E_L_E_T_ = ''
                    AND SB2.B2_LOCAL = '06'
                    AND SB2.B2_QATU > 0;
            `);
        res.render('report', { products: result.recordset });
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        res.status(500).send('Erro ao buscar dados');
    }
});

// Rota para buscar identidades de marketplaces
app.get('/api/marketplace/identity', async (req, res) => {
    try {
        console.log('x-access-token', process.env.API_TOKEN);
        console.log('storeId', process.env.API_STOREID);

        const response = await axiosInstance.get('/api/marketplace/identity', {
            headers: {
                'x-access-token': process.env.API_TOKEN,
                'storeId': process.env.API_STOREID,
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao buscar marketplaces:', error.message);
        if (error.response) {
            console.error('Detalhes do erro:', error.response.data);
        }
        res.status(error.response ? error.response.status : 500).json({ error: 'Erro ao buscar marketplaces' });
    }
});

// Rota para buscar pedidos
app.get('/api/Orders/', async (req, res) => {
    try {
        console.log('x-access-token', process.env.API_TOKEN);
        console.log('storeId', process.env.API_STOREID);

        const response = await axiosInstance.get('/api/Orders', {
            headers: {
                'x-access-token': process.env.API_TOKEN,
                'storeId': process.env.API_STOREID,
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error.message);
        if (error.response) {
            console.error('Detalhes do erro:', error.response.data);
        }
        res.status(error.response ? error.response.status : 500).json({ error: 'Erro ao buscar pedidos' });
    }
});

// Rotas de Pedidos
        app.get('/pedidos', async (req, res) => {
            try {
                const response = await axios.get(`${process.env.API_URL}/api/Orders`, {
                    headers: {
                        'x-access-token': process.env.API_TOKEN,
                        'storeId': process.env.API_STOREID,
                    },
                });

                // Mapeia os dados relevantes do JSON retornado
                const pedidos = response.data.map(pedido => ({
                    marketplaceName: pedido.marketplaceName || 'Não informado', // Nome do marketplace
                    created: new Date(pedido.created), // Converte para objeto Date
                    customerName: pedido.billing?.name || 'Não informado', // Nome do cliente
                    totalPrice: pedido.totalAmount || 0, // Preço total
                    orderIdMarketplace: pedido.orderIdMarketplace || 'Não informado', // Número do pedido
                }));

                // Ordena os pedidos por data (crescente)
                pedidos.sort((a, b) => b.created.getTime() - a.created.getTime());

                res.render('pedidos', { pedidos });
            } catch (error) {
                console.error('Erro ao buscar pedidos:', error.message);
                res.status(500).send('Erro ao carregar pedidos.');
            }
        });


// Rota para buscar produtos mais vendido
app.get('/api/Orders/', async (req, res) => {
    try {
        console.log('x-access-token', process.env.API_TOKEN);
        console.log('storeId', process.env.API_STOREID);

        // Faz a requisição para buscar os pedidos
        const response = await axiosInstance.get('/api/Orders', {
            headers: {
                'x-access-token': process.env.API_TOKEN,
                'storeId': process.env.API_STOREID,
            },
        });

        // Processar os dados para calcular os produtos mais vendidos
        const orders = response.data;

        // Inicializa o contador de vendas por produto
        const productSales = {};

        orders.forEach(order => {
            order.orderItems.forEach(item => {
                const productName = item.name || 'Produto Desconhecido';
                const quantity = item.quantity || 0;

                // Acumula as quantidades
                productSales[productName] = (productSales[productName] || 0) + quantity;
            });
        });

        // Determina o produto mais vendido
        const topProduct = Object.entries(productSales).reduce((top, current) => {
            return current[1] > top[1] ? current : top;
        }, ['', 0]); // ['Nome do Produto', Quantidade]

        // Envia os resultados
        res.json({
            message: 'Pedidos e produto mais vendido calculados com sucesso',
            topProduct: {
                name: topProduct[0],
                quantity: topProduct[1],
            },
            productSales, // Envia o mapa completo (opcional)
        });
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error.message);
        if (error.response) {
            console.error('Detalhes do erro:', error.response.data);
        }
        res.status(error.response ? error.response.status : 500).json({ error: 'Erro ao buscar pedidos' });
    }
});


// Servidor HTTPS
https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`Servidor rodando em https://localhost:${port}`);
});

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
