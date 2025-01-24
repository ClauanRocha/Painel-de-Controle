require('dotenv').config(); // Carrega as variáveis do .env
const sql = require('mssql');

// Configuração do SQL Server
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
        console.log('Conectado ao SQL Server');
        return pool;
    })
    .catch((err) => console.error('Falha ao conectar ao SQL Server:', err));

module.exports = { sql, poolPromise };

// Credenciais da API
const API_TOKEN = process.env.API_TOKEN;
const API_URL = process.env.API_URL;
const API_STOREID = process.env.API_STOREID;

// Função para fazer a requisição à API
async function fetchData(endpoint, params = {}) {
    try {
        const response = await axios.get(`${API_URL}/${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'Store-ID': API_STOREID, // Se necessário
            },
            params: params, // Parâmetros adicionais
        });

        console.log('Resposta da API:', response.data);
        return response.data;
    } catch (error) {
        console.error('Erro ao conectar à API:', error.response ? error.response.data : error.message);
        throw error;
    }
}
